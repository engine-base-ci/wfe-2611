#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""flow.json の双方向ゲート（.claude/rules/common/screen-derivation.md §4 の正本実装）

 「画面は行為から導出する」を人の注意ではなく機械で守る。
 G1〜G10 のどれか1つでも落ちたら exit 1。ui-mockup はこれが緑になるまで起動できない。

使い方:
  python3 flow_gate.py                          # flow.json を探して全検査（G9 は skip）
  python3 flow_gate.py --flow 05_flow/flow.json --mocks 06_mockup/v1 --choke 03_architecture/choke-points.json
  python3 flow_gate.py --json                   # 結果を JSON で出す（CI 用）
"""
import re, json, os, sys, glob, argparse

def find(default_names):
    for n in default_names:
        hits = glob.glob(n, recursive=True)
        if hits: return hits[0]
    return None

def load(p):
    with open(p, encoding="utf-8") as f: return json.load(f)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--flow"); ap.add_argument("--mocks"); ap.add_argument("--choke")
    ap.add_argument("--json", action="store_true"); ap.add_argument("--min-purpose", type=int, default=15)
    a = ap.parse_args()

    flow_path = a.flow or find(["flow.json", "**/flow.json"])
    if not flow_path or not os.path.exists(flow_path):
        print("NG: flow.json が見つかりません。ux-flow-design スキルを先に実行してください。"); return 1
    F = load(flow_path)

    roles   = {r["id"] for r in F.get("roles", [])}
    jobs    = F.get("jobs", [])
    acts    = [x for ph in F.get("backbone", []) for x in ph.get("acts", [])]
    act_ids = [x["id"] for x in acts]
    a2s     = F.get("act_to_screen", {})
    screens = F.get("screens", [])
    scr_ids = [s["id"] for s in screens]
    bp      = F.get("blueprint", {})
    nav     = F.get("navigation", {})

    fails = []   # (ID, 見出し, [詳細…])
    def ng(gid, title, items):
        if items: fails.append((gid, title, items))

    # G1 行為 → 画面
    ng("G1", "画面の割り当てが無い行為",
       [f'{i} {next(x["act"] for x in acts if x["id"]==i)}' for i in act_ids if not a2s.get(i)])

    # G2 画面 → 行為（存在理由の無い画面）
    ng("G2", "どの行為にも紐づかない画面（＝存在理由が無い）",
       [f'{s["id"]} {s.get("name","")}' for s in screens if not s.get("acts")])

    # G3 未実装（new:）の取り残し
    newrefs = sorted({v[4:] for vs in a2s.values() for v in vs if v.startswith("new:")})
    ng("G3", "行為から導出されたが screens に未登録の画面",
       [n for n in newrefs if n not in scr_ids])

    # G4 目的の記述
    ng("G4", f"purpose が空 / {a.min_purpose}文字未満の画面",
       [f'{s["id"]} 「{s.get("purpose","")}」' for s in screens
        if len((s.get("purpose") or "").strip()) < a.min_purpose])

    # G5 用事の被覆（行為からどの job にも辿れない / job に行為が無い）
    job_hit = set()
    for x in acts: job_hit |= set(x.get("jobs", []))
    ng("G5", "どの行為にも結びつかない用事（JTBD）",
       [f'{j["id"]} {j.get("statement","")}' for j in jobs
        if j.get("id") not in job_hit and job_hit])   # jobs 紐づけ未使用なら検査しない

    # G6 役割の被覆
    ng("G6", "navigation.by_role に無い役割", [r for r in roles if r not in nav.get("by_role", {})])

    # G7 裏側（ブループリント）の記述
    ng("G7", "blueprint に無い行為", [i for i in act_ids if i not in bp])

    # G8 関門との整合
    if a.choke and os.path.exists(a.choke):
        cids = {c["id"] for c in load(a.choke).get("choke_points", [])}
        bad = sorted({c for v in bp.values() for c in v.get("choke_points", []) if c not in cids})
        ng("G8", "choke-points.json に無い関門 ID", bad)

    # G9 モックとの一致（余りも欠けも fail）
    if a.mocks and os.path.isdir(a.mocks):
        # 索引・治具は画面ではないので分母から外す
        SKIP = {"index", "measure", "harness", "toc"}
        pref = re.compile(r"^(v\d+)-(.+)\.html$")
        found = set()
        for f in os.listdir(a.mocks):
            if not f.endswith(".html"): continue
            m = pref.match(f)
            name = m.group(2) if m else f[:-5]          # "v1-today.html" → "today"
            if name in SKIP or name.startswith(("index", "measure", "_")): continue
            found.add(name)
        # フォルダ名が release と一致すればその release だけを分母にする。
        # それ以外（完全版フォルダ等）は全画面を分母にする。
        base = os.path.basename(a.mocks.rstrip("/"))
        rels = {s.get("release", "v1") for s in screens}
        want = ({s["id"] for s in screens if s.get("release", "v1") == base}
                if base in rels and base != max(rels) else
                {s["id"] for s in screens})
        ng("G9", f"モックにあるが flow.json に無い画面（{a.mocks}）", sorted(found - want))
        ng("G9", f"flow.json にあるがモックが無い画面（{a.mocks}）", sorted(want - found))

    # G11 製品の時点（screen-derivation §9）
    ps = F.get("product_states") or []
    if not ps: ng("G11", "product_states（製品の時点の列）が無い", ["flow.json"])
    else:
        ng("G11", "caps か source の無い時点", [p["id"] for p in ps if not p.get("caps") and p["id"] != ps[0]["id"] or not p.get("source")])
        ng("G11", "after_act が行為に無い時点", [p["id"] for p in ps if p.get("after_act") and p["after_act"] not in act_ids])

    # G17 後回し（release が最初の段階でない画面・行為）には、決定 ID か user の理由が要る（2026-09-15・実行者が勝手に v2 に送らない）
    base_rel = min({s.get("release", "v1") for s in screens} | {x.get("release", "v1") for x in acts}) if (screens or acts) else "v1"
    deferred = F.get("deferred") or {}
    bad_def = []
    for kind, items in (("screen", screens), ("act", acts)):
        for x in items:
            if x.get("release", base_rel) == base_rel: continue
            reason = str(deferred.get(x["id"], ""))
            if not (re.search(r"\bD-\d{3}\b", reason) or "user" in reason):
                bad_def.append(f'{x["id"]}（release {x.get("release")}）: flow.json の deferred に「決定 ID か user の OK」を書く')
    ng("G17", "後回しにした画面・行為に、決定か user の理由が無い（実行者の判断で後回しにしてはならない）", bad_def)

    # G10 ナビの実在
    bad_nav = []
    for r, ss in nav.get("by_role", {}).items():
        bad_nav += [f"{r} → {s}" for s in ss if s not in scr_ids]
    for s, subs in nav.get("sub_by_screen", {}).items():
        if s not in scr_ids: bad_nav.append(f"sub_by_screen の {s} が screens に無い")
    ng("G10", "navigation が実在しない画面を指している", bad_nav)

    if a.json:
        print(json.dumps({"ok": not fails, "flow": flow_path,
                          "counts": {"roles": len(roles), "jobs": len(jobs), "acts": len(act_ids),
                                     "screens": len(scr_ids), "objects": len(F.get("objects", []))},
                          "fails": [{"gate": g, "title": t, "items": i} for g, t, i in fails]},
                         ensure_ascii=False, indent=1))
        return 1 if fails else 0

    print(f"flow: {flow_path}")
    print(f"役割 {len(roles)} / 用事 {len(jobs)} / 行為 {len(act_ids)} / "
          f"オブジェクト {len(F.get('objects',[]))} / 画面 {len(scr_ids)}")
    if not fails:
        print("\nPASS — G1〜G10・G17 すべて緑。ui-mockup に進めます。"); return 0
    print(f"\nFAIL — {len(fails)} 件\n")
    for g, t, items in fails:
        print(f"[{g}] {t}: {len(items)} 件")
        for x in items[:12]: print(f"      - {x}")
        if len(items) > 12: print(f"      … 他 {len(items)-12} 件")
        print()
    print("ui-mockup は起動できません。ux-flow-design に戻ってください。")
    return 1

if __name__ == "__main__":
    sys.exit(main())
