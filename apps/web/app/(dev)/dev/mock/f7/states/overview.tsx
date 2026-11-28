"use client";
// 段 8（F7）の見え方の状態（部品先行・枝 c/段8）：自分に関わるもの・概要・カレンダー・ガント・保留の出し方。
//   本番と同じ部品（features/F7/overview・calendar・gantt と、前からの features/F4/ticket-list・components/k）を、作り物の値で並べるだけ。
//   値はキャンバス（Main・MobileList・Overview・Calendar・CalDay・Gantt・GtMove・GtNoDate）の字と数のとおり。曜日は暦に合わせて直した（2026-11-02＝月曜）。
//   自分に関わるものの表の日付は「今日」からの差で作る（表の区切り：期限切れ・今日まで・今週・来週以降は今の日付で決まるため）。
//   概要は契約どおり（P5）：「残りの量」「分類ごと」は空の枠のグレー・節目は 0 件。ガントの節目の旗は部品の見本として 2 つ置く
import type { ReactNode } from "react";
import { Toaster, Shell, type Crumb, type Group } from "@/components/k";
import { MineChips, NumberCards, type MineChip } from "@/features/F7/due/views";
import { CARDS, CHIPS } from "@/features/F7/saved/sample";
import { ColumnSettings, COLUMN_KEYS, type Columns } from "@/features/F4/ticket-list/list-columns";
import { MainSide } from "@/features/F4/ticket-list/list-side";
import { ListTable, mmdd } from "@/features/F4/ticket-list/list-table";
import type { Approvals, ListItem } from "@/features/F4/ticket-list/use-ticket-list";
import {
  CalendarGrid,
  DayDialog,
  NoDateTray,
  buildMonthCells,
  type CalItem,
  type DayItem,
} from "@/features/F7/calendar/views";
import { GanttChart, HoldHint, MoveImpactDialog, type GanttRow } from "@/features/F7/gantt/views";
import {
  MobileMineBody,
  OverviewPanels,
  ScopeHead,
  ViewEmpty,
  ViewTabs,
  type MobileSection,
  type OverviewPanelsProps,
  type ViewKey,
} from "@/features/F7/overview/views";
import type { Theme } from "@/lib/theme";
import type { MockEntry } from "../types";

// ---------------------------------------------------------------- 外枠
const MOCK = "/dev/mock/f7";
const HREFS: Partial<Record<ViewKey, string>> = {
  mine: `${MOCK}/f7-mine`,
  overview: `${MOCK}/f7-overview`,
  calendar: `${MOCK}/f7-calendar`,
  gantt: `${MOCK}/f7-gantt`,
};
const GROUPS: Group[] = [
  { code: "EG", name: "営業", count: 18, href: HREFS.overview ?? "#", tone: "teal" },
  { code: "JD", name: "受託開発", count: 42, href: HREFS.overview ?? "#", tone: "plum" },
  { code: "KR", name: "経理", count: 9, href: HREFS.overview ?? "#", tone: "amber" },
];
const MINE_CRUMBS: Crumb[] = [{ label: "チケット", href: "/tickets" }, { label: "自分に関わるもの" }];
const groupCrumbs = (last: string): Crumb[] => [{ label: "営業", href: HREFS.overview ?? "#" }, { label: last }];

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
      >
        {children}
      </Shell>
      {dialog}
    </Toaster>
  );
}

/** グループの見え方の頭（営業）：見出しは前からの一覧と同じ「営業（EG）」。メンバーの顔・人数は口に値が無いので出さない */
function GroupHead({ view }: { view: ViewKey }) {
  return (
    <ScopeHead
      title="営業"
      mark={{ code: "EG", tone: "teal" }}
      sub="（EG）"
      tabs={<ViewTabs current={view} hrefs={HREFS} />}
    />
  );
}

