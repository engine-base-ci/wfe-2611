"use client";
// 1 社の画面の枠（段 13・領域 ops・キャンバス OpWs の頭とタブとワークスペースの情報）。値を受け取って描くだけ
//   K-972：頭のボタン（acts）・止めている帯（stopBand・onResume）・頭の下の知らせ（notice）を任意の props で受ける。
//   渡さない呼び方（モック）は今の見た目のまま
//   K-971：頭の値（view）・タブの字（tabs）・タブを押したとき（onTab）・右の情報の行（info）を任意の props で受ける
import type { ReactNode } from "react";
import { Band, Button, Menu, MenuItem, MenuPopup, MenuTrigger, Tabs } from "@/components/k";
import { Card, Facts, StatusBadge } from "./ops-parts";
import { WS_INFO } from "./ops-sample";
import type { FrameView } from "./ws-tenant-shape";

export type TenantTab = "status" | "members" | "billing" | "inquiries" | "log";

/** 頭のボタンの関数と、押せるか（持たない人には押せない形で出す・隠さない・D-145.9） */
export interface TenantActs {
  onNotice: () => void;
  onPeek: () => void;
  onStop: () => void;
  onResume: () => void;
  canNotice: boolean;
  canPeek: boolean;
  canStop: boolean;
}
/** 止めている帯の値（理由の字・止めた日 M/DD） */
export interface TenantStopBand {
  reason: string;
  since: string;
}

export interface TenantFrameProps {
  tab: TenantTab;
  /** 止めている 1 社（札が赤・上に帯・メニューが「再開する」） */
  stopped?: boolean;
  /** 頭のボタンの関数（渡さなければ押しても何もしない） */
  acts?: TenantActs;
  /** 止めている帯の値（渡せば stopped と同じ形で、この値の字を出す） */
  stopBand?: TenantStopBand | null;
  /** 頭の下の知らせ（「送りました」など・role=status） */
  notice?: ReactNode;
  /** 再開を送っている間 */
  resuming?: boolean;
  /** 頭の値（名前・印・状態の札・頭の下の字）。渡さなければ下絵の見本 */
  view?: FrameView;
  /** タブの字（数つき）。渡さなければ下絵の字 */
  tabs?: Partial<Record<TenantTab, string>>;
  /** タブを押したとき（渡さなければタブは動かない＝下絵） */
  onTab?: (tab: TenantTab) => void;
  /** 右の「ワークスペースの情報」の行。渡さなければ下絵の見本 */
  info?: readonly (readonly [string, string])[];
  /** 開いたタブの中身。ほかのタブの中身は描かない */
  children: ReactNode;
}

const TABS: readonly { value: TenantTab; label: string }[] = [
  { value: "status", label: "いまの状態" },
  { value: "members", label: "メンバー 8" },
  { value: "billing", label: "プランと請求" },
  { value: "inquiries", label: "問い合わせ 1" },
  { value: "log", label: "記録" },
];

const NO_ACT = "この操作はできません";
const SAMPLE_STOP: TenantStopBand = { reason: "請求が払われない", since: "11/09" };

const SAMPLE_VIEW: FrameView = {
  name: "合同会社ミナト企画",
  mark: "ミ",
  status: "使っている",
  tone: "success",
  sub: "チーム ・ 8 人",
  stopped: false,
};
const TAB_VALUES: readonly string[] = TABS.map((t) => t.value);

export function WsInfoCard({ rows = WS_INFO }: { rows?: readonly (readonly [string, string])[] }) {
  return (
    <Card title="ワークスペースの情報">
      <Facts rows={rows} />
      <p className="k-op-note-text">
        このワークスペースへの運営の操作はすべて「記録」に残り、顧客の「ワークスペースの管理 ›
        記録」にも出る（許可は規約で先にもらっている）
      </p>
    </Card>
  );
}

/** 頭のボタン 1 つ：できない人には押せない形（aria-disabled・押しても何もしない） */
function HeadButton({ can, onClick, children }: { can: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button
      variant="outlined"
      {...(can ? {} : { "aria-disabled": true, title: NO_ACT })}
      onClick={() => {
        if (can) onClick();
      }}
    >
      {children}
    </Button>
  );
}

/** 頭（印・名前・状態・操作）→ 帯 → タブ → 中身と情報 */
export function TenantFrame({
  tab,
  stopped = false,
  acts,
  stopBand,
  notice,
  resuming = false,
  view = SAMPLE_VIEW,
  tabs,
  onTab,
  info,
  children,
}: TenantFrameProps) {
  const band = stopBand ?? (stopped ? SAMPLE_STOP : null);
  const isStopped = band !== null;
  const canStop = acts?.canStop ?? true;
  const toggle = () => {
    if (!acts || !canStop) return;
    if (isStopped) acts.onResume();
    else acts.onStop();
  };
  return (
    <section className="k-root k-page" aria-labelledby="op-ws-title">
      <header className="k-page-head">
        <span className="k-op-ws-mark" aria-hidden="true">
          {view.mark}
        </span>
        <h1 id="op-ws-title">{view.name}</h1>
        {band ? (
          <StatusBadge tone="danger">止めている（{band.since}〜）</StatusBadge>
        ) : (
          <StatusBadge tone={view.tone}>{view.status}</StatusBadge>
        )}
        <p className="k-page-sub">{view.sub}</p>
        <div className="k-page-acts">
          <HeadButton can={acts?.canNotice ?? true} onClick={() => acts?.onNotice()}>
            お知らせを送る
          </HeadButton>
          <HeadButton can={acts?.canPeek ?? true} onClick={() => acts?.onPeek()}>
            中を見る
          </HeadButton>
          <Menu>
            <MenuTrigger label="そのほかの操作" className="k-op-more">
              ⋯
            </MenuTrigger>
            <MenuPopup>
              <MenuItem disabled={!canStop} onSelect={toggle}>
                {isStopped ? "再開する" : "止める"}
              </MenuItem>
            </MenuPopup>
          </Menu>
        </div>
      </header>
      <div className="k-op-body">
        {band ? (
          <Band
            tone="danger"
            role="alert"
            title="このワークスペースは止めています"
            sub={`理由：${band.reason} ・ 止めた日 ${band.since}。メンバーは入ると止められた画面になり、分身の実行も止まっています。チケット・記録・分身の記憶はそのまま残っています`}
            acts={
              <Button
                size="sm"
                variant="primary"
                loading={resuming}
                {...(canStop ? {} : { "aria-disabled": true, title: NO_ACT })}
                onClick={toggle}
              >
                再開する
              </Button>
            }
          />
        ) : null}
        {notice}
        <div className="k-op-cols">
          <div className="k-op-main">
            <Tabs
              label="1 社の画面"
              value={tab}
              items={TABS.map((t) => ({
                ...t,
                label: tabs?.[t.value] ?? t.label,
                panel: t.value === tab ? children : null,
              }))}
              {...(onTab ? { onValueChange: (v: string) => TAB_VALUES.includes(v) && onTab(v as TenantTab) } : {})}
            />
          </div>
          <aside className="k-op-side" aria-label="ワークスペースの情報">
            <WsInfoCard {...(info ? { rows: info } : {})} />
          </aside>
        </div>
      </div>
    </section>
  );
}
