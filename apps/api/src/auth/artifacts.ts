// 成果物は会話の横で開いて直し、版を残して戻す（D-106・T-B-23）。/api/auth-ext の下に付く（agent.ts から route する）。
//   書き出す：自分のAI の返事の本文（か、その中の表・csv）を版 1 にする。名前は最初の見出しか最初の行
//   直す・戻す：版を 1 つ足すだけ（前の版は消さない）。戻すのも新しい版
//   中身は会社の置き場（関門 C4 の put／get）。ここでは置き場の参照を画面に返さない（見るだけの種類は期限つきの署名 URL）
// 判定は DB の関数（security definer）の中。書き出した本人の物だけが読める・直せる（D-106.8）
import { Hono } from "hono";
import type pg from "pg";
import type { TenantContext } from "@kaname/db/context";
import type { ObjectStore } from "@kaname/storage";
import { CATALOG } from "@kaname/errors";

type Resolve = (h: Headers) => Promise<{ ctx: TenantContext } | null>;
export interface ArtifactDeps {
  appPool: pg.Pool;
  resolve: Resolve;
  objects?: ObjectStore;
  baseUrl: string;
}
type Json = { json: (b: unknown, s: number) => Response };
const bad = (c: Json, status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  c.json({ error: code.toLowerCase(), code, message, ...extra }, status);
const fromCatalog = (c: Json, status: number, id: "E-ART-001" | "E-ART-002") =>
  bad(c, status, id, CATALOG[id]?.message ?? id);
const UUID = /^[0-9a-f-]{36}$/i;
/** 横で直せる本文の上限（D-106.6）。これを超えると作らない */
export const ARTIFACT_TEXT_MAX = 1024 * 1024;
const FORMATS = ["md", "csv"] as const;
type Format = (typeof FORMATS)[number];
const MIME: Record<string, string> = { md: "text/markdown; charset=utf-8", csv: "text/csv; charset=utf-8" };

/** 名前は最初の見出し、無ければ最初の行（書式の印を外して 80 字まで・D-106.1） */
export function titleOf(text: string, fallback = "成果物"): string {
  const h = /^#{1,6}\s+(.+)$/m.exec(text)?.[1];
  const first = h ?? text.split("\n").find((l) => l.trim()) ?? "";
  const t = first
    .replace(/[#*_`~>|[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return t || fallback;
}

interface Meta {
  id: string;
  title: string;
  format: string;
  current_version: number;
  editable: boolean;
  conversation_id: string | null;
  message_id: string | null;
  tenant_id: string;
  updated_at: string;
  storage_ref: string | null;
  versions: {
    version: number;
    at: string;
    by: string;
    reverted_from: number | null;
    size: number | null;
    note: string | null;
  }[];
}
interface Ref {
  storage_ref: string;
  format: string;
  title: string;
  version: number;
  tenant_id: string;
}

export function artifactRoutes(d: ArtifactDeps): Hono {
  const app = new Hono();
  const me = async (c: { req: { raw: Request } }) => {
    const s = await d.resolve(c.req.raw.headers);
    return s?.ctx.tenantId && s.ctx.userId ? s.ctx : null;
  };
  const NO = (c: Json) => bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
  const GONE = (c: Json) => bad(c, 404, "NOT_FOUND", "この成果物はありません");
  const q1 = async <T>(sql: string, args: unknown[]): Promise<T | null> =>
    ((await d.appPool.query(sql, args)).rows[0] as T | undefined) ?? null;
  const text = new TextEncoder();
  const read = async (ctx: TenantContext, ref: string): Promise<string | null> => {
    if (!d.objects) return null;
    const g = await d.objects.get(ctx, ref);
    return g.status === "done" ? new TextDecoder().decode(g.value.body) : null;
  };
  /** 本文を置き場に置く。大きすぎる・置けないときは Response を返す */
  const put = async (
    c: Json,
    ctx: TenantContext,
    body: string,
    format: Format,
  ): Promise<{ ref: string; size: number } | Response> => {
    const bytes = text.encode(body);
    if (bytes.byteLength > ARTIFACT_TEXT_MAX) return fromCatalog(c, 413, "E-ART-001");
    if (!d.objects) return fromCatalog(c, 503, "E-ART-002");
    const r = await d.objects.put(ctx, bytes, { contentType: MIME[format] ?? "text/plain; charset=utf-8" });
    if (r.status !== "done")
      return r.status === "denied" ? fromCatalog(c, 413, "E-ART-001") : fromCatalog(c, 502, "E-ART-002");
    return { ref: r.value.ref, size: r.value.size };
  };
  const view = async (ctx: TenantContext, m: Meta) => {
    const { storage_ref, tenant_id, ...rest } = m;
    void tenant_id;
    // 直せる種類は本文を返す。見るだけの種類（画像・PDF・動画・音声）は期限つきの署名 URL だけ（D-106.5）
    if (m.editable) return { ...rest, text: storage_ref ? await read(ctx, storage_ref) : null };
    const s = storage_ref && d.objects ? await d.objects.signUrl(ctx, storage_ref, 600) : null;
    return { ...rest, url: s?.status === "done" ? `${d.baseUrl}/api/auth-ext${s.value.url}` : null };
  };

  app.get("/agent/artifacts", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const conv = c.req.query("conversation_id");
    const r = await q1<{ v: unknown }>("select app.artifact_list($1, $2) as v", [
      ctx.userId,
      conv && UUID.test(conv) ? conv : null,
    ]);
    return c.json({ data: r?.v ?? [] });
  });

  // 書き出す（D-106.1）：返事の本文そのまま（md）か、その中の表・csv（csv）
  app.post("/agent/artifacts", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const b = (await c.req.json().catch(() => ({}))) as {
      message_id?: unknown;
      text?: unknown;
      format?: unknown;
      title?: unknown;
    };
    if (typeof b.message_id !== "string" || !UUID.test(b.message_id))
      return bad(c, 422, "VALIDATION_FAILED", "どの返事から書き出すかが要ります", { field: "message_id" });
    if (typeof b.text !== "string" || !b.text.trim())
      return bad(c, 422, "VALIDATION_FAILED", "書き出す中身がありません", { field: "text" });
    const format: Format = FORMATS.includes(b.format as Format) ? (b.format as Format) : "md";
    const p = await put(c, ctx, b.text, format);
    if (p instanceof Response) return p;
    const title =
      typeof b.title === "string" && b.title.trim() ? b.title : titleOf(b.text, format === "csv" ? "表" : "成果物");
    const r = await q1<{ id: string | null }>("select app.artifact_create($1, $2, $3, $4, $5, $6) as id", [
      ctx.userId,
      b.message_id,
      title,
      format,
      p.ref,
      p.size,
    ]);
    if (!r?.id) {
      if (d.objects) await d.objects.delete(ctx, p.ref); // 行を作れなかった中身は置き場に残さない
      return bad(c, 404, "NOT_FOUND", "その返事はありません（あなたの会話の自分のAI の返事からだけ書き出せます）");
    }
    const m = await q1<{ v: Meta | null }>("select app.artifact_get($1, $2) as v", [ctx.userId, r.id]);
    return c.json({ data: m?.v ? await view(ctx, m.v) : { id: r.id } }, 201);
  });

  // 1 件と版の一覧（?version=n でその版の中身）
  app.get("/agent/artifacts/:id", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const id = c.req.param("id");
    if (!UUID.test(id)) return GONE(c);
    const m = await q1<{ v: Meta | null }>("select app.artifact_get($1, $2) as v", [ctx.userId, id]);
    if (!m?.v) return GONE(c);
    const ver = Number(c.req.query("version"));
    if (Number.isInteger(ver) && ver > 0 && ver !== m.v.current_version) {
      const r = await q1<{ v: Ref | null }>("select app.artifact_version_ref($1, $2, $3) as v", [ctx.userId, id, ver]);
      if (!r?.v) return bad(c, 404, "NOT_FOUND", "その版はありません");
      return c.json({
        data: await view(ctx, { ...m.v, storage_ref: r.v.storage_ref }).then((x) => ({ ...x, viewing: ver })),
      });
    }
    return c.json({ data: { ...(await view(ctx, m.v)), viewing: m.v.current_version } });
  });

  // 名前を直す
  app.patch("/agent/artifacts/:id", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const id = c.req.param("id");
    const b = (await c.req.json().catch(() => ({}))) as { title?: unknown };
    if (!UUID.test(id) || typeof b.title !== "string")
      return bad(c, 422, "VALIDATION_FAILED", "名前が要ります", { field: "title" });
    const r = await q1<{ ok: boolean }>("select app.artifact_rename($1, $2, $3) as ok", [ctx.userId, id, b.title]);
    return r?.ok ? c.json({ data: { ok: true } }) : GONE(c);
  });

  // 直して保存（D-106.3）：新しい版になる
  app.post("/agent/artifacts/:id/versions", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const id = c.req.param("id");
    if (!UUID.test(id)) return GONE(c);
    const b = (await c.req.json().catch(() => ({}))) as { text?: unknown };
    if (typeof b.text !== "string") return bad(c, 422, "VALIDATION_FAILED", "中身が要ります", { field: "text" });
    const m = await q1<{ v: Meta | null }>("select app.artifact_get($1, $2) as v", [ctx.userId, id]);
    if (!m?.v) return GONE(c);
    if (!m.v.editable) return bad(c, 409, "READ_ONLY", "この種類は見るだけです（直せません）");
    const p = await put(c, ctx, b.text, m.v.format as Format);
    if (p instanceof Response) return p;
    const r = await q1<{ v: number | null }>("select app.artifact_add_version($1, $2, $3, $4, null) as v", [
      ctx.userId,
      id,
      p.ref,
      p.size,
    ]);
    if (!r?.v) return GONE(c);
    const after = await q1<{ v: Meta | null }>("select app.artifact_get($1, $2) as v", [ctx.userId, id]);
    return c.json({ data: after?.v ? { ...(await view(ctx, after.v)), viewing: r.v } : { version: r.v } }, 201);
  });

  // 戻す（D-106.4）：前の版の中身で新しい版を作る（前の版も今までの版も消さない）
  app.post("/agent/artifacts/:id/revert", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const id = c.req.param("id");
    const b = (await c.req.json().catch(() => ({}))) as { version?: unknown };
    const ver = Number(b.version);
    if (!UUID.test(id) || !Number.isInteger(ver) || ver < 1)
      return bad(c, 422, "VALIDATION_FAILED", "戻す版が要ります", { field: "version" });
    const r = await q1<{ v: Ref | null }>("select app.artifact_version_ref($1, $2, $3) as v", [ctx.userId, id, ver]);
    if (!r?.v) return bad(c, 404, "NOT_FOUND", "その版はありません");
    const body = await read(ctx, r.v.storage_ref);
    if (body === null) return fromCatalog(c, 502, "E-ART-002");
    const p = await put(c, ctx, body, r.v.format as Format);
    if (p instanceof Response) return p;
    const v = await q1<{ v: number | null }>("select app.artifact_add_version($1, $2, $3, $4, $5) as v", [
      ctx.userId,
      id,
      p.ref,
      p.size,
      ver,
    ]);
    if (!v?.v) return GONE(c);
    const after = await q1<{ v: Meta | null }>("select app.artifact_get($1, $2) as v", [ctx.userId, id]);
    return c.json({ data: after?.v ? { ...(await view(ctx, after.v)), viewing: v.v } : { version: v.v } }, 201);
  });

  // 落とす（D-106.7）：今の版（?version=n でその版）の中身そのもの
  app.get("/agent/artifacts/:id/download", async (c) => {
    const ctx = await me(c);
    if (!ctx) return NO(c);
    const id = c.req.param("id");
    if (!UUID.test(id)) return GONE(c);
    const ver = Number(c.req.query("version"));
    const r = await q1<{ v: Ref | null }>("select app.artifact_version_ref($1, $2, $3) as v", [
      ctx.userId,
      id,
      Number.isInteger(ver) && ver > 0 ? ver : null,
    ]);
    if (!r?.v || !d.objects) return GONE(c);
    const g = await d.objects.get(ctx, r.v.storage_ref);
    if (g.status !== "done") return fromCatalog(c, 502, "E-ART-002");
    const name = `${r.v.title.replace(/[\\/:*?"<>|]/g, "_")}_v${r.v.version}.${r.v.format}`;
    return new Response(g.value.body as unknown as BodyInit, {
      headers: {
        "content-type": g.value.meta.contentType,
        "content-length": String(g.value.meta.size),
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    });
  });
  return app;
}
