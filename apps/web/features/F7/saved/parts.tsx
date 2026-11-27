// 保存の部品が分け合う小さな部品（区切りの札・切り替え・チェックの並び）。値は props で受け、口は呼ばない（段 8・切る段の下絵）
import { GripVertical } from "lucide-react";

export interface SegItem {
  value: string;
  label: string;
  /** 機能がまだ（グレーで押せない・Tab で止まらない・title に「準備中」・D-145.9） */
  pending?: boolean;
}

/** 2〜4 つから 1 つを選ぶ（キャンバスの「自分だけ／グループの全員」「ふつう／詰める」）。選んでいるものに aria-pressed。
 *  onPick も onChange も無ければ読むだけ */
export function Seg({
  label,
  items,
  value,
  onPick,
  onChange,
}: {
  label: string;
  items: readonly SegItem[];
  value: string;
  /** 選んだとき（押せない項目では呼ばない） */
  onPick?: (value: string) => void;
  /** onPick と同じ（K-479 の保存の小窓が使う名前） */
  onChange?: (value: string) => void;
}) {
  return (
    <div className="k-f7-saved-seg" role="group" aria-label={label}>
      {items.map((i) => (
        <button
          key={i.value}
          type="button"
          className="k-f7-saved-seg-item"
          aria-pressed={i.value === value}
          onClick={i.pending || (!onPick && !onChange) ? undefined : () => (onPick ?? onChange)?.(i.value)}
          {...(i.pending ? { "aria-disabled": true, tabIndex: -1, title: `${i.label}（準備中）` } : {})}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

/** 入り切りの行。pending＝機能がまだ（グレーで押せない・title に「準備中」・D-145.9） */
export function SwitchRow({
  label,
  sub,
  checked = false,
  pending = false,
  disabledNote,
}: {
  label: string;
  sub?: string;
  checked?: boolean;
  pending?: boolean;
  /** 押せない訳（title に出す）。pending のときは「（準備中）」が入る */
  disabledNote?: string;
}) {
  const off = pending || disabledNote !== undefined;
  const title = pending ? `${label}（準備中）` : disabledNote;
  return (
    <div className="k-f7-saved-switch">
      <span className="k-f7-saved-switch-text">
        <span>{label}</span>
        {sub ? <span className="k-f7-saved-sub">{sub}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        className="k-f7-saved-switch-btn"
        aria-checked={checked}
        aria-label={label}
        data-pending={pending || undefined}
        {...(off ? { "aria-disabled": true, tabIndex: -1 } : {})}
        {...(title ? { title } : {})}
      >
        <span aria-hidden="true" />
      </button>
    </div>
  );
}

export interface CheckItem {
  key: string;
  label: string;
  checked: boolean;
  /** 外せない（固定の札を出す） */
  fixed?: boolean;
  /** 機能がまだ（グレーで押せない・title に「準備中」・D-145.9） */
  pending?: boolean;
}

/** 見出しつきのチェックの並び。grip＝つかんで並べ替える取っ手を出す */
export function CheckList({
  title,
  items,
  grip = false,
  onToggle,
}: {
  title: string;
  items: readonly CheckItem[];
  grip?: boolean;
  onToggle?: (key: string, on: boolean) => void;
}) {
  return (
    <div className="k-f7-saved-group" role="group" aria-label={title}>
      <p className="k-f7-saved-group-title">{title}</p>
      <ul className="k-f7-saved-list">
        {items.map((it) => (
          <li key={it.key} className="k-f7-saved-list-row">
            {grip ? <GripVertical size={14} className="k-f7-saved-grip" aria-hidden="true" /> : null}
            <label
              className="k-f7-saved-check"
              {...(it.pending ? { "aria-disabled": "true" as const, title: `${it.label}（準備中）` } : {})}
            >
              <input
                type="checkbox"
                checked={it.checked}
                disabled={it.fixed === true || it.pending === true}
                readOnly={onToggle === undefined}
                onChange={(e) => onToggle?.(it.key, e.target.checked)}
              />
              <span>{it.label}</span>
            </label>
            {it.fixed ? <span className="k-f7-saved-fixed">固定</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
