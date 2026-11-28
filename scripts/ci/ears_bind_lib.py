#!/usr/bin/env python3
"""生成の試験の結びの確認の道具（K-723・K-724 が使う）。口の葉が自分の `07_qa/test-plan/ears-elsewhere.d/K-<番号>.json` で結んだ内容を、
チケット（K-723・K-724）の md の表と、口の葉の md の行 ID と、作り手が作った生成の試験に、機械で照らす。
表の形（1 行 1 口）：`| 葉 | 口の名前 | 本物の試験のファイル | ok・shape | 401 | 403 | 404 | 422 | 409 | 429 |`。
セルは行 ID（K676-API-001 の形）を「・」でつないだ物。「—」はその型の名前が無い（na か、作り手が出さない）。"""
from __future__ import annotations

import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
FRAG_DIR = ROOT / "07_qa" / "test-plan" / "ears-elsewhere.d"
COLUMNS = ["ok", "rejected_401", "rejected_403", "not_found", "rejected_422", "conflict", "rate_limited"]
KIND_RE = re.compile(r"_(ok|shape|rejected_401|rejected_403|rejected_422|not_found|conflict|rate_limited)(?:_\d+)?$")
ROW_ID_RE = re.compile(r"K\d+-[A-Z]+-\d+")
MIN_NA_REASON = 15


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


def table_rows(ticket_md: pathlib.Path) -> list[dict[str, object]]:
    """チケットの md の表の行（`| K-<番号> | <口> | …` で始まる行）。セルは行 ID の並びにする"""
    rows: list[dict[str, object]] = []
    for ln in read(ticket_md).splitlines():
        cells = [c.strip() for c in ln.strip().strip("|").split("|")]
        if len(cells) != 3 + len(COLUMNS) or not re.fullmatch(r"K-\d+", cells[0]) or cells[1].startswith("-"):
            continue
        rows.append({"leaf": cells[0], "op": cells[1], "file": cells[2],
                     "cols": {k: ROW_ID_RE.findall(v) for k, v in zip(COLUMNS, cells[3:])}})
    return rows


def leaf_row_ids(leaf: str) -> set[str]:
    """口の葉の md の行の表の行 ID（`| K676-API-001 |` の形）"""
    return set(re.findall(r"^\| (K\d+-[A-Z]+-\d+) \|", read(ROOT / "11_tickets" / f"{leaf}.md"), flags=re.M))


def fragment(leaf: str) -> dict[str, dict[str, object]]:
    path = FRAG_DIR / f"{leaf}.json"
    return json.loads(read(path)).get("ops", {}) if path.is_file() else {}


def kind_of(test_name: str) -> str | None:
    m = KIND_RE.search(test_name)
    if not m:
        return None
    return "ok" if m.group(1) == "shape" else m.group(1)


def covers_by_column(frag_op: dict[str, object]) -> dict[str, list[str]]:
    """断片の covers のうち、自分の葉の行 ID（文字の値）を型ごとに集める。{file, mark} の外の試験は含めない"""
    out: dict[str, list[str]] = {}
    for name, value in (frag_op.get("covers") or {}).items():  # type: ignore[union-attr]
        kind = kind_of(name)
        if kind and isinstance(value, str):
            out.setdefault(kind, [])
            if value not in out[kind]:
                out[kind].append(value)
    return out


def problems_missing_fragment(rows: list[dict[str, object]]) -> list[str]:
    return [f"{r['leaf']} の {r['op']}：断片 {r['leaf']}.json に口が無い" for r in rows if r["op"] not in fragment(str(r["leaf"]))]


