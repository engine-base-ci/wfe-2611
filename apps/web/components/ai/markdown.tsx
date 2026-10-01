"use client";
// 返事の書式（D-104.3〜D-104.6・D-104.20）。react-markdown＋表（remark-gfm）＋数式（MathML・temml）＋コードの色分け（shiki）＋流れ図（mermaid・使うときだけ読む）。
// 見た目はモック（06_mockup/_chat.py）の部品と同じ class（chat.css）。色は DESIGN の値だけ（コードの色も syntax のトークン）。
// 書きかけ（書きながら出る返事）の崩れは、ここで閉じる（閉じていないコードの囲い・数式）。
// 生の HTML は許した印（蛍光ペン・キー・開いて見る・上付き）だけ通し、あとは消す（rehype-sanitize）。
import Link from "next/link";
import type { Route } from "next";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileText,
  Info,
  ListChecks,
  OctagonAlert,
  Target,
  User,
  Bot,
  Inbox,
  Brain,
} from "lucide-react";
import { Children, createContext, isValidElement, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactElement, type ReactNode, type RefObject } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
// 日本語の隣の太字（**「受託の作業」**なので）は CommonMark の決まりでは太字にならず ** がそのまま出る。日本語に合わせた読み方にする（2026-09-30 user「生成の内容がくっついている」）
import remarkCjkFriendly from "remark-cjk-friendly";
import { isBuilt } from "@/lib/built-routes";
import { copyText } from "./copy";

/** 返事の中の表・csv を成果物に書き出す口（D-106.1）。会話の返事の中でだけ渡される（見本や他の画面では出さない） */
export type ExportFn = (text: string, format: "md" | "csv") => void;
export const ExportContext = createContext<ExportFn | null>(null);
/** 表を CSV の文字にする（成果物は BOM を付けない。落とすときの CSV とは別） */
export const csvText = (rows: string[][]) => rows.map((r) => r.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",")).join("\n");

// ---- 木（hast）の最小の形。型の包みを増やさないため、ここで使う分だけ書く
interface HText {
  type: "text";
  value: string;
}
interface HElement {
  type: "element";
  tagName: string;
  properties: Record<string, unknown>;
  children: HNode[];
}
type HNode = HText | HElement | { type: "comment" | "raw" | "doctype"; value?: string };
interface HRoot {
  type: "root";
  children: HNode[];
}
const isEl = (n: HNode | undefined): n is HElement => !!n && n.type === "element";
const textOf = (n: HNode | undefined): string =>
  !n ? "" : n.type === "text" ? (n as HText).value : isEl(n) ? n.children.map(textOf).join("") : "";
const classOf = (n: HElement): string[] => {
  const c = n.properties["className"];
  return Array.isArray(c) ? c.map(String) : typeof c === "string" ? c.split(/\s+/) : [];
};

/** 許す HTML：書式の印（D-104.3）と、数式の class（math-inline／math-display）、Kaname の中へのリンク（kaname://） */
const SCHEMA = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "mark", "kbd", "details", "summary", "sup", "sub"],
  attributes: {
    ...defaultSchema.attributes,
    code: [["className", /^language-./, "math-inline", "math-display"]],
    details: ["open"],
  },
  protocols: { ...defaultSchema.protocols, href: [...(defaultSchema.protocols?.["href"] ?? []), "kaname"] },
};

const ALERT: Record<string, { kind: "info" | "warn" | "danger"; title: string }> = {
  NOTE: { kind: "info", title: "お知らせ" },
  TIP: { kind: "info", title: "ヒント" },
  IMPORTANT: { kind: "info", title: "大事なこと" },
  WARNING: { kind: "warn", title: "注意" },
  CAUTION: { kind: "danger", title: "危ない" },
};

