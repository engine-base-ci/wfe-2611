#!/usr/bin/env python3
"""build_tickets.py — tickets.json（task-decomposition）を、拾えるチケット（親子・依存・日程・担当候補・関連）にする。
正本は tickets_plan.json。再実行は ID を変えず差分（追加／更新／削除）。使い方は SKILL.md。"""
from __future__ import annotations
import argparse, json, datetime as dt, os, re, sys
from collections import defaultdict, deque
from pathlib import Path

def J(p): return json.load(open(p, encoding="utf-8")) if p and Path(p).exists() else None
def D(s): return dt.date.fromisoformat(str(s)[:10])

class Calendar:
    def __init__(self, ms):
        self.hol = {D(x) for x in (ms or {}).get("holidays", [])}; self.wd = set((ms or {}).get("workdays", [1,2,3,4,5]))
        self.start = D((ms or {}).get("start") or dt.date.today().isoformat())
    def is_work(self, d): return d.isoweekday() in self.wd and d not in self.hol
    def next_work(self, d):
        while not self.is_work(d): d += dt.timedelta(days=1)
        return d
    def add_days(self, d, n):
        d = self.next_work(d)
        for _ in range(n): d = self.next_work(d + dt.timedelta(days=1))
        return d
    def workdays_between(self, a, b):
        n, d = 0, a
        while d < b:
            if self.is_work(d): n += 1
            d += dt.timedelta(days=1)
        return n

class Member:
    def __init__(self, m, cal):
        self.id, self.name, self.skills = m["id"], m.get("name", m["id"]), set(m.get("skills", []))
        self.hpd, self.wip = float(m.get("hours_per_day", 8)), int(m.get("wip", 2))
        self.off = {D(x) for x in m.get("days_off", [])}; self.cal = cal
        self.cursor, self.left = cal.next_work(cal.start), self.hpd; self.load = 0.0
    def free_from(self, d):
        d = self.cal.next_work(max(d, self.cursor))
        while d in self.off: d = self.cal.next_work(d + dt.timedelta(days=1))
        return d
    def book(self, earliest, hours):
        d = self.free_from(earliest)
        if d != self.cursor: self.cursor, self.left = d, self.hpd
        start = d; h = hours
        while h > 0:
            take = min(h, self.left); h -= take; self.left -= take
            if h > 0 or self.left <= 0:
                nd = self.cal.next_work(self.cursor + dt.timedelta(days=1))
                while nd in self.off: nd = self.cal.next_work(nd + dt.timedelta(days=1))
                if h > 0: self.cursor, self.left = nd, self.hpd
                else: finish = self.cursor; self.cursor, self.left = nd, self.hpd; self.load += hours; return start, finish
        finish = self.cursor; self.load += hours; return start, finish

