// 認証の拡張ルート（/api/auth-ext/*・境界 B2 の外側の口）。Better Auth の /api/auth/* に無い「Kaname としての段取り」：
//   登録（会社を作る hook はパッケージ側）・ロック付きログイン・Bridge の接続コード（資格情報を預ける・取り出す口は契約の口 features/F3/credentials へ移し、前の道すじは K-358 で消した）
// 契約（08_api）の外なのは、認証の操作が Better Auth の口に属するため（T-F-05）。画面のタスク T-U-01〜05／09／10 が使う
import { agentToolRoutes } from "./agent-tools.js";
import { ONBOARD_REMEMBER } from "./conventions.js";
import { Hono } from "hono";
import { CATALOG } from "@kaname/errors";
import type pg from "pg";
import type { Auth } from "@kaname/auth";
import { createDeviceResolver, createSessionResolver, type Resolved } from "@kaname/auth/resolver";
import { mfaRequired, readBodyLimited, sessionUnresolved, termsRequired, TOO_LARGE } from "../contract/op.js";
import { BRIDGE_PROTOCOL_MIN } from "../features/F3/connect-pc/hooks.js";
import type { Repository } from "@kaname/db/repository";
import type { SecretsGateway } from "@kaname/secrets";
import type { ObjectStore } from "@kaname/storage";
import { agentRoutes, jobOptions, jobOptionsIssue } from "./agent.js";
import { badId, idOrNull, isBridgeKeyShape, queryId } from "./ids.js";
import { agentStreamRoutes } from "./agent-stream.js";
import type { MemberHub } from "@kaname/db/listen";

export interface AuthExtDeps {
  auth: Auth;
  appPool: pg.Pool;
  authPool: pg.Pool;
  repo: Repository;
  secrets: SecretsGateway;
  /** 資料の置き場（関門 C4）。無ければ資料は付けられない（E-CHAT-002） */
  objects?: ObjectStore;
  config: {
    secretsMasterKey: string;
    baseUrl: string;
    webBaseUrl: string | null;
    opsEmail: string;
    env: "development" | "staging" | "production" | "test";
    /** Bridge の配布物の置き場（Kaname のサーバー）。空なら「まだ配布していません」 */
    bridgeReleaseBase?: string;
    /** 手元のフォルダから配る（署名と置き場が決まる前の橋渡し） */
    bridgeReleaseDir?: string;
  };
  mailer?: (m: {
    to: string;
    subject: string;
    text: string;
    url: string;
    kind: "verify" | "reset" | "code" | "new_device";
  }) => Promise<void>;
  /** 会話が変わった知らせ（D-113）。無ければ /agent/stream は 503 で、画面は見に行く形のまま */
  hub?: MemberHub | null;
}
/** 会社の名前を外枠に出す形にする：前後の空白（全角を含む）を取り、空なら null。長くても切らない（画面が詰める・K-253） */
export function workspaceName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const name = v.trim();
  return name === "" ? null : name;
}
/** 届かなかった答えを、自分のAI への指示に添える文にする（問い：答え）。無ければ空 */
export function carriedAnswers(v: unknown): string {
  const list = Array.isArray(v)
    ? (v as {
        tool?: string;
        questions?: { question?: string }[];
        answers?: Record<string, string>;
        allow?: boolean;
        note?: string | null;
      }[])
    : [];
  const lines: string[] = [];
  for (const a of list) {
    if (a.tool === "AskUserQuestion" || (a.answers && Object.keys(a.answers).length)) {
      const qs = (a.questions ?? []).map((q) => String(q.question ?? "")).filter(Boolean);
      const ans = a.answers ?? {};
      for (const q of qs.length ? qs : Object.keys(ans)) lines.push(`- ${q}：${ans[q] ?? "（答えなし）"}`);
    } else if (a.tool) {
      lines.push(`- ${a.tool} の実行：${a.allow ? "許可した" : "許可しなかった"}`);
    }
    if (a.note) lines.push(`  （一言：${String(a.note).slice(0, 400)}）`);
  }
  if (!lines.length) return "";
  return `（前に出した問い合わせに、本人はもう答えています。途中で止まってあなたに届いていなかったので、ここで渡します。同じことを聞き直さず、これを踏まえて続けてください）\n${lines.join("\n")}`;
}
const bad = (
  c: { json: (b: unknown, s: number) => Response },
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
) => c.json({ error: code.toLowerCase(), code, message, ...extra }, status);

