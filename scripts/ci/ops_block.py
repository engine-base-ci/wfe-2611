#!/usr/bin/env python3
"""操作の行のうち「今は押せない」ものを、理由つき BLOCKED で機械的に書く（説明文の PASS を書かせないための正直な逃げ道は 1 つだけ）。

  python3 scripts/ci/ops_block.py --spec 07_qa/test-specs --tickets 07_tasks/tickets.json --screens 07_functional/screens.json --pages apps/web/app [--blocked <spec>/ops-blocked.json]

規則:
  B1 リンク（op=link:…→<画面>）と「到達性」の行で、行き先の画面のページがまだ無い（apps/<web>/app に page.tsx が無い）→ BLOCKED（自動：画面 X は T-U-NN 未実装…）
  B2 <spec>/ops-blocked.json の {行 ID: 理由} → BLOCKED（理由）。理由には必ず依存するタスク ID（T-…）を含める（無い理由は書けない）
  B3 自動で書いた BLOCKED は、行き先が実装された／依存タスクが done になったら空に戻す（＝op_gate で赤になり、テストを書くまで done にできない）
  結果が PASS の行は触らない。プロジェクト名は持たない。
"""
from __future__ import annotations
import argparse, glob, json, os, re, sys

AUTO = "BLOCKED（自動："


def route_dir(route: str) -> str:
    return re.sub(r":(\w+)", r"[\1]", route.strip("/"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True); ap.add_argument("--tickets", required=True); ap.add_argument("--screens", required=True); ap.add_argument("--pages", required=True)
    ap.add_argument("--blocked", default="")
    a = ap.parse_args()
    S = {s["id"]: s for s in json.load(open(a.screens, encoding="utf-8"))["items"]}
    T = json.load(open(a.tickets, encoding="utf-8"))["tasks"]
    task_of = {sid: t["id"] for t in T for sid in (t.get("screen_ids") or [])}
    done = {t["id"] for t in T if t.get("status") == "done"}
    pages = {p.split("/page.tsx")[0] for p in glob.glob(os.path.join(a.pages, "**", "page.tsx"), recursive=True)}
    def implemented(sid: str) -> bool:
        r = S.get(sid, {}).get("route")
        if not r:
            return False
        rd = route_dir(r)
        return any(p.endswith("/" + rd) or p.endswith(")/" + rd) or p == os.path.join(a.pages, rd) for p in pages)
    explicit = json.load(open(a.blocked or os.path.join(a.spec, "ops-blocked.json"), encoding="utf-8")) if os.path.exists(a.blocked or os.path.join(a.spec, "ops-blocked.json")) else {}
    for rid, why in ((k, v) for k, v in explicit.items() if not k.startswith("_")):
        if not re.search(r"T-[A-Z]+-\d+", why):
            print(f"  ✗ ops-blocked.json {rid}: 理由に依存するタスク ID が無い"); return 2
    n_set = n_clear = 0
    for fp in glob.glob(os.path.join(a.spec, "**", "*.md"), recursive=True):
        lines = open(fp, encoding="utf-8").read().split("\n"); changed = False
        for i, ln in enumerate(lines):
            if not ln.startswith("| ") or ln.startswith("| ID "):
                continue
            c = ln.split("|")
            if len(c) < 12:
                continue
            rid, view, item, res, note = c[1].strip(), c[3].strip(), c[4].strip(), c[8].strip(), c[9].strip()
            if res.startswith("PASS"):
                continue
            target = None
            m = re.search(r"op=link:.*→([a-z0-9-]+)$", note)
            if m: target = m.group(1)
            m2 = re.match(r"^リンク先 ([a-z0-9-]+) が", item) if view == "到達性" else None
            if m2: target = m2.group(1)
            want = ""
            if target and not implemented(target):
                want = f"{AUTO}行き先の画面 {target} は {task_of.get(target, '?')} で実装（未着手）。href は flow の route と機械照合済み・押すと 404 になるので今は押せない）"
            elif rid in explicit:
                deps = re.findall(r"T-[A-Z]+-\d+", explicit[rid])
                if not all(d in done for d in deps):
                    want = f"{AUTO}{explicit[rid]}）"
            if want and (not res or res.startswith(AUTO)):
                if res != want:
                    c[8] = f" {want} "; lines[i] = "|".join(c); changed = True; n_set += 1
            elif not want and res.startswith(AUTO):
                c[8] = "  "; lines[i] = "|".join(c); changed = True; n_clear += 1
        if changed:
            open(fp, "w", encoding="utf-8").write("\n".join(lines))
    print(f"BLOCKED（自動）を書いた {n_set} 行・解除した {n_clear} 行（解除した行は op_gate で赤＝テストを書く）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