/** 木を整える：注意の帯（> [!NOTE]）・出典の番号と一覧・見出しの id（目次のため） */
function rehypeKaname() {
  return (tree: HRoot) => {
    let h = 0;
    const walk = (nodes: HNode[]): void => {
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!isEl(n)) continue;
        if (/^h[1-4]$/.test(n.tagName)) n.properties["id"] = `mh-${++h}`;
        // 出典の番号と戻り先：id は安全のため user-content- が前に付くので、リンクもそれに合わせる
        if (n.tagName === "a" && typeof n.properties["href"] === "string" && /^#(fn|fnref)/.test(n.properties["href"] as string))
          n.properties["href"] = `#user-content-${(n.properties["href"] as string).slice(1)}`;
        if (n.tagName === "blockquote") {
          const p = n.children.find(isEl);
          const first = p?.children[0];
          const m = first && first.type === "text" ? /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/.exec((first as HText).value) : null;
          if (p && m) {
            (first as HText).value = (first as HText).value.slice(m[0].length);
            const a = ALERT[m[1] ?? "NOTE"] ?? ALERT["NOTE"]!;
            nodes[i] = { type: "element", tagName: "div", properties: { className: ["callout", a.kind], dataTitle: a.title }, children: n.children };
            continue;
          }
        }
        if (n.tagName === "sup" && n.children.some((c) => isEl(c) && c.properties["dataFootnoteRef"] !== undefined)) n.properties["className"] = ["cn"];
        if (n.tagName === "section" && n.properties["dataFootnotes"] !== undefined) {
          for (const c of n.children) {
            if (isEl(c) && c.tagName === "ol") c.properties["className"] = ["srcs"];
          }
          // 「Footnotes」の見出しは出さない（番号つきの一覧だけで出典と分かる・モックと同じ）
          n.children = n.children.filter((c) => !(isEl(c) && /^h\d$/.test(c.tagName)));
        }
        walk(n.children);
      }
    };
    walk(tree.children);
  };
}

