// 分身の案の仕事を出す口（K-896）：requestClientRequestDraft（POST /api/v1/client_requests/:id/draft・体なし・D-155.11・D-128.101）。
//   押した人自身の PC（Bridge）に仕事を 1 回積む。判定と書き込みは DB の関数 app.client_request_draft_enqueue の 1 取引の中（関門 C2）：
//   見える・直せる・状態・PC が生きているか（75 秒）・案を作っているか、仕事の行・依頼の案の状態・証跡。
//   口は関数の断り（errcode と hint の番号）を答えに写すだけ。分からない例外は 503・E-PAGE-003（取引ごと戻るので何も残らない）。
//   上限・認証・uuid の形・体の形（知らない欄は 422）・冪等キーは契約の入口（op.ts）が先に確かめる。Cache-Control: private, no-store は入口が全部の答えに付ける。
//   ログに依頼の字・人の id を出さない（例外の種類だけ）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

const SQL = "select app.client_request_draft_enqueue($1) as v";

const pgInfo = (e: unknown): { code: string; hint: string } => {
  const x = (e ?? {}) as { code?: unknown; hint?: unknown };
  return { code: typeof x.code === "string" ? x.code : "", hint: typeof x.hint === "string" ? x.hint : "" };
};
/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};
/** 断りの番号の答え（欄・details を付けない） */
const coded = (status: number, code: string): HookReply => ({ status, body: kanameError(code).toJSON() });
const down = (e: unknown): HookReply => {
  console.error(`[client-requests-draft] 仕事を積む取引が落ちた（${kindOf(e)}）`);
  return coded(503, "E-PAGE-003");
};

/** DB の関数が断った例外 → 答え */
function refused(e: unknown): HookReply {
  const { code, hint } = pgInfo(e);
  if (code === "42501" && hint === "E-GST-100") return coded(404, "E-GST-100");
  if (code === "42501") return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  if (code === "22023" && (hint === "E-GST-140" || hint === "E-GST-141" || hint === "E-GST-142")) return coded(409, hint);
  return down(e);
}

export function createRequestClientRequestDraft(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    let v: { job_id?: string } | undefined;
    try {
      v = await withTenant(appPool, a.ctx, async (cl) => (await cl.query<{ v: { job_id?: string } }>(SQL, [a.id])).rows[0]?.v);
    } catch (e) {
      return refused(e);
    }
    if (!v || typeof v.job_id !== "string") return down(new Error("unknown answer"));
    return { status: 201, body: { data: { job_id: v.job_id } } };
  };
}
