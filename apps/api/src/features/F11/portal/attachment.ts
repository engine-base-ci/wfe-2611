// ゲストが依頼に付ける添付を足す口（K-909・契約の口 uploadPortalAttachment・POST /api/v1/portal/attachments・D-155.12・D-155.53・関門 C2・C4）。
//   体は JSON { name, content_type, data }（data は base64・契約の入口の 1MB に入れるため・2026-11-23 の決め）。
//   (1) app.portal_attachment_room() で空きを見る（ゲストでなければ 42501 → 403・空きが 0 なら 422 E-GST-183）
//   (2) checkUpload（大きさ・種類）で断れば 422 とその番号（置かない）
//   (3) 置き場（関門 C4・objects.put・保持 30 日）に置く。落ちたら 503 E-PAGE-003（行も証跡も残らない）
//   (4) app.portal_attachment_add で行と証跡を 1 つの取引で書く。書けなければ置いたファイルを objects.delete で消す
//       （P0001＋E-GST-183 → 422・42501 → 403・ほか → 503 E-PAGE-003）。消すのも失敗したらログに参照だけ残す（保持期間 30 日で消える）
//   ログには例外の種類と参照だけ（名前・中身は書かない）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { Row } from "@kaname/db/repository";
import { kanameError } from "@kaname/errors";
import type { ObjectStore } from "@kaname/storage";
import type { TenantContext } from "@kaname/db/context";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { checkUpload } from "./attachment-check.js";

/** 置き場の保持期間（日）。依頼に付く前の下書きの掃除はこれに任せる */
export const ATTACHMENT_RETENTION_DAYS = 30;
export const NAME_MAX = 200;
export const CONTENT_TYPE_MAX = 100;
const CONTENT_TYPE_RE = /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*$/;
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
// eslint-disable-next-line no-control-regex -- 名前の制御文字（C0・DEL・C1）を断る
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f]/;

const ROOM_SQL = "select app.portal_attachment_room() as room";
const ADD_SQL = "select app.portal_attachment_add($1, $2, $3, $4) as v";

const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
const unavailable = (): HookReply => ({ status: 503, body: kanameError("E-PAGE-003").toJSON() });
const fail = (code: string): HookReply => {
  const e = kanameError(code);
  return { status: e.status, body: e.toJSON() };
};
const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const chars = (s: string): number => [...s].length;

interface PgLike {
  code?: unknown;
  hint?: unknown;
}
const pgOf = (e: unknown): { code: string; hint: string } => {
  const x = (e ?? {}) as PgLike;
  return { code: typeof x.code === "string" ? x.code : "", hint: typeof x.hint === "string" ? x.hint : "" };
};
const errName = (e: unknown): string => (e as Error | null)?.name ?? "Error";

/** 名前：前後の空白を取って 1〜200 字・/ \ と制御文字を含まない。通れば直した名前 */
export function checkName(raw: string): string | null {
  if (CONTROL_RE.test(raw)) return null;
  const name = raw.trim();
  if (name === "" || chars(name) > NAME_MAX) return null;
  if (name.includes("/") || name.includes("\\")) return null;
  return name;
}

/** 口の前処理（Hook.input）：知っている欄だけを確かめる。足りない欄・知らない欄・形の違いは入口の strict な形が 422 にする */
export const input: NonNullable<Hook["input"]> = (raw) => {
  if (!isObject(raw)) return { input: raw as Row };
  const body: Record<string, unknown> = { ...raw };
  if ("name" in body) {
    if (typeof body["name"] !== "string") return { reply: invalid("name", "名前は文字") };
    const name = checkName(body["name"]);
    if (name === null) return { reply: invalid("name", `名前は 1〜${NAME_MAX} 字で、/ \\ と制御文字を含まない`) };
    body["name"] = name;
  }
  if ("content_type" in body) {
    const t = body["content_type"];
    if (typeof t !== "string" || t.length > CONTENT_TYPE_MAX || !CONTENT_TYPE_RE.test(t))
      return { reply: invalid("content_type", "種類は「種類/種類」の形で 100 字まで") };
  }
  if ("data" in body) {
    const d = body["data"];
    if (typeof d !== "string" || !BASE64_RE.test(d)) return { reply: invalid("data", "中身は base64") };
  }
  return { input: body as Row };
};

interface Upload {
  name: string;
  mime: string;
  bytes: Uint8Array;
}
const fromInput = (i: Record<string, unknown>): Upload => ({
  name: String(i["name"]),
  mime: String(i["content_type"]),
  bytes: new Uint8Array(Buffer.from(String(i["data"]), "base64")),
});

async function room(appPool: pg.Pool, ctx: TenantContext): Promise<number | HookReply> {
  try {
    return await withTenant(
      appPool,
      ctx,
      async (cl) => (await cl.query<{ room: number }>(ROOM_SQL)).rows[0]?.room ?? 0,
    );
  } catch (e) {
    if (pgOf(e).code === "42501") return forbidden();
    console.error(`[portal-attachment] 空きを見られなかった（${errName(e)}）`);
    return unavailable();
  }
}

/** 置いたファイルを消す（後片付け）。失敗してもログに参照だけ残す（保持期間で消える） */
async function discard(objects: ObjectStore, ctx: TenantContext, ref: string): Promise<void> {
  try {
    const r = await objects.delete(ctx, ref);
    if (r.status !== "done") console.error(`[portal-attachment] 置いたファイルを消せなかった（${ref}）`);
  } catch (e) {
    console.error(`[portal-attachment] 置いたファイルを消せなかった（${errName(e)}・${ref}）`);
  }
}

async function put(objects: ObjectStore, ctx: TenantContext, u: Upload): Promise<string | null> {
  try {
    const r = await objects.put(ctx, u.bytes, { contentType: u.mime, retentionDays: ATTACHMENT_RETENTION_DAYS });
    return r.status === "done" ? r.value.ref : null;
  } catch (e) {
    console.error(`[portal-attachment] 置き場に置けなかった（${errName(e)}）`);
    return null;
  }
}

export function createUploadPortalAttachment(
  appPool: pg.Pool,
  objects: ObjectStore | undefined,
): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const left = await room(appPool, a.ctx);
    if (typeof left !== "number") return left;
    if (left <= 0) return fail("E-GST-183");
    const u = fromInput(a.input);
    const checked = checkUpload({ name: u.name, bytes: u.bytes });
    if (!checked.ok) return fail(checked.code);
    if (!objects) return unavailable();
    const ref = await put(objects, a.ctx, u);
    if (ref === null) return unavailable();
    try {
      const v = await withTenant(
        appPool,
        a.ctx,
        async (cl) =>
          (await cl.query<{ v: { id: string; name: string } }>(ADD_SQL, [ref, u.name, u.mime, u.bytes.byteLength]))
            .rows[0]!.v,
      );
      return { status: 201, body: { data: { id: v.id, name: v.name } } };
    } catch (e) {
      await discard(objects, a.ctx, ref);
      const p = pgOf(e);
      if (p.code === "P0001" && p.hint === "E-GST-183") return fail("E-GST-183");
      if (p.code === "42501") return forbidden();
      console.error(`[portal-attachment] 添付の行を書けなかった（${errName(e)}・${ref}）`);
      return unavailable();
    }
  };
}
