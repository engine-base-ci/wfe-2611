// 止まった理由の種類（口の答えの reason_kind・K-485）→ 帯の種類（部品の StopKind・BrokenCause）。純関数・ここ 1 か所（K-486）。
//   種類は reason_kind だけで決める（文から当て推量しない）。PC か AI が壊れた 4 つは broken。
//   pc_closed は口が返した文（Bridge を開き直す案内を含む・D-129.47）をそのまま出す。
//   それ以外（unknown・鍵が無い・null・知らない値・approval_expired）は、文が空か「理由は届いていません」の文なら unknown、
//   ほかの文があれば理由の全文をそのまま出す（check-failed・D-129.47・D-131.4）
import type { BrokenCause, StopKind } from "./stop-copy";

/** 帯の種類と、壊れた中身・理由の全文 */
export interface StopKindOf {
  kind: StopKind;
  cause?: BrokenCause;
  detail?: string;
}

/** 壊れた 4 つ：reason_kind → 壊れた中身（直す場所は PC をつなぐ画面） */
const BROKEN: Readonly<Record<string, BrokenCause>> = {
  bridge_outdated: "bridge-old",
  claude_missing: "claude-broken",
  claude_login: "claude-login",
  browser_unreachable: "browser",
};

/** 理由が届かなかったときの文の印（D-129.47 の「理由は届いていません」） */
const NO_REASON_MARK = "理由は届いていません";

export function stopKindOf(run: { reason_kind?: string | null; stopped_reason: string | null }): StopKindOf {
  const kind = run.reason_kind ?? null;
  const cause = kind !== null && Object.hasOwn(BROKEN, kind) ? BROKEN[kind] : undefined;
  if (cause) return { kind: "broken", cause };
  const text = run.stopped_reason?.trim() ?? "";
  if (kind === "pc_closed" && text) return { kind: "check-failed", detail: text };
  if (!text || text.includes(NO_REASON_MARK)) return { kind: "unknown" };
  return { kind: "check-failed", detail: text };
}
