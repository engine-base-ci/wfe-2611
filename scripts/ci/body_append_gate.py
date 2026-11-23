#!/usr/bin/env python3
"""共通の台帳の本体に、葉が直に行を足していないか（K-1112）。

  python3 scripts/ci/body_append_gate.py --base-ref <本線との分かれ目>

なぜ：同時に作る葉が同じ本体（05_flow/screen_api.py の表・08_api/phase1/*.md の表）に行を足すと、取り込みでぶつかる。
足す分は葉ごとのファイルに書く：
  05_flow/screen_api.py の表の新しい鍵   → 05_flow/screen_api.d/K-<番号>.py（同じ名前の表で書く）
  08_api/phase1/<名前>.md の表の行       → 08_api/phase1/<名前>.d/K-<番号>.md（作り手 scripts/ci/api_doc_d.py が合わせる）

見るのは、比べる元から先頭までのコミット 1 つずつ（どの葉が足したかは件名の頭の K-<番号>）：
  - screen_api.py：表に新しい鍵が増えた（今ある鍵の値を直すのは見ない。.d は本体の鍵を上書きできないので）
    SCREEN_API は operationId を鍵にする。表は本体の頭の段の、大文字の名前に dict・set・list の字を書いた物
  - 08_api/phase1/*.md（.d の中・合わせた写しは除く）：表の行が増えた・変わった（見出しと 1 つ目の欄で行を見分ける）
  - 取り込みのコミットは、どの親にも無かった物だけを数える（ぶつかりを解くときに足した物）
猶予：台帳 scripts/ci/body_append_grandfather.json の葉（この決まりの前に始めていた葉）は見ない。台帳は分かれ目より増やせない。
比べる元が読めない・空なら赤（黙って比べずに緑にしない）。
"""
from __future__ import annotations

import argparse
import ast
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import api_doc_d  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent.parent
SCREEN_API = "05_flow/screen_api.py"
DOCS = "08_api/phase1"
LEDGER = "scripts/ci/body_append_grandfather.json"
SUBJECT = re.compile(r"^(K-\d+)\b")


def git(root: Path, *args: str, check: bool = True) -> str:
    r = subprocess.run(["git", *args], cwd=root, capture_output=True, text=True, encoding="utf-8")
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}：{r.stderr.strip()[:200]}")
    return r.stdout if r.returncode == 0 else ""


def show(root: Path, rev: str, path: str) -> str | None:
    r = subprocess.run(["git", "show", f"{rev}:{path}"], cwd=root, capture_output=True, text=True, encoding="utf-8")
    return r.stdout if r.returncode == 0 else None


def py_keys(src: str | None) -> set[tuple[str, str]]:
    """本体の表の鍵：(表の名前, 鍵の字)。読めない字は空（親が無い・まだ無いのと同じ）"""
    if not src:
        return set()
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return set()
    keys: set[tuple[str, str]] = set()
    for node in tree.body:
        target = node.targets[0] if isinstance(node, ast.Assign) and len(node.targets) == 1 else getattr(node, "target", None)
        value = getattr(node, "value", None)
        if not isinstance(target, ast.Name) or not target.id.isupper() or target.id.startswith("_") or value is None:
            continue
        name = target.id
        if isinstance(value, ast.Dict):
            for k, v in zip(value.keys, value.values):
                if k is None:
                    continue
                if name == "SCREEN_API" and isinstance(v, ast.List):
                    for row in v.elts:
                        if isinstance(row, ast.Tuple) and len(row.elts) > 4:
                            keys.add((name, ast.unparse(row.elts[4])))
                    continue
                keys.add((name, ast.unparse(k)))
        elif isinstance(value, (ast.Set, ast.List)):
            keys.update((name, ast.unparse(e)) for e in value.elts)
    return keys


def body_docs(root: Path, rev: str) -> list[str]:
    out = git(root, "ls-tree", "--name-only", "-z", f"{rev}:{DOCS}", check=False)
    return [f"{DOCS}/{n}" for n in out.split("\0") if n.endswith(".md")]


