// 自分のAIとの会話の口（D-104・D-105・T-B-15〜T-B-22）。/api/auth-ext の下に付く（ext.ts から route する）。
//   画面の口：会話の一覧・新しく話す・名前／星／記憶に残さない・消す・見た・止める・止めずに直す・許可の答え（3 択＋一言・問い合わせ）・
//            「いつも許可」の一覧と取り消し・許可の既定・使用量・資料を付ける・記憶の毎朝のまとめ・上げる候補
//   Bridge の口：書きながらの返事（partial）・止める／直すの合図（control）・資料の署名 URL（attachment）・答え（answer2）
// 判定は DB の関数（security definer）の中。読む側で生の select をすると行レベルの制御に弾かれ、例外にならず 0 件になる
import { Hono } from "hono";
import { createDeviceResolver } from "@kaname/auth/resolver";
import type pg from "pg";
import type { TenantContext } from "@kaname/db/context";
import type { ObjectStore } from "@kaname/storage";
import { digestPrompt, takeRemember, type DigestSource } from "./memory.js";
import { artifactRoutes } from "./artifacts.js";
import { deleteConversation, editMemory, newConversation, setConversation } from "./agent-ops.js";

type Resolve = (h: Headers) => Promise<{ ctx: TenantContext } | null>;
export interface AgentDeps {
  appPool: pg.Pool;
  resolve: Resolve;
  objects?: ObjectStore;
  baseUrl: string;
}
const bad = (
  c: { json: (b: unknown, s: number) => Response },
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
) => c.json({ error: code.toLowerCase(), code, message, ...extra }, status);
const UUID = /^[0-9a-f-]{36}$/i;
const MODES = ["manual", "acceptEdits", "auto", "plan", "bypassPermissions"] as const;
const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
/** 長さを切った 1 行（改行を潰す） */
const line = (v: unknown, n: number): string =>
  String(v ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, n);

/** 仕事に持たせる選択（D-104.10・D-104.13・D-104.14）。知らない値は捨てる。全部許可は本人が選んだときだけ画面から来る */
export function jobOptions(b: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (MODES.includes(b["permission_mode"] as (typeof MODES)[number])) o["permission_mode"] = b["permission_mode"];
  if (typeof b["model"] === "string" && /^[a-z0-9.-]{1,40}$/i.test(b["model"])) o["model"] = b["model"];
  if (EFFORTS.includes(b["effort"] as (typeof EFFORTS)[number])) o["effort"] = b["effort"];
  if (Array.isArray(b["tools"]))
    o["tools"] = (b["tools"] as unknown[])
      .map((x) => line(x, 60))
      .filter(Boolean)
      .slice(0, 20);
  if (Array.isArray(b["attachment_ids"]))
    o["attachment_ids"] = (b["attachment_ids"] as unknown[])
      .filter((x) => typeof x === "string" && UUID.test(x))
      .slice(0, 20);
  const q = b["quote"] as { text?: unknown; message_id?: unknown } | undefined;
  if (q && typeof q === "object" && typeof q.text === "string" && q.text.trim())
    o["quote"] = {
      text: q.text.slice(0, 2000),
      message_id: typeof q.message_id === "string" && UUID.test(q.message_id) ? q.message_id : null,
    };
  return o;
}

