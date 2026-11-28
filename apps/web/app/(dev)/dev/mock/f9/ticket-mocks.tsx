"use client";
// 段 10 の下絵：チケットの側に出るナレッジの分（3 つの状態）。詳細の並びは今の本線と同じクラス（ticket-detail.css）。
//   右のパネルのタブの名前（項目・やり取り）と確認項目は段 5 の下絵 v2 の形。ここで足すのは features/F9/knowledge/ticket-views.tsx の物だけ
import { Bot, PanelRight } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/k";
import { InertButton } from "@/features/F4/create-ticket/detail-head";
import "@/features/F4/create-ticket/ticket-detail.css";
import { Composer, Line, Post, RunCard, ThreadFilters, type Person } from "@/features/F6/thread/views";
import "@/features/F6/thread/thread.css";
import type { Block, Doc, Inline, ListItemNode, ParagraphNode } from "@kaname/contracts";
import { DocView } from "@/features/F4/doc/editor";
import { AI_PERSON, BreachText, GuardLineText, GuardPost } from "@/features/F9/knowledge/ticket-rows";
import {
  CompleteBlockedDialog,
  OpenedText,
  SpecList,
  type GuardPage,
  type SpecRow,
} from "@/features/F9/knowledge/ticket-views";
import type { Theme } from "@/lib/theme";
import { Frame } from "./frame";

// 詳細の本文（段 5 の文書の木。読む形は DocView）
const txt = (text: string): Inline => ({ type: "text", text });
const para = (...xs: Inline[]): ParagraphNode => ({ type: "paragraph", content: xs });
const h2 = (text: string): Block => ({ type: "heading", attrs: { level: 2 }, content: [txt(text)] });
const item = (text: string): ListItemNode => ({
  type: "listItem",
  content: [{ type: "paragraph", content: [txt(text)] }],
});
const bullets = (...texts: string[]): Block => ({ type: "bulletList", content: texts.map(item) });
const TICKET_DOC: Doc = {
  type: "doc",
  content: [
    h2("目的"),
    para(txt("セイコー商事に 11 月分の請求を間違いなく届ける。")),
    h2("完了の条件"),
    bullets("請求書が送られ、宛先が登録した連絡先と合っている", "支払期日が 12/15 になっている"),
    h2("実施事項"),
    bullets(
      "セイコー商事の 11 月分の明細を集める",
      "請求書を作って佐藤さんに確かめてもらう",
      "送ったあとに入金の予定日を控える",
    ),
    h2("前提と制約"),
    para(
      { type: "text", text: "支払期日は 12/15", marks: [{ type: "bold" }] },
      txt("。月末の締めを過ぎると翌月分になるので、今週中に送る。"),
    ),
    h2("参考"),
    { type: "blockquote", content: [para(txt("先月と同じ書式でお願いします（セイコー商事・経理）"))] },
  ],
};

const TITLE = "セイコー商事の 11 月分の請求書を送る";
const NUMBER = "EG-119";
const TAKA: Person = { name: "高本 聖斗", initial: "高", tone: "lavender" };
const SATO: Person = { name: "佐藤 花子", initial: "佐", tone: "teal" };
// やり取りの AI の行は作者の無い行なので名前も顔も「AI」（本番と同じ・K-702）
const AI: Person = AI_PERSON;

const MUST: readonly GuardPage[] = [
  { id: "p-invoice", title: "請求書の送り方", place: "会社 › 経理" },
  { id: "p-mail", title: "メールの書き方", place: "会社" },
  { id: "p-outbound", title: "外に出す前の確かめ", place: "会社" },
];
const OPENED: readonly GuardPage[] = [
  { id: "p-seiko", title: "セイコー商事との決めごと", place: "グループ：営業" },
  { id: "p-price", title: "単価の表", place: "会社 › 経理" },
];

const SPECS: readonly SpecRow[] = [
  {
    id: "s1",
    text: "宛先が、登録してある経理の連絡先と合っている",
    done: true,
    from: "請求書の送り方",
    by: "高本のAI 11/21 09:12",
  },
  {
    id: "s2",
    text: "金額が、見積もりか契約の額と合っている",
    done: true,
    from: "請求書の送り方",
    by: "高本のAI 11/21 09:12",
  },
  {
    id: "s3",
    text: "件名に【請求書】と月が入っている",
    done: true,
    from: "メールの書き方",
    by: "高本のAI 11/21 09:12",
  },
  { id: "s4", text: "外に出す前に、人が中身を見た", done: false, from: "外に出す前の確かめ" },
  { id: "s5", text: "先月と同じ書式になっている", done: false },
];

function Meta() {
  return (
    <div className="k-detail-meta">
      <span data-part="kind" className="k-detail-kind" data-tone="primary">
        請求
      </span>
      <span data-part="number" className="k-detail-number">
        {NUMBER}
      </span>
      <span data-part="created" className="k-detail-created">
        作成 11/20 09:40
      </span>
      <span className="k-detail-meta-side">
        <span data-part="start">
          開始日 <b>11/20</b>
        </span>
        <span data-part="due">
          期限 <b>11/27</b>
        </span>
        <span className="k-badge" data-tone="progress">
          作業中
        </span>
      </span>
    </div>
  );
}

