#!/usr/bin/env python3
"""目録の作り手（D-128.125・D-128.129）。同じものを 2 つ作らないために、今あるもの（作ったもの・契約だけのもの）を実物から集める。

  python3 scripts/ci/build_catalog.py      03_architecture/catalog.json と catalog.md を作り直す（生成物・G38 が最新かを見る）

集めるもの（どれも「何をするものか・どの流れが使うか・作ったか契約だけか・持ち主のチケット」を持つ）:
  api      契約の口（08_api/endpoints.json）。作った＝契約の口の振る舞い（apps/api/src/hooks）がある。前の道すじ（契約の外・apps/api/src/auth/ext.ts）も並べる
  db       表（03_architecture/db-catalog.json の区分と、03_architecture/flow-lines.json の書く流れ・読む流れ）
  ui       新しい画面の部品（apps/web/components/k/index.ts が出すもの）
  common   共通の処理（packages/* の入口と、その先頭の説明）・入口の前の処理（apps/api/src/middleware）・エラーの正本の件数
  external 外とのつなぎ（技術の選定の部品）と設定の項目（.env.example の名前と説明。値は載せない）
チケットを切るときは、まずここを探し、使えるなら依存として書き、無いときだけ作る（D-128.125）。
"""
from __future__ import annotations
import glob, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding="utf-8"))


def head_comment(path: str) -> str:
    try:
        for ln in open(path, encoding="utf-8").read().splitlines()[:5]:
            m = re.match(r"\s*(?://|\*|/\*\*?)\s*(.+)", ln)
            if m and m.group(1).strip():
                return re.sub(r"\s*\*/\s*$", "", m.group(1).strip())[:160]
    except FileNotFoundError:
        pass
    return ""


def build() -> dict:
    flows = J("05_flow/flows.json")
    a2f = {a: f["id"] for f in flows["flows"] for a in f["acts"]}
    built = set()
    for f in glob.glob(os.path.join(ROOT, "apps/api/src/hooks/*.ts")):
        built |= set(re.findall(r"^\s{4}(\w+): \{", open(f, encoding="utf-8").read(), re.M))
    owners: dict[str, list[str]] = {}
    for t in J("11_tickets/tickets.json")["tickets"]:
        for op in t.get("apis") or []:
            owners.setdefault(op, []).append(t["id"])
    api = []
    for e in J("08_api/endpoints.json")["endpoints"]:
        op = e.get("operation_id")
        tb = e.get("table")
        api.append({"op": op, "method": e["method"], "path": e["path"],
                    "what": (e.get("description") or "").split("\n")[0][:120],
                    "flows": sorted({a2f[a] for a in e.get("acts") or [] if a in a2f}),
                    "only_later_phase": not any(a in a2f for a in e.get("acts") or []),
                    "tables": tb if isinstance(tb, list) else ([tb] if tb else []),
                    "status": "作った" if op in built else "契約だけ（501）",
                    "owner_tickets": owners.get(op, [])})
    legacy = sorted(set(re.findall(r'app\.(?:get|post|put|patch|delete)\("([^"]+)"',
                                   open(os.path.join(ROOT, "apps/api/src/auth/ext.ts"), encoding="utf-8").read())))
    cat = J("03_architecture/db-catalog.json")["tables"]
    lines = J("03_architecture/flow-lines.json")["tables"]
    db = [{"table": t, "class": v["class"], "why": v["why"],
           "writes": (lines.get(t) or {}).get("writes", []), "reads": (lines.get(t) or {}).get("reads", []),
           "boundary": bool((lines.get(t) or {}).get("boundary"))} for t, v in sorted(cat.items())]
    ui = []
    idx = os.path.join(ROOT, "apps/web/components/k/index.ts")
    for m in re.finditer(r'export \{([^}]+)\} from "\./([\w-]+)"', open(idx, encoding="utf-8").read()):
        names = [n.strip() for n in m.group(1).split(",") if n.strip() and not n.strip().startswith("type ")]
        f = next(iter(glob.glob(os.path.join(ROOT, f"apps/web/components/k/{m.group(2)}.ts*"))), "")
        ui.append({"file": f"apps/web/components/k/{m.group(2)}", "exports": names, "what": head_comment(f) if f else ""})
    common = []
    for p in sorted(glob.glob(os.path.join(ROOT, "packages/*/"))):
        n = os.path.basename(p.rstrip("/"))
        src = os.path.join(p, "src/index.ts")
        common.append({"package": f"@kaname/{n}", "what": head_comment(src)})
    middleware = [{"file": os.path.relpath(f, ROOT), "what": head_comment(f)}
                  for f in sorted(glob.glob(os.path.join(ROOT, "apps/api/src/middleware/*.ts"))) if ".test." not in f]
    errors = len(J("07_qa/test-specs/errors.json").get("errors", []))
    stack = [{"package": k, "for": v.get("for", "")} for k, v in J("02_tech_stack/selected-stack.json")["packages"].items()
             if not k.startswith("_") and isinstance(v, dict)]
    env, note = [], ""
    for ln in open(os.path.join(ROOT, ".env.example"), encoding="utf-8").read().splitlines():
        if ln.startswith("#"):
            note = ln.lstrip("# ").strip()[:120]
            continue
        m = re.match(r"([A-Z][A-Z0-9_]*)=", ln)
        if m:
            env.append({"name": m.group(1), "what": note})
        note = "" if not ln.strip() else note
    return {"_doc": "生成物（scripts/ci/build_catalog.py）。手で直さない。チケットを切るときは、まずここを探す（D-128.125・D-128.129）",
            "source": ["D-128.125", "D-128.129"],
            "counts": {"api": len(api), "api_built": sum(1 for a in api if a["status"] == "作った"),
                       "api_only_later_phase": sum(1 for a in api if a["only_later_phase"]),
                       "legacy_routes": len(legacy), "db": len(db), "ui": len(ui), "packages": len(common),
                       "errors": errors, "stack": len(stack), "env": len(env)},
            "api": api, "legacy_routes": legacy, "db": db, "ui": ui,
            "common": {"packages": common, "middleware": middleware, "errors_catalog": "07_qa/test-specs/errors.json"},
            "external": {"stack": stack, "env": env}}


