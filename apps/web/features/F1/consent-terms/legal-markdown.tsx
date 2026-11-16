// 規約・プライバシーポリシーのひな形（apps/web/content/legal/*.md）を画面の要素にする小さな描き手（K-53）。
//   ひな形が使う書き方だけを受ける：見出し（# ・##）・段落・番号の並び（1. ）・その下の点の並び（   - ）・表（| … |）・太字（**…**）。
//   返事の書式の部品（react-markdown など）は境界 B8 の中（components/ai/markdown.tsx）だけが使う決まりなので、ここでは使わない。
//   文字は React の文字として出す（HTML として読まない）。ひな形は運営が書く決まった文面で、利用者の入力は入らない
//   キャンバス LegalPage の形（K-232）：題の直後の「第 N 版（…施行）」の段落は版の行（.k-legal-version）にし、
//   最後の節の見出しが「問い合わせ」で終わるなら、その節を箱の一番下の問い合わせの段（.k-legal-contact・見出しは読み上げだけ）にする
import { Fragment, type ReactNode } from "react";

/** **太字** だけを要素にする */
function inline(text: string, key: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
      <strong key={`${key}-${i}`}>{p.slice(2, -2)}</strong>
    ) : (
      <Fragment key={`${key}-${i}`}>{p}</Fragment>
    ),
  );
}
const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

type Item = { text: string; sub: string[] };
/** 見出し（# の後に空白と文字がある行）。「# 」だけの行は見出しにしない（段落として出す） */
const HEADING = /^(#{1,3}) (.*\S.*)$/;
/** 版の行（字は変えずに形で見分ける。形を変えるときはここも直す・K-86） */
const VERSION = /^第 \d+ 版（.+施行）$/;
/** 問い合わせの節の見出し */
const CONTACT = /問い合わせ$/;

export function LegalMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  /** 問い合わせの節の見出しが out の何番目か（後に別の見出しが来たら外す） */
  let contactAt: number | null = null;
  /** 直前に出したのが 1 段目の見出し（題）か */
  let afterTitle = false;
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i]!;
    const key = `b${i}`;
    if (!ln.trim()) {
      i++;
      continue;
    }
    const h = HEADING.exec(ln);
    if (h) {
      const level = h[1]!.length;
      const body = inline(h[2]!, key);
      contactAt = level <= 2 && CONTACT.test(h[2]!.trim()) ? out.length : level <= 2 ? null : contactAt;
      afterTitle = level === 1;
      out.push(
        level === 1 ? <h1 key={key}>{body}</h1> : level === 2 ? <h2 key={key}>{body}</h2> : <h3 key={key}>{body}</h3>,
      );
      i++;
      continue;
    }
    const isVersion = afterTitle;
    afterTitle = false;
    if (/^\|/.test(ln.trim())) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i]!.trim())) {
        if (!/^\|[\s:|-]+\|$/.test(lines[i]!.trim())) rows.push(cells(lines[i]!));
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        <table key={key}>
          {head ? (
            <thead>
              <tr>
                {head.map((c, j) => (
                  <th key={j}>{inline(c, `${key}h${j}`)}</th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {body.map((r, k) => (
              <tr key={k}>
                {r.map((c, j) => (
                  <td key={j}>{inline(c, `${key}r${k}c${j}`)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }
    if (/^\d+\. /.test(ln) || /^- /.test(ln)) {
      const ordered = /^\d+\. /.test(ln);
      const items: Item[] = [];
      while (i < lines.length && (/^(\d+\.|-) /.test(lines[i]!) || /^\s+- /.test(lines[i]!))) {
        const cur = lines[i]!;
        if (/^\s+- /.test(cur) && items.length) items[items.length - 1]!.sub.push(cur.replace(/^\s+- /, ""));
        else items.push({ text: cur.replace(/^(\d+\.|-) /, ""), sub: [] });
        i++;
      }
      const lis = items.map((it, k) => (
        <li key={k}>
          {inline(it.text, `${key}i${k}`)}
          {it.sub.length ? (
            <ul>
              {it.sub.map((s, j) => (
                <li key={j}>{inline(s, `${key}i${k}s${j}`)}</li>
              ))}
            </ul>
          ) : null}
        </li>
      ));
      out.push(ordered ? <ol key={key}>{lis}</ol> : <ul key={key}>{lis}</ul>);
      continue;
    }
    // 段落：空の行・見出し・表・並びまでの行をまとめる（行の区切りは残す）
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !HEADING.test(lines[i]!) &&
      !/^\|/.test(lines[i]!.trim()) &&
      !/^(\d+\.|-) /.test(lines[i]!)
    ) {
      para.push(lines[i]!);
      i++;
    }
    // どの形にも当たらない行（例：「# 」だけ・「1.」の後が空）でも必ず 1 行は進める（止まらない）
    if (!para.length) {
      para.push(lines[i]!);
      i++;
    }
    const version = isVersion && para.length === 1 && VERSION.test(para[0]!.trim());
    out.push(
      <p key={key} className={version ? "k-legal-version" : undefined}>
        {para.map((p, k) => (
          <Fragment key={k}>
            {k ? <br /> : null}
            {inline(p, `${key}p${k}`)}
          </Fragment>
        ))}
      </p>,
    );
  }
  if (contactAt === null) return <>{out}</>;
  return (
    <>
      {out.slice(0, contactAt)}
      <div className="k-legal-contact">{out.slice(contactAt)}</div>
    </>
  );
}
