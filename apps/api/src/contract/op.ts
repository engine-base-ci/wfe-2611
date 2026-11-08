// 契約の 1 operation を Hono の handler にする。順序は固定：上限（429）→ 認証（401）→ 認可（403）→ 入力の検証（422・表記ゆらぎの正規化）→ 冪等（409／再送は最初の結果）→ hooks.before → 副作用（hooks.effect・失敗は 502 で記録しない）→ 記録（関門 C2）→ hooks.after
import { createHash } from "node:crypto";
import type { Context } from "hono";
import { ENDPOINTS, isUuid, type EndpointDef } from "@kaname/contracts";
import { SCHEMAS } from "@kaname/contracts/schemas";
import type { Row, TableName } from "@kaname/db/repository";
import type { Vars } from "../middleware/tenant.js";
import type { ContractDeps, Hook, HookArgs } from "./deps.js";
import { checkFor, stepUpFresh } from "./permissions.js";
import { kanameError } from "@kaname/errors";
export type { ContractDeps } from "./deps.js";

const LIMIT_DEFAULT = 50;
const LIMIT_MAX = 200;
type Ctx = Context<Vars>;
type ErrBody = {
  error: string;
  code: string;
  message?: string;
  details?: { field: string; message: string }[];
  retry_after_sec?: number;
  handoff?: string;
};

const err = (c: Ctx, status: number, error: string, code: string, extra: Partial<ErrBody> = {}) =>
  c.json({ error, code, ...extra } as ErrBody, status as 400);
const ipOf = (c: Ctx) =>
  c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "unknown";
const hashOf = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
/** 表記ゆらぎ：全角半角・前後の空白を揃えてから判定する（サーバーが最後の砦） */
export function normalize(v: unknown): unknown {
  if (typeof v === "string") return v.normalize("NFKC").trim();
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === "object")
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, normalize(x)]));
  return v;
}
// 続きの印は、何件目から読むかの数（10 進の文字列・最大 9 桁）。画面はもらったものを返すだけ（契約は pattern で書ける形にした・K-35）
const encodeCursor = (n: number) => String(n);
const decodeCursor = (s: string | undefined): number | null => {
  if (!s) return 0;
  return /^[0-9]{1,9}$/.test(s) ? Number(s) : null;
};
const isRlsError = (e: unknown) => /row-level security|permission denied/.test(String(e));
const pgCode = (e: unknown) => (e as { code?: string }).code ?? "";

/** 同意し直しが要る（403・E-AUTH-010）。文は正本（errors.json）から引く */
export const termsRequired = (c: Context) => {
  const e = kanameError("E-AUTH-010").toJSON() as { message?: string };
  return c.json({ error: "forbidden", code: "E-AUTH-010", message: e.message ?? "" }, 403);
};

/** 入口の止めでセッションを解けなかった（K-53）：止める側に倒して 503・E-PAGE-003。ログには理由の種類だけ（メール・IP・トークンを出さない） */
export const sessionUnresolved = (c: Context, where: string, e: unknown) => {
  console.error(`[terms] ${where}：セッションを解けなかったので止めた（${(e as Error)?.name ?? "Error"}）`);
  const x = kanameError("E-PAGE-003").toJSON() as { message?: string; action?: string };
  return c.json({ error: "unavailable", code: "E-PAGE-003", message: x.message ?? "", action: x.action ?? "" }, 503);
};

/** 入口の uuid（D-129.42・K-144）：契約で format: uuid の道の値と問い合わせ（registry の uuidParams）が正式な uuid か。
 *  道の値は届いたまま確かめる（中で使う値と同じもの）。問い合わせの空の値（?x=）は指定なし。*_ids はカンマ区切りの中身を 1 つずつ */
