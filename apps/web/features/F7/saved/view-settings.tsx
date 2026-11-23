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
  /** 並べ方の字（更新が新しい順） */
  sort: string;
  /** この見え方をグループの全員の既定にする（入っている） */
  asDefault: boolean;
  /** マネージャーだけ押せる */
  canSetDefault: boolean;
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

export function ViewSettings({ columns, density, groupBy, sort, asDefault, canSetDefault }: ViewSettingsProps) {
  return (
    <section className="k-f7-saved-pop" role="dialog" aria-label="一覧の見え方">
      <Head title="一覧の見え方" />
      <CheckList title="表に出す列" items={columns} grip />
      <div className="k-f7-saved-opts">
        <div className="k-f7-saved-opt">
          <span className="k-f7-saved-opt-name">1 行の高さ</span>
          <Seg label="1 行の高さ" items={DENSITY} value={density} />
        </div>
        <div className="k-f7-saved-opt">
          <span className="k-f7-saved-opt-name">まとめる</span>
          <Seg label="まとめる" items={GROUP_BY} value={groupBy} />
        </div>
        <div className="k-f7-saved-opt">
          <span className="k-f7-saved-opt-name">並べ方</span>
          <button type="button" className="k-f7-saved-pick" aria-haspopup="listbox">
            {sort}
            <span aria-hidden="true"> ▾</span>
          </button>
        </div>
      </div>
      <SwitchRow
        label="この見え方をグループの全員の既定にする"
        checked={asDefault}
        {...(canSetDefault ? {} : { disabledNote: "グループの既定にできるのはマネージャーです" })}
      />
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
}

const SPLIT = [
  { value: "due", label: "期限" },
  { value: "group", label: "グループ" },
  { value: "state", label: "状態" },
] as const;

export function MineViewSettings({ cards, side, split, include }: MineViewSettingsProps) {
  return (
    <section className="k-f7-saved-pop" role="dialog" aria-label="自分に関わるものの見え方">
      <Head title="自分に関わるものの見え方" />
      <CheckList title="上の数字（つかんで並べ替え）" items={cards} grip />
      <CheckList title="右に出すもの（つかんで並べ替え）" items={side} grip />
      <div className="k-f7-saved-opts">
        <div className="k-f7-saved-opt">
          <span className="k-f7-saved-opt-name">表の分け方</span>
          <Seg label="表の分け方" items={SPLIT} value={split} />
        </div>
      </div>
      <CheckList title="入れるもの" items={include} />
      <p className="k-f7-saved-note">自分だけの見え方。ほかの人には変わらない</p>
    </section>
  );
}
