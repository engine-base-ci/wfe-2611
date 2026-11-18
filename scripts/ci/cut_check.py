#!/usr/bin/env python3
"""切る段の機械の検査の Kaname 側の口（ticket-flow の cut.scope_cmd・cut.prior_tests_cmd・cut.smoke・K-55 で足した）。

ticket-flow の cutcheck.py が、切る段の枝の写し（一時の作業場所）の根で流す。どれも本線のコードは変えない。

  python3 scripts/ci/cut_check.py scope --ticket K-xxx --files <changes: の物…>
      changes: を「変えたファイル」と見なして ci_scope.py の範囲の決め方（plan）に渡し、
      頭の欄に要る affects（変えたパッケージ）と ci_wide（範囲を広げる理由）を JSON で出す
  python3 scripts/ci/cut_check.py prior --files <changes: の物…>
      changes: のファイルを使う前からの試験（import で辿れる試験＋道を文字で書いている試験）を JSON の並びで出す
  python3 scripts/ci/cut_check.py smoke --junit <出す道> --tests <tests: の物…>
      使い捨ての DB を作って migration を当て、新しい試験（vitest の物）を JUnit の報告つきで流し、DB を消す。
      見るのは準備・後片付けの赤だけ（判定は cutcheck.py）。画面の試験（apps/web/tests の .spec.ts）は流さない（口と画面の台が要るため）

写しの作業場所には部品（node_modules）が無いので、smoke は lock のとおりに入れてから流す（scope と prior は部品を使わない）。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import pathlib
import subprocess
import sys
import uuid

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ci_scope  # noqa: E402

PG_CONTAINER = "kaname-pg"
PG_PORT = 55433
TEXT_TEST_SUFFIXES = (".test.ts", ".test.tsx", ".test.mjs", ".test.js", ".spec.ts", ".spec.tsx", ".spec.mjs", "_test.py")
PACKAGE_ROOT = re.compile(r"^(?:apps|packages)/[^/]+/")
MIN_REL = 15   # パッケージの根からの道で照らすときの最短の長さ（src/index.ts のような短い道で無関係の試験を拾わない）


def repo_root() -> pathlib.Path:
    return pathlib.Path(subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True).stdout.strip())


def install_deps(root: pathlib.Path) -> None:
    """写しに部品（node_modules）を入れる。lock のとおりに、手元の置き場から（速い・網に出ない）。
    本の作業場所の node_modules を指す印にはしない（本の作業場所は lock より古いことがあり、新しい部品が無くて落ちた・2026-11-18）"""
    if (root / "node_modules" / ".modules.yaml").is_file():
        return
    r = subprocess.run(["pnpm", "install", "--frozen-lockfile", "--prefer-offline"], cwd=root, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"★ 部品を入れられない（pnpm install が {r.returncode}）：{(r.stdout + r.stderr)[-800:]}")


# ---------------------------------------------------------------- scope
def scope(ticket: str, files: list[str]) -> dict:
    root = repo_root()
    rules = ci_scope.load_rules(str(root / "scripts" / "ci" / "ci_scope.json"))
    changes = [ci_scope.Change("M" if (root / f).exists() else "A", f, None) for f in files]
    saved = (ci_scope.changed_files, ci_scope.date_only, ci_scope._migration_list_only, ci_scope.subject_ids)
    ci_scope.changed_files = lambda *_a, **_k: changes
    ci_scope.date_only = lambda *_a, **_k: []
    ci_scope._migration_list_only = lambda _r, _b, _h, _ru, added, *_x: bool(added)
    ci_scope.subject_ids = lambda *_a, **_k: ([ticket], [])
    try:
        p = ci_scope.plan(str(root), "0" * 40, "HEAD", "auto", rules, str(root / "11_tickets"),
                          lambda fs: {f: [] for f in fs}, lambda: [], ticket=ticket)
    finally:
        ci_scope.changed_files, ci_scope.date_only, ci_scope._migration_list_only, ci_scope.subject_ids = saved
    wide = sorted({c for c, _ in p["wide_reasons"]})
    unmapped = sorted({x for c, x in p["full_reasons"] if c == "unmapped"})
    return {"affects": p["changed_packages"], "ci_wide": wide, "unmapped": unmapped}


# ---------------------------------------------------------------- prior
#   「使う」は、試験のファイルがそのファイルを直に import している（＝そのファイルを名指しで確かめている）か、道を文字で書いている物。
#   import を辿り切ると（vitest related）、口の入口を 1 つ変えただけで口の試験のほぼ全部が出て、1 件ずつの判断が意味を失うので辿らない。
#   直に import していない試験への響きは、作る段の CI（チケットの範囲＝vitest related）が見る。
SPEC = re.compile(r"""(?:from\s+|import\s*\(\s*|import\s+|require\s*\(\s*|vi\.mock\(\s*)["']([^"']+)["']""")
RESOLVE_EXT = ("", ".ts", ".tsx", ".mts", "/index.ts", "/index.tsx")


def _resolve(root: pathlib.Path, test: str, spec: str) -> str | None:
    if spec.startswith("."):
        base = (root / test).parent / spec
    elif spec.startswith("@/"):
        base = root / "apps" / "web" / spec[2:]
    elif spec.startswith("@kaname/"):
        pkg, _, sub = spec[len("@kaname/"):].partition("/")
        cand = [root / "packages" / pkg, root / "apps" / pkg]
        d = next((c for c in cand if c.is_dir()), None)
        if d is None:
            return None
        base = d / "src" / (sub or "index")
    else:
        return None
    stem = str(base)
    if stem.endswith((".js", ".mjs")):
        stem = stem.rsplit(".", 1)[0]
    for ext in RESOLVE_EXT:
        p = pathlib.Path(stem + ext)
        if p.is_file():
            try:
                return str(p.resolve().relative_to(root.resolve()))
            except ValueError:
                return None
    return None


def _is_test(path: str) -> bool:
    name = path.rsplit("/", 1)[-1]
    return path.endswith(TEXT_TEST_SUFFIXES) or (name.startswith("test_") and name.endswith(".py"))


def _ls(root: pathlib.Path, *paths: str) -> list[str]:
    # -z で読む（日本語の名前のファイルが "\346…" の形に化けて読み落とさない・TP-TOOL-01）
    out = subprocess.run(["git", "ls-files", "-z", "--", *paths], cwd=root, capture_output=True, text=True, check=True).stdout
    return [x for x in out.split("\0") if x]


def prior(files: list[str]) -> list[str]:
    root = repo_root()
    want: set[str] = set()
    skipped: list[str] = []
    for f in files:
        if (root / f).is_file():
            want.add(f)
        elif (root / f).is_dir():
            inside = _ls(root, f)   # フォルダは中のファイルに開く（黙って捨てない）
            want.update(inside)
            if not inside:
                skipped.append(f)
        else:
            skipped.append(f)   # まだ無い（これから足す）ファイル：使う前からの試験は無い
    if skipped:
        print("まだ無いので照らさない：" + "、".join(skipped), file=sys.stderr)
    # 文字で照らす道：根からの道と、パッケージの根からの道（試験が join(WEB, "app/…") のように相対で書く物）
    needles = {f: [f] + ([PACKAGE_ROOT.sub("", f)] if PACKAGE_ROOT.match(f) and len(PACKAGE_ROOT.sub("", f)) >= MIN_REL else [])
               for f in want}
    tests = [t for t in _ls(root) if _is_test(t)]
    found: set[str] = set()
    for t in tests:
        try:
            text = (root / t).read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        if any(n in text for ns in needles.values() for n in ns):
            found.add(t)
            continue
        for spec in SPEC.findall(text):
            if _resolve(root, t, spec) in want:
                found.add(t)
                break
    return sorted(found - set(files) - want)


# ---------------------------------------------------------------- smoke
def _psql(sql: str) -> None:
    subprocess.run(["docker", "exec", PG_CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-qc", sql],
                   check=True, capture_output=True, text=True)


def _empty_junit(path: pathlib.Path, note: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f'<?xml version="1.0"?>\n<testsuites name="{note}" tests="0" failures="0" errors="0"></testsuites>\n', encoding="utf-8")


def smoke(junit: str, tests: list[str]) -> int:
    root = repo_root()
    out = pathlib.Path(junit).resolve()
    vt = [t for t in tests if ci_scope.match(t, ci_scope.TEST_GLOBS)]
    if not vt:
        _empty_junit(out, "vitest の試験なし（画面の試験は流さない）")
        return 0
    install_deps(root)
    db = f"kaname_tmp_cut_{uuid.uuid4().hex[:8]}"
    url = f"postgres://postgres:postgres@127.0.0.1:{PG_PORT}/{db}"
    env = {**os.environ, "DATABASE_URL": url, "DATABASE_URL_ADMIN": url}
    _psql(f"create database {db}")
    try:
        mig = subprocess.run(["pnpm", "-s", "db:migrate"], cwd=root, env=env, capture_output=True, text=True)
        if mig.returncode != 0:
            print((mig.stdout + mig.stderr)[-2000:], file=sys.stderr)
            return mig.returncode   # JUnit を出さない＝準備で落ちたと見なされる
        r = subprocess.run(["pnpm", "exec", "vitest", "run", "--no-file-parallelism", "--reporter=junit", f"--outputFile={out}", *vt],
                           cwd=root, env=env, capture_output=True, text=True)
        print((r.stdout + r.stderr)[-1500:])
        return 0
    finally:
        _psql(f"drop database if exists {db} with (force)")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="cut_check.py")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("scope")
    s.add_argument("--ticket", required=True)
    s.add_argument("--files", nargs="*", default=[])
    p = sub.add_parser("prior")
    p.add_argument("--files", nargs="*", default=[])
    m = sub.add_parser("smoke")
    m.add_argument("--junit", required=True)
    m.add_argument("--tests", nargs="*", default=[])
    a = ap.parse_args(argv)
    if a.cmd == "scope":
        print(json.dumps(scope(a.ticket, a.files), ensure_ascii=False))
        return 0
    if a.cmd == "prior":
        print(json.dumps(prior(a.files), ensure_ascii=False))
        return 0
    return smoke(a.junit, a.tests)


if __name__ == "__main__":
    sys.exit(main())
