"use client";
// 問い合わせの受信箱（段 13・領域 ops2・キャンバス OpInbox）。値を受け取って描くだけ（口は呼ばない）。
//   値と押したときの関数を渡さない呼び方（モック）は下絵の値のまま描く（K-942）。本番（K-976）は任意の props で値と関数を渡す
import type { ReactNode } from "react";
import { Button, Callout, Empty, PageBody, PageHeader, Select, TextArea } from "@/components/k";
import { Card, Chip, Facts, Note, StatusBadge } from "@/features/F12/ops/ops-parts";
import { INBOX_ROWS, type InboxRow } from "./ops2-sample";
import "@/features/F12/ops/ops.css";
import "./ops2.css";

/** 箱と種類の札 1 つ（数は無ければ出さない） */
export interface InboxChip {
  label: string;
  count?: number;
  on: boolean;
  onClick?: () => void;
}

const BOXES: readonly InboxChip[] = (
  [
    ["まだ誰も持っていない", 2],
    ["自分", 3],
    ["返事待ち", 4],
    ["後で", 1],
    ["済み", 0],
  ] as const
).map(([label, n]) => ({ label, on: label === "自分", ...(n > 0 ? { count: n } : {}) }));
const KINDS: readonly InboxChip[] = ["すべて", "使い方", "うまく動かない", "お金・プラン", "ほか"].map((label) => ({
  label,
  on: label === "すべて",
}));
const STATE_TONE = { 進行中: "progress", 返事待ち: "warning", 後で: "neutral", 済み: "success" } as const;
const PC_TONE: Record<string, "success" | "warning" | "neutral"> = {
  つながっている: "success",
  切れている: "warning",
  まだつないでいない: "neutral",
};

function ChipRow({ label, chips, named }: { label: string; chips: readonly InboxChip[]; named?: boolean }) {
  return (
    <div className="k-op-chips" role="group" aria-label={label}>
      {named ? <span className="k-op-chips-label">{label}</span> : null}
      {chips.map((c) => (
        <Chip
          key={c.label}
          on={c.on}
          {...(c.count !== undefined ? { count: c.count } : {})}
          {...(c.onClick ? { onClick: c.onClick } : {})}
        >
          {c.label}
        </Chip>
      ))}
    </div>
  );
}

