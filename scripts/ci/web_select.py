#!/usr/bin/env python3
"""web の組（実ブラウザの試験）で、チケットの範囲の回に流す試験を選ぶ（K-177）。

決まり（D-133.7）：チケットの CI はチケットの範囲だけ・全部は大分類の終わりだけ。画面の試験のファイルはどれも 1 つのチケットが持つ
（test_owner_gate）。チケットは depends_on と changes（作ったファイル）を持つ。これで流す試験を決める：
  1. チケット自身の画面の試験
  2. depends_on のチケットの画面の試験（依存の依存はたどらない：そこは大分類の終わりの全部で見る）
  3. 変えた画面の試験のファイル・変えた試験の共通部品（apps/web/tests の spec でない物）を直に・間に挟んで読み込む試験
  4. 変えたファイルを changes に持つチケットの画面の試験（みんなが書き足す一覧のファイル＝cfg.registry は除く）
  5. 画面の試験の設定（cfg.all_on）を変えたら全部
選ぶ先は 2 つ：G48（apps/web/package.json の e2e:k の一覧）と G59（apps/web/tests/skeleton）。どちらにも無い試験は選ばない。
"""
from __future__ import annotations

import fnmatch
import json
import os
import re
import shlex

WEB = "apps/web/"
TESTS = "apps/web/tests/"
SKELETON = "apps/web/tests/skeleton/"


def _match(path: str, pat: str) -> bool:
    if "**" in pat:
        rx = "^" + re.escape(pat).replace(r"\*\*/", "(.*/)?").replace(r"\*\*", ".*").replace(r"\*", "[^/]*") + "$"
        return re.match(rx, path) is not None
    return fnmatch.fnmatchcase(path, pat) and (pat.count("/") == path.count("/") or "*" not in pat)


def _any(path: str, pats: list[str]) -> bool:
    return any(_match(path, p) for p in pats)


def select(changed: list[str], ticket: str, tickets: dict, g48: list[str], g59: list[str],
           importers: dict[str, set[str]], cfg: dict) -> dict:
    d48, d59 = set(g48), set(g59)
    dom = d48 | d59
    pick: set[str] = set()
    why: list[str] = []
    every = False
    own, tst = cfg.get("web_own") or ["apps/web/app/**"], cfg.get("web_tests") or ["apps/web/tests/**"]
    tests_of = lambda tid: {x for x in (tickets.get(tid) or {}).get("tests") or [] if x in dom}  # noqa: E731

    def built_by(f: str) -> set[str]:
        return {x for tid, t in tickets.items() if any(f == c or _match(f, c) for c in t.get("changes") or []) for x in tests_of(tid)}

    pick |= tests_of(ticket)
    for d in (tickets.get(ticket) or {}).get("depends_on") or []:
        pick |= tests_of(d)
    for f in changed:
        if _any(f, cfg.get("all_on") or []):
            every = True
            why.append(f"web：画面の試験の設定 {f} を変えた（全部に効く）")
        elif f in dom:
            pick.add(f)
        elif _any(f, tst):
            if f in importers:
                pick |= set(importers[f]) & dom
            elif not f.endswith(".spec.ts"):
                every = True
                why.append(f"web：試験の置き場の {f} はどの試験も読み込まない（設定と同じく全部に効く）")
        elif _any(f, own):
            hit = built_by(f)
            if hit:
                pick |= hit
            else:
                every = True
                why.append(f"web：画面のコード {f} を作ったチケットの試験に当たらない（黙って飛ばさず全部）")
        elif f.startswith(WEB):
            every = True
            why.append(f"web：共通の画面のコード {f}（どの画面が使うか決められないので全部）")
        elif not _any(f, cfg.get("registry") or []):
            pick |= built_by(f)
    if every:
        pick |= dom
    r48, r59 = sorted(pick & d48), sorted(pick & d59)
    owners = sorted({tid for tid, t in tickets.items() for x in t.get("tests") or [] if x in r48}, key=lambda s: int(s.split("-")[1]))
    if not r48 and not r59:
        why.append("web：チケット・依存・変えたファイルのどれにも当たる画面の試験が無い（大分類の終わりの全部で見る）")
    return {"g48": r48, "g59": r59, "tasks": owners, "reasons": why}


def domain_g48(repo: str) -> list[str]:
    """G48 の一覧：apps/web/package.json の e2e:k の「playwright test」の後の引数（ファイルか置き場）を開いた spec"""
    path = os.path.join(repo, WEB, "package.json")
    if not os.path.isfile(path):
        return []   # 画面の試験の一覧が無いリポジトリ（選ぶ物が無い）
    pkg = json.load(open(path, encoding="utf-8"))
    args = shlex.split((pkg.get("scripts") or {}).get("e2e:k", ""))
    args = args[args.index("test") + 1:] if "test" in args else []
    out: set[str] = set()
    for a in args:
        if a.startswith("-"):
            continue
        p = os.path.join(repo, WEB, a)
        if os.path.isfile(p):
            out.add(os.path.relpath(p, repo).replace(os.sep, "/"))
        elif os.path.isdir(p):
            for dp, _, fs in os.walk(p):
                out |= {os.path.relpath(os.path.join(dp, f), repo).replace(os.sep, "/") for f in fs if f.endswith(".spec.ts")}
    return sorted(out)


def domain_g59(repo: str) -> list[str]:
    root = os.path.join(repo, SKELETON)
    return sorted(os.path.relpath(os.path.join(dp, f), repo).replace(os.sep, "/")
                  for dp, _, fs in os.walk(root) for f in fs if f.endswith(".spec.ts")) if os.path.isdir(root) else []


IMPORT = re.compile(r"""(?:import|export)[^'"]*?from\s*['"](\.{1,2}/[^'"]+)['"]|import\(\s*['"](\.{1,2}/[^'"]+)['"]\s*\)""")


def importers(repo: str) -> dict[str, set[str]]:
    """apps/web/tests の spec でない物 → それを直に・間に挟んで読み込む spec"""
    root = os.path.join(repo, TESTS)
    files = [os.path.relpath(os.path.join(dp, f), repo).replace(os.sep, "/")
             for dp, _, fs in os.walk(root) for f in fs if f.endswith((".ts", ".tsx", ".mjs", ".js"))]
    deps: dict[str, set[str]] = {}
    for f in files:
        src = open(os.path.join(repo, f), encoding="utf-8", errors="replace").read()
        for m in IMPORT.finditer(src):
            rel = m.group(1) or m.group(2)
            base = os.path.normpath(os.path.join(os.path.dirname(f), rel)).replace(os.sep, "/")
            for cand in (base, base + ".ts", base + ".tsx", base + ".js", base + "/index.ts"):
                if cand in files:
                    deps.setdefault(f, set()).add(cand)
                    break
    specs = [f for f in files if f.endswith(".spec.ts")]
    out: dict[str, set[str]] = {}
    for s in specs:
        seen, stack = set(), list(deps.get(s, ()))
        while stack:
            x = stack.pop()
            if x in seen:
                continue
            seen.add(x)
            stack.extend(deps.get(x, ()))
        for x in seen:
            out.setdefault(x, set()).add(s)
    return out
