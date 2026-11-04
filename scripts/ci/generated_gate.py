#!/usr/bin/env python3
"""生成物が最新か（D-128.123・K-38）。目録は scripts/ci/generated.json。

  python3 scripts/ci/generated_gate.py            作り手を順に全部回し、作る前と後で中身が変わった生成物を赤にする
  python3 scripts/ci/generated_gate.py --selftest わざと古くした生成物を見つけられるか（検査が働いているか）

赤になるもの:
  F1 作り手を回したら中身が変わった（＝コミットされている生成物が古い）。日付（2026-11-04 など）だけの違いは見ない
  F2 作り手が落ちた
  F3 目録に無い生成物（先頭 3 行に「生成物」「手で直さない」などと書いたファイルが、どの作り手にも・履歴にも・しまった物にも入っていない）
  F4 古いと記録した物（known_stale）が、もう古くない（記録を外す）
回し終えたら、作業中のファイルは全部元に戻す（手元を汚さない）。CI はまっさらな checkout で回す。
"""
from __future__ import annotations
import fnmatch, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CFG = json.load(open(os.path.join(ROOT, "scripts/ci/generated.json"), encoding="utf-8"))
DATE = re.compile(rb"\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?")
MARK = re.compile(r"生成物|機械生成|手で直さない|手で書かない|自動生成|が生成|から生成")
SKIP_PREFIX = ("scripts/", ".qa/", ".spec-sync/", "11_tickets/K-", ".claude/")
CODE_EXT = (".py", ".mjs", ".js")


def tracked() -> list[str]:
    # -z：日本語の名前を "\343..." と化けさせない（化けると開けずに黙って飛ばしていた・2026-11-04 dagci で見つけた）
    return [f for f in subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, text=True).stdout.split("\0") if f]


def untracked() -> set[str]:
    out = subprocess.run(["git", "ls-files", "-z", "--others", "--exclude-standard"], cwd=ROOT, capture_output=True, text=True).stdout
    return {f for f in out.split("\0") if f}


def read(f: str) -> bytes | None:
    try:
        with open(os.path.join(ROOT, f), "rb") as h:
            return h.read()
    except FileNotFoundError:
        return None


def match(path: str, globs: list[str]) -> bool:
    return any(fnmatch.fnmatch(path, g) for g in globs)


def known(path: str) -> dict | None:
    for k in CFG.get("known_stale", []):
        if k.get("path") == path or ("glob" in k and fnmatch.fnmatch(path, k["glob"])):
            return k
    return None


def run_all(files: list[str]) -> tuple[dict[str, list[str]], list[str]]:
    """作り手を順に回す。作り手ごとに、変わったファイルを返す（日付を伏せて比べる）"""
    before = {f: read(f) for f in files}
    extra_before = untracked()
    changed: dict[str, list[str]] = {}
    broken: list[str] = []
    seen: dict[str, bytes | None] = dict(before)
    for g in CFG["generators"]:
        r = subprocess.run(g["run"], cwd=ROOT, shell=True, capture_output=True, text=True)
        if r.returncode != 0:
            broken.append(f'{g["name"]}（{g["run"]}）: {(r.stderr or r.stdout).strip().splitlines()[-1:]}')
        hit = []
        for f in files:
            now = read(f)
            if now != seen[f]:
                seen[f] = now
                if now is None or before[f] is None or DATE.sub(b"D", now) != DATE.sub(b"D", before[f]):
                    hit.append(f)
        for f in sorted(untracked() - extra_before):
            if f not in seen:
                seen[f] = None
                hit.append(f + "（新しくできた）")
        if hit:
            changed[g["name"]] = hit
    # 元に戻す
    for f, b in before.items():
        if read(f) != b and b is not None:
            with open(os.path.join(ROOT, f), "wb") as h:
                h.write(b)
    for f in untracked() - extra_before:
        os.remove(os.path.join(ROOT, f))
    return changed, broken


def coverage(files: list[str]) -> list[str]:
    # まだ git に入れていないファイルも見る（入れる前に回して漏れた・K-29）
    files = sorted(set(files) | untracked())
    outs = [o for g in CFG["generators"] for o in g["outputs"]]
    outs += [o for c in CFG.get("checked_elsewhere", []) for o in c["outputs"]]
    outs += [h["glob"] for h in CFG.get("history", [])] + [h["glob"] for h in CFG.get("frozen", [])]
    nogen = {n["path"] for n in CFG.get("not_generated", [])}
    bad = []
    for f in files:
        if f.startswith(SKIP_PREFIX) or f.endswith(CODE_EXT) or f in nogen or match(f, outs) or known(f):
            continue
        try:
            head = "".join(open(os.path.join(ROOT, f), encoding="utf-8").readlines()[:3])
        except (UnicodeDecodeError, FileNotFoundError, IsADirectoryError):
            continue
        if MARK.search(head):
            bad.append(f)
    return bad


def gate() -> int:
    files = tracked()
    changed, broken = run_all(files)
    fails, warns = [], []
    stale_known = set()
    for name, fs in changed.items():
        for f in fs:
            k = known(f.replace("（新しくできた）", ""))
            if k:
                stale_known.add(json.dumps(k, ensure_ascii=False))
                warns.append(f"記録どおり古い（{k['ticket']}）: {f}")
            else:
                fails.append(f"F1 {name} を回すと変わる（コミットされている生成物が古い）: {f}")
    for k in CFG.get("known_stale", []):
        if json.dumps(k, ensure_ascii=False) not in stale_known and "path" in k and not k.get("broken_generator"):
            fails.append(f"F4 古いと記録した物が、もう古くない（generated.json の known_stale から外す）: {k['path']}")
    fails += [f"F2 作り手が落ちた: {b}" for b in broken]
    fails += [f"F3 目録に無い生成物（generated.json に作り手を足すか、理由を書く）: {f}" for f in coverage(files)]
    for w in warns[:20]:
        print("  warn", w)
    if len(warns) > 20:
        print(f"  warn … ほか {len(warns) - 20} 件")
    for f in fails:
        print("  ★", f)
    n = len(CFG["generators"])
    print(f"作り手 {n} ／ 変わった生成物 {sum(len(v) for v in changed.values())}（記録どおり {len(warns)}）")
    print("FAIL — 生成物が古い" if fails else "PASS — 生成物は全部最新（記録したものを除く）")
    return 1 if fails else 0


def selftest() -> int:
    target = CFG["generators"][0]["outputs"][0]
    orig = read(target)
    try:
        with open(os.path.join(ROOT, target), "ab") as h:
            h.write("\n/* わざと古くする */\n".encode())
        changed, _ = run_all(tracked())
        hit = any(target in fs for fs in changed.values())
    finally:
        with open(os.path.join(ROOT, target), "wb") as h:
            h.write(orig)
    print("PASS — わざと古くした生成物を見つけた" if hit else "FAIL — わざと古くした生成物を見つけられない")
    return 0 if hit else 1


if __name__ == "__main__":
    sys.exit(selftest() if "--selftest" in sys.argv else gate())
