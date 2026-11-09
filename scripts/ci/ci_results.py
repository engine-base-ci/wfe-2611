#!/usr/bin/env python3
"""試験の結果の欄を CI の記録から機械で書く・手で書いた PASS を赤にする（K-143・D-129.50・D-129.51・ai-driven-process.md §8）。

スキル ai-team-delivery の scripts/gates/result_gate.py の形（record・write・check・印「PASS（CI <7 字>）」・記録 <sha>.json）を
Kaname の入力に合わせたもの。違いは 4 つ：
  ・record は JUnit の XML ではなく、Playwright（"suites"）と Vitest（"testResults"）の JSON 報告を読む（op_gate の load_report と同じ読み方）
  ・check は台帳（まだ流し直していない印の無い PASS・07_qa/test-plan/result-ledger.json）を持ち、台帳は減らすだけ（本線の版と比べる）
  ・行 ID の形は scripts/ci/op_gate.py の ID_RE と同じ。形でない PASS は記録と結べないので赤
  ・読む行と PASS の読み方は scripts/ci/qa-ladder.py と同じ読み手にそろえる（見出しの名前・外側の「|」が無い表・NFKC・
    PASS/FIXED/OK/合格/完了・「PASS（該当なし…）」は該当なし）。印は「PASS（CI <sha>）」「FAIL（CI <sha>）」ちょうどだけ

  python3 scripts/ci/ci_results.py record --report apps/web/pw-reports/k.json [--report …] --sha "$GITHUB_SHA" --records 07_qa/ci-results
  python3 scripts/ci/ci_results.py write  --specs '07_qa/test-specs/**/*.md' --records 07_qa/ci-results --sha <その回>
  python3 scripts/ci/ci_results.py check  --specs '07_qa/test-specs/**/*.md' --records 07_qa/ci-results \\
      --ledger 07_qa/test-plan/result-ledger.json --ledger-base-ref <本線との分かれ目> --target-ref <取り込む先>
  python3 scripts/ci/ci_results.py ledger --specs '07_qa/test-specs/**/*.md' --out 07_qa/test-plan/result-ledger.json   # 入れた時点の 1 回だけ

--ledger-base-ref <ref> --target-ref <取り込む先>（PM の判断 2026-11-08 15:37・15:58・17:40 ①②）：
  ・<ref> は <取り込む先> の先祖で、HEAD と違うコミットでなければ赤（比べる元を枝が選べない）。--target-ref が無い・読めないなら赤
  ・本線の版と同じ印のまま（同じファイル・行 ID・結果の文字）の行は記録を見直さない（取り込みの台本が write の後に check を流した）
  ・枝で足した・変えた印と、--records の記録のファイルの追加・変更は、<ref>..HEAD のコミットのうち本文に
    「Results-Written-By: ci_results.py write CI <40 字の sha>」を持つコミット（取り込みの台本の書き込み）で入ったものだけ通す

結果の欄は CI の段の中では書かない（まっさらな写しは残らない）。取り込みの台本（pm_merge.sh）が、緑だった回の記録を
07_qa/ci-results/ に写し、write で書いて、そのチケットの番号でコミットしてから本線に入れる（ai-team.yaml の results）。
"""
from __future__ import annotations

import argparse
import datetime
import glob
import json
import os
import re
import subprocess
import sys
import unicodedata
from collections import Counter
from pathlib import Path

# 行 ID の形（scripts/ci/op_gate.py の ID_RE と同じ）
ID_PATTERN = re.compile(r"\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+-\d{3}(?:-[ABC])?\b")
ID_FULL = re.compile(r"[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+-\d{3}(?:-[ABC])?")
# CI の回の印（write が書く形ちょうどだけを印と読む。飾った印は手で書いた PASS）
MARK_PASS = re.compile(r"PASS（CI ([0-9a-f]{7,40})）")
MARK_FAIL = re.compile(r"FAIL（CI ([0-9a-f]{7,40})）")
MARK = re.compile(r"（CI ([0-9a-f]{7,40})）")
# qa-ladder と同じ読み方（NFKC で揃えて大小を問わない）
NA_RE = re.compile(r"^\s*(?:N/A\s*[（(]|PASS（該当なし)")
WORD_FAIL = re.compile(r"\b(FAIL|NG)\b")
WORD_BLOCKED = re.compile(r"\bBLOCKED\b")
WORD_PASS = re.compile(r"\b(PASS|FIXED|OK)\b|完了|合格")
TRAILER = re.compile(r"Results-Written-By: ci_results\.py write CI ([0-9a-f]{40})")
CELL_SPLIT = re.compile(r"(?<!\\)\|")
MADE_BY = "ci_results.py record"


