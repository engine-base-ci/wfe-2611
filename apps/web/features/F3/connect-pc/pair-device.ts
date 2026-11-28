// この端末で PC をつなげるか（代表の決め 2026-11-19：PC をつなぐのは基本的に PC でしかできない。スマホで AI を使うときはリモートコントロール）。
//   見分けるのは画面の幅ではなく「Bridge を入れられる端末か」（スマホ・タブレットの OS か）。
//   navigator を直に読まず、読んだ値（PairDeviceHints）を受けて決める（試験で差し替えられるように・画面は pairHintsOf(navigator) を渡す）

export interface PairDeviceHints {
  userAgent: string;
  /** navigator.userAgentData.mobile（無い・読めないなら undefined） */
  mobile?: boolean | undefined;
  /** navigator.userAgentData.platform（"Android"・"iOS"・"macOS" など） */
  platform?: string | undefined;
  /** navigator.maxTouchPoints（iPad の Safari は Mac の UA を名乗るので、触れる点の数で見分ける） */
  maxTouchPoints?: number | undefined;
}

/** スマホ・タブレットの OS の名前（UA と userAgentData.platform のどちらにも出る形） */
const MOBILE_UA = /\b(Android|iPhone|iPad|iPod|Mobile|Windows Phone)\b/i;
const MOBILE_PLATFORM = /^(Android|iOS|iPadOS)$/i;
/** iPad は「Macintosh」を名乗り、触れる点を 2 つ以上持つ（Mac は 0） */
const IPAD_AS_MAC_TOUCH_POINTS = 2;

/** この端末に Bridge を入れられるか（＝この端末で「＋ PC をつなぐ」を押せるか） */
export function canPairHere(h: PairDeviceHints): boolean {
  if (h.mobile === true) return false;
  if (h.platform && MOBILE_PLATFORM.test(h.platform)) return false;
  if (MOBILE_UA.test(h.userAgent)) return false;
  if (/\bMacintosh\b/.test(h.userAgent) && (h.maxTouchPoints ?? 0) >= IPAD_AS_MAC_TOUCH_POINTS) return false;
  return true;
}

interface NavigatorWithUaData {
  userAgent: string;
  maxTouchPoints?: number;
  userAgentData?: { mobile?: boolean; platform?: string } | undefined;
}

/** ブラウザの navigator から見分けに使う値だけを抜く */
export function pairHintsOf(nav: NavigatorWithUaData): PairDeviceHints {
  return {
    userAgent: nav.userAgent,
    mobile: nav.userAgentData?.mobile,
    platform: nav.userAgentData?.platform,
    maxTouchPoints: nav.maxTouchPoints,
  };
}
