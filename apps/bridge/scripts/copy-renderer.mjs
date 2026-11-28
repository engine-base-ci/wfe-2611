/* global process */
// Bridge の画面（renderer）を dist に写す（K-29）：画面・トークン・書体（@fontsource-variable/noto-sans-jp を同梱）
//   利用者の PC に書体が無くても、正本の書体（Noto Sans JP・D-128.3）で出す。CSP は default-src 'self' のまま（同じ所から読む）
import { cpSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src", "renderer");
const out = join(here, "..", "dist", "renderer");
mkdirSync(join(out, "fonts"), { recursive: true });
for (const f of ["index.html", "tokens.css"]) cpSync(join(src, f), join(out, f));
const font = dirname(createRequire(import.meta.url).resolve("@fontsource-variable/noto-sans-jp/index.css"));
cpSync(join(font, "index.css"), join(out, "fonts", "index.css"));
cpSync(join(font, "files"), join(out, "fonts", "files"), { recursive: true });
cpSync(join(font, "LICENSE"), join(out, "fonts", "LICENSE"));
process.stdout.write(`[bridge renderer] ${out}（画面・トークン・書体）\n`);
