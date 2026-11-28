#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tier G — 基盤依存の境界（dependency boundaries）の機械検査。

 SKILL.md の STEP 5 は「G は 4 検査（import 境界 / ベンダー固有 SQL / ライセンス境界 / 台帳整合）」
 と書いていたが、スクリプトはどこにも無かった（2026-09-17 の棚卸しで判明）。ここで実装する。

 検査
   G1 宣言   spec-dependencies.yaml に dependency_boundaries があり、正本のファイルを指しているか
   G2 実在   その正本（dependency-boundaries.json）と台帳が実在するか
   G3 根拠   各境界に source（決定 ID）があるか
   G4 迂回   code_root に実装があるなら、境界の外から禁止 API を呼んでいないか

 まだ実装が無い段階では G4 は走れない。走れないものを緑にしない：
 その検査に理由（note）が書いてあれば **blocked（warn）**、書いていなければ **FAIL**。
 「省いた検査」と「通った検査」を同じ緑にしないのが、このスクリプトの一番の仕事（L-012）。
"""
from __future__ import annotations
import argparse, glob, json, os, re, sys

try:
    import yaml
except ImportError:
    print("FAIL — PyYAML が要ります"); sys.exit(2)

CODE_EXT = (".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".kt", ".swift")
# 「まだ走らせられない理由」と読む語。依存マップの tier_blocked_words: で足せる
DEFER = ("実装開始後", "未着手", "実装後", "まだ", "後で有効化", "not yet", "after implementation")


def app_files(root: str, bl) -> list:
    """境界が宣言した置き場（allowed_paths）にある実装ファイルだけを数える。

    ここを「.py が 1 つでもあれば実装あり」にすると、モックのビルド用スクリプトや
    治具を数えて、何も検査していないのに G4 が緑になる。それは このスクリプトが
    無くそうとしている偽の緑そのもの（L-012）。
    """
    paths = set()
    for b in bl:
        for ap_ in (b.get("allowed_paths") or []):
            paths.add(ap_)
    out = []
    for ap_ in sorted(paths):
        base = os.path.join(root, ap_)
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
        hits = re.findall(r"[\w./-]+/[\w./-]+\.[a-z]{2,4}|[\w-]+/(?=[\s|])", ln)
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


def scan_bypass(root: str, bl, files, with_tests: bool = False, ledger: set | None = None) -> list:
    """境界の外から禁止 import を呼んでいないか、実ファイルを読んで探す。"""
    bad, soft = [], []
    ledger = ledger or set()
    for b in bl:
        pats = b.get("forbidden_import_patterns") or []
        allow = tuple(os.path.join(root, a) for a in (b.get("allowed_paths") or []))
        rx = build_matcher(pats)
        if rx is None:
            continue
        for f in files:
            if f.startswith(allow):
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
                    bad.append(f'{b.get("id")}: {os.path.relpath(f, root)} が境界の外から '
                               f'{b.get("vendor")} を直接呼んでいる')
            except OSError:
                pass
    return bad, soft


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project-root", default=".")
    ap.add_argument("--map", default="spec-dependencies.yaml")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--with-tests", action="store_true",
                    help="テストのファイルも境界の検査に含める（既定は対象外）")
    a = ap.parse_args()
    root = os.path.abspath(a.project_root)
    M = yaml.safe_load(open(os.path.join(root, a.map), encoding="utf-8")) or {}
    defer = tuple(DEFER) + tuple(M.get("tier_blocked_words") or [])
    sec = M.get("dependency_boundaries")
    fails, warns, rows = [], [], []

    if not sec:
        fails.append("G1: spec-dependencies.yaml に dependency_boundaries が無い"
                     "（基盤を替えるときに依存箇所を探す羽目になる）")
    else:
        for key, label in (("file", "境界の正本"), ("ledger", "越境の台帳")):
            p = sec.get(key)
            if not p:
                fails.append(f"G1: dependency_boundaries.{key}（{label}）が書かれていない")
            elif not os.path.exists(os.path.join(root, p)):
                fails.append(f"G2: {label} {p} が実在しない")
            else:
                rows.append({"check": "G2", "target": p, "status": "ok"})

        bl = []
        bf = os.path.join(root, sec.get("file") or "")
        if os.path.exists(bf) and bf.endswith(".json"):
            try:
                B = json.load(open(bf, encoding="utf-8"))
                bl = B.get("boundaries") or B.get("dependency_boundaries") or []
                nosrc = [b.get("id") or b.get("name") for b in bl if not b.get("source")]
                rows.append({"check": "G3", "target": "boundaries", "status": "ok" if not nosrc else "ng",
                             "n": len(bl)})
                if nosrc:
                    fails.append(f"G3: source の無い境界 {nosrc}")
            except Exception as e:
                fails.append(f"G2: {sec.get('file')} が読めない（{e}）")

        files = app_files(root, bl) if bl else []
        for ck in sec.get("checks") or []:
            kind, note = ck.get("kind", "?"), str(ck.get("note", ""))
            if not files:
                if any(w in note for w in defer):
                    warns.append(f"G4 {kind}: 境界が宣言した置き場にまだ実装が無いので"
                                 f"走らせていない（理由: {note}）")
                    rows.append({"check": "G4", "target": kind, "status": "blocked"})
                else:
                    fails.append(f"G4 {kind}: 走らせていないのに理由が書かれていない")
                continue
            if kind == "import_boundary":
                led, exp = read_ledger(root, sec.get("ledger"))
                bad, soft = scan_bypass(root, bl, files, a.with_tests, led)
                fails += [f"G4 期限切れの例外: {x}" for x in exp]
                warns += [f"G4 型だけの依存（越境ではないが、差し替えのとき直す）: {x}"
                          for x in soft]
                rows.append({"check": "G4",
                             "target": f"{kind}（{len(files)} ファイル"
                                       f"{'' if a.with_tests else '・テスト除く'}）",
                             "status": "ok" if not bad else "ng"})
                fails += [f"G4 {kind}: {x}" for x in bad]
            elif ck.get("command"):
                # command で書いた検査（Kaname の書き方・K-34）：走らせ、終わりのコードで判定する
                import subprocess as _sp
                r = _sp.run(ck["command"], shell=True, cwd=root, capture_output=True, text=True)
                rows.append({"check": "G4", "target": kind, "status": "ok" if r.returncode == 0 else "ng"})
                if r.returncode:
                    last = ((r.stdout or "") + (r.stderr or "")).strip().splitlines()[-1:] or [""]
                    fails.append(f"G4 {kind}: 検査が赤（{ck['command']}・{last[0][:120]}）")
            else:
                # 実装があるのに検査の中身が無いものを緑にしない
                if any(w in note for w in defer):
                    warns.append(f"G4 {kind}: 検査がまだ用意できていない（理由: {note}）")
                    rows.append({"check": "G4", "target": kind, "status": "blocked"})
                else:
                    fails.append(f"G4 {kind}: 実装があるのに検査が用意されていない")

    out = {"tier": "G", "status": "pass" if not fails else "fail",
           "checks": rows, "failures": fails, "warnings": warns}
    if a.json:
        print(json.dumps(out, ensure_ascii=False, indent=1)); return 0 if not fails else 2
    print(f"Tier G 基盤依存の境界 — 検査 {len(rows)} 件")
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
    print("\nPASS — G（走らせていない検査は warn に残している）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
