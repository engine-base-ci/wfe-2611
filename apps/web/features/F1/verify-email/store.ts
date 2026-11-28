// 確認のリンクの手がかりを、このタブの中だけ（sessionStorage）に置く（K-52・レビューの L3）。
//   画面は手がかりを読んだら URL から消す（アドレスバー・履歴・Referer に残さない）。それでも確定の直後の再読み込み・戻るで
//   同じ答え（確定済み → ログイン中なら中へ）に戻れるよう、このタブの中にだけ覚えておく。中へ入ったら消す
const KEY = "kaname.verify.token";

export const readLinkToken = (): string | null => {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};
export const saveLinkToken = (t: string | null): void => {
  try {
    if (t) window.sessionStorage.setItem(KEY, t);
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* 保存できない（private mode 等）。再読み込みでは待つ画面に戻るだけ */
  }
};
