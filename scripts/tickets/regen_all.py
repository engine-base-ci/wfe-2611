#!/usr/bin/env python3
"""目録の作り手を全部、変わらなくなるまで流す（本線を取り込んだ後の作り直し・設定 catch_up.regen が呼ぶ）。

  python3 scripts/tickets/regen_all.py      引数なし。呼んだ場所が入っている git の作業場所の根で流す

- 作り手の一覧は目録（scripts/ci/generated.json の generators）だけが持つ。この台本は一覧を持たない
- 目録の順に 1 回ずつ流すのを 1 周とし、周の中で 1 つも変わらなくなるまで周を重ねる（上限 3 周）。
  前の作り手が後ろの作り手の生成物を読むので、1 周では足りないことがある
- 終わるとき（落ちたときも）、作った日を刻む出力（目録の作り手の dated に当たる道）のうち、違いが「今日の刻みだけ」の物を、
  始めたときのバイトに戻す。dated に当たらない物は、日付だけの違いでも戻さない（期限や決めた日の本物の変更と見分けられない）
- 覚えるバイトは dated に当たる物だけ（1 ファイル 5MB まで）。ほかは中身の要約（sha256）で比べる
- 作り手が落ちたら最初の 1 つで止める。どの失敗でも例外の跡は出さず、出力の最後の 1 行に理由を出して 0 以外で終わる
- git add もコミットもしない（取り込みの途中の作業場所でも同じ動き）
"""
from __future__ import annotations

import datetime
import fnmatch
import hashlib
import json
import os
import pathlib
import re
import stat
import subprocess
import sys
import tempfile

CATALOG = "scripts/ci/generated.json"
MAX_ROUNDS = 3
MAX_KEEP = 5 * 1024 * 1024   # 始めたときのバイトを覚える上限（1 ファイル）。超える物は戻す対象にしない
SHOW_FILES = 5               # 最後の 1 行に出すファイルの名前の数
SHOW_CHARS = 180             # 名前の並びの長さの上限（説明が最後の 300 字から押し出されないように）
CHUNK = 1 << 20
# 日付の形。生成物の検査（scripts/ci/generated_gate.py の DATE）と同じ式にする（試験が突き合わせる）
DATE = re.compile(rb"\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?")

# ファイル 1 つの覚え方：("bytes", 中身)＝作った日を刻む出力／("sha", 要約)＝ほか／None＝作業場所に無い
Entry = tuple[str, bytes] | None
Snapshot = dict[str, Entry]
MISSING = (FileNotFoundError, IsADirectoryError, NotADirectoryError)


class Stop(Exception):
    """0 以外で終わる。文は出力の最後の 1 行になる"""


def find_root() -> pathlib.Path:
    r = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0 or not r.stdout.strip():
        raise Stop("git の作業場所の外から呼ばれた。作り手は 1 つも流していない")
    return pathlib.Path(r.stdout.strip())


def load_generators(root: pathlib.Path) -> list[dict]:
    """目録を読む。読めない・流せない項目が 1 つでもあれば、1 つも流さずに止める"""
    none = "作り手は 1 つも流していない"
    try:
        gens = json.loads((root / CATALOG).read_text(encoding="utf-8")).get("generators")
    except (OSError, ValueError, AttributeError) as e:
        raise Stop(f"目録を読めない：{CATALOG}（{type(e).__name__}）。{none}") from e
    if not isinstance(gens, list) or not gens:
        raise Stop(f"目録に generators の並びが無い（か空）：{CATALOG}。{none}")
    for i, g in enumerate(gens):
        if not isinstance(g, dict) or not isinstance(g.get("run"), str) or not g["run"].strip():
            raise Stop(f"目録の {i + 1} 番目の作り手に run が無い：{CATALOG}。{none}")
        dated = g.get("dated", [])
        if not isinstance(dated, list) or not all(isinstance(d, str) and d.strip() for d in dated):
            raise Stop(f"目録の {i + 1} 番目の作り手の dated が、道の並びでない：{CATALOG}。{none}")
    return gens


def known_files(root: pathlib.Path) -> list[str]:
    """git が知っているファイル（版に入っている物と、無視していない新しい物）。取り込みの途中は同じ道が 2〜3 回出るので 1 つにする"""
    out: dict[str, None] = {}
    for extra in ([], ["--others", "--exclude-standard"]):
        cmd = ["git", "ls-files", "-z", *extra]
        r = subprocess.run(cmd, cwd=root, capture_output=True)
        if r.returncode != 0:
            why = r.stderr.decode("utf-8", "replace").strip().splitlines()[-1:]
            raise Stop(f"git の命令が落ちた（終わりの値 {r.returncode}）：{' '.join(cmd)} {' '.join(why)[:120]}")
        out.update(dict.fromkeys(f for f in r.stdout.decode("utf-8", "surrogateescape").split("\0") if f))
    return list(out)


def read_entry(path: pathlib.Path, keep_bytes: bool) -> Entry:
    """作った日を刻む出力（5MB まで・リンクでない物）は中身を、ほかは sha256 を覚える"""
    try:
        if keep_bytes and not path.is_symlink() and path.stat().st_size <= MAX_KEEP:
            return ("bytes", path.read_bytes())
        h = hashlib.sha256()
        with open(path, "rb") as fh:
            while chunk := fh.read(CHUNK):
                h.update(chunk)
        return ("sha", h.digest())
    except MISSING:
        return None   # 版にあるのに作業場所に無い物は「無い」として覚える


