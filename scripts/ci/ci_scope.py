#!/usr/bin/env python3
"""ci_scope.py — チケットの CI の範囲を決める（K-107・D-128.169）。変えたファイル → 依存の地図 → 影響を受ける試験。

  決める（workflow の static の段 G0）:
    python3 scripts/ci/ci_scope.py --base <40 桁の sha> --head HEAD --scope auto|full
        [--rules scripts/ci/ci_scope.json] [--tickets 11_tickets] [--github-output FILE] [--json] [--no-vitest] [--repo .]
      scope の既定は workflow の入力の既定と同じ full（全部）。auto のときだけ絞る。
      終わり方：チケットとの食い違い・試験の無いコードがあれば 1（そのときも --github-output は全部に倒した値で書く）、ほかは 0
  組の中で流す（外から来る値は env の JSON で受け取り、shell を通さずに引数の並びで流す）:
    run-unit --shard <i>   env CI_UNIT_FILES・CI_COVERAGE_ARGS・CI_UNIT_SHARDS
    run-merge              env CI_COVERAGE_ARGS
    run-squawk             env CI_MIGRATION_FILES（空なら何もしない）
    check-count --report <vitest の json>   env CI_UNIT_FILES・CI_FULL（絞った回だけ、決めた試験と流れた試験を比べる）

  全部に倒す理由：requested・base・empty・ci・lockfile・shared・unmapped・badpath・tool・ticket・no-declaration・integration・mismatch
  DB の範囲（migration・SQL・行の守り・権限）：全部にはせず、database の組＋変えた migration の lint＋DB を使う試験を全部
  依存の地図：パッケージは pnpm のワークスペース（package.json の workspace:）、試験の import は vitest の Node の口（vitest_related.mjs）
"""
from __future__ import annotations

import argparse
import glob as globmod
import json
import math
import os
import re
import secrets
import subprocess
import sys
from typing import Callable, NamedTuple

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, "scripts", "tickets"))

from ticket_commit_gate import TICKET  # noqa: E402  目録の物（同じものを 2 つ作らない）
from ticket_order_gate import generated_outputs, is_doc_only  # noqa: E402
from build_index import parse as parse_ticket  # noqa: E402

MAX_SHARDS = 6
SHA = re.compile(r"[0-9a-f]{40}")
IMPORT_EXT = (".ts", ".tsx", ".mts", ".mjs", ".js", ".json")
CODE_EXT = (".ts", ".tsx", ".mts", ".mjs", ".js")
HUMAN_EXT = (".md", ".csv", ".html", ".htm", ".txt", ".xlsx", ".pdf", ".svg", ".png")
SCAN_EXT = (".ts", ".tsx", ".mjs")
SKIP_DIRS = {"node_modules", ".next", "dist", "build", "coverage", ".turbo", "out", ".vitest-reports", "playwright-report", "test-results"}
# vitest.config.ts の test.include と同じ（試験のファイルの見分け）
TEST_GLOBS = ["packages/*/src/**/*.test.ts", "packages/*/test/**/*.test.ts", "apps/*/src/**/*.test.ts", "apps/*/test/**/*.test.ts"]
WEB_E2E_PREFIX = "apps/web/tests/"   # 実ブラウザの試験（web の組が流す）
WIDE = ("db", "shared", "ci", "lockfile")
READ_MARK = re.compile(r"\b(?:readFileSync|readFile|readdirSync|readdir|createReadStream|statSync|existsSync|spawnSync|spawn|execSync|execFile|execFileSync)\b"
                       r"|(?<![.\w])exec\s*\(|\bfs\.promises\b|(?<![\w.])import\s*\(")
STR_LIT = re.compile(r"""(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1""")
JOIN_CALL = re.compile(r"\b(?:join|resolve)\(([^()]*)\)")


class ToolError(Exception):
    """vitest の辿りが落ちた・答えの形が違う"""


class BaseError(Exception):
    """比べる元が使えない（40 桁の 16 進でない・コミットでない）"""


class Change(NamedTuple):
    status: str
    path: str
    old: str | None