function InboxList({
  rows,
  current,
  label,
  onRow,
}: {
  rows: readonly InboxRow[];
  current?: string;
  label: string;
  onRow?: (id: string) => void;
}) {
  return (
    <section aria-label="問い合わせの一覧">
      <div className="k-oq-sub">
        <b>
          {label} ・ {rows.length}
        </b>
        <span>新しい順</span>
      </div>
      <ul className="k-oq-list">
        {rows.map((r) => (
          <li
            key={r.id}
            {...(r.id === current ? { "aria-current": "true" as const } : {})}
            {...(onRow
              ? {
                  tabIndex: 0,
                  onClick: () => onRow(r.id),
                  onKeyDown: (e: { key: string; preventDefault: () => void }) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    onRow(r.id);
                  },
                }
              : {})}
          >
            <b>{r.title}</b>
            <span>
              {r.who} ・ {r.ws} ・ {r.at}
            </span>
            <span>
              <StatusBadge tone="neutral">{r.kind}</StatusBadge>
              <StatusBadge tone={STATE_TONE[r.state]}>{r.state}</StatusBadge>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 右の様子の値（プラン・PC・止まった実行・請求の 4 行） */
export interface InboxSide {
  title: string;
  aside: string;
  rows: readonly (readonly [string, string])[];
  /** 1 社の画面 */
  href: string;
}
const SIDE_SAMPLE: InboxSide = {
  title: "合同会社ミナト企画",
  aside: "チーム ・ 8 人",
  rows: [
    ["プラン", "チーム ・ 8 人"],
    ["この人の PC", "つながっている"],
    ["止まった実行（7 日）", "3 件"],
    ["請求", "期限を過ぎた請求なし"],
  ],
  href: "/dev/mock/f12-ops/op-ws",
};

/** 右：問い合わせてきたワークスペースの様子（数と種類だけ） */
function WsSide({ side }: { side: InboxSide }) {
  return (
    <div className="k-ops2-side">
      <Card title={side.title} aside={side.aside}>
        <Facts
          rows={side.rows.map(([k, v]) =>
            k === "この人の PC"
              ? ([
                  k,
                  <StatusBadge key="pc" tone={PC_TONE[v] ?? "neutral"}>
                    {v}
                  </StatusBadge>,
                ] as const)
              : ([k, v] as const),
          )}
        />
        <div className="k-oq-acts">
          <a className="k-btn" data-variant="outlined" data-size="sm" href={side.href}>
            1 社を開く
          </a>
          <Button size="sm" variant="outlined" aria-disabled="true" tabIndex={-1} title="まだ使えません">
            中を見る
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Msg({ head, children, memo }: { head: string; children: string; memo?: boolean }) {
  return (
    <article className="k-oq-msg" {...(memo ? { "data-kind": "memo" } : {})}>
      <div className="k-oq-msg-head">
        <b>{head}</b>
        {memo ? <StatusBadge tone="warning">社内メモ ・ 先方には見えない</StatusBadge> : null}
      </div>
      <p>{children}</p>
    </article>
  );
}

/** 開いた 1 件の値と押したときの関数（本番）。渡さなければ下絵の値 */
export interface InboxThread {
  title: string;
  sub: string;
  /** 担当の字（「高本（自分）」・「佐野」・「なし」） */
  owner: string;
  /** 担当が誰か：自分・ほかの人・なし */
  holder: "me" | "other" | "none";
  /** ほかの人が担当のときの知らせの見出し（「佐野 さんが担当になりました」など）と本文 */
  takenTitle?: string;
  takenBody?: string;
  messages: readonly { head: string; body: string; memo: boolean }[];
  /** 付いてきた情報の 1 行 */
  context: string | null;
  /** 返事の欄の値 */
  reply: string;
  onReply?: (v: string) => void;
  /** 送っている間（2 回目を送らない） */
  busy?: boolean;
  /** 送れなかった・後でにできなかった（赤い箱） */
  error?: string | null;
  onTake?: () => void;
  onRelease?: () => void;
  onDone?: () => void;
  onLater?: (choice: "tomorrow" | "week" | "none") => void;
  onSend?: () => void;
  onNote?: () => void;
}

const REPLY =
  "湊さま　お問い合わせありがとうございます。実行の記録を確かめたところ、預けている Gmail のログイン情報（GMAIL_WORK）の期限が切れて止まっていました。右上の顔 › 自分の設定 › 預けたログイン情報 から「預け直す」をお願いします。預け直すと、実行待ちのものがすぐ動きます。";

const sampleThread = (taken: boolean): InboxThread => ({
  title: "承認したのに動かない",
  sub: "湊 さくら ・ 合同会社ミナト企画 ・ 11/02 09:40",
  owner: taken ? "佐野" : "高本（自分）",
  holder: taken ? "other" : "me",
  ...(taken
    ? {
        takenTitle: "佐野 さんが担当になりました",
        takenBody:
          "担当を取った人だけが返せます。あなたは見るだけです。担当を替えてもらうか、佐野 さんに声をかけてください",
      }
    : {}),
  messages: [
    {
      head: "湊 さくら ・ 09:40",
      body: "請求書を送るチケット（KN-212）を承認したのですが、30 分たっても「実行待ち」のままです。PC はつけています。",
      memo: false,
    },
    {
      head: "高本（運営） ・ 09:58",
      body: "中を見る（見るだけ）で実行の記録を確認。GMAIL_WORK の期限切れで止まっている。本人に預け直してもらえば動く",
      memo: true,
    },
  ],
  context: "付いてきた情報：画面 チケット KN-212 ・ Chrome 130 ・ PC つながっている",
  reply: taken ? "" : REPLY,
});

/** 押せない形（aria-disabled・押しても関数を呼ばない） */
const off = { "aria-disabled": true, tabIndex: -1 } as const;
const press = (on: boolean, fn?: () => void) => (on ? off : fn ? { onClick: fn } : {});

/** 1 件を開いた：やり取り・返す・社内メモ・担当・後で・済みにする。ほかの人が担当なら見るだけ（社内メモは書ける） */
function ThreadPane({ v, live }: { v: InboxThread; live: boolean }) {
  const taken = v.holder === "other";
  const busy = v.busy ?? false;
  const [first, ...rest] = v.messages;
  return (
    <section className="k-oq-thread" aria-label={v.title}>
      <div className="k-oq-bar">
        <div>
          <b>{v.title}</b>
          <div className="k-oq-sub">{v.sub}</div>
        </div>
        <div className="k-oq-acts">
          <span className="k-oq-sub">担当 {v.owner}</span>
          {v.holder === "me" ? (
            <Button variant="outlined" {...press(busy, v.onRelease)}>
              外す
            </Button>
          ) : (
            <Button
              variant="outlined"
              {...press(taken || busy, v.onTake)}
              {...(taken ? { title: "ほかの人が担当しています" } : {})}
            >
              自分が持つ
            </Button>
          )}
          <Select
            label="後で"
            name="later"
            {...(live ? { value: "none" } : { defaultValue: "none" })}
            {...(v.onLater
              ? {
                  onValueChange: (c: string | null) => {
                    if (c === "tomorrow" || c === "week" || c === "none") v.onLater?.(c);
                  },
                }
              : {})}
            disabled={taken || busy}
            options={[
              { value: "none", label: "いつにするか選ぶ" },
              { value: "tomorrow", label: "明日の朝" },
              { value: "week", label: "来週" },
            ]}
          />
          <Button variant="outlined" {...press(taken || busy, v.onDone)}>
            済みにする
          </Button>
        </div>
      </div>
      {taken && v.takenTitle ? (
        <Callout tone="info" title={v.takenTitle}>
          {v.takenBody ?? ""}
        </Callout>
      ) : null}
      {first ? (
        <Msg head={first.head} memo={first.memo}>
          {first.body}
        </Msg>
      ) : null}
      {v.context ? <Note>{v.context}</Note> : null}
      {rest.map((m, i) => (
        <Msg key={i} head={m.head} memo={m.memo}>
          {m.body}
        </Msg>
      ))}
      {v.error ? (
        <Callout tone="danger" title={v.error}>
          {""}
        </Callout>
      ) : null}
      <div className="k-op-form">
        <TextArea
          label={taken ? "返事（返すのは担当の人だけ・社内メモは書けます）" : "返事"}
          name="reply"
          rows={5}
          {...(live
            ? { value: v.reply, onChange: (e: { target: { value: string } }) => v.onReply?.(e.target.value) }
            : { readOnly: true, defaultValue: v.reply })}
        />
        <div className="k-oq-end">
          <Button variant="outlined" {...press(busy, v.onNote)}>
            社内メモにする
          </Button>
          <Button {...press(taken || busy, v.onSend)}>返す</Button>
        </div>
        <Note>返すと「返事待ち」になります。返事は顧客の「困ったとき・お知らせ」と画面のお知らせに届く</Note>
      </div>
    </section>
  );
}

export interface InboxPageProps {
  /** 1 件を開いた形 */
  open?: boolean;
  /** 箱が空 */
  empty?: boolean;
  /** ほかの人が担当になった（見るだけ） */
  taken?: boolean;
  /** ここから下は本番（K-976）が渡す。渡さなければ下絵の値 */
  sub?: string;
  boxes?: readonly InboxChip[];
  topics?: readonly InboxChip[];
  rows?: readonly InboxRow[];
  /** 一覧の頭の字（押した箱の名前） */
  listLabel?: string;
  current?: string;
  onRow?: (id: string) => void;
  /** 開いた 1 件の値 */
  thread?: InboxThread;
  /** 1 件の代わりに出す物（見つからない・読めない） */
  threadState?: ReactNode;
  side?: InboxSide | null;
}

/** 問い合わせ：5 つの箱・種類・新しい順・右にそのワークスペースの様子 */
export function InboxPage({
  open = false,
  empty = false,
  taken = false,
  sub = "顧客から届いた問い合わせ ・ 自分の担当 3 件",
  boxes,
  topics = KINDS,
  rows = INBOX_ROWS,
  listLabel = "自分",
  current,
  onRow,
  thread,
  threadState,
  side,
}: InboxPageProps) {
  const live = thread !== undefined || boxes !== undefined;
  const opened = live ? thread !== undefined || threadState !== undefined : open;
  const mockBoxes = empty ? BOXES.map((b) => ({ ...b, on: b.label === "後で" })) : BOXES;
  const sideValue = side === undefined ? (live ? null : SIDE_SAMPLE) : side;
  return (
    <PageBody labelledBy="oq-inbox-title">
      <PageHeader id="oq-inbox-title" title="問い合わせ" sub={sub} />
      <div className="k-op-body">
        <div className="k-op-tools">
          <ChipRow label="箱" chips={boxes ?? mockBoxes} />
          <ChipRow label="種類" chips={topics} named />
        </div>
        {empty ? (
          <Empty title="この箱に問い合わせはありません">
            新しい問い合わせが届くと「まだ誰も持っていない」に入ります。担当を取ると「自分」に移ります
          </Empty>
        ) : (
          <div className="k-oq-inbox" {...(opened ? { "data-open": "" } : {})}>
            <InboxList
              rows={rows}
              label={listLabel}
              {...(live ? (current ? { current } : {}) : open ? { current: "i1" } : {})}
              {...(onRow ? { onRow } : {})}
            />
            {thread ? <ThreadPane v={thread} live={live} /> : null}
            {!thread && threadState ? threadState : null}
            {!live && open ? <ThreadPane v={sampleThread(taken)} live={false} /> : null}
            {sideValue ? <WsSide side={sideValue} /> : null}
          </div>
        )}
      </div>
    </PageBody>
  );
}