// ---------------------------------------------------------------- 自分に関わるもの（#12・#13）
const DAY_MS = 86_400_000;
const JST_MS = 9 * 3_600_000;
const ymd = (offset: number): string => new Date(Date.now() + JST_MS + offset * DAY_MS).toISOString().slice(0, 10);
const toSunday = (): number => (7 - new Date(Date.now() + JST_MS).getUTCDay()) % 7;
/** 今週の日（日曜までの間。今日が日曜なら今日） */
const thisWeek = (k: number): string => {
  const s = toSunday();
  return ymd(s === 0 ? 0 : Math.min(k, s));
};
/** 来週以降の日 */
const later = (k: number): string => ymd(toSunday() + k);
const ago = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

const STAGE_KEY: Record<string, string> = {
  承認待ち: "awaiting_approval",
  実行中: "running",
  確認中: "checking",
  作業中: "doing",
  未着手: "todo",
  渡し中: "handing",
  完了: "done",
};
function ticket(o: {
  number: string;
  title: string;
  kind: string;
  stage: string;
  who: string;
  ai?: boolean;
  due: string;
  late?: boolean;
  minutes: number;
}): ListItem {
  return {
    id: o.number,
    number: o.number,
    title: o.title,
    kind: { id: o.kind, name: o.kind },
    stage: { id: o.stage, name: o.stage, key: STAGE_KEY[o.stage] ?? null },
    assignee: { id: o.who, display_name: o.who },
    delegated_to_clone: o.ai ?? false,
    due_on: o.due,
    overdue: o.late ?? false,
    updated_at: ago(o.minutes),
  };
}
const SECTION_OVERDUE_TODAY = [
  ticket({
    number: "EG-128",
    title: "セイコー様へ 11月分の請求書を送る",
    kind: "タスク",
    stage: "承認待ち",
    who: "高本",
    ai: true,
    due: ymd(-1),
    late: true,
    minutes: 10,
  }),
  ticket({
    number: "JD-198",
    title: "京蟻 管理画面の表示崩れ（Safari）",
    kind: "課題",
    stage: "作業中",
    who: "高本",
    due: ymd(-2),
    late: true,
    minutes: 1440,
  }),
  ticket({
    number: "EG-127",
    title: "発注ナビ 新着案件に応募文を出す",
    kind: "タスク",
    stage: "実行中",
    who: "高本",
    ai: true,
    due: ymd(0),
    minutes: 3,
  }),
  ticket({
    number: "EG-121",
    title: "京蟻 見積の金額と単価の根拠を確認する",
    kind: "QA",
    stage: "確認中",
    who: "高本",
    ai: true,
    due: ymd(0),
    minutes: 60,
  }),
  ticket({
    number: "JD-204",
    title: "京蟻 追加開発の見積を出す",
    kind: "タスク",
    stage: "承認待ち",
    who: "佐藤",
    due: ymd(0),
    minutes: 120,
  }),
];
const SECTION_WEEK = [
  ticket({
    number: "EG-119",
    title: "問い合わせ（山田様）に一次返信する",
    kind: "タスク",
    stage: "渡し中",
    who: "佐藤",
    due: thisWeek(1),
    minutes: 1440,
  }),
  ticket({
    number: "JD-200",
    title: "受託開発 定例（議題・議事・決定）",
    kind: "会議",
    stage: "未着手",
    who: "高本",
    due: thisWeek(2),
    minutes: 2880,
  }),
  ticket({
    number: "KR-031",
    title: "入金の照合（10月分）",
    kind: "タスク",
    stage: "実行中",
    who: "高本",
    ai: true,
    due: thisWeek(3),
    minutes: 180,
  }),
  ticket({
    number: "JD-190",
    title: "【親】京蟻 v2.1 リリース",
    kind: "タスク",
    stage: "作業中",
    who: "高本",
    due: thisWeek(4),
    minutes: 240,
  }),
  ticket({
    number: "EG-110",
    title: "提案資料の事例を 3 件に差し替え",
    kind: "課題",
    stage: "未着手",
    who: "高本",
    due: thisWeek(5),
    minutes: 4320,
  }),
];
const SECTION_LATER = [
  ticket({
    number: "EG-131",
    title: "11月分 月次レポートを送る",
    kind: "タスク",
    stage: "未着手",
    who: "高本",
    ai: true,
    due: later(1),
    minutes: 5,
  }),
  ticket({
    number: "EG-124",
    title: "セイコー様 保守契約の更新",
    kind: "タスク",
    stage: "作業中",
    who: "高本",
    due: later(3),
    minutes: 300,
  }),
  ticket({
    number: "EG-140",
    title: "発注ナビ 応募の準備",
    kind: "タスク",
    stage: "未着手",
    who: "高本",
    due: later(5),
    minutes: 600,
  }),
  ticket({
    number: "KR-033",
    title: "11月分 請求書をまとめて出す",
    kind: "タスク",
    stage: "未着手",
    who: "高本",
    ai: true,
    due: later(14),
    minutes: 5,
  }),
];
const MINE_ROWS: ListItem[] = [...SECTION_OVERDUE_TODAY, ...SECTION_WEEK, ...SECTION_LATER];

