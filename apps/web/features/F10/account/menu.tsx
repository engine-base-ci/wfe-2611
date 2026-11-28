"use client";
// 自分のメニュー（右上の顔・キャンバス TopMe）とワークスペースの切り替え（左上・キャンバス TopOrg）の開いた形。
//   外枠（Shell）は書き換えない。開いた箱の見た目だけをこの束の部品で外枠の上に重ねて描く（箱は選ぶ欄と同じ見た目）。
//   作った画面（自分の設定・切り替え・届いた招待）は押せる。ほかは出すが押せない（D-145.9）。使った量・新しいワークスペースは後の物
//   本番の外枠に載せるとき（K-844）は任意の props で値と動きを渡す。渡さない呼び方（モック）は見本の値のまま。
//     押せる項目も押せない項目も role="menuitem"（押せない物は aria-disabled）。箱の menu の役はこの部品の箱の 1 つだけ
//     （外枠の開いた箱は役を持たない入れ物にする・K-844）
import type { ReactNode } from "react";
import type { Theme } from "@/lib/theme";
import "./account.css";

const inert = { "aria-disabled": true, tabIndex: -1, title: "まだ使えません" } as const;

function Item({ name, hint, href }: { name: string; hint: string; href?: string | undefined }) {
  return href ? (
    <a className="k-f10a-pop-item" href={href} role="menuitem">
      <b>{name}</b>
      <small>{hint}</small>
    </a>
  ) : (
    <span className="k-f10a-pop-item" role="menuitem" {...inert}>
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

/** 顔（今いるワークスペースの物だけ・D-154.50）。写真が在れば写真、無ければ 1 文字 */
export interface MeFace {
  kind: "text" | "image";
  initial: string;
  url: string | null;
}
export interface MeWho {
  name: string;
  /** 2 行目「<会社名> ・ <主のグループ>」。読めないときは null（出さない） */
  line: string | null;
  face: MeFace;
}
export interface MeMenuProps {
  who?: MeWho;
  /** 分身の部屋の副（「<呼ばれ方>のAI」） */
  aiHint?: string;
  pc?: { title: string; hint: string };
  theme?: Theme;
  onTheme?: (t: Theme) => void;
  onSignOut?: () => void;
  settingsHref?: string;
}

const SAMPLE_WHO: MeWho = {
  name: "高本 聖斗",
  line: "株式会社ENGINE BASE ・ 営業",
  face: { kind: "text", initial: "高", url: null },
};
const SAMPLE_PC = { title: "高本の MacBook がつながっている", hint: "分身はこの PC で実行する" };
/** 下絵の並び（明るい・暗い・PC に合わせる） */
const THEME_CHOICES: readonly { value: Theme; label: string }[] = [
  { value: "light", label: "明るい" },
  { value: "dark", label: "暗い" },
  { value: "system", label: "PC に合わせる" },
];

function Face({ face }: { face: MeFace }) {
  return face.kind === "image" && face.url ? (
    <img className="k-f10a-photo" src={face.url} alt="顔の写真" />
  ) : (
    <span className="k-f10a-avatar" aria-hidden="true">
      {face.initial}
    </span>
  );
}

/** 自分のメニュー：誰か・PC・分身の部屋・自分の設定・自分の使った量・見た目・キーボード・困ったとき・ログアウト */
export function MeMenuPanel(p: MeMenuProps = {}) {
  const who = p.who ?? SAMPLE_WHO;
  const pc = p.pc ?? SAMPLE_PC;
  return (
    <Pop side="right" label="自分のメニュー">
      <div className="k-f10a-who">
        <Face face={who.face} />
        <span className="k-f10a-grow">
          <b>{who.name}</b>
          {who.line ? <small className="k-f10a-note">{who.line}</small> : null}
        </span>
      </div>
      <div className="k-f10a-pop-line">
        <span className="k-f10a-grow">
          <b>{pc.title}</b>
          <small>{pc.hint}</small>
        </span>
      </div>
      <div className="k-f10a-sep" />
      <Item name="分身の部屋" hint={p.aiHint ?? "高本のAI"} />
      <Item
        name="自分の設定"
        hint="名前・ログイン・PC・預けたログイン情報・知らせ"
        href={p.settingsHref ?? "/account"}
      />
      <Item name="自分の使った量" hint="使った量は、あとで見られるようになります" />
      <div className="k-f10a-sep" />
      <div className="k-f10a-pop-item">
        <b>見た目</b>
        <fieldset className="k-f10a-choices">
          <legend className="sr-only">見た目</legend>
          {THEME_CHOICES.map((t, i) => (
            <label key={t.value}>
              {p.theme === undefined ? (
                <input type="radio" name="mm-theme" value={t.value} defaultChecked={i === 0} />
              ) : (
                <input
                  type="radio"
                  name="mm-theme"
                  value={t.value}
                  checked={p.theme === t.value}
                  onChange={() => p.onTheme?.(t.value)}
                />
              )}{" "}
              {t.label}
            </label>
          ))}
        </fieldset>
      </div>
      <Item name="キーボードの操作" hint="? で一覧" />
      <Item name="困ったとき・お知らせ" hint="いまの様子・連絡先" />
      <div className="k-f10a-sep" />
      {p.onSignOut ? (
        <button type="button" className="k-f10a-pop-item k-f10a-pop-btn" role="menuitem" onClick={p.onSignOut}>
          <b>ログアウト</b>
          <small>この端末から出る</small>
        </button>
      ) : (
        <Item name="ログアウト" hint="この端末から出る" />
      )}
    </Pop>
  );
}

export interface OrgRow {
  /** ワークスペースの id（押すと切り替える先・見本は無し） */
  id?: string;
  mark: string;
  name: string;
  role: string;
  now?: boolean;
}
const ORGS: readonly OrgRow[] = [
  { mark: "E", name: "株式会社ENGINE BASE", role: "管理者", now: true },
  { mark: "高", name: "高本 聖斗", role: "自分だけ" },
  { mark: "京", name: "京蟻システム株式会社", role: "メンバー" },
];
export interface OrgPanelProps {
  rows?: readonly OrgRow[];
  onPick?: (id: string) => void;
  /** 答えを待つ間：どの行も押せない（二度押しで 1 回） */
  busy?: boolean;
  /** 届いた招待の行の字（押せない形のまま・押した先は代表の答え待ち・D-154.81） */
  invites?: ReactNode;
  /** 箱の中の知らせ（断り・読めない・もう一度読む） */
  notice?: ReactNode;
}

/** ワークスペースを切り替える：入っている場所の一覧と切り替え・届いた招待。新しいワークスペースを作るは押せない形（D-154.14・段 14） */
export function OrgPanel(p: OrgPanelProps = {}) {
  const rows = p.rows ?? ORGS;
  return (
    <Pop side="left" label="ワークスペースを切り替える">
      {rows.map((o) => {
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
          <div key={o.id ?? o.name} className="k-f10a-pop-line" data-now="">
            {inner}
          </div>
        ) : (
          <button
            key={o.id ?? o.name}
            type="button"
            className="k-f10a-pop-line k-f10a-pop-btn"
            role="menuitem"
            disabled={p.busy === true}
            onClick={o.id && p.onPick ? () => p.onPick?.(o.id!) : undefined}
          >
            {inner}
          </button>
        );
      })}
      {p.notice ?? null}
      <div className="k-f10a-sep" />
      <div className="k-f10a-pop-line" {...inert}>
        <span className="k-f10a-grow">{p.invites ?? "届いた招待 1 ›"}</span>
      </div>
      <div className="k-f10a-pop-line" {...inert}>
        <span className="k-f10a-grow">＋ 新しいワークスペースを作る</span>
      </div>
    </Pop>
  );
}
