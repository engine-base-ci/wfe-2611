// 漏れたパスワードの照合（K-51・D-125.137・TP-REG-09）。Have I Been Pwned の範囲の問い合わせ（k-anonymity）。
//   外に出すのはパスワードの SHA-1 の頭 5 文字だけ。残りの 35 文字は手元で答えと照らす（パスワードもハッシュの全体も外に出さない）。
//   外への口は関門 C1（@kaname/actions の executeAction）だけを通る。外が落ちている・遅い・答えの形が違うときは unavailable を返し、
//   呼んだ側が登録を止めずに通す（D-128.134）
import { createHash } from "node:crypto";
import type { ActionGateway } from "@kaname/actions";
import type { TenantContext } from "@kaname/db/context";

export const PWNED_ACTION = "pwned.range";
export const PWNED_HOST = "api.pwnedpasswords.com";
/** 答えの 1 行：ハッシュの残り 35 文字と、漏れた回数 */
const LINE = /^([0-9A-F]{35}):(\d+)$/i;

export type PwnedResult = { kind: "ok" } | { kind: "leaked" } | { kind: "unavailable"; reason: string };

/** 照合の行為を関門 C1 に登録する（1 回だけ）。答えの形が違えば投げる（落ちている扱い・TP-EXT-02） */
export function registerPwned(gateway: ActionGateway): void {
  gateway.register<string[]>(PWNED_ACTION, async (input, tools) => {
    const prefix = String(input["prefix"] ?? "");
    if (!/^[0-9A-F]{5}$/.test(prefix)) throw new Error("頭 5 文字の形が違う");
    const res = await tools.fetch(`https://${PWNED_HOST}/range/${prefix}`, {
      method: "GET",
      headers: { "add-padding": "true" }, // 答えの長さから頭 5 文字を推し量られないように（範囲の問い合わせの勧め）
      signal: tools.signal,
    });
    if (!res.ok) throw new Error(`照合のサービスが ${res.status} を返した`);
    const lines = (await res.text())
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length || !lines.every((l) => LINE.test(l))) throw new Error("照合の答えの形が違う");
    return lines;
  });
}

/** パスワードが漏れたことがあるか。外の失敗は unavailable（理由にパスワードもハッシュも入れない） */
export async function checkPwned(gateway: ActionGateway, ctx: TenantContext, password: string): Promise<PwnedResult> {
  const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const out = await gateway.executeAction<string[]>(
    { actionRef: PWNED_ACTION, input: { prefix }, destination: PWNED_HOST },
    ctx,
  );
  if (out.status !== "done" || !out.output) return { kind: "unavailable", reason: out.reason ?? out.status };
  for (const l of out.output) {
    const m = LINE.exec(l);
    if (m && m[1]!.toUpperCase() === suffix && Number(m[2]) > 0) return { kind: "leaked" };
  }
  return { kind: "ok" };
}
