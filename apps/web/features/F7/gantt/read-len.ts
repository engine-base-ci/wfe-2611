// 正本のトークン（CSS 変数・px の長さ）を JS の数で読む。svar-gantt は行の高さ・目盛りの高さ・セルの幅を数（px）で受けるので、
//   gantt-inner.tsx がこれで --k-c-gantt-* を読む（数を直書きしない・K-460）。読めなければ undefined（svar の既定にまかせる）。
//   ブラウザで描いた後に呼ぶ（SSR では描かない部品・gantt-chart.tsx が next/dynamic で読む）
export function readLen(name: string): number | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
