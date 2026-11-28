"use client";
// 確認項目が 0 件で「AI に任せる」を押したときの小窓（K-573・正の絵は下絵 v2 の f4v2-nospecs・部品 features/F4/doc/detail-views.tsx の NoSpecsDialog）。
//   足すか、使わない理由を書くまで任せない（D-150.45）。足は「やめる」（左寄せ）「確認項目を足す」「理由を書いて任せる」（理由が空の間は押せない）。
//   口の失敗（503・PC がつながっていない・429 ほか）は小窓の中の赤い箱に出し、書いた理由を残す。送っている間は足を押せず、閉じない。
//   流れ（口を呼ぶ）は use-delegate.ts。この部品は渡された値を描くだけ。文は全部文字として出す（HTML を作らない）
import { Button, Callout, Dialog, NoticeBox, TextArea } from "@/components/k";
import { PAGE_ERROR, errorText } from "@/components/k/error-of";
import { REASON_MAX, clipReason, trimReason, type DelegateNotice } from "./use-delegate";
import type { ChangeEvent } from "react";
import "@/features/F4/doc/doc.css";

const TITLE = "AI に任せる";
const CAUTION = "確認項目がありません";
const LEAD = "足すか、使わない理由を書いてください。確認項目が無いと、終わったときに機械と人が確かめられません。";
const LABEL = "確認項目を使わない理由";
const EXAMPLE = "例：定型の作業で、送ったメールを見れば確かめられる";
const WHY_DISABLED = "理由を書くか、確認項目を足してください";
const REASON_ROWS = 3;
const SETUP_BRIDGE = "/setup/bridge";

/** 任せる口の断りの知らせ（帯と小窓の中で同じ文・同じリンク）。文は正本（errors.json）から引き、無ければ「読み込めなかった」の文 */
export function NoticeLine({ notice }: { notice: DelegateNotice }) {
  if (notice.code === "RATE")
    return <NoticeBox tone="warn">押しすぎです。{notice.retryAfterSec} 秒たってから、もう一度押してください</NoticeBox>;
  const code = notice.code;
  let message: string;
  try {
    message = errorText(code).entry.message;
  } catch {
    message = errorText(PAGE_ERROR.loadFailed).entry.message;
  }
  return (
    <NoticeBox tone={code === "E-CONF-013" || code === "E-CONF-014" ? "warn" : "danger"}>
      {message}
      {notice.link ? (
        <>
          {" "}
          <a className="k-link" href={SETUP_BRIDGE}>
            PC をつなぐ
          </a>
        </>
      ) : null}
    </NoticeBox>
  );
}

interface Props {
  /** 頭の下の対象の行（「EG-133 11 月分の請求書を送る」） */
  target?: string | undefined;
  reason: string;
  onReason: (reason: string) => void;
  /** 任せる口の答えを待っている */
  busy: boolean;
  /** 429 の待ちの間 */
  wait: boolean;
  /** 小窓の中の赤い箱（口の失敗） */
  error: DelegateNotice | null;
  onQuit: () => void;
  onAdd: () => void;
  onGo: () => void;
}

export function NoSpecsDialog({ target, reason, onReason, busy, wait, error, onQuit, onAdd, onGo }: Props) {
  const empty = trimReason(reason) === "";
  return (
    <Dialog
      open
      title={TITLE}
      {...(target ? { target } : {})}
      onOpenChange={(open) => {
        if (!open && !busy) onQuit(); // Esc・×（送っている間は閉じない）
      }}
      actions={
        <>
          <Button variant="outlined" className="k-f4d-left" onClick={onQuit} disabled={busy}>
            やめる
          </Button>
          <Button variant="outlined" onClick={onAdd} disabled={busy}>
            確認項目を足す
          </Button>
          <Button onClick={onGo} loading={busy} disabled={empty || wait} {...(empty ? { title: WHY_DISABLED } : {})}>
            理由を書いて任せる
          </Button>
        </>
      }
    >
      <Callout tone="danger" title={CAUTION}>
        {LEAD}
      </Callout>
      <TextArea
        label={LABEL}
        name="no_spec_reason"
        rows={REASON_ROWS}
        required
        maxLength={REASON_MAX}
        value={reason}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onReason(clipReason(e.currentTarget.value))}
        placeholder={EXAMPLE}
      />
      {error ? <NoticeLine notice={error} /> : null}
    </Dialog>
  );
}
