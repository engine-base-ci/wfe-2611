// Bridge の画面（renderer）の見た目の土台（K-29・D-128.123）
//   ・読んでいる var(--…) が全部トークン（tokens.css・正本から生成）にある（名前が変わって指定が黙って消えるのを止める）
//   ・画面に生の色を書かない
//   ・書体（Noto Sans JP）を同梱して読む（利用者の PC に無くても同じ字で出す）
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const BRIDGE = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(BRIDGE, "src/renderer/index.html"), "utf8");
const tokens = readFileSync(join(BRIDGE, "src/renderer/tokens.css"), "utf8");
const copy = readFileSync(join(BRIDGE, "scripts/copy-renderer.mjs"), "utf8");
const pkg = JSON.parse(readFileSync(join(BRIDGE, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
};

describe("Bridge の画面の土台（K-29）", () => {
  it("読んでいる var(--…) は全部 tokens.css にある", () => {
    const used = new Set([...html.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]!));
    const defined = new Set([...tokens.matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1]!));
    expect([...used].filter((v) => !defined.has(v))).toEqual([]);
    expect(used.size).toBeGreaterThan(20);
  });
  it("tokens.css は正本から作ったもの（手で書かない）", () => {
    expect(tokens.startsWith("/* DESIGN-kaname.md から機械生成。手で書かない（04_design/gen_tokens.py）*/")).toBe(true);
  });
  it("画面に生の色を書かない", () => {
    const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? "";
    expect(style.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) ?? []).toEqual([]);
  });
  it("書体を同梱して読む：画面が書体の CSS を読み、組み立てでその CSS と字の形を写し、--font-sans にその名前がある", () => {
    expect(html).toMatch(/<link rel="stylesheet" href="\.\/fonts\/index\.css" \/>/);
    expect(pkg.scripts["build"]).toContain("copy-renderer.mjs");
    expect(pkg.dependencies["@fontsource-variable/noto-sans-jp"]).toBeTruthy();
    expect(copy).toMatch(/@fontsource-variable\/noto-sans-jp\/index\.css/);
    expect(copy).toMatch(/"files"/);
    const css = readFileSync(join(BRIDGE, "node_modules/@fontsource-variable/noto-sans-jp/index.css"), "utf8");
    const fam = /font-family:\s*'([^']+)'/.exec(css)?.[1];
    expect(tokens).toContain(`"${fam}"`);
    expect(existsSync(join(BRIDGE, "node_modules/@fontsource-variable/noto-sans-jp/files"))).toBe(true);
  });
  it("CSP は同じ所から読むだけ（書体のために外の宛先を足さない）", () => {
    expect(html).toContain(`content="default-src 'self'; style-src 'self' 'unsafe-inline'"`);
  });
});
