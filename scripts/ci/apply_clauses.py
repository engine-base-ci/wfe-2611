#!/usr/bin/env python3
"""apply_clauses.py — 決めたことの表の提案 JSON（clauses_batch*.json）を正本と導出物に適用する。
   決定ログの節末に ### 決めたこと の表を足し、data.py の要素（role/job/act/object/screen/blueprint）の source に D-xxx.n を足し、
   文書（ER図・設計書・DESIGN）はトレーサビリティ表の行、errors.json は meta.source、selected-stack.json は _decisions に足す。
   out（理由）は clauses_out に、new_objects は proposals_objects.json に出す（人が見て OBJECTS に足す）。"""
import json, re, sys, glob
LOG='01_hearing/決定ログ_進行中.md'; DATA='05_flow/data.py'
PREFIX={"role":' ("{id}",', "job":' ("{id}",', "act":'  ("{id}",', "object":' ("{id}",', "screen":' "{id}":(', "blueprint":' "{id}":('}
def add_src(L, kind, id_, cid):
    pre=PREFIX[kind].format(id=id_)
    idx=[i for i,l in enumerate(L) if l.startswith(pre)]
    if kind in ("role","job","object"): idx=[i for i in idx if i < next((k for k,l in enumerate(L) if l.startswith('SCREENS = {')), 10**9)]
    if kind=="act": idx=[i for i in idx if i < next((k for k,l in enumerate(L) if l.startswith('BLUEPRINT = {')), 10**9)]
    if kind=="blueprint": idx=[i for i in idx if i > next((k for k,l in enumerate(L) if l.startswith('BLUEPRINT = {')), 0)]
    if kind=="screen": idx=[i for i in idx if i > next((k for k,l in enumerate(L) if l.startswith('SCREENS = {')), 0)]
    if not idx: return False
    j=idx[0]
    while not L[j].rstrip().endswith(']),'): j+=1
    if f'"{cid}"' not in L[j]: L[j]=L[j].rstrip()[:-3]+f',"{cid}"]),'
    return True
def main():
    files=sorted(glob.glob(sys.argv[1] if len(sys.argv)>1 else 'clauses_batch*.json'))
    log=open(LOG,encoding='utf-8').read(); L=open(DATA,encoding='utf-8').read().split('\n')
    docs={}; props=[]; miss=[]; stats={"sections":0,"rows":0,"src":0,"out":0,"doc":0}
    for f in files:
        for sec in json.load(open(f,encoding='utf-8')):
            n=sec["section"]; did=sec["decision"]; rows=sec["rows"]
            m=re.search(r'(^## %d\..*?)(?=^## \d+\.|\Z)' % n, log, re.S|re.M); assert m, n
            body=m.group(1)
            if '### 決めたこと' in body: print('skip (has table)', n); continue
            tbl='\n### 決めたこと\n| 項目 | 内容 |\n|---|---|\n'+''.join(f'| {r["item"].replace("|","／")} | {r["body"].replace("|","／").replace(chr(10)," ")} |\n' for r in rows)
            new=body.rstrip('\n')+'\n'+tbl
            outs={}
            for r in rows:
                cid=f'{did}.{r["n"]}'; ok=False
                for s in r.get("sources") or []:
                    if s.get("kind")=="doc" and not __import__("os").path.exists(s["file"].split(" (")[0]):
                        r["out"]=(r.get("out") or "") + f' 反映先は {s["file"]}（機械で辿れない層）'; continue
                    if s.get("kind")=="doc" and s["file"].split(" (")[0] != s["file"]:
                        r["out"]=(r.get("out") or "") + f' 反映先は {s["file"]}（要素に source を置けない）'; continue
                    if s.get("kind")=="doc":
                        docs.setdefault(s["file"],[]).append((cid,r["item"])); ok=True; stats["doc"]+=1
                    elif add_src(L, s["kind"], s["id"], cid): ok=True; stats["src"]+=1
                    else: miss.append(f'{cid}: {s}')
                if not ok:
                    outs[r["n"]]=r.get("out") or "導出物なし（要確認）"; stats["out"]+=1
            if outs:
                mm=re.search(r'(<!-- decision: '+did+r'\n.*?summary:[^\n]*)', new, re.S); assert mm, did
                if 'clauses_out' not in mm.group(1): new=new[:mm.end()]+'\n     clauses_out: {'+', '.join(f'{k}: "{v.replace(chr(34),"”")}"' for k,v in outs.items())+'}'+new[mm.end():]
            log=log[:m.start()]+new+log[m.end():]; stats["sections"]+=1; stats["rows"]+=len(rows)
            for o in sec.get("new_objects") or []: props.append(dict(o, decision=did))
    open(LOG,'w',encoding='utf-8').write(log); open(DATA,'w',encoding='utf-8').write('\n'.join(L))
    for f,items in docs.items():
        if f.endswith('.json'):
            j=json.load(open(f,encoding='utf-8'))
            if 'errors' in j: j.setdefault('meta',{}).setdefault('source',[]); j['meta']['source']+=[c for c,_ in items if c not in j['meta']['source']]
            elif '_decisions' in j: j['_decisions'].setdefault('clauses',[]); j['_decisions']['clauses']+=[c for c,_ in items if c not in j['_decisions']['clauses']]
            else: j.setdefault('_clauses',[]); j['_clauses']+=[c for c,_ in items if c not in j['_clauses']]
            json.dump(j,open(f,'w',encoding='utf-8'),ensure_ascii=False,indent=2)
        elif not f.endswith('.md'):
            print('skip（文書ではない・clauses_out にする）', f, [c for c,_ in items])
        else:
            t=open(f,encoding='utf-8').read().rstrip('\n')
            if t.split('\n')[-1].startswith('|'): t+='\n'+''.join(f'| {c} | {i} | （決めたことの文） |\n' for c,i in items)
            else: t+='\n\n## 決めたことの文の反映（機械追記）\n'+''.join(f'- {c} {i}\n' for c,i in items)
            open(f,'w',encoding='utf-8').write(t.rstrip('\n')+'\n')
    json.dump(props,open('proposals_objects.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
    print(stats); print('要素が見つからない参照', len(miss)); [print('  ',x) for x in miss[:30]]; print('new_objects', len(props))
main()
