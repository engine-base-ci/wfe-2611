"use client";
// 一覧の差し込み口：自分に関わるものの絞りの行（K-600 が入れ、K-478 が本物にした）。list-page.tsx の MineFilter を包む（children は出さない）。
//   絞りの行：見出し・絞りの札（MineChips：すべて・自分が担当・AI に任せている・自分が承認・渡されたもの＝押せない）・並び（メニュー）・
//     条件を保存（押せない形・K-479 が動かす）・表示設定（列と、自分に関わるものの見え方＝上の数字・右に出すもの・表の分け方・入れるもの）。
//   札は数の札と同じ絞り（mine-focus.ts・同時に 1 つ・もう一度押すと戻る）。並びは既定（期限の近い順）と同じなら sort を付けない（K-473）。
//   幅 767 以下は絞りの行と表の代わりに、スマホの本文（MobileMineBody：絞りの札と 1 件 1 行）を描く（overview.css が出し分ける）
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/k";
import { ONCE } from "@/features/F4/create-ticket/ticket-shell";
import { ColumnSettings, type Columns } from "@/features/F4/ticket-list/list-columns";
import { aiNowTitle } from "@/features/F4/ticket-list/list-side";
import { mmdd, sectionOf, type SectionKey } from "@/features/F4/ticket-list/list-table";
import type { Counts, ListExtra, ListItem } from "@/features/F4/ticket-list/use-ticket-list";
import { me } from "@/lib/auth/ext";
import { COUNT_OF, extraFor, focusOf, type FocusKey } from "../overview/mine-focus";
import { MobileMineBody, type MobileSection } from "../overview/mine-parts";
import { useMineView, type SideKey } from "../overview/use-mine-view";
import { todayJst, withParams } from "../saved/filter-params";
import { MineViewSettings, type CheckItem } from "../saved/views";
import { MineChips, type MineChip } from "./number-cards";
import { CARD_DEFS } from "./number-cards-slot";

/** この区画が本物になったか */
export const READY: boolean = true;

export interface MineChipsSlotProps {
  columns: Columns;
  /** 本人の名前 */
  name: string;
  /** URL の絞りの組（一覧の口の問い合わせにそのまま足す欄） */
  extra: ListExtra;
  /** 絞りの組を替える（URL を替えて読み直す） */
  onExtra: (next: ListExtra) => void;
  /** 一覧の答えの meta.counts（無ければ null） */
  counts: Counts | null;
  /** 今の行 */
  rows: readonly ListItem[];
  children?: ReactNode;
}

/** 自分に関わるものの並び（K-473 の既定：期限の近い順） */
export const MINE_SORTS = [
  { value: "due_on", label: "期限の近い順" },
  { value: "updated_at", label: "更新が新しい順" },
  { value: "created_at", label: "作った順" },
  { value: "start_on", label: "開始日の近い順" },
] as const;
const MINE_SORT_DEFAULT = "due_on";

const CHIP_DEFS: readonly { key: FocusKey | "handed"; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "assigned", label: "自分が担当" },
  { key: "ai", label: "AI に任せている" },
  { key: "approve", label: "自分が承認" },
  { key: "handed", label: "渡されたもの" },
];
const PHONE_CHIPS = new Set<string>(["all", "assigned", "ai"]);
const PHONE_LABEL: Readonly<Record<string, string>> = { ai: "AI が動いている" };

function chipsOf(counts: Counts | null): MineChip[] {
  return CHIP_DEFS.map((c) => {
    if (c.key === "handed") return { key: c.key, label: c.label, pending: true };
    if (c.key === "all") return { key: c.key, label: c.label };
    return { key: c.key, label: c.label, ...(counts ? { count: counts[COUNT_OF[c.key]] } : {}) };
  });
}

const PHONE_SECTIONS: readonly { label: string; keys: readonly SectionKey[] }[] = [
  { label: "期限切れ・今日", keys: ["overdue", "today"] },
  { label: "今週", keys: ["week"] },
  { label: "来週以降", keys: ["later"] },
];

