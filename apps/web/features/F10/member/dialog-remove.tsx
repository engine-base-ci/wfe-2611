"use client";
// メンバーを外す小窓（段 11・F10。キャンバス EdMemberRemove）。担当しているチケットの引き継ぎ先（全部を同じ人に／1 件ずつ決める）・
//   渡し中は外す前に取り消される・すぐ消えるもの／残るもの。足は「やめる」と「本人確認して外す」。
//   担当が 0 件の人は引き継ぎの区画を出さない（仮）。値は props で受け取って描くだけ
import { Button, Callout, Dialog, Select } from "@/components/k";
import type { TicketHand } from "./types";
import "./member.css";

const HEIRS = [
  { value: "佐藤 花子", label: "佐藤 花子" },
  { value: "高本 聖斗", label: "高本 聖斗" },
  { value: "田中 美咲", label: "田中 美咲" },
];

export type RemoveMode = "all" | "each" | "none";

function Modes({ mode }: { mode: "all" | "each" }) {
  return (
    <div className="k-f10d-seg" role="radiogroup" aria-label="引き継ぎ先の決め方">
      <button type="button" role="radio" aria-checked={mode === "all"}>
        全部を同じ人に
      </button>
      <button type="button" role="radio" aria-checked={mode === "each"}>
        1 件ずつ決める
      </button>
    </div>
  );
}

function Tickets({ rows, mode, heir }: { rows: readonly TicketHand[]; mode: "all" | "each"; heir: string }) {
  return (
    <ul className="k-f10d-tickets">
      {rows.map((t) => (
        <li key={t.code} className="k-f10d-ticket">
          <span className="k-f10d-ticket-main">
            <span className="k-f10d-ticket-code">{`${t.code} ・ ${t.status}`}</span>
            <span>{t.title}</span>
          </span>
          {mode === "each" ? (
            <Select
              name={`heir-${t.code}`}
              label={<span className="sr-only">{`${t.code} の引き継ぎ先`}</span>}
              options={HEIRS}
              value={heir}
            />
          ) : (
            <span className="k-f10d-ticket-to">{heir}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export interface RemoveDialogProps {
  name: string;
  mode: RemoveMode;
  tickets: readonly TicketHand[];
  heir?: string;
}

/** メンバーを外す小窓 */
export function RemoveDialog({ name, mode, tickets, heir = "佐藤 花子" }: RemoveDialogProps) {
  const first = name.split(" ")[0] ?? name;
  const handing = tickets.filter((t) => t.handing);
  return (
    <Dialog
      open
      size="connect"
      title={`${name} さんをワークスペースから外す`}
      subtitle={`外すと入れなくなり、${first}のAI も止まる`}
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button variant="danger">本人確認して外す</Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        {mode === "none" ? (
          <p className="k-f10d-sub">担当しているチケットはありません。引き継ぎは要りません</p>
        ) : (
          <>
            <h3 className="k-f10d-h">{`担当しているチケット ${tickets.length} 件の引き継ぎ先`}</h3>
            <Modes mode={mode} />
            {mode === "all" ? <Select name="heir-all" label="全部の引き継ぎ先" options={HEIRS} value={heir} /> : null}
            <Tickets rows={tickets} mode={mode} heir={heir} />
            {handing.map((t) => (
              <Callout key={t.code} tone="warn">
                {`渡し中の ${t.code} は、外す前に取り消される（${heir} さんへの渡しは成り立っていない）`}
              </Callout>
            ))}
          </>
        )}
        <dl className="k-f10d-facts">
          <div className="k-f10d-fact" data-tone="gone">
            <dt>すぐ消える（戻せない）</dt>
            <dd>{`${name} さんの個人の記憶・会話・預けたログイン情報・PC の接続・出した招待`}</dd>
          </div>
          <div className="k-f10d-fact">
            <dt>残る</dt>
            <dd>書いたやり取り・決定ログ・作った成果物・ワークスペースや層の記憶（名前はそのまま出る）</dd>
          </div>
        </dl>
        <p className="k-f10d-sub">
          外したことは記録に残る。30 日のあいだは同じメールで招き直すと、グループと役割だけ戻る
        </p>
      </div>
    </Dialog>
  );
}
