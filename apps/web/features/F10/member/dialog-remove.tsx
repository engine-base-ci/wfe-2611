"use client";
// メンバーを外す小窓（段 11・F10。キャンバス EdMemberRemove）。担当しているチケットの引き継ぎ先（全部を同じ人に／1 件ずつ決める）・
//   渡し中は外す前に取り消される・すぐ消えるもの／残るもの。足は「やめる」と「本人確認して外す」。
//   担当が 0 件の人は引き継ぎの区画を出さない（仮）。値は props で受け取って描くだけ（モック）。
//   入れ物は任意の heirs・on*・busy・notice を渡して動かす（K-822・渡さなければモックのまま・見た目は変えない）
import { Button, Callout, Dialog, NoticeBox, Select } from "@/components/k";
import type { TicketHand } from "./types";
import "./member.css";

const HEIRS = [
  { value: "佐藤 花子", label: "佐藤 花子" },
  { value: "高本 聖斗", label: "高本 聖斗" },
  { value: "田中 美咲", label: "田中 美咲" },
];

export type RemoveMode = "all" | "each" | "none";

/** チケットの行（入れ物は口のチケットの id を足して渡す・K-822。モックは code だけ） */
export type RemoveTicket = TicketHand & { id?: string };

/** 引き継ぎ先の候補（K-822）。値は人の id */
export interface Heir {
  id: string;
  name: string;
}

function Modes({ mode, onMode }: { mode: "all" | "each"; onMode?: ((m: "all" | "each") => void) | undefined }) {
  return (
    <div className="k-f10d-seg" role="radiogroup" aria-label="引き継ぎ先の決め方">
      <button
        type="button"
        role="radio"
        aria-checked={mode === "all"}
        onClick={onMode ? () => onMode("all") : undefined}
      >
        全部を同じ人に
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === "each"}
        onClick={onMode ? () => onMode("each") : undefined}
      >
        1 件ずつ決める
      </button>
    </div>
  );
}

function Tickets({
  rows,
  mode,
  heir,
  options,
  nameOf,
  heirOf,
  onHeirOf,
}: {
  rows: readonly RemoveTicket[];
  mode: "all" | "each";
  heir: string;
  options: { value: string; label: string }[];
  nameOf: (v: string) => string;
  heirOf?: Readonly<Record<string, string>> | undefined;
  onHeirOf?: ((ticket: string, heir: string) => void) | undefined;
}) {
  return (
    <ul className="k-f10d-tickets">
      {rows.map((t) => {
        const key = t.id ?? t.code;
        return (
          <li key={key} className="k-f10d-ticket">
            <span className="k-f10d-ticket-main">
              <span className="k-f10d-ticket-code">{`${t.code} ・ ${t.status}`}</span>
              <span>{t.title}</span>
            </span>
            {mode === "each" ? (
              <Select
                name={`heir-${t.code}`}
                label={<span className="sr-only">{`${t.code} の引き継ぎ先`}</span>}
                options={options}
                value={heirOf?.[key] ?? heir}
                {...(onHeirOf ? { onValueChange: (v: string | null) => v && onHeirOf(key, v) } : {})}
              />
            ) : (
              <span className="k-f10d-ticket-to">{nameOf(heir)}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export interface RemoveDialogProps {
  name: string;
  mode: RemoveMode;
  tickets: readonly RemoveTicket[];
  heir?: string;
  // ---- ここから入れ物がつなぐときだけ渡す（K-822）
  /** 開いているか（渡さなければ開いた形・モック） */
  open?: boolean;
  /** 引き継ぎ先の候補（渡すと heir・heirOf は人の id） */
  heirs?: readonly Heir[];
  onMode?: (m: "all" | "each") => void;
  /** 全部の引き継ぎ先を選んだ（heir に入る） */
  onHeirAll?: (id: string) => void;
  /** 1 件ずつの引き継ぎ先（チケットの id → 人の id。無い行は heir） */
  heirOf?: Readonly<Record<string, string>>;
  onHeirOf?: (ticket: string, heir: string) => void;
  onSubmit?: () => void;
  /** やめる・Esc・外側 */
  onCancel?: () => void;
  /** 答えを待つ間（足のボタンを両方とも押せない） */
  busy?: boolean;
  /** 口が断ったとき（小窓の上の赤い箱） */
  notice?: string;
}

/** メンバーを外す小窓 */
export function RemoveDialog({
  name,
  mode,
  tickets,
  heir = "佐藤 花子",
  open = true,
  heirs,
  onMode,
  onHeirAll,
  heirOf,
  onHeirOf,
  onSubmit,
  onCancel,
  busy,
  notice,
}: RemoveDialogProps) {
  const first = name.split(" ")[0] ?? name;
  const handing = tickets.filter((t) => t.handing);
  const options = heirs ? heirs.map((h) => ({ value: h.id, label: h.name })) : HEIRS;
  const nameOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const live = Boolean(onSubmit);
  return (
    <Dialog
      open={open}
      size="connect"
      title={`${name} さんをワークスペースから外す`}
      subtitle={`外すと入れなくなり、${first}のAI も止まる`}
      {...(onCancel ? { onOpenChange: (o: boolean) => (o || busy ? undefined : onCancel()) } : {})}
      actions={
        <>
          <Button
            variant="outlined"
            className="k-f10d-act"
            onClick={onCancel}
            disabled={live ? Boolean(busy) : undefined}
          >
            やめる
          </Button>
          <Button
            variant="danger"
            className="k-f10d-act"
            onClick={onSubmit}
            disabled={live ? Boolean(busy) : undefined}
          >
            本人確認して外す
          </Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        {notice ? <NoticeBox>{notice}</NoticeBox> : null}
        {mode === "none" ? (
          <p className="k-f10d-sub">担当しているチケットはありません。引き継ぎは要りません</p>
        ) : (
          <>
            <h3 className="k-f10d-h">{`担当しているチケット ${tickets.length} 件の引き継ぎ先`}</h3>
            <Modes mode={mode} onMode={onMode} />
            {mode === "all" ? (
              <Select
                name="heir-all"
                label="全部の引き継ぎ先"
                options={options}
                value={heir}
                {...(onHeirAll ? { onValueChange: (v: string | null) => v && onHeirAll(v) } : {})}
              />
            ) : null}
            <Tickets
              rows={tickets}
              mode={mode}
              heir={heir}
              options={options}
              nameOf={nameOf}
              heirOf={heirOf}
              onHeirOf={onHeirOf}
            />
            {handing.map((t) => (
              <Callout key={t.id ?? t.code} tone="warn">
                {`渡し中の ${t.code} は、外す前に取り消される（${nameOf(
                  mode === "each" ? (heirOf?.[t.id ?? t.code] ?? heir) : heir,
                )} さんへの渡しは成り立っていない）`}
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
