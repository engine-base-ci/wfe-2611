// ワークスペースを消す手続き・取り消す口（K-830）：requestWorkspaceDeletion（POST /api/v1/workspace/deletion）・
//   cancelWorkspaceDeletion（DELETE /api/v1/workspace/deletion）。D-128.65・D-154.4・D-154.5・D-154.16・D-154.18・D-154.21・D-154.83。
//   入口（op.ts）が先に確かめる：ログイン（401）・本人確認の取り直し（契約の step_up が always・403 STEP_UP_REQUIRED）・上限・体の形
//   （strict・confirm_name は 1〜100 字・NUL は 422）。判定と書き込みは 1 つの DB の関数の 1 取引の中（関門 C2）：
//   会社ごとの錠 → 押せる人か（app.workspace_can('delete_workspace')・403）→ 名前（409・E-WS-030）→ 状態（409・E-WS-031〜033）
//   → 時刻・ほかの有効な管理者への受け箱の行・記録。関数が例外（受け箱・記録の書き込み失敗など）なら取引ごと戻り、503・E-PAGE-003。
//   手続き中も全員いつもどおり使える（人・セッションは何も変えない）。14 日後に消すのは運営で、この口は消さない。書き出しは無い。
//   ログには場所と例外の種類だけを書く（名前・人の id を出さない）
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { HookDeps } from "../../../hooks/registry.js";

/** 取り消せる日数（D-128.65・D-154.16） */
export const DELETION_DAYS = 14;
const DAY_MS = 86_400_000;

type Answer = { ok?: boolean; status?: number; code?: string; requested_at?: string };

const FORBIDDEN: HookReply = { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
const CONFLICTS = new Set(["E-WS-030", "E-WS-031", "E-WS-032", "E-WS-033"]);

/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};
const down = (where: string, e: unknown): HookReply => {
  console.error(`[workspace-deletion] ${where}の取引が落ちた（${kindOf(e)}）`);
  const x = kanameError("E-PAGE-003").toJSON();
  return { status: 503, body: { error: "unavailable", code: "E-PAGE-003", message: x.message, action: x.action } };
};
/** 関数の断り → 答え。409 には field・details を付けない */
const refusal = (v: Answer | undefined): HookReply => {
  if (v?.status === 409 && v.code && CONFLICTS.has(v.code)) return { status: 409, body: kanameError(v.code).toJSON() };
  if (v?.status === 403) return FORBIDDEN;
  return down("答えの形が違う", new Error("unknown answer"));
};

/** 手続きの今（画面の帯の「あと N 日」の元・取り消したら全部 null） */
export const deletionOf = (requestedAt: Date | null) =>
  requestedAt === null
    ? { requested_at: null, delete_at: null, days_left: null }
    : {
        requested_at: requestedAt.toISOString(),
        delete_at: new Date(requestedAt.getTime() + DELETION_DAYS * DAY_MS).toISOString(),
        days_left: DELETION_DAYS,
      };

async function run(d: Pick<HookDeps, "appPool">, a: HookArgs, sql: string, params: unknown[]): Promise<Answer> {
  return withTenant(d.appPool, a.ctx, async (cl) => (await cl.query<{ v: Answer }>(sql, params)).rows[0]!.v);
}

export function createRequestWorkspaceDeletion(d: Pick<HookDeps, "appPool">) {
  return async (a: HookArgs): Promise<HookReply> => {
    const confirm = typeof a.input["confirm_name"] === "string" ? a.input["confirm_name"] : "";
    let v: Answer;
    try {
      v = await run(d, a, "select app.workspace_deletion_request($1) as v", [confirm]);
    } catch (e) {
      return down("消す手続きを始める", e);
    }
    if (v.ok !== true || !v.requested_at) return refusal(v);
    return { status: 200, body: { data: { deletion: deletionOf(new Date(v.requested_at)) } } };
  };
}

export function createCancelWorkspaceDeletion(d: Pick<HookDeps, "appPool">) {
  return async (a: HookArgs): Promise<HookReply> => {
    let v: Answer;
    try {
      v = await run(d, a, "select app.workspace_deletion_cancel() as v", []);
    } catch (e) {
      return down("消す手続きを取り消す", e);
    }
    if (v.ok !== true) return refusal(v);
    return { status: 200, body: { data: { deletion: deletionOf(null) } } };
  };
}
