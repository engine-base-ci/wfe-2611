"use client";
// ゲストの場所の最初の画面（キャンバス CpHome）：依頼と見せてもらったチケットの 2 つ（2026-11-23 代表の決め answer=6ba09f587792）。値は見本を受け取って描くだけ。
//   読み込み中・読めない・空は同じ箱の中で出す。字：キャンバスのまま、無い所は仮
import { ChevronRight } from "lucide-react";
import { Badge, Button, Callout, ErrorState, Loading, PAGE_ERROR } from "@/components/k";
import "./portal.css";

const noop = () => undefined;

export interface RequestItem {
  title: string;
  meta: string;
  badge: string;
}
export interface WorkItem {
  title: string;
  meta: string;
  /** 開くチケットの道（見せてもらったチケットの画面） */
  href: string;
}

export const REQUESTS: RequestItem[] = [
  {
    title: "12 月分の作業報告書もほしい",
    meta: "鈴木 健太 様 ・ 今日 10:20 ・ ENGINE BASE から返事：「12/26 までにお送りします」",
    badge: "返事あり",
  },
  {
    title: "来年 1 月から請求書の宛先を変えたい",
    meta: "山田 花子 様 ・ 今日 11:30 ・ ENGINE BASE から返事：「佐野様のメールアドレスを教えていただけますか」",
    badge: "返事あり",
  },
  { title: "10 月分の請求書の宛名を変えたい", meta: "山田 花子 様 ・ 10/12", badge: "済み" },
];
export const WORKS: WorkItem[] = [
  { title: "11月分の請求書を送る", meta: "確認中", href: "/portal/tickets/eg-128" },
  { title: "保守更新の見積", meta: "作っている", href: "/portal/tickets/eg-126" },
  { title: "10 月分の請求書の宛名を変える", meta: "完了 ・ 山田様の依頼から", href: "/portal/tickets/kr-044" },
];

export type HomePhase = "normal" | "empty" | "loading" | "failed";

export function HomeBody({
  phase = "normal",
  notice,
}: {
  phase?: HomePhase;
  notice?: { title: string; body: string };
}) {
  const empty = phase === "empty";
  return (
    <>
      <div className="k-f11p-titlebar">
        <h1>ENGINE BASE とのやり取り</h1>
        <span className="k-f11p-titlebar-act">
          <Button variant="primary">＋ 依頼を出す</Button>
        </span>
      </div>
      {notice ? (
        <Callout tone="warn" title={notice.title}>
          {notice.body}
        </Callout>
      ) : null}
      {phase === "loading" ? (
        <Loading label="やり取りを読み込んでいます…" delayMs={0} />
      ) : phase === "failed" ? (
        <ErrorState code={PAGE_ERROR.loadFailed} acts={[noop]} />
      ) : (
        <>
          <section className="k-f11p-card" aria-label="依頼">
            <div className="k-f11p-card-head">
              <b>依頼</b>
              <span className="k-f11p-row-meta">・ セイコー株式会社（ゲスト）の依頼</span>
            </div>
            {empty ? (
              <p className="k-f11p-row-empty">
                まだ依頼はありません。お願いしたいことがあれば「依頼を出す」から送れます
              </p>
            ) : (
              REQUESTS.map((r) => (
                <div key={r.title} className="k-f11p-row">
                  <span className="k-f11p-row-main">
                    <span>{r.title}</span>
                    <span className="k-f11p-row-meta">{r.meta}</span>
                  </span>
                  <Badge>{r.badge}</Badge>
                </div>
              ))
            )}
          </section>
          <section className="k-f11p-card" aria-label="見せてもらったチケット">
            <div className="k-f11p-card-head">
              <b>見せてもらったチケット</b>
            </div>
            {empty ? (
              <p className="k-f11p-row-empty">
                まだ見せてもらったチケットはありません。ENGINE BASE が見せると決めたチケットが、ここに出ます
              </p>
            ) : (
              WORKS.map((w) => (
                <a key={w.title} className="k-f11p-row k-f11p-row-link" href={w.href}>
                  <span className="k-f11p-row-main">
                    <span>{w.title}</span>
                    <span className="k-f11p-row-meta">{w.meta}</span>
                  </span>
                  <ChevronRight size={14} aria-hidden="true" />
                </a>
              ))
            )}
          </section>
        </>
      )}
    </>
  );
}
