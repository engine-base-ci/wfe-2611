// ページの型（K-217・D-143.3）。見た目は page.css（キャンバスの実測）。どれもクラスの名前を出すだけの薄い部品。
//   形：<PageBody labelledBy="x"><PageHeader id="x" title="…" sub="…" actions={…} /><Section title="…">…</Section></PageBody>
//   帯は箱の幅いっぱい・ほかの子は左右 24px 内側（page.css の入れ子の決まり）
import type { AnchorHTMLAttributes, ReactNode } from "react";

/** 本文の箱（.k-root.k-page）。中に PageHeader と本文を並べる */
export function PageBody({ labelledBy, children }: { labelledBy?: string; children: ReactNode }) {
  return (
    <section className="k-root k-page" aria-labelledby={labelledBy}>
      {children}
    </section>
  );
}

/** 見出しの帯。見出し（h1）・補足・操作（右寄せ）を 1 行に。狭い幅は折り返す */
export function PageHeader({
  id,
  title,
  sub,
  actions,
}: {
  id?: string;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="k-page-head">
      <h1 id={id}>{title}</h1>
      {sub ? <p className="k-page-sub">{sub}</p> : null}
      {actions ? <div className="k-page-acts">{actions}</div> : null}
    </header>
  );
}

/** 区画。見出し（h2・下に罫線）と本文 */
export function Section({ title, label, children }: { title?: ReactNode; label?: string; children: ReactNode }) {
  return (
    <section className="k-section" aria-label={label}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}

/** 整形済みの文（改行を残し、空白の無い長い字も折り返す） */
export function Prose({ children }: { children: ReactNode }) {
  return <p className="k-pre">{children}</p>;
}

/** 文字のリンク（紺・下線） */
export function TextLink({ children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) {
  return (
    <a {...rest} className="k-link">
      {children}
    </a>
  );
}

/** 横並び（間 8px・折り返す） */
export function Row({ children }: { children: ReactNode }) {
  return <div className="k-row">{children}</div>;
}