# ---------------------------------------------------------------- 結果の欄の読み方
def classify(res: str) -> str:
    """結果の欄 → marked_pass / marked_fail / na / pass（手で書いた PASS らしい書き方）/ other"""
    s = (res or "").strip()
    if MARK_PASS.fullmatch(s):
        return "marked_pass"
    if MARK_FAIL.fullmatch(s):
        return "marked_fail"
    if NA_RE.match(s):
        return "na"
    n = unicodedata.normalize("NFKC", s).upper()
    if WORD_FAIL.search(n) or WORD_BLOCKED.search(n):
        return "other"
    if WORD_PASS.search(n):
        return "pass"
    return "other"


def is_pass(res: str) -> bool:
    return classify(res) in ("marked_pass", "pass")


def mark_of(res: str) -> str | None:
    m = MARK_PASS.fullmatch((res or "").strip()) or MARK_FAIL.fullmatch((res or "").strip())
    return m.group(1) if m else None


# ---------------------------------------------------------------- 表を読む（qa-ladder と同じ行を読む）
def _cells(line: str) -> list[str] | None:
    s = line.strip()
    if len(CELL_SPLIT.findall(s)) < 2:
        return None
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|") and not s.endswith("\\|"):
        s = s[:-1]
    return [c.strip() for c in CELL_SPLIT.split(s)]


def _head_key(c: str) -> str:
    return unicodedata.normalize("NFKC", c).replace("*", "").strip()


def _is_id_head(c: str) -> bool:
    return _head_key(c).replace(" ", "").lower() in ("id", "行id")


def _is_result_head(c: str) -> bool:
    """結果の列：「結果」で始まる名前（結果・結果列・結果（CI））か status。「期待結果」は結果の列でない"""
    k = _head_key(c)
    return k.startswith("結果") or k.lower() == "status"


def _is_sep(cells: list[str]) -> bool:
    return all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c) and any(cells)


def spec_rows(text: str):
    """試験の仕様の表のうち、列 ID と結果を持つ行を (行番号, 行 ID, 結果, 結果の列の位置) で返す"""
    head: list[str] | None = None
    cols: tuple[int, int] | None = None
    for i, line in enumerate(text.split("\n")):
        cells = _cells(line)
        if cells is None:
            head, cols = None, None
            continue
        if head is None:
            head = cells
            ci = next((j for j, c in enumerate(cells) if _is_id_head(c)), None)
            ri = next((j for j, c in enumerate(cells) if _is_result_head(c)), None)
            cols = (ci, ri) if ci is not None and ri is not None else None
            continue
        if _is_sep(cells) or cols is None:
            continue
        ci, ri = cols
        if max(ci, ri) >= len(cells):
            continue
        yield i, cells[ci], cells[ri], ri


def spec_files(patterns: list[str]) -> list[str]:
    out: set[str] = set()
    for p in patterns:
        out.update(os.path.normpath(x) for x in glob.glob(p, recursive=True, include_hidden=True) if os.path.isfile(x))
    return sorted(out)


