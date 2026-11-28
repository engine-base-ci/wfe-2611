"use client";
// 段 8（F7）の下絵のモック：保存した検索条件・絞る（saved）と、片付ける：期限（due）の状態（部品先行・枝 c/段8）。
//   本番と同じ部品（features/F7/saved・features/F7/due・features/F4/ticket-list・features/F4/create-ticket・components/k）を決めた値で並べる。1 つの id ＝ 1 つの状態。
//   前からの一覧・詳細の部品（list-table・list-filter・list-side・list-views・detail-head）は直さず、そのまま使う（本番では葉が差し替える）。
//   見本の人・チケットはキャンバス（Main・List・LsSave・TdDue）の顔ぶれ。日付は物語の今日（11/02）に固定（時計は読まない）
import { Flame } from "lucide-react";
import type { ReactNode } from "react";
import { Button, DocTools, Prose, Shell, Toaster, type Crumb } from "@/components/k";
import { errorText } from "@/components/k/error-of";
import { DetailTitle, InertButton } from "@/features/F4/create-ticket/detail-head";
import "@/features/F4/create-ticket/ticket-detail.css";
import { ListSearch } from "@/features/F4/ticket-list/list-filter";
import { MainSide } from "@/features/F4/ticket-list/list-side";
import { ListTable } from "@/features/F4/ticket-list/list-table";
import { ListViews } from "@/features/F4/ticket-list/list-views";
import "@/features/F4/ticket-list/ticket-list.css";
import {
  DueMark,
  DuePopover,
  LateMark,
  MineChips,
  NumberCards,
  StuckMark,
  StuckUpButton,
} from "@/features/F7/due/views";
import {
  ConditionBuilder,
  MineViewSettings,
  SaveViewDialog,
  SavedViewNav,
  ViewSettings,
} from "@/features/F7/saved/views";
import {
  APPROVALS,
  CARDS,
  CHIPS,
  COLUMNS,
  COND_ITEMS,
  DUE_BASE,
  GROUPS,
  GROUP_ROWS,
  NOOP,
  OVERDUE_ROWS,
  SECTIONS,
  VIEW_COLUMNS,
  check,
} from "@/features/F7/saved/sample";
import type { Theme } from "@/lib/theme";
import type { MockEntry } from "../types";

// ---------------------------------------------------------------- 断りの字（正本の文）
//   E-VWS-005 と期限の断りの 2 つ（理由が空・同時に変えられた）は errors.json にまだ無い（K-475・K-483 が errors.d に足す）ので、md に書かれた字をそのまま置く。
//   足されたら errorText(番号) に置き換える。E-VAL-012・E-PAGE-007 は今の正本から引く
const TEXT_VWS_005 = "同じ名前の保存した条件が、もうあります。別の名前にしてください";
const TEXT_DUE_001 = "期限を変える理由を書いてください";
const TEXT_DUE_008 = "ほかの人が先に期限を変えました。開き直してから、もう一度変えてください";

// ---------------------------------------------------------------- 画面の組み立て
function Frame({
  theme,
  crumbs,
  children,
  dialog,
}: {
  theme: Theme;
  crumbs: Crumb[];
  children: ReactNode;
  dialog?: ReactNode;
}) {
  return (
    <Toaster>
      <Shell
        role="R1"
        screen="tickets"
        crumbs={crumbs}
        workspace={{ name: "ENGINE BASE", initial: "E" }}
        member={{ name: "高本", initial: "高" }}
        groups={GROUPS}
        badges={{ approvals: 2 }}
        notices={3}
        bridgeConnected
        theme={theme}
        onCreate={NOOP}
      >
        {children}
      </Shell>
      {dialog}
    </Toaster>
  );
}

const MINE_CRUMBS: Crumb[] = [{ label: "チケット", href: "/tickets" }, { label: "自分に関わるもの" }];
const ALL_CRUMBS: Crumb[] = [{ label: "営業", href: "/tickets?scope=eg" }, { label: "一覧" }];

/** 見出しの帯（今の list-page.tsx の ListHead と同じクラスと並び） */
function PageHead({ scoped }: { scoped: boolean }) {
  return (
    <header className="k-page-head k-list-head">
      <div className="k-list-head-row">
        {scoped ? (
          <span className="k-list-scope-mark" data-tone="teal" aria-hidden="true">
            EG
          </span>
        ) : null}
        <h1 id="tickets-title">{scoped ? "営業" : "チケット"}</h1>
        <span className="k-list-dim">{scoped ? "（EG）" : "すべてのグループ"}</span>
      </div>
      <ListViews view={scoped ? "all" : "mine"} />
    </header>
  );
}

