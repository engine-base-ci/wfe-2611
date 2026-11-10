#!/usr/bin/env python3
"""取り込む順（K-94・D-128.147・ai-driven-process.md 原則 11）：チケットの depends_on の実装が、先に枝に入っている。

  python3 scripts/ci/ticket_order_gate.py             START..HEAD の実装のコミットを見る
  python3 scripts/ci/ticket_order_gate.py --selftest  依存が未完了・枝の外にだけある写しが赤になるか

完了の決め方：依存のチケットの番号を持つ「実装のコミット」が、確かめるコミットの祖先にあれば完了（同じコミットに
依存の番号も入っていればそれでもよい）。チケットの stage は決め手にしない。枝の外（hold/…）の実装は祖先でないので数えない。
ただし決まりを始めた START より前に作られたチケット（START..HEAD のどのコミットにも番号が出てこず、stage が
確認中・完了のもの）は、番号の付いたコミットが無いので「決まりの前に入った」として通し、そのことを出す。
文書だけのコミット（変えたファイルが全部、文書と生成物の置き場に入る）は見ない。
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile

START = "2fc247a62ee2c34dd400118e301514c00b922777"  # ticket_commit_gate.py と同じ起点（No Ticket, No Commit を始めた時点）
TICKET = re.compile(r"\bK-\d+\b")
DOC_PREFIXES = ("01_hearing/", "11_tickets/", "07_qa/test-plan/", "README.md")
DOC_PATTERNS = (re.compile(r"^07_qa/test-specs/.+\.md$"), re.compile(r"^03_architecture/catalog\.[a-z]+$"),
                re.compile(r"^08_api/[^/]+\.md$"))
DONE_STAGES = {"確認中", "完了"}


def git(*args: str, cwd: str | None = None) -> str:
    r = subprocess.run(["git", "-c", "core.quotePath=false", *args], capture_output=True, text=True, cwd=cwd)
    if r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip()[:200]}")
    return r.stdout


def generated_outputs(root: str) -> set[str]:
    p = os.path.join(root, "scripts", "ci", "generated.json")
    try:
        d = json.load(open(p, encoding="utf-8"))
    except (OSError, ValueError):
        return set()
    return {o for g in d.get("generators", []) for o in g.get("outputs", [])}


SCRIPT_EXT = (".py", ".mjs", ".js", ".sh")


def generator_scripts(root: str) -> set[str]:
    """generated.json の作り手の台本（run を && で分け、cd <dir> を追い、台本の拡張子で終わる語のうち在るファイル・根からの相対）。K-156"""
    p = os.path.join(root, "scripts", "ci", "generated.json")
    try:
        d = json.load(open(p, encoding="utf-8"))
    except (OSError, ValueError):
        return set()
    out: set[str] = set()
    for g in d.get("generators", []):
        cwd = ""
        for part in str(g.get("run", "")).split("&&"):
            words = part.split()
            if len(words) >= 2 and words[0] == "cd":
                cwd = os.path.normpath(os.path.join(cwd, words[1]))
                continue
            for w in words:
                if w.endswith(SCRIPT_EXT):
                    rel = os.path.normpath(os.path.join(cwd, w)).replace(os.sep, "/")
                    if os.path.isfile(os.path.join(root, rel)):
                        out.add(rel)
    return out


def is_doc_only(files: list[str], gen: set[str]) -> bool:
    def doc(f: str) -> bool:
        return f.startswith(DOC_PREFIXES) or any(p.match(f) for p in DOC_PATTERNS) or f in gen
    return bool(files) and all(doc(f) for f in files)


def check(root: str, rev: str = "HEAD", start: str = START) -> tuple[list[str], list[str], int]:
    """戻り値：(赤の理由, 決まりの前に入ったとして通した依存, 見た実装のコミットの数)"""
    tickets = {t["id"]: t for t in json.load(open(os.path.join(root, "11_tickets", "tickets.json"), encoding="utf-8"))["tickets"]}
    gen = generated_outputs(root)
    rows = [l.split("\t", 1) for l in git("log", "--reverse", "--format=%H%x09%s", f"{start}..{rev}", cwd=root).splitlines() if "\t" in l]
    mentioned = {k for _, s in rows for k in TICKET.findall(s)}
    impl: list[tuple[str, set[str]]] = []  # 実装のコミット（古い順）と番号
    for sha, subj in rows:
        files = [f for f in git("diff-tree", "--no-commit-id", "--name-only", "-r", "--root", sha, cwd=root).splitlines() if f]
        if not is_doc_only(files, gen):
            impl.append((sha, set(TICKET.findall(subj))))
    bad, legacy = [], []
    for i, (sha, ids) in enumerate(impl):
        for tid in sorted(ids):
            for dep in tickets.get(tid, {}).get("depends_on") or []:
                if dep in ids:
                    continue
                done = any(dep in prev_ids and is_ancestor(prev, sha, root) for prev, prev_ids in impl[:i])
                if done:
                    continue
                if dep not in mentioned and tickets.get(dep, {}).get("stage") in DONE_STAGES:
                    legacy.append(f"{dep}（{tid} の依存・決まりの前に入った）")
                    continue
                bad.append(f"{sha[:10]} {tid} は {dep} に依存するが、{dep} の実装がまだ枝に入っていない（祖先に {dep} の実装のコミットが無い）")
    return bad, sorted(set(legacy)), len(impl)


def is_ancestor(a: str, b: str, root: str) -> bool:
    return subprocess.run(["git", "merge-base", "--is-ancestor", a, b], cwd=root).returncode == 0


def selftest() -> int:
    """写しのリポジトリを作り、赤になるべき形が赤・緑になるべき形が緑になるかを見る。"""
    with tempfile.TemporaryDirectory() as d:
        def run(*a: str) -> None:
            subprocess.run(["git", *a], cwd=d, check=True, capture_output=True,
                           env={**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.com",
                                "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.com"})

        def commit(msg: str, path: str, text: str) -> None:
            os.makedirs(os.path.dirname(os.path.join(d, path)) or d, exist_ok=True)
            open(os.path.join(d, path), "w").write(text)
            run("add", "-A")
            run("commit", "-qm", msg)

        def tickets(ts: dict[str, dict]) -> None:
            os.makedirs(os.path.join(d, "11_tickets"), exist_ok=True)
            json.dump({"tickets": [{"id": k, **v} for k, v in ts.items()]}, open(os.path.join(d, "11_tickets", "tickets.json"), "w"))

        run("init", "-q")
        tickets({"K-1": {"depends_on": [], "stage": "未着手"}, "K-2": {"depends_on": ["K-1"], "stage": "未着手"},
                 "K-3": {"depends_on": ["K-2"], "stage": "未着手"}, "K-9": {"depends_on": [], "stage": "完了"},
                 "K-4": {"depends_on": ["K-9"], "stage": "未着手"}})
        commit("K-0 base", "README.md", "x")
        start = git("rev-parse", "HEAD", cwd=d).strip()
        commit("K-3 docs: チケットを切る", "11_tickets/K-3.md", "x")          # 文書だけ：依存が未完了でも見ない
        commit("K-2 feat: 先に作ってしまう", "apps/a.ts", "a")                  # 赤：K-1 がまだ
        bad1, _, _ = check(d, "HEAD", start)
        run("checkout", "-q", "-b", "hold", start)
        commit("K-1 feat: 枝の外で作る", "apps/b.ts", "b")                      # 枝の外
        run("checkout", "-q", "-")
        bad2, _, _ = check(d, "HEAD", start)                                     # 赤のまま（枝の外は祖先でない）
        run("checkout", "-q", "-b", "good", start)
        commit("K-1 feat: 依存を先に", "apps/b.ts", "b")
        commit("K-2 feat: 後から", "apps/a.ts", "a")
        commit("K-4 feat: 決まりの前に入った依存", "apps/c.ts", "c")
        bad3, legacy3, n3 = check(d, "HEAD", start)
        ok = (len(bad1) == 1 and "K-2 は K-1" in bad1[0] and len(bad2) == 1 and not bad3 and n3 == 3
              and legacy3 == ["K-9（K-4 の依存・決まりの前に入った）"])
        print("selftest ok" if ok else f"selftest NG: {bad1} / {bad2} / {bad3} / {legacy3}")
        return 0 if ok else 1


def main() -> int:
    if "--selftest" in sys.argv:
        return selftest()
    root = git("rev-parse", "--show-toplevel").strip()
    try:
        bad, legacy, n = check(root)
    except RuntimeError as e:
        print(f"★ FAIL {e}")
        return 1
    for x in bad:
        print(f"  ★ {x}")
    if legacy:
        print(f"  （番号の付いたコミットが無いが stage が確認中・完了なので、決まりの前に入ったとして通した依存：{'・'.join(legacy)}）")
    print(f"実装のコミット {n} 本・順の違反 {len(bad)} 件")
    print("PASS — どの実装も、依存のチケットの実装が先に枝に入っている" if not bad
          else "FAIL — 依存がまだ枝に入っていないチケットの実装がある（取り込むのは依存の順に 1 本ずつ・K-94）")
    return 0 if not bad else 1


if __name__ == "__main__":
    sys.exit(main())