# ---------------------------------------------------------------- 記録
def load_records(d: Path) -> dict[str, dict]:
    recs: dict[str, dict] = {}
    if not d.is_dir():
        return recs
    for p in sorted(d.glob("*.json")):
        try:
            r = json.loads(p.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        if isinstance(r, dict) and isinstance(r.get("sha"), str) and isinstance(r.get("rows"), dict):
            recs[r["sha"]] = r
    return recs


def find_records(recs: dict[str, dict], short: str) -> list[dict]:
    return [r for s, r in recs.items() if s.startswith(short)]


def _worse(cur: str | None, new: str) -> str:
    return "fail" if cur == "fail" or new == "fail" else "pass"


def _read_report(p: Path) -> dict | None:
    try:
        rep = json.loads(p.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return None
    return rep if isinstance(rep, dict) else None


def record(reports: list[Path], sha: str, records: Path) -> int:
    """Playwright・Vitest の JSON 報告から records/<sha>.json を書く。報告が 1 つでも無い・読めないなら 1（何も書かない）"""
    if not reports or not re.fullmatch(r"[0-9a-f]{7,40}", sha or ""):
        print(f"★ 報告か sha が無い（報告 {len(reports)}・sha「{sha}」）。記録を書かない")
        return 1
    loaded = []
    for p in reports:
        rep = _read_report(Path(p))
        if rep is None:
            print(f"★ 報告が無いか読めない: {p}。記録を書かない（空の記録で流れていないことにしない）")
            return 1
        loaded.append(rep)
    rows: dict[str, str] = {}

    def walk(s: dict, path: list[str]) -> None:
        for sp in s.get("specs", []):
            title = " ".join(path + [sp.get("title", "")])
            ok = bool(sp.get("tests"))
            for t in sp.get("tests", []):
                res = t.get("results") or []
                if not res or res[-1].get("status") != "passed":
                    ok = False
            for rid in set(ID_PATTERN.findall(title)):
                rows[rid] = _worse(rows.get(rid), "pass" if ok else "fail")
        for c in s.get("suites", []):
            walk(c, path + [s.get("title", "")])

    for rep in loaded:
        for s in rep.get("suites", []):
            walk(s, [])
        for f in rep.get("testResults", []):
            for a in f.get("assertionResults", []):
                title = " ".join(a.get("ancestorTitles", []) + [a.get("title", "")])
                for rid in set(ID_PATTERN.findall(title)):
                    rows[rid] = _worse(rows.get(rid), "pass" if a.get("status") == "passed" else "fail")
    records.mkdir(parents=True, exist_ok=True)
    out = {"sha": sha, "made_by": MADE_BY, "at": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
           "rows": dict(sorted(rows.items()))}
    (records / f"{sha}.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"記録を書いた: {records / (sha + '.json')}（行 {len(rows)}・落ちた {sum(1 for v in rows.values() if v == 'fail')}）")
    return 0


# ---------------------------------------------------------------- write
def _replace_cell(line: str, ri: int, new: str) -> str:
    """表の行の結果の欄だけを替える（ほかの欄・外側の「|」の有無はそのまま）"""
    lead = line[: len(line) - len(line.lstrip())]
    body = line.strip()
    lead_pipe = body.startswith("|")
    trail_pipe = body.endswith("|") and not body.endswith("\\|")
    inner = body[1:] if lead_pipe else body
    inner = inner[:-1] if trail_pipe else inner
    parts = CELL_SPLIT.split(inner)
    parts[ri] = f" {new} "
    out = "|".join(parts)
    return lead + ("|" if lead_pipe else "") + out + ("|" if trail_pipe else "")


def write(specs: list[str], records: Path, sha: str) -> int:
    hit = find_records(load_records(records), sha or "")
    if len(sha or "") < 7 or len(hit) != 1:
        why = "短い sha" if len(sha or "") < 7 else ("記録が無い" if not hit else f"{len(hit)} つの記録に当たる（1 つに決まらない）")
        print(f"★ {sha}：{why}（{records}）。何も書かない")
        return 1
    r = hit[0]
    short = r["sha"][:7]
    changes: list[tuple[str, str]] = []
    n = 0
    for f in spec_files(specs):
        text = Path(f).read_text(encoding="utf-8")
        lines = text.split("\n")
        changed = False
        for i, rid, res, ri in spec_rows(text):
            v = r["rows"].get(rid)
            if v not in ("pass", "fail"):
                continue
            new = f"{'PASS' if v == 'pass' else 'FAIL'}（CI {short}）"
            if res != new:
                lines[i] = _replace_cell(lines[i], ri, new)
                changed = True
                n += 1
        if changed:
            changes.append((f, "\n".join(lines)))
    for f, t in changes:
        Path(f).write_text(t, encoding="utf-8")
    print(f"結果の欄を {n} 行書いた（CI {short} の記録から・{len(changes)} ファイル）")
    return 0


# ---------------------------------------------------------------- check
def _key(file: str, rid: str) -> tuple[str, str]:
    return os.path.normpath(file), rid


def _check(specs: list[str], records: Path, ledger: dict | None, ledger_base: dict | None,
           trusted: set[tuple[str, str, str]] | None = None,
           written: set[tuple[str, str, str]] | None = None) -> tuple[list[str], int]:
    recs: dict[str, dict] | None = None
    led = {_key(x["file"], x["id"]) for x in (ledger or {}).get("rows", [])}
    unmarked: set[tuple[str, str]] = set()
    seen: Counter = Counter()
    bad: list[str] = []
    n = 0
    for f in spec_files(specs):
        for i, rid, res, _ in spec_rows(Path(f).read_text(encoding="utf-8")):
            cls = classify(res)
            if cls not in ("marked_pass", "pass"):
                continue   # 空・BLOCKED・FAIL・該当なし（N/A）は見ない
            n += 1
            key = _key(f, rid)
            where = f"{f}:{i + 1} {rid}"
            seen[key] += 1
            if seen[key] > 1:
                bad.append(f"{where}：同じファイルの同じ行 ID の PASS が 2 行以上ある（台帳の鍵で新しい行を通さない）")
                continue
            if cls == "pass":
                unmarked.add(key)
                if key not in led:
                    bad.append(f"{where}：PASS に CI の回の印が無い（手で書いた PASS）。ci_results.py write で CI の記録から書く")
                continue
            if not ID_FULL.fullmatch(rid):
                bad.append(f"{where}：行 ID が形（op_gate の ID_RE）でない。記録と結べない")
                continue
            tr = (os.path.normpath(f), rid, res)
            if trusted is not None and tr in trusted:
                continue   # 本線の版で同じ印のまま（本線に入るときに確かめた）
            if written is not None and tr not in written:
                bad.append(f"{where}：枝で足した・変えた印「{res}」が、取り込みの台本の書き込みのコミット（Results-Written-By）で入っていない")
                continue
            if recs is None:
                recs = load_records(records)
            sha = mark_of(res) or ""
            hit = find_records(recs, sha)
            if not hit:
                bad.append(f"{where}：印の回 {sha} の記録が {records} に無い")
            elif len(hit) > 1:
                bad.append(f"{where}：印の回 {sha} が {len(hit)} つの記録に当たる（1 つに決まらない）")
            elif hit[0]["rows"].get(rid) != "pass":
                bad.append(f"{where}：回 {sha} の記録では {rid} は {hit[0]['rows'].get(rid, '記録に行が無い（流れていない）')}")
    if ledger is not None:
        for k in sorted(led - unmarked):
            bad.append(f"{k[0]} {k[1]}：台帳の行が、もう印の無い PASS でない（印が付いた・空になった・該当なしになった・行が無い）。台帳から消す")
    if ledger_base is not None:
        base = {_key(x["file"], x["id"]) for x in ledger_base.get("rows", [])}
        for k in sorted(led - base):
            bad.append(f"{k[0]} {k[1]}：本線の台帳に無い行を台帳に足した（台帳は減らすだけ）")
    return bad, n


def check(specs: list[str], records: Path, ledger: dict | None = None, ledger_base: dict | None = None) -> list[str]:
    return _check(specs, Path(records), ledger, ledger_base)[0]


# ---------------------------------------------------------------- 本線の版（--ledger-base-ref・--target-ref）
def _git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], capture_output=True, text=True, check=False)


def _show(ref: str, path: str) -> str | None:
    r = _git("show", f"{ref}:./{path}")
    return r.stdout if r.returncode == 0 else None


def _resolve(ref: str) -> str | None:
    """ref をコミットの sha に。枝の名前は、手元の枝 → origin の枝（CI のまっさらな写しは clone なので取り込む先の枝は
    refs/remotes/origin/<名前> にだけある）の順に引く。どちらにも無ければ None"""
    for cand in (ref, f"refs/remotes/origin/{ref}"):
        r = _git("rev-parse", "--verify", "--quiet", f"{cand}^{{commit}}")
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip()
    return None


def _refs_ok(ref: str, target: str | None) -> list[str]:
    """比べる元（ref）と取り込む先（target）の確かめ。問題の一覧（空なら通る）"""
    if not ref:
        return ["本線の ref が空（scope の段が本線との分かれ目を出せなかった）。台帳を本線と比べられないので止める"]
    base = _resolve(ref)
    if base is None:
        return [f"本線の ref「{ref}」が読めない。台帳を本線と比べられないので止める"]
    if target is None or not target:
        return ["取り込む先（--target-ref）が無い。比べる元が取り込む先の先祖かを確かめられないので止める（CI は workflow_dispatch の入力 target を env で渡す）"]
    tgt = _resolve(target)
    if tgt is None:
        return [f"取り込む先「{target}」が読めない。比べる元が取り込む先の先祖かを確かめられないので止める"]
    head = _resolve("HEAD")
    if head is not None and base == head:
        return [f"比べる元「{ref}」が HEAD と同じコミット。枝が自分を比べる元にすり替えている（台帳の増えが見えなくなる）"]
    if _git("merge-base", "--is-ancestor", base, tgt).returncode != 0:
        return [f"比べる元「{ref}」が取り込む先「{target}」の先祖でない。本線の版でないものとは比べない"]
    return []


def _written_commits(ref: str) -> list[tuple[str, str]]:
    """ref..HEAD のコミットのうち、本文に Results-Written-By を持つもの → [(コミット, 40 字の sha)]"""
    r = _git("rev-list", f"{ref}..HEAD")
    out = []
    for c in r.stdout.split():
        m = TRAILER.search(_git("show", "-s", "--format=%B", c).stdout)
        if m:
            out.append((c, m.group(1)))
    return out


def base_view(ref: str, ledger_path: str, ledger: dict | None, specs: list[str], target: str | None = None,
              records: Path | None = None):
    """本線の版を読む。返り値：(本線の台帳 or None, 本線で同じ印の行の集合, 書き込みのコミットで入った印の集合, 問題の一覧)"""
    bad = _refs_ok(ref, target)
    if bad:
        return None, set(), set(), bad
    trusted: set[tuple[str, str, str]] = set()
    base_unmarked: set[tuple[str, str]] = set()
    files = sorted(set(spec_files(specs)) | {os.path.normpath(x["file"]) for x in (ledger or {}).get("rows", [])})
    for f in files:
        txt = _show(ref, os.path.relpath(f))
        if txt is None:
            continue
        for _, rid, res, _ in spec_rows(txt):
            cls = classify(res)
            if cls in ("marked_pass", "marked_fail"):
                trusted.add((f, rid, res))
            elif cls == "pass":
                base_unmarked.add(_key(f, rid))
    # 枝で足した・変えた印と記録は、書き込みのコミット（Results-Written-By）で入ったものだけ通す
    written: set[tuple[str, str, str]] = set()
    wrote: list[tuple[str, str]] = _written_commits(ref)
    for c, sha in wrote:
        for f in files:
            txt = _show(c, os.path.relpath(f))
            if txt is None:
                continue
            for _, rid, res, _ in spec_rows(txt):
                m = mark_of(res)
                if m and sha.startswith(m):
                    written.add((f, rid, res))
    if records is not None:
        rel = os.path.relpath(records)
        changed = [p for p in _git("diff", "--name-only", ref, "HEAD", "--", rel).stdout.split("\n") if p.strip()]
        for p in changed:
            now = _git("show", f"HEAD:{p}")
            if now.returncode != 0:
                bad.append(f"{p}：記録のファイルを消した。記録は取り込みの台本の書き込みのコミットでしか変えない")
                continue
            ok = any(os.path.basename(p) == f"{sha}.json" and _git("show", f"{c}:{p}").stdout == now.stdout for c, sha in wrote)
            if not ok:
                bad.append(f"{p}：記録のファイルの追加・変更が、取り込みの台本の書き込みのコミット（Results-Written-By）で入っていない")
    raw = _show(ref, os.path.relpath(ledger_path))
    if raw is not None:
        try:
            return json.loads(raw), trusted, written, bad
        except ValueError:
            return None, trusted, written, bad + [f"本線（{ref}）の台帳が JSON でない"]
    # 台帳を入れる回：台帳の行は、本線の版で「CI の印の無い PASS」の行だけ
    bad += [f"{os.path.normpath(x['file'])} {x['id']}：台帳を入れる回だが、本線（{ref[:12]}）の版では印の無い PASS の行でない（入れる回に紛れて足せない）"
            for x in (ledger or {}).get("rows", []) if _key(x["file"], x["id"]) not in base_unmarked]
    return {"rows": (ledger or {}).get("rows", [])}, trusted, written, bad


def make_ledger(specs: list[str], out: Path) -> int:
    rows = []
    for f in spec_files(specs):
        for _, rid, res, _ in spec_rows(Path(f).read_text(encoding="utf-8")):
            if classify(res) == "pass":   # 印の無い PASS だけ（該当なし・印つきは載せない）
                rows.append({"file": f, "id": rid})
    data = {"_doc": "まだ流し直していない「CI の印の無い PASS」の行（D-129.51）。減らすだけ（ci_results.py check が本線の版と比べる）。"
                    "流し直して印を付けたら行を消す（K-150）。行を足さない。「PASS（該当なし…）」は該当なし（N/A）なので載せない",
            "made_by": "ci_results.py ledger", "at": datetime.datetime.now().astimezone().date().isoformat(), "count": len(rows), "rows": rows}
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"台帳を書いた: {out}（{len(rows)} 行・{len({r['file'] for r in rows})} ファイル）")
    return 0


