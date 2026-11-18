#!/usr/bin/env python3
"""口の登録の一覧と閉じる道の断片を、TS の生成物にまとめる作り手（K-326）。

  ① apps/api/src/hooks/*.ts（registry.ts と *.generated.ts を除く）の `export const register` を、ファイル名の順に
     apps/api/src/hooks/all.generated.ts の HOOK_MODULES に並べる。`export function <名前>Hooks(` を持つのに register が無ければ止める
  ② packages/auth/src/disabled-paths.d/K-<数字>.ts の PATHS を、番号の順に
     packages/auth/src/disabled-paths.generated.ts の FRAGMENT_DISABLED_PATHS に並べる。
     名前の決まりに合わない .ts・2 つの断片が同じ道・packages/auth/src/index.ts の DISABLED_PATHS の文字の道と同じ道は止める

使い方: python3 scripts/ci/gen_ts_registries.py [--check] [--root DIR]
  --check は書かずに、今の生成物と違えば 1。止まったときは何も書かない（1 で終わり、最後の行に止めた訳）
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

HOOKS_DIR = "apps/api/src/hooks"
HOOKS_OUT = "apps/api/src/hooks/all.generated.ts"
PARTS_DIR = "packages/auth/src/disabled-paths.d"
PARTS_OUT = "packages/auth/src/disabled-paths.generated.ts"
AUTH_INDEX = "packages/auth/src/index.ts"
HEAD = "// 生成物・手で直さない（scripts/ci/gen_ts_registries.py）"

_FACTORY = re.compile(r"export\s+function\s+\w+Hooks\s*\(")
_REGISTER = re.compile(r"export\s+const\s+register\b")
_PART_NAME = re.compile(r"^K-(\d+)\.ts$")
_PATHS = re.compile(r"export\s+const\s+PATHS\s*=\s*\[(.*?)\]", re.S)
_STR = re.compile(r"\"(/[^\"]*)\"")
_BASE = re.compile(r"export\s+const\s+DISABLED_PATHS\s*=\s*\[(.*?)\]\s*as\s+const", re.S)


def _camel(stem: str) -> str:
    head, *rest = re.split(r"[-_.]", stem)
    return head + "".join(w[:1].upper() + w[1:] for w in rest)


def hook_files(root: Path) -> list[Path]:
    d = root / HOOKS_DIR
    if not d.is_dir():
        return []
    return sorted(
        f for f in d.glob("*.ts") if f.name != "registry.ts" and not f.name.endswith(".generated.ts")
    )


def build_hooks(root: Path) -> tuple[str, list[str]]:
    problems: list[str] = []
    names: dict[str, str] = {}
    lines = [HEAD, 'import type { HookModule } from "./registry.js";']
    order: list[str] = []
    for f in hook_files(root):
        src = f.read_text(encoding="utf-8")
        if not _REGISTER.search(src):
            if _FACTORY.search(src):
                problems.append(f"{HOOKS_DIR}/{f.name} が hooks の工場を持つのに export const register が無い")
            continue
        name = _camel(f.stem)
        if not re.fullmatch(r"[A-Za-z_$][\w$]*", name):
            problems.append(f"{HOOKS_DIR}/{f.name} の名前 {name} は TS の名前にならない")
            continue
        if name in names:
            problems.append(f"{HOOKS_DIR}/{names[name]} と {f.name} が同じ名前 {name} になる")
            continue
        names[name] = f.name
        lines.append(f'import {{ register as {name} }} from "./{f.stem}.js";')
        order.append(name)
    lines.append(f"export const HOOK_MODULES: readonly HookModule[] = [{', '.join(order)}];")
    return "\n".join(lines) + "\n", problems


def _base_paths(root: Path) -> set[str]:
    """index.ts の DISABLED_PATHS の中の文字の道だけ（広げた名前は読めないので見ない）"""
    p = root / AUTH_INDEX
    if not p.is_file():
        return set()
    m = _BASE.search(p.read_text(encoding="utf-8"))
    return set(_STR.findall(m.group(1))) if m else set()


def build_parts(root: Path) -> tuple[str, list[str]]:
    problems: list[str] = []
    d = root / PARTS_DIR
    parts: list[tuple[int, str, list[str]]] = []
    if d.is_dir():
        for f in sorted(d.iterdir()):
            if f.name.startswith(".") or f.suffix != ".ts":
                continue  # 隠しファイル・README などは断片でない
            m = _PART_NAME.match(f.name)
            if not m:
                problems.append(f"{PARTS_DIR}/{f.name} は名前の決まり（K-<番号>.ts）に合わない")
                continue
            body = _PATHS.search(f.read_text(encoding="utf-8"))
            if not body:
                problems.append(f"{PARTS_DIR}/{f.name} に export const PATHS = [\"/…\"] が無い")
                continue
            parts.append((int(m.group(1)), f.name, _STR.findall(body.group(1))))
    parts.sort()
    seen: dict[str, str] = {p: AUTH_INDEX for p in _base_paths(root)}
    for _n, fname, paths in parts:
        for path in paths:
            if path in seen:
                problems.append(f"{seen[path]} と {fname} が同じ道 {path} を持つ")
            else:
                seen[path] = fname
    lines = [HEAD]
    lines += [f'import {{ PATHS as k{n} }} from "./disabled-paths.d/K-{n}.js";' for n, _f, _p in parts]
    spread = ", ".join(f"...k{n}" for n, _f, _p in parts)
    lines.append(f"export const FRAGMENT_DISABLED_PATHS = [{spread}] as const;")
    return "\n".join(lines) + "\n", problems


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", default=str(Path(__file__).resolve().parent.parent.parent))
    ap.add_argument("--check", action="store_true", help="書かずに、今の生成物と違えば 1")
    a = ap.parse_args(argv)
    root = Path(a.root)
    hooks, p1 = build_hooks(root)
    parts, p2 = build_parts(root)
    problems = p1 + p2
    if problems:
        print(f"[gen-ts-registries] FAIL — {len(problems)} 件（何も書かない）")
        for p in problems:
            print(f"[gen-ts-registries] NG {p}")
        return 1
    outs = {HOOKS_OUT: hooks, PARTS_OUT: parts}
    if a.check:
        stale = [rel for rel, text in outs.items() if not (root / rel).is_file() or (root / rel).read_text(encoding="utf-8") != text]
        if stale:
            print(f"[gen-ts-registries] FAIL — 生成物が古い：{'・'.join(stale)}（python3 scripts/ci/gen_ts_registries.py で作り直す）")
            return 1
        print("[gen-ts-registries] PASS — 生成物は最新")
        return 0
    for rel, text in outs.items():  # 中身が同じでも毎回書く（作り手が書く物と outputs をちょうど同じに）
        (root / rel).parent.mkdir(parents=True, exist_ok=True)
        (root / rel).write_text(text, encoding="utf-8")
    print(f"[gen-ts-registries] 書いた：{HOOKS_OUT}・{PARTS_OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
