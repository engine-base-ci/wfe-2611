// 新しい画面のトークンと部品（K-24）
//   ・トークン（styles/k-tokens.css）は正本 DESIGN-kaname.md から作ったものと同じ（手で直していない）。明るい・暗いともコントラスト AA 以上
//   ・部品（components/k）に生の色・文字の大きさ・角丸・書体が無い。読んでいる --k-* は全部ある（打ち間違いで色が消えない）
//   ・暗いテーマは明るいテーマと同じ色の名前を全部持つ
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseTheme, themeAttr, themeCookie } from "../lib/theme";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = readFileSync(join(WEB, "styles/k-tokens.css"), "utf8");
const defined = new Set([...tokens.matchAll(/(--k-[\w-]+)\s*:/g)].map((m) => m[1]!));
const partsDir = join(WEB, "components/k");
const parts = readdirSync(partsDir)
  .filter((f) => /\.(css|tsx|ts)$/.test(f))
  .map((f) => ({ f, src: readFileSync(join(partsDir, f), "utf8").replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "") }));

/** CSS の宣言と、TSX の style={{ }} の中から「生の値」を拾う */
function rawValues(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/#[0-9a-fA-F]{3,8}\b(?![\w-])/g))
    if (!/&#/.test(src.slice(m.index! - 1, m.index! + 1))) out.push(m[0]);
  for (const m of src.matchAll(/\b(?:rgba?|hsla?|oklch|lab)\(/g)) out.push(m[0]);
  for (const m of src.matchAll(/\b(white|black)\b(?=\s*[;}"])/g)) out.push(m[0]);
  for (const prop of [
    "font-size",
    "fontSize",
    "border-radius",
    "borderRadius",
    "font-family",
    "fontFamily",
    "line-height",
    "lineHeight",
  ]) {
    for (const m of src.matchAll(new RegExp(`${prop}\\s*:\\s*([^;}\\n]+)`, "g"))) {
      const v = m[1]!
        .trim()
        .replace(/[",]+$/g, "")
        .replace(/^"/, "");
      const ok = (x: string) => /^var\(--k-[\w-]+\)$/.test(x) || x === "inherit" || x === "0";
      if (!v.split(/\s+/).every(ok)) out.push(`${prop}: ${v}`);
    }
  }
  return out;
}

describe("トークン（K-24）", () => {
  // 正本どおりか・コントラストは CI の G37（python3 04_design/gen_tokens.py --web --check）が見る。ここは手で直していない印だけ
  it("styles/k-tokens.css は生成物（手で書かない）", () => {
    expect(tokens.startsWith("/* DESIGN-kaname.md から機械生成。手で書かない（04_design/gen_tokens.py --web")).toBe(
      true,
    );
  });
  it("暗いテーマは明るいテーマと同じ色の名前を全部持つ（片方だけの色が無い）", () => {
    const block = (re: RegExp) =>
      new Set([...(re.exec(tokens)?.[1] ?? "").matchAll(/(--k-[\w-]+)\s*:\s*#/g)].map((m) => m[1]!));
    const light = block(/^:root \{([\s\S]*?)^\}/m);
    const dark = block(/^:root\[data-theme="dark"\] \{([\s\S]*?)^\}/m);
    const sys = block(/:root:not\(\[data-theme="light"\]\) \{([\s\S]*?)^ {2}\}/m);
    expect(light.size).toBeGreaterThan(60);
    expect([...light].filter((k) => !dark.has(k))).toEqual([]);
    expect([...dark].sort()).toEqual([...sys].sort());
  });
});

describe("部品に生の値が無い（K-24・design_gate の D1〜D4 と同じ考え）", () => {
  for (const { f, src } of parts) {
    it(`${f}：生の色・文字の大きさ・角丸・書体が無い`, () => {
      expect(rawValues(src)).toEqual([]);
    });
    it(`${f}：読んでいる --k-* は全部トークンにある`, () => {
      const used = [...src.matchAll(/var\((--k-[\w-]+)\)/g)].map((m) => m[1]!);
      expect(used.filter((v) => !defined.has(v))).toEqual([]);
    });
  }
  it("検査そのものが生の値を見つけられる（見張りが働いている）", () => {
    expect(rawValues(".a{color:#22345C;font-size:13px;border-radius:4px}")).toHaveLength(3);
    expect(rawValues('<i style={{ fontSize: "12px", color: "rgb(0,0,0)" }} />')).toHaveLength(2);
    expect(rawValues(".a{font-size:var(--k-text-body);border-radius:var(--k-r-md)}")).toEqual([]);
    expect(rawValues(".a{border-radius:var(--k-r-lg) var(--k-r-lg) 0 0}")).toEqual([]);
    expect(rawValues(".a{border-radius:var(--k-r-lg) 3px}")).toHaveLength(1);
  });
});

describe("見た目の切り替え（D-128.55）", () => {
  it("知らない値・無い値は明るい（D-129.45・OS に引っ張られない）。選んだ値はそのまま", () => {
    expect(parseTheme(undefined)).toBe("light");
    expect(parseTheme("")).toBe("light");
    expect(parseTheme("blue")).toBe("light");
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme("dark")).toBe("dark");
    expect(themeAttr(parseTheme(undefined))).toBe("light"); // 選んでいない人にも data-theme=light を付ける（CSS の prefers-color-scheme が効かない）
  });
  it("システムのときは data-theme を付けない（CSS の prefers-color-scheme に任せる）", () => {
    expect(themeAttr("system")).toBeUndefined();
    expect(themeAttr("light")).toBe("light");
    expect(themeCookie("dark")).toMatch(/^k-theme=dark; Path=\/; Max-Age=31536000; SameSite=Lax$/);
  });
});

describe("書体が本当に読み込まれる（D-128.123・K-38：名前の指定だけで通さない）", () => {
  const layout = readFileSync(join(WEB, "app/layout.tsx"), "utf8");
  const fam = /--k-font:\s*"([^"]+)"/.exec(tokens)?.[1] ?? "";
  it("画面の根（layout.tsx）が書体の部品を読み込み、その部品の書体の名前が --k-font に入っている", () => {
    const pkg = /import\s+"(@fontsource(?:-variable)?\/[\w-]+)"/.exec(layout)?.[1];
    expect(pkg, "layout.tsx が書体の部品（@fontsource）を import していない").toBeTruthy();
    const css = readFileSync(join(WEB, "node_modules", pkg!, "index.css"), "utf8");
    const loaded = /font-family:\s*'([^']+)'/.exec(css)?.[1];
    expect(loaded, "書体の部品に font-family が無い").toBeTruthy();
    expect(tokens).toContain(`"${loaded}"`);
    // 読み込む書体は、正本の書体と同じもの（「Noto Sans JP」と「Noto Sans JP Variable」）
    expect(loaded!.replace(/ Variable$/, "")).toBe(fam);
  });
  it("書体は画面と同じ所から配る（CSP の font-src は self と data: だけ）", () => {
    const sh = readFileSync(join(WEB, "lib/security-headers.ts"), "utf8");
    expect(sh).toMatch(/"font-src":\s*\["'self'",\s*"data:"\]/);
  });
});
