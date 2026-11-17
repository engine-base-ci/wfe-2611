// 答えを返した後に走らせる仕事（K-313・D-042）。再設定のメールは答えを待たずに送る（待つと、登録されている人だけ遅くなる）。
//   本番（Vercel の関数・apps/api/vercel.json）では、Vercel が要求ごとに置く文脈（globalThis の Symbol.for("@vercel/request-context")）の
//   waitUntil に渡し、答えを返した後も関数を止めずに最後まで送り切る。@vercel/functions の waitUntil と同じ読み方を、部品を入れずに書く
//   （部品は @vercel/oidc → @vercel/cli-config → zod 4.1.11 を連れてきて、本番の部品の弱点の検査 G44 が high で止めるため）。
//   Vercel でない所（常駐・手元・試験）では文脈が無いので何もせず、Node の中でそのまま走り切る。
//   同じ仕事を手元の集まりにも入れ、resetWorkIdle() でそれが全部終わるのを待てる（試験の道具。「送らなかった」を秒数で待たずに確かめる）

/** Vercel が要求ごとに置く文脈の鍵（@vercel/functions の get-context と同じ） */
const VERCEL_REQUEST_CONTEXT = Symbol.for("@vercel/request-context");

interface VercelRequestContext {
  waitUntil?: (p: Promise<unknown>) => void;
}
type ContextHolder = { [VERCEL_REQUEST_CONTEXT]?: { get?: () => VercelRequestContext | undefined } };

/** Vercel の関数の中なら、答えの後も待ってもらう。外では何もしない */
function vercelWaitUntil(p: Promise<unknown>): void {
  const holder = globalThis as unknown as ContextHolder;
  holder[VERCEL_REQUEST_CONTEXT]?.get?.()?.waitUntil?.(p);
}

const running = new Set<Promise<unknown>>();

/** 答えの後に走らせる。仕事の失敗は仕事の中で記録する（呼ぶ側の責任）。ここでは待つ人に成否を問わず「終わった」とだけ伝える */
export function afterReply(work: Promise<unknown>): void {
  const done = work.then(
    () => undefined,
    () => undefined,
  );
  running.add(done);
  void done.finally(() => running.delete(done));
  vercelWaitUntil(done);
}

/** それまでに始めた答えの後の仕事が、全部終わるまで待つ（途中で足された仕事も待つ） */
export async function resetWorkIdle(): Promise<void> {
  while (running.size > 0) await Promise.all([...running]);
}
