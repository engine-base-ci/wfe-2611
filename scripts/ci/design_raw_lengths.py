#!/usr/bin/env python3
"""D8 生の長さ：画面の CSS に、トークン（var(--…)）を通らない生の長さが無いか（K-261）。design_gate.py が読む。

由来：D1〜D7 は色・字の大きさ・書体・角丸・部品の値しか見ず、画面の CSS に生で書いた大きさ・余白・行の高さ・影
（padding: 10px 12px・gap: 6px・max-width: 720px・line-height: 1.9・box-shadow: 0 8px 24px …）を通した。
画面のチケットが 7 本続けてレビューで差し戻しになった。

決まりはどれもプロジェクトの design-gate.json の raw_lengths から読む（プロジェクトの名前・道を決め打ちしない）：
  paths        見る置き場（設定ファイルの在る所からの道。フォルダなら下の .css を全部。node_modules・.next などは読まない）
  token_css    トークンの定義元（ここで定義された名前を var で読むのがトークン。ここの宣言は見ない）
  token_prefix トークンの頭（例 --k-）。この頭で token_css に無い名前を読むと赤（打ち間違いは予備の値に黙って倒れる）
  allow        許す値（{"value", "reason"}・理由の無い許しは赤）。"0" はどの単位の零にも当たる
  ledger       台帳（{"_doc", "entries": [{file, selector, prop, value, count, reason}]}）。減らすだけ
  other_checks 別の段が比べる値（既定：font-size の px は D4・border-radius の px は D3）。それ以外の単位は D8 が見る

赤になるもの：宣言（素の規則・@media などの中・入れ子の中のどれでも）の値に、
  ・数と長さの単位（UNITS）が var(…) の外にある（var の予備の値の中・calc/min/max/clamp の中も見る）
  ・line-height の単位の無い数（1.9 など）
  ・トークンでない自前の変数の定義（--x: 12px）に生の長さがある・その変数を var(--x) で読む（どの性質でも）
  ・token_prefix の名前が token_css にも見る置き場の定義にも無い
見ないもの：@media・@container・@keyframes などの条件と区切り（宣言ではない）・色の関数の中・文字と url(…) の中・
  単位の無い数（line-height のほか）・どこにも定義の無い token_prefix でない名前（JS が入れる物。値は見えない）
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

UNITS = ("px", "rem", "em", "%", "vw", "vh", "vi", "vb", "vmin", "vmax", "svh", "lvh", "dvh", "svw", "lvw",
         "dvw", "svi", "lvi", "dvi", "svb", "lvb", "dvb", "svmin", "svmax", "lvmin", "lvmax", "dvmin", "dvmax",
         "ch", "ex", "cap", "ic", "lh", "rlh", "rem", "rex", "rch", "ric", "rcap",
         "cqw", "cqh", "cqi", "cqb", "cqmin", "cqmax", "pt", "pc", "cm", "mm", "in", "q")
LEN = re.compile(r"(?<![\w#.-])(-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?)(" +
                 "|".join(sorted(set(UNITS), key=len, reverse=True)) + r")(?![\w-])", re.I)
BARE = re.compile(r"(?<![\w#.-])(-?(?:\d+\.?\d*|\.\d+))(?![\w%.-])")
COLOR_FN = re.compile(r"\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(", re.I)
VAR = re.compile(r"var\(\s*(--[\w-]+)\s*(,)?", re.I)
DEFAULT_OTHER = {"font-size": ["px"], "border-radius": ["px"]}
SKIP_DIRS = {"node_modules", ".next", ".turbo", "dist", "build", "out", "coverage", "test-results",
             "playwright-report", ".git"}


# ---------------------------------------------------------------- CSS を宣言に分ける
def _keep_len(m: re.Match, head: str = "", tail: str = "") -> str:
    s = m.group(0)
    return head + re.sub(r"[^\n]", " ", s[len(head):len(s) - len(tail)]) + tail


def _blank(css: str) -> str:
    """文字と url(…) の中を同じ長さの空白にする（中の { ; : を数えない。行の数は変えない）"""
    css = re.sub(r"\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*'", lambda m: _keep_len(m, m.group(0)[0], m.group(0)[-1]), css)
    return re.sub(r"url\((?:[^()]|\([^()]*\))*\)", lambda m: _keep_len(m, "url(", ")"), css, flags=re.I)


def declarations(css: str) -> list[tuple[str, str, str, int]]:
    """(セレクタの鎖・性質・値・行) の並び。@media などの中・入れ子の中の宣言も拾う。条件（前置き）は宣言にしない"""
    css = re.sub(r"/\*.*?\*/", _keep_len, css, flags=re.S)
    text = _blank(css)
    out: list[tuple[str, str, str, int]] = []
    stack: list[str] = []
    seg, paren = 0, 0
    for i, ch in enumerate(text):
        if ch == "(":
            paren += 1
            continue
        if ch == ")":
            paren = max(0, paren - 1)
            continue
        if paren or ch not in "{};":
            continue
        raw = text[seg:i]
        if ch == "{":
            stack.append(re.sub(r"\s+", " ", css[seg:i]).strip())
        elif ":" in raw and stack and not stack[-1].startswith("@"):
            k = raw.split(":", 1)[0].strip().lower()
            if re.fullmatch(r"--[\w-]+|-?[a-z][\w-]*", k):
                val = re.sub(r"\s+", " ", css[seg:i].split(":", 1)[1]).strip()
                val = re.sub(r"\s*!\s*important$", "", val, flags=re.I)
                line = css.count("\n", 0, seg + len(raw) - len(raw.lstrip())) + 1
                out.append((" >> ".join(stack), k, val, line))
        if ch == "}" and stack:
            stack.pop()
        seg = i + 1
    return out


# ---------------------------------------------------------------- 値を見る
def _drop_fns(v: str, pat: re.Pattern) -> str:
    out, i = [], 0
    for m in pat.finditer(v):
        if m.start() < i:
            continue
        out.append(v[i:m.start()])
        j, depth = m.end(), 1
        while j < len(v) and depth:
            depth += {"(": 1, ")": -1}.get(v[j], 0)
            j += 1
        i = j
    out.append(v[i:])
    return " ".join(out)


def strip_vars(v: str) -> tuple[str, list[str]]:
    """var(--名前) を外し、予備の値（, の後ろ）だけを残す。戻り：(残り, 読んだ名前)"""
    names: list[str] = []
    while True:
        m = VAR.search(v)
        if not m:
            return v, names
        names.append(m.group(1))
        j, depth = m.end(), 1
        while j < len(v) and depth:
            depth += {"(": 1, ")": -1}.get(v[j], 0)
            j += 1
        inner = v[m.end():j - 1] if m.group(2) else ""
        v = v[:m.start()] + " " + inner + " " + v[j:]


def _is_zero(tok: str) -> bool:
    m = re.match(r"-?(?:\d+\.?\d*|\.\d+)", tok)
    return bool(m) and float(m.group(0)) == 0


def raw_tokens(prop: str, value: str, allow: set[str], other: dict[str, list[str]]) -> list[str]:
    """値の中の生の長さ（許しの値・別の段が比べる単位を除く）"""
    v = re.sub(r"\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*'|url\((?:[^()]|\([^()]*\))*\)", " ", value, flags=re.I)
    v = _drop_fns(strip_vars(v)[0], COLOR_FN)
    v = re.sub(r"#[0-9a-fA-F]{3,8}\b", " ", v)
    left = {u.lower() for u in other.get(prop, [])}
    hits = [m.group(1) + m.group(2).lower() for m in LEN.finditer(v) if m.group(2).lower() not in left]
    if prop == "line-height":
        hits += [m.group(1) for m in BARE.finditer(LEN.sub(" ", v))]
    return [h for h in hits if not ((_is_zero(h) and "0" in allow) or h.lower() in allow)]


# ---------------------------------------------------------------- 置き場を読む
def css_files(base: Path, paths: list[str]) -> list[Path]:
    out: set[Path] = set()
    for p in paths:
        q = base / p
        if q.is_dir():
            out |= {f for f in q.rglob("*.css") if f.is_file() and not SKIP_DIRS & set(f.relative_to(base).parts)}
        elif q.is_file() and q.suffix == ".css":
            out.add(q)
    return sorted(out)


def read_conf(conf: dict, base: Path) -> tuple[dict, list[str]]:
    problems: list[str] = []
    paths, tokens = conf.get("paths") or [], conf.get("token_css") or []
    if not paths:
        problems.append("raw_lengths.paths が無い（見る置き場を書く）")
    if not tokens:
        problems.append("raw_lengths.token_css が無い（トークンの定義元を書く）")
    if not conf.get("ledger"):
        problems.append("raw_lengths.ledger が無い（台帳の道を書く）")
    allow: set[str] = set()
    for a in conf.get("allow") or []:
        if not isinstance(a, dict) or not str(a.get("reason") or "").strip():
            problems.append(f"raw_lengths.allow の理由が無い：{a}")
            continue
        allow.add(str(a.get("value")).strip().lower())
    token_files = []
    for t in tokens:
        if (base / t).is_file():
            token_files.append((base / t).resolve())
        else:
            problems.append(f"raw_lengths.token_css の {t} が無い")
    other = conf.get("other_checks", DEFAULT_OTHER)
    return {"paths": paths, "tokens": token_files, "allow": allow, "prefix": str(conf.get("token_prefix") or ""),
            "other": other}, problems


def scan(base: Path, conf: dict) -> tuple[list[dict], list[str], int]:
    """戻り：(赤（file・selector・prop・value・line・raw）, 設定の問題, 見た .css の数)"""
    c, problems = read_conf(conf, base)
    token_names: set[str] = set()
    for f in c["tokens"]:
        token_names |= {k for _, k, _, _ in declarations(f.read_text(encoding="utf-8")) if k.startswith("--")}
    files = [f for f in css_files(base, c["paths"]) if f.resolve() not in c["tokens"]]
    if c["paths"] and not files:
        problems.append("raw_lengths.paths の下に .css が 1 つも無い（黙って緑にしない）")
    decls = [(f.relative_to(base).as_posix(), s, k, v, ln)
             for f in files for s, k, v, ln in declarations(f.read_text(encoding="utf-8", errors="replace"))]
    local = {k for _, _, k, _, _ in decls if k.startswith("--")}
    local_raw = {k for _, _, k, v, _ in decls if k.startswith("--") and raw_tokens(k, v, c["allow"], c["other"])}
    found: list[dict] = []
    for rel, sel, prop, val, ln in decls:
        raws = raw_tokens(prop, val, c["allow"], c["other"])
        for name in strip_vars(val)[1]:
            if name in token_names:
                continue
            if name in local_raw:
                raws.append(f"var({name})＝生の値の自前の変数")
            elif c["prefix"] and name.startswith(c["prefix"]) and name not in local:
                raws.append(f"var({name})＝無いトークン")
        if raws:
            found.append({"file": rel, "selector": sel, "prop": prop, "value": val, "line": ln, "raw": raws})
    return found, problems, len(files)


# ---------------------------------------------------------------- 台帳
def key(e: dict) -> tuple[str, str, str, str]:
    return (e["file"], e["selector"], e["prop"], e["value"])


def counts(found: list[dict]) -> dict[tuple[str, str, str, str], int]:
    out: dict[tuple[str, str, str, str], int] = {}
    for f in found:
        out[key(f)] = out.get(key(f), 0) + 1
    return out


def show(k: tuple[str, str, str, str]) -> str:
    return f"{k[1]} {{ {k[2]}: {k[3]} }}"


def ledger_map(entries: list[dict]) -> tuple[dict[tuple, int], list[str]]:
    bad: list[str] = []
    seen: dict[tuple, int] = {}
    for e in entries:
        try:
            k = key(e)
        except (KeyError, TypeError):
            bad.append(f"台帳の行の形が違う（file・selector・prop・value・count・reason）：{e}")
            continue
        if k in seen:
            bad.append(f"台帳に同じ行が 2 つ：{k[0]}  {show(k)}")
        n = e.get("count")
        if not isinstance(n, int) or isinstance(n, bool) or n < 1:
            bad.append(f"台帳の行の count が 1 以上の整数でない：{k[0]}  {show(k)}")
            n = 0
        if not str(e.get("reason") or "").strip():
            bad.append(f"台帳の行の理由が空：{k[0]}  {show(k)}")
        seen[k] = n
    return seen, bad


def ledger_problems(found: list[dict], entries: list[dict]) -> list[str]:
    seen, bad = ledger_map(entries)
    now = counts(found)
    lines = {key(f): f["line"] for f in found}
    for k, n in sorted(now.items()):
        if n > seen.get(k, 0):
            bad.append(f"D8 {k[0]}:{lines[k]}  {show(k)}（台帳に無い生の値 {n - seen.get(k, 0)} 個。トークンにする）")
    for k, led in sorted(seen.items()):
        if 0 < led and now.get(k, 0) < led:
            bad.append(f"台帳を減らす（直った）：{k[0]}  {show(k)}  台帳 {led} → 今 {now.get(k, 0)}")
    return bad


def shrink(found: list[dict], entries: list[dict]) -> list[dict]:
    """直った分だけ台帳を減らす（台帳に無い赤は足さない）"""
    now = counts(found)
    out = []
    for e in entries:
        try:
            n = min(int(e.get("count") or 0), now.get(key(e), 0))
        except (KeyError, TypeError, ValueError):
            continue
        if n > 0:
            out.append({**e, "count": n})
    return out


def _git(root: Path, *args: str) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(["git", *args], cwd=root, capture_output=True, text=True, check=False)
    except OSError as e:
        return subprocess.CompletedProcess(["git", *args], 1, "", str(e))


def base_problems(cfg_file: Path, ref: str, entries: list[dict]) -> tuple[list[str], str]:
    """分かれ目の台帳（分かれ目の設定が指す道）と比べる。足した行・増やした count は赤。
    分かれ目の設定に raw_lengths が無いときだけ、台帳を入れる回として比べずに通す"""
    root = cfg_file.parent
    top = _git(root, "rev-parse", "--show-toplevel")
    if top.returncode != 0:
        return [f"git の木でない（比べる版 {ref} と比べられない）"], ""
    if not ref or _git(root, "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}").returncode != 0:
        return [f"比べる版 {ref or '（空）'} が読めない"], ""
    rel_cfg = cfg_file.resolve().relative_to(Path(top.stdout.strip()).resolve()).as_posix()
    r = _git(root, "show", f"{ref}:{rel_cfg}")
    try:
        base_conf = json.loads(r.stdout).get("raw_lengths") if r.returncode == 0 else None
    except ValueError as e:
        return [f"分かれ目の {rel_cfg} が読めない（{e}）"], ""
    if not base_conf:
        return [], f"分かれ目 {ref[:12]} の設定に raw_lengths が無い（台帳を入れる回。比べない）"
    rel_led = (Path(rel_cfg).parent / str(base_conf.get("ledger") or "")).as_posix()
    r = _git(root, "show", f"{ref}:{rel_led}")
    if r.returncode != 0:
        return [f"分かれ目の台帳 {rel_led} が無い（分かれ目の設定が指す台帳と比べる）"], ""
    try:
        base, _ = ledger_map(json.loads(r.stdout)["entries"])
    except (ValueError, KeyError, TypeError) as e:
        return [f"分かれ目の台帳が読めない（{e}）"], ""
    now, _ = ledger_map(entries)
    bad = []
    for k, n in sorted(now.items()):
        if k not in base:
            bad.append(f"分かれ目の台帳に無い行（足して通さない）：{k[0]}  {show(k)}")
        elif n > base[k]:
            bad.append(f"分かれ目より count が増えた（足して通さない）：{k[0]}  {show(k)}  {base[k]} → {n}")
    return bad, ""


def run(cfg_file: Path, cfg: dict, base_ref: str | None, no_base: bool, do_shrink: bool) -> tuple[list[str], str, int]:
    """D8 を流す。戻り：(赤の行, 知らせ, 見た .css の数)"""
    conf = cfg.get("raw_lengths")
    if not isinstance(conf, dict) or not conf:
        return [f"D8 設定が無い：{cfg_file} に raw_lengths を書く（黙って緑にしない）"], "", 0
    if not no_base and base_ref is None:
        return ["D8 比べ方の指定が無い：--ledger-base-ref <版> か --no-base を付ける（黙って比べずに緑にしない）"], "", 0
    base = cfg_file.parent
    found, problems, n = scan(base, conf)
    bad = [f"D8 {p}" for p in problems]
    led_file = base / str(conf.get("ledger") or "")
    try:
        entries = json.loads(led_file.read_text(encoding="utf-8"))["entries"]
        if not isinstance(entries, list):
            raise TypeError("entries が並びでない")
    except (OSError, ValueError, KeyError, TypeError) as e:
        return bad + [f"D8 台帳 {led_file} が読めない（{e}）"], "", n
    if do_shrink:
        doc = json.loads(led_file.read_text(encoding="utf-8"))
        doc["entries"] = shrink(found, entries)
        led_file.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        entries = doc["entries"]
    bad += ledger_problems(found, entries)
    note = ""
    if not no_base:
        more, note = base_problems(cfg_file, base_ref or "", entries)
        bad += [f"D8 {m}" for m in more]
    return bad, note, n