/** 入れた文字（サービス名か URL）から宛先のドメインを取る。取れなければ null */
export function hostOf(v: string): string | null {
  const m =
    /(?:[a-z][a-z0-9+.-]*:\/\/)?(?:www\.)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})(?![a-z0-9-])/i.exec(
      v.trim(),
    );
  return m ? m[1]!.toLowerCase() : null;
}
/** この版より古い Bridge には仕事を渡さない（定義は features/F3/connect-pc/hooks.ts・K-57 に移した） */
export { BRIDGE_PROTOCOL_MIN };
/** 成果物の本文を受ける口（書き出す・直して保存）。送る量の守りで断るときも成果物の上限の答え（E-ART-001）にする（K-145） */
const ARTIFACT_BODY = /^\/agent\/artifacts(\/[^/]+\/versions)?$/;
/** 同意し直しの間も止めない前の道すじ（K-53）：自分の取得だけ（ログアウトは契約の口 signOut。招待の下見と受諾は契約の口に移して消した・K-337） */
const TERMS_OPEN_EXT = [/^\/me$/];
export function authExt(d: AuthExtDeps): Hono {
  const app = new Hono();
  const fresh = createSessionResolver(d.auth, d.appPool);
  // 同じ要求の中では 1 回だけ解く（app.session_check を 2 回呼ばない・見張りの最後に見た時刻を 2 回進めない）。下の入口の止めが解いた結果を、
  // 各 route と子の道すじ（agent.ts・agent-stream.ts）の resolve が先に使う。要求の頭（Headers）ごとに覚え、要求が終われば消える
  const seen = new WeakMap<Headers, Promise<Resolved | null>>();
  const resolve = (h: Headers): Promise<Resolved | null> => {
    const hit = seen.get(h);
    if (hit) return hit;
    const p = fresh(h);
    seen.set(h, p);
    return p;
  };
  // 送る量の守り（D-130.1・K-145）：前の道すじは契約の入口（op.ts）を通らないので、全部の route より前（ログイン・同意し直しより前）に置く。
  //   読みながら数え、1MB を超えた時点で読むのをやめて 413（頭を偽っても・頭が無くても）。頭が 1MB を超えていれば 1 バイトも読まない。
  //   読んだ体は Hono の器に入れ、各 route の c.req.json() が同じ中身を読む（2 回読まない）。
  //   ファイルを受ける口（資料＝multipart・成果物＝ファイルそのもの）は守りの外（D-135.1・ファイルの上限は置き場と口が持つ）
  app.use("*", async (c, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method)) return next();
    const path = c.req.path.replace(/^\/api\/auth-ext(?=\/|$)/, "") || "/";
    const type = c.req.header("content-type") ?? "";
    // 外すのは道で決める（頭だけで外すと、ログインしていない口にも multipart の頭を付けて守りを抜けられる・K-145 テスター回 2）
    if ((path === "/agent/attachments" && /^multipart\/form-data/i.test(type)) || path === "/bridge/artifact")
      return next();
    const text = await readBodyLimited(c);
    if (text === null)
      // 成果物の本文を受ける口（書き出す・直して保存）は、今までどおり成果物の上限の答え（E-ART-001「1 MB まで」・画面が出す文）で断る
      return ARTIFACT_BODY.test(path)
        ? c.json({ error: "e-art-001", code: "E-ART-001", message: CATALOG["E-ART-001"]?.message ?? "E-ART-001" }, 413)
        : c.json(TOO_LARGE, 413);
    (c.req.bodyCache as unknown as { text?: Promise<string> }).text = Promise.resolve(text);
    return next();
  });
  // 同意し直し（K-53・D-125.162）：印が立ったセッションは、止めない道のほかを 403・E-AUTH-010 で止める（契約の口の入口 op.ts と同じ決まり）。
  //   付けるまで進めない（K-321）の印も同じ所・同じ止めない道で、403・MFA_REQUIRED で止める（前の道すじで預ける・PC の様子を読むを使わせない）。
  //   全部の route より前に 1 つだけ置く。PC のセッション（x-bridge-session）は Better Auth のセッションでないので印を見ない（D-128.137）
  app.use("*", async (c, next) => {
    const path = c.req.path.replace(/^\/api\/auth-ext(?=\/|$)/, "") || "/";
    if (TERMS_OPEN_EXT.some((re) => re.test(path))) return next();
    // セッションの付いていない要求（PC の x-bridge-session・ログインの前）はそのまま渡す。解こうとして落ちたら止める側に倒す（fail-closed）
    const h = c.req.raw.headers;
    if (!h.get("authorization") && !h.get("cookie")) return next();
    let r: Resolved | null;
    try {
      r = await resolve(h);
    } catch (e) {
      return sessionUnresolved(c, "前の道すじ", e);
    }
    if (r?.termsPending) return termsRequired(c);
    // 付けるまで進めない（K-321・D-128.141）：同意し直しの次。止めない道は同意し直しと同じ（上の TERMS_OPEN_EXT）
    if (r?.mfaPending) return mfaRequired(c);
    return next();
  });

  // 登録・待つ画面の状態・送り直しは契約の口（POST /api/v1/auth/sign-up・GET …/status・POST …/resend）に移した（K-51・apps/api/src/features/F1/sign-up/）。
  // 確認のリンクで確定するのも契約の口（POST /api/v1/auth/sign-up/verify・K-52・apps/api/src/features/F1/verify-email/）に移した
  // ログイン（パスワード）と 2 段階の確認は契約の口（POST /api/v1/auth/sign-in・…/two-factor/verify・K-301・K-302）に移し、前の道すじは K-316 で消した

  // 招待の下見と受諾は契約の口（GET /api/v1/auth/invitations/:token・POST …/accept・K-331〜K-333・apps/api/src/features/F2/invitations/）に移し、前の道すじは K-337 で消した

  // はじめの設定の進み具合（T-U-09〜・D-089）。1 PCをつなぐ → 6 本番へ。0 は「まだ何もしていない」。
  // 画面はこれを見て、通していない人を今いる段へ戻す（入口・アプリの枠の両方）
  app.get("/setup-state", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    // 生の SQL だと行レベルの制御に弾かれ、黙って 0（＝まだ何もしていない）になる。/me と同じく文脈つきで読む
    const m = await d.repo.table("members").get(s.ctx, s.ctx.userId);
    if (!m) return bad(c, 404, "MEMBER_NOT_FOUND", "あなたの会員の行が見つかりません");
    return c.json({ data: { step: Number(m["setup_step"] ?? 0), total: 6 } });
  });

  // その段を通した、と記録する（進み具合は戻らない。小さい値では上書きしない）
  app.post("/setup-step", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { step?: number };
    if (!Number.isInteger(b.step) || b.step! < 1 || b.step! > 6)
      return bad(c, 422, "VALIDATION_FAILED", "段は 1〜6 で指定してください", { field: "step" });
    const r = await d.appPool.query<{ v: number }>("select app.setup_step_done($1, $2::smallint) as v", [
      s.ctx.userId,
      b.step,
    ]);
    return c.json({ data: { step: r.rows[0]!.v, total: 6 } });
  });

  // ---- 画面が話す口（自分のAIに言う・止まったものを選び直す・D-090）
  // 会話は 1 本（D-062）。開いている会話が無ければ作る。文脈の本体は Claude の session（Kaname は id だけ持つ）
  app.post("/agent/say", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as {
      text?: string;
      conversation_id?: string;
      branch_from?: string;
      context?: { screen?: unknown; screen_name?: unknown; selected?: unknown };
    } & Record<string, unknown>;
    // id の欄は正式な uuid で確かめる（D-129.42・K-145）。送らない・null は「無し」。形違いは黙って捨てずに 422（D-135.4）
    const convIn = idOrNull(b.conversation_id);
    if (convIn === false) return badId(c, "conversation_id");
    const branchFrom = idOrNull(b.branch_from);
    if (branchFrom === false) return badId(c, "branch_from");
    const issue = jobOptionsIssue(b);
    if (issue) return badId(c, issue, issue === "quote" ? "object" : "uuid");
    const text = (b.text ?? "").trim();
    if (!text) return bad(c, 422, "VALIDATION_FAILED", "言うことが空です", { field: "text" });
    // どこで話しかけられたか（D-103）：会話は同じ 1 本で、自分のAI に渡す指示にだけ前置きする。会話に出す言葉は本人が書いたまま
    const one = (v: unknown, n: number): string =>
      String(v ?? "")
        .replace(/[\r\n]+/g, " ")
        .trim()
        .slice(0, n);
    const screenId = /^[a-z0-9-]{1,40}$/.test(one(b.context?.screen, 40)) ? one(b.context?.screen, 40) : "";
    const screenName = one(b.context?.screen_name, 40);
    const selected = one(b.context?.selected, 120);
    const where =
      screenId || selected
        ? `（Kaname の画面から話しかけています。いま見ている画面：${screenName || screenId || "不明"}${selected ? `／選んでいる 1 件：${selected}` : ""}）`
        : "";
    // 引用して続ける（D-104.17）：吹き出しには引用として出し、自分のAI への指示には引用した文を添える（添えないと何の話か伝わらない）
    const q = (b["quote"] ?? null) as { text?: unknown } | null;
    const quoted =
      q && typeof q.text === "string" && q.text.trim()
        ? `（あなたの返事のこの部分について）\n> ${q.text.trim().replace(/\n/g, "\n> ")}`
        : "";
    // はじめの設定の聞き取り（D-114）：分かった事実はその場で覚える。決まりだけだと効かなかったので、毎回の依頼にも添える（2026-09-29 実例）
    const interview = screenId === "onboard-interview" ? ONBOARD_REMEMBER : "";
    const context = [where, interview, quoted].filter(Boolean).join("\n");
    const conv = await d.appPool.query<{ conv_id: string; agent_session: string | null }>(
      "select * from app.agent_open_conversation($1, $2, $3, $4)",
      [ses.ctx.userId, convIn, branchFrom, text.slice(0, 40)],
    );
    const cv = conv.rows[0];
    if (!cv)
      return bad(c, 404, "CONVERSATION_NOT_FOUND", "この会話はありません（消したか、あなたの会話ではありません）");
    const convId = cv.conv_id;
    // 直して送り直す（D-104.17）：新しいセッションなので、写したやりとりを短くまとめて自分のAI に添える（無いと何の続きか分からない）
    let earlier = "";
    if (branchFrom) {
      const st = await d.appPool.query<{ s: { messages?: { who: string; text: string }[] } }>(
        "select app.agent_state($1, $2) as s",
        [ses.ctx.userId, convId],
      );
      const past = (st.rows[0]?.s.messages ?? []).filter((m) => m.who === "me" || m.who === "ai").slice(-20);
      if (past.length)
        earlier = `（前の会話の途中から、この文を直して送り直しています。ここまでのやりとり）\n${past
          .map((m) => `${m.who === "me" ? "本人" : "あなた"}：${m.text.replace(/\s+/g, " ").slice(0, 400)}`)
          .join("\n")}`;
    }
    // 本人が答えたのに届かないまま止まった問い合わせの答え（Bridge が途中で止まった等）。聞き直させずに渡す（2026-09-28 実例）
    const carried = branchFrom
      ? ""
      : carriedAnswers(
          (
            await d.appPool.query<{ v: unknown }>("select app.agent_carry_answers($1, $2) as v", [
              ses.ctx.userId,
              convId,
            ])
          ).rows[0]?.v,
        );
    // モード・モデル・使うもの・資料・引用（D-104.10〜D-104.14）。全部許可は本人が選んだときだけ画面から来る
    const job = await d.appPool.query<{ id: string | null }>(
      "select app.agent_enqueue($1, $2, $3, $4, $5::jsonb) as id",
      [
        ses.ctx.userId,
        convId,
        text,
        [earlier, carried, context].filter(Boolean).join("\n\n") || null,
        JSON.stringify(jobOptions(b)),
      ],
    );
    // つながっているかは定義の中で見る（読む側で生の select をすると行レベルの制御に弾かれて黙って 0 になる）
    if (!job.rows[0]?.id)
      return bad(
        c,
        409,
        "BRIDGE_NOT_CONNECTED",
        "このPCがつながっていません。自分のPCをつなぐ から先に登録してください",
      );
    return c.json({ data: { conversation_id: convId, job_id: job.rows[0].id } }, 201);
  });

  // 止まった仕事を、人が選び直す（続きから／やり直す／やめる）
  app.post("/agent/resume", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: unknown; how?: string };
    const job = idOrNull(b.job_id);
    if (job === false) return badId(c, "job_id");
    if (!job || !["continue", "restart", "cancel"].includes(b.how ?? ""))
      return bad(c, 422, "VALIDATION_FAILED", "仕事の id と 続きから／やり直す／やめる が要ります");
    const r = await d.appPool.query<{ id: string | null }>("select app.bridge_resume_job($1, $2, $3) as id", [
      ses.ctx.userId,
      job,
      b.how,
    ]);
    if (!r.rows[0]?.id) return bad(c, 404, "JOB_NOT_FOUND", "その仕事は止まっていません");
    return c.json({ data: { job_id: r.rows[0].id } }, 201);
  });

  // 会話のいま（D-090）。言ったこと・返ってきたこと・止まりました・動いている仕事 を 1 回で返す。
  // 画面はこれを繰り返し読むだけ。止まったものは止まったまま出し、人が選ぶ（自動で再開しない）
  app.get("/agent/state", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const conv = queryId(c.req.query("conversation_id"));
    if (conv === false) return badId(c, "conversation_id");
    const r = await d.appPool.query<{ s: unknown }>("select app.agent_state($1, $2) as s", [ses.ctx.userId, conv]);
    return c.json({ data: r.rows[0]!.s });
  });

  // 「新しい会話」（D-062）。いまの 1 本を閉じる。次に言ったことが新しい 1 本になる（前のやりとりは残る）
  app.post("/agent/new", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { conversation_id?: unknown };
    const conv = idOrNull(b.conversation_id);
    if (conv === false) return badId(c, "conversation_id");
    const r = await d.appPool.query<{ ok: boolean }>("select app.agent_close_conversation($1, $2) as ok", [
      ses.ctx.userId,
      conv,
    ]);
    return c.json({ data: { closed: r.rows[0]?.ok ?? false } }, 201);
  });

  // この PC のいま（T-B-04・G-12）。つながっているか／本当に生きているか（最後の知らせからの経過）／自己診断の報告
  app.get("/bridge/state", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const r = await d.appPool.query<{ s: unknown }>("select app.bridge_state($1) as s", [ses.ctx.userId]);
    return c.json({ data: r.rows[0]!.s });
  });

  // ---- Bridge が話す口（T-B-03・D-090）。鍵は claim で受け取った bridge の session id
  // PC の印（K-57）：引き取りで 1 回だけ渡した印のハッシュで、生きている PC の行を引く。sessions の id は鍵にしない（画面の一覧に出る値なので）
  const resolveDevice = createDeviceResolver(d.appPool);
  // PC の印の形か、前の形（sessions の id）の鍵なら、解けなければ 410（Bridge は捨ててつなぎ直す）。それ以外の形は 401
  //   頭が無ければ null（401）。頭があるのに解けない印（切れた・外した・知らない）は、無い PC の行を指す（各口の「生きているか」で 410 になり、Bridge は印を捨てる・G-14）
  const NO_DEVICE = "00000000-0000-4000-8000-000000000000";
  const bridgeSession = async (c: { req: { raw: Request } }) =>
    isBridgeKeyShape(c.req.raw.headers.get("x-bridge-session"))
      ? ((await resolveDevice(c.req.raw.headers))?.sessionId ?? NO_DEVICE)
      : null;
  /** 鍵が生きているか。切れた・退会した・つなぎ直した鍵は 410（Bridge はこれで鍵を捨てる・G-14）。
   *  「仕事が無い（404）」と混ぜない：混ぜると古い仕事 id の 404 で鍵まで捨ててしまう */
  const bridgeAlive = async (sid: string): Promise<boolean> =>
    // 生の select は行レベルの制御に弾かれて 0 件になる。判定は関数の中で（0036）
    (await d.appPool.query<{ ok: boolean }>("select app.bridge_session_alive($1) as ok", [sid])).rows[0]?.ok === true;
  // 仕事を取る・途中の様子・結末を返す・止める合図・道具は契約の口（/api/v1/bridge/jobs/…）に移した（K-62・apps/api/src/features/F5/delegate/）
  const GONE = (c: Parameters<typeof bad>[0]) =>
    bad(c, 410, "SESSION_GONE", "この端末の接続は切れています。つなぎ直してください");

  // 確認（D-093.3）：CLI が「これを実行していいか」と聞いた。画面に出して本人の答えを待つ
  app.post("/bridge/ask", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    if (!(await bridgeAlive(sid))) return GONE(c);
    const b = (await c.req.json().catch(() => ({}))) as {
      job_id?: unknown;
      request_id?: string;
      tool?: string;
      input?: unknown;
      summary?: string;
    };
    const job = idOrNull(b.job_id);
    if (job === false) return badId(c, "job_id");
    if (!job || !b.request_id) return bad(c, 422, "VALIDATION_FAILED", "仕事の id と request_id が要ります");
    const payload = {
      tool: String(b.tool ?? "道具").slice(0, 80),
      input: b.input ?? null,
      summary: String(b.summary ?? "").slice(0, 300),
    };
    const r = await d.appPool.query<{ ok: boolean }>("select app.bridge_ask($1, $2, $3, $4::jsonb) as ok", [
      sid,
      job,
      b.request_id,
      JSON.stringify(payload),
    ]);
    if (!r.rows[0]?.ok) return bad(c, 404, "JOB_NOT_FOUND", "その仕事は動いていません");
    // 2 段階のコード・承認を頼むときは、画面に出すだけでなくメールでも知らせる（D-117.3「承認待ち・通知」・関門 C6）。
    //   送れなくても頼み自体は立つ（画面の行に出ている）。本文にコードや値は無い
    if ((payload.tool === "TwoFactorCode" || payload.tool === "TwoFactorApprove") && d.mailer) {
      const to =
        (await d.appPool.query<{ v: string | null }>("select app.bridge_session_email($1) as v", [sid])).rows[0]?.v ??
        null;
      if (to) {
        const url = `${d.config.webBaseUrl ?? ""}/settings/credentials`;
        void d
          .mailer({
            to,
            kind: "code",
            url,
            subject: `Kaname｜${payload.summary || "ログインの確認が要ります"}`,
            text: `PC の Bridge が、預けたログイン情報でログインを試しています。\n\n${payload.summary}\n\n次のページで答えてください（10 分返事が無ければ止まり、押したときにもう一度試せます）:\n${url}\n\n入れたコードは PC の Bridge だけに渡り、AI にも記録にも残りません。`,
          })
          .catch(() => undefined);
      }
    }
    return c.json({ data: { ok: true } }, 201);
  });
  // Bridge が答えを取りに来る（無ければ null。勝手に許可しない）
  app.post("/bridge/answer", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    if (!(await bridgeAlive(sid))) return GONE(c);
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: unknown; request_id?: string };
    const job = idOrNull(b.job_id);
    if (job === false) return badId(c, "job_id");
    if (!job || !b.request_id) return bad(c, 422, "VALIDATION_FAILED", "仕事の id と request_id が要ります");
    const r = await d.appPool.query<{ a: string | null }>("select app.bridge_take_answer($1, $2, $3) as a", [
      sid,
      job,
      b.request_id,
    ]);
    return c.json({ data: { answer: r.rows[0]?.a ?? null } });
  });
  // 本人が答える（許可する／許可しない）。答えは 出来事・会話・証跡 に残る（D-093.8）
  app.post("/agent/answer", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: unknown; request_id?: string; allow?: boolean };
    const job = idOrNull(b.job_id);
    if (job === false) return badId(c, "job_id");
    if (!job || !b.request_id || typeof b.allow !== "boolean")
      return bad(c, 422, "VALIDATION_FAILED", "仕事の id・request_id・許可するか が要ります");
    const r = await d.appPool.query<{ ok: boolean }>("select app.agent_answer($1, $2, $3, $4) as ok", [
      ses.ctx.userId,
      job,
      b.request_id,
      b.allow,
    ]);
    if (!r.rows[0]?.ok)
      return bad(c, 404, "ASK_NOT_FOUND", "その確認は見つかりません（もう答えたか、仕事が終わっています）");
    return c.json({ data: { ok: true } }, 201);
  });

  // 会話の作り込み（D-104・D-105）の口は agent.ts
  app.route("/", agentStreamRoutes({ resolve, fresh, hub: d.hub ?? null }));
  app.route(
    "/",
    agentRoutes({
      appPool: d.appPool,
      resolve,
      ...(d.objects ? { objects: d.objects } : {}),
      baseUrl: d.config.baseUrl,
    }),
  );

  // 自分のこと（D-086）：画面が「この権限で見えるか」を判定するのに要る。
  // 一覧（GET /members）は行レベルの制御で自分の行すら返らないことがある。自分の役割はここから引く
  app.get("/me", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    // ゲスト（role client・K-875）は社内の表（members）を読めないので、DB の関数で自分の 1 行（表示名・役割 requester）だけを引く
    const guest = s.ctx.role === "client";
    const m = guest
      ? ((await withTenant(
          d.appPool,
          s.ctx,
          async (cl) =>
            (await cl.query<{ v: Record<string, unknown> | null }>("select app.guest_me() as v")).rows[0]?.v,
        )) ?? null)
      : await d.repo.table("members").get(s.ctx, s.ctx.userId);
    // 今いる会社（セッションの会社）の名前（K-253・D-144.2）。関門 C2 の読むだけで、行の守りが今の会社の行だけを見せる。
    // 消した印のある会社は読めないので null（ほかの欄は返す）
    const t = await d.repo.table("tenants").get(s.ctx, s.ctx.tenantId);
    return c.json({
      data: {
        member_id: s.ctx.userId,
        tenant_id: s.ctx.tenantId,
        display_name: m?.["display_name"] ?? null,
        role_id: (m?.["role_id"] as string | null) ?? null,
        scope_id: guest ? null : (m?.["scope_id"] ?? null),
        workspace_name: workspaceName(t?.["name"]),
      },
    });
  });

  // たたき台（D-108.5）：目標（今の版の名前）・台帳・担当業務とAI社員を 1 回で
  app.get("/onboard/draft", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const r = await d.appPool.query<{ v: unknown }>("select app.onboard_draft($1) as v", [s.ctx.userId]);
    return c.json({ data: r.rows[0]?.v ?? { goals: [], ledgers: [], duties: [] } });
  });
  // 5 テストで動かす（T-U-11・D-028・D-116.4）：AI社員ごとの最新のテストの実行・出てきた成果物・本番に切り替えられるか
  app.get("/onboard/testrun", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const r = await d.appPool.query<{ v: unknown }>("select app.onboard_testrun($1) as v", [s.ctx.userId]);
    return c.json({ data: r.rows[0]?.v ?? { employees: [], outputs: [], ready: false } });
  });
  // 「この仕事はやめる」：止まった・実行中のテストの実行を やめた にする（本人の会社の分だけ・証跡に残る）
  app.post("/onboard/testrun/cancel", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { run_id?: unknown };
    const run = idOrNull(b.run_id);
    if (run === false) return badId(c, "run_id");
    if (!run) return bad(c, 422, "VALIDATION_FAILED", "どの実行をやめるかが要ります", { field: "run_id" });
    const r = await d.appPool.query<{ ok: boolean }>("select app.testrun_cancel($1, $2) as ok", [s.ctx.userId, run]);
    if (!r.rows[0]?.ok) return bad(c, 404, "NOT_FOUND", "やめられる実行がありません（止まった・実行中のテストだけ）");
    return c.json({ data: { ok: true } });
  });
  // 6 本番に切り替える（T-U-12・D-028.4・D-116.5）：切り替える前の確認（赤・黄）・明日から動くもの・切り替えたか
  app.get("/onboard/golive", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const r = await d.appPool.query<{ v: unknown }>("select app.onboard_golive($1) as v", [s.ctx.userId]);
    return c.json({
      data: r.rows[0]?.v ?? { checks: [], schedule: [], red: 0, warn: 0, ready: false, shortfall: null, live: null },
    });
  });
  // 「切り替える」：赤が 1 件でもあれば 409（E-DEP-004 の文言）。黄は accept_warnings=true で。押したら会社が本番になり、段 6 を通したと記録される
  app.post("/onboard/golive", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { accept_warnings?: unknown };
    const r = await d.appPool.query<{
      v: { error?: string; message?: string; ok?: boolean; live_at?: string; red?: number; warn?: number };
    }>("select app.onboard_golive_switch($1, $2) as v", [s.ctx.userId, b.accept_warnings === true]);
    const v = r.rows[0]!.v;
    if (v.error === "RED") return bad(c, 409, "GOLIVE_BLOCKED", v.message ?? "足りない設定があります", { red: v.red });
    if (v.error === "WARN") return bad(c, 409, "GOLIVE_WARNINGS", v.message ?? "警告があります", { warn: v.warn });
    if (v.error) return bad(c, 404, "MEMBER_NOT_FOUND", "あなたの会員の行が見つかりません");
    return c.json({ data: { ok: true, live_at: v.live_at } });
  });
  // 「止めたまま本番へ」／「動かす」（E-DEP-004 の一手）：足りない AI社員を動かさないまま切り替えられるようにする
  app.post("/onboard/golive/pause", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { employee_id?: unknown; paused?: unknown; reason?: unknown };
    const employee = idOrNull(b.employee_id);
    if (employee === false) return badId(c, "employee_id");
    if (!employee) return bad(c, 422, "VALIDATION_FAILED", "どの AI社員かが要ります", { field: "employee_id" });
    if (typeof b.paused !== "boolean")
      return bad(c, 422, "VALIDATION_FAILED", "止めるか動かすかが要ります", { field: "paused" });
    const r = await d.appPool.query<{ ok: boolean }>("select app.golive_pause($1, $2, $3, $4) as ok", [
      s.ctx.userId,
      employee,
      b.paused,
      typeof b.reason === "string" ? b.reason : "",
    ]);
    if (!r.rows[0]?.ok) return bad(c, 404, "NOT_FOUND", "その AI社員はこの会社にいません");
    return c.json({ data: { ok: true } });
  });
  // 自分のAI が Kaname の道具でたたき台に置く（D-110）
  app.route("/", agentToolRoutes({ appPool: d.appPool, ...(d.objects ? { objects: d.objects } : {}) }));
  return app;
}
