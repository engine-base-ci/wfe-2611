#!/usr/bin/env python3
"""qa_delta.py — 途中変更（チケットの修正・仕様の更新・追加）のとき、テストを 1 から作り直さない。
変えたところ（直接）と、そこに依存するところ（派生）だけを正本から機械で選び、他は触らない。

なぜ必要か（2026-09-15・user 指摘）
  タスクやチケットが途中で修正・更新・追加になるたびにテスト仕様書を 1 から作り直し、関係ない部分まで
  もう一度テストしていた。二度手間で、しかも変更に派生した影響（遷移元・同じ API・同じ台帳・依存タスク）は
  かえって漏れる。正本の行は ID を変えず、差分は「更新（見直す）／再実行（派生）／追加（行が無い）／対象外」に分ける。

入力（あるものだけ使う。全部無くても --changed だけで動く）
  --spec      テスト仕様書の正本フォルダ（markdown 表。列名に「画面」「タスク」「実行条件」を含む。ID は先頭列）
  --tickets   tickets.json（tasks[].id / screen_ids / api_endpoints / entity_ids / depends_on / qa_rows）
  --screens   screens.json（screens[].id / transitions / related_apis / entities）
  --flow      flow.json（screens[].id / objects / source、act_to_screen、navigation）
  --journeys  journeys/plan.json（rows[].id / screen / screens / runnable_after）
  --changed   変えたものの ID（複数）：タスク T-xx／画面 id／API "POST /api/x"／エンティティ名／決定 D-xxx／行 ID
  --git-base  git の差分から変更ファイルを拾い、screens.json の file/path 列で画面に当てる（任意）
出力
  .qa/delta/<日時>.json と同名 .md。--gate で「追加が要るのに行が無い」「1 から作り直した」を非ゼロ終了にする。
  --prev <前回の json> を渡すと、対象外だった行の ID が消えていたら「作り直した」と判定する。
  --selftest で内蔵の小さな例で動きを確かめる。
"""
from __future__ import annotations
import argparse, json, re, sys, subprocess, datetime
from collections import defaultdict
from pathlib import Path

ROW_ID = re.compile(r"^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d{2,3}$")
TASK_ID = re.compile(r"^T-[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)?-\d+[a-z]?$")
API_ID = re.compile(r"^(GET|POST|PUT|PATCH|DELETE)\s+/")
DEC_ID = re.compile(r"^D-\d{3}$")

def load_rows(spec: Path):
    rows = []
    if not spec or not spec.exists(): return rows
    for f in sorted(spec.rglob("*.md")):
        head = None
        for line in f.read_text(encoding="utf-8").splitlines():
            if not line.startswith("|"): head = None; continue
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if head is None:
                if any(k in "".join(cells) for k in ("画面", "タスク", "実行条件", "テスト")): head = cells
                continue
            if set("".join(cells)) <= set("-: "): continue
            if not cells or not ROW_ID.match(cells[0]): continue
            d = dict(zip(head, cells)); rid = cells[0]
            g = lambda *ks: next((d[k] for k in ks if k in d and d[k]), "")
            rows.append({"id": rid, "file": str(f.relative_to(spec)), "screen": g("画面", "画面ID", "screen"), "task": g("タスク", "task"),
                         "cond": g("実行条件", "cond") or "L1", "text": " ".join(cells[1:6])})
    return rows

def build_graph(tickets, screens, flow):
    """edges[x] = x が触るもの（下流）。rev[y] = y を触るもの（上流＝派生の元）"""
    edges = defaultdict(set)
    if tickets:
        for t in tickets.get("tasks", []):
            for k in ("screen_ids", "api_endpoints", "entity_ids"):
                for v in t.get(k, []) or []: edges[t["id"]].add(v)
            for v in t.get("depends_on", []) or []: edges[t["id"]].add(v)
            for rid in (t.get("qa_rows") or {}).get("l1", []): edges[t["id"]].add(rid)
    if screens:
        for s in screens.get("screens", []):
            sid = s.get("id");
            if not sid: continue
            for tr in s.get("transitions", []) or []:
                to = tr.get("to") if isinstance(tr, dict) else tr
                if to: edges[sid].add(to)
            for api in s.get("related_apis", []) or []:
                edges[sid].add(api if isinstance(api, str) else f'{api.get("method","")} {api.get("path","")}'.strip())
            for e in s.get("entities", []) or []: edges[sid].add(e)
    if flow:
        for s in flow.get("screens", []):
            for o in s.get("objects", []) or []: edges[s["id"]].add(o)
            for d in s.get("source", []) or []: edges[d].add(s["id"])          # 決定 → 画面
        for aid, sids in (flow.get("act_to_screen") or {}).items():
            for sid in sids: edges[aid].add(sid.replace("new:", ""))
        for sid, subs in ((flow.get("navigation") or {}).get("sub_by_screen") or {}).items():
            pass
    rev = defaultdict(set)
    for x, ys in edges.items():
        for y in ys: rev[y].add(x)
    return edges, rev

