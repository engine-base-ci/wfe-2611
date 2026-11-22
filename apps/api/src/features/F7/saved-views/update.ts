// 保存した検索条件を直す口（K-476・契約の口 updateSavedView・PATCH /api/v1/saved_views/:id・D-128.119・D-151.9・関門 C2）。
//   直せる人：作った人と、グループの全員向けの物は見せているグループのマネージャー（入口の行の確かめ app.manages_scope と、口の中の同じ確かめ・行の守りの has_permission の 3 重）。
//   見せる相手（share・scope_id）を変えられるのは作った人だけ（403 E-VWS-020）。送った欄だけ変える。今と同じ値は変えない（何も変わらなければ 200 で書かない）。
//   1 つの取引（withTenant）の中で：① 見える・消していない行を plain な select で読む（for update は付けない：行の守りの update の守りが
//   edit の無い人の行を「無い」に見せてしまうため）② 変わる欄だけ残す ③ 見せる相手を変えるのが作った人か ④ グループの全員向けでグループを外していないか（409 E-VWS-021）
//   ⑤ 見せるグループが同じ会社・消していない・作った人に見えるか（404 E-VWS-004）⑥ 名前が変わるなら作った人ごとの助言ロックを取り、重ならないか（409 E-VWS-005）
//   ⑦ 1 文の update（0 行なら見えれば 403・見えなければ 404）⑧ 証跡 saved_views.update（C2・中身は直した欄の名前だけ。値は残さない）。
//   最後の砦：一意の索引 saved_views_name_uq の 23505 は 409 E-VWS-005。引き金 saved_views_guard の 42501 は 403。書く所で DB が落ちたら 503 E-PAGE-003（down.ts・1 つの取引なので何も残らない・11-22 18:30 の決め）。
//   知らせは出さない。ログに名前と条件を出さない。確かめの関数は input.ts（K-475）と同じ物を使う
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { Row } from "@kaname/db/repository";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { writeDown } from "./down.js";
import { checkColumns, checkDensity, checkFilters, checkName, checkShare, fail, invalid } from "./input.js";
import { SAVED_VIEW_SELECT, toSavedView, type SavedViewRow } from "./shape.js";

/** 直せる欄。証跡の欄の名前はこの順に並べる */
const FIELDS = ["name", "share", "scope_id", "filters", "columns", "density"] as const;
type Field = (typeof FIELDS)[number];
const NAME_INDEX = "saved_views_name_uq";
const GUARD_ERRCODE = "42501";

const LOCK_SQL = "select pg_advisory_xact_lock(hashtextextended('saved_views:' || $1::text, 0))";
const SCOPE_SQL = `select exists (
  select 1 from scopes where id = $1 and tenant_id = app.tenant_id() and deleted_at is null
     and $1 = any(visible_scopes(app.user_id()))) as ok`;
const SAME_NAME_SQL = `select exists (
  select 1 from saved_views where member_id = $1 and tenant_id = app.tenant_id() and deleted_at is null
     and id <> $2 and lower(name) = lower($3)) as taken`;
const LIVE_SQL = "select exists (select 1 from saved_views where id = $1 and deleted_at is null) as seen";
const READ_LIVE_SQL = `${SAVED_VIEW_SELECT} where v.id = $1 and v.deleted_at is null`;
const READ_SQL = `${SAVED_VIEW_SELECT} where v.id = $1`;
// 直す欄は固定の 1 文（欄ごとに「変えるか」の真偽と新しい値を渡す。文字列をつなぐ組み立てはしない・G10 の動的クエリの連結）。
//   欄の順は FIELDS と同じ（name・share・scope_id・filters・columns・density）。変えない欄は今の値のまま
const UPDATE_SQL = `update saved_views set
  name = case when $2::boolean then $3 else name end,
  share = case when $4::boolean then $5 else share end,
  scope_id = case when $6::boolean then $7::uuid else scope_id end,
  filters = case when $8::boolean then $9::jsonb else filters end,
  columns = case when $10::boolean then $11::jsonb else columns end,
  density = case when $12::boolean then $13 else density end,
  updated_by = app.user_id()
  where id = $1 and deleted_at is null`;
const AUDIT_SQL = "select app.record_audit('saved_views.update', 'saved_views', $1, 'C2', $2::jsonb)";

