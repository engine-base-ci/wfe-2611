#!/usr/bin/env python3
"""backfill_audit.py — done なのに監査の記録（07_tasks/audit/<id>.md）が無いチケットに、正本にある証拠から事後の記録を作る。

  python3 scripts/ci/backfill_audit.py            # 無いものだけ作る
  python3 scripts/ci/backfill_audit.py --dry      # 作らずに一覧

由来（2026-10-20）：layer_audit に「done なのに監査の記録が無い」の検査を足したら 25 本が赤だった。
着手前の記録（pre-flight）は後から書けない。ここで作るのは **事後の記録** で、正本に残っている証拠だけを写す：
  - spec 行（07_qa/test-specs/**/*.md の「タスク」列にこの ID を持つ行）の結果の内訳（PASS／BLOCKED／空）と証拠の印
  - この ID を文に持つ commit
  - handoff（発注者が触る手順）の有無
  - tickets.json の title・source・files_changed
でっち上げない：無いものは「無い」と書く。
"""
from __future__ import annotations
import argparse, glob, json, os, re, subprocess, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)

def rows_for(tid: str):
    out = []
    for f in sorted(glob.glob("07_qa/test-specs/**/*.md", recursive=True)):
        head = None
        for ln in open(f, encoding="utf-8").read().splitlines():
            if not ln.startswith("|"):
                head = None; continue
            cells = [c.strip() for c in ln.strip().strip("|").split("|")]
            if head is None:
                if "結果" in cells and "タスク" in cells: head = cells
                continue
            if set("".join(cells)) <= set("-: ") or len(cells) < len(head): continue
            d = dict(zip(head, cells))
            if tid in re.split(r"[,\s、/]+", d.get("タスク", "")):
                out.append((d.get("ID", ""), f.replace("07_qa/test-specs/", ""), d.get("結果", ""), d.get("実行条件", "")))
    return out

def commits_for(tid: str):
    r = subprocess.run(["git", "log", "--date=short", "--format=%h %ad %s", "--grep", rf"{tid}\b"], capture_output=True, text=True)
    return [x for x in r.stdout.strip().splitlines() if x]

def write(t: dict, dry: bool) -> str:
    tid = t["id"]; rows = rows_for(tid); com = commits_for(tid)
    n = len(rows); p = sum(1 for r in rows if r[2].startswith("PASS")); b = sum(1 for r in rows if r[2].startswith("BLOCKED"))
    e = sum(1 for r in rows if not r[2].strip())
    browser = sum(1 for r in rows if "実 Chrome" in r[2] or "実ブラウザ" in r[2]); unit = sum(1 for r in rows if "vitest" in r[2])
    handoff = os.path.exists(f"07_tasks/handoff/{tid}.md")
    today = datetime.date.today().isoformat()
    md = [f"# {tid} {t.get('title','')}", "",
          f"> **事後の記録**（{today} に `scripts/ci/backfill_audit.py` が正本の証拠から作った）。着手前の記録（着手前に確かめたこと）は残っていない。",
          "> ここにあるのは、spec 行の結果・commit・handoff という **残っている証拠の写し** だけ。無いものは無いと書く。", "",
          "## チケット（tickets.json）",
          f"- 根拠の決定: {', '.join(t.get('source') or []) or '（無し）'}",
          f"- 触ったファイル（宣言）: {', '.join(t.get('files_changed') or [])[:600] or '（無し）'}",
          f"- 状態: {t.get('status')}", "",
          "## 実行した結果（spec 行の結果の列から）",
          f"- 行 {n}：PASS {p}（実ブラウザの印 {browser}・vitest の印 {unit}）／BLOCKED {b}／空 {e}", ""]
    if rows:
        md += ["| 行 | 正本 | 結果 | 段 |", "|---|---|---|---|"]
        md += [f"| {rid} | {f} | {res[:90] or '（空）'} | {cond} |" for rid, f, res, cond in rows]
        md.append("")
    md += ["## この ID を文に持つ commit", *([f"- {c}" for c in com] or ["- （無い。ID を文に持つ commit は残っていない）"]), "",
           "## 発注者が触る手順（handoff）", f"- {'あり：07_tasks/handoff/' + tid + '.md' if handoff else '無し（画面の無いチケットか、手順の生成対象外）'}", "",
           "## 残り", "- 着手前の記録は無い。次にこのチケットを差し戻すときは、着手前の節を先に書く（L-024）", ""]
    path = f"07_tasks/audit/{tid}.md"
    if not dry:
        open(path, "w", encoding="utf-8").write("\n".join(md))
    return f"{tid}: 行 {n}（PASS {p}／BLOCKED {b}／空 {e}）commit {len(com)} handoff {'あり' if handoff else '無し'}"

def main() -> int:
    ap = argparse.ArgumentParser(); ap.add_argument("--dry", action="store_true"); a = ap.parse_args()
    T = json.load(open("07_tasks/tickets.json", encoding="utf-8"))["tasks"]
    miss = [t for t in T if t.get("status") == "done" and not os.path.exists(f"07_tasks/audit/{t['id']}.md")]
    for t in miss:
        print(write(t, a.dry))
    print(f"{'一覧' if a.dry else '作成'} {len(miss)} 本")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
