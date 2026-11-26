#!/usr/bin/env python3
"""先にある実装と突き合わせた版（控えの枝）を読む・確かめる（K-1305・K-146 の G64 の部品）。

聞くことのページ（01_hearing/聞くこと_K-*.md）は、着手前のチケットを先にある実装の版と突き合わせ、その版を
「<K-番号> は枝 <枝> の <sha>」と書き、表の「ファイル:行@sha」でその版の行を指す。チケットが着手前の間は、
その sha が git に在り、ファイル:行 がその版に在ることを G64（ticket_process_test.py の K146-CI-008）が見る。

段の全部の CI は、CI の置き場（使い捨ての写し）を取り出して流す。写しに控えの枝が無いと sha が無く赤になる
（2026-11-26：wfe-2611 に k64-make が無かった）。置き場が写しでも見る中身は同じ（緩めない）なので、
置き場に要る枝をこの台本で出し、置き場に在るかを確かめる。

  declared(text) -> {チケット: (枝, sha)}                ページの「<K-番号> は枝 <枝> の <sha>」
  commit_problems(root, tid, locs, decl) -> [赤の文]     着手前のチケットの「ファイル:行@sha」が、宣言した枝の版で git に在るか
  python3 scripts/ci/prior_refs.py list [--root R]                 着手前のチケットの控えの枝を 1 行ずつ（git push <置き場> $(…) に渡す）
  python3 scripts/ci/prior_refs.py check --remote <置き場> [--root R]   置き場にその枝が無い・置き場の枝の先頭がその sha を含まない → 赤（exit 1）
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
PAGES = "01_hearing/聞くこと_K-*.md"
DECL = re.compile(r"(K-\d+) は枝 ([A-Za-z0-9._/-]+?) の ([0-9a-f]{7,40})(?![0-9a-f])")
LOC = re.compile(r"`?([^`:@\s]+):(\d+)@([0-9a-f]{7,40})`?")
DONE = re.compile(r"^stage:\s*完了\s*$", re.M)


def declared(text: str) -> dict[str, tuple[str, str]]:
    """ページの「<K-番号> は枝 <枝> の <sha>」。同じチケットに違う宣言が 2 つあれば止める（どちらの版か分からない）"""
    out: dict[str, tuple[str, str]] = {}
    for tid, branch, sha in DECL.findall(text):
        if tid in out and out[tid] != (branch, sha):
            raise ValueError(f"{tid} の控えの枝の宣言が 2 つ（{out[tid]} と {(branch, sha)}）")
        out[tid] = (branch, sha)
    return out


def missing_message(tid: str, sha: str, branch: str) -> str:
    return (f"{tid}（着手前）：{sha} がこの git に無い（控えの枝 {branch} を消した？ CI の置き場の写しなら置き場に枝が無い："
            f"PM が python3 scripts/ci/prior_refs.py check --remote <置き場> で確かめ、git push <置き場> {branch} で上げる）")


def _git(root: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=root, capture_output=True, text=True)


def commit_problems(root: Path, tid: str, locs: list[str], decl: dict[str, tuple[str, str]]) -> list[str]:
    """着手前のチケット tid の「ファイル:行@sha」ごとに：控えの枝の宣言が在る・sha が宣言の版か、取り出した木の履歴（HEAD の先祖）に在る・
    sha が git のコミット・ファイル:行 がその版に在る。HEAD の先祖はどの写しにも在り（K-64.md:48@38aee79b は本線の版）、
    宣言の版は PM が置き場に上げる。どちらでもない sha は、置き場に上げる枝が分からないので赤"""
    if tid not in decl:
        return [f"{tid}（着手前）：ページに「{tid} は枝 <枝> の <sha>」が無い（どの控えの枝と突き合わせたか分からない）"]
    branch, dsha = decl[tid]
    bad: list[str] = []
    for loc in locs:
        m = LOC.fullmatch(loc)
        if not m:
            bad.append(f"{tid}：ファイル:行@sha の形でない：{loc}")
            continue
        path, line, sha = m.group(1), int(m.group(2)), m.group(3)
        if _git(root, "cat-file", "-e", f"{sha}^{{commit}}").returncode != 0:
            bad.append(missing_message(tid, sha, branch))
            continue
        same = sha.startswith(dsha) or dsha.startswith(sha)
        if not same and _git(root, "merge-base", "--is-ancestor", sha, "HEAD").returncode != 0:
            bad.append(f"{tid}（着手前）：{loc} の sha が宣言（枝 {branch} の {dsha}）と違う（取り出した木の履歴にも無い）")
            continue
        body = _git(root, "show", f"{sha}:{path}")
        if body.returncode != 0:
            bad.append(f"{tid}（着手前）：{path} が {sha} に無い")
        elif len(body.stdout.splitlines()) < line:
            bad.append(f"{tid}（着手前）：{path}:{line} が {sha} に無い")
    return bad


def pending(root: Path) -> dict[str, tuple[str, str]]:
    """全部のページの宣言のうち、チケットが着手前（stage が完了でない）のもの"""
    out: dict[str, tuple[str, str]] = {}
    for page in sorted(root.glob(PAGES)):
        for tid, ref in declared(page.read_text(encoding="utf-8")).items():
            md = root / "11_tickets" / f"{tid}.md"
            if md.is_file() and DONE.search(md.read_text(encoding="utf-8")):
                continue
            if tid in out and out[tid] != ref:
                raise ValueError(f"{tid} の控えの枝の宣言がページごとに違う（{out[tid]} と {ref}）")
            out[tid] = ref
    return out


def check_remote(root: Path, remote: str) -> list[str]:
    bad: list[str] = []
    for tid, (branch, sha) in sorted(pending(root).items()):
        r = _git(root, "ls-remote", "--heads", remote, f"refs/heads/{branch}")
        if r.returncode != 0:
            bad.append(f"置き場 {remote} が読めない：{r.stderr.strip()}")
            break
        tip = (r.stdout.split() or [""])[0]
        if not tip:
            bad.append(f"{tid}：置き場 {remote} に控えの枝 {branch} が無い（git push {remote} {branch}）")
        elif _git(root, "cat-file", "-e", f"{tip}^{{commit}}").returncode != 0:
            bad.append(f"{tid}：置き場 {remote} の {branch} の先頭 {tip[:10]} が手元に無い（git fetch {remote} {branch}）")
        elif _git(root, "merge-base", "--is-ancestor", sha, tip).returncode != 0:
            bad.append(f"{tid}：置き場 {remote} の枝 {branch}（先頭 {tip[:10]}）が {sha} を含まない（git push {remote} {branch}）")
    return bad


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="prior_refs.py")
    ap.add_argument("cmd", choices=["list", "check"])
    ap.add_argument("--remote", default="")
    ap.add_argument("--root", default=str(ROOT))
    a = ap.parse_args(argv)
    root = Path(a.root)
    if a.cmd == "list":
        for branch in sorted({b for b, _ in pending(root).values()}):
            print(branch)
        return 0
    if not a.remote:
        print("★ check には --remote <置き場> が要る")
        return 1
    bad = check_remote(root, a.remote)
    for b in bad:
        print("★ " + b)
    if not bad:
        print(f"置き場 {a.remote} に着手前のチケットの控えの枝が全部ある（{len(pending(root))} 本）")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