function uuidParamIssues(c: Ctx, def: EndpointDef): { field: string; message: string }[] {
  const out: { field: string; message: string }[] = [];
  for (const name of def.uuidParams) {
    const inPath = def.path.includes(`:${name}`);
    const v = inPath ? (c.req.param(name) ?? "") : (c.req.query(name) ?? "");
    if (!inPath && v === "") continue;
    const values = !inPath && name.endsWith("_ids") ? v.split(",") : [v];
    if (!values.every(isUuid)) out.push({ field: name, message: "uuid" });
  }
  return out;
}
/** 体の確かめの理由：uuid の形で落ちた欄は "uuid"（道の値と同じ。zod の英語の文を出さない）。ほかは zod のまま */
const issueMessage = (i: { code: string; message: string; format?: string }) =>
  i.code === "invalid_format" && i.format === "uuid" ? "uuid" : i.message;

export function op(deps: ContractDeps, operationId: string) {
  const e = ENDPOINTS.find((x) => x.operationId === operationId);
  if (!e) throw new Error(`契約に無い operation: ${operationId}`);
  const def: EndpointDef = e;
  const schema = def.input ? SCHEMAS[def.input] : null;
  if (def.input && !schema) throw new Error(`schema が無い: ${def.input}`);
  return async (c: Ctx) => {
    const perMinute = deps.limits?.[operationId] ?? def.rateLimit.perMinute;
    const ctx = c.get("ctx");
    const repo = c.get("repo");
    // 1) 上限
    const key = def.rateLimit.key === "user" && ctx.userId ? ctx.userId : ipOf(c);
    if (!deps.limiter(operationId, perMinute).take(`${operationId}:${key}`))
      return err(c, 429, "rate_limited", "RATE_LIMITED", { retry_after_sec: 60 });
    // 2) 認証・3) 認可（役）
    if (def.auth !== "public") {
      if (ctx.role === "anonymous" || !ctx.userId) return err(c, 401, "unauthenticated", "UNAUTHENTICATED");
      // 2.5) 同意し直し（K-53・D-125.162）：ログインしたときに今の版の規約に同意していないセッションは、規約の口・ログアウト・自分の取得の
      //      ほかを止める。副作用の前・記録も書かない。画面の表示に頼らず口で止める（PC のセッションには印が立たない・D-128.137）
      //      止めない口は契約の termsOpen（正本は 05_flow/screen_api.py の TERMS_OPEN_OPS）
      if (c.get("termsPending") && !def.termsOpen) return termsRequired(c);
      // 役は契約の auth と合うものだけ通す（合わなければ止める・ZT2・ZT4・ZT10）
      //   ops：運営の人だけ ／ client：取引先の人だけ（/portal/ の API）／ device：PC の印だけ（/bridge/ の API）
      //   member：社内の人。取引先の人と PC の印は通さない。運営は「中を見る」の許可がある間だけ
      if (def.auth === "ops" && ctx.role !== "ops") return err(c, 403, "forbidden", "FORBIDDEN");
      if (def.auth === "client" && ctx.role !== "client") return err(c, 403, "forbidden", "FORBIDDEN");
      if (def.auth === "device" && ctx.role !== "device") return err(c, 403, "forbidden", "FORBIDDEN");
      if (def.auth === "member") {
        // PC の印は、本人か PC の印で呼べる口（self_or_device）だけ通す
        if (ctx.role === "client" || (ctx.role === "device" && def.perm.word !== "self_or_device"))
          return err(c, 403, "forbidden", "FORBIDDEN");
        if (ctx.role === "ops" && !(await repo.opsAllowed(ctx))) return err(c, 403, "forbidden", "FORBIDDEN");
      }
    }
    // 3.0) 入口の uuid（D-129.42・K-144）：道の値と問い合わせの id を、id で行を引く権限の確かめ（3.1・4.1）とまだ作っていない口の 501 より前に
    //      正式な uuid か確かめる。形の違う id が DB の ::uuid に届いて 500 にならないように
    const badIds = uuidParamIssues(c, def);
    if (badIds.length) return err(c, 422, "validation_failed", "VALIDATION_ERROR", { details: badIds });
    // 3.1) 権限の言葉の段（K-14）：admin の能力・運営のできること など。行に結ぶ言葉は 4.1 で :id の行を読んで確かめる（K-15）
    if (def.auth !== "public") {
      const check = checkFor(def.perm.word);
      const pid = def.path.includes(":id") ? (c.req.param("id") ?? null) : null;
      if (check && !(await check({ e: def, ctx, repo, id: pid }))) return err(c, 403, "forbidden", "FORBIDDEN");
      // 3.2) 本人確認の取り直し（いつも要る口）：直前 15 分以内でなければ止める（D-125.139）。条件つきの口は hooks が requireStepUp で確かめる
      if (def.perm.stepUp === "always" && !stepUpFresh(ctx))
        return err(c, 403, "step_up_required", "STEP_UP_REQUIRED", { message: "本人確認を取り直してから" });
    }
    // 3.5) まだ作っていない口は止める（fail-closed・D-128.113）。表の素の読み書きでない口は hooks に振る舞いが無ければ 501。
    //      素の読み書きでも、表がまだ DB に無ければ 501。共通の処理が「承認する」を「承認の行を作る」に取り違えることを防ぐ
    if (!deps.hooks[operationId] && (!def.generic || !repo.hasColumn(def.table as TableName, "id")))
      return err(c, 501, "not_implemented", "NOT_IMPLEMENTED", { message: "契約にある口だが、まだ作っていない" });
    // 4) 入力
    //    道の id は 3.0 で正式な uuid と確かめ済み（:id は契約で format: uuid）
    const id = def.path.includes(":id") ? (c.req.param("id") ?? "") : null;
    // 4.1) 行に結ぶ言葉（K-15・ZT4）：:id の行を行の守りの中で読み、見えなければ 404（無いのと同じ）・言葉の中の人でなければ 403
    //      本人・担当者・承認する人・受ける人・マネージャー・書ける人。条件は契約の perm.row（scripts/ci/row_rules.mjs）
    if (id !== null && def.perm.row && def.auth === "member") {
      const r = await repo.rowAllowed(ctx, def.perm.row.table, id, def.perm.row.sql);
      if (r === "missing") return err(c, 404, "not_found", "NOT_FOUND");
      if (r === "denied") return err(c, 403, "forbidden", "FORBIDDEN");
    }
    let input: Row = {};
    if (def.kind === "create" || def.kind === "update") {
      let raw: unknown;
      try {
        raw = normalize(await c.req.json());
      } catch {
        return err(c, 422, "validation_failed", "VALIDATION_ERROR", { details: [{ field: "body", message: "JSON" }] });
      }
      // 口の前処理（K-53 の同意：同意の印が無いのを正本のエラーで返す）。前処理の後も、必ず契約の strict な形で確かめる（知らない項目は 422・K-144）
      const pre = deps.hooks[operationId]?.input?.(raw);
      if (pre && "reply" in pre) return c.json(pre.reply.body, pre.reply.status as 400);
      const parsed = schema!.safeParse(pre ? pre.input : raw);
      if (!parsed.success)
        return err(c, 422, "validation_failed", "VALIDATION_ERROR", {
          details: parsed.error.issues.map((i) => ({ field: i.path.join(".") || "body", message: issueMessage(i) })),
        });
      input = parsed.data as Row;
    }
    let list: { where: Row; limit: number; offset: number; orderBy?: string } | null = null;
    if (def.kind === "list") {
      // 空の値（?limit=）は「指定なし」と同じ（画面の検索欄が空のまま送っても 422 にしない・K-35）
      const q = Object.fromEntries(Object.entries(c.req.query()).filter(([, v]) => v !== ""));
      const limit = q["limit"] === undefined ? LIMIT_DEFAULT : Number(q["limit"]);
      const offset = decodeCursor(q["cursor"]);
      const details: { field: string; message: string }[] = [];
      if (!Number.isInteger(limit) || limit < 1 || limit > LIMIT_MAX)
        details.push({ field: "limit", message: `1〜${LIMIT_MAX}` });
      if (offset === null) details.push({ field: "cursor", message: "不正" });
      if (q["scope_id"] !== undefined && !isUuid(q["scope_id"])) details.push({ field: "scope_id", message: "uuid" });
      else if (q["scope_id"] !== undefined && !def.ignoresScope && !repo.hasColumn(def.table as TableName, "scope_id"))
        details.push({ field: "scope_id", message: "この一覧はグループで絞れない" });
      if (
        q["sort"] !== undefined &&
        (!/^[a-z_][a-z0-9_]{0,62}$/.test(q["sort"]) || !repo.hasColumn(def.table as TableName, q["sort"]))
      )
        details.push({ field: "sort", message: "列名" });
      if (details.length) return err(c, 422, "validation_failed", "VALIDATION_ERROR", { details });
      list = {
        where: q["scope_id"] ? { scope_id: q["scope_id"] } : {},
        limit,
        offset: offset!,
        ...(q["sort"] ? { orderBy: q["sort"] } : {}),
      };
    }
    // 5) 冪等（POST）。同じキーで同時に来た要求は、先に来た 1 本の結果を待って同じ結果を返す（記録は 1 回）
    const idem =
      def.kind === "create" && !deps.hooks[operationId]?.noIdempotency ? c.req.header("idempotency-key") : undefined;
    const idemKey = idem ? `${ctx.tenantId}:${ctx.userId}:${def.path}:${idem}` : null;
    const inputHash = hashOf(input);
    if (idemKey) {
      const pending = INFLIGHT.get(idemKey); // 同期で見る（await を挟むと同時の要求がすり抜ける）
      const seen = deps.idempotency.get(idemKey) ?? (pending ? await pending : undefined);
      if (seen) {
        if (seen.hash !== inputHash) return err(c, 409, "conflict", "CONFLICT", { message: "同じ冪等キーで違う内容" });
        return c.json(seen.body, seen.status as 200); // 最初の結果を返し、副作用を繰り返さない
      }
    }
    const args: HookArgs = {
      e: def,
      ctx,
      repo,
      input,
      id,
      c,
      requireStepUp: () =>
        stepUpFresh(ctx)
          ? undefined
          : {
              status: 403,
              body: { error: "step_up_required", code: "STEP_UP_REQUIRED", message: "本人確認を取り直してから" },
            },
    };
    const run = execute(deps.hooks[operationId], args, list).then((r) => ({ hash: inputHash, ...r }));
    if (idemKey)
      INFLIGHT.set(
        idemKey,
        run.catch(() => undefined),
      );
    try {
      const r = await run;
      if (r.raw) return r.raw; // ファイルを流す・置き場へ渡す（冪等の器には入れない）
      if (idemKey && r.status < 300) deps.idempotency.set(idemKey, r);
      return c.json(r.body, r.status as 200);
    } finally {
      if (idemKey) INFLIGHT.delete(idemKey);
    }
  };
}