def classify(changed, rows, edges, rev, journeys):
    direct = set(changed)
    # 変えたタスクが触る画面・API・エンティティも「直接」
    for c in list(changed):
        if TASK_ID.match(c) or DEC_ID.match(c) or c.startswith("A"):
            direct |= edges.get(c, set())
    # 派生 = 直接のものを触る・そこへ遷移する・同じ API／エンティティを使う画面やタスク（1 段）
    dep = set()
    for d in direct:
        dep |= rev.get(d, set())
        for x in edges.get(d, set()):                 # 同じ API / エンティティを使う他の画面
            if API_ID.match(x) or not x.startswith(("T-", "D-")):
                dep |= {s for s in rev.get(x, set()) if s not in direct}
    dep -= direct
    def hit(row, ids):
        keys = {row["id"], row["screen"], row["task"]}
        return bool(keys & ids) or any(t in ids for t in re.split(r"[,\s、/]+", row["task"] or ""))
    upd = [r for r in rows if hit(r, direct)]
    rerun = [r for r in rows if r not in upd and hit(r, dep)]
    other = [r for r in rows if r not in upd and r not in rerun]
    covered = {r["screen"] for r in upd} | {r["task"] for r in upd} | {r["id"] for r in upd}
    for r in upd:
        for t in re.split(r"[,\s、/]+", r["task"] or ""): covered.add(t)
    missing = sorted(c for c in direct if c not in covered and not DEC_ID.match(c) and not API_ID.match(c) and not c.startswith("A"))
    flows = set()
    for jr in (journeys or {}).get("rows", []):
        scr = set(([jr.get("screen")] if jr.get("screen") else []) + (jr.get("screens") or []))
        if scr & direct or scr & dep or set(jr.get("runnable_after") or []) & direct:
            fid = re.sub(r"-\d+$", "", jr.get("id", "")) or jr.get("flow", "")
            if fid: flows.add(fid)
    return direct, dep, upd, rerun, other, missing, sorted(flows)

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec"); ap.add_argument("--tickets"); ap.add_argument("--screens"); ap.add_argument("--flow"); ap.add_argument("--journeys")
    ap.add_argument("--changed", nargs="*", default=[]); ap.add_argument("--git-base"); ap.add_argument("--out"); ap.add_argument("--prev")
    ap.add_argument("--gate", action="store_true"); ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest: return selftest()
    J = lambda p: json.load(open(p, encoding="utf-8")) if p and Path(p).exists() else None
    rows = load_rows(Path(a.spec)) if a.spec else []
    tickets, screens, flow, journeys = J(a.tickets), J(a.screens), J(a.flow), J(a.journeys)
    changed = set(a.changed)
    if a.git_base and screens:
        files = subprocess.run(["git", "diff", "--name-only", f"{a.git_base}...HEAD"], capture_output=True, text=True).stdout.split()
        for s in screens.get("screens", []):
            for key in ("file", "path", "files", "route_file"):
                v = s.get(key)
                vs = v if isinstance(v, list) else ([v] if v else [])
                if any(f in vs or any(f.endswith(x) for x in vs) for f in files): changed.add(s["id"])
    if not changed: print("変えたものが空です（--changed か --git-base）"); return 2
    edges, rev = build_graph(tickets, screens, flow)
    direct, dep, upd, rerun, other, missing, flows = classify(changed, rows, edges, rev, journeys)
    rebuilt = None
    if a.prev and Path(a.prev).exists():
        prev = json.load(open(a.prev, encoding="utf-8"))
        prev_other = set(prev.get("untouched_ids", []))
        now_ids = {r["id"] for r in rows}
        lost = sorted(prev_other - now_ids)
        rebuilt = len(lost) > max(3, len(prev_other) * 0.3)
        if lost: print(f"注意：前回「対象外」だった行が {len(lost)} 行消えています → 1 から作り直していないか")
    res = {"at": datetime.datetime.now().isoformat(timespec="seconds"), "changed": sorted(changed), "direct": sorted(direct), "dependent": sorted(dep),
           "update_rows": [r["id"] for r in upd], "rerun_rows": [r["id"] for r in rerun], "untouched_ids": [r["id"] for r in other],
           "missing": missing, "flows_rerun": flows, "rebuilt": rebuilt}
    out = Path(a.out) if a.out else Path(".qa/delta") / (datetime.datetime.now().strftime("%Y%m%d-%H%M%S") + ".json")
    out.parent.mkdir(parents=True, exist_ok=True); out.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    md = [f"# テストの差分（{res['at']}）", "", f"変えたもの: {', '.join(res['changed'])}", f"直接: {len(direct)} / 派生: {len(dep)}", "",
          f"## 見直す（更新）{len(upd)} 行", *[f"- {r['id']} {r['screen']} {r['task']} — {r['text'][:60]}" for r in upd], "",
          f"## 再実行（派生）{len(rerun)} 行", *[f"- {r['id']} {r['screen']} {r['task']}" for r in rerun], "",
          f"## 再実行する流れ {len(flows)}", *[f"- {f}" for f in flows], "",
          f"## 行を足す（変えたのに行が無い）{len(missing)}", *[f"- {m}" for m in missing], "",
          f"## 対象外（依存なし・触らない）{len(other)} 行"]
    out.with_suffix(".md").write_text("\n".join(md), encoding="utf-8")
    print("\n".join(md[:8])); print(f"… 詳細: {out.with_suffix('.md')}")
    if a.gate and (missing or rebuilt):
        print("FAIL —", ("行を足す: " + ", ".join(missing)) if missing else "", "1 から作り直している" if rebuilt else ""); return 2
    print("PASS — 差分のテスト対象を確定"); return 0

