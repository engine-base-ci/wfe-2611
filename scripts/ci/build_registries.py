#!/usr/bin/env python3
"""表の生成物を、チケットごとのファイル（<名前>.d/_base.json と K-xxx.json）から作る作り手（K-325）。

  python3 scripts/ci/build_registries.py            3 つを本物の住所に書く
  python3 scripts/ci/build_registries.py --check    書かずに、今のファイルと違えば 1 で終わる
  python3 scripts/ci/build_registries.py --only <kind> --dir <フォルダ> --out <ファイル>   1 つだけ（試験が使う）

kind：errors（07_qa/test-specs/errors.json）・ears（07_qa/test-plan/ears-elsewhere.json）・ci_scope（scripts/ci/ci_scope.json）。
_base.json が先、続いて K- の番号の順に足す。同じ鍵を 2 つのファイルが持てば止め、何も書かない。
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from registry_d import RegistryConflict, fragments  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent.parent

# kind → (生成物, 断片の置き場)
TARGETS = {
    "errors": ("07_qa/test-specs/errors.json", "07_qa/test-specs/errors.d"),
    "ears": ("07_qa/test-plan/ears-elsewhere.json", "07_qa/test-plan/ears-elsewhere.d"),
    "ci_scope": ("scripts/ci/ci_scope.json", "scripts/ci/ci_scope.d"),
}

# kind → 鍵ごとの足し方。("list_by", 鍵の名前)＝リストをつなぎ、項目の鍵が重なれば止める／
# ("dict",)＝鍵ごと・重なれば止める／("list",)＝つなぐ／("unique_list",)＝つなぎ、同じ値が 2 つなら止める。
# ここに無い鍵は _base.json だけが持てる。
RULES: dict[str, dict[str, tuple]] = {
    "errors": {"errors": ("list_by", "id"), "classes": ("list_by", "id")},
    "ears": {"ops": ("dict",)},
    "ci_scope": {"data_links": ("list",), "reads_ok": ("dict",), "no_test_paths": ("unique_list",)},
}


def _load(path: Path) -> dict:
    try:
        obj = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RegistryConflict(f"{path.name} を読めない：{exc}") from None
    if not isinstance(obj, dict):
        raise RegistryConflict(f"{path.name} は JSON のオブジェクトで書く")
    return obj


def _owner_map(kind: str, base: dict) -> dict[tuple[str, str], str]:
    owners: dict[tuple[str, str], str] = {}
    for key, rule in RULES[kind].items():
        value = base.get(key)
        if rule[0] == "list_by":
            owners.update({(key, str(item.get(rule[1]))): "_base.json" for item in value or []})
        elif rule[0] == "dict":
            owners.update({(key, str(k)): "_base.json" for k in value or {}})
        elif rule[0] == "unique_list":
            owners.update({(key, str(v)): "_base.json" for v in value or []})
    return owners


def _claim(owners: dict[tuple[str, str], str], kind: str, key: str, ident: str, source: str) -> None:
    if (key, ident) in owners:
        raise RegistryConflict(f"{kind}: {owners[(key, ident)]} と {source} が {key} の {ident} を両方持つ")
    owners[(key, ident)] = source


def _add(kind: str, out: dict, key: str, value: object, source: str, owners: dict[tuple[str, str], str]) -> None:
    rule = RULES[kind].get(key)
    if rule is None:
        raise RegistryConflict(f"{kind}: {source} の {key} は _base.json だけが持てる")
    if rule[0] == "dict":
        if not isinstance(value, dict):
            raise RegistryConflict(f"{kind}: {source} の {key} はオブジェクトで書く")
        for k, item in value.items():
            _claim(owners, kind, key, str(k), source)
        out[key] = {**out.get(key, {}), **value}
        return
    if not isinstance(value, list):
        raise RegistryConflict(f"{kind}: {source} の {key} はリストで書く")
    if rule[0] == "list_by":
        for item in value:
            _claim(owners, kind, key, str(item.get(rule[1]) if isinstance(item, dict) else item), source)
    elif rule[0] == "unique_list":
        for item in value:
            _claim(owners, kind, key, str(item), source)
    out[key] = [*out.get(key, []), *value]


def build(kind: str, directory: Path) -> dict:
    """_base.json に K-xxx.json を足した値を返す（書かない）。"""
    if kind not in RULES:
        raise RegistryConflict(f"知らない kind：{kind}（{', '.join(RULES)}）")
    directory = Path(directory)
    base_path = directory / "_base.json"
    if not base_path.is_file():
        raise RegistryConflict(f"{kind}: {directory} に _base.json が無い")
    out = _load(base_path)
    owners = _owner_map(kind, out)
    for path in fragments(directory, ".json"):
        for key, value in _load(path).items():
            _add(kind, out, key, value, path.name, owners)
    return out


def render(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=1) + "\n"


def _jobs(args: argparse.Namespace) -> list[tuple[str, Path, Path]]:
    if args.only:
        if not (args.dir and args.out):
            raise SystemExit("--only には --dir と --out が要る")
        return [(args.only, Path(args.dir), Path(args.out))]
    return [(kind, ROOT / d, ROOT / out) for kind, (out, d) in TARGETS.items()]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="書かずに、今のファイルと違えば 1 で終わる")
    ap.add_argument("--only", choices=sorted(RULES))
    ap.add_argument("--dir")
    ap.add_argument("--out")
    args = ap.parse_args(argv)
    try:
        texts = [(out, render(build(kind, d))) for kind, d, out in _jobs(args)]
    except RegistryConflict as exc:
        print(str(exc), file=sys.stderr)
        return 1
    stale = [out for out, text in texts if not out.is_file() or out.read_text(encoding="utf-8") != text]
    if args.check:
        for out in stale:
            print(f"作り直しが要る：{out}（python3 scripts/ci/build_registries.py）", file=sys.stderr)
        return 1 if stale else 0
    for out, text in texts:   # 中身が同じでも毎回書く（生成物の目録の F6：作り手が書くファイルと outputs をちょうど同じに）
        out.write_text(text, encoding="utf-8")
        if out in stale:
            print(f"書いた：{out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