export type Reply = { status: number; body: unknown; raw?: Response };
/** 同じ冪等キーで処理中の要求（キーに会社・本人を含む）。終わったら消え、結果は idempotency の器に残る */
const INFLIGHT = new Map<string, Promise<(Reply & { hash: string }) | undefined>>();
const fail = (status: number, error: string, code: string, extra: Partial<ErrBody> = {}): Reply => ({
  status,
  body: { error, code, ...extra },
});

/** 6) ポリシー・承認 → 7) 副作用（外向き・関門経由・記録の前。失敗は 502 で記録しない）→ 8) 記録（関門 C2・RLS）→ 9) 記録の後 */
async function execute(
  hook: Hook | undefined,
  args: HookArgs,
  list: { where: Row; limit: number; offset: number; orderBy?: string } | null,
): Promise<Reply> {
  const { e: def, ctx, repo, input, id } = args;
  if (hook?.before) {
    const r = await hook.before(args);
    if (r) return r;
  }
  if (hook?.effect) {
    const r = await hook.effect(args);
    if (r.status !== "done")
      return r.status === "denied"
        ? fail(403, "forbidden", "FORBIDDEN", { message: r.reason, handoff: r.handoff })
        : fail(502, "external_failed", "EXTERNAL_FAILED", { message: r.reason, handoff: r.handoff });
  }
  const table = repo.table(def.table as TableName);
  let body: unknown;
  try {
    if (def.kind === "list") {
      const rows = await table.list(ctx, { ...list!, limit: list!.limit + 1 });
      const data = rows.slice(0, list!.limit);
      body = {
        data,
        meta: {
          limit: list!.limit,
          ...(rows.length > list!.limit ? { cursor: encodeCursor(list!.offset + list!.limit) } : {}),
        },
      };
    } else if (def.kind === "get") {
      const row = await table.get(ctx, id!);
      if (!row) return fail(404, "not_found", "NOT_FOUND");
      body = { data: row };
    } else if (def.kind === "create") {
      body = { data: await table.create(ctx, withOwner(args, await withScope(args, input))) };
    } else if (def.kind === "update") {
      const row = await table.update(ctx, id!, input);
      if (!row) return await unwritable(args);
      body = { data: row };
    } else {
      if (!(await table.softDelete(ctx, id!))) return await unwritable(args);
      body = { data: { id } };
    }
  } catch (ex) {
    if (isRlsError(ex) || /追記専用/.test(String(ex))) return fail(403, "forbidden", "FORBIDDEN"); // RLS が弾いた＝権限なし／追記専用は直接書けない。副作用は起きていない
    const code = pgCode(ex);
    if (code === "23505") return fail(409, "conflict", "CONFLICT", { message: "既に登録済み" });
    if (/決まった承認は変えられません/.test(String(ex)))
      return fail(409, "conflict", "CONFLICT", { message: "この承認はもう決まっています" });
    if (code === "23503" || code === "22P02" || code === "23502" || /許可されていない識別子/.test(String(ex)))
      return fail(422, "validation_failed", "VALIDATION_ERROR", {
        details: [{ field: "body", message: String((ex as Error).message).slice(0, 200) }],
      });
    throw ex;
  }
  if (hook?.after) {
    try {
      await hook.after(args, (body as { data: Row | Row[] }).data);
    } catch {
      /* 記録の後の通知の失敗で応答を落とさない（再送は関門 C6 の仕事） */
    }
  }
  return { status: def.success, body };
}
/** 書けなかった行：見えるのに書けない＝権限なし（403）／見えない＝無い（404。ほかの会社の行があるかどうかは教えない） */
export async function unwritable(
  a: Pick<HookArgs, "e" | "ctx" | "repo" | "id">,
  notFound: Reply = fail(404, "not_found", "NOT_FOUND"),
): Promise<Reply> {
  const visible = a.id ? await a.repo.table(a.e.table as TableName).get(a.ctx, a.id) : null;
  return visible ? fail(403, "forbidden", "FORBIDDEN") : notFound;
}
/** 本人の口（self）の作成：持ち主の列は呼んだ人に決める（入力の値は使わない。他人を持ち主にして作らせない・K-17） */
const OWNER_COLS = ["owner_member_id", "opened_by_member_id", "member_id", "requested_by", "uploaded_by"] as const;
function withOwner(a: HookArgs, input: Row): Row {
  if (a.e.perm.word !== "self" || !a.ctx.userId) return input;
  const col = OWNER_COLS.find((c) => a.repo.hasColumn(a.e.table as TableName, c));
  return col ? { ...input, [col]: a.ctx.userId } : input;
}
/** 層を持つ表の作成：契約の入力に scope_id は無い（自分の範囲＝本人の層）。tenant_id は関門が入れる */
async function withScope(a: HookArgs, input: Row): Promise<Row> {
  if ("scope_id" in input || !a.ctx.userId || !a.repo.hasColumn(a.e.table as TableName, "scope_id")) return input;
  const me = await a.repo.table("members").get(a.ctx, a.ctx.userId);
  return me?.["scope_id"] ? { ...input, scope_id: me["scope_id"] } : input;
}