function phoneSections(rows: readonly ListItem[]): MobileSection[] {
  const now = Date.now();
  return PHONE_SECTIONS.map((s) => ({
    label: s.label,
    rows: rows
      .filter((r) => s.keys.includes(sectionOf(r, now)))
      .map((r) => ({
        href: `/tickets/${encodeURIComponent(r.id)}`,
        number: r.number,
        title: r.title,
        stage: r.stage?.name ?? "",
        who: r.delegated_to_clone ? `${r.assignee?.display_name ?? ""}のAI` : (r.assignee?.display_name ?? ""),
        due: mmdd(r.due_on),
        late: r.overdue,
      })),
  })).filter((s) => s.rows.length > 0);
}

function SortMenu({ extra, onExtra }: { extra: ListExtra; onExtra: (next: ListExtra) => void }) {
  const now = MINE_SORTS.find((s) => s.value === (extra["sort"] ?? MINE_SORT_DEFAULT)) ?? MINE_SORTS[0];
  return (
    <Menu>
      <MenuTrigger className="k-list-tool">並び：{now.label} ▾</MenuTrigger>
      <MenuPopup align="end">
        {MINE_SORTS.map((s) => (
          <MenuItem
            key={s.value}
            onSelect={() => onExtra(withParams(extra, { sort: s.value === MINE_SORT_DEFAULT ? null : s.value }))}
          >
            {s.label}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}

const check = (key: string, label: string, checked: boolean, pending = false): CheckItem => ({
  key,
  label,
  checked,
  ...(pending ? { pending } : {}),
});

function MineSettings({ name }: { name: string }) {
  const view = useMineView();
  const cards = [
    ...CARD_DEFS.map((d) => check(d.key, d.label, !view.hiddenCards.includes(d.key))),
    check("week", "今週まで", false, true),
  ];
  const sideOf = (key: SideKey, label: string) => check(key, label, !view.hiddenSide.includes(key));
  const side = [
    sideOf("approvals", "自分の承認を待っているもの"),
    sideOf("ai-now", aiNowTitle(name)),
    sideOf("notices", "最近のお知らせ"),
    check("moves", "自分が担当・承認するものの動き", false, true),
  ];
  // 入れるもの：渡されたものは自分に関わるものに出さない（D-148.13）ので、3 つとも押せない形
  const include = [
    check("mine", "担当しているもの", true, true),
    check("approve", "承認するもの・渡されたもの", true, true),
    check("both", "自分が担当・承認するもの", false, true),
  ];
  return (
    <MineViewSettings
      embedded
      cards={cards}
      side={side}
      split="due"
      pendingSplit={["group", "state"]}
      include={include}
      onToggle={(list, key, on) => (list === "cards" ? view.toggleCard(key, on) : view.toggleSide(key as SideKey, on))}
    />
  );
}

export function MineChipsSlot({ columns, name, extra, onExtra, counts, rows }: MineChipsSlotProps) {
  const who = useQuery({ queryKey: ["me"], queryFn: me, ...ONCE });
  const self = who.data?.member_id ? String(who.data.member_id) : "";
  const view = useMineView();
  const today = todayJst();
  const current = focusOf(extra, today, self) ?? "";
  const pick = (key: string) => {
    if (key === "assigned" && !self) return;
    // 押している札をもう一度押すと戻る（すべて）
    onExtra(extraFor(extra, key === current ? "all" : (key as FocusKey), today, self));
  };
  const chips = chipsOf(counts);
  const phone = chips
    .filter((c) => PHONE_CHIPS.has(c.key))
    .map((c) => ({ ...c, label: PHONE_LABEL[c.key] ?? c.label }));
  return (
    <>
      <div className="k-list-filter" role="group" aria-label="自分に関わるものの絞り込み">
        <b>自分に関わるもの</b>
        <MineChips chips={chips} current={current} onPick={pick} />
        <span className="k-list-tools">
          <SortMenu extra={extra} onExtra={onExtra} />
          <button type="button" className="k-list-tool" aria-disabled="true" tabIndex={-1} title="条件を保存（準備中）">
            条件を保存
          </button>
          <ColumnSettings
            columns={columns}
            title="自分に関わるものの見え方"
            extra={<MineSettings name={name} />}
            onReset={view.reset}
          />
        </span>
      </div>
      <MobileMineBody chips={phone} current={current} onPick={pick} sections={phoneSections(rows)} />
    </>
  );
}