# ---------------------------------------------------------------- 小さな道具
def glob_re(pattern: str) -> re.Pattern:
    out, i = "", 0
    while i < len(pattern):
        if pattern.startswith("**/", i):
            out += "(?:.*/)?"
            i += 3
        elif pattern.startswith("/**", i) and i + 3 == len(pattern):
            out += "(?:/.*)?"
            i += 3
        elif pattern.startswith("**", i):
            out += ".*"
            i += 2
        elif pattern[i] == "*":
            out += "[^/]*"
            i += 1
        elif pattern[i] == "?":
            out += "[^/]"
            i += 1
        else:
            out += re.escape(pattern[i])
            i += 1
    return re.compile(out + r"\Z", re.S)


def match(path: str, patterns: list[str]) -> bool:
    return any(glob_re(p).match(path) for p in patterns)


def git(repo: str, *args: str, check: bool = True) -> subprocess.CompletedProcess:
    r = subprocess.run(["git", "-C", repo, "-c", "core.quotePath=false", *args], capture_output=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.decode('utf-8', 'replace').strip()[:300]}")
    return r


def walk_files(repo: str, exts: tuple[str, ...]) -> list[str]:
    """apps/*・packages/* の中のファイル（作業ツリーのまま・作りかけのファイルも見る）"""
    out = []
    for top in ("apps", "packages"):
        base = os.path.join(repo, top)
        if not os.path.isdir(base):
            continue
        for d, dirs, files in os.walk(base):
            dirs[:] = sorted(x for x in dirs if x not in SKIP_DIRS and not x.startswith("."))
            for f in files:
                if f.endswith(exts):
                    out.append(os.path.relpath(os.path.join(d, f), repo).replace(os.sep, "/"))
    return sorted(out)


def test_files(repo: str, under: str | None = None) -> list[str]:
    fs = [f for f in walk_files(repo, (".ts",)) if match(f, TEST_GLOBS)]
    return [f for f in fs if under is None or f.startswith(under.rstrip("/") + "/")]


# ---------------------------------------------------------------- git
def changed_files(repo: str, base: str, head: str) -> list[Change]:
    if not isinstance(base, str) or not SHA.fullmatch(base):
        raise BaseError(f"比べる元が 40 桁の 16 進でない: {base!r}")
    if git(repo, "cat-file", "-e", f"{base}^{{commit}}", check=False).returncode != 0:
        raise BaseError(f"比べる元がコミットでない: {base}")
    raw = git(repo, "diff", "--name-status", "-M", "-z", f"{base}...{head}").stdout.decode("utf-8", "surrogateescape")
    parts = raw.split("\0")
    out, i = [], 0
    while i < len(parts) and parts[i]:
        st = parts[i]
        if st[0] in "RC":
            out.append(Change(st, parts[i + 2], parts[i + 1]))
            i += 3
        else:
            out.append(Change(st, parts[i + 1], None))
            i += 2
    return out


def ticket_ids(repo: str, base: str, head: str) -> list[str]:
    text = git(repo, "log", "--format=%B", f"{base}..{head}").stdout.decode("utf-8", "replace")
    seen: list[str] = []
    for k in TICKET.findall(text):
        if k not in seen:
            seen.append(k)
    return seen


def history_ids(repo: str, head: str) -> set[str]:
    return set(TICKET.findall(git(repo, "log", "--format=%B", head).stdout.decode("utf-8", "replace")))


# ---------------------------------------------------------------- ワークスペースの地図
def workspace(repo: str) -> dict[str, dict]:
    """{名前: {"dir": 相対の dir, "deps": {ワークスペースの依存の名前}}}（pnpm の workspace: でつないだもの）"""
    pats, inside = [], False
    p = os.path.join(repo, "pnpm-workspace.yaml")
    for line in (open(p, encoding="utf-8").read().splitlines() if os.path.exists(p) else []):
        if re.match(r"^packages\s*:", line):
            inside = True
            continue
        if inside:
            m = re.match(r"^\s+-\s*['\"]?([^'\"#]+?)['\"]?\s*(?:#.*)?$", line)
            if m:
                pats.append(m.group(1))
            elif line.strip() and not line.startswith((" ", "\t")):
                inside = False
    raw: dict[str, dict] = {}
    for pat in pats:
        for d in sorted(globmod.glob(os.path.join(repo, pat))):
            pj = os.path.join(d, "package.json")
            if not os.path.isfile(pj):
                continue
            j = json.load(open(pj, encoding="utf-8"))
            deps = {}
            for k in ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies"):
                deps.update(j.get(k) or {})
            raw[j["name"]] = {"dir": os.path.relpath(d, repo).replace(os.sep, "/"),
                              "deps": {n for n, v in deps.items() if str(v).startswith("workspace:")}}
    for v in raw.values():
        v["deps"] = {n for n in v["deps"] if n in raw}
    return raw


