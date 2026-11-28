// 運営が 1 社のプランと請求を読む口（getOpsWorkspaceBilling・GET /api/v1/ops/workspaces/:id/billing）と、
//   頼まれたときに代わりにプランを変える口（changeOpsWorkspacePlan・POST /api/v1/ops/workspaces/:id/plan）（K-968・D-128.65・D-128.108・D-156.3）。
//   どちらも運営の文脈の 1 取引（opsTx）で security definer の関数を 1 回呼ぶ。お金の人だけ（入口の ops:money と関数の頭の ops_require の 2 層）。
//   本人確認の取り直し（15 分）は入口（契約の step_up always）。プランを変える決めは会社の人の口（K-961）と同じ 1 か所（app.plan_change_for）。
//   支払い条件は設定の値（K-958 と同じ config.billing.terms・直書きしない）。お知らせ・メールは送らない（D-125.130）。
//   ログに会社・人・プラン・問い合わせの中身を出さない（場所と SQLSTATE・言葉だけ）
import type pg from "pg";
import type { Config } from "@kaname/config";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { fromCatalog } from "../billing/errors.js";
import { opsErrorReply, opsTx } from "./db.js";

export interface OpsWorkspaceBillingDeps {
  appPool: pg.Pool;
  /** 要求の時に読む（材料を作る時に読まない・k144 の葉の土台は appPool しか渡さない） */
  config: () => Partial<Pick<Config, "billing">> | undefined;
}

type Fn = { error?: unknown; detail?: unknown; data?: unknown } & Record<string, unknown>;

/** 止める側に倒す（503・E-PAGE-003）。ログは場所と言葉だけ */
const down = (where: string, word: string): HookReply => {
  console.error(`[ops] ${where}（${word}）`);
  return { status: 503, body: kanameError("E-PAGE-003", {}).toJSON() }; // 体は fromCatalog と同じ。正本の分類（dependency）の状態の数と答えの 503 が違うので、番号は直に書く（K-144 の SHAPE_010）
};

/** 関数の断りの言葉 → 答え（言葉 → 番号は会社の人の口と同じ）。知らない言葉は止める側（503） */
function replyOf(v: Fn, where: string): HookReply {
  const word = String(v.error);
  if (word === "not_found") return fromCatalog("E-PAGE-001", 404);
  if (word === "same_plan") return fromCatalog("E-PLAN-001", 409);
  if (word === "over_limit") {
    const d = (v.detail ?? {}) as Record<string, unknown>;
    return {
      status: 409,
      body: kanameError("E-PLAN-002", { members: d["members"], member_limit: d["member_limit"] }).toJSON(),
    };
  }
  return down(where, `unknown:${word}`);
}

/** 運営の文脈の 1 取引で関数を 1 回呼ぶ。DB の断り（42501・P0002・ほか）は opsErrorReply（1 取引なので何も残らない） */
async function callOps(
  d: OpsWorkspaceBillingDeps,
  a: HookArgs,
  sql: string,
  params: unknown[],
  where: string,
): Promise<Fn | HookReply> {
  try {
    const v = await opsTx(d.appPool, a.ctx, async (cl) => (await cl.query<{ v: Fn | null }>(sql, params)).rows[0]?.v);
    return v ?? down(where, "empty");
  } catch (e) {
    return opsErrorReply(e, where);
  }
}

const isReply = (v: Fn | HookReply): v is HookReply => typeof (v as HookReply).status === "number";

export function getOpsWorkspaceBilling(d: OpsWorkspaceBillingDeps) {
  return async (a: HookArgs): Promise<HookReply> => {
    const where = "workspace-billing";
    const v = await callOps(d, a, "select app.ops_workspace_billing($1) as v", [a.id ?? ""], where);
    if (isReply(v)) return v;
    // 読む関数（app.ops_workspace_billing）は断りの言葉を返さない（無い会社・権限は DB の例外 → opsErrorReply）。
    //   言葉が来たら止める側（503）。変える口の読み替え replyOf は使わない（K-144 の SHAPE_010・ふるまいは同じ）
    if (v.error !== undefined) return down(where, `unknown:${String(v.error)}`);
    return {
      status: 200,
      body: {
        data: {
          plan: v["plan"],
          members: v["members"],
          payment_terms: d.config()?.billing?.terms ?? "",
          invoices: v["invoices"] ?? [],
        },
      },
    };
  };
}

export function changeOpsWorkspacePlan(d: OpsWorkspaceBillingDeps) {
  return async (a: HookArgs): Promise<HookReply> => {
    const where = "workspace-billing";
    const key = typeof a.input["plan_key"] === "string" ? a.input["plan_key"].trim() : "";
    const inquiry = typeof a.input["inquiry_id"] === "string" ? a.input["inquiry_id"] : "";
    const v = await callOps(
      d,
      a,
      "select app.ops_workspace_plan_change($1, $2, $3) as v",
      [a.id ?? "", key, inquiry],
      where,
    );
    if (isReply(v)) return v;
    if (v.error !== undefined || v.data === undefined) return replyOf(v, where);
    return { status: 201, body: { data: v.data } };
  };
}
