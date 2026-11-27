"use client";
// 分身の部屋と、チケットの詳細（右のパネルに「〈名〉のAI」を開いた形）を組む枠（段 6 の下絵・room の束）。
//   部屋：外枠（Shell）→ 頭（顔・名前・タブ）→ 本文。チケット：段 7 の下絵（mock/f6）と同じクラスで詳細を組む（本番の差し込み口は K-380・K-382）
//   スマホ：部屋の「話す」は会話の画面を開いている間（mchat）だけ頭を畳む。チケットは「〈名〉のAI」タブを開いた全画面（本文のカードは出さず、帯はタブの下へ）
import { PanelRight } from "lucide-react";
import type { ReactNode } from "react";
import { DocTools, PageBody, Prose, Shell, Toaster } from "@/components/k";
import { DetailTitle, InertButton, StagePill } from "@/features/F4/create-ticket/detail-head";
import "@/features/F4/create-ticket/ticket-detail.css";
import "@/features/F5/more/more.css";
import { RoomHead, type RoomTab } from "@/features/F5/room/head";
import { AiPanelTabs, TicketMobileBar } from "@/features/F5/room/ticket-talk";
import type { Theme } from "@/lib/theme";
import type { ProductState } from "../types";

export const ME = "高本";
/** チケットの本文の例（自由な 1 枚の文書・区画の見出しを持たない。drift 2026-11-21 11:30） */
export const TICKET_BODY =
  "セイコー商事の山田様から、11 月分の請求書を月末までに欲しいと連絡がありました（11/28 のメール）。\n保守の 11 月分（1,500,000 円）と、10/19 の追加対応 2 回分（60,000 円）を入れて請求書を作り、PDF にして山田様へメールで送ってください。CC は経理の鈴木さんです。";

/** 本文を段落ごとに並べる（区画の見出しは付けない） */
export function BodyText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((p) => (
        <Prose key={p}>{p}</Prose>
      ))}
    </>
  );
}
const WORKSPACE = { name: "ENGINE BASE", initial: "E" } as const;
const MEMBER = { name: ME, initial: "高" } as const;
const TAB_LABEL: Record<RoomTab, string> = { now: "ようす", talk: "話す", done: "やったこと" };

/** PC のつながり（PS2 だけつながっている。PS0 は未つなぎ・PS3 は閉じている） */
const connected = (ps: ProductState) => ps === "PS2";

export function roomSub({ ps }: { ps: ProductState }): string {
  if (ps === "PS0") return "高本 聖斗 の分身 ・ 今日から ・ PC がまだ";
  if (ps === "PS3") return "高本 聖斗 の分身 ・ 高本の MacBook は閉じています ・ 2026/09/12 から一緒に働いている";
  return "高本 聖斗 の分身 ・ 高本の MacBook で働く ・ 2026/09/12 から一緒に働いている";
}

/** スマホのひとこと（キャンバス MbAI：「● MacBook で動いている」）。短い 1 行 */
export function roomSubShort({ ps }: { ps: ProductState }): string {
  if (ps === "PS0") return "PC がまだつながっていません";
  if (ps === "PS3") return "高本の MacBook は閉じています";
  return "高本の MacBook で動いている";
}

export function RoomPage({
  theme,
  ps,
  tab,
  mchat = false,
  children,
}: {
  theme: Theme;
  ps: ProductState;
  tab: RoomTab;
  /** スマホで会話の画面を開いている（頭を畳む） */
  mchat?: boolean;
  children: ReactNode;
}) {
  return (
    <Toaster>
      <Shell
        role="R1"
        screen={tab === "talk" ? "clone-chat" : "ai-activity"}
        crumbs={[{ label: `${ME}のAI` }, { label: TAB_LABEL[tab] }]}
        workspace={WORKSPACE}
        member={MEMBER}
        bridgeConnected={connected(ps)}
        theme={theme}
      >
        <PageBody labelledBy="room-title">
          <RoomHead
            name={`${ME}のAI`}
            initial="高"
            sub={roomSub({ ps })}
            subShort={roomSubShort({ ps })}
            active={tab}
            mobileChat={mchat}
          />
          <div className="k-room-body">{children}</div>
        </PageBody>
      </Shell>
    </Toaster>
  );
}

export function TicketFrame({
  theme,
  ps,
  band,
  panel,
  count,
  no = "EG-128",
  title = "セイコー様へ 11 月分の請求書を送る",
  body = TICKET_BODY,
}: {
  theme: Theme;
  ps: ProductState;
  band?: ReactNode;
  panel: ReactNode;
  count?: number;
  no?: string;
  title?: string;
  /** 本文（自由な 1 枚の文書）。改行で段落を分ける */
  body?: string;
}) {
  return (
    <Toaster>
      <Shell
        role="R1"
        screen="tickets"
        crumbs={[{ label: "チケット", href: "/tickets" }, { label: no }]}
        workspace={WORKSPACE}
        member={MEMBER}
        bridgeConnected={connected(ps)}
        theme={theme}
      >
        <div className="k-detail" data-mtab="ai">
          <TicketMobileBar ticket={no} title={title} />
          <section className="k-root k-page" aria-labelledby="ticket-title">
            <article className="k-detail-card">
              <div className="k-detail-meta k-f5-meta">
                <span data-part="kind" className="k-detail-kind" data-tone="primary">
                  タスク
                </span>
                <span data-part="number" className="k-detail-number">
                  {no}
                </span>
                <span className="k-detail-meta-side">
                  <StagePill stage={{ key: "doing", name: "作業中" }} />
                </span>
              </div>
              <DetailTitle title={title} me={ME} />
              <div className="k-detail-bands">{band}</div>
              <DocTools label="本文の道具" note="「/」で部品を入れる ・ 本文の版 3">
                <InertButton size="sm" className="k-detail-versions">
                  版と差分
                </InertButton>
              </DocTools>
              <div className="k-detail-doc">
                <BodyText text={body} />
              </div>
            </article>
          </section>
          <aside aria-label="チケットのパネル" className="k-detail-panel" id="ticket-talk">
            <button type="button" className="k-detail-panel-close" aria-label="パネルを閉じる" title="パネルを閉じる">
              <PanelRight size={16} aria-hidden="true" />
            </button>
            <AiPanelTabs me={ME} {...(count ? { count } : {})} />
            {band ? <div className="k-room-mband">{band}</div> : null}
            {panel}
          </aside>
        </div>
      </Shell>
    </Toaster>
  );
}

/** チケットを作る画面（左に欄・右に AI との会話）を組む枠。スマホの会話の画面は頭を畳む */
export function CreatePage({ theme, ps, children }: { theme: Theme; ps: ProductState; children: ReactNode }) {
  return (
    <Toaster>
      <Shell
        role="R1"
        screen="tickets"
        crumbs={[{ label: "チケット", href: "/tickets" }, { label: "作る" }]}
        workspace={WORKSPACE}
        member={MEMBER}
        bridgeConnected={connected(ps)}
        theme={theme}
      >
        <PageBody labelledBy="create-ticket-title">{children}</PageBody>
      </Shell>
    </Toaster>
  );
}
