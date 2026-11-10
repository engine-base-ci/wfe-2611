#!/usr/bin/env python3
"""取り込む順（K-94・D-128.147・ai-driven-process.md 原則 11）：チケットの depends_on の実装が、先に枝に入っている。

  python3 scripts/ci/ticket_order_gate.py             START..HEAD の実装のコミットを見る
  python3 scripts/ci/ticket_order_gate.py --selftest  依存が未完了・枝の外にだけある写しが赤になるか

完了の決め方：依存のチケットの番号を持つ「実装のコミット」が、確かめるコミットの祖先にあれば完了（同じコミットに
依存の番号も入っていればそれでもよい）。チケットの stage は決め手にしない。枝の外（hold/…）の実装は祖先でないので数えない。
ただし決まりを始めた START より前に作られたチケット（START..HEAD のどのコミットにも番号が出てこず、stage が
確認中・完了のもの）は、番号の付いたコミットが無いので「決まりの前に入った」として通し、そのことを出す。
文書だけのコミット（変えたファイルが全部、文書と生成物の置き場に入る）は見ない。進め方の設定（ai-team.yaml）も、この検査の中だけ
実装に数えない（PM の判断 2026-11-10・K-159）。共有の is_doc_only（ci_scope.py も使う）には入れない。

どの依存で裁くか（K-159・後から足した依存で過去のコミットを赤にしない）：
  ・コミットごと：各実装のコミットを、そのコミットの版の 11_tickets/tickets.json の depends_on で裁く。その版の一覧が無い・
    読めない・そのチケットが載っていないときは、rev（枝の先頭）の版の depends_on で裁く（前と同じ・緩めない）。
    あわせて、rev の版の depends_on のうち START の版か枝の中のそれより前の版に一度でも載っていたものも足す
    （外して先に実装し後で戻す道を通さない・テスター Q 回 1 の #2・PM の判断 (ア)）
  ・枝の先頭：実装のコミットを持つチケットの、rev の版の depends_on が全部 START..rev の実装にあること（原則 11）。
    同じ（チケット, 依存）をコミットごとで既に出していれば重ねない
  ・rev の一覧・stage・生成物の一覧（scripts/ci/generated.json）は作業場所でなく rev の版から読む。rev の一覧が読めなければ止める
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
TICKETS_JSON = "11_tickets/tickets.json"
GENERATED_JSON = "scripts/ci/generated.json"
PROCESS_CONFIG = ("ai-team.yaml",)   # この検査の中だけ実装に数えない（K-159）。is_doc_only には入れない


def git(*args: str, cwd: str | None = None) -> str:
    r = subprocess.run(["git", "-c", "core.quotePath=false", *args], capture_output=True, text=True, cwd=cwd)
    if r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip()[:200]}")
    return r.stdout


def generated_outputs(root: str) -> set[str]:
    """作業場所の生成物の一覧（ci_scope.py が使う）。この検査は版から読む（_generated_of）"""
    p = os.path.join(root, "scripts", "ci", "generated.json")
    try:
        d = json.load(open(p, encoding="utf-8"))
    except (OSError, ValueError):
        return set()
    return {o for g in d.get("generators", []) for o in g.get("outputs", [])}


def _generated_of(raw: bytes | None) -> set[str]:
    try:
        d = json.loads(raw.decode("utf-8")) if raw is not None else {}
    except (ValueError, UnicodeDecodeError):
        return set()
    return {o for g in (d.get("generators", []) if isinstance(d, dict) else []) for o in g.get("outputs", [])}


def _tickets_of(raw: bytes | None) -> dict[str, dict] | None:
    """tickets.json の中身 → {番号: チケット}。無い・JSON でない・"tickets" が無いなら None"""
    if raw is None:
        return None
    try:
        d = json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return None
    ts = d.get("tickets") if isinstance(d, dict) else None
    if not isinstance(ts, list):
        return None
    return {t["id"]: t for t in ts if isinstance(t, dict) and "id" in t}


def read_versions(root: str, specs: list[str]) -> dict[str, bytes | None]:
    """["<rev>:<path>", …] → 中身（無ければ None）。git cat-file --batch を 1 回だけ流す"""
    if not specs:
        return {}
    r = subprocess.run(["git", "cat-file", "--batch"], input="".join(s + "\n" for s in specs).encode("utf-8"),
                       capture_output=True, cwd=root)
    if r.returncode != 0:
        raise RuntimeError(f"git cat-file --batch: {r.stderr.decode('utf-8', 'replace').strip()[:200]}")
    out: dict[str, bytes | None] = {}
    buf, pos = r.stdout, 0
    for s in specs:
        nl = buf.index(b"\n", pos)
        head = buf[pos:nl].decode("utf-8", "replace")
        pos = nl + 1
        parts = head.split(" ")
        if len(parts) == 3 and parts[2].isdigit():
            size = int(parts[2])
            out[s] = buf[pos:pos + size]
            pos += size + 1
        else:   # "<名前> missing"・"ambiguous" など
            out[s] = None
    return out


def is_doc_only(files: list[str], gen: set[str]) -> bool:
    def doc(f: str) -> bool:
        return f.startswith(DOC_PREFIXES) or any(p.match(f) for p in DOC_PATTERNS) or f in gen
    return bool(files) and all(doc(f) for f in files)


def _not_impl(files: list[str], gen: set[str]) -> bool:
    """この検査で実装に数えないコミット：文書だけ、または文書と進め方の設定（ai-team.yaml）だけ"""
    rest = [f for f in files if f not in PROCESS_CONFIG]
    return bool(files) and (not rest or is_doc_only(rest, gen))


def check(root: str, rev: str = "HEAD", start: str = START) -> tuple[list[str], list[str], int]:
    """戻り値：(赤の理由, 決まりの前に入ったとして通した依存, 見た実装のコミットの数)"""
    head_sha = git("rev-parse", "--verify", f"{rev}^{{commit}}", cwd=root).strip()
    rows = [l.split("\t", 1) for l in git("log", "--reverse", "--format=%H%x09%s", f"{start}..{head_sha}", cwd=root).splitlines() if "\t" in l]
    at_rev = read_versions(root, [f"{head_sha}:{TICKETS_JSON}", f"{head_sha}:{GENERATED_JSON}"])
    tickets = _tickets_of(at_rev[f"{head_sha}:{TICKETS_JSON}"])
    if tickets is None:
        raise RuntimeError(f"{head_sha[:10]}（枝の先頭）の版の {TICKETS_JSON} が無いか読めない（JSON でない・\"tickets\" が無い）。読めなければ止める")
    gen = _generated_of(at_rev[f"{head_sha}:{GENERATED_JSON}"])
    mentioned = {k for _, s in rows for k in TICKET.findall(s)}
    impl: list[tuple[str, set[str]]] = []  # 実装のコミット（古い順）と番号
    for sha, subj in rows:
        files = [f for f in git("diff-tree", "--no-commit-id", "--name-only", "-r", "--root", sha, cwd=root).splitlines() if f]
        if not _not_impl(files, gen):
            impl.append((sha, set(TICKET.findall(subj))))
    start_sha = git("rev-parse", "--verify", f"{start}^{{commit}}", cwd=root).strip()
    order = [start_sha] + [sha for sha, _ in rows]
    raw_at = read_versions(root, [f"{c}:{TICKETS_JSON}" for c in order])
    parsed: dict[bytes, dict[str, dict] | None] = {}

    def version(c: str) -> dict[str, dict] | None:
        raw = raw_at.get(f"{c}:{TICKETS_JSON}")
        if raw is None:
            return None
        if raw not in parsed:
            parsed[raw] = _tickets_of(raw)
        return parsed[raw]

    # 外して戻した依存を通さない（テスター Q 回 1 の #2・PM の判断 (ア)）：START の版と、枝の中のそれより前の版に一度でも
    # 載っていた依存を、実装のコミットごとに覚える（git log の順。並んだ枝の版も数えるので、緩む側には倒れない）
    impl_ids = dict(impl)
    seen: dict[str, set[str]] = {}
    seen_before: dict[str, dict[str, frozenset[str]]] = {}
    last_raw: bytes | None = None
    for c in order:
        if c in impl_ids:
            seen_before[c] = {tid: frozenset(seen.get(tid, ())) for tid in impl_ids[c]}
        raw = raw_at.get(f"{c}:{TICKETS_JSON}")
        if raw is None or raw == last_raw:
            continue
        last_raw = raw
        for tid, tk in (version(c) or {}).items():
            seen.setdefault(tid, set()).update(tk.get("depends_on") or [])

    def deps_at(sha: str, tid: str) -> list[str]:
        then = version(sha)
        src = then if then is not None and tid in then else tickets
        own = list(src.get(tid, {}).get("depends_on") or [])
        back = [d for d in tickets.get(tid, {}).get("depends_on") or [] if d in seen_before.get(sha, {}).get(tid, ()) and d not in own]
        return own + back

    def legacy_ok(dep: str) -> bool:
        return dep not in mentioned and tickets.get(dep, {}).get("stage") in DONE_STAGES

    bad, legacy = [], []
    reported: set[tuple[str, str]] = set()
    for i, (sha, ids) in enumerate(impl):
        for tid in sorted(ids):
            for dep in deps_at(sha, tid):
                if dep in ids:
                    continue
                if any(dep in prev_ids and is_ancestor(prev, sha, root) for prev, prev_ids in impl[:i]):
                    continue
                if legacy_ok(dep):
                    legacy.append(f"{dep}（{tid} の依存・決まりの前に入った）")
                    continue
                reported.add((tid, dep))
                bad.append(f"{sha[:10]} {tid} は {dep} に依存するが、{dep} の実装がまだ枝に入っていない（祖先に {dep} の実装のコミットが無い）")
    # 枝の先頭：依存が取り込まれていない実装を取り込まない（原則 11）
    for tid in sorted({k for _, ids in impl for k in ids}):
        for dep in tickets.get(tid, {}).get("depends_on") or []:
            if (tid, dep) in reported or any(dep in ids for _, ids in impl):
                continue
            if legacy_ok(dep):
                legacy.append(f"{dep}（{tid} の依存・決まりの前に入った）")
                continue
            bad.append(f"{head_sha[:10]} 枝の先頭：{tid} は {dep} に依存するが、{dep} の実装がまだ枝に入っていない（枝の先頭の depends_on）")
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
