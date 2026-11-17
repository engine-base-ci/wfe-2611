// ログイン・招待の受諾の後にどこへ行くか。
// 行き先の判定（PC をつないでいなければ 自分のPCをつなぐ／つないでいれば 今日）は入口（app/page.tsx・D-086）が
// 既に持っている。ここで同じ判定を書かず、入口へ渡す（判定は 1 か所・L-008）。
// 由来：ここが "/today" 決め打ちだったため、はじめの設定を 1 つも終えていない人が 404 に落ちていた。
import type { Route } from "next";

/** 移り先：Kaname の中の道だけ（K-259・開いた転送を止める）。URL の決まりで読み（タブ・改行・\ も URL と同じ扱い）、
 *  この画面と同じ出どころのときだけ 道（pathname）・問い合わせ（search）・#（hash）を使う。
 *  外の出どころ・// で始まる道・javascript: など・符号にした \ や制御文字を含む道は、呼ぶ側の既定の行き先 fallback にする。
 *  同意し直しの画面（K-53 の safeNext）は今は同じ判定を自分で持つ。safeNext をこれに寄せる直しは別のチケット（K-259 の PM の決め・案 A） */
export function sameOriginPath(next: string | null | undefined, fallback: Route): Route {
  if (!next || typeof window === "undefined") return fallback;
  try {
    const origin = window.location.origin;
    const u = new URL(next, origin);
    if (u.origin !== origin) return fallback;
    // 符号にした制御文字（%09・%0A）や \（%5C）を道に残すと、移った先で読み直されて外へ向く形になりうる。符号を外して見て、怪しければ使わない
    const plain = decodeURIComponent(u.pathname);
    // eslint-disable-next-line no-control-regex -- 制御文字が混ざった道を外す（K259-LIB-007・K53-UI-012）
    if (/[\u0000-\u001f\u007f\\]/.test(plain) || plain.startsWith("//")) return fallback;
    return `${u.pathname}${u.search}${u.hash}` as Route;
  } catch {
    return fallback;
  }
}

export function afterLogin(next?: string | null): Route {
  return sameOriginPath(next, "/" as Route); // 既定は入口：今の時点を見て振り分ける
}