export function agentRoutes(d: AgentDeps): Hono {
  const app = new Hono();
  const me = async (c: { req: { raw: Request } }) => {
    const s = await d.resolve(c.req.raw.headers);
    return s?.ctx.tenantId && s.ctx.userId ? s.ctx : null;
  };
  const NO = (c: Parameters<typeof bad>[0]) => bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
  const q1 = async <T>(sql: string, args: unknown[]): Promise<T | null> =>
    ((await d.appPool.query(sql, args)).rows[0] as T | undefined) ?? null;
  // 成果物を横で開いて直す・版を戻す（D-106）
  app.route("/", artifactRoutes(d));

  // ---- 会話を分ける（D-104.1）
  app.get("/agent/conversations", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const r = await q1<{ v: unknown }>("select app.agent_conversations($1, $2) as v", [
      ctx.userId,
      line(c.req.query("q"), 80) || null,
    ]);
    return c.json({ data: r?.v ?? [] });
  });
  app.post("/agent/conversations", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const b = (await c.req.json().catch(() => ({}))) as { incognito?: unknown };
    const id = await newConversation(d.appPool, ctx.userId!, b.incognito === true);
    if (!id) return NO(c);
    return c.json({ data: { conversation_id: id } }, 201);
  });
  app.patch("/agent/conversations/:id", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const id = c.req.param("id");
    if (!UUID.test(id)) return bad(c, 422, "VALIDATION_FAILED", "会話の id の形が違います", { field: "id" });
    const b = (await c.req.json().catch(() => ({}))) as { title?: unknown; starred?: unknown; incognito?: unknown };
    const title = b.title === undefined ? null : line(b.title, 80);
    if (b.title !== undefined && !title) return bad(c, 422, "VALIDATION_FAILED", "名前が空です", { field: "title" });
    const ok = await setConversation(d.appPool, ctx.userId!, id, {
      title,
      starred: typeof b.starred === "boolean" ? b.starred : null,
      incognito: typeof b.incognito === "boolean" ? b.incognito : null,
    });
    if (!ok) return bad(c, 404, "CONVERSATION_NOT_FOUND", "この会話はありません");
    return c.json({ data: { ok: true } });
  });
  app.delete("/agent/conversations/:id", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const id = c.req.param("id");
    if (!UUID.test(id)) return bad(c, 422, "VALIDATION_FAILED", "会話の id の形が違います", { field: "id" });
    if (!(await deleteConversation(d.appPool, ctx.userId!, id)))
      return bad(c, 404, "CONVERSATION_NOT_FOUND", "この会話はありません");
    return c.json({ data: { ok: true } });
  });
  app.post("/agent/conversations/:id/read", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const id = c.req.param("id");
    if (!UUID.test(id)) return bad(c, 422, "VALIDATION_FAILED", "会話の id の形が違います", { field: "id" });
    const r = await q1<{ ok: boolean }>("select app.agent_mark_read($1, $2) as ok", [ctx.userId, id]);
    return c.json({ data: { ok: r?.ok === true } });
  });

  // 長い会話は上へ戻ると古い分を読み込む（D-104.18）
  app.get("/agent/messages", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const conv = c.req.query("conversation_id") ?? "";
    const before = c.req.query("before") ?? "";
    if (!UUID.test(conv) || Number.isNaN(Date.parse(before)))
      return bad(c, 422, "VALIDATION_FAILED", "会話の id と、いつより前か が要ります");
    const r = await q1<{ v: unknown }>("select app.agent_messages_before($1, $2, $3, $4) as v", [
      ctx.userId,
      conv,
      before,
      100,
    ]);
    if (!r?.v) return bad(c, 404, "CONVERSATION_NOT_FOUND", "この会話はありません");
    return c.json({ data: r.v });
  });

  // ---- 止める・止めずに直す・順番待ちの取り消し（D-104.9）
  app.post("/agent/stop", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: unknown };
    if (typeof b.job_id !== "string" || !UUID.test(b.job_id))
      return bad(c, 422, "VALIDATION_FAILED", "仕事の id が要ります", { field: "job_id" });
    const r = await q1<{ s: string | null }>("select app.agent_stop($1, $2) as s", [ctx.userId, b.job_id]);
    if (!r?.s) return bad(c, 404, "JOB_NOT_FOUND", "その仕事は見つかりません");
    return c.json({ data: { state: r.s } });
  });
  app.post("/agent/steer", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: unknown; text?: unknown } & Record<string, unknown>;
    const text = String(b.text ?? "")
      .trim()
      .slice(0, 20000);
    if (typeof b.job_id !== "string" || !UUID.test(b.job_id) || !text)
      return bad(c, 422, "VALIDATION_FAILED", "仕事の id と言うことが要ります");
    // 送ったときに選んでいたモード・モデル（区切りに間に合わず次の仕事になったときに使う・D-112）
    const r = await q1<{ ok: boolean }>("select app.agent_steer($1, $2, $3, $4::jsonb) as ok", [
      ctx.userId,
      b.job_id,
      text,
      JSON.stringify(jobOptions(b)),
    ]);
    if (!r?.ok) return bad(c, 409, "JOB_NOT_RUNNING", "その仕事はもう動いていません。そのまま送ると次の依頼になります");
    return c.json({ data: { ok: true } }, 201);
  });

  // 順番待ちの一言を取り消す（まだ渡していないものだけ・D-104.9）
  app.delete("/agent/steer/:id", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    if (!UUID.test(c.req.param("id"))) return bad(c, 422, "VALIDATION_FAILED", "id の形が違います");
    const r = await q1<{ ok: boolean }>("select app.agent_steer_cancel($1, $2) as ok", [ctx.userId, c.req.param("id")]);
    if (!r?.ok) return bad(c, 409, "ALREADY_DELIVERED", "もう自分のAI に渡しました（取り消せません）");
    return c.json({ data: { ok: true } });
  });

  // ---- 許可に答える（D-104.14）：今回だけ／いつも／しない ＋ 一言。問い合わせ（D-104.7）の答えも同じ口
  app.post("/agent/answer2", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const b = (await c.req.json().catch(() => ({}))) as {
      job_id?: unknown;
      request_id?: unknown;
      allow?: unknown;
      scope?: unknown;
      note?: unknown;
      answers?: unknown;
    };
    if (
      typeof b.job_id !== "string" ||
      !UUID.test(b.job_id) ||
      typeof b.request_id !== "string" ||
      typeof b.allow !== "boolean"
    )
      return bad(c, 422, "VALIDATION_FAILED", "仕事の id・request_id・許可するか が要ります");
    const scope = b.scope === "always" ? "always" : "once";
    const answers =
      b.answers && typeof b.answers === "object" && !Array.isArray(b.answers)
        ? Object.fromEntries(
            Object.entries(b.answers as Record<string, unknown>)
              .slice(0, 8)
              .map(([k, v]) => [k.slice(0, 300), String(v ?? "").slice(0, 2000)]),
          )
        : null;
    const r = await q1<{ ok: boolean }>("select app.agent_answer2($1, $2, $3, $4, $5, $6, $7::jsonb) as ok", [
      ctx.userId,
      b.job_id,
      b.request_id,
      b.allow,
      scope,
      line(b.note, 2000) || null,
      answers ? JSON.stringify(answers) : null,
    ]);
    if (!r?.ok) return bad(c, 404, "ASK_NOT_FOUND", "その問いは見つかりません（もう答えたか、仕事が終わっています）");
    return c.json({ data: { ok: true } }, 201);
  });
  app.get("/agent/permission-rules", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const r = await q1<{ v: unknown }>("select app.agent_permission_rules($1) as v", [ctx.userId]);
    const m = await q1<{ mode: string }>("select app.agent_default_mode($1) as mode", [ctx.userId]);
    return c.json({ data: { rules: r?.v ?? [], default_mode: m?.mode ?? "manual" } });
  });
  app.delete("/agent/permission-rules/:id", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const id = c.req.param("id");
    if (!UUID.test(id)) return bad(c, 422, "VALIDATION_FAILED", "id の形が違います", { field: "id" });
    const r = await q1<{ ok: boolean }>("select app.agent_permission_revoke($1, $2) as ok", [ctx.userId, id]);
    if (!r?.ok) return bad(c, 404, "RULE_NOT_FOUND", "その許可は見つかりません");
    return c.json({ data: { ok: true } });
  });
  app.post("/agent/default-mode", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const b = (await c.req.json().catch(() => ({}))) as { mode?: unknown };
    const r = await q1<{ ok: boolean }>("select app.agent_set_default_mode($1, $2) as ok", [
      ctx.userId,
      String(b.mode ?? ""),
    ]);
    if (!r?.ok)
      return bad(
        c,
        422,
        "VALIDATION_FAILED",
        "既定にできるのは 毎回聞く／編集は自動／自動で判断／計画だけ です（全部許可は会話ごとに選びます）",
        { field: "mode" },
      );
    return c.json({ data: { ok: true } });
  });

  // ---- 使用量（D-104.16）
  app.get("/agent/usage", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const r = await q1<{ v: unknown }>("select app.agent_usage($1) as v", [ctx.userId]);
    return c.json({ data: r?.v ?? {} });
  });

  // ---- 資料と画像を付ける（D-104.11）：置き場（関門 C4）に置いてから行を作る。置けなければ行を作らない（E-CHAT-002）
  app.post("/agent/attachments", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    if (!d.objects)
      return bad(
        c,
        503,
        "STORAGE_UNAVAILABLE",
        "資料を置けませんでした（保存先が応答しません）。付けた一覧に残っているので、もう一度送ってください",
      );
    const form = await c.req.parseBody().catch(() => null);
    const f0 = form?.["file"];
    const f = f0 instanceof File ? f0 : null;
    if (!f) return bad(c, 422, "VALIDATION_FAILED", "資料が要ります", { field: "file" });
    const body = new Uint8Array(await f.arrayBuffer());
    const put = await d.objects.put(ctx, body, { contentType: f.type || "application/octet-stream" });
    if (put.status !== "done")
      return put.status === "denied"
        ? bad(c, 413, "E-LIM-002", put.reason)
        : bad(
            c,
            502,
            "E-CHAT-002",
            "資料を置けませんでした（保存先が応答しません）。付けた一覧に残っているので、もう一度送ってください",
          );
    const name = line(f.name, 200) || "資料";
    const r = await q1<{ id: string | null }>("select app.agent_attachment_new($1, $2, $3, $4, $5) as id", [
      ctx.userId,
      put.value.ref,
      name,
      f.type || null,
      put.value.size,
    ]);
    if (!r?.id) return NO(c);
    return c.json({ data: { id: r.id, name, mime: f.type || "application/octet-stream", size: put.value.size } }, 201);
  });

  // ---- 記憶の毎朝のまとめ（D-105.2〜D-105.5）：いまの状態・始める・結果をその場で直す
  app.get("/agent/memory/digest", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const s = await q1<{ v: unknown }>("select app.agent_digest_status($1) as v", [ctx.userId]);
    const mine = await q1<{ v: unknown }>("select app.agent_my_proposals($1) as v", [ctx.userId]);
    const scopes = await q1<{ v: unknown }>("select app.agent_scope_chain($1) as v", [ctx.userId]);
    return c.json({
      data: { ...((s?.v as Record<string, unknown>) ?? {}), proposals: mine?.v ?? [], scopes: scopes?.v ?? [] },
    });
  });
  app.post("/agent/memory/digest", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const s = (
      await q1<{
        v: {
          pending: { from_on: string; to_on: string; conversations: number } | null;
          running: { id: string } | null;
        } | null;
      }>("select app.agent_digest_status($1) as v", [ctx.userId])
    )?.v;
    if (s?.running) return c.json({ data: { digest_id: s.running.id, already: true } });
    if (!s?.pending)
      return bad(c, 409, "NOTHING_TO_DIGEST", "まとめる会話がありません（昨日までの分はまとめ終わっています）");
    const src = (
      await q1<{ v: DigestSource }>("select app.agent_digest_source($1, $2, $3) as v", [
        ctx.userId,
        s.pending.from_on,
        s.pending.to_on,
      ])
    )?.v;
    if (!src) return NO(c);
    const prompt = digestPrompt(src, s.pending.from_on, s.pending.to_on);
    const r = await q1<{ id: string | null }>("select app.agent_digest_start($1, $2, $3, $4, $5) as id", [
      ctx.userId,
      s.pending.from_on,
      s.pending.to_on,
      s.pending.conversations,
      prompt,
    ]);
    if (!r?.id)
      return bad(
        c,
        409,
        "E-MEM-001",
        "あなたの PC が閉じているので、まとめを始められません。PC を起こしてから、もう一度押してください。溜まっている分は消えません",
      );
    return c.json({ data: { digest_id: r.id } }, 201);
  });
  app.post("/agent/memory/digest/:id/undo", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const b = (await c.req.json().catch(() => ({}))) as { memory_id?: unknown };
    if (!UUID.test(c.req.param("id")) || typeof b.memory_id !== "string" || !UUID.test(b.memory_id))
      return bad(c, 422, "VALIDATION_FAILED", "まとめと記憶の id が要ります");
    const r = await q1<{ ok: boolean }>("select app.agent_digest_undo_merge($1, $2, $3) as ok", [
      ctx.userId,
      c.req.param("id"),
      b.memory_id,
    ]);
    if (!r?.ok) return bad(c, 404, "NOT_FOUND", "戻せるまとめが見つかりません");
    return c.json({ data: { ok: true } });
  });
  app.post("/agent/memory/digest/:id/pick", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const b = (await c.req.json().catch(() => ({}))) as { index?: unknown };
    if (!UUID.test(c.req.param("id")) || !Number.isInteger(b.index) || (b.index as number) < 0)
      return bad(c, 422, "VALIDATION_FAILED", "まとめの id と何番目か が要ります");
    const r = await q1<{ id: string | null }>("select app.agent_digest_pick($1, $2, $3) as id", [
      ctx.userId,
      c.req.param("id"),
      b.index,
    ]);
    if (!r?.id) return bad(c, 404, "NOT_FOUND", "拾い直すものが見つかりません");
    return c.json({ data: { memory_id: r.id } }, 201);
  });
  app.patch("/agent/memory/:id", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const b = (await c.req.json().catch(() => ({}))) as { title?: unknown; body?: unknown };
    const body = typeof b.body === "string" ? b.body.trim() : "";
    if (!UUID.test(c.req.param("id")) || !body)
      return bad(c, 422, "VALIDATION_FAILED", "覚えることが空です", { field: "body" });
    if (!(await editMemory(d.appPool, ctx.userId!, c.req.param("id"), line(b.title, 80) || null, body.slice(0, 2000))))
      return bad(c, 404, "MEMORY_NOT_FOUND", "直せる記憶が見つかりません（自分の記憶だけ直せます）");
    return c.json({ data: { ok: true } });
  });
  app.delete("/agent/memory/:id", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    if (!UUID.test(c.req.param("id"))) return bad(c, 422, "VALIDATION_FAILED", "id の形が違います");
    const r = await q1<{ ok: boolean }>("select app.agent_memory_delete($1, $2) as ok", [
      ctx.userId,
      c.req.param("id"),
    ]);
    if (!r?.ok) return bad(c, 404, "MEMORY_NOT_FOUND", "消せる記憶が見つかりません（自分の記憶だけ消せます）");
    return c.json({ data: { ok: true } });
  });

  // ---- 上の層へ上げる候補と確認待ち（D-105.6・D-105.9）
  app.post("/agent/memory/proposals/:id/send", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const b = (await c.req.json().catch(() => ({}))) as { target_scope_id?: unknown };
    const target = typeof b.target_scope_id === "string" && UUID.test(b.target_scope_id) ? b.target_scope_id : null;
    if (!UUID.test(c.req.param("id"))) return bad(c, 422, "VALIDATION_FAILED", "id の形が違います");
    const r = await q1<{ v: unknown }>("select app.agent_proposal_send($1, $2, $3) as v", [
      ctx.userId,
      c.req.param("id"),
      target,
    ]);
    if (!r?.v)
      return bad(c, 404, "PROPOSAL_NOT_FOUND", "送れる候補が見つかりません（上げ先は自分の層か、その上の層だけ）");
    return c.json({ data: r.v });
  });
  app.get("/agent/memory/reviews", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const r = await q1<{ v: unknown }>("select app.agent_memory_reviews($1) as v", [ctx.userId]);
    return c.json({ data: r?.v ?? [] });
  });
  app.post("/agent/memory/proposals/:id/decide", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const b = (await c.req.json().catch(() => ({}))) as { accept?: unknown; body?: unknown };
    if (!UUID.test(c.req.param("id")) || typeof b.accept !== "boolean")
      return bad(c, 422, "VALIDATION_FAILED", "OK か差し戻すか が要ります");
    const r = await q1<{ ok: boolean }>("select app.agent_proposal_decide($1, $2, $3, $4) as ok", [
      ctx.userId,
      c.req.param("id"),
      b.accept,
      typeof b.body === "string" ? b.body.slice(0, 2000) : null,
    ]);
    if (!r?.ok)
      return bad(
        c,
        404,
        "PROPOSAL_NOT_FOUND",
        "確認する候補が見つかりません（もう決まったか、あなたが確認者ではありません）",
      );
    return c.json({ data: { ok: true } });
  });

  // ---- Bridge の口
  // PC の印（K-57）で生きている PC の行を引く。頭があるのに解けない印は、無い PC の行を指す（「生きているか」で 410・Bridge は印を捨てる）
  const resolveDevice = createDeviceResolver(d.appPool);
  // PC の印の形か、前の形（sessions の id）の鍵なら、解けなければ 410（Bridge は捨ててつなぎ直す）。それ以外の形は 401
  const KEY_SHAPE = /^(kpc_[A-Za-z0-9_-]{43}|[0-9a-f-]{36})$/i;
  const bridgeSession = async (c: { req: { raw: Request } }) =>
    KEY_SHAPE.test(c.req.raw.headers.get("x-bridge-session") ?? "")
      ? ((await resolveDevice(c.req.raw.headers))?.sessionId ?? "00000000-0000-4000-8000-000000000000")
      : null;
  const alive = async (sid: string) =>
    (await q1<{ ok: boolean }>("select app.bridge_session_alive($1) as ok", [sid]))?.ok === true;
  const GONE = (c: Parameters<typeof bad>[0]) =>
    bad(c, 410, "SESSION_GONE", "この端末の接続は切れています。つなぎ直してください");
  // 書きながら出る返事の途中（D-104.8）
  // 自分のAI の文を写す（D-112）。本人の PC の Claude Code の記録と同じ id。同じ id は二度入れない
  app.post("/bridge/entries", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    const b = (await c.req.json().catch(() => ({}))) as {
      conversation_id?: unknown;
      job_id?: unknown;
      entries?: unknown;
    };
    if (typeof b.conversation_id !== "string" || !UUID.test(b.conversation_id))
      return bad(c, 422, "VALIDATION_FAILED", "会話の id が要ります");
    if (!Array.isArray(b.entries) || b.entries.length > 500)
      return bad(c, 422, "VALIDATION_FAILED", "写す文は 1〜500 件の並びで送ってください");
    if (!(await alive(sid))) return GONE(c);
    const job = typeof b.job_id === "string" && UUID.test(b.job_id) ? b.job_id : null;
    // 「覚えて」の印は吹き出しに出さない（覚えるのは仕事の結末で 1 回だけ・D-105.1）
    const entries = (b.entries as { uuid?: unknown; text?: unknown; at?: unknown }[]).map((e) => ({
      ...e,
      text: takeRemember(String(e.text ?? "")).text,
    }));
    const r = await q1<{ n: number }>("select app.bridge_entries($1, $2, $3, $4::jsonb) as n", [
      sid,
      b.conversation_id,
      job,
      JSON.stringify(entries),
    ]);
    return c.json({ data: { inserted: r?.n ?? 0 } });
  });
  // 取り戻す先（D-112）：直近の本人の会話と、そこで使った Claude Code の session
  app.post("/bridge/mirror-targets", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    if (!(await alive(sid))) return GONE(c);
    const r = await q1<{ v: unknown }>("select app.bridge_mirror_targets($1) as v", [sid]);
    return c.json({ data: r?.v ?? [] });
  });
  app.post("/bridge/partial", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: unknown; text?: unknown };
    if (typeof b.job_id !== "string" || !UUID.test(b.job_id))
      return bad(c, 422, "VALIDATION_FAILED", "仕事の id が要ります");
    const r = await q1<{ ok: boolean }>("select app.bridge_partial($1, $2, $3) as ok", [
      sid,
      b.job_id,
      String(b.text ?? "").slice(0, 200000),
    ]);
    if (!r?.ok) return (await alive(sid)) ? bad(c, 404, "JOB_NOT_FOUND", "その仕事は動いていません") : GONE(c);
    return c.json({ data: { ok: true } });
  });
  // 止める・止めずに直すの合図（D-104.9）。動いている間、数秒おきに見る
  app.post("/bridge/control", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: unknown };
    if (typeof b.job_id !== "string" || !UUID.test(b.job_id))
      return bad(c, 422, "VALIDATION_FAILED", "仕事の id が要ります");
    const r = await q1<{ v: unknown }>("select app.bridge_control($1, $2) as v", [sid, b.job_id]);
    if (!r?.v) return (await alive(sid)) ? bad(c, 404, "JOB_NOT_FOUND", "その仕事は見つかりません") : GONE(c);
    return c.json({ data: r.v });
  });
  // 区切りで一言を取りに来る（D-104.9）。ここで本人の吹き出しになる
  app.post("/bridge/steers", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: unknown; reply?: unknown };
    if (typeof b.job_id !== "string" || !UUID.test(b.job_id))
      return bad(c, 422, "VALIDATION_FAILED", "仕事の id が要ります");
    const reply = typeof b.reply === "string" ? b.reply.slice(0, 200000) : null;
    const r = await q1<{ v: unknown }>("select app.bridge_take_steers($1, $2, $3) as v", [sid, b.job_id, reply]);
    if (r?.v === null || r?.v === undefined) return GONE(c);
    return c.json({ data: { steers: r.v } });
  });
  // 資料の期限つき署名 URL（D-104.11）。その仕事に付いたものだけ。保存先の鍵は渡さない
  app.post("/bridge/attachment", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: unknown; attachment_id?: unknown };
    if (
      typeof b.job_id !== "string" ||
      !UUID.test(b.job_id) ||
      typeof b.attachment_id !== "string" ||
      !UUID.test(b.attachment_id)
    )
      return bad(c, 422, "VALIDATION_FAILED", "仕事の id と資料の id が要ります");
    const r = await q1<{
      v: { storage_ref: string; name: string; mime: string; size: number; tenant_id: string; member_id: string } | null;
    }>("select app.bridge_attachment($1, $2, $3) as v", [sid, b.job_id, b.attachment_id]);
    if (!r?.v)
      return (await alive(sid)) ? bad(c, 404, "ATTACHMENT_NOT_FOUND", "その資料はこの仕事に付いていません") : GONE(c);
    if (!d.objects) return bad(c, 503, "STORAGE_UNAVAILABLE", "保存先が応答しません");
    const s = await d.objects.signUrl(
      { tenantId: r.v.tenant_id, userId: r.v.member_id, role: "member" },
      r.v.storage_ref,
      600,
    );
    if (s.status !== "done") return bad(c, 502, "E-CHAT-002", "資料の場所を出せませんでした");
    return c.json({
      data: { url: `${d.baseUrl}/api/auth-ext${s.value.url}`, name: r.v.name, mime: r.v.mime, size: r.v.size },
    });
  });
  // 署名 URL の受け口（Bridge が資料を取る）。署名と期限だけで判定し、会社の名前空間の外は出さない
  app.get("/files/:ref{.+}", async (c) => {
    if (!d.objects) return bad(c, 503, "STORAGE_UNAVAILABLE", "保存先が応答しません");
    const ref = decodeURIComponent(c.req.param("ref"));
    const exp = Number(c.req.query("exp"));
    const sig = String(c.req.query("sig") ?? "");
    if (!d.objects.verifySigned(ref, exp, sig))
      return bad(c, 403, "SIGNATURE_INVALID", "この場所は期限が切れたか、正しくありません");
    // 付けた本人を証跡の主語にする。資料の行が無い（消した）置き場は出さない
    const own = await q1<{ v: { tenant_id: string; member_id: string } | null }>(
      "select app.attachment_owner($1) as v",
      [ref],
    );
    if (!own?.v) return bad(c, 404, "FILE_NOT_FOUND", "その資料はもうありません");
    const g = await d.objects.get({ tenantId: own.v.tenant_id, userId: own.v.member_id, role: "member" }, ref);
    if (g.status !== "done") return bad(c, 404, "FILE_NOT_FOUND", g.reason);
    return new Response(g.value.body as unknown as BodyInit, {
      headers: { "content-type": g.value.meta.contentType, "content-length": String(g.value.meta.size) },
    });
  });
  // 答え（許すか・一言・問い合わせの答え）を Bridge が取りに来る
  app.post("/bridge/answer2", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: unknown; request_id?: unknown };
    if (typeof b.job_id !== "string" || !UUID.test(b.job_id) || typeof b.request_id !== "string")
      return bad(c, 422, "VALIDATION_FAILED", "仕事の id と request_id が要ります");
    if (!(await alive(sid))) return GONE(c);
    const r = await q1<{ v: unknown }>("select app.bridge_take_answer2($1, $2, $3) as v", [
      sid,
      b.job_id,
      b.request_id,
    ]);
    return c.json({ data: { answer: r?.v ?? null } });
  });
  return app;
}