/** 書きかけの崩れを閉じる：閉じていないコードの囲い・数式の囲い */
export function closeOpen(md: string): string {
  let s = md;
  const fences = s.split("\n").filter((l) => /^\s*(```|~~~)/.test(l)).length;
  if (fences % 2 === 1) s += "\n```";
  const dollars = (s.match(/\$\$/g) ?? []).length;
  if (dollars % 2 === 1) s += "\n$$";
  return s;
}

/** Kaname の中の実物へのリンク（kaname://goal/<id> 等）を画面の道に（D-104.3）。知らない種類は null */
const KIND: Record<string, { route: (id: string) => string; label: string; icon: ReactNode }> = {
  goal: { route: (id) => `/goals?id=${encodeURIComponent(id)}`, label: "目標", icon: <Target /> },
  task: { route: (id) => `/tasks?id=${encodeURIComponent(id)}`, label: "タスク", icon: <ListChecks /> },
  member: { route: (id) => `/members/${encodeURIComponent(id)}`, label: "人", icon: <User /> },
  staff: { route: (id) => `/ai-staff/${encodeURIComponent(id)}`, label: "AI社員", icon: <Bot /> },
  approval: { route: (id) => `/approvals?id=${encodeURIComponent(id)}`, label: "承認待ち", icon: <Inbox /> },
  memory: { route: (id) => `/ai/memory?id=${encodeURIComponent(id)}`, label: "記憶", icon: <Brain /> },
};
export function kanameLink(href: string): { to: string; label: string; icon: ReactNode } | null {
  const m = /^kaname:\/\/([a-z]+)\/([^/?#\s]+)$/.exec(href);
  const k = m ? KIND[m[1] ?? ""] : undefined;
  return m && k ? { to: k.route(m[2] ?? ""), label: k.label, icon: k.icon } : null;
}

// ---- コードの枠（言語名・色分け・コピー・長いと畳む）
const FOLD_LINES = 24;
/** shiki の色の変数を、DESIGN の syntax のトークンに当てる（色の値はトークンだけ） */
const SYNTAX_VARS = {
  "--shiki-foreground": "var(--on-surface)",
  "--shiki-background": "transparent",
  "--shiki-token-keyword": "var(--syn-keyword)",
  "--shiki-token-string": "var(--syn-string)",
  "--shiki-token-string-expression": "var(--syn-string)",
  "--shiki-token-constant": "var(--syn-number)",
  "--shiki-token-comment": "var(--syn-comment)",
  "--shiki-token-function": "var(--syn-function)",
  "--shiki-token-parameter": "var(--syn-type)",
  "--shiki-token-punctuation": "var(--on-surface)",
  "--shiki-token-link": "var(--primary)",
} as Record<string, string>;
function CodeBlock({ lang, code, streaming }: { lang: string; code: string; streaming: boolean }) {
  const exportAs = useContext(ExportContext);
  const lines = code.replace(/\n$/, "").split("\n");
  const [open, setOpen] = useState(false);
  const shown = open || lines.length <= FOLD_LINES ? lines.join("\n") : lines.slice(0, FOLD_LINES).join("\n");
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    if (streaming) return; // 書きかけの間は色を付けない（書くたびに作り直さない）
    let alive = true;
    void import("shiki")
      .then(async ({ codeToHtml, createCssVariablesTheme }) => {
        const theme = createCssVariablesTheme({ name: "kaname", variablePrefix: "--shiki-" });
        return codeToHtml(shown, { lang: lang || "text", theme }).catch(() => codeToHtml(shown, { lang: "text", theme }));
      })
      .then((h) => alive && setHtml(h))
      .catch(() => alive && setHtml(null));
    return () => {
      alive = false;
    };
  }, [shown, lang, streaming]);
  return (
    <div className="codeblk" data-lang={lang || "text"}>
      <div className="cbar">
        <span>{lang || "文字"}</span>
        <button type="button" onClick={() => void copyText(code, "コードをコピーしました")}>
          <Copy />
          コピー
        </button>
        {exportAs && /^csv$/i.test(lang) && !streaming ? (
          <button type="button" onClick={() => exportAs(code, "csv")} data-export-csv>
            <FileText />
            書き出す
          </button>
        ) : null}
      </div>
      {html ? (
        // shiki が作った HTML（コードの中身は shiki が逃がしている）
        <div style={SYNTAX_VARS} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre>
          <code>{shown}</code>
        </pre>
      )}
      {lines.length > FOLD_LINES && !open ? (
        <button type="button" className="cmore" onClick={() => setOpen(true)}>
          残り {lines.length - FOLD_LINES} 行を開く
        </button>
      ) : null}
    </div>
  );
}

// ---- 作業の記録（D-104.6）：差分（+N −M つき）・打ったコマンドと結果・フォルダの木
function DiffBlock({ code, name }: { code: string; name: string }) {
  const lines = code.replace(/\n$/, "").split("\n");
  const add = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
  const rem = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
  return (
    <div className="diffblk" data-block="diff">
      <div className="cbar">
        <span>{name || "差分"}</span>
        <span className="dc">
          <i className="a">+{add}</i> <i className="r">−{rem}</i>
        </span>
      </div>
      {lines
        .filter((l) => !/^(\+\+\+|---|@@|diff |index )/.test(l))
        .map((l, i) => {
          const k = l.startsWith("+") ? "a" : l.startsWith("-") ? "r" : "";
          return (
            <div key={i} className={`dl ${k}`}>
              <span className="sg">{k === "a" ? "+" : k === "r" ? "−" : " "}</span>
              {k ? l.slice(1) : l.replace(/^ /, "")}
            </div>
          );
        })}
    </div>
  );
}
function TerminalBlock({ code }: { code: string }) {
  const lines = code.replace(/\n$/, "").split("\n");
  return (
    <div className="term" data-block="terminal">
      <div className="cbar">
        <span>打ったコマンド</span>
        <button type="button" onClick={() => void copyText(lines.filter((l) => l.startsWith("$ ")).map((l) => l.slice(2)).join("\n"), "コマンドをコピーしました")}>
          <Copy />
          コピー
        </button>
      </div>
      <pre>
        {lines.map((l, i) => (l.startsWith("$ ") ? <b key={i}>{`${l}\n`}</b> : `${l}\n`))}
      </pre>
    </div>
  );
}

// ---- 流れ図・順序図（mermaid。使うときだけ読む）
function Mermaid({ code, streaming }: { code: string; streaming: boolean }) {
  const id = useId().replace(/[^a-z0-9]/gi, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (streaming) return;
    let alive = true;
    void import("mermaid")
      .then(async ({ default: mermaid }) => {
        const css = getComputedStyle(document.documentElement);
        const v = (k: string) => css.getPropertyValue(k).trim();
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          fontFamily: v("--font"),
          themeVariables: {
            primaryColor: v("--card"),
            primaryTextColor: v("--on-surface"),
            primaryBorderColor: v("--line"),
            lineColor: v("--neutral"),
            secondaryColor: v("--primary-c"),
            tertiaryColor: v("--surface"),
          },
        });
        const r = await mermaid.render(`mm-${id}`, code);
        if (alive) setSvg(r.svg);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [code, id, streaming]);
  if (failed || streaming || !svg) return <CodeBlock lang="mermaid" code={code} streaming={streaming} />;
  // mermaid が strict で作った SVG（中の文字は mermaid が逃がしている）
  return <div className="fchart" role="img" aria-label="流れ図" dangerouslySetInnerHTML={{ __html: svg }} />;
}

// ---- 数式（ブラウザの MathML・書体を増やさない）
function MathML({ tex, display }: { tex: string; display: boolean }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void import("temml")
      .then(({ default: temml }) => alive && setHtml(temml.renderToString(tex, { displayMode: display, throwOnError: false })))
      .catch(() => alive && setHtml(null));
    return () => {
      alive = false;
    };
  }, [tex, display]);
  if (!html) return <code className="ic">{tex}</code>;
  // temml が作った MathML（trust は既定の false。\href などは作らない）
  return display ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// ---- 表（横に長いときは表だけ動く・表ごとコピー・列で並べ替え）
function rowsOf(table: HElement | undefined): { head: string[]; body: string[][] } {
  const sec = (tag: string) => table?.children.filter(isEl).find((c) => c.tagName === tag);
  const cells = (tr: HElement) => tr.children.filter(isEl).map((c) => textOf(c).trim());
  const head = sec("thead")?.children.filter(isEl).map(cells)[0] ?? [];
  const body = sec("tbody")?.children.filter(isEl).map(cells) ?? [];
  return { head, body };
}
const num = (s: string) => {
  const n = Number(s.replace(/[,¥円%\s]/g, ""));
  return Number.isFinite(n) && /\d/.test(s) ? n : null;
};
function MdTable({ node, children }: { node?: HElement; children?: ReactNode }) {
  const { head, body } = useMemo(() => rowsOf(node), [node]);
  const exportAs = useContext(ExportContext);
  const [sort, setSort] = useState<{ col: number; asc: boolean } | null>(null);
  const order = useMemo(() => {
    const idx = body.map((_, i) => i);
    if (!sort) return idx;
    const key = (i: number) => body[i]?.[sort.col] ?? "";
    return idx.sort((a, b) => {
      const x = key(a);
      const y = key(b);
      const nx = num(x);
      const ny = num(y);
      const c = nx !== null && ny !== null ? nx - ny : x.localeCompare(y, "ja");
      return sort.asc ? c : -c;
    });
  }, [body, sort]);
  const tsv = [head, ...body].map((r) => r.join("\t")).join("\n");
  // 見出しを押すと、その列で並べ替える（もう一度押すと逆順）
  const parts = Children.toArray(children).filter(isValidElement) as ReactElement<{ children?: ReactNode }>[];
  const thead = parts[0];
  const tbody = parts[1];
  const rows = tbody ? (Children.toArray(tbody.props.children).filter(isValidElement) as ReactElement[]) : [];
  return (
    <div className="mtable">
      <div className="mtbar">
        <span className="muted">表{head.length ? " · 見出しを押すと並べ替え" : ""}</span>
        <button type="button" onClick={() => void copyText(tsv, "表をコピーしました（Excel に貼れます）")}>
          <Copy />
          コピー
        </button>
        <button type="button" onClick={() => downloadCsv([head, ...order.map((i) => body[i] ?? [])])} data-csv>
          <Download />
          CSV
        </button>
        {exportAs ? (
          <button type="button" onClick={() => exportAs(csvText([head, ...body]), "csv")} data-export-table>
            <FileText />
            書き出す
          </button>
        ) : null}
      </div>
      <div className="tscroll">
        <table>
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={`${h}-${i}`} aria-sort={sort?.col === i ? (sort.asc ? "ascending" : "descending") : "none"}>
                  <button type="button" onClick={() => setSort((s) => (s?.col === i ? { col: i, asc: !s.asc } : { col: i, asc: true }))}>
                    {h}
                    {sort?.col === i ? <ChevronDown style={sort.asc ? undefined : { transform: "rotate(180deg)" }} /> : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          {head.length ? <tbody>{order.map((i) => rows[i] ?? null)}</tbody> : (thead ?? null)}
        </table>
      </div>
    </div>
  );
}

/** 表を CSV で落とす（Excel で開ける BOM つき・D-104.5） */
function downloadCsv(rows: string[][]) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = "\ufeff" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "表.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ---- 目次（長い返事・見出しが 3 つ以上）
const TOC_MIN_CHARS = 1500;
function useToc(ref: RefObject<HTMLDivElement | null>, text: string): { id: string; t: string }[] {
  const [toc, setToc] = useState<{ id: string; t: string }[]>([]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || text.length < TOC_MIN_CHARS) return setToc([]);
    const hs = [...el.querySelectorAll<HTMLElement>("h2.mh[id],h3.mh[id]")].map((h) => ({ id: h.id, t: h.textContent ?? "" }));
    setToc(hs.length >= 3 ? hs : []);
  }, [ref, text]);
  return toc;
}