def owner(path: str, ws: dict[str, dict]) -> str | None:
    best = None
    for name, v in ws.items():
        if path.startswith(v["dir"] + "/") and (best is None or len(v["dir"]) > len(ws[best]["dir"])):
            best = name
    return best


def affected(names, ws: dict[str, dict]) -> set[str]:
    """渡したパッケージと、それを辿って使う全部（pnpm --filter "...<名前>" と同じ）"""
    out = set(n for n in names if n in ws)
    grow = True
    while grow:
        grow = False
        for n, v in ws.items():
            if n not in out and v["deps"] & out:
                out.add(n)
                grow = True
    return out


def shared_packages(ws: dict[str, dict], min_dependents: int) -> set[str]:
    return {n for n in ws if len(affected({n}, ws) - {n}) >= min_dependents}


# ---------------------------------------------------------------- 決まり
def load_rules(path: str) -> dict:
    r = json.load(open(path, encoding="utf-8"))
    need = {"db": dict, "full": dict, "shared_min_dependents": int, "files_per_shard": int, "affects_required_from": int,
            "coverage_src": dict, "no_test_paths": list, "data_links": list, "reads_ok": dict, "jobs": dict}
    for k, t in need.items():
        if not isinstance(r.get(k), t):
            raise ValueError(f"{path}: {k} が無いか形が違う（{t.__name__}）")
    for k in ("paths", "migrations", "gateway", "markers"):
        if not isinstance(r["db"].get(k), list):
            raise ValueError(f"{path}: db.{k} が無い")
    ml = r["db"].get("migration_list")
    if not (isinstance(ml, dict) and isinstance(ml.get("file"), str) and isinstance(ml.get("entry"), str)):
        raise ValueError(f"{path}: db.migration_list（file・entry）が無い")
    re.compile(ml["entry"])
    if set(r["full"]) - {"ci", "lockfile"} or not all(isinstance(v, list) for v in r["full"].values()):
        raise ValueError(f"{path}: full は ci・lockfile の glob の並びだけ")
    for job, j in r["jobs"].items():
        if not (isinstance(j, dict) and isinstance(j.get("packages"), list) and isinstance(j.get("paths"), list)):
            raise ValueError(f"{path}: jobs.{job} は packages・paths")
    for link in r["data_links"]:
        if not isinstance(link.get("paths"), list) or not (link.get("tests") or link.get("readers")):
            raise ValueError(f"{path}: data_links の 1 つに paths と tests か readers が要る: {link}")
    if r["files_per_shard"] < 1:
        raise ValueError(f"{path}: files_per_shard は 1 以上")
    return r


def human_generated(repo: str) -> list[str]:
    return [g for g in generated_outputs(repo) if g.lower().endswith(HUMAN_EXT)]


def root_kind(path: str, rules: dict, repo: str) -> str:
    """どのパッケージにも入らないファイルの種類：db → data → doc → unmapped（jobs の paths はここに数えない）"""
    if match(path, rules["db"]["paths"]):
        return "db"
    if any(match(path, l["paths"]) for l in rules["data_links"]):
        return "data"
    if match(path, rules["no_test_paths"]) or is_doc_only([path], set()):
        return "doc"
    if path.lower().endswith(HUMAN_EXT) and match(path, human_generated(repo)):
        return "doc"
    return "unmapped"


# ---------------------------------------------------------------- 読む試験・src の棚卸し
def _read(repo: str, f: str) -> str:
    try:
        return open(os.path.join(repo, f), encoding="utf-8", errors="replace").read()
    except OSError:
        return ""


def unmapped_readers(repo: str, rules: dict) -> list[str]:
    """ファイルを読む・子プロセス・動的 import の印を持つのに、data_links にも reads_ok にも無い src と試験"""
    known = set(rules.get("reads_ok", {}))
    for l in rules["data_links"]:
        known |= set(l.get("tests", [])) | set(l.get("readers", []))
    return [f for f in walk_files(repo, SCAN_EXT) if f not in known and READ_MARK.search(_read(repo, f))]


