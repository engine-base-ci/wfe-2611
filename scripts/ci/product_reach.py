#!/usr/bin/env python3
"""T11 道具どまりの文 ── 決めたことが「文書」にしか届いていないものを出す。

由来（2026-09-25・Atelier からの共有 K12）：
  トレーサビリティの検査は「自分で書いた反映先に届いたか」しか見ない。
  だから反映先を文書だけにすれば、製品に 1 文も出ていなくても全ゲートが緑になる。
  → 製品の層（画面・もの・表・機能・API・チケット）に 1 文も出ていない confirmed の文を出す。

逃げ道は 2 つだけ：製品にも出す／`product-reach-exempt.json` に理由を書く。
"""
from __future__ import annotations
import argparse, importlib.util, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("tg", os.path.join(HERE, "trace_gate.py"))
tg = importlib.util.module_from_spec(spec); spec.loader.exec_module(tg)

# 製品の層＝人が触るもの・保存されるもの。文書（設計書・要件一覧・サマリー）は「説明」であって製品ではない
PRODUCT = re.compile(r"(06_mockup/|flow\.json|screens\.json|entities\.json|features\.json|ER図\.md|openapi|tickets\.json|errors\.json|catalog\.json|SKILL\.md)")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="spec-dependencies.yaml")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    cfg = tg.load_config(a.config) if hasattr(tg, "load_config") else None
    if cfg is None:
        import yaml
        cfg = yaml.safe_load(open(a.config, encoding="utf-8"))["decision_traceability"]
    D = tg.load_decisions(cfg); D.pop("_missing", None)
    elems, _ = tg.load_products(cfg)
    exempt = {}
    ep = os.path.join(os.path.dirname(a.config) or ".", "product-reach-exempt.json")
    if os.path.exists(ep):
        exempt = {k: v for k, v in json.load(open(ep, encoding="utf-8")).items() if not k.startswith("_")}

    where: dict[str, set[str]] = {}
    for e in elems:
        for s in e["source"] or []:
            where.setdefault(str(s), set()).add(e["file"])

    tool_only, nowhere = [], []
    for sec, d in D.items():
        if d["status"] != "confirmed":
            continue
        for n, title in d["clauses"]:
            cid = f"{d['id']}.{n}"
            if cid in exempt or str(n) in (d.get("clauses_out") or {}):
                continue
            files = where.get(cid, set())
            if not files:
                nowhere.append((cid, title))
            elif not any(PRODUCT.search(f) for f in files):
                tool_only.append((cid, title, sorted({os.path.basename(f) for f in files})[:3]))

    if a.json:
        print(json.dumps({"tool_only": [{"clause": c, "title": t, "files": f} for c, t, f in tool_only],
                          "nowhere": [{"clause": c, "title": t} for c, t in nowhere],
                          "exempt": len(exempt)}, ensure_ascii=False, indent=2))
    else:
        print(f"T11 道具どまりの文（製品の層に 1 文も出ていない）: {len(tool_only)} 件")
        for c, t, f in tool_only[:15]:
            print(f"  {c}  {t[:38]}  → {'・'.join(f)}")
        if len(tool_only) > 15:
            print(f"  …ほか {len(tool_only) - 15} 件")
        print(f"どこにも出ていない文: {len(nowhere)} 件（T8 が見る）／ 理由つきの例外: {len(exempt)} 件")
        print("PASS" if not tool_only else f"不合格 {len(tool_only)} 件（製品にも出すか、product-reach-exempt.json に理由を書く）")
    return 0 if not tool_only else 1


if __name__ == "__main__":
    sys.exit(main())
