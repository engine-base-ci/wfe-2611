// 自分に関わるもの（キャンバス Main）の部品（K-251・D-145.9）。数の札 4 つと、表の箱の頭の絞り込みの行。
//   数を出す口・絞り・並び・条件を保存は機能がまだ（K-67）なので、出すが押せない（aria-disabled・グレー）。表示設定は列を選べる（list-columns.tsx）。
//   本当の値が無い数（札の数・件数・絞りの札の数）は空にする（D-144.2・D-144.3）。[data-value] の中は空のまま
import { ColumnSettings, type Columns } from "./list-columns";
import { aiNowTitle } from "./list-side";

const CARDS = [
  { label: "期限切れ", tone: "danger" },
  { label: "今日まで", tone: "neutral" },
  { label: "自分が承認", tone: "warning" },
  { label: "AI が動いている", tone: "neutral" },
] as const;

const CHIPS = ["すべて", "自分が担当", "AI に任せている", "自分が承認", "渡されたもの"] as const;

export function MineCards() {
  return (
    <div className="k-list-cards" role="group" aria-label="数の札">
      {CARDS.map((c) => (
        <div
          key={c.label}
          className="k-list-card"
          data-tone={c.tone}
          aria-disabled="true"
          title={`${c.label}（準備中）`}
        >
          <div data-label>{c.label}</div>
          <div className="k-list-card-value" data-value />
        </div>
      ))}
    </div>
  );
}

export function MineFilter({ columns, name }: { columns: Columns; name: string }) {
  return (
    <div className="k-list-filter" role="group" aria-label="自分に関わるものの絞り込み">
      <b>自分に関わるもの</b>
      <span className="k-list-dim" data-value />
      <span className="k-list-chips">
        {CHIPS.map((c, i) => (
          <span
            key={c}
            className="k-list-chip"
            data-chip
            data-current={i === 0 || undefined}
            aria-disabled="true"
            title={`${c}（準備中）`}
          >
            {c}
            {i ? <span data-value /> : null}
          </span>
        ))}
      </span>
      <span className="k-list-tools">
        <span className="k-list-off k-list-dim" aria-disabled="true" title="並び（準備中）">
          並び：期限の近い順 ▾
        </span>
        <span className="k-list-tool" aria-disabled="true" title="条件を保存（準備中）">
          条件を保存
        </span>
        <ColumnSettings columns={columns} title="自分に関わるものの見え方" extra={<MineViewItems name={name} />} />
      </span>
    </div>
  );
}

/** 表示設定の箱の、自分に関わるものだけの項目（キャンバス MnView）。機能はまだ（K-67）なので並べるが押せない（D-145.9） */
function MineViewItems({ name }: { name: string }) {
  const groups: [string, string[]][] = [
    ["上の数字", ["期限切れ", "今日まで", "自分が承認", "AI が動いている", "今週まで"]],
    [
      "右に出すもの",
      ["自分の承認を待っているもの", aiNowTitle(name), "最近の知らせ", "自分が担当・承認するものの動き"],
    ],
    ["表の分け方", ["期限", "グループ", "状態"]],
    ["入れるもの", ["担当しているもの", "承認するもの・渡されたもの", "自分が担当・承認するもの"]],
  ];
  return (
    <>
      {groups.map(([title, items]) => (
        <div key={title} className="k-list-columns-group" role="group" aria-label={title}>
          <p className="k-list-columns-title">{title}</p>
          <ul className="k-list-columns-list">
            {items.map((it) => (
              <li key={it}>
                <span className="k-list-columns-item k-list-off" aria-disabled="true" title={`${it}（準備中）`}>
                  {it}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