def _norm(p: str) -> str | None:
    p = re.sub(r"\$\{[^}]*\}", "", p).replace("\\", "/")
    parts = [x for x in p.split("/") if x not in ("", ".", "..")]
    if not parts or any(c in "".join(parts) for c in " \t*?<>|\"'") or not re.match(r"^[\w.\-]+$", parts[0]):
        return None
    return "/".join(parts)


def _paths_in(text: str) -> set[str]:
    out: set[str] = set()
    for m in JOIN_CALL.finditer(text):
        lits = [s.group(2) for s in STR_LIT.finditer(m.group(1))]
        if lits:
            n = _norm("/".join(lits))
            if n:
                out.add(n)
    for s in STR_LIT.finditer(text):
        n = _norm(s.group(2))
        if n:
            out.add(n)
    return out


def no_test_path_reads(repo: str, rules: dict) -> list[tuple[str, str]]:
    """試験・src が、試験が読まないと決めた文書（root_kind が doc になる物）を指す文字を持つ [(ファイル, 読んだパス)]"""
    web_paths = rules["jobs"].get("web", {}).get("paths", [])
    out = []
    for f in walk_files(repo, SCAN_EXT):
        for p in sorted(_paths_in(_read(repo, f))):
            if root_kind(p, rules, repo) != "doc":
                continue
            # 実ブラウザの試験が jobs.web.paths の物を読むのは、その物を変えると web の組が流れるので赤にしない
            if f.startswith(WEB_E2E_PREFIX) and match(p, web_paths):
                continue
            out.append((f, p))
    return out


def db_tests_by_text(repo: str, rules: dict) -> list[str]:
    marks = [re.compile(m) for m in rules["db"]["markers"]]
    return [f for f in test_files(repo) if any(m.search(_read(repo, f)) for m in marks)]


# ---------------------------------------------------------------- vitest の辿り（本物）
def vitest_list_tests(repo: str) -> Callable[[list[str]], dict]:
    def run(files: list[str]) -> dict:
        try:
            r = subprocess.run(["node", "scripts/ci/vitest_related.mjs", *files], cwd=repo, capture_output=True, text=True, timeout=600)
        except (OSError, subprocess.TimeoutExpired) as e:
            raise ToolError(f"vitest_related.mjs を流せない: {e}")
        if r.returncode != 0:
            raise ToolError(f"vitest_related.mjs が {r.returncode} で終わった: {r.stderr.strip()[-500:]}")
        try:
            return json.loads(r.stdout)
        except ValueError:
            raise ToolError("vitest_related.mjs の答えが JSON でない")
    return run


def check_answer(ans, files: list[str]) -> dict[str, list[str]]:
    if not isinstance(ans, dict) or set(ans) != set(files) or not all(
            isinstance(v, list) and all(isinstance(x, str) for x in v) for v in ans.values()):
        raise ToolError("試験の辿りの答えの形が違う（{ファイル: [試験…]} でない）")
    return ans


# ---------------------------------------------------------------- 決める
def _migration_list_only(repo: str, base: str, head: str, rules: dict, added: set[str]) -> bool:
    """並びのファイルの変更が、足した migration の名前の行を足しただけか"""
    ml = rules["db"]["migration_list"]
    entry = re.compile(ml["entry"])
    diff = git(repo, "diff", "-U0", f"{base}...{head}", "--", ml["file"]).stdout.decode("utf-8", "replace")
    names = []
    for line in diff.splitlines():
        if line.startswith(("+++", "---")):
            continue
        if line.startswith("-"):
            return False
        if line.startswith("+"):
            m = entry.match(line[1:])
            if not m:
                return False
            names.append(m.group(1))
    return bool(names) and len(names) == len(set(names)) and set(names) == added


