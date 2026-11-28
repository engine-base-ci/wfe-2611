// 外枠の鈴（K-467）。箱を閉じたら焦点を鈴へ戻す。差し込み口と箱の両方が使う（箱は動的 import なので、差し込み口がこちらを読む）
export const BELL_SELECTOR = "header.k-bar .k-bell";

export function focusBell(): void {
  document.querySelector<HTMLElement>(BELL_SELECTOR)?.focus();
}
