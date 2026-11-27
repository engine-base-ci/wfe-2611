// グループを移す・兼ねる口（K-812）：updateMemberGroups（PATCH /api/v1/members/:id/groups・D-125.115・D-154.15・D-154.18・D-154.19・D-154.21・D-154.25）。
//   入口（op.ts）が先に確かめる：ログイン・権限（members の edit・会社全体）・本人確認の取り直し（stepUp always）・429・体の形
//   （primary_scope_id・add_scope_ids・remove_scope_ids・role_key のどれか 1 つ・配列は 20 まで・知らない欄は 422）。
//   口は入力を整えずに DB の関数 app.member_groups_change へ渡す（1 取引・関数 1 回・関門 C2）。順は関数の中：
//   錠 → 権限 → 相手 → 自分 → グループの有無（全部か無しか）→ 外す → 移す → 足す → 証跡。
//   断りの言葉は gate.ts の replyOf（forbidden・member_gone・self_group・scope_gone・not_in_group・primary_remove）。
//   ok なら 200 { data: { member_id, company_role, groups } }（鍵はちょうど 3・no-store）。
//   セッションは口では切らない：同じ取引の中で役割の束の引き金（0080）と権限の引き金（0004）が切る。
//   例外は 503・E-PAGE-003（何も残らない）。ログは場所と例外の種類だけ（名前・グループの id は出さない）。
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../../contract/deps.js";
import { replyOf } from "../gate.js";
import type { AdminOp } from "../op.js";
import { dataReply } from "../shape.js";

export const ready = true as boolean;

/** 答えの鍵（ちょうど 3・K-811 の MemberRoleChanged と同じ形） */
export const MEMBER_GROUPS_KEYS = ["member_id", "company_role", "groups"] as const;

type Answer = { ok: true; result: Record<string, unknown> } | { ok?: false; error: string; [k: string]: unknown };

/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

const unavailable = (): HookReply => ({ status: 503, body: kanameError("E-PAGE-003").toJSON() });

export const run: AdminOp = async ({ d, a }) => {
  let v: Answer | undefined;
  try {
    v = await withTenant(d.appPool, a.ctx, async (c) => {
      const r = await c.query<{ v: Answer }>("select app.member_groups_change($1::uuid, $2::jsonb) as v", [
        a.id,
        JSON.stringify(a.input ?? {}),
      ]);
      return r.rows[0]?.v;
    });
  } catch (e) {
    console.error(`[admin.members.groups] グループを移す取引が落ちた（${kindOf(e)}）`);
    return unavailable();
  }
  if (!v) {
    console.error("[admin.members.groups] グループを移す関数の答えが無い");
    return unavailable();
  }
  if ("error" in v && typeof v.error === "string") return replyOf(v);
  return dataReply(200, (v as { result: unknown }).result, MEMBER_GROUPS_KEYS);
};
