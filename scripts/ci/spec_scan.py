#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""概念を指定して影響範囲を抽出する（spec-sync STEP 2）。
 依存マップの alignment_decisions と、概念のキーワード群から該当行を機械的に出す。"""
import os, re, sys, json, yaml, collections

CONCEPTS = {
 "AD-005": {
   "label": "目標の親子関係は同一単位とは限らない",
   "patterns": [
     r"未配分", r"goal_allocations", r"allocated_value", r"target_value",
     r"unit_id", r"goal_kinds", r"progress_strategy",
     r"配分", r"親の target", r"配り", r"A23",
   ],
   "exclude_paths": [".git", "__pycache__", "node_modules", ".spec-sync", "spec_scan.py"],
 }
}

def scan(cid):
    c = CONCEPTS[cid]
    pats = [re.compile(p) for p in c["patterns"]]
    hits = collections.defaultdict(list)
    for root, _, fs in os.walk('.'):
        if any(x in root for x in c["exclude_paths"]): continue
        for f in sorted(fs):
            if not f.endswith(('.md','.json','.yaml','.py','.html')): continue
            p = os.path.join(root, f).replace('./','')
            if any(x in p for x in c["exclude_paths"]): continue
            try: t = open(p, encoding='utf-8').read()
            except Exception: continue
            for ln, line in enumerate(t.split('\n'), 1):
                for pat in pats:
                    if pat.search(line):
                        hits[p].append((ln, pat.pattern, line.strip()[:110])); break
    return hits

cid = sys.argv[1] if len(sys.argv) > 1 else "AD-005"
hits = scan(cid)
c = CONCEPTS[cid]
total = sum(len(v) for v in hits.values())
print(f"概念 {cid} — {c['label']}")
print(f"該当 {len(hits)} ファイル / {total} 行\n")

# 役割で分類
ROLE = [
 ("正本（信頼源）", ["05_flow/flow.json", "05_flow/data.py", "03_architecture/ER図.md"]),
 ("生成物（正本から自動生成・手で直さない）", ["05_flow/flow.html", "05_flow/使ってもらい方.md", "06_mockup/v1/"]),
 ("記録（改訂として追記）", ["01_hearing/決定ログ_進行中.md"]),
 ("画面の中身（手で直す）", ["06_mockup/s_", "06_mockup/build"]),
 ("その他", []),
]
for name, prefixes in ROLE:
    grp = {p: v for p, v in hits.items()
           if (any(p.startswith(x) for x in prefixes) if prefixes
               else not any(any(p.startswith(y) for y in pp) for _, pp in ROLE[:-1]))}
    if not grp: continue
    print(f"■ {name}")
    for p in sorted(grp):
        print(f"   {p}  ({len(grp[p])}行)")
        for ln, pat, line in grp[p][:4]:
            print(f"      L{ln:<5} {line}")
        if len(grp[p]) > 4: print(f"      … 他 {len(grp[p])-4} 行")
    print()
