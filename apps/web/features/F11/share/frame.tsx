"use client";
// 会社の側のチケットの詳細の下絵の枠（キャンバス TicketDetail・段 7 の下絵と同じ作り方）。普通のチケットの詳細で、
//   違いは右のパネルに「ゲストに見せる」の区画とやり取り（チャット）が出ることだけ（2026-11-23 代表の決め answer=6ba09f587792）。
//   外枠は Shell。小窓は Shell の外に置く。値は見本
import type { ReactNode } from "react";
import { Band, Button, Prose, Shell, Toaster } from "@/components/k";
import { DetailTitle } from "@/features/F4/create-ticket/detail-head";
import "@/features/F4/create-ticket/ticket-detail.css";
import type { Theme } from "@/lib/theme";
import "@/features/F11/clients/clients.css";
import "./share.css";

type Ps = "PS0" | "PS2";
const ME = "高本 聖斗";
const TITLE = "セイコー様へ 11月分の請求書を送る";

function Meta({ stage }: { stage: string }) {
  return (
    <div className="k-detail-meta k-f11v-meta">
      <span data-part="kind" className="k-detail-kind" data-tone="primary">
        タスク
      </span>
      <span data-part="number" className="k-detail-number">
        EG-128
      </span>
      <span data-part="created" className="k-detail-created">
        作成 高本 10/30 17:44
      </span>
      <span className="k-detail-meta-side">
        <span data-part="start">
          開始日 <b>10/30</b>
        </span>
        <span data-part="due">
          期限 <b>11/01</b>
        </span>
        <span data-part="stage" className="k-detail-stage" data-stage="awaiting_approval">
          {stage}
        </span>
      </span>
    </div>
  );
}

function Fields({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="k-detail-fields">
      {rows.map(([k, v]) => (
        <div key={k} className="k-detail-field">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface FrameProps {
  theme: Theme;
  ps: Ps;
  /** 右のパネルに足す区画（ゲストに見せる・やり取り） */
  panelExtra?: ReactNode;
  dialog?: ReactNode;
  stage?: string;
  /** 題（依頼から作ったチケットは依頼の題） */
  title?: string;
}

export function TicketFrame({ theme, ps, panelExtra, dialog, stage = "承認待ち", title = TITLE }: FrameProps) {
  return (
    <Toaster>
      <Shell
        role="R1"
        screen="tickets"
        crumbs={[{ label: "EG 営業", href: "/tickets" }, { label: "一覧", href: "/tickets" }, { label: "EG-128" }]}
        workspace={{ name: "ENGINE BASE", initial: "E" }}
        member={{ name: ME, initial: "高" }}
        bridgeConnected={ps !== "PS0"}
        theme={theme}
      >
        <div className="k-detail">
          <section className="k-root k-page" aria-labelledby="ticket-title">
            <article className="k-detail-card">
              <Meta stage={stage} />
              <DetailTitle title={title} me={ME} />
              <div className="k-detail-bands">
                <Band
                  tone="approval"
                  title="あなたの承認を待っています"
                  sub="成果物は高本のAI が 11/01 09:12 に作成 ・ 確認 ① 2 件確実 ・ ② 1 件 AI 判定 ・ ③ 1 件はあなたが見る"
                  acts={
                    <>
                      <Button size="sm">承認して送る</Button>
                      <Button size="sm" variant="outlined">
                        自分で直す
                      </Button>
                      <Button size="sm" variant="outlined">
                        差し戻す
                      </Button>
                    </>
                  }
                />
              </div>
              <div className="k-detail-doc">
                <section className="k-section" aria-label="本文">
                  <h2 id="sec-goal">本文</h2>
                  <Prose>セイコー様に 11 月分の保守費を請求し、11/30 までに入金してもらう。</Prose>
                </section>
                <section className="k-section" aria-label="詳細">
                  <h2 id="sec-done">詳細</h2>
                  <ul className="k-f11v-conds">
                    <li>金額が見積 EG-097 保守契約の見積 の月額と一致している</li>
                    <li>インボイスの必須記載事項（登録番号・税率ごとの金額と税額）を満たしている</li>
                    <li>PDF がセイコー株式会社 経理部 @山田様 に送られ、実行後の確認で送信済みを確かめている</li>
                  </ul>
                </section>
              </div>
            </article>
          </section>
          <aside aria-label="チケットのパネル" className="k-detail-panel" id="ticket-talk">
            <div className="k-detail-panel-body">
              <section aria-label="担当" className="k-detail-panel-sec">
                <h2>担当</h2>
                <Fields
                  rows={[
                    ["担当者", ps === "PS2" ? "高本 聖斗 AI" : "高本 聖斗"],
                    ["承認する人", "高本（担当者）"],
                  ]}
                />
              </section>
              <section aria-label="日付と時間" className="k-detail-panel-sec">
                <h2>日付と時間</h2>
                <Fields
                  rows={[
                    ["開始日", "10/30（金）"],
                    ["期限", "11/01（日）1 日過ぎ"],
                  ]}
                />
              </section>
              <section aria-label="分類" className="k-detail-panel-sec">
                <h2>分類</h2>
                <Fields
                  rows={[
                    ["グループ", "営業（EG）"],
                    ["分類", "請求"],
                  ]}
                />
              </section>
              {panelExtra}
            </div>
          </aside>
        </div>
      </Shell>
      {dialog}
    </Toaster>
  );
}
