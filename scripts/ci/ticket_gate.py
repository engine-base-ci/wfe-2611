#!/usr/bin/env python3
"""ticket_gate.py — tickets_plan.json が「拾える」形かを検査する。PASS するまで「チケット化した」と書かない。
 K1 親：story は epic の下、subtask は story の下  K2 依存：閉路なし・無い依存なし  K3 担当：割り当てられる人が居ない story が無い
 K4 日程：全 story に start/finish  K5 関連：リンク切れ 0  K6 ID 固定：--prev の story ID が消えていない（dropped で残す）
 K7 見積：既定値のままの story を warn（fail にしない）  K8 節目：超過を warn
 K9 可視化：plan と同じ場所に schedule.html（ガント・押すと詳細）があり、plan より古くなく、全 story の ID を含む（一覧のままは拾えない）"""
import argparse, json, sys
from pathlib import Path
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("plan"); ap.add_argument("--prev"); ap.add_argument("--flow"); ap.add_argument("--mocks"); a = ap.parse_args()
    P = json.load(open(a.plan, encoding="utf-8")); T = {t["id"]: t for t in P["tickets"]}; s = P["summary"]; fails, warns = [], []
    for t in P["tickets"]:
        if t["kind"] == "story" and (not t.get("parent") or t["parent"] not in T or T[t["parent"]]["kind"] != "epic"): fails.append(("K1", f'{t["id"]} の親が epic でない'))
        if t["kind"] == "subtask" and (t.get("parent") not in T or T[t["parent"]]["kind"] != "story"): fails.append(("K1", f'{t["id"]} の親が story でない'))
    if s.get("cycle"): fails.append(("K2", f'依存の閉路: {s["cycle"]}'))
    if s.get("ghost_dependencies"): fails.append(("K2", f'無い依存: {s["ghost_dependencies"]}'))
    if s.get("unassignable"): fails.append(("K3", f'割り当てられる人が居ない: {s["unassignable"]}（名簿に技能を足すか、層を変える）'))
    for t in P["tickets"]:
        if t["kind"] == "story" and t.get("delta") != "dropped" and not t.get("start"): fails.append(("K4", f'{t["id"]} に日程が無い'))
    if s.get("broken_links"): fails.append(("K5", f'リンク切れ {len(s["broken_links"])}: {s["broken_links"][:6]}'))
    if a.prev and Path(a.prev).exists():
        prev = json.load(open(a.prev, encoding="utf-8")); lost = [t["id"] for t in prev["tickets"] if t["kind"] == "story" and t["id"] not in T]
        if lost: fails.append(("K6", f'前回の story が消えた（dropped で残す）: {lost}'))
    import os
    hp = Path(a.plan).parent / "schedule.html"
    if not hp.exists(): fails.append(("K9", "schedule.html（ガント・押すと詳細）が無い（build_tickets.py が生成）"))
    else:
        h = hp.read_text(encoding="utf-8"); miss = [t["id"] for t in P["tickets"] if t["kind"] == "story" and t.get("delta") != "dropped" and f'"{t["id"]}"' not in h]
        if os.path.getmtime(hp) + 1 < os.path.getmtime(a.plan): fails.append(("K9", "schedule.html が plan より古い（再生成する）"))
        if miss: fails.append(("K9", f"schedule.html に無い story {miss[:6]}"))
        # 状態が日程に写っているか：plan の summary.by_status と tickets.json の状態の数が一致する（done を書いたのにガントが古い、を捕まえる）
        try:
            import collections
            src = collections.Counter(t.get("status", "todo") for t in json.load(open(P.get("inputs", {}).get("tickets", "07_tasks/tickets.json"), encoding="utf-8"))["tasks"])
            got = P.get("summary", {}).get("by_status") or {}
            if any(src.get(k, 0) != got.get(k, 0) for k in set(src) | set(got)): fails.append(("K9", f"状態の数が日程に写っていない：tickets.json {dict(src)} ／ plan {got}（build_tickets --from-plan で作り直す）"))
        except Exception as e: fails.append(("K9", f"状態の照合ができない：{e}"))
    if s.get("estimate_default"): warns.append(f'K7 見積が既定値のまま {len(s["estimate_default"])}: {s["estimate_default"][:8]}')
    if s.get("milestone_overrun"): warns.append(f'K8 節目超過 {len(s["milestone_overrun"])}: {s["milestone_overrun"][:4]}')
    print(f'epic {s["epic"]} / story {s["story"]} / subtask {s["subtask"]} / クリティカルパス {s["critical_path_days"]} 営業日')
    for w in warns: print("  warn", w)
    if fails:
        print(f"FAIL — {len(fails)} 件"); [print(f"  [{g}] {m}") for g, m in fails]; return 2
    print("PASS — K1〜K6・K9 すべて緑（チケットとして拾える・押すと詳細）"); return 0
if __name__ == "__main__": sys.exit(main())
