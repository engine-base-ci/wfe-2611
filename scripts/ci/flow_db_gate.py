#!/usr/bin/env python3
"""利用者の流れ（05_flow/flows.json）と DB の表の目録（03_architecture/db-catalog.json）の検査（D-128.126・D-128.127）。

  python3 scripts/ci/flow_db_gate.py              検査する
  python3 scripts/ci/flow_db_gate.py --init       目録が無いときだけ、今の migration と契約から最初の目録を書く（以後は記録として持つ）
  python3 scripts/ci/flow_db_gate.py --selftest   わざと壊した形を赤にできるか

赤になるもの:
  FD1 第1フェーズの行為（flow.json の release v1）が、どの流れにも入っていない・2 つの流れに入っている・流れに知らない行為がある
  FD2 migration で作った表が目録に無い（新しい表は、骨格・中で使う・凍結のどれかを決めて目録に書く）。目録の表が migration に無い
  FD3 凍結した表（後のフェーズ・D-128.127）を、コード（apps/*/src・packages/*/src。試験・migration は除く）が使い始めた。
      使うなら、その流れで形を確かめ直し、決めてもらってから目録で「骨格」か「中で使う」に移す
  FD4 目録の区分が決まりの外（skeleton・internal・frozen の 3 つだけ）・理由が無い
知らせるだけ（赤にしない）:
  骨格の表を、第1フェーズの口がもう使っていない（凍結に移すか確かめる）
"""
from __future__ import annotations
import glob, json, os, re, shutil, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CLASSES = {"skeleton": "第1フェーズの骨格（第1フェーズの口が使う）",
           "internal": "中で使う（口は無いが、認証・Bridge・記録などのコードが使う）",
           "frozen": "凍結（後のフェーズ用に先に作ってあった表・今は使わない・D-128.127）"}
SRC_GLOBS = ["apps/*/src/**/*.ts", "apps/*/src/**/*.tsx", "packages/*/src/**/*.ts"]
NOTES: list[str] = []


def p(*a: str) -> str:
    return os.path.join(ROOT, *a)


def migration_tables(root: str) -> set[str]:
    made, dropped = set(), set()
    for f in sorted(glob.glob(os.path.join(root, "packages/db/migrations/*.sql"))):
        s = open(f, encoding="utf-8").read().lower()
        made |= set(re.findall(r'create table (?:if not exists )?(?:app\.)?"?(\w+)', s))
        dropped |= set(re.findall(r'drop table (?:if exists )?(?:app\.)?"?(\w+)', s))
    return made - dropped


def src_refs(root: str) -> dict[str, set[str]]:
    """コードが使っている表 → 使っているファイル（試験・migration・dist は見ない）。
    packages/db/src/repository.ts の「全部の表の一覧」に名前があるだけでは使っているとみなさない（一覧は会社ごとの守りの対象を並べたもの）"""
    out: dict[str, set[str]] = {}
    for g in SRC_GLOBS:
        for f in glob.glob(os.path.join(root, g), recursive=True):
            rel = os.path.relpath(f, root)
            if "/test/" in rel or ".test." in rel or "/migrations/" in rel or "/dist/" in rel:
                continue
            s = open(f, encoding="utf-8", errors="ignore").read()
            found = set(re.findall(r"\bapp\.([a-z_]+)\b", s))                                   # SQL の app.<表>
            found |= set(re.findall(r"""\.table\(\s*["'`]([a-z_]+)["'`]""", s))                    # repo.table("<表>")
            found |= set(re.findall(r"""schemaName:\s*["'`]([a-z_]+)["'`]""", s))                   # 認証の部品の schema
            found |= set(re.findall(r"(?i)\b(?:from|into|update|join)\s+([a-z_]+)\b", s))          # 素の SQL
            if rel == "packages/db/src/seeds.ts":                                                    # 元データの種
                found |= set(re.findall(r"""["'`]([a-z_]+)["'`]""", s))
            for t in found:
                out.setdefault(t, set()).add(rel)
    return out


def v1_acts(root: str) -> set[str]:
    f = json.load(open(os.path.join(root, "05_flow/flow.json"), encoding="utf-8"))
    return {a["id"] for ph in f["backbone"] for a in ph["acts"] if a.get("release") == "v1"}


def api_tables(root: str, acts: set[str]) -> set[str]:
    out = set()
    for e in json.load(open(os.path.join(root, "08_api/endpoints.json"), encoding="utf-8"))["endpoints"]:
        if not set(e.get("acts") or []) & acts:
            continue
        t = e.get("table")
        out |= set(t if isinstance(t, list) else ([t] if t else []))
    return out


def check_flows(flows: dict, acts: set[str]) -> list[str]:
    seen: dict[str, str] = {}
    fails = []
    for fl in flows["flows"]:
        for a in fl["acts"]:
            if a in seen:
                fails.append(f"FD1 行為 {a} が 2 つの流れ（{seen[a]}・{fl['id']}）に入っている")
            seen[a] = fl["id"]
            if a not in acts:
                fails.append(f"FD1 流れ {fl['id']} の行為 {a} は第1フェーズの行為に無い（flow.json と合わせる）")
    fails += [f"FD1 第1フェーズの行為 {a} がどの流れにも入っていない（05_flow/flows.json に足す）" for a in sorted(acts - set(seen))]
    if set(flows.get("order") or []) != {f["id"] for f in flows["flows"]}:
        fails.append("FD1 流れの順番（order）が流れの一覧と合わない")
    return fails