def _integration(repo: str, tickets_dir: str, tid: str, head: str) -> tuple[list[str], list[str], list[str]]:
    """このチケットで depends_on がそろう kind: QA のチケット → (番号, 試験のファイル, tests が無い番号)"""
    ids, files, empty = [], [], []
    hist = None
    for p in sorted(globmod.glob(os.path.join(tickets_dir, "K-*.md"))):
        try:
            t = parse_ticket(p)
        except (SystemExit, OSError, ValueError):
            continue
        deps = t.get("depends_on") or []
        if t.get("kind") != "QA" or not isinstance(deps, list) or tid not in deps:
            continue
        hist = history_ids(repo, head) if hist is None else hist
        if not all(d == tid or d in hist for d in deps):
            continue
        tests = t.get("tests") or []
        got = sorted({os.path.relpath(x, repo).replace(os.sep, "/")
                      for g in (tests if isinstance(tests, list) else [tests])
                      for x in globmod.glob(os.path.join(repo, g), recursive=True) if os.path.isfile(x)})
        ids.append(t["id"])
        if got:
            files += got
        else:
            empty.append(t["id"])
    return ids, sorted(set(files)), empty


def _num(tid: str) -> int:
    return int(tid.split("-")[1])


def _ticket_check(tickets_dir: str, tid: str, rules: dict, changed: set[str], wide: set[str]) -> tuple[list[str], list[tuple[str, str]]]:
    mism, full = [], []
    path = os.path.join(tickets_dir, f"{tid}.md")
    if not os.path.isfile(path):
        return [f"{tid}：チケットのファイルが無い（{os.path.relpath(path)}）"], [("mismatch", tid)]
    t = parse_ticket(path)
    if "affects" not in t:
        if _num(tid) >= rules["affects_required_from"]:
            return [f"{tid}：影響の範囲（affects）が書いていない（K-{rules['affects_required_from']} から要る）"], [("mismatch", tid)]
        return [], [("no-declaration", tid)]
    aff = t.get("affects")
    aff = set(aff if isinstance(aff, list) else [aff] if aff else [])
    for n in sorted(changed - aff):
        mism.append(f"{n}：変えたのにチケットに無い（{tid} の affects）")
    for n in sorted(aff - changed):
        mism.append(f"{n}：チケットにあるが変わっていない（{tid} の affects）")
    cw = t.get("ci_wide") or []
    cw = set(cw if isinstance(cw, list) else [cw])
    for c in sorted(wide - cw):
        mism.append(f"{c}：範囲を広げる理由があるのにチケットの ci_wide に無い（{tid}）")
    for c in sorted(cw - wide):
        mism.append(f"{c}：チケットの ci_wide にあるが触っていない（{tid}）")
    if mism:
        full.append(("mismatch", tid))
    return mism, full


def _shards(n: int, per: int) -> int:
    return 0 if n == 0 else max(1, min(MAX_SHARDS, math.ceil(n / per)))


def _full_plan(p: dict) -> dict:
    return {**p, "mode": "full", "jobs": {"unit": True, "database": True, "web": True}, "unit_shards": MAX_SHARDS,
            "unit_files": [], "coverage_args": []}


