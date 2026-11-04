#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tier H — 関門（choke points）の機械検査。

 SKILL.md の STEP 5 は H-1〜H-4 を列挙していたが、スクリプトはどこにも無かった
 （2026-09-17 の棚卸しで判明）。ここで実装する。正本は rules/common/choke-points.md。

 検査
   H-4 網羅   標準 6 関門（C1 ネットワーク / C2 永続化 / C3 モデル / C4 ファイル /
              C5 プロセス / C6 通知）が choke-points.json に全部あり、各々に
              gateway_path・forbidden_direct_apis・ci_check・source があるか
   H-3 台帳   例外台帳が実在し、期限切れの例外が無いか
   H-1 迂回   実装があるなら、gateway_path の外から禁止 API を呼んでいないか
   H-2 動的   eval / 動的 import を使っていないか（使われると H-1 が破れる）

 H-1・H-2 は実装が無いと走れない。走れないものは緑にせず、理由があれば blocked（warn）、
 理由が無ければ FAIL にする。
"""
from __future__ import annotations
import argparse, json, os, re, sys

try:
    import yaml
except ImportError:
    print("FAIL — PyYAML が要ります"); sys.exit(2)

STD = {"C1": "ネットワーク", "C2": "永続化", "C3": "モデル呼び出し",
       "C4": "ファイル", "C5": "プロセス起動", "C6": "通知送出"}
NEED = ("gateway_path", "forbidden_direct_apis", "ci_check")
CODE_EXT = (".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".kt", ".swift")
# 「まだ走らせられない理由」と読む語。依存マップの tier_blocked_words: で足せる
DEFER = ("実装開始後", "未着手", "実装後", "まだ", "後で有効化", "not yet", "after implementation")


def app_files(root: str, cps) -> list:
    """関門が宣言した置き場（gateway_path の親）にある実装だけを数える。

    「.py が 1 つでもあれば実装あり」にすると、モックのビルド用スクリプトを数えて
    H-1／H-2 が何も検査しないまま緑になる。偽の緑を作らない（L-012）。
    """
    roots = set()
    for c in cps:
        gp = str(c.get("gateway_path") or "")
        if not gp:
            continue
        top = gp.strip("/").split("/")[0]
        if top:
            roots.add(top)
    out = []
    for r in sorted(roots):
        base = os.path.join(root, r)
        if not os.path.isdir(base):
            continue
        for dp, dns, fns in os.walk(base):
            dns[:] = [d for d in dns if d not in (".git", "node_modules", ".venv", "dist", "build")]
            out += [os.path.join(dp, f) for f in fns if f.endswith(CODE_EXT)]
    return out



# --- 禁止のものを「本当に呼んでいる行」だけで探す ---------------------------
#  素朴に部分一致させると、`regex.exec(...)` を「プロセス起動の関門を迂回」と誤検知する。
#  当てにならないゲートは読まれなくなるので、次の 2 通りに分けて見る。
#    モジュール名（"/" や "@" を含む・node: 付き）→ import / require / from の引用符の中だけ
#    素の名前（exec・spawn・fetch 等）          → 前がドットや語でない呼び出し `name(` だけ
#  テストのファイルは既定で対象外（正本 choke-points.md「テストコードは対象外にしてよいが明記する」）。
def read_ledger(root: str, rel) -> tuple[set, list]:
    """例外台帳（越境を理由つきで許した一覧）を読む。

    台帳に載っている越境は「知った上で許したもの」なので赤にしない。
    ただし **期限が切れた例外は赤**（登録して放置を許さない。正本 choke-points.md §4 H-3）。
    形式は問わない：行の中の path らしきものと YYYY-MM-DD を拾う。
    """
    import datetime
    paths, expired = set(), []
    if not rel:
        return paths, expired
    p = os.path.join(root, rel)
    if not os.path.exists(p):
        return paths, expired
    today = datetime.date.today().isoformat()
    for ln in open(p, encoding="utf-8", errors="ignore").read().splitlines():
        if ln.lstrip().startswith(("#", ">")):
            continue
        # 表の行（| ID | 関門 | 迂回箇所 | 理由 | 代替統制 | 期限 | 状態 |）は、迂回箇所の欄のパスと期限の欄の日付だけを読む。
        # 理由の欄の経緯の日付やフォルダ名を、期限や許しの場所と読み違えない（Kaname・KN-50）
        cols = [c.strip() for c in ln.strip().strip("|").split("|")]
        if re.match(r"^X-\d+$", cols[0] if cols else "") and len(cols) >= 7:
            hits = re.findall(r"`([^`#]+)`", cols[2])
            d = re.search(r"(\d{4}-\d{2}-\d{2})", cols[5])
            for h in hits:
                paths.add(h.rstrip("/"))
                if d and d.group(1) < today and "有効" in cols[6]:
                    expired.append(f"{h}（期限 {d.group(1)} を過ぎている）")
            continue
        # `packages/auth/` のように backtick で囲んだフォルダも許しとして読む（Kaname・KN-50）。
        # `ファイル#定数` は、ファイルの一部だけの例外なので、ファイル全体を許さない
        hits = re.findall(r"[\w./-]+/[\w./-]+\.[a-z]{2,4}(?![\w#])|[\w.-]+(?:/[\w.-]+)*/(?=[`\s|])", ln)
        if not hits:
            continue
        d = re.search(r"(\d{4}-\d{2}-\d{2})", ln)
        for h in hits:
            paths.add(h.rstrip("/") if h.endswith("/") else h)
            if d and d.group(1) < today:
                expired.append(f"{h}（期限 {d.group(1)} を過ぎている）")
    return paths, expired


def excused(rel_path: str, ledger: set) -> bool:
    return any(x and (x in rel_path or rel_path.startswith(x)) for x in ledger)

TYPE_ONLY = __import__("re").compile(r"import\s+type\s|,\s*type\s+\{")

TEST_RE = __import__("re").compile(r"(^|/)(tests?|__tests__)/|\.(test|spec)\.[a-z]+$")


def build_matcher(pats):
    import re as _re
    mods = [p for p in pats if ("/" in p or p.startswith("@") or p.startswith("node:"))]
    bare = [p for p in pats if p not in mods]
    rx = []
    if mods:
        rx.append(r"""(?:from|require|import)\s*\(?\s*['"](?:""" +
                  "|".join(_re.escape(m) for m in mods) + r""")['"/]""")
    if bare:
        rx.append(r"(?<![\w.])(?:" + "|".join(_re.escape(b) for b in bare) + r")\s*\(")
        rx.append(r"""(?:from|require|import)\s*\(?\s*['"](?:""" +
                  "|".join(_re.escape(b) for b in bare) + r""")['"/]""")
    return _re.compile("|".join(rx)) if rx else None


def scan_bypass(root: str, cps, files, with_tests: bool = False, ledger: set | None = None) -> list:
    bad, soft = [], []
    ledger = ledger or set()
    for c in cps:
        pats = c.get("forbidden_direct_apis") or []
        gp = os.path.join(root, str(c.get("gateway_path") or "___"))
        rx = build_matcher(pats)
        if rx is None:
            continue
        for f in files:
            if f.startswith(gp):
                continue
            if not with_tests and TEST_RE.search(os.path.relpath(f, root)):
                continue
            try:
                body = open(f, encoding="utf-8", errors="ignore").read()
                m = rx.search(body)
                if m:
                    rel = os.path.relpath(f, root)
                    line = body[body.rfind("\n", 0, m.start()) + 1:
                                body.find("\n", m.end())]
                    if excused(rel, ledger):
                        continue
                    if TYPE_ONLY.search(line):
                        soft.append(f'{rel}: 型だけの依存（{line.strip()[:60]}）')
                        continue
                    bad.append(f'{c.get("id")}: {os.path.relpath(f, root)} が関門を通らずに直接呼んでいる')
            except OSError:
                pass
    return bad, soft


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project-root", default=".")
    ap.add_argument("--map", default="spec-dependencies.yaml")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--with-tests", action="store_true",
                    help="テストのファイルも関門の検査に含める（既定は対象外）")
    a = ap.parse_args()
    root = os.path.abspath(a.project_root)
    M = yaml.safe_load(open(os.path.join(root, a.map), encoding="utf-8")) or {}
    defer = tuple(DEFER) + tuple(M.get("tier_blocked_words") or [])
    sec = M.get("choke_points")
    fails, warns, rows = [], [], []

    if not sec:
        fails.append("H: spec-dependencies.yaml に choke_points が無い"
                     "（外界に影響する経路を誰も見張っていない）")
        cps = []
    else:
        cf = os.path.join(root, sec.get("file") or "")
        if not sec.get("file"):
            fails.append("H: choke_points.file（関門の正本）が書かれていない"); cps = []
        elif not os.path.exists(cf):
            fails.append(f"H-4: 関門の正本 {sec['file']} が実在しない"); cps = []
        else:
            C = json.load(open(cf, encoding="utf-8"))
            cps = C.get("choke_points") or []
            got = {c.get("id"): c for c in cps}
            for cid, name in STD.items():
                c = got.get(cid)
                if not c:
                    fails.append(f"H-4: 標準の関門 {cid}（{name}）が定義されていない")
                    continue
                miss = [k for k in NEED if not c.get(k)]
                if not c.get("source"):
                    miss.append("source")
                rows.append({"check": "H-4", "target": f"{cid} {name}",
                             "status": "ok" if not miss else "ng"})
                if miss:
                    fails.append(f"H-4: {cid}（{name}）に {miss} が無い")
            for c in cps:
                if c.get("id") not in STD:
                    miss = [k for k in NEED if not c.get(k)]
                    rows.append({"check": "H-4", "target": f'{c.get("id")} 固有',
                                 "status": "ok" if not miss else "ng"})
                    if miss:
                        fails.append(f'H-4: 固有の関門 {c.get("id")} に {miss} が無い')

        ex = sec.get("exceptions")
        if not ex:
            fails.append("H-3: 例外台帳（exceptions）が書かれていない")
        elif not os.path.exists(os.path.join(root, ex)):
            fails.append(f"H-3: 例外台帳 {ex} が実在しない（空でよいので置く）")
        else:
            rows.append({"check": "H-3", "target": ex, "status": "ok"})

        files = app_files(root, cps)
        for ck in sec.get("checks") or []:
            cid, note = ck.get("id", "?"), str(ck.get("note", ""))
            if cid in ("H-3", "H-4"):
                continue
            if not files:
                if any(w in note for w in defer):
                    warns.append(f"{cid}: 関門が宣言した置き場にまだ実装が無いので"
                                 f"走らせていない（理由: {note}）")
                    rows.append({"check": cid, "target": ck.get("kind", ""), "status": "blocked"})
                else:
                    fails.append(f"{cid}: 走らせていないのに理由が書かれていない")
                continue
            if ck.get("kind") == "bypass_detection":
                led, exp = read_ledger(root, sec.get("exceptions"))
                bad, soft = scan_bypass(root, cps, files, a.with_tests, led)
                fails += [f"H-3 期限切れの例外: {x}" for x in exp]
                warns += [f"H-1 型だけの依存（関門の迂回ではない）: {x}" for x in soft]
                rows.append({"check": cid, "target": f'{ck.get("kind")}（{len(files)} ファイル）',
                             "status": "ok" if not bad else "ng"})
                fails += [f"{cid}: {x}" for x in bad]
            elif ck.get("kind") == "no_dynamic_call":
                rx = re.compile(r"\beval\s*\(|new Function\s*\(|import\s*\(\s*[`\"']?\s*\$")
                bad = [os.path.relpath(f, root) for f in files
                       if rx.search(open(f, encoding="utf-8", errors="ignore").read())]
                rows.append({"check": cid, "target": f'{ck.get("kind")}（{len(files)} ファイル）',
                             "status": "ok" if not bad else "ng"})
                fails += [f"{cid}: 動的呼び出し {x}（これを許すと H-1 が破れる）" for x in bad]
            else:
                if any(w in note for w in defer):
                    warns.append(f"{cid}: 検査がまだ用意できていない（理由: {note}）")
                    rows.append({"check": cid, "target": ck.get("kind", ""), "status": "blocked"})
                else:
                    fails.append(f"{cid}: 実装があるのに検査が用意されていない")

    out = {"tier": "H", "status": "pass" if not fails else "fail",
           "choke_points": len(cps), "checks": rows, "failures": fails, "warnings": warns}
    if a.json:
        print(json.dumps(out, ensure_ascii=False, indent=1)); return 0 if not fails else 2
    print(f"Tier H 関門 — 関門 {len(cps)} 本 / 検査 {len(rows)} 件")
    for r in rows:
        print(f'  {"OK" if r["status"]=="ok" else ("--" if r["status"]=="blocked" else "★")} '
              f'{r["check"]:<4} {r["target"]}')
    for w in warns:
        print("  warn", w)
    if fails:
        print(f"\nFAIL — {len(fails)} 件")
        for f in fails:
            print("  ★", f)
        return 2
    print("\nPASS — H（走らせていない検査は warn に残している）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
