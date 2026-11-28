// 接続コードを期限で自分で替えるまでの待ち（K-230）。setTimeout は 2^31−1 ms（約 24.8 日）を越えるとすぐ走るので、
// 口がおかしな（遠い）期限を返しても取り直しが止まらなくならないよう、上限で頭打ちにする。過ぎた期限は 0
export const MAX_TIMER_MS = 2_147_483_647;

export function codeWait(expiresAt: number, now: number): number {
  if (!Number.isFinite(expiresAt)) return MAX_TIMER_MS;
  return Math.min(Math.max(0, expiresAt - now), MAX_TIMER_MS);
}
