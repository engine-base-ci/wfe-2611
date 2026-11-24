// 道具 spec_check（K-736）：AI が仕事の中で、確かめられた確認項目に根拠の 1 行を添えて AI のチェックを付ける（D-153.2・D-153.4）。
//   口の前段（tools.ts の app.bridge_tool_job）と DB の 2 層目（app.ticket_tool_spec_check）の両方で鍵と PC を見る。外す道は無い（K-700 のリスク b）。
//   答え：成功 201／DB が null → 403／not_found → 404／done → 409・E-SPEC-001／basis → 422／例外 → 503・E-PAGE-003（何も残らない）。
//   書くのは関門 C2 の関数 1 つ（1 取引）。ログに根拠・題名を出さない（例外の種類だけ）
import type pg from "pg";
import type { HookReply } from "../../../contract/deps.js";
import { idOf } from "../../../auth/ids.js";
import { conflictDone, invalid, kindOf, notFound, unavailable } from "../../F4/test-spec/reply.js";

const BASIS_MAX = 200;
const SPACE = /^[\s　]+|[\s　]+$/g;

export interface SpecCheckInput {
  specId: string;
  basis: string;
}

/** AI の出力なので緩く読む：知らない欄は捨てる。形が違えば 422 の答え */
export function parseSpecCheckInput(input: Record<string, unknown>): SpecCheckInput | HookReply {
  const specId = idOf(input["spec_id"]);
  if (!specId) return invalid("spec_id", "確認項目の id（uuid）を渡してください");
  if ("checked" in input && input["checked"] !== true)
    return invalid("checked", "チェックを付けることだけができます（外す道はありません）");
  const raw = input["basis"];
  const basis = typeof raw === "string" ? raw.replace(SPACE, "") : "";
  if (basis.length < 1 || Array.from(basis).length > BASIS_MAX)
    return invalid("basis", `根拠を 1〜${BASIS_MAX} 字で渡してください`);
  return { specId: specId.toLowerCase(), basis };
}

interface SpecCheckResult {
  ok?: boolean;
  id?: string;
  checked?: boolean;
  unchanged?: boolean;
  error?: string;
}

const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });

/** DB の入口を 1 回呼ぶ（2 層目）。答えを口の答えに直す */
export async function runSpecCheck(
  pool: pg.Pool,
  jobId: string,
  tokenHash: string,
  sessionId: string,
  input: SpecCheckInput,
): Promise<HookReply> {
  let v: SpecCheckResult | null;
  try {
    v =
      (
        await pool.query<{ v: SpecCheckResult | null }>("select app.ticket_tool_spec_check($1, $2, $3, $4, $5) as v", [
          jobId,
          tokenHash,
          sessionId,
          input.specId,
          input.basis,
        ])
      ).rows[0]?.v ?? null;
  } catch (e) {
    console.error(`[spec_check] 書けなかった（${kindOf(e)}）`);
    return unavailable();
  }
  if (!v) return forbidden();
  if (v.error === "not_found") return notFound();
  if (v.error === "done") return conflictDone();
  if (v.error === "basis") return invalid("basis", `根拠を 1〜${BASIS_MAX} 字で渡してください`);
  if (v.error) return notFound();
  return {
    status: 201,
    body: { data: { result: { ok: true, id: v.id, checked: true, unchanged: Boolean(v.unchanged) } } },
  };
}