const COLUMNS: Columns = { visible: [...COLUMN_KEYS], toggle: () => undefined, reset: () => undefined };
const APPROVALS: Approvals = {
  state: "ok",
  rows: [
    { id: "a1", ticket_id: "EG-128", ticket_number: "EG-128", title: "セイコー様へ 11月分の請求書を送る" },
    { id: "a2", ticket_id: "JD-204", ticket_number: "JD-204", title: "京蟻 追加開発の見積を出す（1,826,000 円）" },
  ],
};
const PHONE_CHIPS: MineChip[] = [
  { key: "all", label: "すべて", count: 14 },
  { key: "mine", label: "自分が担当", count: 11 },
  { key: "ai", label: "AI が動いている", count: 3 },
];

function MineDesktop({ theme }: { theme: Theme }) {
  return (
    <Frame theme={theme} crumbs={MINE_CRUMBS}>
      <div className="k-root k-list-page">
        <ScopeHead title="チケット" sub="すべてのグループ" tabs={<ViewTabs current="mine" hrefs={HREFS} />} />
        <div className="k-list-body">
          <section className="k-list-main" aria-labelledby="tickets-title">
            <NumberCards cards={CARDS} />
            <div className="k-list-panel">
              <div className="k-list-filter" role="group" aria-label="自分に関わるものの絞り込み">
                {/* 件数は出さない（口が総数を返さない・D-144.3。2026-11-28 PM の決めで下絵からも外した） */}
                <b>自分に関わるもの</b>
                <MineChips chips={CHIPS} current="all" />
                <span className="k-list-tools">
                  <button type="button" className="k-list-tool" aria-haspopup="menu">
                    並び：期限の近い順 ▾
                  </button>
                  <button type="button" className="k-list-tool">
                    条件を保存
                  </button>
                  <ColumnSettings columns={COLUMNS} title="自分に関わるものの見え方" />
                </span>
              </div>
              <ListTable
                rows={MINE_ROWS}
                columns={[...COLUMN_KEYS]}
                sections
                hasMore={false}
                loadingMore={false}
                moreError={null}
                onMore={() => undefined}
              />
            </div>
          </section>
          <MainSide name="高本" approvals={APPROVALS} />
        </div>
      </div>
    </Frame>
  );
}

const phoneRows = (rows: readonly ListItem[]) =>
  rows.map((r) => ({
    number: r.number,
    title: r.title,
    stage: r.stage?.name ?? "",
    who: r.delegated_to_clone ? `${r.assignee?.display_name ?? ""}のAI` : (r.assignee?.display_name ?? ""),
    due: mmdd(r.due_on),
    late: r.overdue,
  }));
const PHONE_SECTIONS: MobileSection[] = [
  { label: "期限切れ・今日", rows: phoneRows(SECTION_OVERDUE_TODAY) },
  { label: "今週", rows: phoneRows(SECTION_WEEK) },
  { label: "来週以降", rows: phoneRows(SECTION_LATER) },
];