def plan(repo: str, base: str, head: str, scope: str, rules: dict, tickets_dir: str,
         list_tests: Callable[[list[str]], dict], db_tests: Callable[[], list]) -> dict:
    p: dict = {"mode": "scoped", "full_reasons": [], "wide_reasons": [], "reasons": [], "base": base if isinstance(base, str) else "",
               "changes": [], "changed_packages": [], "affected": [], "tickets": [], "integration": [], "mismatches": [], "errors": [],
               "jobs": {"unit": False, "database": False, "web": False}, "unit_shards": 0, "unit_files": [],
               "migration_files": [], "coverage_args": []}
    full: list[tuple[str, str]] = p["full_reasons"]

    def done() -> dict:
        p["reasons"] = [f"全部：{c}（{d}）" for c, d in full] + [f"範囲を広げる：{c}（{d}）" for c, d in p["wide_reasons"]]
        return _full_plan(p) if full else p

    if scope not in ("auto", "full") or scope == "full":
        full.append(("requested", scope if scope in ("auto", "full") else "決まった形でない scope"))
        return done()
    try:
        changes = changed_files(repo, base, head)
    except BaseError as e:
        p["base"] = ""
        full.append(("base", str(e)))
        return done()
    p["changes"] = changes
    if not changes:
        full.append(("empty", "変えたファイルが無い"))
        return done()

    ws = workspace(repo)
    shared = shared_packages(ws, rules["shared_min_dependents"])
    db = rules["db"]
    wide: list[tuple[str, str]] = p["wide_reasons"]
    added_mig = {os.path.basename(c.path) for c in changes if c.status == "A" and match(c.path, db["migrations"])}
    changed_pk: set[str] = set()
    code_pk: set[str] = set()
    vitest_in: set[str] = set()          # list_tests に渡すファイル
    whole_pk: set[str] = set()           # 中の試験を全部足すパッケージ（使い手まで）
    direct: set[str] = set()             # そのまま流す試験
    readers: set[str] = set()
    src_live: set[str] = set()           # 変えて残った src（coverage と「試験の無いコード」）
    db_range = False
    any_path = []
    for c in changes:
        paths = [c.path] + ([c.old] if c.old else [])
        any_path += paths
        if any("\n" in x or "\r" in x for x in paths):
            full.append(("badpath", "改行を含むパス"))
        for x in paths:
            gone = x != c.path or c.status.startswith("D")
            pk = owner(x, ws)
            cats = [cat for cat in ("ci", "lockfile") if match(x, rules["full"].get(cat, []))]
            if cats:
                full += [(cat, x) for cat in cats]
                if pk:
                    changed_pk.add(pk)
                continue
            for l in rules["data_links"]:
                if match(x, l["paths"]):
                    direct.update(l.get("tests", []))
                    readers.update(l.get("readers", []))
            if match(x, db["paths"]):
                db_range = True
                wide.append(("db", x))
                if pk:
                    changed_pk.add(pk)
                continue
            if x == db["migration_list"]["file"] and not gone and c.status == "M" and _migration_list_only(repo, base, head, rules, added_mig):
                db_range = True
                wide.append(("db", x))
                if pk:
                    changed_pk.add(pk)
                continue
            if pk:
                changed_pk.add(pk)
                code_pk.add(pk)
                if pk in shared:
                    full.append(("shared", x))
                    wide.append(("shared", x))
                vitest_in.add(x)
                if gone or not x.endswith(IMPORT_EXT):
                    whole_pk.add(pk)
                if not gone and match(x, TEST_GLOBS):
                    direct.add(x)
                if not gone and match(x, rules["coverage_src"]["include"]) and not match(x, rules["coverage_src"].get("exclude", [])):
                    src_live.add(x)
                continue
            kind = root_kind(x, rules, repo)
            if kind == "unmapped":
                full.append(("unmapped", x))
    for cat, x in full:
        if cat in ("ci", "lockfile") and (cat, x) not in wide:
            wide.append((cat, x))
    p["changed_packages"] = sorted(changed_pk)
    aff = affected(code_pk, ws)
    p["affected"] = sorted(aff)
    if db_range:
        p["migration_files"] = sorted({c.path for c in changes if not c.status.startswith("D") and match(c.path, db["migrations"])})

    # チケット
    ids = ticket_ids(repo, base, head)
    p["tickets"] = ids
    if len(ids) != 1:
        full.append(("ticket", f"コミットのチケットの番号が {len(ids)} 個（{', '.join(ids) or 'なし'}）"))
    else:
        mism, fr = _ticket_check(tickets_dir, ids[0], rules, changed_pk, {c for c, _ in wide})
        p["mismatches"] = mism
        full += fr
        integ, itests, empty = _integration(repo, tickets_dir, ids[0], head)
        p["integration"] = integ
        for e in empty:
            full.append(("integration", f"{e} の tests が無い（何にも当たらない）"))
        direct.update(itests)

    if full:
        return done()

    # 試験を決める
    try:
        vin = sorted(vitest_in | readers)
        rel = check_answer(list_tests(vin), vin) if vin else {}
        dbt = list(db_tests()) if db_range else []
    except ToolError as e:
        full.append(("tool", str(e)))
        return done()
    files = set(direct) | {t for v in rel.values() for t in v} | set(dbt)
    for pk in affected(whole_pk, ws):
        files.update(test_files(repo, ws[pk]["dir"]))
    p["unit_files"] = sorted(files)
    p["unit_shards"] = _shards(len(files), rules["files_per_shard"])

    # 試験の無いコード（どの受け方でもよい）
    data_tested = [l["paths"] for l in rules["data_links"] if l.get("tests")]
    for s in sorted(src_live):
        if rel.get(s):
            continue
        if any(match(s, ps) for ps in data_tested) or itests:
            continue
        if db_range and dbt and match(s, db["gateway"]):
            continue
        p["errors"].append(f"試験の無いコード：{s}（import・data_links・中間と統合・DB を使う試験のどれにも受ける試験が無い）")
    p["coverage_args"] = [f"--coverage.include={s}" for s in sorted(src_live)] or ["--coverage.enabled=false"]

    jd, jw = rules["jobs"].get("database", {}), rules["jobs"].get("web", {})
    p["jobs"] = {"unit": bool(files),
                 "database": db_range or bool(aff & set(jd.get("packages", []))) or any(match(x, jd.get("paths", [])) for x in any_path),
                 "web": bool(aff & set(jw.get("packages", []))) or any(match(x, jw.get("paths", [])) for x in any_path)
                 or any(f.startswith(WEB_E2E_PREFIX) for f in itests)}
    if not p["jobs"]["unit"]:
        p["unit_shards"] = 0
    return done()


