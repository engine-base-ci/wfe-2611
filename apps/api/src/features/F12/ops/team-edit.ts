// K-1009 運営の人のできることを変える口（updateOpsMemberCaps）と外す口（removeOpsMember）（関門 C2・D-156.22・D-156.34・D-128.70・D-156.12・D-156.17）。
//   変える：道の id（members.id）と caps の形の確かめ（契約 screen_api.d/K-1009.py と同じ数）→ opsTx で app.ops_member_caps → 200（K-985 の 8 欄）
//   外す：道の id の確かめ → opsTx で app.ops_member_remove（外した印・パスキー・リンク・セッション・担当の問い合わせ・記録を 1 つの取引で）→ 200
//   関数の断り：自分 → 409 E-OPS-017（欄・detail なし）／最後の 1 人 → 409 E-OPS-018（detail { cap }・画面の字に使う）
//   DB の断り：opsErrorReply（42501 → 403・P0002 → 404 欄なし・ほか → 503 E-PAGE-003・何も変えない）。ログに印・名前を出さない
import type pg from "pg";
import { OPS_ALL_CAPS } from "@kaname/auth/ops-first";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { opsErrorReply, opsTx } from "./db.js";
import { isUuid } from "@kaname/contracts";

const KNOWN_CAPS: ReadonlySet<string> = new Set(OPS_ALL_CAPS);
/** 最後の 1 人の印（関数が detail.cap に返す字） */
const LOCKABLE_CAPS: ReadonlySet<string> = new Set(["ops_people", "plan_decide"]);

interface Issue {
  field: string;
  message: string;
}
const invalid = (details: Issue[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});
const down = (): HookReply => ({ status: 503, body: kanameError("E-PAGE-003").toJSON() });

/** 自分は 409 E-OPS-017（欄も detail も付けない） */
function selfReply(): HookReply {
  const body: Record<string, unknown> = { ...kanameError("E-OPS-017").toJSON() };
  delete body["detail"];
  return { status: 409, body };
}

/** 関数の断りの言葉 → 答え。知らない言葉・知らない印は止める側（503） */
function refusalReply(r: FnResult): HookReply {
  if (r.error === "self") return selfReply();
  if (r.error === "last" && typeof r.cap === "string" && LOCKABLE_CAPS.has(r.cap)) {
    return { status: 409, body: kanameError("E-OPS-018", { cap: r.cap }).toJSON() };
  }
  console.error(`[ops] ops-team-edit の知らない断り（${String(r.error).slice(0, 40)}）`);
  return down();
}

/** 道の id（members.id）。入口も uuid を確かめるが、ここでも確かめる（入口に頼らない 2 層目） */
function idIssues(id: string | null): Issue[] {
  return id && isUuid(id) ? [] : [{ field: "id", message: "uuid の形" }];
}

/** 体を確かめる（caps だけ・9 つの字・1〜9 個・重ならない）。できることは決まった並びにそろえる */
export function checkCapsInput(input: Record<string, unknown>): { caps: string[] } | Issue[] {
  const extra = Object.keys(input).filter((k) => k !== "caps");
  if (extra.length) return extra.map((k) => ({ field: k, message: "知らない欄" }));
  const caps = input["caps"];
  if (!Array.isArray(caps)) return [{ field: "caps", message: "caps が要る（並び）" }];
  if (caps.length < 1 || caps.length > OPS_ALL_CAPS.length)
    return [{ field: "caps", message: `1〜${OPS_ALL_CAPS.length} 個` }];
  if (caps.some((c) => typeof c !== "string" || !KNOWN_CAPS.has(c)))
    return [{ field: "caps", message: "知らないできること" }];
  if (new Set(caps).size !== caps.length) return [{ field: "caps", message: "重なり" }];
  const picked = new Set(caps as string[]);
  return { caps: OPS_ALL_CAPS.filter((c) => picked.has(c)) };
}

interface FnResult {
  data?: Record<string, unknown>;
  error?: string;
  cap?: unknown;
}

const noStore = (a: HookArgs): void => {
  a.c.header("Cache-Control", "private, no-store");
};

/** opsTx の 1 取引で関数を 1 回呼び、答えに直す */
async function callFn(appPool: pg.Pool, a: HookArgs, sql: string, params: unknown[]): Promise<HookReply> {
  let r: FnResult | null;
  try {
    r = await opsTx(
      appPool,
      a.ctx,
      async (cl) => (await cl.query<{ r: FnResult | null }>(sql, params)).rows[0]?.r ?? null,
    );
  } catch (e) {
    return opsErrorReply(e, "ops-team-edit");
  }
  if (!r) return down();
  if (r.error || !r.data) return refusalReply(r);
  noStore(a);
  return { status: 200, body: { data: r.data } };
}

export function createUpdateOpsMemberCaps(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const bad = idIssues(a.id);
    if (bad.length) return invalid(bad);
    const checked = checkCapsInput((a.input ?? {}) as Record<string, unknown>);
    if (Array.isArray(checked)) return invalid(checked);
    return callFn(appPool, a, "select app.ops_member_caps($1::uuid, $2::text[]) as r", [a.id, checked.caps]);
  };
}

export function createRemoveOpsMember(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const bad = idIssues(a.id);
    if (bad.length) return invalid(bad);
    return callFn(appPool, a, "select app.ops_member_remove($1::uuid) as r", [a.id]);
  };
}
