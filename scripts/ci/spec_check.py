#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""spec-dependencies.yaml の counters / references / deprecated_terms を実データと照合する。
 spec-sync-orchestrator の Tier A / B / C に相当。プロジェクト側に置いて CI で回す。"""
import json, re, os, sys, glob, yaml

M = yaml.safe_load(open('spec-dependencies.yaml', encoding='utf-8'))
fails, warns = [], []

def load(p):
    return json.load(open(p, encoding='utf-8'))

def truth(sot):
    t, f = sot['type'], sot['file']
    if t == 'json_array_length':
        d = load(f)
        return len(d[sot['json_path'].split('.')[1]])
    if t == 'json_nested_array_length':          # $.backbone[*].acts
        d = load(f)
        return sum(len(x['acts']) for x in d['backbone'])
    if t == 'json_filtered_count':               # release=v1 の画面
        d = load(f)
        k, v = list(sot['filter'].items())[0]
        return sum(1 for x in d['screens'] if x.get(k) == v)
    if t == 'json_value':
        d = load(f)
        return d[sot['json_path'].split('.')[1]]
    raise ValueError(t)

# ---------------- Tier A: 数値整合 ----------------
print("== A. 数値整合 ==")
for c in M['counters']:
    real = truth(c['source_of_truth'])
    exp  = c['expected_value']
    if str(real) != str(exp):
        fails.append(f"A[{c['id']}] 正本={real} だがマップの expected_value={exp}")
    ok = True
    for m in c.get('mirrors', []):
        if not os.path.exists(m['file']):
            warns.append(f"A[{c['id']}] 写しのファイルが無い: {m['file']}"); continue
        txt = open(m['file'], encoding='utf-8').read()
        got = re.search(m['regex'], txt)
        if not got:
            fails.append(f"A[{c['id']}] 写しに一致なし: {m['file']}  regex={m['regex']}"); ok = False
        elif got.group(1) != str(real):
            fails.append(f"A[{c['id']}] 写しがズレ: {m['file']} = {got.group(1)} / 正本 = {real}"); ok = False
    print(f"  {'OK ' if ok and str(real)==str(exp) else 'NG '} {c['id']:22} 正本={real} 写し{len(c.get('mirrors',[]))}件")

# ---------------- Tier B: 参照存在 ----------------
print("\n== B. クロスリファレンス ==")
flow = load('05_flow/flow.json')
acts = [a['id'] for p in flow['backbone'] for a in p['acts']]
checks = [
    ("A→blueprint", [a for a in acts if a not in flow['blueprint']]),
    ("A→act_to_screen", [a for a in acts if a not in flow['act_to_screen']]),
    ("R→navigation.by_role", [r['id'] for r in flow['roles'] if r['id'] not in flow['navigation']['by_role']]),
    ("C→choke-points.json", sorted({c for v in flow['blueprint'].values() for c in v['choke_points']}
                                   - {x['id'] for x in load('03_architecture/choke-points.json')['choke_points']})),
    ("J→どの行為からも辿れない", [j['id'] for j in flow['jobs']
        if j['id'] not in {x for p in flow['backbone'] for a in p['acts'] for x in a.get('jobs', [])}]),
]
for name, missing in checks:
    print(f"  {'OK ' if not missing else 'NG '} {name:26} 欠落 {len(missing)}")
    if missing: fails.append(f"B[{name}] 欠落: {missing}")

# ---------------- Tier C: 廃止用語 ----------------
print("\n== C. 廃止用語 ==")
for d in M['deprecated_terms']:
    if d.get('status') == 'pending':
        print(f"  -- {d['term']:22} pending（この変更で確定予定）"); continue
    allowed = d.get('allowed_in', [])
    hit = []
    for root, _, fs in os.walk('.'):
        if any(x in root for x in ('.git', '__pycache__', 'node_modules', '.spec-sync')): continue
        for f in fs:
            if not f.endswith(('.md', '.json', '.yaml', '.py', '.html')): continue
            p = os.path.join(root, f).replace('./', '')
            if any(p.startswith(a.rstrip('/')) for a in allowed): continue
            try: t = open(p, encoding='utf-8').read()
            except Exception: continue
            ctx = d.get('allowed_context')
            for ln, line in enumerate(t.split('\n'), 1):
                if d['term'] not in line: continue
                if ctx and re.search(ctx, line): continue
                hit.append(f"{p}:{ln}")
    print(f"  {'OK ' if not hit else 'NG '} {d['term']:22} 残存 {len(hit)}")
    if hit: fails.append(f"C[{d['term']}] 残存: {hit[:5]}")

# ---------------- 確定事項の反映 ----------------
print("\n== 確定事項（alignment_decisions）==")
for a in M['alignment_decisions']:
    st = a.get('status', 'done')
    mark = '--' if st != 'done' else 'OK'
    print(f"  {mark} {a['id']} {a['decision'][:52]}  [{st}]")

print("\n" + ("=" * 60))
if warns:
    print(f"warn {len(warns)} 件"); [print('   ' + w) for w in warns]
if fails:
    print(f"\nFAIL — {len(fails)} 件"); [print('   ' + f) for f in fails]; sys.exit(1)
print("PASS — A / B / C すべて緑")
