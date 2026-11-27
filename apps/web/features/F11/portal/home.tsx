"use client";
// ゲストの場所の最初の画面（キャンバス CpHome）：依頼と見せてもらったチケットの 2 つ（2026-11-23 代表の決め answer=6ba09f587792）。値は見本を受け取って描くだけ。
//   読み込み中・読めない・空は同じ箱の中で出す。字：キャンバスのまま、無い所は仮
//   本物の値は props で渡す（K-911・渡さなければ見本のまま）。部品は口を呼ばない
import type { Route } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge, Button, Callout, ErrorState, Loading, PAGE_ERROR } from "@/components/k";
import { SAMPLE_GROUP, usePortalCompany } from "./frame";
import "./portal.css";

const noop = () => undefined;

export interface RequestItem {
  /** 行の鍵（無ければ題） */
  id?: string;
  title: string;
  meta: string;
  badge: string;
  /** 開く依頼のやり取りの道。無ければ行は押せない（見本） */
  href?: string;
}
export interface WorkItem {
  /** 行の鍵（無ければ題） */
  id?: string;
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

export interface HomeBodyProps {
  phase?: HomePhase;
  notice?: { title: string; body: string } | undefined;
  /** 依頼の行（口の値）。無ければ見本 */
  requests?: RequestItem[];
  /** 見せてもらったチケットの行（口の値）。無ければ見本 */
  works?: WorkItem[];
  /** ゲストのグループの名前（口の group_name）。無ければ見本 */
  groupName?: string;
  onNewRequest?: () => void;
  onRetry?: () => void;
}

function Row({ item }: { item: RequestItem }) {
  const inner = (
    <>
      <span className="k-f11p-row-main">
        <span>{item.title}</span>
        <span className="k-f11p-row-meta">{item.meta}</span>
      </span>
      <Badge>{item.badge}</Badge>
    </>
  );
  return item.href ? (
    <Link className="k-f11p-row k-f11p-row-link" href={item.href as Route}>
      {inner}
    </Link>
  ) : (
    <div className="k-f11p-row">{inner}</div>
  );
}

export function HomeBody({
  phase = "normal",
  notice,
  requests = REQUESTS,
  works = WORKS,
  groupName = SAMPLE_GROUP,
  onNewRequest = noop,
  onRetry = noop,
}: HomeBodyProps) {
  const company = usePortalCompany();
  const empty = phase === "empty";
  return (
    <>
      <div className="k-f11p-titlebar">
        <h1>{company ? `${company} とのやり取り` : "やり取り"}</h1>
        <span className="k-f11p-titlebar-act">
          <Button variant="primary" onClick={onNewRequest}>
            ＋ 依頼を出す
          </Button>
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
        <ErrorState code={PAGE_ERROR.loadFailed} acts={[onRetry]} />
      ) : (
        <>
          <section className="k-f11p-card" aria-label="依頼">
            <div className="k-f11p-card-head">
              <b>依頼</b>
              <span className="k-f11p-row-meta">・ {groupName}の依頼</span>
            </div>
            {empty || requests.length === 0 ? (
              <p className="k-f11p-row-empty">
                まだ依頼はありません。お願いしたいことがあれば「依頼を出す」から送れます
              </p>
            ) : (
              requests.map((r) => <Row key={r.id ?? r.title} item={r} />)
            )}
          </section>
          <section className="k-f11p-card" aria-label="見せてもらったチケット">
            <div className="k-f11p-card-head">
              <b>見せてもらったチケット</b>
            </div>
            {empty || works.length === 0 ? (
              <p className="k-f11p-row-empty">
                まだ見せてもらったチケットはありません。{company} が見せると決めたチケットが、ここに出ます
              </p>
            ) : (
              works.map((w) => (
                <Link key={w.id ?? w.title} className="k-f11p-row k-f11p-row-link" href={w.href as Route}>
                  <span className="k-f11p-row-main">
                    <span>{w.title}</span>
                    <span className="k-f11p-row-meta">{w.meta}</span>
                  </span>
                  <ChevronRight size={14} aria-hidden="true" />
                </Link>
              ))
            )}
          </section>
        </>
      )}
    </>
  );
}