def md(c: dict) -> str:
    n = c["counts"]
    L = ["# 目録", "", "> 生成物（`python3 scripts/ci/build_catalog.py`）。手で直さない。チケットを切るときは、まずここを探す。"
         "使えるなら依存として書き、無いときだけ作る（D-128.125・D-128.129）。", "",
         f"API {n['api']}（作った {n['api_built']}・後のフェーズの行為だけ {n['api_only_later_phase']}）・前の道すじ {n['legacy_routes']}・"
         f"表 {n['db']}・画面の部品 {n['ui']}・共通の処理 {n['packages']}・エラー {n['errors']}・部品 {n['stack']}・設定 {n['env']}", "",
         "## 共通の処理", "", "| パッケージ | 何をするか |", "|---|---|"]
    L += [f"| `{p['package']}` | {p['what']} |" for p in c["common"]["packages"]]
    L += ["", "## 画面の部品", "", "| ファイル | 出すもの | 何をするか |", "|---|---|---|"]
    L += [f"| `{u['file']}` | {', '.join(u['exports'])} | {u['what']} |" for u in c["ui"]]
    L += ["", "## DB の表（境目と骨格）", "", "| 表 | 区分 | 書く流れ | 読む流れ | 境目 |", "|---|---|---|---|---|"]
    L += [f"| `{d['table']}` | {d['class']} | {','.join(d['writes'])} | {','.join(d['reads'])} | {'○' if d['boundary'] else ''} |"
          for d in c["db"] if d["class"] != "frozen"]
    L += ["", f"凍結の表（{sum(1 for d in c['db'] if d['class'] == 'frozen')}）：" + "・".join(f"`{d['table']}`" for d in c["db"] if d["class"] == "frozen"), ""]
    L += ["## API の口", "", "| 口 | 道 | 何をするか | 流れ | 状態 | 持ち主のチケット |", "|---|---|---|---|---|---|"]
    L += [f"| `{a['op']}` | {a['method']} {a['path']} | {a['what']} | {','.join(a['flows']) or '（後のフェーズ）'} | {a['status']} | {','.join(a['owner_tickets'])} |"
          for a in sorted(c["api"], key=lambda a: (a["flows"][:1] or ["Z"], a["path"]))]
    L += ["", "## 前の道すじ（契約の外・apps/api/src/auth/ext.ts）", ""] + [f"- `{r}`" for r in c["legacy_routes"]]
    L += ["", "## 設定の項目（値は載せない）", "", "| 名前 | 説明 |", "|---|---|"]
    L += [f"| `{e['name']}` | {e['what']} |" for e in c["external"]["env"]]
    L += ["", "## 使っている部品", "", "| 部品 | 何に使うか |", "|---|---|"]
    L += [f"| `{s['package']}` | {s['for']} |" for s in c["external"]["stack"]]
    return "\n".join(L).replace("\n\n\n", "\n\n") + "\n"


if __name__ == "__main__":
    c = build()
    json.dump(c, open(os.path.join(ROOT, "03_architecture/catalog.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    open(os.path.join(ROOT, "03_architecture/catalog.json"), "a").write("\n")
    open(os.path.join(ROOT, "03_architecture/catalog.md"), "w", encoding="utf-8").write(md(c))
    print("目録を書いた:", json.dumps(c["counts"], ensure_ascii=False))