/** 表の箱の頭の「表示設定」。箱（settings）を開いたまま見せるときは、すぐ下に重ねる */
function SettingsButton({ label, settings }: { label: string; settings?: ReactNode }) {
  return (
    <span className="k-f7-saved-anchor">
      <button type="button" className="k-list-tool" aria-expanded={settings !== undefined}>
        {label}
      </button>
      {settings}
    </span>
  );
}

/** 一覧（グループ）の本文：検索条件の箱・（条件を組む）・表の上の道具・表 */
function AllPage({
  theme,
  dialog,
  before,
  middle,
  settings,
  crumbs = ALL_CRUMBS,
}: {
  theme: Theme;
  dialog?: ReactNode;
  before?: ReactNode;
  middle?: ReactNode;
  settings?: ReactNode;
  crumbs?: Crumb[];
}) {
  return (
    <Frame theme={theme} crumbs={crumbs} dialog={dialog}>
      <div className="k-root k-list-page">
        <PageHead scoped />
        <div className="k-list-body">
          <section className="k-list-main" aria-labelledby="tickets-title">
            {before}
            <ListSearch onQuery={NOOP} />
            {middle}
            <div className="k-list-panel">
              <div className="k-list-filter" role="group" aria-label="一覧の道具">
                {/* 件数は出さない（口が総数を返さない・D-144.3・K-478。本番の ListTools と同じ空の字）。ボタンの名前は前からの「表示設定」
                    （K-478「表示設定の箱は 1 つ・名前は前からのまま」）。幅 375 で道具が 1 行に収まり、箱の y が本番とそろう（2026-11-28） */}
                <span className="k-list-dim" data-value />
                <span className="k-list-tools">
                  <span className="k-list-tool" aria-disabled="true" title="まとめて操作（準備中）">
                    まとめて操作
                  </span>
                  <span className="k-list-tool" aria-disabled="true" title="CSV で取り込む（準備中）">
                    CSV で取り込む
                  </span>
                  <SettingsButton label="表示設定" {...(settings ? { settings } : {})} />
                </span>
              </div>
              <ListTable
                rows={GROUP_ROWS}
                columns={COLUMNS}
                sections={false}
                selectable
                hasMore={false}
                loadingMore={false}
                moreError={null}
                onMore={NOOP}
              />
            </div>
          </section>
        </div>
      </div>
    </Frame>
  );
}

/** 自分に関わるものの本文：数の札・絞りの行・表・右の列（キャンバス Main）。表は期限切れの 2 行（日付を時計から読まないため） */
function MinePage({
  theme,
  pressed = null,
  settings,
  note,
}: {
  theme: Theme;
  pressed?: string | null;
  settings?: ReactNode;
  note?: string;
}) {
  return (
    <Frame theme={theme} crumbs={MINE_CRUMBS}>
      <div className="k-root k-list-page">
        <PageHead scoped={false} />
        <div className="k-list-body">
          <section className="k-list-main" aria-labelledby="tickets-title">
            <NumberCards cards={CARDS} pressed={pressed} {...(note ? { pressedNote: note } : {})} />
            <div className="k-list-panel">
              <div className="k-list-filter" role="group" aria-label="自分に関わるものの絞り込み">
                {/* 件数は出さない（口が総数を返さない・D-144.3）。数の札を押している間は絞りの札「すべて」は外れる
                    （数の札と絞りの札は同時に 1 つ・本番の mine-focus.ts。2026-11-28 決める人 answer=8b228b743062） */}
                <b>自分に関わるもの</b>
                <MineChips chips={CHIPS} current={pressed ? "" : "all"} />
                <span className="k-list-tools">
                  <span className="k-list-off k-list-dim" aria-disabled="true" title="並び（準備中）">
                    並び：期限の近い順 ▾
                  </span>
                  <button type="button" className="k-list-tool">
                    条件を保存
                  </button>
                  <SettingsButton label="表示設定" {...(settings ? { settings } : {})} />
                </span>
              </div>
              <ListTable
                rows={OVERDUE_ROWS}
                columns={COLUMNS}
                sections
                hasMore={false}
                loadingMore={false}
                moreError={null}
                onMore={NOOP}
              />
            </div>
          </section>
          <MainSide name="高本" approvals={APPROVALS} />
        </div>
      </div>
    </Frame>
  );
}

// ---- 詳細（キャンバス TicketDetail・TdDue）：頭・本文・右のパネル。期限の行だけ F7 の部品

