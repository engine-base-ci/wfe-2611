"use client";
// 自分の設定 › 知らせ（キャンバス MeNotify）。知らせの受け方はワークスペースごとに決める。値を受け取って描くだけ。
//   メールは受け箱で読んでいないものを 30 分ごとにまとめて送る（キャンバスの文）。デスクトップとスマホへの知らせは後のフェーズ
//   本番（K-843 の notify-screen.tsx）は任意の props で値と押した手を渡す。渡さない呼び方（モック）は見本の値で描く
import type { ReactNode } from "react";
import {
  Band,
  Button,
  Callout,
  Dialog,
  ErrorState,
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
  PAGE_ERROR,
  Tabs,
} from "@/components/k";
import { RowButton, SettingCard, SettingNote, SettingRow } from "@/components/k/setting-parts";
import {
  EVENT_ROWS,
  PAUSE_ITEMS,
  QUIET_ITEMS,
  ROW_FAIL,
  TOP_FAIL,
  URGENT_ITEMS,
  type Channel,
  type EventRowValue,
} from "./notify-shape";
import "./account.css";

/** 見本の値（モック） */
const SAMPLE_ON: Record<string, [boolean, boolean]> = {
  clone_finished: [true, false],
  ticket_changed: [true, false],
};
const SAMPLE_EVENTS: readonly EventRowValue[] = EVENT_ROWS.map((r) => {
  const [bell, mail] = SAMPLE_ON[r.key] ?? [true, true];
  return { ...r, bell, mail, fixed: r.key === "new_device" };
});
const WS = ["株式会社ENGINE BASE", "高本 聖斗（個人）", "京蟻システム"];

export interface EventRowsProps {
  saveFailed?: boolean | undefined;
  /** 行の値（渡せば押した値を持たない形で描く） */
  events?: readonly (EventRowValue & { failed?: boolean })[] | undefined;
  onToggle?: ((key: string, channel: Channel, value: boolean) => void) | undefined;
  /** 答えを待っている行（その行のチェックは押せない） */
  busyKey?: string | null | undefined;
}

export function EventRows({ saveFailed, events, onToggle, busyKey }: EventRowsProps) {
  const rows = events ?? SAMPLE_EVENTS.map((e, i) => ({ ...e, failed: i === 1 && !!saveFailed }));
  const live = events !== undefined;
  const box = (e: EventRowValue, ch: Channel) => {
    const off = e.fixed || busyKey === e.key;
    return live ? (
      <input
        type="checkbox"
        checked={e[ch]}
        disabled={off}
        onChange={(ev) => onToggle?.(e.key, ch, ev.currentTarget.checked)}
      />
    ) : (
      <input type="checkbox" defaultChecked={e[ch]} disabled={e.fixed} />
    );
  };
  return (
    <SettingCard title="出来事" aside="受け箱（ベル）とメール（まとめて）" labelledBy="nt-events">
      {rows.map((e) => (
        <SettingRow
          key={e.key}
          name={e.name}
          detail={e.failed ? ROW_FAIL : e.detail}
          actions={
            <span className="k-f10a-ev">
              <label>{box(e, "bell")} ベル</label>
              <label>{box(e, "mail")} メール</label>
            </span>
          }
        />
      ))}
      <SettingNote>
        メールは、受け箱で読んでいないものを 30 分ごとにまとめて送る。デスクトップとスマホへの知らせは後のフェーズ
      </SettingNote>
    </SettingCard>
  );
}

export interface QuietCardProps {
  menuOpen?: boolean | undefined;
  stopped?: boolean | undefined;
  /** 静かにする時間のボタンの字（選んでいる物） */
  preset?: string | undefined;
  onPreset?: ((value: string) => void) | undefined;
  /** 止めている帯（無ければ止めていない）。渡せば stopped より先に見る */
  paused?: { title: string } | null | undefined;
  onPause?: ((value: string) => void) | undefined;
  onResume?: (() => void) | undefined;
  /** 止めていても知らせる物（真の物の値） */
  urgent?: readonly string[] | undefined;
  onUrgent?: ((value: string, on: boolean) => void) | undefined;
}

export function QuietCard({
  menuOpen,
  stopped,
  preset,
  onPreset,
  paused,
  onPause,
  onResume,
  urgent,
  onUrgent,
}: QuietCardProps) {
  const band = paused !== undefined ? paused : stopped ? { title: "いま止めています ・ 今日いっぱい" } : null;
  return (
    <SettingCard title="静かにする時間" labelledBy="nt-quiet">
      <SettingRow
        name="夜と休みの日"
        detail="このあいだはメールを送らない（受け箱にはたまる）"
        actions={
          <Menu defaultOpen={menuOpen ?? false}>
            <MenuTrigger className="k-btn k-f10a-quiet" label="静かにする時間を選ぶ">
              {preset ?? QUIET_ITEMS[0]!.label} ▾
            </MenuTrigger>
            <MenuPopup align="end">
              {QUIET_ITEMS.map((t) => (
                <MenuItem key={t.value} className="k-select-item" onSelect={() => onPreset?.(t.value)}>
                  {t.label}
                </MenuItem>
              ))}
            </MenuPopup>
          </Menu>
        }
      />
      <li className="k-set-row">
        <span className="k-set-main">
          <span className="k-set-name">いま止める</span>
          {band ? (
            <Band
              tone="wait"
              title={band.title}
              sub="メールは止まっています。受け箱にはたまります"
              acts={
                <Button variant="outlined" size="sm" onClick={onResume}>
                  止めるのをやめる
                </Button>
              }
            />
          ) : null}
        </span>
        <span className="k-f10a-times">
          {PAUSE_ITEMS.map((t) => (
            <RowButton key={t.value} onClick={() => onPause?.(t.value)}>
              {t.label}
            </RowButton>
          ))}
        </span>
      </li>
      <SettingRow
        name="止めていても知らせる"
        detail="急ぎのものだけ"
        actions={
          <span className="k-f10a-ev">
            {URGENT_ITEMS.map((u) => (
              <label key={u.value}>
                {urgent ? (
                  <input
                    type="checkbox"
                    checked={urgent.includes(u.value)}
                    onChange={(ev) => onUrgent?.(u.value, ev.currentTarget.checked)}
                  />
                ) : (
                  <input type="checkbox" defaultChecked />
                )}{" "}
                {u.label}
              </label>
            ))}
          </span>
        }
      />
    </SettingCard>
  );
}

