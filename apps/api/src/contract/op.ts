// 契約の 1 operation を Hono の handler にする。順序は固定：上限（429）→ 認証（401）→ 認可（403）→ 入力の検証（422・表記ゆらぎの正規化）→ 冪等（409／再送は最初の結果）→ hooks.before → 副作用（hooks.effect・失敗は 502 で記録しない）→ 記録（関門 C2）→ hooks.after
import { createHash } from "node:crypto";
import type { Context } from "hono";
import { ENDPOINTS, type EndpointDef } from "@kaname/contracts";
import { SCHEMAS } from "@kaname/contracts/schemas";
import type { Row, TableName } from "@kaname/db/repository";
import type { Vars } from "../middleware/tenant.js";
import type { ContractDeps, HookArgs } from "./deps.js";
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
const encodeCursor = (n: number) => Buffer.from(String(n)).toString("base64url");
const decodeCursor = (s: string | undefined): number | null => {
  if (!s) return 0;
  const n = Number(Buffer.from(s, "base64url").toString());
  return Number.isInteger(n) && n >= 0 ? n : null;
};
const isRlsError = (e: unknown) => /row-level security|permission denied/.test(String(e));
const pgCode = (e: unknown) => (e as { code?: string }).code ?? "";

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
      if (def.auth === "ops" && ctx.role !== "ops") return err(c, 403, "forbidden", "FORBIDDEN");
      if (def.auth === "member" && ctx.role === "ops" && !(await repo.opsAllowed(ctx)))
        return err(c, 403, "forbidden", "FORBIDDEN");
    }
    // 4) 入力
    const id = def.path.includes(":id") ? (c.req.param("id") ?? "") : null;
    if (id !== null && !/^[0-9a-f-]{36}$/i.test(id))
      return err(c, 422, "validation_failed", "VALIDATION_ERROR", { details: [{ field: "id", message: "uuid" }] });
    let input: Row = {};
    if (def.kind === "create" || def.kind === "update") {
      let raw: unknown;
      try {
        raw = normalize(await c.req.json());
      } catch {
        return err(c, 422, "validation_failed", "VALIDATION_ERROR", { details: [{ field: "body", message: "JSON" }] });
      }
      const parsed = schema!.safeParse(raw);
      if (!parsed.success)
        return err(c, 422, "validation_failed", "VALIDATION_ERROR", {
          details: parsed.error.issues.map((i) => ({ field: i.path.join(".") || "body", message: i.message })),
        });
      input = parsed.data as Row;
    }
    let list: { where: Row; limit: number; offset: number; orderBy?: string } | null = null;
    if (def.kind === "list") {
      const q = c.req.query();
      const limit = q["limit"] === undefined ? LIMIT_DEFAULT : Number(q["limit"]);
      const offset = decodeCursor(q["cursor"]);
      const details: { field: string; message: string }[] = [];
      if (!Number.isInteger(limit) || limit < 1 || limit > LIMIT_MAX)
        details.push({ field: "limit", message: `1〜${LIMIT_MAX}` });
      if (offset === null) details.push({ field: "cursor", message: "不正" });
      if (q["scope_id"] !== undefined && !/^[0-9a-f-]{36}$/i.test(q["scope_id"]))
        details.push({ field: "scope_id", message: "uuid" });
      if (q["sort"] !== undefined && !/^[a-z_][a-z0-9_]{0,62}$/.test(q["sort"]))
        details.push({ field: "sort", message: "列名" });
      if (details.length) return err(c, 422, "validation_failed", "VALIDATION_ERROR", { details });
      list = {
        where: q["scope_id"] ? { scope_id: q["scope_id"] } : {},
        limit,
        offset: offset!,
        ...(q["sort"] ? { orderBy: q["sort"] } : {}),
      };
    }
    // 5) 冪等（POST）
    const idem = def.kind === "create" ? c.req.header("idempotency-key") : undefined;
    const idemKey = idem ? `${ctx.tenantId}:${ctx.userId}:${def.path}:${idem}` : null;
    const inputHash = hashOf(input);
    if (idemKey) {
      const seen = deps.idempotency.get(idemKey);
      if (seen) {
        if (seen.hash !== inputHash) return err(c, 409, "conflict", "CONFLICT", { message: "同じ冪等キーで違う内容" });
        return c.json(seen.body, seen.status as 200); // 最初の結果を返し、副作用を繰り返さない
      }
    }
    const args: HookArgs = { e: def, ctx, repo, input, id, c };
    const hook = deps.hooks[operationId];
    // 6) ポリシー・承認
    if (hook?.before) {
      const r = await hook.before(args);
      if (r) return c.json(r.body, r.status as 200);
    }
    // 7) 副作用（外向き・関門経由）は記録の前。失敗は 502 で記録しない
    if (hook?.effect) {
      const r = await hook.effect(args);
      if (r.status !== "done")
        return err(
          c,
          r.status === "denied" ? 403 : 502,
          r.status === "denied" ? "forbidden" : "external_failed",
          r.status === "denied" ? "FORBIDDEN" : "EXTERNAL_FAILED",
          { message: r.reason, handoff: r.handoff },
        );
    }
    // 8) 記録（関門 C2・RLS）
    const table = repo.table(def.table as TableName);
    const status = def.success;
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
        if (!row) return err(c, 404, "not_found", "NOT_FOUND");
        body = { data: row };
      } else if (def.kind === "create") {
        const row = await table.create(ctx, await withScope(args, input));
        body = { data: row };
      } else if (def.kind === "update") {
        const row = await table.update(ctx, id!, input);
        if (!row) return err(c, 404, "not_found", "NOT_FOUND");
        body = { data: row };
      } else {
        const ok = await table.softDelete(ctx, id!);
        if (!ok) return err(c, 404, "not_found", "NOT_FOUND");
        body = { data: { id } };
      }
    } catch (ex) {
      if (isRlsError(ex) || /追記専用/.test(String(ex))) return err(c, 403, "forbidden", "FORBIDDEN"); // RLS が弾いた＝権限なし／追記専用は直接書けない。副作用は起きていない
      const code = pgCode(ex);
      if (code === "23505") return err(c, 409, "conflict", "CONFLICT", { message: "既に登録済み" });
      if (code === "23503" || code === "22P02" || code === "23502" || /許可されていない識別子/.test(String(ex)))
        return err(c, 422, "validation_failed", "VALIDATION_ERROR", {
          details: [{ field: "body", message: String((ex as Error).message).slice(0, 200) }],
        });
      throw ex;
    }
    if (idemKey) deps.idempotency.set(idemKey, { hash: inputHash, status, body });
    if (hook?.after) {
      try {
        await hook.after(args, (body as { data: Row | Row[] }).data);
      } catch {
        /* 記録の後の通知の失敗で応答を落とさない（再送は関門 C6 の仕事） */
      }
    }
    return c.json(body, status as 200);
  };
}
/** 層を持つ表の作成：契約の入力に scope_id は無い（自分の範囲＝本人の層）。tenant_id は関門が入れる */
async function withScope(a: HookArgs, input: Row): Promise<Row> {
  if ("scope_id" in input || !a.ctx.userId || !a.repo.hasColumn(a.e.table as TableName, "scope_id")) return input;
  const me = await a.repo.table("members").get(a.ctx, a.ctx.userId);
  return me?.["scope_id"] ? { ...input, scope_id: me["scope_id"] } : input;
}