const FORBIDDEN: HookReply = { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** 口の前処理：変える欄が 1 つは要る（空の体は 422・欄 body）。送られた欄だけを input.ts の確かめに当てる（名前は直した字にして返す） */
export const input: NonNullable<Hook["input"]> = (raw) => {
  if (!isObject(raw)) return { input: raw as Row };
  const body: Record<string, unknown> = { ...raw };
  if (!FIELDS.some((k) => k in body)) return { reply: invalid("body", "変える欄がありません") };
  if ("name" in body) {
    if (typeof body["name"] !== "string") return { reply: invalid("name", "名前は文字") };
    const n = checkName(body["name"]);
    if ("status" in n) return { reply: n };
    body["name"] = n.name;
  }
  if ("share" in body) {
    const bad = checkShare(body["share"]);
    if (bad) return { reply: bad };
  }
  if (body["share"] === "group" && (body["scope_id"] === undefined || body["scope_id"] === null))
    return { reply: fail("E-VWS-003", "scope_id") };
  for (const [key, check] of [
    ["filters", checkFilters],
    ["columns", checkColumns],
    ["density", checkDensity],
  ] as const) {
    if (!(key in body)) continue;
    const bad = check(body[key]);
    if (bad) return { reply: bad };
  }
  return { input: body as Row };
};

/** 欄の名前の順を決めて比べる（jsonb の読み戻しは欄の順が変わる） */
function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (isObject(v)) {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canon(v[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}
const current = (row: SavedViewRow, k: Field): unknown => row[k];
/** 送られた欄のうち、今の値と違う物（送られなかった欄・同じ値の欄は入らない） */
const changedFields = (row: SavedViewRow, i: Record<string, unknown>): Field[] =>
  FIELDS.filter((k) => k in i && canon(i[k]) !== canon(current(row, k)));

const isNameTaken = (e: unknown): boolean => {
  const x = e as { code?: unknown; constraint?: unknown } | null;
  return x?.code === "23505" && x.constraint === NAME_INDEX;
};
const isGuardStop = (e: unknown): boolean => (e as { code?: unknown } | null)?.code === GUARD_ERRCODE;

const param = (k: Field, v: unknown): unknown => (k === "filters" || k === "columns" ? JSON.stringify(v) : v);

async function run(cl: pg.PoolClient, id: string, i: Record<string, unknown>): Promise<HookReply> {
  const row = (await cl.query<SavedViewRow>(READ_LIVE_SQL, [id])).rows[0];
  if (!row) return fail("E-PAGE-001");
  if (!row.can_edit) return FORBIDDEN;
  const changed = changedFields(row, i);
  if (changed.length === 0) return { status: 200, body: { data: toSavedView(row) } };
  const shareChanged = changed.includes("share");
  const scopeChanged = changed.includes("scope_id");
  if ((shareChanged || scopeChanged) && !row.mine) return fail("E-VWS-020");
  const share = shareChanged ? (i["share"] as string) : row.share;
  const scopeId = scopeChanged ? (i["scope_id"] as string | null) : row.scope_id;
  if (share === "group" && scopeId === null) return fail("E-VWS-021", "scope_id");
  if (scopeId !== null && (scopeChanged || (shareChanged && share === "group"))) {
    const seen = (await cl.query<{ ok: boolean }>(SCOPE_SQL, [scopeId])).rows[0]?.ok === true;
    if (!seen) return fail("E-VWS-004", "scope_id");
  }
  if (changed.includes("name")) {
    await cl.query(LOCK_SQL, [row.member_id]);
    const taken = (await cl.query<{ taken: boolean }>(SAME_NAME_SQL, [row.member_id, id, i["name"]])).rows[0]?.taken;
    if (taken === true) return fail("E-VWS-005", "name");
  }
  const args = [id, ...FIELDS.flatMap((k) => (changed.includes(k) ? [true, param(k, i[k])] : [false, null]))];
  const done = await cl.query(UPDATE_SQL, args);
  if (done.rowCount === 0) {
    const seen = (await cl.query<{ seen: boolean }>(LIVE_SQL, [id])).rows[0]?.seen === true;
    return seen ? FORBIDDEN : fail("E-PAGE-001");
  }
  await cl.query(AUDIT_SQL, [id, JSON.stringify({ fields: changed })]);
  const after = (await cl.query<SavedViewRow>(READ_SQL, [id])).rows[0]!;
  return { status: 200, body: { data: toSavedView(after) } };
}

export function createUpdateSavedView(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    if (a.id === null) return fail("E-PAGE-001");
    const id = a.id;
    try {
      return await withTenant(appPool, a.ctx, (cl) => run(cl, id, a.input));
    } catch (e) {
      if (isNameTaken(e)) return fail("E-VWS-005", "name");
      if (isGuardStop(e)) return FORBIDDEN;
      return writeDown("保存した条件を直す", e);
    }
  };
}