export interface NotifyState {
  menuOpen?: boolean;
  stopped?: boolean;
  /** 1 行が保存できなかった */
  saveFailed?: boolean;
}

export interface PanelProps extends Omit<EventRowsProps, "saveFailed">, Omit<QuietCardProps, "menuOpen" | "stopped"> {
  s?: NotifyState | undefined;
  /** 本文の上の赤い箱の字（渡せば saveFailed より先に見る） */
  notice?: string | null | undefined;
}

export function Panel({ s = {}, notice, events, onToggle, busyKey, ...quiet }: PanelProps) {
  const top = notice !== undefined ? notice : s.saveFailed ? TOP_FAIL : null;
  return (
    <>
      {top ? <Callout tone="danger">{top}</Callout> : null}
      <EventRows saveFailed={s.saveFailed} events={events} onToggle={onToggle} busyKey={busyKey} />
      <QuietCard menuOpen={s.menuOpen} stopped={s.stopped} {...quiet} />
    </>
  );
}

export interface NotifyTab {
  value: string;
  label: string;
  panel: ReactNode;
}
export interface NotifyBodyProps {
  s?: NotifyState;
  /** ワークスペースごとのタブ（渡さなければ見本の 3 つ） */
  tabs?: NotifyTab[];
  value?: string;
  onTab?: (value: string) => void;
  onCopy?: () => void;
  /** 写す先が無い（押せない形・指を置くと訳が読める） */
  copyDisabled?: { title: string } | null;
}

/** 知らせの本文。ワークスペースごとのタブ。保存できなかったときは、3 つめのタブで「読めない」の形も見られる */
export function NotifyBody({ s = {}, tabs, value, onTab, onCopy, copyDisabled }: NotifyBodyProps) {
  const unreadable = s.saveFailed;
  const items =
    tabs ??
    WS.map((w, i) => ({
      value: String(i),
      label: w,
      panel:
        unreadable && i === 2 ? (
          <ErrorState code={PAGE_ERROR.down} acts={[() => undefined]} />
        ) : (
          <Panel s={i === 0 ? s : {}} />
        ),
    }));
  return (
    <section className="k-page k-me-page" aria-labelledby="notify-title">
      <header className="k-page-head">
        <h1 id="notify-title">お知らせ</h1>
        <p className="k-desc">ワークスペースごとに決める</p>
        <div className="k-page-acts">
          <Button
            variant="outlined"
            size="sm"
            aria-disabled={copyDisabled ? "true" : undefined}
            title={copyDisabled?.title}
            onClick={copyDisabled ? undefined : onCopy}
          >
            この設定をほかのワークスペースにも写す
          </Button>
        </div>
      </header>
      <Tabs
        label="ワークスペースごとのお知らせ"
        items={items}
        {...(value !== undefined ? { value } : {})}
        {...(onTab ? { onValueChange: onTab } : {})}
      />
    </section>
  );
}

export interface CopyTarget {
  id: string;
  name: string;
  checked: boolean;
}
export interface CopyDialogProps {
  open?: boolean;
  /** 写す元（開いているタブの会社名） */
  from?: string;
  targets?: readonly CopyTarget[];
  onToggle?: (id: string, on: boolean) => void;
  onCopy?: () => void;
  onClose?: () => void;
  busy?: boolean;
  /** 写せなかった訳（小窓の中に出す） */
  error?: string | null;
}

const SAMPLE_TARGETS: readonly CopyTarget[] = [
  { id: "solo", name: "高本 聖斗（個人）", checked: true },
  { id: "kyoto", name: "京蟻システム", checked: false },
];

/** ほかのワークスペースにも写す小窓 */
export function CopyDialog({
  open = true,
  from = "株式会社ENGINE BASE",
  targets,
  onToggle,
  onCopy,
  onClose,
  busy = false,
  error,
}: CopyDialogProps = {}) {
  const live = targets !== undefined;
  const list = targets ?? SAMPLE_TARGETS;
  const none = live && !list.some((t) => t.checked);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (o ? undefined : onClose?.())}
      title="この設定をほかのワークスペースにも写す"
      subtitle={`いま開いている「${from}」のお知らせの受け方を、選んだ場所に写します`}
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>
            やめる
          </Button>
          <Button disabled={none} loading={busy} onClick={onCopy}>
            写す
          </Button>
        </>
      }
    >
      {error ? <Callout tone="danger">{error}</Callout> : null}
      {list.map((t) => (
        <label key={t.id} className="k-f10a-choices">
          {live ? (
            <input type="checkbox" checked={t.checked} onChange={(ev) => onToggle?.(t.id, ev.currentTarget.checked)} />
          ) : (
            <input type="checkbox" defaultChecked={t.checked} />
          )}{" "}
          {t.name}
        </label>
      ))}
      <p className="k-f10a-note">写すと、向こうの今の受け方は置き換わります。静かにする時間も一緒に写ります</p>
    </Dialog>
  );
}
