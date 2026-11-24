// 保存の部品が分け合う小さな部品（区切りの札・切り替え・チェックの並び）。値は props で受け、口は呼ばない（段 8・切る段の下絵）
import { GripVertical } from "lucide-react";

export interface SegItem {
  value: string;
  label: string;
}

/** 2〜4 つから 1 つを選ぶ（キャンバスの「自分だけ／グループの全員」「ふつう／詰める」）。選んでいるものに aria-pressed。
 *  onChange が無ければ読むだけ（今までどおり） */
export function Seg({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: readonly SegItem[];
  value: string;
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
          onClick={onChange ? () => onChange(i.value) : undefined}
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
            <label className="k-f7-saved-check">
              <input
                type="checkbox"
                checked={it.checked}
                disabled={it.fixed === true}
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
