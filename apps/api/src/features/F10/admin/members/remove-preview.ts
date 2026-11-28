// 外す前の下見の口（K-815）：previewMemberRemoval（GET /api/v1/members/:id/remove-preview）。読むだけ（DB に書かない・外も呼ばない・証跡も受け箱も増やさない）。
//   入口の権限（members の edit・会社全体）は契約の入口（op.ts）が先に確かめる。中身は DB の関数 app.member_remove_preview が
//   同じ権限をもう一度見て（守りは入口と関数の 2 層）、相手（同じ会社の人・消していない・外していない）の担当・渡し・承認・消える物を数える。
//   自分と最後の管理者は断らず 200 の blocked_by で理由を返す（断る 409 は外す口 K-848）。取引は 1 つ・文は 1 つ
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../../contract/deps.js";
import { readRefused } from "../gate.js";
import type { AdminOp } from "../op.js";
import { dataReply, invalidInput } from "../shape.js";

export const PREVIEW_KEYS = [
  "member",
  "blocked_by",
  "tickets",
  "handovers_cancelled",
  "approvals_reassigned",
  "sole_approver",
  "deleted",
  "kept",
  "restorable_until",
] as const;

type Answer = { error: string; [k: string]: unknown } | { ok: true; data: unknown; error?: undefined };

const unavailable = (): HookReply => {
  const e = kanameError("E-PAGE-003").toJSON();
  return { status: 503, body: { error: "unavailable", code: "E-PAGE-003", message: e.message, action: e.action } };
};

const kindOf = (e: unknown): string => (e instanceof Error ? e.name : typeof e);

export const ready = true as boolean;

export const run: AdminOp = async ({ d, a }) => {
  // 下見は問い合わせを受けない（知らない問い合わせは 422・K815-API-017。入口は get の口の問い合わせを確かめない）
  const q = Object.keys(a.c.req.queries());
  if (q.length) return invalidInput("query", "この口は問い合わせを受けない");
  let v: Answer;
  try {
    v = await withTenant(d.appPool, a.ctx, async (c) => {
      const r = await c.query<{ v: Answer }>("select app.member_remove_preview($1::uuid) as v", [a.id]);
      return r.rows[0]!.v;
    });
  } catch (e) {
    // ログは場所と例外の種類だけ（名前・番号を出さない）
    console.error(`[members/remove-preview] 外す下見の取引が落ちた（${kindOf(e)}）`);
    return unavailable();
  }
  if (typeof v.error === "string") return readRefused(v as { error: string });
  return dataReply(200, (v as { data: unknown }).data, PREVIEW_KEYS);
};
