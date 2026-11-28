"use client";
// 段 6 core の下絵の外枠：チケットの詳細（題名の下の帯の並び）と承認待ちの頁。本番と同じ部品（Shell・DetailTitle・DocTools・approve.css の表）で並べる。
//   詳細の並びは段 7 のモック（mock/f6/mocks.tsx）と同じクラス。帯の中身・小窓は features/F5/more/ の部品。
import { Bot, PanelRight } from "lucide-react";
import type { ReactNode } from "react";
import { Button, DocTools, Shell, Toaster } from "@/components/k";
import { BodyText, TICKET_BODY } from "./room-pages";
import { NextBottom } from "@/features/F5/more/queue";
import { DetailTitle, InertButton, StagePill } from "@/features/F4/create-ticket/detail-head";
import "@/features/F4/create-ticket/ticket-detail.css";
import "@/features/F5/approve-complete/approve.css";
import "@/features/F5/more/more.css";
import type { Theme } from "@/lib/theme";
import type { ProductState } from "../types";

export const ME = "高本";
export const TITLE = "セイコー様へ 11 月分の請求書を送る";

export type StageKey = "doing" | "awaiting_approval" | "done";
const STAGES: Record<StageKey, string> = { doing: "作業中", awaiting_approval: "承認待ち", done: "完了" };

function Meta({ stage }: { stage: StageKey }) {
  return (
    <div className="k-detail-meta k-f5-meta">
      <span data-part="kind" className="k-detail-kind" data-tone="primary">
        タスク
      </span>
      <span data-part="number" className="k-detail-number">
        EG-128
      </span>
      <span data-part="created" className="k-detail-created">
        作成 10/30 17:44
      </span>
      <span className="k-detail-meta-side">
        <span data-part="start">
          開始日 <b>10/30</b>
        </span>
        <span data-part="due">
          期限 <b>11/01</b>
        </span>
        <StagePill stage={{ key: stage, name: STAGES[stage] }} />
      </span>
    </div>
  );
}

/** 詳細の右のパネル（本番の詳細は段5 の K-571・K-1153 で右のパネルが在る形。本番と同じクラスと並びで描くだけ・PM の決め 2026-11-28） */
function Panel({ stage }: { stage: StageKey }) {
  const secs: [string, [string, string][]][] = [
    [
      "担当",
      [
        ["担当者", "高本 聖斗"],
        ["段", STAGES[stage]],
      ],
    ],
    [
      "日付と時間",
      [
        ["開始日", "10/30（金）"],
        ["期限", "11/01（日）"],
      ],
    ],
    [
      "分類",
      [
        ["グループ", "営業（EG）"],
        ["優先度", "中"],
      ],
    ],
  ];
  return (
    <aside aria-label="チケットのパネル" className="k-detail-panel">
      <button type="button" className="k-detail-panel-close" aria-label="パネルを閉じる" title="パネルを閉じる">
        <PanelRight size={16} aria-hidden="true" />
      </button>
      <nav aria-label="パネルのタブ" className="k-detail-tabs">
        <button type="button" aria-current="page">
          属性
        </button>
        <button type="button" aria-disabled="true" tabIndex={-1} title="まだ使えません">
          やり取り
        </button>
        <button type="button" aria-disabled="true" tabIndex={-1} title="まだ使えません">
          <Bot size={14} aria-hidden="true" />
          {`${ME}のAI`}
        </button>
      </nav>
      <div className="k-detail-panel-body">
        {secs.map(([label, rows]) => (
          <section key={label} aria-label={label} className="k-detail-panel-sec">
            <h2>{label}</h2>
            <dl className="k-detail-fields">
              {rows.map(([k, v]) => (
                <div key={k} className="k-detail-field">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </aside>
  );
}

interface TicketPageProps {
  theme: Theme;
  ps: ProductState;
  stage: StageKey;
  /** 題名の下の帯の region の中身（承認と実行・AI に任せる） */
  band: ReactNode;
  /** 帯の下（成果物のカード・確認の表・やり取りの 1 行） */
  below?: ReactNode;
  dialog?: ReactNode;
}

export function TicketPage({ theme, ps, stage, band, below, dialog }: TicketPageProps) {
  return (
    <Toaster>
      <Shell
        role="R1"
        screen="tickets"
        crumbs={[{ label: "チケット", href: "/tickets" }, { label: "EG-128" }]}
        workspace={{ name: "ENGINE BASE", initial: "E" }}
        member={{ name: ME, initial: "高" }}
        bridgeConnected={ps !== "PS3"}
        theme={theme}
      >
        <div className="k-detail">
          <section className="k-root k-page" aria-labelledby="ticket-title">
            <article className="k-detail-card k-more-detail">
              {/* スマホでは詳細は一覧から入る別の画面：頭の「‹」で一覧へ戻る（キャンバス MobileDetail） */}
              <a className="k-more-back" href="/tickets">
                <span aria-hidden="true">‹</span> チケット
              </a>
              <Meta stage={stage} />
              <DetailTitle title={TITLE} me={ME} />
              <div className="k-detail-bands">
                <section
                  aria-label="承認と実行"
                  className="k62-band k-section"
                  data-busy={stage === "done" ? undefined : ""}
                >
                  <div className="k-more-stack">{band}</div>
                </section>
                {below ? <div className="k-more-stack">{below}</div> : null}
              </div>
              <DocTools label="本文の道具" note="「/」で部品を入れる ・ 本文の版 3">
                <InertButton size="sm" className="k-detail-versions">
                  版と差分
                </InertButton>
              </DocTools>
              <div className="k-detail-doc">
                <BodyText text={TICKET_BODY} />
              </div>
            </article>
          </section>
          <Panel stage={stage} />
        </div>
      </Shell>
      {dialog}
    </Toaster>
  );
}

interface QueuePageProps {
  theme: Theme;
  total: number;
  /** 頭の「続けて裁く」を押せる形にするか（0 件のときは出さない） */
  next?: boolean;
  /** 頁の下の入口（NextBottom）を置くか。置くとスマホでは見出しのボタンが隠れる（more.css）。既定は next と同じ */
  bottom?: boolean;
  children: ReactNode;
  dialog?: ReactNode;
}

export function QueuePage({ theme, total, next = true, bottom = next, children, dialog }: QueuePageProps) {
  return (
    <Toaster>
      <Shell
        role="R1"
        screen="approvals"
        crumbs={[{ label: "承認待ち" }]}
        workspace={{ name: "ENGINE BASE", initial: "E" }}
        member={{ name: ME, initial: "高" }}
        badges={{ approvals: total }}
        bridgeConnected
        theme={theme}
      >
        <section className="k-root k-page" aria-labelledby="approvals-title">
          <header className="k-page-head k-ap-head">
            <h1 id="approvals-title">承認待ち</h1>
            <p className="k-page-sub">
              あなたが決めるもの <span className="k63-count">{total} 件</span>
            </p>
            {next ? <Button className="k-ap-next">{`続けて裁く（${total} 件）`}</Button> : null}
          </header>
          <div className="k-ap-body">
            {children}
            {next && bottom ? <NextBottom total={total} /> : null}
          </div>
        </section>
      </Shell>
      {dialog}
    </Toaster>
  );
}
