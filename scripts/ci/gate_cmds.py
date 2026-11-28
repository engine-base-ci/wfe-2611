#!/usr/bin/env python3
"""CI の段の命令の並びを、チケットごとのファイル（<名前>.d/_base.txt・K-<数字>.txt）から作る部品（K-376）。

自己試験を足すチケットが皆、作り手の同じ 1 行（命令を && でつないだ行）を変えると、同時に作った 2 本が取り込みでぶつかる。
足す分をチケットごとのファイルに分ければ、別のファイルなのでぶつからない。同じ命令を 2 つの行が持てば止める（黙って 2 回流さない）。

  files(dir)              置き場のファイルを並べる順に出す（_base.txt が先・続いて K- の番号の順。README.md と隠しファイルは外す）
  commands(dir, last)     1 行 1 命令で読み、last を最後へ動かした並び
  script(dir, last)       並びを " && " でつないだ 1 行（作り手が CI の定義に書く）

決まり：置ける名前は _base.txt・K-<数字>.txt（数字は 0 で始めない）・README.md と隠しファイル。中のフォルダは置けない。
空の行と # で始まる行は飛ばす。行の中のつなぎ（; | & # ` $(）は止める：つなぐのは作り手だけ
（行の途中の # は && でつなぐと後ろの命令を全部注釈にし、| は終わりの値を隠すので、段が試験を流さずに緑になる）。
"""
from __future__ import annotations

import re
from pathlib import Path

BASE = "_base.txt"
TICKET = re.compile(r"^K-([1-9][0-9]*)\.txt$")   # ASCII の数字だけ（全角の数字は止める）
SKIP = ("README.md",)
JOINERS = (";", "|", "&", "#", "`", "$(")


class GateListError(Exception):
    """置き場の形が決まりに合わない、または並びが作れない。"""


def files(directory: Path) -> list[Path]:
    """置き場のファイルを並べる順に出す。決まりに合わない名前・フォルダ・_base.txt が無い・置き場が無いは止める。"""
    directory = Path(directory)
    if not directory.is_dir():
        raise GateListError(f"{directory}: 置き場が無い（{BASE} を置いた置き場が要る）")
    tickets: list[tuple[int, Path]] = []
    base: Path | None = None
    for path in sorted(directory.iterdir()):
        name = path.name
        if name in SKIP or name.startswith("."):   # 隠しファイル（Mac の .DS_Store など）は並びではない
            continue
        if not path.is_file():
            raise GateListError(f"{directory}: {name} はフォルダ（置けるのは {BASE}・K-<数字>.txt・README.md のファイルだけ）")
        if name == BASE:
            base = path
            continue
        m = TICKET.match(name)
        if not m:
            raise GateListError(
                f"{directory}: {name} は置けない名前（置けるのは {BASE}・K-<数字>.txt（0 で始めない）・README.md）")
        tickets.append((int(m.group(1)), path))
    if base is None:
        raise GateListError(f"{directory}: {BASE} が無い")
    return [base, *(p for _, p in sorted(tickets))]


def _lines(path: Path) -> list[str]:
    out: list[str] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        bad = [j for j in JOINERS if j in line]
        if bad:
            raise GateListError(
                f"{path.name}: 1 行に 1 つの命令（{' '.join(bad)} は書けない。つなぐのは作り手だけ）: {line}")
        out.append(line)
    return out


def commands(directory: Path, last: str | None = None) -> list[str]:
    """置き場の命令の並び。同じ命令が 2 回なら止める。last はどのファイルにあっても最後へ動かす（無ければ止める）。"""
    seen: dict[str, str] = {}
    found: list[str] = []
    for path in files(directory):
        for cmd in _lines(path):
            if cmd in seen:
                raise GateListError(f"同じ命令が 2 回（{seen[cmd]} と {path.name}）: {cmd}")
            seen[cmd] = path.name
            found.append(cmd)
    if not found:
        raise GateListError(f"{directory}: 命令が 1 つも無い")
    if last is not None:
        if last not in seen:
            raise GateListError(f"{directory}: 最後に置く命令がどのファイルにも無い: {last}")
        found = [c for c in found if c != last] + [last]
    return found


def script(directory: Path, last: str | None = None) -> str:
    """並びを " && " でつないだ 1 行。"""
    return " && ".join(commands(directory, last=last))
