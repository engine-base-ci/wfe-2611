// ワークスペースから抜ける口（K-838）：leaveWorkspace（DELETE /api/v1/me/workspaces/:id・:id は抜ける会社の id）。
//   本人確認の取り直し（契約の stepUp: "always"）・上限・道の id の形（422）は入口（op.ts）。体は受けない。
//   DB の関数 app.me_leave を 1 取引で 1 回（関門 C2）：抜けられるかの判定（K-833 の app.me_leave_state）・個人の物を消しセッションと PC を切る
//   （K-849 の app.member_erase）・会社の記録 member.left・ほかの管理者への受け箱の行を、全部か無しかで書く。
//   答え：200 { data: { tenant_id, left: true, restorable_until } }。入っていない・抜けた・無い・別の人の会社は同じ 404（欄・details なし）。
//   最後の管理者は 409・E-ME-051、担当が残っていれば 409・E-ME-050（最後の管理者が先）。DB の失敗は 503・E-PAGE-003。
//   ログには場所と例外の種類だけを出す（名前・メールを出さない）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { KanameError, kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

interface LeaveResult {
  error?: string;
  ok?: boolean;
  tenant_id?: string;
  restorable_until?: string;
}

/** 関数の断る言葉 → 正本の番号（409） */
const CONFLICTS: Readonly<Record<string, string>> = {
  last_admin: "E-ME-051",
  assigned: "E-ME-050",
};

const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });

/** 正本のエラー（欄・details を付けない） */
function catalog(code: string): HookReply {
  const e = new KanameError(code);
  return { status: e.status, body: e.toJSON() };
}

/** DB が落ちた：503・E-PAGE-003（場所と例外の種類だけをログに出す） */
function down(where: string, e: unknown): HookReply {
  console.error(`[me-leave] ${where}：止める側に倒した（${(e as Error)?.name ?? "Error"}）`);
  const x = kanameError("E-PAGE-003").toJSON() as { message?: string; action?: string };
  return {
    status: 503,
    body: { error: "unavailable", code: "E-PAGE-003", message: x.message ?? "", action: x.action ?? "" },
  };
}

/** 関数の答えを口の答えにする */
function replyOf(v: LeaveResult): HookReply {
  if (v.error === "not_found") return notFound();
  const code = v.error ? CONFLICTS[v.error] : undefined;
  if (code) return catalog(code);
  if (v.error || v.ok !== true || !v.tenant_id || !v.restorable_until)
    return down("抜ける（知らない答え）", new Error("unknown"));
  return {
    status: 200,
    body: { data: { tenant_id: v.tenant_id, left: true, restorable_until: v.restorable_until } },
  };
}

export function createLeaveWorkspace(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const tenant = a.id;
    if (!tenant) return notFound();
    let v: LeaveResult;
    try {
      v = await withTenant(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: LeaveResult | null }>("select app.me_leave($1::uuid) as v", [tenant]);
        return r.rows[0]?.v ?? {};
      });
    } catch (e) {
      return down("抜ける", e);
    }
    return replyOf(v);
  };
}
