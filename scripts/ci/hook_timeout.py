#!/usr/bin/env python3
"""試験の準備の時間切れ（vitest の「Hook timed out in <数>ms」）を扱う台本（K-193）。命令は 2 つ。

  note <置き場かファイル>...    CI の組が赤のとき、準備の時間切れをほかの赤と見分けて 1 行で出す。終わりの値は常に 0（組の赤・緑は変えない）
  measure <回ごとの記録の置き場>  vitest の記録（blob）から準備の時間を測る。上限（vitest.config.ts の hookTimeout）を引き直すときに人が読む表

出す文は事実だけ：この文は、台が混んだときも、製品の不具合で準備が返らないときも、beforeEach・afterAll でも同じに出る。原因は言わない。
JUnit の形は vitest 3.2.7 の実物で確かめた（2026-11-13）：beforeAll・afterAll の時間切れは、その入れ物（ファイル・describe）の名前の
testcase が 1 つ足され、その failure に書かれる（中の試験は skipped）。beforeEach は、その試験の testcase の failure。testsuite の直下の error も読む。
"""
from __future__ import annotations

import json
import pathlib
import re
import sys
import xml.etree.ElementTree as ET

HOOK = re.compile(r"Hook timed out in \d+ms")
ANSI = re.compile(r"\x1b\[[0-9;]*m")
FAIL = re.compile(r"\bFAIL\s+(\S+)")
TOP = 8   # measure が出す上位の本数
UNKNOWN = "（ファイル不明・直前に FAIL の行が無い）"


# ---------------------------------------------------------------- note
def _text(el: ET.Element) -> str:
    return (el.get("message") or "") + "\n" + "".join(el.itertext())


def _is_hook(els: list[ET.Element]) -> bool:
    return any(HOOK.search(_text(e)) for e in els)


def read_junit(root: ET.Element) -> tuple[list[str], int]:
    """（準備の時間切れがあった試験のファイル, そのほかの赤の testcase の数）"""
    slow: list[str] = []
    other = 0
    for ts in root.iter("testsuite"):
        hit = _is_hook(ts.findall("error"))
        for tc in ts.findall("testcase"):
            bad = tc.findall("failure") + tc.findall("error")
            if not bad:
                continue
            if _is_hook(bad):
                hit = True
            else:
                other += 1
        if hit:
            slow.append(ts.get("name") or "（名前の無い testsuite）")
    return slow, other


def read_log(text: str) -> list[str]:
    """段の出力の写し：FAIL の後ろの試験のファイルを覚え、その後の時間切れの行をそのファイルに数える。
    直前に FAIL の行が無い時間切れの行も捨てない（ファイル不明として数える）"""
    slow: list[str] = []
    last = None
    for line in ANSI.sub("", text).splitlines():
        m = FAIL.search(line)
        if m and "/" in m.group(1):
            last = m.group(1)
        if HOOK.search(line):
            slow.append(last or UNKNOWN)
    return slow


def gather(args: list[str]) -> list[pathlib.Path]:
    files: list[pathlib.Path] = []
    for a in args:
        p = pathlib.Path(a)
        if p.is_dir():
            files += sorted(x for x in p.rglob("*") if x.is_file())
        elif p.is_file():
            files.append(p)
    return files


def note(args: list[str]) -> int:
    files = gather(args)
    if not files:
        print("読む記録が無い（JUnit・段の出力の写し）：" + " ".join(args))
        return 0
    slow: list[str] = []
    other = 0
    junits = logs = 0
    for f in files:
        if f.suffix == ".xml":
            try:
                found, n = read_junit(ET.parse(f).getroot())
            except Exception:   # 読めない形は何でも：名前を出して続ける（この段が落ちて元の赤を隠さない）
                print(f"読めない記録：{f.name}")
                continue
            other += n
            junits += 1
        else:
            logs += 1
            try:
                found = read_log(f.read_text(encoding="utf-8", errors="replace"))
            except OSError:
                print(f"読めない記録：{f.name}")
                continue
        for name in found:
            if name not in slow:
                slow.append(name)
    if not slow:
        return 0
    for name in slow:
        print(f"★ 準備の時間切れ（Hook timed out）：{ANSI.sub('', name)} — この組の試験の本体は流れていない")
    # 「そのほかの赤」は JUnit の testcase だけを数える。写しの中の赤は数えていないので、0 件を「ほかに赤は無い」と読ませない
    tail = f"／そのほかの赤 {other} 件" if junits else "（JUnit なし・そのほかの赤は数えていない）"
    print(f"準備の時間切れ {len(slow)} 件{tail}" + ("（段の出力の写しの中のそのほかの赤は数えていない）" if junits and logs else ""))
    return 0


