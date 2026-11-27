"use client";
// 完了にする小窓（K-572・正の絵は下絵 v2 の f4v2-complete・部品 features/F4/doc/detail-views.tsx の CompleteDialog）。
//   未チェックが残っていても止めず、人が決める（D-150.42）：本文の未チェックの注意（と ☐ の行）・確認項目の未チェックの注意（と ☐ の文）。
//   どちらか 0 なら、その注意は出さない。足は「戻って付ける」（閉じるだけ）・「このまま完了にする」（完了の口）。
//   口の 422（終わっていない子）は小窓の中の赤い箱に出し、閉じない。送っている間は足を押せず、閉じない。
//   流れ（口を呼ぶ・数える）は use-complete.ts。この部品は渡された値を描くだけ。文は全部文字として出す（HTML を作らない）
import { Button, Callout, Dialog } from "@/components/k";
import type { Problem } from "./complete-model";
import "@/features/F4/doc/doc.css";
import "./approve.css";

const KEEP = "完了にしても止めません。このままでよいかを決めてください。";
const bodyTitle = (n: number): string => `本文に、チェックのないやることが ${n} つ残っています`;
const specTitle = (n: number): string => `確認項目にチェックの付いていない物が ${n} つあります`;

interface Props {
  /** 頭の下の対象の行（「EG-133 11 月分の請求書を送る」） */
  target?: string;
  /** 本文の未チェックの箱の文 */
  tasks: readonly string[];
  /** 確認項目の未チェックの文 */
  specs: readonly string[];
  /** 口の 422 の明細（終わっていない子） */
  problems: readonly Problem[];
  /** 完了の口の答えを待っている */
  busy: boolean;
  onBack: () => void;
  onGo: () => void;
}

export function CompleteDialog({ target, tasks, specs, problems, busy, onBack, onGo }: Props) {
  return (
    <Dialog
      title="完了にする"
      {...(target ? { target } : {})}
      open
      onOpenChange={(open) => {
        if (!open && !busy) onBack(); // Esc・×・外側のクリック（送っている間は閉じない）
      }}
      actions={
        <>
          <Button variant="outlined" onClick={onBack} disabled={busy}>
            戻って付ける
          </Button>
          <Button className="k-f4d-done" onClick={onGo} loading={busy} disabled={busy}>
            このまま完了にする
          </Button>
        </>
      }
    >
      {tasks.length ? (
        <>
          <Callout tone="warn" title={bodyTitle(tasks.length)}>
            {KEEP}
          </Callout>
          <ul className="k-f4d-unchecked">
            {tasks.map((t, i) => (
              <li key={i}>{`☐ ${t}`}</li>
            ))}
          </ul>
        </>
      ) : null}
      {specs.length ? (
        <Callout tone="warn" title={specTitle(specs.length)}>
          {specs.map((s, i) => (
            <div key={i}>{`☐ ${s}`}</div>
          ))}
        </Callout>
      ) : null}
      {problems.length ? <Problems problems={problems} /> : null}
    </Dialog>
  );
}

function Problems({ problems }: { problems: readonly Problem[] }) {
  return (
    <div role="alert" className="k63-problems k-err">
      {problems.map((p, i) => (
        <div key={i}>
          <p>{p.message}</p>
          {p.items.length ? (
            <ul>
              {p.items.map((x, j) => (
                <li key={j}>
                  {x.href ? (
                    <a className="k-link" href={x.href}>
                      {x.text}
                    </a>
                  ) : (
                    x.text
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}
