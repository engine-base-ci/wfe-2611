// 役割を変える口（K-811）：updateMemberRole（PATCH /api/v1/members/:id/role・D-154.9・D-154.15・D-154.18・D-154.19・D-154.21・D-154.25）。
//   入口（op.ts）が先に確かめる：ログイン（401）・権限（members の edit・会社全体。マネージャーは 403）・本人確認の取り直し（15 分・403 STEP_UP_REQUIRED）・
//   上限・体の形（role_key は 4 つ・scope_id は uuid・知らない欄は 422）。口は入力を整えず、1 つの取引で app.member_role_change に渡す。
//   断り（forbidden・member_gone・self_role・last_admin・scope_gone・not_in_group）は replyOf（K-800 の gate.ts）が状態と番号にする。
//   相手のセッションは口で切らない（役割の束の引き金と権限の引き金が同じ取引で切る・G-14）。
//   DB が落ちたら 503・E-PAGE-003（何も残らない）。ログは場所と例外の種類だけ（名前・メールは出さない）。
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../../contract/deps.js";
import { replyOf } from "../gate.js";
import type { AdminOp } from "../op.js";
import { dataReply } from "../shape.js";

export const ready = true as boolean;

/** 答え（MemberRoleChanged）の鍵。ちょうど 3 つ・この順 */
export const ROLE_KEYS = ["member_id", "company_role", "groups"] as const;

type Answer = { ok?: boolean; result?: unknown; error?: string; [k: string]: unknown };

/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

const unavailable = (): HookReply => {
  const e = kanameError("E-PAGE-003").toJSON();
  return { status: 503, body: { error: "unavailable", code: "E-PAGE-003", message: e.message, action: e.action } };
};

export const run: AdminOp = async ({ d, a }) => {
  let v: Answer;
  try {
    v = await withTenant(d.appPool, a.ctx, async (c) => {
      const r = await c.query<{ v: Answer }>("select app.member_role_change($1::uuid, $2::jsonb) as v", [
        a.id,
        JSON.stringify(a.input),
      ]);
      return r.rows[0]?.v ?? {};
    });
  } catch (e) {
    console.error(`[F10 updateMemberRole] 役割を変える取引が落ちた（${kindOf(e)}）`);
    return unavailable();
  }
  if (typeof v.error === "string") return replyOf(v as { error: string; [k: string]: unknown });
  if (v.ok !== true) {
    console.error("[F10 updateMemberRole] 役割を変える関数の答えの形が違う");
    return unavailable();
  }
  return dataReply(200, v.result, ROLE_KEYS);
};