def _mock_of(a, flow, sid):
    """画面のモックの置き場は段階（release）ごと（v1/・v2/）。--mocks は段階 1 の置き場。flow に release が無ければそのまま"""
    import os
    rel = next((s.get("release") for s in (flow or {}).get("screens", []) if s["id"] == sid), None) or a.prefix.rstrip("-")
    base = a.mocks if rel == a.prefix.rstrip("-") else os.path.join(os.path.dirname(a.mocks.rstrip("/")), rel)
    return f"{base}/{rel}-{sid}.html"

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickets"); ap.add_argument("--roster"); ap.add_argument("--milestones")
    ap.add_argument("--decisions", help="決定ログ（.md）。decision: D-xxx を全部リンク先として認める。無ければ flow の source から");
    ap.add_argument("--features"); ap.add_argument("--flow"); ap.add_argument("--mocks"); ap.add_argument("--prefix", default="v1-"); ap.add_argument("--spec"); ap.add_argument("--journeys"); ap.add_argument("--errors")
    ap.add_argument("--prev"); ap.add_argument("--auto-assign", action="store_true"); ap.add_argument("-o", "--out", default="07_tasks/tickets_plan.json")
    ap.add_argument("--from-plan", help="前回の plan の inputs で作り直す（状態を変えた後の再生成。mark_done が呼ぶ）。--prev はその plan、-o の既定もその plan")
    a = ap.parse_args()
    if a.from_plan:
        _prev = J(a.from_plan) or {}
        for k, v in (_prev.get("inputs") or {}).items():
            if getattr(a, k, None) in (None, "v1-") and v: setattr(a, k, v)
        a.prev = a.prev or a.from_plan; a.out = a.out if a.out != "07_tasks/tickets_plan.json" or not a.from_plan else a.from_plan
    if not (a.tickets and a.roster and a.milestones): print("NG: --tickets / --roster / --milestones（か --from-plan）が要る"); return 2
    T = J(a.tickets); R = J(a.roster); M = J(a.milestones)
    if not T or not R or not M: print("NG: tickets / roster / milestones のどれかが無い。名簿と節目は雛形を置いて PM が埋める（実行者が作らない）"); return 2
    tasks = T.get("tasks") or T.get("tickets") or []
    flow = J(a.flow) or {}; feats = J(a.features) or {}; errs = J(a.errors) or {}; prev = J(a.prev) or {}
    prev_t = {t["id"]: t for t in prev.get("tickets", [])}
    scr_ids = {s["id"] for s in flow.get("screens", [])}; act_ids = {x["id"] for p in flow.get("backbone", []) for x in p.get("acts", [])}
    dec_ids = set(re.findall(r'decision: (D-\d{3})', open(a.decisions, encoding='utf-8').read())) if a.decisions and os.path.exists(a.decisions) else {d.split(".")[0] for s in flow.get("screens", []) for d in s.get("source", [])} | {d.split(".")[0] for p in flow.get("backbone", []) for x in p.get("acts", []) for d in x.get("source", [])}
    err_ids = {e.get("id") for e in (errs.get("errors") or [])}
    # テスト行の実在（spec の markdown 表の ID）
    row_ids = set()
    if a.spec and Path(a.spec).exists():
        for f in Path(a.spec).rglob("*.md"):
            for line in f.read_text(encoding="utf-8").splitlines():
                if line.startswith("| ") and re.match(r"^\|\s*[A-Z][A-Z0-9-]*-\d{2,3}\s*\|", line): row_ids.add(line.split("|")[1].strip())
    jrows = {r.get("id") for r in (J(a.journeys) or {}).get("rows", [])}
    # 親（流れ／機能）
    flows = {}
    for key in ("flows", "journeys", "features"):
        for f in feats.get(key, []) or []:
            if isinstance(f, dict) and f.get("id"): flows[f["id"]] = f.get("name") or f.get("title") or f["id"]
    cal = Calendar(M); members = [Member(m, cal) for m in R.get("members", [])]
    tickets, broken = [], []
    def link_check(kind, ids, ok_set):
        for x in ids:
            if ok_set and x not in ok_set: broken.append(f"{kind}:{x}")
    # ---- story
    stories = {}
    for t in tasks:
        tid = t["id"]; layer = t.get("deliverable_layer") or t.get("layer") or "backend"
        l2 = (t.get("qa_rows") or {}).get("l2_flows") if isinstance(t.get("qa_rows"), dict) else None
        flow_id = t.get("flow") or t.get("epic") or (l2[0] if l2 else None)
        parent = flow_id if flow_id else f"E-{layer}"
        links = {"mock": [], "screens": list(t.get("screen_ids") or []), "decisions": list(t.get("source") or []), "acts": list(t.get("acts") or []),
                 "qa_rows": list(((t.get("qa_rows") or {}).get("l1") if isinstance(t.get("qa_rows"), dict) else []) or []), "errors": [r for r in (((t.get("qa_rows") or {}).get("l1") if isinstance(t.get("qa_rows"), dict) else []) or []) if str(r).startswith("E-")],
                 "spec": [f'{a.tickets}#{tid}']}
        if prev_story_dropped(tid) if 'prev_story_dropped' in globals() else False: pass

        for sid in links["screens"]:
            p = _mock_of(a, flow, sid) if a.mocks else None
            if p:
                links["mock"].append(p)
                if not Path(p).exists(): broken.append(f"mock:{p}")
        link_check("screen", links["screens"], scr_ids); link_check("act", links["acts"], act_ids)
        link_check("decision", [d.split(".")[0] for d in links["decisions"] if str(d).startswith("D-")], dec_ids)   # "(基盤)" 等の印は決定ではない
        link_check("qa_row", [r for r in links["qa_rows"] if not str(r).startswith("E-")], row_ids | jrows if (row_ids or jrows) else set())
        link_check("error", [re.sub(r"-[A-C]$", "", e) for e in links["errors"]], err_ids)   # E-…-A/B/C は errors.md の 3 行（正本は errors.json の ID）
        est = t.get("estimate_hours") or t.get("estimate") or 4
        assignable = [m.id for m in members if layer in m.skills or "all" in m.skills]
        pv = prev_t.get(tid, {})
        st = {"id": tid, "kind": "story", "title": t.get("title") or t.get("name") or tid, "parent": parent, "children": [], "depends_on": list(t.get("depends_on") or []),
              "blocked_by": [], "wave": None, "layer": layer, "estimate_hours": float(est), "estimate_default": not bool(t.get("estimate_hours") or t.get("estimate")),
              "start": None, "finish": None, "critical": False, "tentative": False, "assignable": assignable, "assignee": t.get("assignee") or pv.get("assignee"), "assigned_by": pv.get("assigned_by") or ("pm" if t.get("assignee") else None),
              "status": pv.get("status") or t.get("status") or "todo", "external": pv.get("external") or {}, "links": links, "delta": "unchanged" if pv else "added", "dropped_reason": None}
        if pv and (pv.get("estimate_hours") != st["estimate_hours"] or pv.get("depends_on") != st["depends_on"] or pv.get("title") != st["title"]): st["delta"] = "updated"
        stories[tid] = st
        # subtask
        n = 0
        for fc in (t.get("files_changed") or []):
            n += 1; path = fc if isinstance(fc, str) else (fc.get("path") or fc.get("file") or "?"); ch = "" if isinstance(fc, str) else (fc.get("change") or fc.get("type") or "")
            st["children"].append(f"{tid}.s{n}")
            tickets.append({"id": f"{tid}.s{n}", "kind": "subtask", "sub": "impl", "title": f"{ch} {path}".strip(), "parent": tid, "status": pv.get("status") == "done" and "done" or "todo", "links": {"file": [path]}})
        for i, r in enumerate(links["qa_rows"], 1):
            st["children"].append(f"{tid}.t{i}"); tickets.append({"id": f"{tid}.t{i}", "kind": "subtask", "sub": "test", "title": f"L1 {r} を staging で流して PASS/BLOCKED を正本に書く", "parent": tid, "status": "todo", "links": {"qa_rows": [r]}})
        for i, sid in enumerate(links["screens"], 1):
            st["children"].append(f"{tid}.m{i}"); tickets.append({"id": f"{tid}.m{i}", "kind": "subtask", "sub": "mock", "title": f"モック {sid} と突き合わせる（全要素・全ボタン・値が固定でない）", "parent": tid, "status": "todo", "links": {"mock": [_mock_of(a, flow, sid)] if a.mocks else [], "screens": [sid]}})
    # ---- epic
    epics = {}
    for st in stories.values():
        e = epics.setdefault(st["parent"], {"id": st["parent"], "kind": "epic", "title": flows.get(st["parent"]) or (st["parent"][2:] + " の層" if st["parent"].startswith("E-") else st["parent"]), "parent": None, "children": [], "depends_on": [], "status": "todo", "links": {}, "delta": "unchanged" if st["parent"] in prev_t else "added"})
        e["children"].append(st["id"])
    # ---- DAG（story）
    ids = set(stories); indeg = {k: 0 for k in stories}; adj = defaultdict(list); ghost_dep = []
    for st in stories.values():
        for d in st["depends_on"]:
            if d in ids: adj[d].append(st["id"]); indeg[st["id"]] += 1
            else: ghost_dep.append(f'{st["id"]} → {d}')
    order, q = [], deque(k for k, v in indeg.items() if v == 0)
    while q:
        k = q.popleft(); order.append(k)
        for nx in adj[k]:
            indeg[nx] -= 1
            if indeg[nx] == 0: q.append(nx)
    cycle = [k for k in stories if k not in order]
    # ---- スケジュール（依存 → 担当の空き）
    mem = {m.id: m for m in members}; finish = {}
    for k in order:
        st = stories[k]; earliest = cal.start
        for d in st["depends_on"]:
            if d in finish and finish[d]: earliest = max(earliest, finish[d] + dt.timedelta(days=1))
        who = st["assignee"] if st["assignee"] in mem else None
        if not who and st["assignable"]:
            who = min(st["assignable"], key=lambda i: mem[i].load); st["tentative"] = not a.auto_assign
            if a.auto_assign: st["assignee"], st["assigned_by"] = who, "auto"
        if who:
            s, f = mem[who].book(earliest, st["estimate_hours"]); st["start"], st["finish"] = s.isoformat(), f.isoformat(); finish[k] = f
            if st["tentative"]: st["tentative_assignee"] = who
        else:
            st["start"] = st["finish"] = None; finish[k] = None
    # クリティカルパス（時間で最長）
    longest, pred = {}, {}
    for k in order:
        st = stories[k]; base = max(((longest.get(d, 0), d) for d in st["depends_on"] if d in longest), default=(0, None))
        longest[k] = base[0] + st["estimate_hours"]; pred[k] = base[1]
    if longest:
        k = max(longest, key=longest.get); path = []
        while k: path.append(k); stories[k]["critical"] = True; k = pred.get(k)
        path.reverse()
    else: path = []
    # 節目
    ms = sorted((M.get("milestones") or []), key=lambda x: x["due"]); overrun = []
    for st in stories.values():
        if st["finish"]:
            f = D(st["finish"]); w = next((m["id"] for m in ms if D(m["due"]) >= f), None); st["wave"] = w
            if w is None and ms: overrun.append(f'{st["id"]} {st["finish"]} > {ms[-1]["id"]} {ms[-1]["due"]}')
    # 削除（前回にあって今無い）
    for pid, pv in prev_t.items():
        if pv.get("kind") == "story" and pid not in stories:
            stories[pid] = {**pv, "delta": "dropped", "status": "dropped", "dropped_reason": pv.get("dropped_reason") or "tickets.json から消えた（理由を書く）"}
    all_t = list(epics.values()) + list(stories.values()) + tickets
    cp_days = cal.workdays_between(D(stories[path[0]]["start"]), D(stories[path[-1]]["finish"]) + dt.timedelta(days=1)) if path and stories[path[0]]["start"] and stories[path[-1]]["finish"] else 0
    unassignable = [k for k, s in stories.items() if s["kind"] == "story" and not s["assignable"] and s["delta"] != "dropped"]
    summary = {"epic": len(epics), "story": sum(1 for s in stories.values() if s["delta"] != "dropped"), "subtask": len(tickets),
               "subtask_by": {"impl": sum(1 for t in tickets if t["sub"] == "impl"), "test": sum(1 for t in tickets if t["sub"] == "test"), "mock": sum(1 for t in tickets if t["sub"] == "mock")},
               "critical_path": path, "critical_path_days": cp_days, "cycle": cycle, "ghost_dependencies": ghost_dep, "unassignable": unassignable,
               "tentative": sum(1 for s in stories.values() if s.get("tentative")), "assigned": sum(1 for s in stories.values() if s.get("assignee")),
               "broken_links": sorted(set(broken)), "milestone_overrun": overrun, "estimate_default": [k for k, s in stories.items() if s.get("estimate_default")],
               "delta": {d: sum(1 for s in stories.values() if s["delta"] == d) for d in ("added", "updated", "unchanged", "dropped")},
               "load": {m.id: round(m.load, 1) for m in members}}
    out = {"generated_at": dt.datetime.now().isoformat(timespec="seconds"), "inputs": {k: getattr(a, k) for k in ("tickets", "roster", "milestones", "decisions", "features", "flow", "mocks", "prefix", "spec", "journeys", "errors") if getattr(a, k, None)}, "summary": summary, "tickets": all_t}
    Path(a.out).parent.mkdir(parents=True, exist_ok=True); json.dump(out, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    write_md(Path(a.out).parent, out, epics, stories, tickets, members, cal, ms)
    write_html(Path(a.out).parent, out, epics, stories, tickets, members, ms, {x["id"]: x for x in tasks}, a.mocks)
    s = summary
    print(f'epic {s["epic"]} / story {s["story"]} / subtask {s["subtask"]}（実装 {s["subtask_by"]["impl"]}・テスト行 {s["subtask_by"]["test"]}・モック照合 {s["subtask_by"]["mock"]}）')
    print(f'依存の閉路 {len(cycle)} ／ 無い依存 {len(ghost_dep)} ／ クリティカルパス {cp_days} 営業日（{" → ".join(path[:6])}{" …" if len(path) > 6 else ""}）／ 節目超過 {len(overrun)}')
    print(f'割り当て：決まった {s["assigned"]} ／ 仮置き {s["tentative"]} ／ 割り当てられる人が居ない {len(unassignable)}{"（★ " + ", ".join(unassignable) + "）" if unassignable else ""}')
    print(f'リンク切れ {len(s["broken_links"])}{"：" + ", ".join(s["broken_links"][:8]) if s["broken_links"] else ""} ／ 見積が既定値（4h）のまま {len(s["estimate_default"])}')
    print(f'差分：追加 {s["delta"]["added"]} ／ 更新 {s["delta"]["updated"]} ／ 対象外 {s["delta"]["unchanged"]} ／ 削除 {s["delta"]["dropped"]}')
    print(f'出力: {a.out} / board.md / schedule.md / schedule.html（ガント・押すと詳細） / assign.md'); return 0

def write_html(d, out, epics, stories, subs, members, ms, tasks_by_id, mocks_dir):
    """schedule.html — ガント（押すと詳細）。JSON からの写し。外部依存なし。"""
    import html as H
    dates = [D(s["start"]) for s in stories.values() if s.get("start")] + [D(s["finish"]) for s in stories.values() if s.get("finish")] + [D(m["due"]) for m in ms]
    if not dates: return
    d0 = min(dates) - dt.timedelta(days=min(dates).weekday()); d1 = max(dates) + dt.timedelta(days=3)
    data = {"start": d0.isoformat(), "end": d1.isoformat(), "generated": out["generated_at"], "milestones": ms, "summary": {k: out["summary"][k] for k in ("epic", "story", "subtask", "critical_path_days", "critical_path")},
            "members": [{"id": m.id, "name": m.name, "hpd": m.hpd} for m in members],
            "epics": [{"id": e["id"], "title": e["title"], "children": e["children"]} for e in epics.values()],
            "stories": {k: {**{kk: vv for kk, vv in s.items() if kk != "children"}, "human_h": (tasks_by_id.get(k) or {}).get("estimate_hours_human"), "ai_h": (tasks_by_id.get(k) or {}).get("wall_clock_h_ai"), "acts": (tasks_by_id.get(k) or {}).get("acts", []),
                          "ac": (tasks_by_id.get(k) or {}).get("acceptance_criteria_inline", {}), "why": (tasks_by_id.get(k) or {}).get("why", ""), "summaries": (tasks_by_id.get(k) or {}).get("decision_summaries", []),
                          "subs": [{"id": x["id"], "sub": x["sub"], "title": x["title"], "status": x["status"]} for x in subs if x["parent"] == k]} for k, s in stories.items()}}
    js = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    page = """<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>Kaname スケジュール（ガント）</title>
<style>
:root{--line:#d9d6cf;--ink:#1f2328;--sub:#6b6860;--bg:#fafaf8;--sur:#fff;--acc:#2f6f8f;--warn:#b7791f;--crit:#a23b3b}
*{box-sizing:border-box}body{margin:0;font:13px/1.5 -apple-system,'Hiragino Sans',sans-serif;color:var(--ink);background:var(--bg)}
header{display:flex;gap:12px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--line);background:var(--sur);position:sticky;top:0;z-index:5;flex-wrap:wrap}
header h1{font-size:15px;margin:0 8px 0 0}header select,header input{font:inherit;padding:4px 6px;border:1px solid var(--line);border-radius:6px;background:#fff}
header label{display:flex;gap:4px;align-items:center;color:var(--sub);font-size:12px}
.wrap{display:grid;grid-template-columns:1fr 380px;height:calc(100vh - 52px)}
.gantt{overflow:auto;position:relative}.pane{border-left:1px solid var(--line);background:var(--sur);overflow:auto;padding:14px 16px}
table.g{border-collapse:collapse;min-width:100%}table.g th,table.g td{border-bottom:1px solid #eeece6;padding:0;height:26px;white-space:nowrap}
table.g thead th{position:sticky;top:0;background:var(--sur);z-index:3;font-weight:500;color:var(--sub);font-size:11px;border-bottom:1px solid var(--line)}
td.n{position:sticky;left:0;background:var(--sur);z-index:2;padding:0 8px;min-width:340px;max-width:340px;overflow:hidden;text-overflow:ellipsis;border-right:1px solid var(--line);cursor:pointer}
tr.e td.n{font-weight:600;background:#f3f1ec}tr.e td{background:#f3f1ec}
td.n:hover{background:#eef4f7}tr.sel td.n{background:#dfeaf0}
td.t{position:relative;padding:0}.day{display:inline-block;width:18px;height:26px;border-right:1px solid #f1efe9;vertical-align:top}
.day.we{background:#f6f5f1}.day.ms{border-right:2px solid var(--warn)}.day.today{background:#fff4dc}
.bar{position:absolute;top:6px;height:14px;border-radius:4px;background:var(--acc);opacity:.9;cursor:pointer}
.bar.crit{background:var(--crit)}.bar.foundation{background:#4a4a4a}.bar.ui{background:#3a8f6f}.bar.integration{background:#7d5aa6}.bar.polish{background:#a67c3a}.bar.content{background:#b07c9e}.bar.spec{background:#d08a3a}
.bar.h{top:20px;height:4px;opacity:.45;background:#999}
.pane h2{font-size:15px;margin:0 0 6px}.pane .meta{color:var(--sub);font-size:12px;margin-bottom:10px}.pane h3{font-size:12px;color:var(--sub);margin:14px 0 4px;text-transform:none}
.pane ul{margin:0;padding-left:18px}.pane li{margin:2px 0}.chip{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:0 8px;font-size:11px;margin:0 4px 4px 0;background:#fff}
.pane a{color:var(--acc)}.legend span{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 4px 0 8px;vertical-align:middle}
.num{font-variant-numeric:tabular-nums}.hint{color:var(--sub);font-size:12px}
@media (max-width:900px){.wrap{grid-template-columns:1fr}.pane{border-left:0;border-top:1px solid var(--line)}}
</style></head><body>
<header><h1>Kaname スケジュール</h1>
<label>担当<select id="fA"><option value="">全部</option></select></label>
<label>層<select id="fL"><option value="">全部</option></select></label>
<label>epic<select id="fE"><option value="">全部</option></select></label>
<label>探す<input id="fQ" placeholder="ID・題名" size="18"></label>
<label><input type="checkbox" id="fH"> Human 基準の棒も出す</label>
<span class="legend hint"><span style="background:#4a4a4a"></span>基盤<span style="background:#2f6f8f"></span>API<span style="background:#3a8f6f"></span>画面<span style="background:#7d5aa6"></span>結線<span style="background:#b07c9e"></span>スキル<span style="background:#d08a3a"></span>仕様<span style="background:#a23b3b"></span>クリティカル</span>
<span class="hint" id="sum"></span></header>
<div class="wrap"><div class="gantt"><table class="g"><thead><tr id="hd"></tr></thead><tbody id="tb"></tbody></table></div>
<aside class="pane" id="pane"><p class="hint">行か棒を押すと、そのチケットの中身がここに出ます。</p></aside></div>
<script>
const DATA = __DATA__;
const D=s=>new Date(s+"T00:00:00");const day=864e5;const d0=D(DATA.start),d1=D(DATA.end);const N=Math.round((d1-d0)/day)+1;
const days=[...Array(N)].map((_,i)=>new Date(d0.getTime()+i*day));const msSet=new Set(DATA.milestones.map(m=>m.due));const today=new Date().toISOString().slice(0,10);
const iso=d=>d.toISOString().slice(0,10);const idx=s=>Math.round((D(s)-d0)/day);
const $=q=>document.querySelector(q);const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function header(){const tr=$("#hd");tr.innerHTML='<th style="text-align:left;padding:0 8px;position:sticky;left:0;z-index:4;background:#fff;border-right:1px solid var(--line)">チケット</th><th style="text-align:left"><div style="display:flex">'+days.map(d=>`<span class="day${[0,6].includes(d.getDay())?" we":""}${msSet.has(iso(d))?" ms":""}${iso(d)===today?" today":""}" title="${iso(d)}" style="font-size:10px;padding-left:2px">${d.getDate()===1||d.getDay()===1?(d.getMonth()+1)+"/"+d.getDate():""}</span>`).join("")+'</div></th>';}
function rows(){const fa=$("#fA").value,fl=$("#fL").value,fe=$("#fE").value,q=$("#fQ").value.trim().toLowerCase(),hh=$("#fH").checked;const tb=$("#tb");let out="";let shown=0;
 for(const e of DATA.epics){if(fe&&e.id!==fe)continue;const kids=e.children.map(k=>DATA.stories[k]).filter(s=>s&&s.delta!=="dropped"&&(!fa||s.assignee===fa)&&(!fl||s.layer===fl)&&(!q||(s.id+" "+s.title).toLowerCase().includes(q)));if(!kids.length)continue;
  out+=`<tr class="e"><td class="n" data-e="${e.id}">${esc(e.id)} ${esc(e.title)}<span class="hint"> ${kids.length}</span></td><td class="t"><div style="display:flex">${days.map(d=>`<span class="day${[0,6].includes(d.getDay())?" we":""}${msSet.has(iso(d))?" ms":""}"></span>`).join("")}</div></td></tr>`;
  for(const s of kids){shown++;const a=s.start?idx(s.start):null,b=s.finish?idx(s.finish):null;const hb=(hh&&s.human_h)?`<div class="bar h" style="left:${a*18}px;width:${Math.max(6,Math.ceil(s.human_h/8)*18)}px" title="Human ${s.human_h}h ≈ ${Math.ceil(s.human_h/8)} 日"></div>`:"";
   out+=`<tr data-s="${s.id}"><td class="n" title="${esc(s.title)}">${s.critical?"★ ":""}${esc(s.id)} <span class="hint">${esc(s.title)}</span></td><td class="t"><div style="display:flex">${days.map(d=>`<span class="day${[0,6].includes(d.getDay())?" we":""}${msSet.has(iso(d))?" ms":""}${iso(d)===today?" today":""}"></span>`).join("")}</div>${a!==null?`<div class="bar ${s.layer}${s.critical?" crit":""}" data-s="${s.id}" style="left:${a*18}px;width:${Math.max(10,(b-a+1)*18-4)}px" title="${esc(s.id)} ${s.start}〜${s.finish} ${s.assignee||""}"></div>`:""}${hb}</td></tr>`;}}
 tb.innerHTML=out;$("#sum").textContent=`表示 ${shown} / story ${DATA.summary.story}・epic ${DATA.summary.epic}・subtask ${DATA.summary.subtask}・クリティカルパス ${DATA.summary.critical_path_days} 営業日・生成 ${DATA.generated.slice(0,16)}`;}
function show(id){const s=DATA.stories[id];if(!s)return;document.querySelectorAll("tr.sel").forEach(x=>x.classList.remove("sel"));const tr=document.querySelector(`tr[data-s="${id}"]`);if(tr)tr.classList.add("sel");
 const L=s.links||{};const li=(xs,f)=>xs&&xs.length?"<ul>"+xs.map(f||(x=>`<li>${esc(x)}</li>`)).join("")+"</ul>":'<p class="hint">なし</p>';const chips=xs=>xs&&xs.length?xs.map(x=>`<span class="chip">${esc(x)}</span>`).join(""):'<span class="hint">なし</span>';
 const ac=s.ac||{};const t2=(ac.tier_2_functional||[]).map(x=>x.text||x);
 $("#pane").innerHTML=`<h2>${s.critical?"★ ":""}${esc(s.id)} ${esc(s.title)}</h2><div class="meta">${esc(s.parent)} ／ 層 ${esc(s.layer)} ／ 節目 ${esc(s.wave||"—")} ／ 状態 ${esc(s.status)}</div>
 <div class="meta num">日程 ${s.start||"—"} 〜 ${s.finish||"—"} ／ 担当 ${esc(s.assignee||(s.tentative_assignee?s.tentative_assignee+"（仮）":"未割り当て"))}（${esc(s.assigned_by||"")}）</div>
 <div class="meta num">AI wall-clock ${s.ai_h??s.estimate_hours} h ／ Human ${s.human_h??"—"} h</div>
 ${s.why?`<p>${esc(s.why)}</p>`:""}
 <h3>根拠の決定（逐語）</h3>${li(s.summaries||[],x=>`<li><b>${esc(x.id)}</b> ${esc(x.summary)}</li>`)}
 <h3>依存</h3>${chips(s.depends_on)}<div>${(s.depends_on||[]).map(d=>`<a href="#" data-go="${esc(d)}">${esc(d)}</a>`).join(" ")}</div>
 <h3>行為・画面</h3>${chips((s.acts||[]).concat(L.screens||[]))}
 <h3>モック</h3>${li(L.mock||[],x=>`<li><a href="${esc(x)}" target="_blank">${esc(x)}</a></li>`)}
 <h3>受け入れ条件（Tier 2）</h3>${li(t2)}
 <h3>正本の行（L1 ${(L.qa_rows||[]).length}）</h3>${chips((L.qa_rows||[]).slice(0,24))}${(L.qa_rows||[]).length>24?'<span class="hint"> …</span>':""}
 <h3>エラー一覧</h3>${chips(L.errors||[])}
 <h3>子チケット（実装 ${(s.subs||[]).filter(x=>x.sub==="impl").length}・テスト ${(s.subs||[]).filter(x=>x.sub==="test").length}・モック照合 ${(s.subs||[]).filter(x=>x.sub==="mock").length}）</h3>${li((s.subs||[]).filter(x=>x.sub!=="test").slice(0,20),x=>`<li>${esc(x.id)} ${esc(x.title)}</li>`)}
 <h3>仕様</h3>${li(L.spec||[])}`;
 $("#pane").querySelectorAll("a[data-go]").forEach(a=>a.onclick=ev=>{ev.preventDefault();show(a.dataset.go);const r=document.querySelector(`tr[data-s="${a.dataset.go}"]`);if(r)r.scrollIntoView({block:"center"});});}
function init(){const A=$("#fA");DATA.members.forEach(m=>A.insertAdjacentHTML("beforeend",`<option value="${m.id}">${esc(m.name)}</option>`));const layers=[...new Set(Object.values(DATA.stories).map(s=>s.layer))].sort();const Lc=$("#fL");layers.forEach(l=>Lc.insertAdjacentHTML("beforeend",`<option>${l}</option>`));const E=$("#fE");DATA.epics.forEach(e=>E.insertAdjacentHTML("beforeend",`<option value="${e.id}">${esc(e.id)} ${esc(e.title)}</option>`));
 header();rows();["fA","fL","fE","fH"].forEach(i=>$("#"+i).onchange=rows);$("#fQ").oninput=rows;
 $("#tb").addEventListener("click",ev=>{const b=ev.target.closest("[data-s]");if(b)show(b.dataset.s);});
 const t=document.querySelector(".day.today");if(t)t.scrollIntoView({inline:"center",block:"nearest"});}
init();
</script></body></html>"""
    (d / "schedule.html").write_text(page.replace("__DATA__", js), encoding="utf-8")

def write_md(d, out, epics, stories, subs, members, cal, ms):
    cols = ["todo", "in_progress", "review", "blocked", "done"]
    L = ["# 盤（board）", "", f"生成 {out['generated_at']}", ""]
    for c in cols:
        L.append(f"## {c}")
        for e in epics.values():
            kids = [stories[k] for k in e["children"] if stories[k]["status"] == c]
            if not kids: continue
            L.append(f"- **{e['id']} {e['title']}**")
            for s in kids:
                who = s.get("assignee") or (("(" + s.get("tentative_assignee", "") + " 仮)") if s.get("tentative_assignee") else "★未割り当て")
                L.append(f"  - {'★' if s['critical'] else ''}{s['id']} {s['title']} ｜ {s['layer']} ｜ {s['estimate_hours']}h ｜ {s['start'] or '—'}→{s['finish'] or '—'} ｜ {who} ｜ 孫 {len(s['children'])}")
        L.append("")
    (d / "board.md").write_text("\n".join(L), encoding="utf-8")
    # schedule
    dates = [D(s["start"]) for s in stories.values() if s.get("start")] + [D(s["finish"]) for s in stories.values() if s.get("finish")]
    S = ["# スケジュール（週ごと）", "", "■＝期間 ★＝クリティカルパス ▲＝節目", ""]
    if dates:
        d0, d1 = min(dates), max(dates); d0 -= dt.timedelta(days=d0.weekday()); weeks = []
        w = d0
        while w <= d1: weeks.append(w); w += dt.timedelta(days=7)
        S.append("| チケット | 担当 | " + " | ".join(w.strftime("%m/%d") for w in weeks) + " |"); S.append("|---|---|" + "---|" * len(weeks))
        for e in epics.values():
            S.append(f"| **{e['id']} {e['title']}** | | " + " | ".join("" for _ in weeks) + " |")
            for k in e["children"]:
                s = stories[k]
                if not s.get("start"): S.append(f"| {s['id']} {s['title'][:28]} | ★未割り当て | " + " | ".join("" for _ in weeks) + " |"); continue
                a_, b_ = D(s["start"]), D(s["finish"]); cells = []
                for w in weeks:
                    we = w + dt.timedelta(days=6); cells.append(("★" if s["critical"] else "■") if (a_ <= we and b_ >= w) else "")
                S.append(f"| {s['id']} {s['title'][:28]} | {s.get('assignee') or (s.get('tentative_assignee','') + ' 仮')} | " + " | ".join(cells) + " |")
        S += ["", "## 節目"] + [f"- ▲ {m['id']} {m['name']} {m['due']}" for m in ms]
        if out["summary"]["milestone_overrun"]: S += ["", "## 節目を超えるもの（赤）"] + [f"- ★ {x}" for x in out["summary"]["milestone_overrun"]]
    (d / "schedule.md").write_text("\n".join(S), encoding="utf-8")
    A = ["# 割り当て", "", "| 人 | 技能 | 1 日 | 負荷（h） | チケット |", "|---|---|---|---|---|"]
    for m in members:
        mine = [s["id"] for s in stories.values() if (s.get("assignee") == m.id or s.get("tentative_assignee") == m.id)]
        A.append(f"| {m.name} | {', '.join(sorted(m.skills))} | {m.hpd}h | {round(m.load,1)} | {', '.join(mine)} |")
    un = out["summary"]["unassignable"]
    A += ["", "## 割り当てられる人が居ない（赤）"] + ([f"- ★ {k} {stories[k]['title']}（層 {stories[k]['layer']}：名簿にこの技能の人が居ない）" for k in un] or ["- なし"])
    (d / "assign.md").write_text("\n".join(A), encoding="utf-8")

if __name__ == "__main__": sys.exit(main())
