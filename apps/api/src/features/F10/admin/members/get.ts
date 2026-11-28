// メンバーの 1 人を読む口（K-810）：getMember（GET /api/v1/members/:id）。読むだけ（DB に書かない・外も呼ばない・証跡を増やさない）。
//   入口の権限（members の view・会社全体）は契約の入口（op.ts）が先に確かめる。中身は DB の関数 app.member_detail が
//   同じ権限をもう一度見て（守りは入口と関数の 2 層）、相手（同じ会社の人・消していない・外していない）を読む。取引は 1 つ・文は 1 つ。
//   答えの鍵はちょうど 6（member・groups・assigned・clone・login・recent_events）。人ごとの「できること」は返さない（D-154.10）
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../../contract/deps.js";
import { readRefused } from "../gate.js";
import type { AdminOp } from "../op.js";
import { dataReply } from "../shape.js";

export const DETAIL_KEYS = ["member", "groups", "assigned", "clone", "login", "recent_events"] as const;

type Answer = { error: string; [k: string]: unknown } | { ok: true; detail: unknown; error?: undefined };

const unavailable = (): HookReply => {
  const e = kanameError("E-PAGE-003").toJSON();
  return { status: 503, body: { error: "unavailable", code: "E-PAGE-003", message: e.message, action: e.action } };
};

const kindOf = (e: unknown): string => (e instanceof Error ? e.name : typeof e);

export const ready = true as boolean;

export const run: AdminOp = async ({ d, a }) => {
  let v: Answer;
  try {
    v = await withTenant(d.appPool, a.ctx, async (c) => {
      const r = await c.query<{ v: Answer }>("select app.member_detail($1::uuid) as v", [a.id]);
      return r.rows[0]!.v;
    });
  } catch (e) {
    // ログは場所と例外の種類だけ（名前・メールを出さない）
    console.error(`[members/get] メンバーを読む取引が落ちた（${kindOf(e)}）`);
    return unavailable();
  }
  if (typeof v.error === "string") return readRefused(v as { error: string });
  return dataReply(200, (v as { detail: unknown }).detail, DETAIL_KEYS);
};
