#!/usr/bin/env python3
"""画面が「もうある route」の一覧を、実ファイル（app/**/page.tsx）から生成する。

  python3 scripts/ci/gen_built_routes.py --app apps/web/app --out apps/web/lib/built-routes.ts

由来：ナビ（flow.json から機械生成）は、まだ作っていない画面も指す。押すと 404 になり、
利用者は行き止まりに当たる（2026-09-22 user「残っている 404 もやりましょうかね」）。
ナビから消すのは嘘（その画面は設計にある）。押せない印を出すために、実ファイルの集合を画面側に渡す。
手で書かない（鮮度は apps/web/tests/reachability.spec.ts が実ファイルと突き合わせて検査する）。
"""
from __future__ import annotations
import argparse, os, re


def routes(app: str) -> list[str]:
    out: list[str] = []
    for dirpath, dirnames, files in os.walk(app):
        if not any(re.fullmatch(r"page\.(tsx|ts|jsx|js)", f) for f in files):
            continue
        rel = os.path.relpath(dirpath, app)
        segs = [] if rel == "." else [s for s in rel.split(os.sep) if not (s.startswith("(") and s.endswith(")"))]
        segs = [re.sub(r"^\[(\w+)\]$", r":\1", s) for s in segs]
        out.append("/" + "/".join(segs) if segs else "/")
    return sorted(set(out))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--app", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    rs = routes(a.app)
    body = "\n".join(f'  "{r}",' for r in rs)
    txt = (
        "// もうある画面の route（機械生成：scripts/ci/gen_built_routes.py）。手で直さない。\n"
        "// ナビはまだ作っていない画面も指す（設計にはある）。押すと 404 の行き止まりになるので、\n"
        "// 画面側はこの一覧で「準備中」を出し、押させない。画面が増えれば自動で消える印。\n"
        "export const BUILT_ROUTES: readonly string[] = [\n" + body + "\n] as const;\n\n"
        "/** その route の画面がもうあるか（:id は実際の値でも合う） */\n"
        "export function isBuilt(route: string): boolean {\n"
        "  const p = route.split(\"?\")[0]!.replace(/\\/+$/, \"\") || \"/\";\n"
        "  return BUILT_ROUTES.some((b) => {\n"
        "    if (b === p) return true;\n"
        "    const bs = b.split(\"/\");\n"
        "    const ps = p.split(\"/\");\n"
        "    return bs.length === ps.length && bs.every((s, i) => s.startsWith(\":\") || s === ps[i]);\n"
        "  });\n"
        "}\n"
    )
    old = open(a.out, encoding="utf-8").read() if os.path.exists(a.out) else ""
    if old != txt:
        open(a.out, "w", encoding="utf-8").write(txt)
    print(f"{a.out}: もうある画面 {len(rs)} 件{'（更新）' if old != txt else '（変更なし）'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