function DetailPage({
  theme,
  stage,
  dueBox,
  band,
}: {
  theme: Theme;
  stage: { key: string; name: string };
  dueBox?: ReactNode;
  band?: ReactNode;
}) {
  const fields: [string, ReactNode][] = [
    [
      "担当者",
      <span key="who" className="k-detail-who">
        <span className="k-detail-avatar" aria-hidden="true">
          高
        </span>
        高本 聖斗
      </span>,
    ],
    ["種別", "タスク"],
    ["承認する人", "高本"],
  ];
  return (
    <Frame theme={theme} crumbs={[{ label: "チケット", href: "/tickets" }, { label: "EG-128" }]}>
      <div className="k-detail">
        <section className="k-root k-page" aria-labelledby="ticket-title">
          <article className="k-detail-card">
            <div className="k-detail-meta">
              <span data-part="kind" className="k-detail-kind" data-tone="teal">
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
                  期限 <b data-over>11/01（1 日過ぎ）</b>
                </span>
                <span data-part="stage" className="k-detail-stage" data-stage={stage.key}>
                  {stage.name}
                </span>
              </span>
            </div>
            <DetailTitle title="セイコー様へ 11月分の請求書を送る" me="高本" />
            {band ? <div className="k-detail-bands">{band}</div> : null}
            <DocTools label="本文の道具" note="「/」で部品を入れる ・ 本文の版 1">
              <InertButton size="sm" className="k-detail-versions">
                版と差分
              </InertButton>
            </DocTools>
            <div className="k-detail-doc">
              {SECTIONS.map((s) => (
                <section key={s.key} className="k-section" aria-label={s.label}>
                  <h2 id={`sec-${s.key}`}>{s.label}</h2>
                  <Prose>{s.text}</Prose>
                </section>
              ))}
            </div>
          </article>
        </section>
        <aside aria-label="チケットのパネル" className="k-detail-panel">
          <nav aria-label="パネルのタブ" className="k-detail-tabs">
            <button type="button" aria-current="page">
              属性
            </button>
          </nav>
          <div className="k-detail-panel-body">
            <section aria-label="担当" className="k-detail-panel-sec">
              <h2>担当</h2>
              <dl className="k-detail-fields">
                {fields.map(([k, v]) => (
                  <div key={k} className="k-detail-field">
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section aria-label="日付と時間" className="k-detail-panel-sec k-f7-due-anchor">
              <h2>日付と時間</h2>
              <dl className="k-detail-fields">
                <div className="k-detail-field">
                  <dt>開始日</dt>
                  <dd>10/30（金）</dd>
                </div>
                <div className="k-detail-field">
                  <dt>期限</dt>
                  <dd data-over>
                    11/01（日）1 日過ぎ
                    <LateMark />
                    <Button
                      variant="outlined"
                      size="sm"
                      className="k-detail-due-btn"
                      aria-label="期限を変える"
                      aria-haspopup="dialog"
                      aria-expanded={dueBox !== undefined}
                    >
                      ▾
                    </Button>
                  </dd>
                </div>
              </dl>
              {dueBox}
            </section>
          </div>
        </aside>
      </div>
    </Frame>
  );
}

// ---- 印の並び（案）：一覧の行・詳細の頭・数の札・カレンダーとガントの小さな印
function MarksBoard() {
  const sample = [
    { n: "EG-128", t: "セイコー様へ 11月分の請求書を送る", due: "11/01", mark: <DueMark kind="late" />, late: true },
    {
      n: "EG-127",
      t: "発注ナビ 新着案件に応募文を出す",
      due: "11/04",
      mark: <DueMark kind="soon" label="あと 2 日" />,
    },
    {
      n: "EG-118",
      t: "発注ナビ 10月の応募結果をまとめる",
      due: "11/09",
      mark: <StuckMark reason="保留が 7 日続いています" />,
    },
  ];
  return (
    <>
      <section className="k-list-panel" aria-label="一覧の行">
        <div className="k-list-filter">
          <b>一覧の行</b>
        </div>
        <div className="k-list-scroll">
          <table className="k-list-table" aria-label="印の見本">
            <thead>
              <tr>
                <th scope="col">番号</th>
                <th scope="col">題名</th>
                <th scope="col">期限</th>
                <th scope="col">印</th>
              </tr>
            </thead>
            <tbody>
              {sample.map((s) => (
                <tr key={s.n}>
                  <td>
                    <a className="k-list-link k-list-number" href="#ticket">
                      {s.n}
                    </a>
                  </td>
                  <td className="k-list-title-cell">
                    <a className="k-list-link" href="#ticket">
                      {s.t}
                    </a>
                  </td>
                  <td data-late={s.late || undefined}>{s.due}</td>
                  <td>{s.mark}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="k-list-panel" aria-label="詳細の頭">
        <div className="k-list-filter">
          <b>詳細の頭</b>
          <span className="k-f7-due-samples">
            <span>
              期限 <b className="k-f7-due-over">11/01（1 日過ぎ）</b>
            </span>
            <DueMark kind="late" />
            <span>
              期限 11/04 <DueMark kind="soon" label="あと 2 日" />
            </span>
            <StuckMark />
          </span>
        </div>
      </section>
      <NumberCards
        cards={[
          { key: "overdue", label: "期限切れ", value: 2, tone: "danger", icon: <Flame size={12} aria-hidden="true" /> },
          { key: "today", label: "今日まで", value: 3, tone: "neutral" },
          { key: "approve", label: "自分が承認", value: 2, tone: "warning" },
          { key: "ai", label: "AI が動いている", value: 3, tone: "neutral" },
        ]}
      />
      <section className="k-list-panel" aria-label="カレンダーとガント">
        <div className="k-list-filter">
          <b>カレンダー・ガント</b>
          <span className="k-f7-due-samples">
            <span className="k-f7-due-sample">
              EG-128 請求書 <LateMark />
            </span>
            <span className="k-f7-due-sample">
              EG-127 応募文 <DueMark kind="soon" label="あと 2 日" />
            </span>
            <span className="k-f7-due-sample">
              EG-118 応募結果 <StuckMark />
            </span>
          </span>
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------- 状態
export const SAVED_MOCKS: readonly MockEntry[] = [
  // 保存（K-479）
  {
    id: "f7-save-dialog",
    screen: "tickets",
    label: "検索条件を保存（名前・条件の要約・見える人・左のメニューに出す・知らせる）",
    ticket: "K-479",
    leaf: "K-479",
    widths: [375, 1440],
    render: (theme) => (
      <AllPage
        theme={theme}
        dialog={
          <SaveViewDialog
            open
            name="鈴木さん 今週の提案"
            conditions={[
              "担当者：鈴木",
              "期限：今週",
              "状態：完了でない",
              "分類：提案 または 題名に「見積」",
              "列：10 ・ 親子でまとめる",
            ]}
            share="self"
            groupName="営業"
          />
        }
      />
    ),
  },
  {
    id: "f7-save-error",
    screen: "tickets",
    label: "保存できない（同じ名前・口が断った。名前が空・上限も同じ形）",
    ticket: "K-479",
    leaf: "K-479",
    widths: [375, 1440],
    render: (theme) => (
      <AllPage
        theme={theme}
        dialog={
          <SaveViewDialog
            open
            name="鈴木さん 今週の提案"
            nameError={TEXT_VWS_005}
            notice={errorText("E-PAGE-007").title}
            conditions={["担当者：鈴木", "期限：今週", "状態：完了でない"]}
            share="group"
            groupName="営業"
          />
        }
      />
    ),
  },
  {
    id: "f7-saved-menu",
    screen: "shell",
    label: "保存した見え方が左のメニューのグループの下に並ぶ（開く・名前を直す・消す）",
    ticket: "K-479",
    leaf: "K-479",
    widths: [375, 1440],
    render: (theme) => (
      <AllPage
        theme={theme}
        crumbs={[{ label: "営業", href: "/tickets?scope=eg" }, { label: "鈴木さん 今週の提案" }]}
        before={
          <section className="k-f7-saved-navframe" aria-label="左のメニュー（拡大）">
            <p className="k-f7-saved-sub">左のメニュー</p>
            <SavedViewNav
              group={{ code: "EG", name: "営業", tone: "teal" }}
              openMenuOf="v1"
              views={[
                { id: "v1", name: "鈴木さん 今週の提案", shared: true, current: true, canEdit: true },
                { id: "v2", name: "期限が近い承認待ち", shared: false, canEdit: true },
                { id: "v3", name: "セイコー様まわり", shared: true, canEdit: false },
              ]}
            />
          </section>
        }
      />
    ),
  },
  // 絞る（K-478）
  {
    id: "f7-filter-advanced",
    screen: "tickets",
    label: "条件を組む（担当者が…かつ 期限が…・まとまり どれか 1 つ・ことばで探すは押せない形）",
    ticket: "K-478",
    leaf: "K-478",
    widths: [375, 1440],
    render: (theme) => (
      <AllPage
        theme={theme}
        middle={<ConditionBuilder aiSample="鈴木さん担当で今週期限の提案、終わってないもの" items={COND_ITEMS} />}
      />
    ),
  },
  {
    id: "f7-view-settings",
    screen: "tickets",
    label: "表示設定（列・1 行の高さ・まとめる・並べ方・グループの既定にする＝マネージャーだけ）",
    ticket: "K-478",
    leaf: "K-478",
    widths: [375, 1440],
    render: (theme) => (
      <AllPage
        theme={theme}
        settings={
          <ViewSettings
            columns={VIEW_COLUMNS}
            density="normal"
            groupBy="family"
            sort="更新が新しい順"
            asDefault={false}
            canSetDefault
          />
        }
      />
    ),
  },
  {
    id: "f7-mine-settings",
    screen: "tickets",
    label: "自分に関わるものの見え方（上の数字・右に出すもの・表の分け方・入れるもの）",
    ticket: "K-478",
    leaf: "K-478",
    widths: [1440],
    render: (theme) => (
      <MinePage
        theme={theme}
        settings={
          <MineViewSettings
            cards={[
              check("overdue", "期限切れ", true),
              check("today", "今日まで", true),
              check("approve", "自分が承認", true),
              check("ai", "AI が動いている", true),
              check("week", "今週まで", false),
            ]}
            side={[
              check("approvals", "自分の承認を待っているもの", true),
              check("ai-now", "高本のAI のいま", true),
              check("notices", "最近のお知らせ", true),
              check("moves", "自分が担当・承認するものの動き", false),
            ]}
            split="due"
            include={[
              check("mine", "担当しているもの", true),
              check("approve", "承認するもの・渡されたもの", true),
              check("both", "自分が担当・承認するもの", false),
            ]}
          />
        }
      />
    ),
  },
  // 片付ける（K-478・K-484）
  {
    id: "f7-tidy-marks",
    screen: "tickets",
    label: "印の並び：期限切れの炎・期限間近（案）・詰まり（案）を 一覧・詳細の頭・数の札・カレンダーとガントで",
    ticket: "K-478",
    leaf: "K-478",
    widths: [375, 1440],
    render: (theme) => (
      <Frame theme={theme} crumbs={MINE_CRUMBS}>
        <div className="k-root k-list-page">
          <PageHead scoped={false} />
          <div className="k-list-body">
            <section className="k-list-main" aria-labelledby="tickets-title">
              <MarksBoard />
            </section>
          </div>
        </div>
      </Frame>
    ),
  },
  {
    id: "f7-tidy-numbers",
    screen: "tickets",
    label: "数の札を押して絞った（期限切れ。もう一度押すと戻る）",
    ticket: "K-478",
    leaf: "K-478",
    widths: [1440],
    render: (theme) => (
      <MinePage theme={theme} pressed="overdue" note="期限切れで絞っています。もう一度押すと戻ります" />
    ),
  },
  {
    id: "f7-tidy-due",
    screen: "tickets",
    label: "期限を変える（今日・明日・今週の金曜・来週の月曜・月のカレンダー・時刻・理由・期限をなくす）",
    ticket: "K-484",
    leaf: "K-484",
    widths: [375, 1440],
    render: (theme) => (
      <DetailPage
        theme={theme}
        stage={{ key: "awaiting_approval", name: "承認待ち" }}
        dueBox={<DuePopover {...DUE_BASE} />}
      />
    ),
  },
  {
    id: "f7-tidy-due-error",
    screen: "tickets",
    label: "期限を変える：理由が空・過去日・同時に変えられた",
    ticket: "K-484",
    leaf: "K-484",
    widths: [375, 1440],
    render: (theme) => (
      <DetailPage
        theme={theme}
        stage={{ key: "doing", name: "作業中" }}
        dueBox={
          <DuePopover
            {...DUE_BASE}
            picked="2026-10-30"
            reason=""
            dateError={errorText("E-VAL-012").entry.message}
            reasonError={TEXT_DUE_001}
            notice={TEXT_DUE_008}
          />
        }
      />
    ),
  },
  {
    id: "f7-tidy-stuck-up",
    screen: "tickets",
    label: "「詰まっています」と手で上げる（押せない形）",
    ticket: "K-478",
    leaf: "K-478",
    widths: [375, 1440],
    render: (theme) => (
      <DetailPage
        theme={theme}
        stage={{ key: "doing", name: "作業中" }}
        band={
          <div className="k-f7-due-stuckup">
            <StuckUpButton />
          </div>
        }
      />
    ),
  },
];