def problems_row_ids(rows: list[dict[str, object]]) -> list[str]:
    """表の行 ID が、その行 ID の持ち主の葉（K675-API-003 なら K-675）の md の行の表に在る（入力の確かめのように別の葉の行に結ぶ型もある）"""
    bad: list[str] = []
    cache: dict[str, set[str]] = {}
    for r in rows:
        for kind, ids in r["cols"].items():  # type: ignore[union-attr]
            for i in ids:
                owner = "K-" + i.split("-")[0][1:]
                if owner not in cache:
                    cache[owner] = leaf_row_ids(owner) if (ROOT / "11_tickets" / f"{owner}.md").is_file() else set()
                if i not in cache[owner]:
                    bad.append(f"{r['leaf']} の {r['op']} の {kind}：行 {i} が {owner} の md に無い")
    return bad


def problems_table_vs_fragment(rows: list[dict[str, object]]) -> list[str]:
    bad: list[str] = []
    for r in rows:
        frag = fragment(str(r["leaf"])).get(str(r["op"]))
        if not frag:
            continue
        got = covers_by_column(frag)
        for kind in COLUMNS:
            want = sorted(set(r["cols"].get(kind, [])))  # type: ignore[union-attr]
            if not want:
                continue  # 表が「—」の型は、葉が na にするか作り手が名前を出さない。行の実在だけを見る（problems_row_ids）
            have = sorted(set(got.get(kind, [])))
            if want != have:
                bad.append(f"{r['leaf']} の {r['op']} の {kind}：表 {want} と断片 {have} が違う")
        if frag.get("file") is not None and pathlib.PurePosixPath(str(frag["file"])).name != r["file"]:
            bad.append(f"{r['leaf']} の {r['op']}：本物の試験のファイルが表と違う")
    return bad


def problems_external_marks(rows: list[dict[str, object]]) -> list[str]:
    """{file, mark} の結び（入口の共通の試験）は、ファイルが在り、mark の字がそのファイルに在る"""
    bad: list[str] = []
    for r in rows:
        frag = fragment(str(r["leaf"])).get(str(r["op"])) or {}
        for name, value in (frag.get("covers") or {}).items():  # type: ignore[union-attr]
            if isinstance(value, dict):
                f = ROOT / str(value.get("file", ""))
                if not f.is_file() or str(value.get("mark", "")) not in read(f):
                    bad.append(f"{r['op']}.covers.{name}：{value.get('file')} に {value.get('mark')} が無い")
    return bad


def problems_na_reasons(rows: list[dict[str, object]]) -> list[str]:
    bad: list[str] = []
    for r in rows:
        frag = fragment(str(r["leaf"])).get(str(r["op"])) or {}
        for name, why in (frag.get("na") or {}).items():  # type: ignore[union-attr]
            if len(str(why).strip()) < MIN_NA_REASON:
                bad.append(f"{r['op']}.na.{name}：理由が {MIN_NA_REASON} 字に届かない")
    return bad


def generated_file(op: str) -> pathlib.Path | None:
    eps = json.loads(read(ROOT / "08_api" / "endpoints.json"))["endpoints"]
    ep = next((e for e in eps if e["implementation_path"].split("::")[1] == op), None)
    if not ep:
        return None
    mapping = json.loads(read(ROOT / "07_qa" / "test-plan" / "ears-test-mapping.json"))["mappings"]
    hit = next((m for m in mapping if m["endpoint"] == f"{ep['method']} {ep['path']}"), None)
    return ROOT / hit["test_file"] if hit else None


def problems_todo_left(ops: list[str]) -> list[str]:
    """生成の試験に「本物の試験はまだ無い」の it.todo（結ばれていない名前）と「まだ作っていない口」の置き場が残っていない"""
    bad: list[str] = []
    for op in ops:
        f = generated_file(op)
        if f is None or not f.is_file():
            bad.append(f"{op}：生成の試験が無い（作り手で作り直す）")
            continue
        text = read(f)
        if "本物の試験はまだ無い" in text:
            bad.append(f"{op}：{f.name} に結ばれていない it.todo が残っている")
        if "まだ作っていない口" in text:
            bad.append(f"{op}：{f.name} が「まだ作っていない口」の置き場のまま")
    return bad
