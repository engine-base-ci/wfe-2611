// 段 8（F7）の下絵のモック（保存した検索条件・絞る・片付ける）が並べる見本の値。キャンバス（Main・List・LsSave・TdDue）の顔ぶれ。
//   日付は物語の今日（11/02）に固定する（時計は読まない）。本物のデータにはつながない
import { COLUMN_KEYS, type ColumnKey } from "@/features/F4/ticket-list/list-columns";
import type { Approvals, ListItem } from "@/features/F4/ticket-list/use-ticket-list";
import type { Group } from "@/components/k";
import type { DuePopoverProps, MineChip, NumberCard } from "@/features/F7/due/views";
import type { CheckItem, ConditionItem } from "@/features/F7/saved/views";

export const TODAY = "2026-11-02";
export const GROUPS: Group[] = [
  { code: "EG", name: "営業", href: "/tickets?scope=eg", count: 18, pending: true, tone: "teal" },
  { code: "JD", name: "受託開発", href: "/tickets?scope=jd", count: 42, pending: true, tone: "plum" },
  { code: "KR", name: "経理", href: "/tickets?scope=kr", count: 9, pending: true, tone: "amber" },
];
export const NOOP = () => undefined;
export const COLUMNS: ColumnKey[] = [...COLUMN_KEYS];

export const KIND = { id: "kind-task", name: "タスク" };
export function row(o: {
  number: string;
  title: string;
  stage: string;
  key?: string;
  who: string;
  ai?: boolean;
  due: string | null;
  overdue?: boolean;
  updated: string;
}): ListItem {
  return {
    id: o.number.toLowerCase(),
    number: o.number,
    title: o.title,
    kind: KIND,
    stage: { id: `stage-${o.key ?? o.stage}`, name: o.stage, key: o.key ?? null },
    assignee: { id: `m-${o.who}`, display_name: o.who },
    delegated_to_clone: o.ai === true,
    due_on: o.due,
    overdue: o.overdue === true,
    updated_at: `2026-11-02T${o.updated}:00+09:00`,
  };
}
export const EG128 = row({
  number: "EG-128",
  title: "セイコー様へ 11月分の請求書を送る",
  stage: "承認待ち",
  key: "awaiting_approval",
  who: "高本",
  ai: true,
  due: "2026-11-01",
  overdue: true,
  updated: "09:50",
});
export const JD198 = row({
  number: "JD-198",
  title: "京蟻 管理画面の表示崩れ（Safari）",
  stage: "作業中",
  key: "doing",
  who: "高本",
  due: "2026-10-31",
  overdue: true,
  updated: "08:00",
});
export const OVERDUE_ROWS: ListItem[] = [EG128, JD198];
export const GROUP_ROWS: ListItem[] = [
  EG128,
  row({
    number: "EG-124",
    title: "【親】セイコー様 保守契約の更新",
    stage: "作業中",
    key: "doing",
    who: "鈴木",
    due: "2026-11-15",
    updated: "08:00",
  }),
  row({
    number: "EG-126",
    title: "更新の見積を作る",
    stage: "確認中",
    key: "checking",
    who: "鈴木",
    ai: true,
    due: "2026-11-05",
    updated: "09:00",
  }),
  row({
    number: "EG-127",
    title: "発注ナビ 新着案件に応募文を出す",
    stage: "実行中",
    key: "running",
    who: "高本",
    ai: true,
    due: "2026-11-02",
    updated: "09:57",
  }),
  row({
    number: "EG-119",
    title: "問い合わせ（山田様）に一次返信する",
    stage: "渡し中",
    who: "佐藤",
    due: "2026-11-05",
    updated: "09:00",
  }),
  row({
    number: "EG-110",
    title: "提案資料の事例を 3 件に差し替え",
    stage: "未着手",
    who: "高本",
    due: "2026-11-07",
    updated: "08:00",
  }),
];
export const APPROVALS: Approvals = {
  state: "ok",
  rows: [
    { id: "ap1", ticket_id: "eg-128", ticket_number: "EG-128", title: "セイコー様へ 11月分の請求書を送る" },
    { id: "ap2", ticket_id: "jd-204", ticket_number: "JD-204", title: "京蟻 追加開発の見積を出す（1,826,000 円）" },
  ],
};

export const CARDS: NumberCard[] = [
  { key: "overdue", label: "期限切れ", value: 2, tone: "danger" },
  { key: "today", label: "今日まで", value: 3, tone: "neutral" },
  { key: "approve", label: "自分が承認", value: 2, tone: "warning" },
  { key: "ai", label: "AI が動いている", value: 3, tone: "neutral" },
];
export const CHIPS: MineChip[] = [
  { key: "all", label: "すべて" },
  { key: "mine", label: "自分が担当", count: 11 },
  { key: "ai", label: "AI に任せている", count: 5 },
  { key: "approve", label: "自分が承認", count: 2 },
  { key: "handed", label: "渡されたもの", pending: true },
];

export const check = (key: string, label: string, checked: boolean, fixed = false): CheckItem => ({
  key,
  label,
  checked,
  ...(fixed ? { fixed } : {}),
});
export const VIEW_COLUMNS: CheckItem[] = [
  check("kind", "種別", true),
  check("number", "番号", true, true),
  check("title", "題名", true, true),
  check("stage", "状態", true),
  check("assignee", "担当者", true),
  check("class", "分類", true),
  check("milestone", "節目", true),
  check("start", "開始日", false),
  check("due", "期限", true),
  check("estimate", "予定・実績", true),
  check("updated", "更新", true),
  check("priority", "優先度", false),
];

export const COND_ITEMS: readonly ConditionItem[] = [
  { kind: "row", row: { field: "担当者", op: "が", values: ["鈴木"] } },
  { kind: "row", row: { field: "期限", op: "が", text: "今週（11/02〜11/08）" } },
  { kind: "row", row: { field: "状態", op: "でない", values: ["完了"] } },
];

export const SECTIONS = [
  { key: "goal", label: "目的", text: "セイコー様に 11月分の請求書を送り、入金の予定日をそろえる" },
  { key: "done", label: "完了の条件", text: "請求書がセイコー様に届いている\n入金の予定日を先方と確認している" },
];

export const DUE_BASE: DuePopoverProps = {
  today: TODAY,
  picked: "2026-11-02",
  month: { year: 2026, month: 11 },
  quick: [
    { label: "今日", value: "2026-11-02" },
    { label: "明日", value: "2026-11-03" },
    { label: "今週の金曜", value: "2026-11-06" },
    { label: "来週の月曜", value: "2026-11-09" },
  ],
  time: "18:00",
  approver: "高本",
  reason: "先方から入金の予定日の確認待ちで、1 日待ちます",
};