def snapshot(root: pathlib.Path, dated: list[str]) -> Snapshot:
    snap: Snapshot = {}
    for f in known_files(root):
        try:
            snap[f] = read_entry(root / f, any(fnmatch.fnmatch(f, d) for d in dated))
        except OSError as e:
            raise Stop(f"ファイルを読めない（{type(e).__name__}）：{f}") from e
    return snap


def today_only(old: bytes, new: bytes, today: set[bytes]) -> bool:
    """違いが今日の刻みだけか：日付の形を伏せると同じで、違っている日付の新しい側の年月日がどれも今日"""
    if DATE.sub(b"D", old) != DATE.sub(b"D", new):
        return False
    olds = [m.group(0) for m in DATE.finditer(old)]
    news = [m.group(0) for m in DATE.finditer(new)]
    if len(olds) != len(news):
        return False
    return all(n[:10] in today for o, n in zip(olds, news) if o != n)


def same(a: Entry, b: Entry, today: set[bytes]) -> bool:
    if a == b:
        return True
    if a is None or b is None or a[0] != "bytes" or b[0] != "bytes":
        return False
    return today_only(a[1], b[1], today)


def changed_files(prev: Snapshot, now: Snapshot, today: set[bytes]) -> list[str]:
    """変わった・新しくできた・消えた物。作った日を刻む出力の、今日の刻みだけの違いは数えない"""
    return [f for f in sorted(set(prev) | set(now)) if not same(prev.get(f), now.get(f), today)]


def replace_file(path: pathlib.Path, body: bytes) -> None:
    """同じフォルダの一時のファイルに書き切ってから置き換える（元のファイルの中に直に書かない）。権限は元に合わせる"""
    mode = stat.S_IMODE(path.stat().st_mode)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".regen-")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(body)
        os.chmod(tmp, mode)
        os.replace(tmp, path)
    except BaseException:
        pathlib.Path(tmp).unlink(missing_ok=True)
        raise


def put_back(root: pathlib.Path, start: Snapshot, today: set[bytes]) -> list[str]:
    """今日の刻みだけが変わった「作った日を刻む出力」を、始めたときのバイトに戻す。戻せなかった道を返す（落とさない）"""
    failed = []
    for f, old in start.items():
        if old is None or old[0] != "bytes":
            continue
        try:
            now = read_entry(root / f, True)
            if now is not None and now[0] == "bytes" and now[1] != old[1] and today_only(old[1], now[1], today):
                replace_file(root / f, old[1])
        except OSError as e:
            failed.append(f"{f}（{type(e).__name__}）")
    return failed


def short(names: list[str]) -> str:
    """先頭の数件と総数。長すぎる名前の並びは切る"""
    head = " ".join(names[:SHOW_FILES])
    if len(head) > SHOW_CHARS:
        head = head[:SHOW_CHARS] + "…"
    return f"{len(names)} 件：{head}" + (" ほか" if len(names) > SHOW_FILES else "")


def run_round(root: pathlib.Path, gens: list[dict]) -> None:
    for g in gens:
        r = subprocess.run(g["run"], cwd=root, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode != 0:
            sys.stdout.write(r.stdout)
            sys.stdout.flush()
            sys.stderr.write(r.stderr)
            one = " ".join(f'{g.get("name", "")}（{g["run"]}）'.split())
            raise Stop(f"作り手が落ちた（終わりの値 {r.returncode}）：{one}")


def settle(root: pathlib.Path, gens: list[dict], dated: list[str], start: Snapshot, today: set[bytes]) -> int:
    """変わらなくなるまで周を重ねる。流した周の数を返す"""
    prev = start
    for n in range(1, MAX_ROUNDS + 1):
        run_round(root, gens)
        now = snapshot(root, dated)
        changed = changed_files(prev, now, today)
        if not changed:
            return n
        prev = now
    raise Stop(f"{MAX_ROUNDS} 周流してもまだ変わる（目録の順か作り手を直す）。まだ変わるファイル {short(changed)}")


def regen(root: pathlib.Path, gens: list[dict], today: set[bytes]) -> int:
    dated = [d for g in gens for d in g.get("dated", [])]
    start = snapshot(root, dated)   # ここで落ちたら、作り手は 1 つも流さない
    err: Stop | None = None
    rounds = 0
    try:
        rounds = settle(root, gens, dated, start, today)
    except Stop as e:
        err = e
    except OSError as e:
        err = Stop(f"ファイルの読み書きに失敗した（{type(e).__name__}）：{e.filename or e}")
    failed = put_back(root, start, today)
    back = f"今日の刻みを戻せなかったファイル {short(failed)}" if failed else ""
    if err is not None:
        raise Stop(f"{err}／{back}" if back else str(err))
    if back:
        raise Stop(back)
    return rounds


def main() -> int:
    now = datetime.datetime.now()
    utc = datetime.datetime.now(datetime.timezone.utc)
    today = {now.date().isoformat().encode(), utc.date().isoformat().encode()}
    try:
        root = find_root()
        gens = load_generators(root)
        rounds = regen(root, gens, today)
    except (Stop, OSError) as e:
        sys.stdout.flush()
        print(f"\nregen_all: 止めた — {' '.join(str(e).split())}", file=sys.stderr)
        return 1
    print(f"regen_all: 作り手 {len(gens)} 個を {rounds} 周流した。もう変わらない")
    return 0


if __name__ == "__main__":
    sys.exit(main())
