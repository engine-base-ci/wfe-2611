#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ユーザーの言葉検査 ── 画面に見える文字列に、設計者の言葉・内部IDが混ざっていないかを機械で見る。

 由来（2026-09-10）：「担う行為 A30／根拠 D-024」「木」「関門 C1/C6」「goal_id」「push/pull」が顧客向けの画面に出ていた。
 既定の禁止語は ui-lint.default.json。プロジェクトは ui-lint.json で追加・除外できる。

使い方: python3 ui_lint.py <モックのフォルダ> [--config ui-lint.json]
  ui-lint.json = {"patterns":[製品固有の設計者語の正規表現…], "allow":[許す文脈…], "remove":[既定から外す…]}
"""
import argparse, glob, json, os, re, sys
# 既定＝どのプロジェクトでも「顧客に見せない」もの：導出物のID・共通規約の用語・実装の語。
# 製品固有の設計者語（その製品で使った内部の言い回し）は、プロジェクトの ui-lint.json の patterns に足す。
DEFAULT = {
  "patterns": [
    r"\b[APRJ]\d{1,2}\b",      # 行為・フェーズ・役割・用事のID（screen-derivation）
    r"\bD-\d{3}\b",            # 決定ID（decision-traceability）
    r"\bC[1-8]\b", r"関門",     # 関門ID・関門（choke-points）
    r"\bR[1-6]\b", r"担う行為", r"見える役割", r"根拠（決定",
    r"blueprint", r"ブループリント", r"data-", r"jsonb", r"\benum\b", r"\bnull\b", r"\bID\b(?!/PW)"
  ],
  "allow": []
}
def visible_text(t):
    t = re.sub(r'<!--.*?-->', '', t, flags=re.S); t = re.sub(r'<script>.*?</script>', '', t, flags=re.S); t = re.sub(r'<style>.*?</style>', '', t, flags=re.S)
    t = re.sub(r'<[^>]+>', ' ', t); return re.sub(r'&[a-z]+;', ' ', t)
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("dir"); ap.add_argument("--config"); a = ap.parse_args()
    cfg = dict(DEFAULT)
    if a.config and os.path.exists(a.config):
        c = json.load(open(a.config, encoding="utf-8")); cfg["patterns"] = cfg["patterns"] + c.get("patterns", []); cfg["allow"] = cfg["allow"] + c.get("allow", [])
        for x in c.get("remove", []): cfg["patterns"] = [p for p in cfg["patterns"] if p != x]
    bad = {}
    for f in sorted(glob.glob(os.path.join(a.dir, "*.html"))):
        if "index" in f or os.path.basename(f).startswith(("measure","ly","st")): continue
        t = visible_text(open(f, encoding="utf-8").read())
        hits = set()
        for p in cfg["patterns"]:
            for m in re.finditer(p, t):
                ctx = t[max(0, m.start()-10): m.end()+10].replace("\n", " ")
                if any(re.search(al, ctx) for al in cfg["allow"]) and not re.search(r"\b[APRJ]\d{1,2}\b|\bD-\d{3}\b", m.group(0)): continue
                hits.add(f"{m.group(0)} ←「…{ctx.strip()}…」")
        if hits: bad[os.path.basename(f)] = sorted(hits)[:6]
    if bad:
        print(f"FAIL — 設計者の言葉・内部IDが画面に見えている: {len(bad)} ファイル")
        for f, h in bad.items():
            print(f"  {f}"); [print("      -", x) for x in h]
        return 1
    print("PASS — 画面に見える文字列に設計者の言葉・内部IDは無い"); return 0
if __name__ == "__main__": sys.exit(main())