# ---------------------------------------------------------------- 組の中で流す命令（引数の並び）
THRESH0 = [f"--coverage.thresholds.{k}=0" for k in ("lines", "branches", "functions", "statements")]
REPORTS = ".vitest-reports"


def unit_argv(files: list[str], shard: int, shards: int, coverage: list[str]) -> list[str]:
    return ["pnpm", "exec", "vitest", "run", *files, "--passWithNoTests", "--coverage", f"--shard={shard}/{shards}",
            "--reporter=default", "--reporter=blob", f"--outputFile.blob={REPORTS}/blob-{shard}-{shards}.json",
            "--coverage.reporter=text-summary", *THRESH0, *coverage]


def merge_argv(coverage: list[str]) -> list[str]:
    return ["pnpm", "exec", "vitest", "run", f"--merge-reports={REPORTS}", "--coverage", "--reporter=default", "--reporter=json",
            f"--outputFile.json={REPORTS}/merged.json", *coverage]


def squawk_argv(files: list[str]) -> list[str] | None:
    return ["pnpm", "exec", "squawk", *files] if files else None


def count_check(report: dict, expected: list[str] | None, root: str) -> list[str]:
    if expected is None:
        return []
    ran = set()
    for r in report.get("testResults", []) or []:
        n = str(r.get("name", ""))
        ran.add(os.path.relpath(n, root).replace(os.sep, "/") if os.path.isabs(n) else n)
    want = set(expected)
    errs = []
    if not ran:
        errs.append("流れた試験が 0 本（決めた試験は %d 本）" % len(want))
    errs += [f"決めたのに流れなかった試験：{f}" for f in sorted(want - ran)]
    errs += [f"決めていないのに流れた試験：{f}" for f in sorted(ran - want)]
    return errs


# ---------------------------------------------------------------- 入口
def _env_list(name: str) -> list[str]:
    raw = os.environ.get(name, "")
    try:
        v = json.loads(raw) if raw else []
    except ValueError:
        raise SystemExit(f"★ {name} が JSON でない")
    if not isinstance(v, list) or not all(isinstance(x, str) for x in v):
        raise SystemExit(f"★ {name} が文字の並びでない")
    return v


def gh_output(path: str, values: dict[str, str]) -> None:
    with open(path, "a", encoding="utf-8") as f:
        for k, v in values.items():
            while True:
                d = "EOF_" + secrets.token_hex(12)
                if d not in v:
                    break
            f.write(f"{k}<<{d}\n{v}\n{d}\n")


def outputs(p: dict) -> dict[str, str]:
    j = lambda v: json.dumps(v, ensure_ascii=False)  # noqa: E731
    return {"full": "true" if p["mode"] == "full" else "false", "unit": str(p["jobs"]["unit"]).lower(),
            "database": str(p["jobs"]["database"]).lower(), "web": str(p["jobs"]["web"]).lower(),
            "unit_shards": str(p["unit_shards"]), "unit_files": j(p["unit_files"]), "migration_files": j(p["migration_files"]),
            "coverage_args": j(p["coverage_args"]), "base": p["base"] if SHA.fullmatch(p.get("base") or "") else "",
            "reasons": j(p["reasons"] + p["mismatches"] + p["errors"])}


