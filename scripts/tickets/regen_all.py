#!/usr/bin/env python3
"""目録の作り手を全部、変わらなくなるまで流す（本線を取り込んだ後の作り直し・設定 catch_up.regen が呼ぶ）。

  python3 scripts/tickets/regen_all.py      引数なし。呼んだ場所が入っている git の作業場所の根で流す

- 作り手の一覧は目録（scripts/ci/generated.json の generators）だけが持つ。この台本は一覧を持たない
- 目録の順に 1 回ずつ流すのを 1 周とし、周の中で 1 つも変わらなくなるまで周を重ねる（上限 3 周）。
  前の作り手が後ろの作り手の生成物を読むので、1 周では足りないことがある
- 終わるとき（落ちたときも）、中身の違いが「今日の日付だけ」の物は、始めたときのバイトに戻す
- 作り手が落ちたら最初の 1 つで止め、出力の最後の 1 行に name と run を出して 0 以外で終わる
- git add もコミットもしない（取り込みの途中の作業場所でも同じ動き）
"""
from __future__ import annotations

import datetime
import json
import pathlib
import re
import subprocess
import sys

CATALOG = "scripts/ci/generated.json"
MAX_ROUNDS = 3
# 日付の形。生成物の検査（scripts/ci/generated_gate.py の DATE）と同じ式にする（試験が突き合わせる）
DATE = re.compile(rb"\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?")

Snapshot = dict[str, "bytes | None"]


class Stop(Exception):
    """0 以外で終わる。文は出力の最後の 1 行になる"""


def find_root() -> pathlib.Path:
    r = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0 or not r.stdout.strip():
        raise Stop("git の作業場所の外から呼ばれた。作り手は 1 つも流していない")
    return pathlib.Path(r.stdout.strip())


def load_generators(root: pathlib.Path) -> list[dict]:
    """目録を読む。読めない・流せない項目が 1 つでもあれば、1 つも流さずに止める"""
    try:
        gens = json.loads((root / CATALOG).read_text(encoding="utf-8")).get("generators")
    except (OSError, ValueError, AttributeError) as e:
        raise Stop(f"目録を読めない：{CATALOG}（{type(e).__name__}）。作り手は 1 つも流していない") from e
    if not isinstance(gens, list) or not gens:
        raise Stop(f"目録に generators の並びが無い（か空）：{CATALOG}。作り手は 1 つも流していない")
    for i, g in enumerate(gens):
        if not isinstance(g, dict) or not isinstance(g.get("run"), str) or not g["run"].strip():
            raise Stop(f"目録の {i + 1} 番目の作り手に run が無い：{CATALOG}。作り手は 1 つも流していない")
    return gens


def known_files(root: pathlib.Path) -> list[str]:
    """git が知っているファイル（版に入っている物と、無視していない新しい物）。取り込みの途中は同じ道が 2〜3 回出るので 1 つにする"""
    out: dict[str, None] = {}
    for extra in ([], ["--others", "--exclude-standard"]):
        r = subprocess.run(["git", "ls-files", "-z", *extra], cwd=root, capture_output=True, check=True)
        out.update(dict.fromkeys(f for f in r.stdout.decode("utf-8", "surrogateescape").split("\0") if f))
    return list(out)


def snapshot(root: pathlib.Path) -> Snapshot:
    snap: Snapshot = {}
    for f in known_files(root):
        try:
            snap[f] = (root / f).read_bytes()
        except (FileNotFoundError, IsADirectoryError, NotADirectoryError):
            snap[f] = None   # 版にあるのに作業場所に無い物は「無い」として覚える
    return snap


def today_only(old: bytes, new: bytes, today: set[bytes]) -> bool:
    """違いが今日の日付だけか：日付の形を伏せると同じで、違っている日付の新しい側の年月日がどれも今日"""
    if DATE.sub(b"D", old) != DATE.sub(b"D", new):
        return False
    olds = [m.group(0) for m in DATE.finditer(old)]
    news = [m.group(0) for m in DATE.finditer(new)]
    if len(olds) != len(news):
        return False
    return all(n[:10] in today for o, n in zip(olds, news) if o != n)


def changed_files(prev: Snapshot, now: Snapshot, today: set[bytes]) -> list[str]:
    """変わった・新しくできた・消えた物。今日の日付だけの違いは数えない"""
    out = []
    for f in sorted(set(prev) | set(now)):
        a, b = prev.get(f), now.get(f)
        if a == b:
            continue
        if a is None or b is None or not today_only(a, b, today):
            out.append(f)
    return out


def put_back(root: pathlib.Path, start: Snapshot, today: set[bytes]) -> None:
    """今日の日付だけが変わった物を、始めたときのバイトに戻す。中身の違い・新しい物・消えた物は触らない"""
    for f, old in start.items():
        if old is None:
            continue
        try:
            now = (root / f).read_bytes()
        except (FileNotFoundError, IsADirectoryError, NotADirectoryError):
            continue
        if now != old and today_only(old, now, today):
            (root / f).write_bytes(old)


def run_round(root: pathlib.Path, gens: list[dict]) -> None:
    for g in gens:
        r = subprocess.run(g["run"], cwd=root, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode != 0:
            sys.stdout.write(r.stdout)
            sys.stdout.flush()
            sys.stderr.write(r.stderr)
            one = " ".join(f'{g.get("name", "")}（{g["run"]}）'.split())
            raise Stop(f"作り手が落ちた（終わりの値 {r.returncode}）：{one}")


def regen(root: pathlib.Path, gens: list[dict], today: set[bytes]) -> int:
    """変わらなくなるまで周を重ねる。流した周の数を返す"""
    start = snapshot(root)
    try:
        prev = start
        for n in range(1, MAX_ROUNDS + 1):
            run_round(root, gens)
            now = snapshot(root)
            changed = changed_files(prev, now, today)
            if not changed:
                return n
            prev = now
        raise Stop(f"{MAX_ROUNDS} 周流してもまだ変わる（目録の順か作り手を直す）：{' '.join(changed)}")
    finally:
        put_back(root, start, today)


def main() -> int:
    now = datetime.datetime.now()
    utc = datetime.datetime.now(datetime.timezone.utc)
    today = {now.date().isoformat().encode(), utc.date().isoformat().encode()}
    try:
        root = find_root()
        gens = load_generators(root)
        rounds = regen(root, gens, today)
    except Stop as e:
        sys.stdout.flush()
        print(f"\nregen_all: 止めた — {e}", file=sys.stderr)
        return 1
    print(f"regen_all: 作り手 {len(gens)} 個を {rounds} 周流した。もう変わらない")
    return 0


if __name__ == "__main__":
    sys.exit(main())