def selftest() -> int:
    import tempfile
    d = Path(tempfile.mkdtemp()); spec = d / "specs"; spec.mkdir()
    (spec / "goals.md").write_text("| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |\n|---|---|---|---|---|---|---|---|---|---|---|\n"
        "| GO-001 | goals | a | b | c | d | e | | | T-G-1 | L1 |\n| GO-002 | goal-edit | a | b | c | d | e | | | T-G-2 | L1 |\n| TS-001 | tasks | a | b | c | d | e | | | T-T-1 | L1 |\n| LG-001 | login | a | b | c | d | e | | | T-L-1 | L1 |\n", encoding="utf-8")
    tickets = {"tasks": [{"id": "T-G-1", "screen_ids": ["goals"], "api_endpoints": ["GET /api/goals"], "qa_rows": {"l1": ["GO-001"]}},
                         {"id": "T-G-2", "screen_ids": ["goal-edit"], "depends_on": ["T-G-1"], "qa_rows": {"l1": ["GO-002"]}},
                         {"id": "T-T-1", "screen_ids": ["tasks"], "api_endpoints": ["GET /api/goals"], "qa_rows": {"l1": ["TS-001"]}},
                         {"id": "T-L-1", "screen_ids": ["login"], "qa_rows": {"l1": ["LG-001"]}}]}
    screens = {"screens": [{"id": "goals", "transitions": [{"to": "goal-edit"}], "related_apis": ["GET /api/goals"]}, {"id": "tasks", "related_apis": ["GET /api/goals"]}, {"id": "login"}]}
    journeys = {"rows": [{"id": "J-10-01", "screen": "goals"}, {"id": "J-20-01", "screen": "login"}]}
    rows = load_rows(spec); edges, rev = build_graph(tickets, screens, None)
    direct, dep, upd, rerun, other, missing, flows = classify({"T-G-1"}, rows, edges, rev, journeys)
    assert [r["id"] for r in upd] == ["GO-001"], upd
    assert "tasks" in dep and "T-G-2" in dep, dep                     # 同じ API を使う画面・依存するタスクが派生
    assert [r["id"] for r in rerun] == ["GO-002", "TS-001"], rerun
    assert [r["id"] for r in other] == ["LG-001"], other              # 関係ない login は触らない
    assert flows == ["J-10"], flows
    direct, dep, upd, rerun, other, missing, flows = classify({"new-screen"}, rows, edges, rev, journeys)
    assert missing == ["new-screen"], missing                         # 変えたのに行が無い → 追加が要る
    print("selftest ok: 直接 1 行・派生 2 行・対象外 1 行・流れ 1・行が無いもの検出"); return 0

if __name__ == "__main__": sys.exit(main())