def md_rows(src: str | None) -> dict[tuple[str, str], tuple[str, ...]]:
    if not src:
        return {}
    lines = src.split("\n")
    return {k: tuple(lines[i] for i in at) for k, at in api_doc_d.body_rows(src).items()}


def changed(root: Path, rev: str, parents: list[str]) -> set[str]:
    """どの親とも違う本体のファイル（取り込みは、どれかの親と同じなら足した物は無い）"""
    paths = [SCREEN_API, DOCS]
    if not parents:
        return set(git(root, "ls-tree", "-r", "--name-only", "-z", rev, "--", *paths).split("\0")) - {""}
    sets = [set(git(root, "diff", "--name-only", "-z", "--no-renames", p, rev, "--", *paths).split("\0")) - {""} for p in parents]
    return set.intersection(*sets)


def added(root: Path, rev: str, parents: list[str]) -> list[str]:
    """このコミットが本体に直に足した物（どの親にも無かった物）"""
    found: list[str] = []
    touched = changed(root, rev, parents)
    if SCREEN_API in touched:
        now = py_keys(show(root, rev, SCREEN_API))
        before = set().union(*(py_keys(show(root, p, SCREEN_API)) for p in parents)) if parents else set()
        for table, key in sorted(now - before):
            found.append(f"{SCREEN_API} の {table} に鍵 {key}（05_flow/screen_api.d/<番号>.py の {table} に書く）")
    for doc in body_docs(root, rev):
        if doc not in touched:
            continue
        rows = md_rows(show(root, rev, doc))
        olds = [md_rows(show(root, p, doc)) for p in parents]
        for k, row in rows.items():
            if any(o.get(k) == row for o in olds):
                continue
            name = Path(doc).stem
            found.append(f"{doc} の「{k[0].lstrip('# ')}」の行「{k[1]}」（{DOCS}/{name}.d/<番号>.md に書く）")
    return found


def ledger(src: str | None) -> set[str]:
    if src is None:
        return set()
    data = json.loads(src)
    return {str(t) for t in data["tickets"]}


def check(root: Path, base: str) -> list[str]:
    if not base or not git(root, "rev-parse", "--verify", "--quiet", f"{base}^{{commit}}", check=False).strip():
        return [f"比べる元 {base or '（空）'} が読めない（黙って比べずに緑にしない）"]
    bad: list[str] = []
    try:
        now_l = ledger(show(root, "HEAD", LEDGER))
        base_src = show(root, base, LEDGER)
        if base_src is not None and (grown := sorted(now_l - ledger(base_src))):
            bad.append(f"{LEDGER}：分かれ目より猶予の葉が増えた {', '.join(grown)}（台帳は減らすだけ）")
    except (ValueError, KeyError, TypeError) as e:
        return [f"{LEDGER} が読めない（{e}）"]
    log = git(root, "log", "--format=%H%x09%P%x09%s", f"{base}..HEAD")
    for line in log.splitlines():
        sha, parents, subject = (line.split("\t", 2) + ["", ""])[:3]
        m = SUBJECT.match(subject)
        who = m.group(1) if m else "番号の無いコミット"
        if who in now_l:
            continue
        for item in added(root, sha, parents.split()):
            bad.append(f"{who}（{sha[:10]} {subject[:40]}）が本体に直に足した：{item}")
    return bad


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--base-ref", default="")
    ap.add_argument("--root", default=str(ROOT))
    a = ap.parse_args()
    try:
        bad = check(Path(a.root), a.base_ref)
    except RuntimeError as e:
        bad = [str(e)]
    for b in bad:
        print(f"本体への直の足し：{b}")
    if bad:
        print(f"本体への直の足し：赤 {len(bad)} 件（決まりは scripts/ci/body_append_gate.py の頭）")
        return 1
    print("本体への直の足し：無い（緑）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
