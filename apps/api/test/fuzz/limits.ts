// 契約 fuzz（G36）の的だけが使う、口の回数の上限の差し替えと、入口の上限に当たった回の記録（K-424）。
//   由来：的は 1 人（Bearer boss）・1 つの IP から全部の例を送るので、契約の上限（多くは 60 か 120／分）にすぐ当たり、
//   ほとんどの例が入口で 429 になって奥の振る舞い（500 を出さない・形どおりの入力を断らない）に届かなかった（K-352・K-355）。
//   そこで的の上限だけを大きくする（試験の土台の差し替え口 h.limits・qa-d.test.ts の BIG と同じ形）。本番のサーバー（src/server.ts）は
//   このファイルを読まず、契約の上限のまま。上限に当たったときの 429 は、生成の試験（test/generated の *_rate_limited）が口ごとに見る。
//   上げたのに入口の 429 が出たら（新しい上限の道ができた等）、fuzz.sh が記録を数えて赤にする（scripts/ci/fuzz_limited.py）
import { appendFileSync } from "node:fs";
import type { EndpointDef } from "@kaname/contracts";

/** 的の 1 分あたりの上限。契約の一番大きい値（120）よりずっと大きく、fuzz の 1 回（数千例）では当たらない数 */
export const FUZZ_PER_MINUTE = 1_000_000;

/** 全部の口に FUZZ_PER_MINUTE を入れた新しい表（operationId → perMinute）。契約の定義は変えない */
export function fuzzLimits(endpoints: readonly Pick<EndpointDef, "operationId">[]): Record<string, number> {
  return Object.fromEntries(endpoints.map((e) => [e.operationId, FUZZ_PER_MINUTE]));
}

/** 試験の土台（makeHarness）の上限の差し替え口に、全部の口の大きな上限を入れる */
export function applyFuzzLimits(
  h: { limits: Record<string, number> },
  endpoints: readonly Pick<EndpointDef, "operationId">[],
): void {
  Object.assign(h.limits, fuzzLimits(endpoints));
}

/** 入口の上限（op.ts の 1)）が断った答えか：429 で code が RATE_LIMITED。ログインの締め出し（E-AUTH-002）などの 429 は数えない */
export async function isEntryLimited(res: Response): Promise<boolean> {
  if (res.status !== 429) return false;
  const text = await res.clone().text();
  try {
    return (JSON.parse(text) as { code?: unknown }).code === "RATE_LIMITED";
  } catch {
    return false; // JSON でない 429 は入口の形ではない（入口は必ず JSON の誤りの形で返す）
  }
}

/**
 * 的の fetch を包み、入口の上限が断った要求を 1 行（「方法 道」）ずつ logPath に足す。答えはそのまま返す（体も読める）。
 * logPath が空なら何も書かない（手で的を立てたとき）
 */
export function recordEntryLimited(
  fetch: (req: Request) => Response | Promise<Response>,
  logPath: string | undefined,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const res = await fetch(req);
    if (logPath && (await isEntryLimited(res))) appendFileSync(logPath, `${req.method} ${new URL(req.url).pathname}\n`);
    return res;
  };
}