function MinePhone({ theme }: { theme: Theme }) {
  return (
    <Frame theme={theme} crumbs={MINE_CRUMBS}>
      <div className="k-root k-list-page">
        {/* 件数は出さない（口が総数を返さない・D-144.3。2026-11-28 PM の決めで f7-mine と同じく下絵から外した） */}
        <ScopeHead title="チケット" sub="すべてのグループ" tabs={<ViewTabs current="mine" hrefs={HREFS} />} />
        <MobileMineBody chips={PHONE_CHIPS} current="all" sections={PHONE_SECTIONS} />
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 概要（#14）
const OVERVIEW: OverviewPanelsProps = {
  feed: {
    filters: [{ label: "すべて", current: true }, { label: "人" }, { label: "AI の実行" }, { label: "決定" }],
    days: [
      {
        label: "11月2日（月）",
        items: [
          {
            initial: "仕",
            avatarTone: "hold",
            who: "仕組み",
            verb: "チケットで",
            tag: "仕組み",
            tagTone: "hold",
            when: "4時間前",
            number: "EG-128",
            title: "セイコー様へ 11月分の請求書を送る",
            change: "成果物を作成 → 確認 ① 2 件確実・② 1 件 AI 判定 → 状態：作業中 → 承認待ち",
          },
          {
            initial: "佐",
            avatarTone: "teal",
            who: "佐藤",
            verb: "チケットを",
            tag: "変更",
            tagTone: "indigo",
            when: "1時間前",
            number: "EG-119",
            title: "問い合わせ（山田様）に一次返信する",
            change: "担当者：佐藤 → 高本（返事の期限 11/03・理由：先方と面識がある）",
          },
          {
            initial: "鈴",
            avatarTone: "indigo",
            who: "鈴木",
            verb: "チケットに",
            tag: "書き込み",
            tagTone: "neutral",
            when: "2時間前",
            number: "EG-124",
            title: "セイコー様 保守契約の更新",
            change: "「更新の条件、先方から月額据え置きで了承をもらいました」 ・ ほか 2 件",
          },
          {
            initial: "高",
            avatarTone: "lavender",
            who: "高本",
            verb: "チケットに",
            tag: "書き込み",
            tagTone: "neutral",
            when: "3時間前",
            number: "JD-204",
            title: "京蟻 追加開発の見積を出す",
            change: "「見積は 1,826,000 円で出すことにしました」",
          },
        ],
      },
      {
        label: "11月1日（日）",
        items: [
          {
            initial: "田",
            avatarTone: "amber",
            who: "田中",
            verb: "チケットを",
            tag: "変更",
            tagTone: "indigo",
            when: "昨日",
            number: "EG-117",
            title: "新規 3 社にお礼のメール",
            change: "状態：確認中 → 完了",
          },
          {
            initial: "高",
            avatarTone: "lavender",
            who: "高本",
            verb: "チケットを",
            tag: "変更",
            tagTone: "indigo",
            when: "昨日",
            number: "EG-110",
            title: "請求書の期限を直す",
            change: "期限：10/31 → 11/01",
          },
        ],
      },
    ],
  },
  status: {
    summary: "62% 完了（72 件中 45）",
    counts: [
      { label: "未着手", count: 6, tone: "neutral" },
      { label: "作業中", count: 7, tone: "indigo" },
      { label: "確認中", count: 4, tone: "tertiary" },
      { label: "承認待ち", count: 4, tone: "warning" },
      { label: "実行中", count: 3, tone: "progress" },
      { label: "渡し中", count: 3, tone: "amber" },
      { label: "完了", count: 45, tone: "success" },
    ],
  },
  milestones: [],
};

// ---------------------------------------------------------------- カレンダー（#15・#16）
const TODAY = new Date(2026, 10, 2);
const cal = (number: string, title: string, kindTone: CalItem["kindTone"], late = false): CalItem => ({
  number,
  title,
  kindTone,
  ...(late ? { late } : {}),
});
const CAL_CELLS = buildMonthCells({
  year: 2026,
  month: 11,
  today: TODAY,
  byDay: {
    1: [cal("EG-118", "応募結果まとめ", "warning", true), cal("EG-128", "11月分の請求書", "teal", true)],
    2: [cal("EG-127", "応募文を出す", "teal"), cal("EG-121", "見積の根拠", "danger")],
    4: [cal("EG-132", "名刺を登録", "teal")],
    5: [cal("EG-119", "一次返信", "teal"), cal("EG-126", "更新の見積", "teal")],
    7: [cal("EG-110", "事例の差し替え", "warning")],
    10: [cal("EG-131", "月次レポート", "teal")],
    12: [cal("EG-129", "契約書の更新版", "teal")],
    14: [cal("EG-130", "更新の最終確認", "tertiary")],
    15: [cal("EG-124", "保守契約の更新", "teal")],
    18: [cal("EG-140", "発注ナビ 応募", "teal")],
    20: [cal("EG-141", "営業定例", "tertiary")],
    25: [cal("EG-143", "12月分の請求準備", "teal")],
    30: [
      cal("EG-145", "11月の締め", "teal"),
      cal("EG-146", "入金の確認", "teal"),
      cal("EG-147", "単価の見直し", "danger"),
    ],
  },
});
const CAL_NO_DATE = [
  { number: "EG-150", title: "紹介先リストの洗い出し" },
  { number: "EG-151", title: "LP の問い合わせ文面を直す" },
  { number: "EG-152", title: "展示会の出展可否を決める" },
  { number: "EG-153", title: "見積のひな形を見直す" },
];
const DAY_ITEMS: DayItem[] = [
  {
    number: "EG-126",
    title: "更新の見積を作る",
    kindTone: "teal",
    stage: "確認中",
    stageTone: "tertiary",
    owner: "鈴木",
  },
  { number: "EG-119", title: "山田様に一次返信", kindTone: "teal", stage: "渡し中", stageTone: "amber", owner: "佐藤" },
  {
    number: "KR-034",
    title: "10月分の経費をまとめる",
    kindTone: "teal",
    stage: "未着手",
    stageTone: "neutral",
    owner: "高本",
  },
];

function CalendarBody({ selectedKey }: { selectedKey?: string } = {}) {
  return (
    <div className="k-root k-list-page">
      <GroupHead view="calendar" />
      <CalendarGrid
        monthLabel="2026年 11月"
        span="月"
        basis="期限"
        assignee="すべて"
        cells={selectedKey ? CAL_CELLS.map((c) => (c.key === selectedKey ? { ...c, selected: true } : c)) : CAL_CELLS}
        tray={<NoDateTray variant="calendar" items={CAL_NO_DATE} />}
      />
    </div>
  );
}

// ---------------------------------------------------------------- ガント（#17〜#19・#39）
const d = (m: number, day: number): Date => new Date(2026, m - 1, day);
const GANTT_ROWS: GanttRow[] = [
  { id: "m1", title: "保守更新", owner: "", stage: "", kind: "milestone", start: d(11, 15) },
  { id: "m2", title: "11月 締め", owner: "", stage: "", kind: "milestone", start: d(11, 30) },
  {
    id: "p1",
    title: "【親】セイコー様 保守契約の更新",
    owner: "高本",
    stage: "作業中",
    kind: "parent",
    start: d(10, 26),
    end: d(11, 15),
  },
  {
    id: "c1",
    number: "EG-125",
    title: "EG-125 更新の条件をすり合わせる",
    owner: "鈴木",
    stage: "完了",
    kind: "task",
    parentId: "p1",
    start: d(10, 26),
    end: d(10, 28),
  },
  {
    id: "c2",
    number: "EG-126",
    title: "EG-126 更新の見積を作る",
    owner: "鈴木",
    stage: "確認中",
    kind: "task",
    parentId: "p1",
    start: d(10, 29),
    end: d(11, 5),
  },
  {
    id: "c3",
    number: "EG-129",
    title: "EG-129 契約書の更新版を送る",
    owner: "鈴木",
    stage: "未着手",
    kind: "task",
    parentId: "p1",
    start: d(11, 6),
    end: d(11, 12),
  },
  {
    id: "c4",
    number: "EG-130",
    title: "EG-130 更新の最終確認（定例）",
    owner: "高本",
    stage: "未着手",
    kind: "task",
    parentId: "p1",
    start: d(11, 14),
    end: d(11, 14),
  },
  {
    id: "p2",
    title: "【親】11月 月次の締め",
    owner: "高本",
    stage: "作業中",
    kind: "parent",
    start: d(10, 30),
    end: d(11, 30),
  },
  {
    id: "c5",
    number: "EG-128",
    title: "EG-128 11月分の請求書を送る",
    owner: "高本",
    stage: "承認待ち",
    kind: "task",
    parentId: "p2",
    start: d(10, 30),
    end: d(11, 1),
    late: true,
  },
  {
    id: "c6",
    number: "EG-131",
    title: "EG-131 月次レポートを送る",
    owner: "高本",
    stage: "未着手",
    kind: "task",
    parentId: "p2",
    start: d(11, 9),
    end: d(11, 10),
  },
  {
    id: "c7",
    number: "EG-145",
    title: "EG-145 11月の締め",
    owner: "高本",
    stage: "未着手",
    kind: "task",
    parentId: "p2",
    start: d(11, 26),
    end: d(11, 30),
  },
  {
    id: "t1",
    number: "EG-127",
    title: "EG-127 発注ナビ 応募文を出す",
    owner: "高本",
    stage: "実行中",
    kind: "task",
    start: d(11, 2),
    end: d(11, 2),
  },
  {
    id: "t2",
    number: "EG-118",
    title: "EG-118 応募結果をまとめる",
    owner: "田中",
    stage: "保留",
    kind: "task",
    start: d(10, 26),
    end: d(10, 31),
    late: true,
  },
  {
    id: "t3",
    number: "EG-119",
    title: "EG-119 一次返信する",
    owner: "佐藤",
    stage: "作業中",
    kind: "task",
    start: d(11, 1),
    end: d(11, 5),
  },
];
const GANTT_NO_DATE = [
  { number: "EG-131", title: "セイコー様 来期の提案" },
  { number: "JD-199", title: "京蟻 管理画面の改善案" },
  { number: "KR-036", title: "年末調整の準備" },
  { number: "EG-132", title: "展示会の出展を決める" },
];
const GANTT_RANGE = { start: d(10, 26), end: d(11, 30) };

function GanttBody({ open = false, hint }: { open?: boolean; hint?: ReactNode }) {
  return (
    <div className="k-root k-list-page">
      <GroupHead view="gantt" />
      <GanttChart
        rows={GANTT_ROWS}
        scale="day"
        range={GANTT_RANGE}
        today={TODAY}
        groupBy="親子"
        assignee="すべて"
        noDateCount={GANTT_NO_DATE.length}
        noDateOpen={open}
        tray={<NoDateTray variant="gantt" items={GANTT_NO_DATE} />}
        {...(hint ? { hint } : {})}
      />
    </div>
  );
}

// ---------------------------------------------------------------- 一覧
const ALL: readonly (375 | 768 | 1440)[] = [375, 1440];

export const OVERVIEW_MOCKS: readonly MockEntry[] = [
  {
    id: "f7-mine",
    screen: "tickets",
    label: "自分に関わるもの（札 4・絞りの札 5・期限で区切った表・右の列）",
    ticket: "K-478",
    leaf: "K-478",
    widths: [1440],
    render: (theme) => <MineDesktop theme={theme} />,
  },
  {
    id: "f7-mine-mobile",
    screen: "tickets",
    label: "スマホ｜一覧（1 件 1 行・ガントのタブは出さない）",
    ticket: "K-478",
    leaf: "K-478",
    widths: [375],
    render: (theme) => <MinePhone theme={theme} />,
  },
  {
    id: "f7-overview",
    screen: "tickets",
    label: "概要（最近の更新・状態の内訳・節目 0 件・残りの量と分類ごとは空の枠）",
    ticket: "K-480",
    leaf: "K-480",
    widths: ALL,
    render: (theme) => (
      <Frame theme={theme} crumbs={groupCrumbs("概要")}>
        <div className="k-root k-list-page">
          <GroupHead view="overview" />
          <OverviewPanels {...OVERVIEW} />
        </div>
      </Frame>
    ),
  },
  {
    id: "f7-calendar",
    screen: "tickets",
    label: "カレンダー（月・日付の置き方・ほか N 件・期限が決まっていない 4 件）",
    ticket: "K-481",
    leaf: "K-481",
    widths: ALL,
    render: (theme) => (
      <Frame theme={theme} crumbs={groupCrumbs("カレンダー")}>
        <CalendarBody />
      </Frame>
    ),
  },
  {
    id: "f7-calendar-day",
    screen: "tickets",
    label: "日を開く（11/5 の小窓・日を動かすには理由が要る・この日が期限で作る）",
    ticket: "K-481",
    leaf: "K-481",
    widths: ALL,
    render: (theme) => (
      <Frame
        theme={theme}
        crumbs={groupCrumbs("カレンダー")}
        dialog={
          <DayDialog
            open
            title="11/5（木）"
            note="セイコー様の締め"
            items={DAY_ITEMS}
            moving={{ number: "EG-119", to: "2026-11-09", reason: "山田様の返事待ちで 11/9 まで延びる" }}
          />
        }
      >
        <CalendarBody selectedKey="2026-11-5" />
      </Frame>
    ),
  },
  {
    id: "f7-view-empty",
    screen: "tickets",
    label: "カレンダー・ガントに出すチケットが無い",
    ticket: "K-481",
    leaf: "K-481",
    widths: ALL,
    render: (theme) => (
      <Frame theme={theme} crumbs={groupCrumbs("カレンダー")}>
        <div className="k-root k-list-page">
          <GroupHead view="calendar" />
          <ViewEmpty view="calendar" />
        </div>
      </Frame>
    ),
  },
  {
    id: "f7-gantt",
    screen: "tickets",
    label: "ガント（日／週／月・まとめ方 親子・節目の旗・今日・スマホは出さない）",
    ticket: "K-482",
    leaf: "K-482",
    widths: [1440],
    render: (theme) => (
      <Frame theme={theme} crumbs={groupCrumbs("ガント")}>
        <GanttBody />
      </Frame>
    ),
  },
  {
    id: "f7-gantt-move",
    screen: "tickets",
    label: "期限を動かす確かめ（親の期限・あとに続くものは押せない・土日を飛ばす・理由が要る）",
    ticket: "K-482",
    leaf: "K-482",
    widths: [1440],
    render: (theme) => (
      <Frame
        theme={theme}
        crumbs={groupCrumbs("ガント")}
        dialog={
          <MoveImpactDialog
            open
            ticket={{ number: "EG-126", title: "更新の見積を作る" }}
            from="11/05（木）"
            to="11/08（日）"
            shift="3 日後ろへ"
            parent={{ number: "EG-124", due: "11/15", fits: true }}
            followers={[{ text: "つながりの「続く」はまだ使えません" }]}
            followLabel="あとに続く EG-129 も 3 日ずらす"
            followNote="11/06〜11/12 → 11/09〜11/15"
            weekend={{ checked: true, note: "11/08（日）→ 11/09（月）になる" }}
            owner="鈴木"
            reason="先方の確認待ちで後ろへ"
            confirmDate="11/09"
          />
        }
      >
        <GanttBody />
      </Frame>
    ),
  },
  {
    id: "f7-gantt-nodate",
    screen: "tickets",
    label: "開始・期限が無い 4 件（つかんで日へ落とす・日を入れる）",
    ticket: "K-482",
    leaf: "K-482",
    widths: [1440],
    render: (theme) => (
      <Frame theme={theme} crumbs={groupCrumbs("ガント")}>
        <GanttBody open />
      </Frame>
    ),
  },
  {
    id: "f7-hold-view",
    screen: "tickets",
    label: "保留中の出し方（ガントの保留色・指すと理由と再開の条件・詰まりの印は押せない形）",
    ticket: "K-482",
    leaf: "K-482",
    widths: [1440],
    render: (theme) => (
      <Frame theme={theme} crumbs={groupCrumbs("ガント")}>
        <GanttBody
          hint={
            <HoldHint
              number="EG-118"
              title="応募結果をまとめる"
              reason="先方の確認待ち"
              resume="山田様から回答が届いたら"
              since="保留から 12 日"
            />
          }
        />
      </Frame>
    ),
  },
];
