"use client";
// 表示設定の箱 2 つ（キャンバス LsView・MnView・D-151.9）。値を受け取って描くだけ（口は呼ばない・覚える先は葉が決める）。
//   ViewSettings＝一覧の見え方：出す列（つかんで並べ替え・番号と題名は固定）・1 行の高さ・まとめる・並べ方・この見え方をグループの全員の既定にする（マネージャーだけ）。
//   MineViewSettings＝自分に関わるものの見え方：上の数字・右に出すもの・表の分け方・入れるもの。自分だけの見え方（ほかの人には変わらない）。
//   箱は表の箱の頭の「表示設定」のすぐ下に開く。位置は呼ぶ側が持つ（.k-f7-saved-anchor の中に置く）
import { CheckList, Seg, SwitchRow, type CheckItem } from "./parts";

export interface ViewSettingsProps {
  columns: readonly CheckItem[];
  density: "normal" | "tight";
  groupBy: "family" | "state" | "owner" | "none";
  /** 並べ方の字（更新が新しい順）。sortOptions を渡したときは選びの今の値（sort の欄の値） */
  sort: string;
  /** この見え方をグループの全員の既定にする（入っている） */
  asDefault: boolean;
  /** マネージャーだけ押せる */
  canSetDefault: boolean;
  /** 表示設定の箱（一覧の見え方・list-columns.tsx）の中に差し込む：外側の箱・題・はじめに戻す・出す列を描かない */
  embedded?: boolean;
  /** 1 行の高さを選んだとき */
  onDensity?: (d: "normal" | "tight") => void;
  /** 並べ方の選び（値と字）。渡したら <select aria-label="並べ方"> で選べる */
  sortOptions?: readonly { value: string; label: string }[];
  onSort?: (value: string) => void;
  /** まとめる・グループの既定にするがまだ使えない（グレーで押せない・D-145.9） */
  pendingGroup?: boolean;
}

const DENSITY = [
  { value: "normal", label: "ふつう" },
  { value: "tight", label: "詰める" },
] as const;
const GROUP_BY = [
  { value: "family", label: "親子" },
  { value: "state", label: "状態" },
  { value: "owner", label: "担当" },
  { value: "none", label: "なし" },
] as const;

function Head({ title }: { title: string }) {
  return (
    <div className="k-f7-saved-pop-head">
      <b>{title}</b>
      <button type="button" className="k-f7-saved-text-btn">
        はじめに戻す
      </button>
    </div>
  );
}

function SortPick({
  sort,
  options,
  onSort,
}: {
  sort: string;
  options?: ViewSettingsProps["sortOptions"];
  onSort?: ViewSettingsProps["onSort"];
}) {
  if (!options)
    return (
      <button type="button" className="k-f7-saved-pick" aria-haspopup="listbox">
        {sort}
        <span aria-hidden="true"> ▾</span>
      </button>
    );
  return (
    <select className="k-f7-saved-pick" aria-label="並べ方" value={sort} onChange={(e) => onSort?.(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function ViewSettings({
  columns,
  density,
  groupBy,
  sort,
  asDefault,
  canSetDefault,
  embedded = false,
  onDensity,
  sortOptions,
  onSort,
  pendingGroup = false,
}: ViewSettingsProps) {
  const groups = GROUP_BY.map((g) => ({ ...g, ...(pendingGroup ? { pending: true } : {}) }));
  const body = (
    <>
      <div className="k-f7-saved-opts">
        <div className="k-f7-saved-opt">
          <span className="k-f7-saved-opt-name">1 行の高さ</span>
          <Seg
            label="1 行の高さ"
            items={DENSITY}
            value={density}
            {...(onDensity ? { onPick: (v: string) => onDensity(v === "tight" ? "tight" : "normal") } : {})}
          />
        </div>
        <div className="k-f7-saved-opt">
          <span className="k-f7-saved-opt-name">まとめる</span>
          <Seg label="まとめる" items={groups} value={pendingGroup ? "" : groupBy} />
        </div>
        <div className="k-f7-saved-opt">
          <span className="k-f7-saved-opt-name">並べ方</span>
          <SortPick sort={sort} {...(sortOptions ? { options: sortOptions } : {})} {...(onSort ? { onSort } : {})} />
        </div>
      </div>
      <SwitchRow
        label="この見え方をグループの全員の既定にする"
        checked={asDefault}
        pending={pendingGroup}
        {...(canSetDefault || pendingGroup ? {} : { disabledNote: "グループの既定にできるのはマネージャーです" })}
      />
    </>
  );
  if (embedded) return body;
  return (
    <section className="k-f7-saved-pop" role="dialog" aria-label="一覧の見え方">
      <Head title="一覧の見え方" />
      <CheckList title="表に出す列" items={columns} grip />
      {body}
      <p className="k-f7-saved-note">変えた見え方は自分だけに残る。グループの既定にできるのはマネージャー</p>
    </section>
  );
}

export interface MineViewSettingsProps {
  /** 上の数字 */
  cards: readonly CheckItem[];
  /** 右に出すもの */
  side: readonly CheckItem[];
  /** 表の分け方 */
  split: "due" | "group" | "state";
  /** 入れるもの */
  include: readonly CheckItem[];
  /** 表示設定の箱（自分に関わるものの見え方・list-columns.tsx）の中に差し込む：外側の箱・題・はじめに戻すを描かない */
  embedded?: boolean;
  /** 上の数字・右に出すもののチェックを替えたとき（どの並びの key か） */
  onToggle?: (list: "cards" | "side", key: string, on: boolean) => void;
  /** 表の分け方で、まだ使えない項目（グループ・状態） */
  pendingSplit?: readonly string[];
}

const SPLIT = [
  { value: "due", label: "期限" },
  { value: "group", label: "グループ" },
  { value: "state", label: "状態" },
] as const;

export function MineViewSettings({
  cards,
  side,
  split,
  include,
  embedded = false,
  onToggle,
  pendingSplit = [],
}: MineViewSettingsProps) {
  const splits = SPLIT.map((s) => ({ ...s, ...(pendingSplit.includes(s.value) ? { pending: true } : {}) }));
  const body = (
    <>
      <CheckList
        title="上の数字（つかんで並べ替え）"
        items={cards}
        grip
        {...(onToggle ? { onToggle: (k: string, on: boolean) => onToggle("cards", k, on) } : {})}
      />
      <CheckList
        title="右に出すもの（つかんで並べ替え）"
        items={side}
        grip
        {...(onToggle ? { onToggle: (k: string, on: boolean) => onToggle("side", k, on) } : {})}
      />
      <div className="k-f7-saved-opts">
        <div className="k-f7-saved-opt">
          <span className="k-f7-saved-opt-name">表の分け方</span>
          <Seg label="表の分け方" items={splits} value={split} />
        </div>
      </div>
      <CheckList title="入れるもの" items={include} />
    </>
  );
  if (embedded) return body;
  return (
    <section className="k-f7-saved-pop" role="dialog" aria-label="自分に関わるものの見え方">
      <Head title="自分に関わるものの見え方" />
      {body}
      <p className="k-f7-saved-note">自分だけの見え方。ほかの人には変わらない</p>
    </section>
  );
}