# ---------------------------------------------------------------- コマンド
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["record", "write", "check", "ledger"])
    ap.add_argument("--specs", action="append", default=[], help="試験の仕様の Markdown（glob・何度でも）")
    ap.add_argument("--records", default="07_qa/ci-results")
    ap.add_argument("--report", action="append", default=[], help="record：Playwright・Vitest の JSON 報告（何度でも）")
    ap.add_argument("--sha", default="")
    ap.add_argument("--ledger", default="")
    ap.add_argument("--ledger-base-ref", default=None, help="check：本線との分かれ目（台帳は減らすだけ・同じ印は見直さない）")
    ap.add_argument("--target-ref", default=None, help="check：取り込む先（--ledger-base-ref はその先祖でなければ赤）")
    ap.add_argument("--out", default="07_qa/test-plan/result-ledger.json")
    a = ap.parse_args()
    if a.cmd == "record":
        return record([Path(p) for p in a.report], a.sha, Path(a.records))
    if not a.specs:
        ap.error("--specs が要る")
    if a.cmd == "write":
        return write(a.specs, Path(a.records), a.sha)
    if a.cmd == "ledger":
        return make_ledger(a.specs, Path(a.out))
    ledger = None
    if a.ledger:
        try:
            ledger = json.loads(Path(a.ledger).read_text(encoding="utf-8"))
        except (ValueError, OSError) as e:
            print(f"  ★ 台帳が読めない: {a.ledger}（{e}）")
            print("FAIL — 台帳が読めない")
            return 1
    base, trusted, written, bad0 = None, None, None, []
    if a.ledger_base_ref is not None:
        if not a.ledger:
            ap.error("--ledger-base-ref には --ledger が要る")
        base, trusted, written, bad0 = base_view(a.ledger_base_ref, a.ledger, ledger, a.specs, a.target_ref, Path(a.records))
    bad, n = _check(a.specs, Path(a.records), ledger, base, trusted, written)
    bad = bad0 + bad
    for x in bad:
        print("  ★ " + x)
    nl = len((ledger or {}).get("rows", []))
    print(f"PASS {n} 行を見た（台帳 {nl} 行）")
    print(f"PASS — 結果の欄の PASS {n} 行は、どれも CI の記録か台帳と合う" if not bad else f"FAIL — {len(bad)} 件")
    return 0 if not bad else 1


if __name__ == "__main__":
    sys.exit(main())
