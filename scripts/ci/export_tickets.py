#!/usr/bin/env python3
"""export_tickets.py — tickets_plan.json を GitHub Issues（gh のシェル。実行はしない）／Linear CSV／Jira CSV に書き出す。親子は task list と Parent 列。"""
import argparse, csv, json, sys
from pathlib import Path
def body(t, T):
    L = [f"Parent: {t.get('parent') or '—'}", f"Layer: {t.get('layer','')} / Estimate: {t.get('estimate_hours','')}h / {t.get('start','')}→{t.get('finish','')}" + (" / ★critical" if t.get("critical") else "")]
    if t.get("depends_on"): L.append("Blocked by: " + ", ".join(t["depends_on"]))
    lk = t.get("links") or {}
    for k, lab in (("mock", "モック"), ("screens", "画面"), ("decisions", "決定の文"), ("acts", "行為"), ("qa_rows", "テスト行"), ("errors", "エラー")):
        if lk.get(k): L.append(f"{lab}: " + ", ".join(map(str, lk[k])))
    kids = [T[c] for c in t.get("children", []) if c in T]
    if kids: L += ["", "## やること"] + [f"- [{'x' if c.get('status') == 'done' else ' '}] {c['id']} {c['title']}" for c in kids]
    return "\n".join(L)
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("plan"); ap.add_argument("--github"); ap.add_argument("--csv", action="append", default=[]); ap.add_argument("-o", "--out", default="07_tasks/export"); a = ap.parse_args()
    P = json.load(open(a.plan, encoding="utf-8")); T = {t["id"]: t for t in P["tickets"]}; out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    stories = [t for t in P["tickets"] if t["kind"] in ("epic", "story") and t.get("status") != "dropped"]
    if a.github:
        sh = ["#!/usr/bin/env bash", "# 生成物。人が見てから流す：bash github-issues.sh", f"REPO={a.github}", "set -e"]
        for t in stories:
            labels = t["kind"] + (f",layer:{t['layer']}" if t.get("layer") else "") + (",critical" if t.get("critical") else "")
            asg = f' --assignee "{t["assignee"]}"' if t.get("assignee") else ""
            sh.append(f'gh issue create --repo "$REPO" --title {json.dumps(t["id"] + " " + t["title"], ensure_ascii=False)} --label "{labels}"{asg} --body {json.dumps(body(t, T), ensure_ascii=False)}')
        (out / "github-issues.sh").write_text("\n".join(sh) + "\n", encoding="utf-8"); print(f"{out}/github-issues.sh（{len(stories)} 件・実行はしていない）")
    for kind in a.csv:
        p = out / f"{kind}.csv"
        with open(p, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            if kind == "linear": w.writerow(["Title", "Description", "Parent", "Assignee", "Due Date", "Labels", "Status", "Blocked by"])
            else: w.writerow(["Summary", "Description", "Issue Type", "Epic Link", "Assignee", "Due Date", "Labels", "Status", "Issue Links"])
            for t in stories:
                row = [f'{t["id"]} {t["title"]}', body(t, T)]
                if kind == "linear": row += [t.get("parent") or "", t.get("assignee") or "", t.get("finish") or "", t.get("layer") or "", t.get("status"), ";".join(t.get("depends_on") or [])]
                else: row += ["Epic" if t["kind"] == "epic" else "Story", t.get("parent") or "", t.get("assignee") or "", t.get("finish") or "", t.get("layer") or "", t.get("status"), ";".join(f"blocks:{d}" for d in t.get("depends_on") or [])]
                w.writerow(row)
        print(f"{p}（{len(stories)} 件）")
    return 0
if __name__ == "__main__": sys.exit(main())
