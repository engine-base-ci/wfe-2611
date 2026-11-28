#!/usr/bin/env python3
"""sync_status.py — GitHub Issues の状態を tickets_plan.json に引き戻す（status だけ）。手で両方を直さない。"""
import argparse, json, subprocess, sys
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("plan"); ap.add_argument("--github", required=True); a = ap.parse_args()
    P = json.load(open(a.plan, encoding="utf-8"))
    r = subprocess.run(["gh", "issue", "list", "--repo", a.github, "--state", "all", "--limit", "500", "--json", "number,title,state,labels"], capture_output=True, text=True)
    if r.returncode != 0: print("gh が使えない:", r.stderr.strip()[:200]); return 2
    by = {}
    for it in json.loads(r.stdout):
        tid = it["title"].split(" ")[0]; labels = {l["name"] for l in it.get("labels", [])}
        by[tid] = "done" if it["state"].lower() == "closed" else ("in_progress" if "in_progress" in labels else ("review" if "review" in labels else ("blocked" if "blocked" in labels else "todo")))
        for t in P["tickets"]:
            if t["id"] == tid: t.setdefault("external", {})["github"] = it["number"]
    n = 0
    for t in P["tickets"]:
        if t["id"] in by and t.get("status") != by[t["id"]]: t["status"] = by[t["id"]]; n += 1
    json.dump(P, open(a.plan, "w", encoding="utf-8"), ensure_ascii=False, indent=1); print(f"状態を更新 {n} 件（{len(by)} 件を照合）"); return 0
if __name__ == "__main__": sys.exit(main())
