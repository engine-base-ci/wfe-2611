# -*- coding: utf-8 -*-
"""v1 の全画面を1コマンドで作り直す。画面モジュール（s_*.py）は自動で拾う。
 ナビ・目的・主アクション・根拠は flow.json から読む。画面側では書かない。"""
import sys, glob, importlib, os; sys.path.insert(0, '.')
from _shell import page, SCR
from _ps import PS, GENERIC
from _generic import empty_state, stopped_state
from _shell import ICON

JOBS = []
for f in sorted(glob.glob('s_*.py')):
    m = importlib.import_module(f[:-3]); JOBS += m.SCREENS
for rel in {s['release'] for s in SCR.values()}: os.makedirs(rel, exist_ok=True)
built = set()
for job in JOBS:
    sid, states, css, ns = job[:4]; counts = job[4] if len(job) > 4 else None; sub = job[5] if len(job) > 5 else None
    if sid in built: print('★ 重複:', sid)
    g = GENERIC.get(sid, {})
    if g.get('empty'): states = list(states) + [('ge', '空', '本番のデータがまだ無い時点。件数の札は出ない。', empty_state(sid, SCR[sid], ICON.get(sid, 'file')))]
    if g.get('stopped'): states = list(states) + [('gs', 'AI が止まっている', 'PC が閉じている・覚え直し待ち。人の部分はそのまま。AI の部分だけ止まる。', stopped_state(states[0][3]))]
    miss_ps = [st[0] for st in states if st[0] not in PS.get(sid, {})]
    if miss_ps: raise SystemExit(f'★ 時点（data-ps）が未宣言: {sid} {miss_ps} → _ps.py に足す（L-007）')
    states = [(st[0], st[1], st[2], st[3], PS[sid][st[0]]) for st in states]
    rel = SCR[sid]['release']  # 段階ごとの置き場（v1/・v2/）。G9 は置き場ごとにその段階の画面と突き合わせる
    open(f'{rel}/{rel}-{sid}.html', 'w', encoding='utf-8').write(page(rel, sid, states, extra_css=css, no_shell=ns, counts=counts, sub=sub))
    built.add(sid)
want = set(SCR)
miss, extra = want - built, built - want
print(f'生成 {len(built)} 画面 / flow.json の全段階 {len(want)} 画面')
if miss:  print('★ flow.json にあって作っていない:', sorted(miss))
if extra: print('★ 作ったが flow.json に無い:', sorted(extra))
import build_index  # noqa
