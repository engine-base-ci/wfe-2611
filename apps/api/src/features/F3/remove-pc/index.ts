// K-362 PC を外す口（revokeMyDevice・DELETE /api/v1/bridge/devices/:id・体は読まない）。
//   上限（429）・認証（401）・同意し直し（403・E-AUTH-010）・役（取引先の人・PC の印は 403）・:id の形（422）・
//   本人確認の取り直し 15 分（403・STEP_UP_REQUIRED・契約の stepUp: always・D-125.139）は契約の入口（op.ts）が先に確かめる。
//   PC はアカウントのもの（D-128.156）。入口の行の確かめからは道で外れている（scripts/ci/row_rules.mjs の ROW_EXEMPT・K-364）。
//   持ち主は 2 重に確かめる（D-128.166）：① 口が app.device_owned で確かめ、違えば外す関数を呼ばずに 404
//   ② DB の関数 app.device_revoke の中でも確かめ、違えば null（同時に 2 回押した負けの方・直前に外れた も null）→ 404。
//   他の人の PC・外した PC・無い PC は同じ 404（見分けさせない）。外す理由はいつも device_removed（体の reason は読まない）。
//   DB の失敗は 503・E-PAGE-003（外す関数は 1 つの取引なので、半分だけ外れた形は無い）。ログに PC の id・印・人の id・DB の文を出さない
import type pg from "pg";
import { KanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

const notFound: HookReply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
const unavailable = (): HookReply => ({ status: 503, body: new KanameError("E-PAGE-003").toJSON() });

/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

/** 外した PC の答え（RevokedDevice の 4 つの鍵だけ。PC の印・ハッシュ・machine_id は入れない） */
interface RevokedDevice {
  id: string;
  device_label: string | null;
  revoked_at: string;
  revoke_reason: string;
}

const isRevoked = (v: unknown): v is RevokedDevice =>
  typeof v === "object" && v !== null && typeof (v as { id?: unknown }).id === "string";

export function createRevokeMyDevice(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    const member = a.ctx.userId;
    const session = a.id ?? "";
    let revoked: unknown;
    try {
      // ① 口の確かめ（1 つ目の文・自分の取引）
      const owned = await appPool.query<{ ok: boolean }>("select app.device_owned($1, $2) as ok", [member, session]);
      if (owned.rows[0]?.ok !== true) return notFound;
      // ② 外す（2 つ目の文・自分の取引：錠・外した印・出来事・仕事の止めを 1 つの文の中で）
      const r = await appPool.query<{ r: unknown }>("select app.device_revoke($1, $2) as r", [member, session]);
      revoked = r.rows[0]?.r ?? null;
    } catch (e) {
      console.error(`[remove-pc] 外せなかった（${kindOf(e)}）`);
      return unavailable();
    }
    if (!isRevoked(revoked)) return notFound;
    const data: RevokedDevice = {
      id: revoked.id,
      device_label: revoked.device_label ?? null,
      revoked_at: revoked.revoked_at,
      revoke_reason: revoked.revoke_reason,
    };
    return { status: 200, body: { data } };
  };
}