# ---------------------------------------------------------------- measure
def parse_blob(path: pathlib.Path):
    """vitest の blob（番号で指し合う JSON の並び。文字の値は並びの番号）を、元の入れ子に開く"""
    arr = json.loads(path.read_text(encoding="utf-8"))
    done: dict[int, object] = {}

    def rev(i: int):
        if i in done:
            return done[i]
        v = arr[i]
        if isinstance(v, list):
            out: list = []
            done[i] = out
            out.extend(rev(int(x)) if isinstance(x, str) else x for x in v)
            return out
        if isinstance(v, dict):
            obj: dict = {}
            done[i] = obj
            for k, x in v.items():
                obj[k] = rev(int(x)) if isinstance(x, str) else x
            return obj
        done[i] = v
        return v

    return rev(0)


def blob_files(root) -> list[dict]:
    for x in root if isinstance(root, list) else []:
        if isinstance(x, list) and x and isinstance(x[0], dict) and "filepath" in x[0]:
            return x
    return []


def _duration(t: dict) -> float:
    return (t.get("result") or {}).get("duration") or 0


def hook_ms(file: dict) -> float | None:
    """入れ物（ファイル・describe）の時間 − 中の物の時間の合計＝その入れ物の準備と片付け。ファイルの中の最大"""
    out: list[float] = []

    def walk(x: dict) -> None:
        kids = x.get("tasks") or []
        if (x.get("result") or {}).get("duration") is not None and x.get("type") != "test":
            out.append(_duration(x) - sum(_duration(k) for k in kids))
        for k in kids:
            if k.get("type") != "test":
                walk(k)

    walk(file)
    return max(out) if out else None


def timed_out(t: dict) -> bool:
    errs = (t.get("result") or {}).get("errors") or []
    return any(HOOK.search(str(e.get("message", ""))) for e in errs if isinstance(e, dict)) or any(timed_out(k) for k in t.get("tasks") or [])


def measure(args: list[str]) -> int:
    if len(args) != 1 or not pathlib.Path(args[0]).is_dir():
        print("使い方：hook_timeout.py measure <回ごとの記録の置き場>（下に <回の番号>/vitest-blob-<組>/blob-*.json）")
        return 2
    rows: list[tuple[str, str, str, float, bool]] = []   # 回・組の記録・ファイル・準備の ms・時間切れ
    for b in sorted(pathlib.Path(args[0]).glob("*/vitest-blob-*/blob-*.json")):
        try:
            files = blob_files(parse_blob(b))
        except (OSError, ValueError, IndexError, RecursionError) as e:
            print(f"読めない記録：{b}（{type(e).__name__}）")
            continue
        run = b.parent.parent.name
        for f in files:
            rows.append((run, b.stem, str(f.get("name") or f.get("filepath")), hook_ms(f) or 0.0, timed_out(f)))
    if not rows:
        print(f"読む記録が無い（{args[0]}/<回の番号>/vitest-blob-<組>/blob-*.json）")
        return 1
    runs: dict[str, list] = {}
    for r in rows:
        runs.setdefault(r[0], []).append(r)
    print("| 回 | ファイルの数 | 最大の秒 | そのファイル | 上限以上（Hook timed out） |\n|---|---|---|---|---|")
    for run, rs in runs.items():
        top = max(rs, key=lambda r: r[3])
        print(f"| {run} | {len(rs)} | {top[3] / 1000:.2f} | {top[2]} | {sum(1 for r in rs if r[4])} |")
    print(f"\n上位 {TOP} 本\n\n| 準備の秒 | 回 | 組の記録 | ファイル | 印 |\n|---|---|---|---|---|")
    for r in sorted(rows, key=lambda r: -r[3])[:TOP]:
        print(f"| {r[3] / 1000:.2f} | {r[0]} | {r[1]} | {r[2]} | {'上限以上' if r[4] else ''} |")
    cut = [r for r in rows if r[4]]
    print(f"\n回 {len(runs)}・ファイル {len(rows)}・測れた最大 {max(r[3] for r in rows) / 1000:.2f} 秒・上限以上（時間切れ） {len(cut)} 件")
    for r in cut:
        print(f"  上限以上：{r[0]} {r[1]} {r[2]}")
    print("spec の組（層の棚卸しの中の vitest）は記録を残さない。段の出力の写し（gate-logs/g27.log）の時間切れは note で見る")
    return 0


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[0] == "note":
        try:
            return note(argv[1:])
        except Exception as e:   # 見分けの段は組の赤・緑を変えない：台本の誤りでも 0 で終わり、1 行で言う
            print(f"見分けの台本が途中で止まった（{type(e).__name__}）：時間切れかどうかは記録を読んで確かめる")
            return 0
    if argv and argv[0] == "measure":
        return measure(argv[1:])
    print(__doc__)
    return 0 if not argv else 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