function makeComponents(streaming: boolean): Components {
  const H = (level: 2 | 3 | 4) =>
    function Heading({ id, children }: { id?: string; children?: ReactNode }) {
      const Tag = `h${level}` as "h2";
      return (
        <Tag id={id} className="mh">
          {children}
        </Tag>
      );
    };
  return {
    h1: H(2),
    h2: H(3),
    h3: H(4),
    h4: H(4),
    table: ({ node, children }) => <MdTable node={node as unknown as HElement}>{children}</MdTable>,
    pre: ({ node }) => {
      const code = (node as unknown as HElement).children.find(isEl);
      const cls = code ? classOf(code) : [];
      const text = code ? textOf(code) : "";
      if (cls.includes("math-display")) return <MathML tex={text} display />;
      const lang = cls.find((c) => c.startsWith("language-"))?.slice(9) ?? "";
      if (lang === "mermaid") return <Mermaid code={text} streaming={streaming} />;
      if (lang === "diff" || lang.startsWith("diff:")) return <DiffBlock code={text} name={lang.slice(5)} />;
      if (["console", "shell-session", "terminal"].includes(lang) || (["sh", "bash", "shell", "zsh"].includes(lang) && /^\$ /m.test(text)))
        return <TerminalBlock code={text} />;
      if (lang === "tree")
        return (
          <pre className="ftree" data-block="tree">
            {text.replace(/\n$/, "")}
          </pre>
        );
      return <CodeBlock lang={lang} code={text} streaming={streaming} />;
    },
    code: ({ className, children }) =>
      String(className ?? "").includes("math-inline") ? (
        <MathML tex={String(children ?? "")} display={false} />
      ) : (
        <code className="ic">{children}</code>
      ),
    a: ({ href = "", children }) => {
      const k = kanameLink(href);
      // まだ無い画面へは押させない（押すと 404 の行き止まり・G-04）
      if (k) return isBuilt(k.to) ? <Link href={k.to as Route}>{children}</Link> : <span title={`${k.label}の画面は準備中です`}>{children}</span>;
      if (href.startsWith("#")) return <a href={href}>{children}</a>;
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    },
    // 段落にリンクが 1 つだけ（Kaname の実物）なら、押すと開くカードにする（D-104.5）
    p: ({ node, children }) => {
      const kids = ((node as unknown as HElement).children ?? []).filter((c) => !(c.type === "text" && !(c as HText).value.trim()));
      const only = kids.length === 1 && isEl(kids[0]) && kids[0].tagName === "a" ? kids[0] : null;
      const k = only ? kanameLink(String(only.properties["href"] ?? "")) : null;
      if (only && k) {
        const inner = (
          <>
            <span className="et">
              {k.icon}
              {k.label}
            </span>
            <b>{textOf(only)}</b>
            <span className="em">{isBuilt(k.to) ? "押すと開きます" : `${k.label}の画面は準備中です`}</span>
          </>
        );
        return isBuilt(k.to) ? (
          <Link className="ecard" href={k.to as Route} data-entity>
            {inner}
          </Link>
        ) : (
          <div className="ecard" data-entity>
            {inner}
          </div>
        );
      }
      return <p className="mp">{children}</p>;
    },
    div: ({ className, children, ...rest }) => {
      const cls = String(className ?? "");
      if (cls.startsWith("callout")) {
        const kind = cls.includes("danger") ? "danger" : cls.includes("warn") ? "warn" : "info";
        const title = (rest as { "data-title"?: string })["data-title"] ?? "";
        return (
          <div className={cls} role="note">
            {kind === "danger" ? <OctagonAlert /> : kind === "warn" ? <AlertTriangle /> : <Info />}
            <div>
              <b>{title}</b>
              {children}
            </div>
          </div>
        );
      }
      return <div className={cls || undefined}>{children}</div>;
    },
    ul: ({ className, children }) => <ul className={String(className ?? "").includes("contains-task-list") ? "chk" : undefined}>{children}</ul>,
    li: ({ node, className, children }) => {
      if (!String(className ?? "").includes("task-list-item")) return <li>{children}</li>;
      const box = (node as unknown as HElement).children.find((c) => isEl(c) && c.tagName === "input") as HElement | undefined;
      const on = box?.properties["checked"] === true;
      return (
        <li className={on ? "on" : undefined}>
          <span className="box">{on ? <Check /> : null}</span>
          {children}
        </li>
      );
    },
    input: () => null,
    details: ({ children, open }) => (
      <details className="mdet" open={open}>
        {children}
      </details>
    ),
    img: ({ src, alt }) =>
      typeof src === "string" ? (
        <figure className="imgbox">
          <a href={src} target="_blank" rel="noopener noreferrer" aria-label={`${alt ?? "画像"}を大きく開く`}>
            {/* 返事の中の画像は大きさが分からないので、そのまま出す（押すと大きく） */}
            <img src={src} alt={alt ?? ""} loading="lazy" style={{ maxWidth: "100%", display: "block" }} />
          </a>
          {alt ? <figcaption>{alt} · 押すと大きく</figcaption> : null}
        </figure>
      ) : null,
  };
}

