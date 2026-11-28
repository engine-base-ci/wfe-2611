// 止まった理由ごとの文（段 8・A57・切る段の下絵）。文は正本（errors.json）と決定ログ（D-129.47・D-131.13・D-128.98）の字だけ。
//   理由の種類は止める所を直さず、読むとき文と E 番号から決める（D-151.17・外れたら「理由は届いていません」の案内）。
//   ここは文を作るだけで、口は呼ばない（本番は K-486 の画面の葉が、口の答えからこの種類を決めて渡す）。
//   「（案）」は決定ログに字が無く、案で書いた所（報告に書く）
import { errorText } from "@/components/k/error-of";

/** 止まった理由の種類：PC か AI が壊れた・確認で落ちた・理由が届かない。
 *  実行中に PC が閉じた・承認から 24 時間は、前からの承認と実行の帯（features/F5/approve-complete）が同じ場面を持つので、ここでは出さない（D-128.178） */
export type StopKind = "broken" | "check-failed" | "unknown";
/** 壊れた中身：Bridge が古い・本体が落ちてきていない・ログインしていない・ブラウザとつながらない（直し方は F3 の PC をつなぐ画面） */
export type BrokenCause = "bridge-old" | "claude-broken" | "claude-login" | "browser";

/** 直し方の行き先（F3・段 4 の PC をつなぐ画面） */
export const SETUP_BRIDGE = "/setup/bridge";

export interface StopCopyInput {
  /** 「高本のAI」 */
  who: string;
  kind: StopKind;
  cause?: BrokenCause | undefined;
  /** 確認で落ちた理由の全文（口が返した字のまま） */
  detail?: string | undefined;
}

export interface StopCopy {
  /** 止まった（失敗）。帯の色の種類 */
  tone: "danger";
  title: string;
  /** 題の下の 12px の要約 */
  sub?: string | undefined;
  /** 帯の中の 1 行ずつ */
  lines: readonly string[];
}

/** D-129.47：理由が届かないとき */
const NO_REASON_LINE = "AI が途中で止まりました（理由は届いていません）。もう一度「AI に任せる」を押せます";

/** 壊れた中身ごとの理由の 1 行と、直す場所の案内（案内の字は F3 の画面のボタン名のとおり・案） */
function brokenOf(cause: BrokenCause | undefined): { line: string; sub: string } {
  switch (cause) {
    case "claude-broken":
      return {
        line: errorText("E-CONN-011").title,
        sub: "「PC をつなぐ」の画面の「Claude Code を取り直す」で直ります",
      };
    case "claude-login":
      return {
        line: errorText("E-CONN-010").title,
        sub: "「PC をつなぐ」の画面の「ログインする」を押して、ブラウザで 1 回許可してください",
      };
    case "browser":
      return {
        line: "AI がブラウザを使えませんでした。",
        sub: "「PC をつなぐ」の画面に、つなぎ方と「もう一度確かめる」があります",
      };
    default:
      return {
        line: errorText("E-CONN-012").entry.message,
        sub: "「PC をつなぐ」の画面から Bridge を入れ直せます",
      };
  }
}

/** 種類 → 帯の文。種類が分からなければ「理由は届いていません」（P7） */
export function stopCopy(p: StopCopyInput): StopCopy {
  const stopped = `${p.who} が止まりました`;
  switch (p.kind) {
    case "broken": {
      const b = brokenOf(p.cause);
      return { tone: "danger", title: stopped, sub: b.sub, lines: [b.line] };
    }
    case "check-failed":
      return { tone: "danger", title: stopped, lines: p.detail ? [p.detail] : [NO_REASON_LINE] };
    default:
      return { tone: "danger", title: stopped, lines: [NO_REASON_LINE] };
  }
}