def check_catalog(cat: dict, tables: set[str], refs: dict[str, set[str]], used: set[str]) -> list[str]:
    T = cat.get("tables") or {}
    fails = [f"FD2 migration の表 {t} が目録に無い（骨格・中で使う・凍結のどれかを決めて書く）" for t in sorted(tables - set(T))]
    fails += [f"FD2 目録の表 {t} が migration に無い（目録から外す）" for t in sorted(set(T) - tables)]
    for t, v in sorted(T.items()):
        if v.get("class") not in CLASSES or not v.get("why"):
            fails.append(f"FD4 目録の表 {t} の区分が決まりの外か、理由が無い（{v}）")
        if v.get("class") == "frozen" and t in refs:
            fails.append(f"FD3 凍結した表 {t} をコードが使っている（{sorted(refs[t])[:3]}）。使うなら決めてもらって区分を移す（D-128.127）")
        if v.get("class") == "skeleton" and t not in used:
            NOTES.append(f"骨格の表 {t} を、第1フェーズの口がもう使っていない（凍結に移すか確かめる）")
    return fails


def init(root: str) -> dict:
    tables, refs = migration_tables(root), src_refs(root)
    used = api_tables(root, v1_acts(root))
    T = {}
    for t in sorted(tables):
        if t in used:
            T[t] = {"class": "skeleton", "why": "第1フェーズの口が使う（08_api/endpoints.json）"}
        elif t in refs:
            T[t] = {"class": "internal", "why": f"口は無いがコードが使う（{sorted(refs[t])[0]} ほか）"}
        else:
            T[t] = {"class": "frozen", "why": "どの口もコードも使わない。後のフェーズ用に先に作ってあった表（D-128.127）"}
    return {"_doc": "DB の表の目録（D-128.127）。表はどれも 骨格（skeleton）・中で使う（internal）・凍結（frozen）のどれか。"
                    "凍結の表は消さずに残し、コードが使い始めたら scripts/ci/flow_db_gate.py の FD3 で赤。新しい表は区分を決めてここに足す",
            "classes": CLASSES, "source": ["D-128.127"], "tables": T}


def main() -> int:
    if "--selftest" in sys.argv:
        acts = {"A1", "A2", "A3"}
        fl = {"order": ["F1"], "flows": [{"id": "F1", "acts": ["A1", "A2", "A2", "A9"]}]}
        r1 = check_flows(fl, acts)
        ok1 = any("A3" in f for f in r1) and any("2 つの流れ" in f for f in r1) and any("A9" in f for f in r1)
        cat = {"tables": {"a": {"class": "frozen", "why": "x"}, "b": {"class": "skeleton", "why": "y"}, "gone": {"class": "frozen", "why": "z"}, "c": {"class": "odd"}}}
        r2 = check_catalog(cat, {"a", "b", "c", "newt"}, {"a": {"apps/api/src/x.ts"}}, {"b"})
        ok2 = all(any(k in f for f in r2) for k in ("FD3 凍結した表 a", "newt", "gone", "FD4 目録の表 c"))
        ok = ok1 and ok2
        print("PASS — 流れの漏れ・重なり・知らない行為、目録に無い表・消えた表・凍結の表を使うコード・区分の誤りを見つけた" if ok else f"FAIL — 見つけられない（流れ {ok1}・目録 {ok2}）")
        return 0 if ok else 1
    cpath = p("03_architecture/db-catalog.json")
    if "--init" in sys.argv:
        if os.path.exists(cpath):
            print("目録はもうある（記録として持つ。作り直さない）")
            return 1
        json.dump(init(ROOT), open(cpath, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        open(cpath, "a").write("\n")
        print(f"書いた: {cpath}")
        return 0
    acts = v1_acts(ROOT)
    flows = json.load(open(p("05_flow/flows.json"), encoding="utf-8"))
    cat = json.load(open(cpath, encoding="utf-8"))
    tables, refs = migration_tables(ROOT), src_refs(ROOT)
    fails = check_flows(flows, acts) + check_catalog(cat, tables, refs, api_tables(ROOT, acts))
    c = {k: sum(1 for v in cat["tables"].values() if v.get("class") == k) for k in CLASSES}
    for n in NOTES:
        print("  note", n)
    for f in fails:
        print("  ★", f)
    print(f"流れ {len(flows['flows'])}・第1フェーズの行為 {len(acts)} ／ 表 {len(tables)}（骨格 {c['skeleton']}・中で使う {c['internal']}・凍結 {c['frozen']}）")
    print("FAIL — 流れか DB の目録が合わない" if fails else "PASS — 行為はどれも 1 つの流れに入り、表はどれも目録にあり、凍結の表をコードが使っていない")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