/** 返事 1 つ分の書式。streaming の間は崩れを閉じ、色付け・図は書き終わってから */
/** Kaname の画面は絵文字を出さない（アイコンは Lucide だけ）。自分のAI が書いても消して描く */
//   消すのは絵として出る文字（🎯・✅・1️⃣・国旗・肌の色・つないだ絵）だけ。© ® ™ ✔ ↑ のような記号は残す
const EMOJI =
  /(?:(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}\u{FE0F})[\u{1F3FB}-\u{1F3FF}]?(?:\u{200D}(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}\u{FE0F}?)[\u{1F3FB}-\u{1F3FF}]?)*\u{FE0F}?|[#*0-9]\u{FE0F}?\u{20E3}|\p{Regional_Indicator}{2})[ \u{3000}]?/gu;
export const noEmoji = (t: string): string => t.replace(EMOJI, "");
export function Markdown({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const clean = noEmoji(text);
  const src = streaming ? closeOpen(clean) : clean;
  const components = useMemo(() => makeComponents(streaming), [streaming]);
  const toc = useToc(ref, streaming ? "" : clean);
  return (
    <div ref={ref} className="mdoc" style={{ display: "contents" }}>
      {toc.length ? (
        <nav className="mtoc" aria-label="この返事の目次">
          <b>目次</b>
          {toc.map((h, i) => (
            <a key={h.id} href={`#${h.id}`}>
              {i + 1}. {h.t}
            </a>
          ))}
        </nav>
      ) : null}
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCjkFriendly, remarkMath]}
        remarkRehypeOptions={{ clobberPrefix: "" }}
        urlTransform={(u) => (u.startsWith("kaname://") ? u : defaultUrlTransform(u))}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, SCHEMA], rehypeKaname]}
        components={components}
      >
        {src}
      </ReactMarkdown>
      {streaming ? <span className="streaming">…</span> : null}
    </div>
  );
}