def _decide(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(prog="ci_scope.py")
    ap.add_argument("--repo", default=None)
    ap.add_argument("--base", default="")
    ap.add_argument("--head", default="HEAD")
    ap.add_argument("--scope", default="full")
    ap.add_argument("--rules", default=None)
    ap.add_argument("--tickets", default=None)
    ap.add_argument("--github-output", default=None)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--no-vitest", action="store_true")
    a = ap.parse_args(argv)
    repo = os.path.abspath(a.repo or git(os.getcwd(), "rev-parse", "--show-toplevel").stdout.decode().strip())
    rules = load_rules(a.rules or os.path.join(repo, "scripts", "ci", "ci_scope.json"))
    tickets = a.tickets or os.path.join(repo, "11_tickets")
    if a.no_vitest:
        lt = lambda files: {f: [] for f in files}  # noqa: E731
        dbt = lambda: db_tests_by_text(repo, rules)  # noqa: E731
    else:
        lt = vitest_list_tests(repo)

        def dbt() -> list[str]:
            # .json は渡さない（vitest は package.json を forceRerunTriggers として全部の試験を返す）
            gw = [f for f in walk_files(repo, CODE_EXT) if match(f, rules["db"]["gateway"])]
            got = check_answer(lt(gw), gw) if gw else {}
            return sorted({t for v in got.values() for t in v} | set(db_tests_by_text(repo, rules)))
    p = plan(repo, a.base, a.head, a.scope, rules, tickets, lt, dbt)
    red = bool(p["mismatches"] or p["errors"])
    out = _full_plan(p) if red else p
    if a.github_output:
        gh_output(a.github_output, outputs(out))
    show = {**out, "changes": [c._asdict() for c in p["changes"]]}
    if a.json:
        print(json.dumps(show, ensure_ascii=False, indent=1))
    else:
        print(f"チケットの CI の範囲：{'全部' if out['mode'] == 'full' else '絞る'}（scope={a.scope}・base={p['base'][:10] or 'なし'}）")
        for r in p["reasons"]:
            print("  " + r)
        print(f"  組：{', '.join(k for k, v in out['jobs'].items() if v) or 'static・spec だけ'}・unit の組 {out['unit_shards']}・試験 {len(out['unit_files']) or ('全部' if out['mode'] == 'full' else 0)} 本"
              + (f"・migration の lint {len(out['migration_files'])} 本" if out["migration_files"] else ""))
        for m in p["mismatches"]:
            print("  ★ 食い違い：" + m)
        for e in p["errors"]:
            print("  ★ " + e)
    return 1 if red else 0


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    cmd = argv[0] if argv else ""
    if cmd == "run-unit":
        ap = argparse.ArgumentParser(prog="ci_scope.py run-unit")
        ap.add_argument("--shard", type=int, required=True)
        a = ap.parse_args(argv[1:])
        shards_raw = os.environ.get("CI_UNIT_SHARDS", "")
        if not shards_raw.isdigit() or not 1 <= a.shard <= int(shards_raw):
            raise SystemExit(f"★ CI_UNIT_SHARDS（{shards_raw!r}）と --shard {a.shard} が合わない")
        argv2 = unit_argv(_env_list("CI_UNIT_FILES"), a.shard, int(shards_raw), _env_list("CI_COVERAGE_ARGS"))
        return subprocess.run(argv2).returncode
    if cmd == "run-merge":
        return subprocess.run(merge_argv(_env_list("CI_COVERAGE_ARGS"))).returncode
    if cmd == "run-squawk":
        sq = squawk_argv(_env_list("CI_MIGRATION_FILES"))
        if sq is None:
            print("migration の lint：変えた migration が無い")
            return 0
        return subprocess.run(sq).returncode
    if cmd == "check-count":
        ap = argparse.ArgumentParser(prog="ci_scope.py check-count")
        ap.add_argument("--report", required=True)
        a = ap.parse_args(argv[1:])
        if os.environ.get("CI_FULL") == "true":
            print("流れた数の突き合わせ：全部の回なので見ない")
            return 0
        expected = _env_list("CI_UNIT_FILES")
        try:
            rep = json.load(open(a.report, encoding="utf-8"))
        except (OSError, ValueError) as e:
            print(f"★ vitest の報告が読めない: {e}")
            return 1
        errs = count_check(rep, expected, os.getcwd())
        for e in errs:
            print("★ " + e)
        if not errs:
            print(f"流れた数の突き合わせ：決めた {len(expected)} 本が全部流れた")
        return 1 if errs else 0
    return _decide(argv)


if __name__ == "__main__":
    sys.exit(main())
