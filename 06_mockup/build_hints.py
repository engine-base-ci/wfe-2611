# -*- coding: utf-8 -*-
"""flow.json → mock-contract-hints.json（ui-mockup 出力③・api-design の入力）。手で書かない。"""
import json
f=json.load(open('../05_flow/flow.json',encoding='utf-8'))
bp=f['blueprint']; acts={a['id']:a for p in f['backbone'] for a in p['acts']}; sub=f['navigation']['sub_by_screen']
hints={"version":"3.1","generated_from":"05_flow/flow.json","_doc":"画面が必要とするデータ・操作・遷移。api-design の Mock-Driven Contract Generation の入力。手で書かない","screens":[]}
for s in f['screens']:
    ops=[{"act":a,"label":acts[a]['act'],"auto":bp[a]['auto'],"backstage":bp[a]['backstage'],"choke_points":bp[a]['choke_points']} for a in s['acts']]
    hints["screens"].append({"id":s['id'],"name":s['name'],"purpose":s['purpose'],"primary_action":s['primary_action'],"data":s['objects'],"operations":ops,
        "second_nav":[x['label'] for x in sub.get(s['id'],[])],"roles":s['roles'],"release":s['release'],"source":s['source']})
json.dump(hints,open('mock-contract-hints.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print("mock-contract-hints.json:", len(hints['screens']), "画面")