function Fields({ rows }: { rows: readonly [string, string][] }) {
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

function PanelTabs({ active }: { active: "items" | "talk" }) {
  return (
    <nav aria-label="パネルのタブ" className="k-detail-tabs">
      <button type="button" aria-current={active === "items" ? "page" : undefined}>
        項目
      </button>
      <button type="button" aria-current={active === "talk" ? "page" : undefined}>
        やり取り
      </button>
      <button type="button" aria-disabled="true" tabIndex={-1} title="まだ使えません">
        <Bot size={14} aria-hidden="true" />
        高本のAI
      </button>
    </nav>
  );
}

function ItemsBody() {
  return (
    <div className="k-detail-panel-body">
      <section aria-label="担当" className="k-detail-panel-sec">
        <h2>担当</h2>
        <Fields
          rows={[
            ["担当者", "高本 聖斗"],
            ["承認する人", "佐藤 花子"],
          ]}
        />
      </section>
      <section aria-label="日付と時間" className="k-detail-panel-sec">
        <h2>日付と時間</h2>
        <Fields
          rows={[
            ["開始日", "11/20（金）"],
            ["期限", "11/27（金）"],
          ]}
        />
      </section>
      <SpecList rows={SPECS} />
    </div>
  );
}

function TalkBody({ later }: { later: boolean }) {
  return (
    <div className="k-talk">
      <ThreadFilters active="all" />
      <div className="k-talk-thread" role="feed" aria-label="やり取り">
        <div className="k-talk-day">11/21（土）</div>
        <Line
          who={TAKA}
          text={
            <>
              <b>高本</b> が AI に任せた
            </>
          }
          time="09:00"
        />
        {later ? (
          <Line who={AI} text={<GuardLineText must={MUST} opened={OPENED} />} time="09:00" />
        ) : (
          <GuardPost time="09:00" must={MUST} opened={OPENED} />
        )}
        {later ? (
          <>
            <Line
              who={AI}
              text={<OpenedText ai={AI.name} title="セイコー商事との決めごと" place="グループ：営業" />}
              time="09:01"
            />
            <Line who={AI} text={<OpenedText ai={AI.name} title="単価の表" place="会社 › 経理" />} time="09:02" />
            <RunCard
              title={
                <>
                  <b>高本のAI</b> が請求書を作り、確認を流した
                </>
              }
              meta="09:00 → 09:12 ・ 12 分"
              result="通った"
            />
            <Line
              who={AI}
              text={
                <>
                  <b>高本のAI</b> が確認項目 3 つにチェックを付けた
                </>
              }
              time="09:12"
            />
            <Line
              who={AI}
              text={<BreachText kind="ai_self_reported" title="メールの書き方" note="件名に【請求書】が無い" />}
              time="09:12"
            />
            <Post
              post={{
                id: "m1",
                who: SATO,
                time: "09:30",
                body: "金額を確認しました。送って大丈夫です",
                notified: "高本",
                menu: "none",
              }}
            />
          </>
        ) : null}
      </div>
      <Composer notify={["佐藤"]} />
    </div>
  );
}

function Detail({
  theme,
  tab,
  later = false,
  dialog,
}: {
  theme: Theme;
  tab: "items" | "talk";
  later?: boolean;
  dialog?: ReactNode;
}) {
  return (
    <Frame
      theme={theme}
      viewer="taka"
      screen="tickets"
      crumbs={[{ label: "チケット", href: "/tickets" }, { label: NUMBER }]}
      dialog={dialog}
    >
      <div className="k-detail">
        <section className="k-root k-page" aria-labelledby="ticket-title">
          <article className="k-detail-card">
            <Meta />
            <header className="k-page-head">
              <div className="k-detail-title">
                <h1 id="ticket-title" title={TITLE}>
                  {TITLE}
                </h1>
              </div>
              <div className="k-page-acts">
                <InertButton>複製</InertButton>
                <InertButton>版と差分</InertButton>
                <Button variant="outlined">完了にする</Button>
              </div>
            </header>
            <div className="k-detail-doc">
              <DocView doc={TICKET_DOC} />
            </div>
          </article>
        </section>
        <aside aria-label="チケットのパネル" className="k-detail-panel">
          <button type="button" className="k-detail-panel-close" aria-label="パネルを閉じる" title="パネルを閉じる">
            <PanelRight size={16} aria-hidden="true" />
          </button>
          <PanelTabs active={tab} />
          {tab === "talk" ? <TalkBody later={later} /> : <ItemsBody />}
        </aside>
      </div>
    </Frame>
  );
}

export function renderTicket(id: string, theme: Theme): ReactNode | null {
  switch (id) {
    case "tk-guard":
      return <Detail theme={theme} tab="talk" />;
    case "tk-opened":
      return <Detail theme={theme} tab="talk" later />;
    case "tk-blocked":
      return (
        <Detail
          theme={theme}
          tab="items"
          dialog={<CompleteBlockedDialog target={`${NUMBER} ${TITLE}`} left={SPECS.filter((s) => !s.done)} />}
        />
      );
    default:
      return null;
  }
}
