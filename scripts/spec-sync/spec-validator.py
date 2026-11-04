#!/usr/bin/env python3
"""spec-validator.py — spec-sync-orchestrator 三段監査スクリプト.

A. 数値整合       : spec-dependencies.yaml の counters を全件検証
B. クロスリファレンス: 全 references の必須存在チェック
C. 廃止用語スキャン : deprecated_terms の active 参照ゼロ確認

pre-commit hook からも呼び出される（--pre-commit モードで出力を最小化）。

実行可能化:
    chmod +x spec-validator.py

Exit codes:
    0 = 全 PASS
    1 = 監査 FAIL
    2 = 起動エラー（依存マップ不在・YAML 構文エラー等）
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

try:
    import yaml  # type: ignore[import-untyped]
except ImportError:
    sys.stderr.write(
        "ERROR: pyyaml が必要です。`pip install pyyaml` を実行してください。\n"
    )
    sys.exit(2)


# ---------------------------------------------------------------------------
# 共通ユーティリティ
# ---------------------------------------------------------------------------

DEFAULT_DEP_PATHS = [
    "spec-dependencies.yaml",
    ".spec-sync/spec-dependencies.yaml",
    "assets/spec-dependencies.yaml",
    "docs/spec-dependencies.yaml",
    ".claude/spec-dependencies.yaml",
]
DEFAULT_RULES_PATHS = [
    "assets/cross-ref-rules.yaml",
    ".claude/skills/spec-sync-orchestrator/assets/cross-ref-rules.yaml",
]


def find_first(project_root: Path, candidates: list[str]) -> Path | None:
    for rel in candidates:
        p = project_root / rel
        if p.exists():
            return p
    return None


def load_yaml(path: Path) -> dict[str, Any]:
    try:
        with path.open(encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
    except yaml.YAMLError as e:
        sys.stderr.write(f"ERROR: YAML 構文エラー: {path}\n  {e}\n")
        sys.exit(2)
    except OSError as e:
        sys.stderr.write(f"ERROR: ファイル読み込み失敗: {path}\n  {e}\n")
        sys.exit(2)
    if not isinstance(data, dict):
        sys.stderr.write(f"ERROR: YAML ルートが dict ではありません: {path}\n")
        sys.exit(2)
    return data


def now_iso() -> str:
    return _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------------------
# 簡易 jsonpath / yamlpath
# ---------------------------------------------------------------------------

_PATH_TOKEN_RE = re.compile(r"\.([A-Za-z_][A-Za-z0-9_]*)|\[([^\]]+)\]")


def parse_path(expr: str) -> list[tuple[str, str]]:
    if expr.startswith("$"):
        expr = expr[1:]
    tokens: list[tuple[str, str]] = []
    pos = 0
    while pos < len(expr):
        m = _PATH_TOKEN_RE.match(expr, pos)
        if not m:
            break
        if m.group(1) is not None:
            tokens.append(("key", m.group(1)))
        else:
            tokens.append(("index", m.group(2).strip()))
        pos = m.end()
    return tokens


def resolve_path(data: Any, tokens: list[tuple[str, str]]) -> list[Any]:
    current: list[Any] = [data]
    for kind, value in tokens:
        nxt: list[Any] = []
        for node in current:
            if kind == "key":
                if isinstance(node, dict) and value in node:
                    nxt.append(node[value])
            else:
                if value == "*":
                    if isinstance(node, list):
                        nxt.extend(node)
                    elif isinstance(node, dict):
                        nxt.extend(node.values())
                else:
                    try:
                        idx = int(value)
                    except ValueError:
                        key = value.strip("\"'")
                        if isinstance(node, dict) and key in node:
                            nxt.append(node[key])
                        continue
                    if isinstance(node, list) and -len(node) <= idx < len(node):
                        nxt.append(node[idx])
        current = nxt
    return current


# ---------------------------------------------------------------------------
# 補助: ファイル種別判定 + 値抽出
# ---------------------------------------------------------------------------

def detect_kind(path: Path) -> str:
    s = path.suffix.lower()
    if s == ".json":
        return "json"
    if s in {".yaml", ".yml"}:
        return "yaml"
    return "text"


def extract_values_from_file(
    path: Path,
    path_expr: str | None,
    regex: str | None,
) -> tuple[list[Any], list[tuple[int, str]]]:
    """ファイルから (構造値リスト, テキスト一致 [(行番号, マッチ文字列)]) を返す。"""
    values: list[Any] = []
    matches: list[tuple[int, str]] = []
    kind = detect_kind(path)
    if kind == "json" and path_expr:
        try:
            with path.open(encoding="utf-8") as f:
                data = json.load(f)
            values = resolve_path(data, parse_path(path_expr))
        except (OSError, json.JSONDecodeError) as e:
            sys.stderr.write(f"WARN: JSON 解析不可: {path} ({e})\n")
    elif kind == "yaml" and path_expr:
        try:
            with path.open(encoding="utf-8") as f:
                data = yaml.safe_load(f)
            values = resolve_path(data, parse_path(path_expr))
        except (OSError, yaml.YAMLError) as e:
            sys.stderr.write(f"WARN: YAML 解析不可: {path} ({e})\n")
    if regex:
        try:
            compiled = re.compile(regex)
        except re.error as e:
            sys.stderr.write(f"WARN: 不正な regex '{regex}': {e}\n")
            compiled = None
        if compiled:
            try:
                with path.open(encoding="utf-8") as f:
                    for lineno, line in enumerate(f, start=1):
                        m = compiled.search(line)
                        if m:
                            matches.append((lineno, m.group(0)))
            except OSError as e:
                sys.stderr.write(f"WARN: 読み込み不可: {path} ({e})\n")
    return values, matches


# ---------------------------------------------------------------------------
# Tier A: 数値整合
# ---------------------------------------------------------------------------

def collect_concept_files(concept: dict[str, Any]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    sot = concept.get("source_of_truth")
    if isinstance(sot, dict):
        entries.append({**sot, "role": "source_of_truth"})
    elif isinstance(sot, str):
        entries.append({"path": sot, "role": "source_of_truth"})
    mirrors = concept.get("mirrors") or []
    if isinstance(mirrors, list):
        for m in mirrors:
            if isinstance(m, dict):
                entries.append({**m, "role": "mirror"})
            elif isinstance(m, str):
                entries.append({"path": m, "role": "mirror"})
    return entries


def coerce_number(value: Any) -> Any:
    """文字列を数値に正規化（可能なら）。"""
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, str):
        s = value.strip()
        if s.isdigit():
            return int(s)
        try:
            return float(s)
        except ValueError:
            return value
    return value


def as_id_dict(value: Any, id_key: str = "id") -> dict[str, Any]:
    """spec-dependencies.yaml の counters/references/deprecated_terms 等が
    list-of-{id: ...} 形式の場合に dict に正規化する。
    既に dict ならそのまま返す。"""
    if isinstance(value, dict):
        return value
    if isinstance(value, list):
        result: dict[str, Any] = {}
        for item in value:
            if not isinstance(item, dict):
                continue
            key = item.get(id_key) or item.get("term") or item.get("kind")
            if key is None:
                continue
            result[str(key)] = item
        return result
    return {}


def tier_a_numeric_consistency(
    dep_map: dict[str, Any], project_root: Path
) -> dict[str, Any]:
    """全 counters について expected と各ファイルの実値を比較。"""
    checks: list[dict[str, Any]] = []
    counters = as_id_dict(dep_map.get("counters") or {})
    overall_pass = True

    for cid, concept in counters.items():
        if not isinstance(concept, dict):
            continue
        # 依存マップは `expected_value` を使う（旧 `value` も後方互換で許容）
        expected = concept.get("expected_value", concept.get("value"))
        expected_n = coerce_number(expected)
        # approximation: true の counter は厳密一致を求めない（「約N」表記）
        is_approx = bool(concept.get("approximation"))
        default_regex = concept.get("regex") or concept.get("pattern")
        default_path = concept.get("json_path") or concept.get("yaml_path")
        actual_values: list[Any] = []
        files_meta: list[str] = []
        failures: list[dict[str, Any]] = []

        for entry in collect_concept_files(concept):
            # 依存マップは `file:` キーを使う（`path:` も後方互換で許容）
            rel = entry.get("file") or entry.get("path")
            if not rel:
                continue
            entry_type = entry.get("type") or concept.get("type")
            path = project_root / rel
            if not path.exists():
                failures.append(
                    {
                        "file": rel,
                        "line": 0,
                        "actual": None,
                        "reason": "file_not_found",
                    }
                )
                overall_pass = False
                continue
            files_meta.append(rel)
            per_regex = entry.get("regex") or default_regex
            per_path = (
                entry.get("json_path")
                or entry.get("yaml_path")
                or default_path
            )
            values, matches = extract_values_from_file(path, per_path, per_regex)
            # 構造値（jsonpath/yamlpath）
            for v in values:
                # json_array_length 型: 解決した配列の length を実値とする
                if entry_type == "json_array_length" and isinstance(v, list):
                    v = len(v)
                vn = coerce_number(v)
                actual_values.append(vn)
                if expected_n is not None and not is_approx and vn != expected_n:
                    failures.append(
                        {"file": rel, "line": 0, "actual": v}
                    )
            # 行ベース正規表現マッチ — グループ 1 が数値ならそれを使う
            if per_regex:
                try:
                    compiled = re.compile(per_regex)
                except re.error:
                    compiled = None
                if compiled:
                    for lineno, matched_text in matches:
                        # 既存実装: 行全体ではなくグループ 1 を取り直す
                        line_search = compiled.search(matched_text)
                        captured = (
                            line_search.group(1)
                            if line_search and line_search.groups()
                            else matched_text
                        )
                        cn = coerce_number(captured)
                        actual_values.append(cn)
                        if expected_n is not None and not is_approx and cn != expected_n:
                            failures.append(
                                {
                                    "file": rel,
                                    "line": lineno,
                                    "actual": captured,
                                }
                            )
        status = "pass" if not failures else "fail"
        if status == "fail":
            overall_pass = False
        checks.append(
            {
                "counter": cid,
                "expected": expected,
                "actual_values": actual_values,
                "files": files_meta,
                "status": status,
                "failures": failures,
            }
        )

    return {
        "status": "pass" if overall_pass else "fail",
        "checks": checks,
    }


# ---------------------------------------------------------------------------
# Tier B: クロスリファレンス
# ---------------------------------------------------------------------------

def tier_b_cross_reference(
    dep_map: dict[str, Any], project_root: Path
) -> dict[str, Any]:
    """references セクションの required_in / required_files に対し存在検証。"""
    references = as_id_dict(dep_map.get("references") or {}, id_key="kind")
    checks: list[dict[str, Any]] = []
    overall_pass = True

    for ref_id, ref in references.items():
        if not isinstance(ref, dict):
            continue
        # 検出対象 ID 群（例: ["E-001", "E-002", ...]）
        ids: list[str] = []
        if isinstance(ref.get("ids"), list):
            ids = [str(x) for x in ref["ids"]]
        elif isinstance(ref.get("id_source"), dict):
            src = ref["id_source"]
            sp = src.get("path")
            jp = src.get("json_path") or src.get("yaml_path")
            if sp and jp:
                full = project_root / sp
                if full.exists():
                    vals, _ = extract_values_from_file(full, jp, None)
                    ids = [str(v) for v in vals]
        required_files = ref.get("required_files") or ref.get("required_in") or []
        # required_files は [str] あるいは [{path, regex_template}] 形式を許容
        failures: list[dict[str, Any]] = []
        files_meta: list[str] = []
        for fdef in required_files:
            if isinstance(fdef, str):
                path_rel = fdef
                regex_template = None
            else:
                path_rel = fdef.get("path")
                regex_template = fdef.get("regex_template") or fdef.get("regex")
            if not path_rel:
                continue
            path = project_root / path_rel
            files_meta.append(path_rel)
            if not path.exists():
                for ident in ids:
                    failures.append(
                        {"file": path_rel, "missing_id": ident, "reason": "file_not_found"}
                    )
                continue
            try:
                content = path.read_text(encoding="utf-8")
            except OSError as e:
                sys.stderr.write(f"WARN: 読み込み不可: {path} ({e})\n")
                continue
            for ident in ids:
                if regex_template:
                    needle = regex_template.replace("{id}", re.escape(ident))
                    try:
                        if not re.search(needle, content):
                            failures.append({"file": path_rel, "missing_id": ident})
                    except re.error as e:
                        sys.stderr.write(f"WARN: 不正な regex_template: {e}\n")
                else:
                    if ident not in content:
                        failures.append({"file": path_rel, "missing_id": ident})
        status = "pass" if not failures else "fail"
        if status == "fail":
            overall_pass = False
        checks.append(
            {
                "reference": ref_id,
                "ids_count": len(ids),
                "files": files_meta,
                "status": status,
                "failures": failures,
            }
        )
    return {
        "status": "pass" if overall_pass else "fail",
        "checks": checks,
    }


# ---------------------------------------------------------------------------
# Tier C: 廃止用語スキャン
# ---------------------------------------------------------------------------

def tier_c_deprecated_terms(
    dep_map: dict[str, Any], project_root: Path
) -> dict[str, Any]:
    deprecated = as_id_dict(dep_map.get("deprecated_terms") or {}, id_key="term")
    checks: list[dict[str, Any]] = []
    overall_pass = True

    default_globs = [
        "**/*.md",
        "**/*.html",
        "**/*.ts",
        "**/*.tsx",
        "**/*.js",
        "**/*.jsx",
        "**/*.json",
        "**/*.yaml",
        "**/*.yml",
    ]

    # スキル自身のドキュメント・依存マップ・依存マップ参照は除外
    # (廃止用語そのものを定義・参照しているため active 参照と誤判定される)
    global_excluded_globs = (
        dep_map.get("scan_config", {}).get("global_excluded_globs")
        or [
            ".claude/skills/spec-sync-orchestrator/**",
            ".spec-sync/**",
            "node_modules/**",
            ".git/**",
            ".next/**",
            "out/**",
            "dist/**",
            "build/**",
            "coverage/**",
            "playwright-report/**",
            "test-results/**",
        ]
    )

    for term, entry in deprecated.items():
        if not isinstance(entry, dict):
            entry = {}
        regex_src = entry.get("regex") or rf"\b{re.escape(term)}\b"
        try:
            compiled = re.compile(regex_src)
        except re.error as e:
            sys.stderr.write(f"WARN: 不正な regex '{regex_src}': {e}\n")
            continue
        allowed_files = set(entry.get("allowed_files") or [])
        allowed_contexts: list[str] = list(entry.get("allowed_contexts") or [])
        scan_globs = entry.get("scan_globs") or default_globs

        failures: list[dict[str, Any]] = []
        scanned_files: set[str] = set()
        seen_paths: set[Path] = set()

        from fnmatch import fnmatch

        def _is_allowed(rel_path: str) -> bool:
            # global excludes (skill itself, .git, etc.)
            for g in global_excluded_globs:
                if fnmatch(rel_path, g) or fnmatch(rel_path, g.lstrip("./")):
                    return True
                # leading **/X 形式の簡易対応: パス末尾一致
                if g.startswith("**/") and fnmatch(rel_path, g[3:]):
                    return True
                if g.endswith("/**") and rel_path.startswith(g[:-3]):
                    return True
            # per-term allowed_files (glob 対応)
            for af in allowed_files:
                if fnmatch(rel_path, af):
                    return True
                if af.startswith("**/") and (
                    fnmatch(rel_path, af[3:])
                    or fnmatch(Path(rel_path).name, af[3:])
                ):
                    return True
                if af.endswith("/**") and rel_path.startswith(af[:-3]):
                    return True
            return False

        for pattern in scan_globs:
            for path in project_root.glob(pattern):
                if not path.is_file():
                    continue
                rel = path.relative_to(project_root).as_posix()
                if _is_allowed(rel):
                    continue
                if path in seen_paths:
                    continue
                seen_paths.add(path)
                scanned_files.add(rel)
                try:
                    lines = path.read_text(encoding="utf-8").splitlines()
                except OSError as e:
                    sys.stderr.write(f"WARN: 読み込み不可: {path} ({e})\n")
                    continue
                for idx, line in enumerate(lines):
                    m = compiled.search(line)
                    if not m:
                        continue
                    lineno = idx + 1
                    # allowed_contexts は現在行＋直前3行のウィンドウで判定する。
                    # JSON/YAML では値が独立行に来る（例 "deprecated_methods": の
                    # 次行に "scratch"）ため、単一行一致だと正規の記述を誤検出する。
                    window = "\n".join(lines[max(0, idx - 3): idx + 1])
                    if any(ctx and ctx in window for ctx in allowed_contexts):
                        continue
                    failures.append(
                        {
                            "file": rel,
                            "line": lineno,
                            "match": m.group(0),
                            "snippet": line.strip()[:200],
                        }
                    )

        status = "pass" if not failures else "fail"
        if status == "fail":
            overall_pass = False
        checks.append(
            {
                "term": term,
                "regex": regex_src,
                "scanned_files_count": len(scanned_files),
                "status": status,
                "failures": failures,
            }
        )

    return {
        "status": "pass" if overall_pass else "fail",
        "checks": checks,
    }


# ---------------------------------------------------------------------------
# Tier F: 下流分解カバレッジ（features ⇄ feature-decomposition ⇄ tickets / screens ⇄ mockup index）
# ---------------------------------------------------------------------------

def _extract_source_ids(
    project_root: Path, src: dict[str, Any]
) -> tuple[list[str], str | None]:
    """id_source 定義から ID 一覧を抽出する。(ids, error) を返す。"""
    rel = src.get("file") or src.get("path")
    if not rel:
        return [], "id_source.file 未指定"
    path = project_root / rel
    if not path.exists():
        return [], f"id_source ファイルなし: {rel}"
    try:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        return [], f"id_source 読込失敗: {rel} ({e})"
    node: Any = data
    json_path = src.get("json_path", "$.items")
    for part in json_path.replace("$", "").strip(".").split("."):
        if not part:
            continue
        node = node.get(part) if isinstance(node, dict) else None
    if not isinstance(node, list):
        return [], f"走れない検査：json_path を解決できない（絞り込み式に未対応 か 参照先の形が違う）: {json_path}"
    field = src.get("id_field", "id")
    rgx = re.compile(src.get("id_regex", r"^[A-Z]+-\d+$"))
    ids: list[str] = []
    for item in node:
        v = item.get(field) if isinstance(item, dict) else None
        if v is not None and rgx.match(str(v)):
            ids.append(str(v))
    return ids, None


def tier_f_downstream_coverage(
    dep_map: dict[str, Any], project_root: Path
) -> dict[str, Any]:
    """全 F-xxx/S-xxx が下流（機能分解・tickets・mockup index）に存在するか検証。

    severity=error のターゲットに欠落があれば fail、warn なら warnings に記録のみ。
    機能を仕様に足したのに機能分解/タスク分解へ波及していない取り残しを検出する。
    """
    specs = dep_map.get("downstream_coverage") or []
    if not specs:
        return {"status": "skipped", "checks": [], "failures": [], "warnings": []}

    checks: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    overall_pass = True

    import subprocess as _sp

    for spec in specs:
        # command で書いた行（Kaname の書き方・KN-50）：その検査を走らせ、終わりのコードで判定する
        if spec.get("command") and not spec.get("id_source"):
            r = _sp.run(spec["command"], shell=True, cwd=project_root, capture_output=True, text=True)
            ok = r.returncode == 0
            last = ((r.stdout or "") + (r.stderr or "")).strip().splitlines()[-1:] or [""]
            checks.append({"coverage": spec.get("id"), "command": spec["command"], "status": "pass" if ok else "fail", "last": last[0][:160]})
            if not ok:
                (failures if spec.get("severity", "error") == "error" else warnings).append(
                    {"coverage": spec.get("id"), "error": f"検査が赤: {spec['command']}（{last[0][:120]}）"}
                )
                if spec.get("severity", "error") == "error":
                    overall_pass = False
            continue
        src_ids, err = _extract_source_ids(project_root, spec.get("id_source", {}))
        if err:
            failures.append({"coverage": spec.get("id"), "error": err})
            overall_pass = False
            continue
        for tgt in spec.get("targets", []):
            rel = tgt.get("file") or tgt.get("path")
            severity = tgt.get("severity", "error")
            tpath = project_root / rel if rel else None
            text = ""
            if tpath is None or not tpath.exists():
                missing = list(src_ids)
                text_err = f"ターゲットファイルなし: {rel}"
            else:
                text = tpath.read_text(encoding="utf-8", errors="ignore")
                text_err = None
                missing = [i for i in src_ids if i not in text]
            check = {
                "coverage": spec.get("id"),
                "target": rel,
                "role": tgt.get("role"),
                "severity": severity,
                "source_total": len(src_ids),
                "missing_count": len(missing),
                "missing": missing[:50],
                "status": "pass" if (not missing and not text_err) else "fail",
                "remediation": tgt.get("remediation"),
            }
            if text_err:
                check["error"] = text_err
            checks.append(check)
            if missing or text_err:
                if severity == "warn":
                    warnings.append(check)
                else:
                    failures.append(check)
                    overall_pass = False

    return {
        "status": "pass" if overall_pass else "fail",
        "checks": checks,
        "failures": failures,
        "warnings": warnings,
    }


# ---------------------------------------------------------------------------
# 台帳にある外の段（D / G / H / T）を回す
#
# 2026-09-17 追加。それまでこのファイルは A/B/C/F しか回していないのに、
# SKILL.md は「八段監査」と名乗っていた。名乗った段のうち走った段しか数えないので、
# 走らない段は永久に緑のままだった。台帳（audit-manifest.yaml）を読んで、
# script の段は実プロセスで回し、結果を同じ payload に混ぜる。
# 台帳に足せば回る＝散文に戻らない。
# ---------------------------------------------------------------------------

MANIFEST_NAME = "audit-manifest.yaml"


def run_external_tiers(project_root: Path, only: str | None = None) -> dict[str, Any]:
    """audit-manifest.yaml の kind: script の段を回して結果を返す。"""
    import subprocess

    here = Path(__file__).resolve().parent
    man_path = here / MANIFEST_NAME
    if not man_path.exists():
        return {"_manifest_missing": {
            "status": "fail",
            "failures": [f"監査の台帳 {man_path} が無い。段が回らない"],
        }}
    man = load_yaml(man_path)
    out: dict[str, Any] = {}
    for t in man.get("tiers", []):
        tid = str(t.get("id", "?"))
        pref0 = t.get("prefer_project")
        overridden = bool(pref0 and (project_root / pref0).exists())
        # builtin の段でも、プロジェクトが自前の実装を持っているならそちらが正。
        # 汎用の実装が動かない環境（依存ライブラリが無い等）で、
        # 「走れなかった」を「不合格」として出し続けないため。
        if t.get("kind") != "script" and not overridden:
            continue
        if only and only.lower() != tid.lower():
            continue
        # プロジェクト側に同名の実物があるならそちらを優先（trace_gate 等）
        script = here / str(t.get("script"))
        pref = t.get("prefer_project")
        if pref and (project_root / pref).exists():
            script = project_root / pref
        if not script.exists():
            out[tid] = {"status": "fail", "name": t.get("name"),
                        "failures": [f"script {script} が実在しない"]}
            continue
        argv = [sys.executable, str(script)] + [
            str(x).replace("{root}", str(project_root)) for x in (t.get("argv") or [])
        ]
        cwd = str(project_root) if t.get("cwd") else None
        try:
            r = subprocess.run(argv, capture_output=True, text=True, cwd=cwd, timeout=600)
        except Exception as e:  # noqa: BLE001
            out[tid] = {"status": "fail", "name": t.get("name"),
                        "failures": [f"起動できない: {e}"]}
            continue
        body: dict[str, Any]
        try:
            body = json.loads(r.stdout)
        except Exception:  # noqa: BLE001
            body = {"status": "pass" if r.returncode == 0 else "fail",
                    "failures": [ln for ln in r.stdout.splitlines() if "★" in ln][:25]
                    or ([r.stderr.strip()[:400]] if r.returncode else [])}
        body.setdefault("status", "pass" if r.returncode == 0 else "fail")
        if r.returncode != 0:
            body["status"] = "fail"
        body["name"] = t.get("name")
        body["blocking"] = bool(t.get("blocking", True))
        if overridden and t.get("kind") != "script":
            body["overrides_builtin"] = True
            body["ran"] = str(script)
        out[tid] = body
    return out


# ---------------------------------------------------------------------------
# 統合・出力
# ---------------------------------------------------------------------------

def build_summary(payload: dict[str, Any]) -> str:
    a = payload["tier_a_numeric_consistency"]["status"]
    b = payload["tier_b_cross_reference"]["status"]
    c = payload["tier_c_deprecated_terms"]["status"]
    f = payload["tier_f_downstream_coverage"]["status"]
    overall = payload["overall"]
    ext = payload.get("external_tiers") or {}
    built = {"A": a, "B": b, "C": c, "F": f}
    parts = []
    # 段を固定で書かない。台帳に足した段が summary から漏れると、
    # 「回っているのに見えない」＝また散文と同じことになる
    for tid in sorted(set(built) | set(ext)):
        if tid in ext:
            mark = "*" if ext[tid].get("overrides_builtin") else ""
            parts.append(f"{tid}={ext[tid].get('status')}{mark}")
        elif tid in built:
            parts.append(f"{tid}={built[tid]}")
    return f"overall={overall} (" + ", ".join(parts) + ")"


def run_validation(
    project_root: Path,
    tier: str | None,
) -> dict[str, Any]:
    dep_path = find_first(project_root, DEFAULT_DEP_PATHS)
    if dep_path is None:
        sys.stderr.write(
            "ERROR: 依存マップが見つかりません。"
            "spec-dependencies.yaml が見つかりません。\n"
            "テンプレートをコピーして作成してください:\n"
            "  cp ~/.claude/skills/spec-sync-orchestrator/assets/templates/spec-dependencies.template.yaml ./spec-dependencies.yaml\n"
            "記入例: ~/.claude/skills/spec-sync-orchestrator/assets/examples/spec-dependencies.example-ai-platform.yaml\n"
            "埋め方: SKILL.md の STEP 0 を参照\n"
        )
        sys.exit(2)
    dep_map = load_yaml(dep_path)
    # cross-ref-rules.yaml は将来用に load（現状は予約）
    rules_path = find_first(project_root, DEFAULT_RULES_PATHS)
    if rules_path is not None:
        load_yaml(rules_path)

    empty: dict[str, Any] = {"status": "skipped", "checks": []}
    # 外の段（台帳 audit-manifest.yaml）を先に回す。
    # プロジェクトが自前の実装を持つ段は、そちらの結果で builtin を置き換える。
    ext = run_external_tiers(project_root, only=tier)
    taken = {k.lower() for k, v in ext.items() if v.get("overrides_builtin")}
    a = (
        tier_a_numeric_consistency(dep_map, project_root)
        if tier in (None, "a") and "a" not in taken else empty
    )
    b = (
        tier_b_cross_reference(dep_map, project_root)
        if tier in (None, "b") and "b" not in taken else empty
    )
    c = (
        tier_c_deprecated_terms(dep_map, project_root)
        if tier in (None, "c") and "c" not in taken else empty
    )
    f = (
        tier_f_downstream_coverage(dep_map, project_root)
        if tier in (None, "f") and "f" not in taken else empty
    )

    statuses = [s["status"] for s in (a, b, c, f) if s.get("status") != "skipped"]
    statuses += [b2.get("status") for b2 in ext.values()
                 if b2.get("blocking", True) and b2.get("status") != "skipped"]
    overall = "pass" if statuses and all(s == "pass" for s in statuses) else (
        "pass" if not statuses else "fail"
    )
    payload: dict[str, Any] = {
        "executed_at": now_iso(),
        "tier_a_numeric_consistency": a,
        "tier_b_cross_reference": b,
        "tier_c_deprecated_terms": c,
        "tier_f_downstream_coverage": f,
        "external_tiers": ext,
        "overall": overall,
        "summary": "",
    }
    payload["summary"] = build_summary(payload)
    return payload


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="spec-validator.py",
        description="spec-sync-orchestrator: 八段監査（A/B/C/D/F/G/H/T）",
    )
    p.add_argument(
        "--project-root",
        default=os.getcwd(),
        help="プロジェクトルート (デフォルト: cwd)",
    )
    p.add_argument(
        "--tier",
        choices=["a", "b", "c", "d", "f", "g", "h", "t"],
        default=None,
        help="特定 tier のみ実行 (a/b/c/d/f/g/h/t)。未指定で八段全部",
    )
    p.add_argument(
        "--json-output", action="store_true", help="JSON のみを stdout 出力"
    )
    p.add_argument(
        "--pre-commit",
        action="store_true",
        help="pre-commit モード（出力を最小化、FAIL 時のみ詳細）",
    )
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)
    project_root = Path(args.project_root).resolve()
    payload = run_validation(project_root, args.tier)

    overall = payload["overall"]
    exit_code = 0 if overall == "pass" else 1

    if args.json_output:
        json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
    elif args.pre_commit:
        if overall == "pass":
            sys.stdout.write(f"[spec-validator] PASS — {payload['summary']}\n")
        else:
            sys.stdout.write(f"[spec-validator] FAIL — {payload['summary']}\n")
            json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
            sys.stdout.write("\n")
    else:
        # 通常モード: 常に JSON を出力（人にも機械にも読める）
        json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
