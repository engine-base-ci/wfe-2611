#!/usr/bin/env python3
"""チケットごとのファイル（<名前>.d/K-xxx.*）を読んで、共通の表に足し合わせる部品（K-325）。

同時に作る 2 本のチケットが同じ表の終わりに 1 行ずつ足すと、取り込みでぶつかる。
表に足す分をチケットごとのファイルに分ければ、別のファイルなのでぶつからない。
同じ鍵を 2 つのファイルが持てば、ここで止める（黙ってどちらかを取らない）。

  fragments(dir, ".py")        置き場の断片を名前の順に出す（_base.json・README.md・隠しファイルは外す。決まりに合わない名前は止める）
  merge_py(target, dir, ...)   .py の断片を 1 つずつ実行し、大文字の名前ごとに target の表へ足す

足し方：dict は鍵ごと（同じ鍵は止める）・set は和・list はつなぐ。
名前で指す（K-990）：(名前, …) の組を値に持つ dict の表に、断片が値を名前の文字だけで書くと、同じ表で同じ名前の組をそのまま使う
（ほかの断片の形を写さない）。当たる組が無ければ止める。読む側は今までどおり組だけを見る。
screen_lists に挙げた名前は「画面 → 行のリスト」で、同じ画面は行をつなぎ、行の operationId（5 つ目）が重なれば止める。
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Mapping, Sequence

FRAGMENT = re.compile(r"^K-\d+\.(py|json)$")
SKIP = ("_base.json", "README.md")


class RegistryConflict(Exception):
    """断片どうし・断片と元の表がぶつかった、または断片の形が決まりに合わない。"""


def _number(path: Path) -> int:
    return int(path.name.split("-", 1)[1].split(".", 1)[0])


def fragments(directory: Path, suffix: str) -> list[Path]:
    """置き場の断片（K-<数字><suffix>）を番号の順に出す。決まりに合わない名前があれば止める。"""
    directory = Path(directory)
    if not directory.is_dir():
        return []
    found: list[Path] = []
    for path in sorted(directory.iterdir()):
        if path.name in SKIP or path.name.startswith("."):   # 隠しファイル（Mac の .DS_Store など）は断片ではない
            continue
        if not FRAGMENT.match(path.name):
            raise RegistryConflict(
                f"{directory}: {path.name} は置けない名前（置けるのは K-<数字>.py・K-<数字>.json・_base.json・README.md）")
        if path.suffix == suffix:
            found.append(path)
    return sorted(found, key=_number)


def _op_owners(rows_by_screen: Mapping[str, list], owner: str) -> dict[str, str]:
    return {row[4]: owner for rows in rows_by_screen.values() for row in rows}


def _merge_screen_rows(target: dict, name: str, value: object, source: Path, owners: dict[str, str]) -> None:
    if not isinstance(value, dict):
        raise RegistryConflict(f"{source.name}: {name} は「画面 → 行のリスト」の dict で書く")
    table = target[name]
    for screen, rows in value.items():
        for row in rows:
            op = row[4]
            if op in owners:
                raise RegistryConflict(f"{name}: {owners[op]} と {source.name} が operationId {op} を両方持つ")
            owners[op] = source.name
        table[screen] = [*table.get(screen, []), *rows]


def _merge_value(target: dict, name: str, value: object, source: Path, owners: dict[str, str]) -> None:
    have = target[name]
    if isinstance(have, dict):
        if not isinstance(value, dict):
            raise RegistryConflict(f"{source.name}: {name} は dict で書く")
        for key, item in value.items():
            if key in have:
                raise RegistryConflict(f"{name}: {owners.get(f'{name}:{key!r}', '元の表')} と {source.name} が {key} を両方持つ")
            have[key] = item
            owners[f"{name}:{key!r}"] = source.name
    elif isinstance(have, set):
        if not isinstance(value, (set, frozenset)):
            raise RegistryConflict(f"{source.name}: {name} は set で書く")
        have |= value
    elif isinstance(have, list):
        if not isinstance(value, list):
            raise RegistryConflict(f"{source.name}: {name} は list で書く")
        have.extend(value)
    else:
        raise RegistryConflict(f"{source.name}: {name} は足せない形の表（dict・set・list だけ）")


def _table_names(target: Mapping[str, object]) -> list[str]:
    return [n for n, v in target.items()
            if n.isupper() and not n.startswith("_") and isinstance(v, (dict, set, list))]


def _run(path: Path, helpers: Mapping[str, object]) -> dict:
    namespace: dict = dict(helpers)
    try:
        code = compile(path.read_text(encoding="utf-8"), str(path), "exec")
        exec(code, namespace)  # noqa: S102 リポジトリの中の断片だけを読む
    except Exception as exc:  # noqa: BLE001 どの失敗もファイル名つきで止める
        raise RegistryConflict(f"{path.name} を読めない：{type(exc).__name__}: {exc}") from None
    return namespace


def _shape_names(table: dict) -> dict[str, tuple]:
    return {v[0]: v for v in table.values() if isinstance(v, tuple) and v and isinstance(v[0], str)}


def _resolve_names(target: dict, key_owners: Mapping[str, str]) -> None:
    """断片が名前の文字だけで書いた値を、同じ表で同じ名前の組に置き換える（全部の断片を足した後に 1 回）"""
    for owned, source in key_owners.items():
        name, _, raw = owned.partition(":")
        table = target[name]
        key = next(k for k in table if repr(k) == raw)
        value = table[key]
        shapes = _shape_names(table)
        if not isinstance(value, str) or not shapes:
            continue
        if value not in shapes:
            raise RegistryConflict(f"{source}: {name} の {key} が名前で指す {value} の組が、どの口にも無い（その組を持つ断片がまだ無い）")
        table[key] = shapes[value]


def merge_py(target: dict, directory: Path, names: Sequence[str] | None = None,
             screen_lists: Sequence[str] = (), helpers: Mapping[str, object] | None = None) -> list[Path]:
    """.py の断片を target の表に足す。フォルダが無ければ何もしない。読んだ断片を返す。"""
    directory = Path(directory)
    if not directory.is_dir():
        return []
    helpers = dict(helpers or {})
    allowed = list(names) if names is not None else _table_names(target)
    owners: dict[str, dict[str, str]] = {n: _op_owners(target[n], "元の表") for n in screen_lists if n in target}
    key_owners: dict[str, str] = {}
    used = fragments(directory, ".py")
    for path in used:
        namespace = _run(path, helpers)
        for name, value in namespace.items():
            if name.startswith("_") or name in helpers or not name.isupper():
                continue
            if name not in allowed or name not in target:
                raise RegistryConflict(f"{path.name}: {name} は足せる表の名前ではない（書き間違いを黙って捨てない）")
            if name in owners:
                _merge_screen_rows(target, name, value, path, owners[name])
            else:
                _merge_value(target, name, value, path, key_owners)
    _resolve_names(target, key_owners)
    return used
