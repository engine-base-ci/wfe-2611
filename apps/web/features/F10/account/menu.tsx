"use client";
// 自分のメニュー（右上の顔・キャンバス TopMe）とワークスペースの切り替え（左上・キャンバス TopOrg）の開いた形。
//   外枠（Shell）は書き換えない。開いた箱の見た目だけをこの束の部品で外枠の上に重ねて描く（箱は選ぶ欄と同じ見た目）。
//   作った画面（自分の設定・切り替え・届いた招待）は押せる。ほかは出すが押せない（D-145.9）。使った量・新しいワークスペースは後の物
import type { ReactNode } from "react";
import "./account.css";

const inert = { "aria-disabled": true, tabIndex: -1, title: "まだ使えません" } as const;

function Item({ name, hint, href }: { name: string; hint: string; href?: string }) {
  return href ? (
    <a className="k-f10a-pop-item" href={href}>
      <b>{name}</b>
      <small>{hint}</small>
    </a>
  ) : (
    <span className="k-f10a-pop-item" {...inert}>
      <b>{name}</b>
      <small>{hint}</small>
    </span>
  );
}

function Pop({ side, label, children }: { side: "left" | "right"; label: string; children: ReactNode }) {
  return (
    <div className="k-select-popup k-f10a-pop" data-side={side} role="menu" aria-label={label}>
      {children}
    </div>
  );
}

/** 自分のメニュー：誰か・PC・分身の部屋・自分の設定・自分の使った量・見た目・キーボード・困ったとき・ログアウト */
export function MeMenuPanel() {
  return (
    <Pop side="right" label="自分のメニュー">
      <div className="k-f10a-who">
        <span className="k-f10a-avatar" aria-hidden="true">
          高
        </span>
        <span className="k-f10a-grow">
          <b>高本 聖斗</b>
          <small className="k-f10a-note">株式会社ENGINE BASE ・ 営業</small>
        </span>
      </div>
      <div className="k-f10a-pop-line">
        <span className="k-f10a-grow">
          <b>高本の MacBook がつながっている</b>
          <small>分身はこの PC で実行する</small>
        </span>
      </div>
      <div className="k-f10a-sep" />
      <Item name="分身の部屋" hint="高本のAI" />
      <Item name="自分の設定" hint="名前・ログイン・PC・預けたログイン情報・知らせ" href="/account" />
      <Item name="自分の使った量" hint="使った量は、あとで見られるようになります" />
      <div className="k-f10a-sep" />
      <div className="k-f10a-pop-item">
        <b>見た目</b>
        <fieldset className="k-f10a-choices">
          <legend className="sr-only">見た目</legend>
          {["明るい", "暗い", "PC に合わせる"].map((t, i) => (
            <label key={t}>
              <input type="radio" name="mm-theme" defaultChecked={i === 0} /> {t}
            </label>
          ))}
        </fieldset>
      </div>
      <Item name="キーボードの操作" hint="? で一覧" />
      <Item name="困ったとき・お知らせ" hint="いまの様子・連絡先" />
      <div className="k-f10a-sep" />
      <Item name="ログアウト" hint="この端末から出る" />
    </Pop>
  );
}

interface OrgRow {
  mark: string;
  name: string;
  role: string;
  now?: boolean;
  off?: boolean;
}
const ORGS: readonly OrgRow[] = [
  { mark: "E", name: "株式会社ENGINE BASE", role: "管理者", now: true },
  { mark: "高", name: "高本 聖斗", role: "自分だけ" },
  { mark: "京", name: "京蟻システム株式会社", role: "メンバー" },
];

/** ワークスペースを切り替える：入っている場所の一覧と切り替え・届いた招待（押すと招待の画面へ）。新しいワークスペースを作るは押せない形（D-154.14・段 14） */
export function OrgPanel() {
  return (
    <Pop side="left" label="ワークスペースを切り替える">
      {ORGS.map((o) => {
        const inner = (
          <>
            <span className="k-f10a-mark" aria-hidden="true">
              {o.mark}
            </span>
            <span className="k-f10a-grow">
              <b>{o.name}</b>
              <small>{o.role}</small>
            </span>
            {o.now ? <span aria-label="いま開いている">✓</span> : null}
          </>
        );
        return o.now ? (
          <div key={o.name} className="k-f10a-pop-line" data-now="">
            {inner}
          </div>
        ) : (
          <button key={o.name} type="button" className="k-f10a-pop-line k-f10a-pop-btn">
            {inner}
          </button>
        );
      })}
      <div className="k-f10a-sep" />
      <div className="k-f10a-pop-line" {...inert}>
        <span className="k-f10a-grow">届いた招待 1 ›</span>
      </div>
      <div className="k-f10a-pop-line" {...inert}>
        <span className="k-f10a-grow">＋ 新しいワークスペースを作る</span>
      </div>
    </Pop>
  );
}
