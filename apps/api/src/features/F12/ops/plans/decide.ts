// 値段を変える案を決める口・差し戻す口（K-990・契約の口 decidePlanProposal・returnPlanProposal・関門 C2・D-128.72・D-156.12・D-156.17・D-156.28・D-156.33）。
//   opsTx の 1 取引で DB の関数 app.ops_plan_decide(:id, notice_body)・app.ops_plan_return(:id, reason) を 1 回呼ぶ
//   （値段を決めるを持つか・案の状態・自分の案かは関数の中で見る。版の行・お知らせ・記録も同じ取引で書く）。
//   関数の断りの言葉 → 番号：state → 409 E-OPS-021・self → 409 E-OPS-022（どちらも欄なし）。知らない言葉は止める側（503）。
//   DB の断りは opsErrorReply（42501 → 403／P0002 → 404 欄なし／ほか → 503 E-PAGE-003・1 取引なので何も残らない）。
//   ただし関数を呼ぶ権限そのものがアプリの接続に無い（aclcheck_error＝配備の誤り）は 403 にせず 503。
//   本人確認の取り直し（決める）・上限・入力の形（1〜2,000／1〜500 字・空白だけ・ほかの欄）は契約の入口が先に確かめる
import type pg from "pg";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../../contract/deps.js";
import { opsErrorReply, opsTx } from "../db.js";

export interface OpsPlanDecideDeps {
  appPool: pg.Pool;
}

type Fn = { error?: unknown; data?: unknown } & Record<string, unknown>;

const WHERE = "plans";

const unavailable = (word: string): HookReply => {
  console.error(`[ops] ${WHERE} の DB が失敗した（${word}）`);
  return { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } };
};

/** 関数の実行の権限がアプリの接続に無い（ops_require の断りとは別・PostgreSQL が出す 42501） */
const isExecuteDenied = (e: unknown): boolean => {
  const err = e as { code?: unknown; routine?: unknown } | null;
  return err?.code === "42501" && err.routine === "aclcheck_error";
};

/** 関数の断りの言葉 → 答え */
function refusal(word: string): HookReply {
  if (word === "state") return { status: 409, body: kanameError("E-OPS-021").toJSON() };
  if (word === "self") return { status: 409, body: kanameError("E-OPS-022").toJSON() };
  return unavailable(`unknown:${word}`);
}

/** 運営の文脈の 1 取引で関数を 1 回呼び、答えを口の答えに直す */
async function callOps(d: OpsPlanDecideDeps, a: HookArgs, sql: string, text: unknown): Promise<HookReply> {
  try {
    const v = await opsTx(
      d.appPool,
      a.ctx,
      async (cl: pg.PoolClient) => (await cl.query<{ v: Fn | null }>(sql, [a.id, String(text ?? "")])).rows[0]?.v,
    );
    if (!v) return unavailable("empty");
    if (v.error !== undefined) return refusal(String(v.error));
    return { status: 200, body: { data: v.data ?? null } };
  } catch (e) {
    if (isExecuteDenied(e)) return unavailable("42501");
    return opsErrorReply(e, WHERE);
  }
}

export function createDecidePlanProposal(d: OpsPlanDecideDeps): (a: HookArgs) => Promise<HookReply> {
  return (a) => callOps(d, a, "select app.ops_plan_decide($1, $2) as v", a.input["notice_body"]);
}

export function createReturnPlanProposal(d: OpsPlanDecideDeps): (a: HookArgs) => Promise<HookReply> {
  return (a) => callOps(d, a, "select app.ops_plan_return($1, $2) as v", a.input["reason"]);
}
