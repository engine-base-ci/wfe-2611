# -*- coding: utf-8 -*-
"""data.py から flow.json（信頼源）を生成する。三層出力の1層目。
 ★全要素に source（根拠の決定ID）を持たせる。
   正本: .claude/rules/common/decision-traceability.md（要約が正本になりすますのを防ぐ）"""
import json, sys, collections
sys.path.insert(0, '.')
import data as D

# 画面→行為 の逆引きを機械生成（手で書かない）
s2a = collections.defaultdict(list)
for aid, scr in D.ACT2SCREEN.items():
    for s in scr: s2a[s.replace('new:', '')].append(aid)

# 画面が見える役割も行為から導出する。
# ★主ナビに出るか（navigation.by_role）と、権限があるか（roles）は別物。詳細画面は主ナビに出ないが権限はある。
ACT = {a[0]: dict(zip(('id', 'act', 'roles', 'jobs', 'frequency', 'release', 'source'), a))
       for _, rows in D.BACKBONE for a in rows}
s2r = {sid: sorted({r for aid in aids for r in ACT[aid]['roles']}) for sid, aids in s2a.items()}

flow = {
 "version": "2.0", "project": "Kaname", "created_at": "2026-09-09",
 "_doc": "画面は行為から導出する。ここに無い画面は作らない。ここにあって画面が無いものは抜け。"
         "全要素の source は 01_hearing/決定ログ_進行中.md の決定ID。",
 "_rules": [".claude/rules/common/screen-derivation.md",
            ".claude/rules/common/decision-traceability.md",
            ".claude/rules/common/choke-points.md"],
 "_gate": "python3 scripts/ci/flow_gate.py --flow 05_flow/flow.json --mocks 06_mockup/v1 "
          "--choke 03_architecture/choke-points.json && python3 scripts/ci/trace_gate.py",
 "_core_model": "人は自分のAI（自分の代理人）と会話する。自分のAIが会社モデルを組み立て、AI社員に指示を配り、"
                "上がってきた結果を一次確認して人に上げる。画面は入力欄ではなく、確認と管理の場（D-010/D-024/D-037）。",
 "meta": {"id": "flow-meta", "name": "この flow.json の作り方",
          "why": "画面から始めると『この画面で何をしたいか分からない』が必ず起きる。役割×用事→行為の背骨→"
                 "オブジェクト→ブループリント→画面→導線 の順で導出した。",
          "source": ["D-053","D-053.1","D-053.2"]},
 "roles": [{"id": i, "name": n, "desc": d, "frequency": f, "source": s} for i, n, d, f, s in D.ROLES],
 "jobs": [{"id": i, "statement": st, "roles": r, "when": w, "pain": p, "source": s}
          for i, st, r, w, p, s in D.JOBS],
 "backbone": [{"phase": ph, "acts": [
     {"id": i, "act": a, "roles": r, "jobs": j, "frequency": f, "release": rel,
      **({"milestone": D.MILESTONE[i]} if i in getattr(D, "MILESTONE", {}) else {}), "source": s}
     for i, a, r, j, f, rel, s in rows]} for ph, rows in D.BACKBONE],
 "walking_skeleton": D.SKELETON,
 "product_states": [{"id": i, "name": n, "after_act": a, "caps": c, "source": src} for i, n, a, c, src in D.PRODUCT_STATES],
 "objects": [{"name": n, "desc": d, "relates_to": r, "source": s} for n, d, r, s in D.OBJECTS],
 "blueprint": {k: {"id": k, "human": h, "screen": sc, "auto": au, "backstage": b,
                   "choke_points": c, "source": s}
               for k, (h, sc, au, b, c, s) in D.BLUEPRINT.items()},
 "act_to_screen": D.ACT2SCREEN,
 "deferred": D.DEFERRED,
 "account_events": D.ACCOUNT_EVENTS,
 "surface_map": D.SURFACE_MAP,
 "screens": [{"id": sid, "name": n, "acts": sorted(s2a[sid]), "purpose": p,
              "primary_action": pa, "objects": o, "roles": s2r.get(sid, []),
              "route": D.ROUTES[sid], "release": rel,
              **({"milestone": D.MILESTONE_SCREENS[sid]} if sid in getattr(D, "MILESTONE_SCREENS", {}) else {}),
              "needs_login": sh, "has_shell": sh, "source": s}
             for sid, (n, p, pa, o, rel, sh, s) in D.SCREENS.items()],
 "navigation": {
   "_rule": "主ナビは6本まで。フェーズ順で並べ、役割で出る本数が変わる。中は第2ナビ（タブ）で分ける。"
            "全画面同一の第2ナビは規約違反。",
   "_why_six": "16項目のフラットなサイドバーは分かりづらくUXを落とす（2026-09-09 user 指摘）",
   "sections": [{"key": k, "label": l, "icon": ic, "screens": ss, "source": s}
                for k, l, ic, ss, s in D.NAV_SECTIONS],
   "sections_by_role": D.NAV_SECTIONS_BY_ROLE,
   # 主ナビに出る画面は導出物。手で並べない（section の画面 × その役割の権限）
   "shell_rule": {"id": "shell-rule", "name": "枠の導出",
     "rule": "needs_login=false → 外（枠なし）／ app ∉ caps(時点) → はじめの設定（手順バーだけ）／ それ以外 → アプリ（サイドバー・第2ナビ・下タブ・パネル）。画面ごとに手で決めない",
     "frames": ["outside", "wizard", "app"], "source": ["D-065"]},
   "assistant_panel": D.ASSISTANT_PANEL,
   "fallbacks": D.FALLBACKS,
   "conversation_layers": {"id": "conversation-layers", "layers": ["領域（担当業務・部署から自動）", "対象（台帳・目標の1件）", "流れ（時間）"], "source": ["D-062"]},
   "by_role": {r: [sid for k in keys for _, _, _, ss, _ in [next(x for x in D.NAV_SECTIONS if x[0] == k)]
                   for sid in ss if r in s2r.get(sid, [])]
               for r, keys in D.NAV_SECTIONS_BY_ROLE.items()},
   "sub_by_screen": {k: [{"label": l, "desc": d} for l, d in v] for k, v in D.SUBNAV.items()},
   "sub_mode": {"id": "sub-mode", "name": "第2ナビの形", "default": "column", "by_screen": D.SUBNAV_MODE,
                "rule": "既定は左の列（絞り込み）。一日の流れを持つ入口画面は anchors＝上の帯で、押すと該当の段へ送る（隠さない）", "source": ["D-070", "D-059"]},
   "main_width": {"id": "main-width", "name": "本文の最小幅", "min_px": 720,
                  "rule": "幅 1180 以上で本文（.main。三画面では中央）が 720px を下回る組み合わせを作らない。自分のAIのパネルを開いて下回るなら第2ナビを上の帯に畳む。パネルの既定は本文が 720 を保てるときだけ開く", "source": ["D-070", "D-064", "D-065", "D-072"]},
   "layout": {"id": "layout", "name": "画面の型", "default": "page", "by_screen": D.LAYOUT,
              "rule": "一覧から 1 件を選んで裁く画面（今日・承認待ち・タスク）は三画面＝左に一覧（380・1 行 48px・罫線・親子で開ける。時間の帯はタスクの一覧だけ）／中央に選んだ 1 件（パネルを開いて 640 以上・閉じて 720 以上）／右に自分のAIのパネル（常に見える）。列ごとに別々にスクロールし、ページはスクロールしない。その画面ではサイドバーをレール（72・アイコン＋名前）に畳む。1023 以下は一覧と中身を切り替える。サイドバーは中間色（紺の面をやめる）", "source": ["D-072", "D-070"]},
 },
}
json.dump(flow, open('flow.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

na = sum(len(p['acts']) for p in flow['backbone'])
print(f"flow.json — 役割{len(flow['roles'])} 用事{len(flow['jobs'])} 行為{na} "
      f"オブジェクト{len(flow['objects'])} 画面{len(flow['screens'])}"
      f"（v1={sum(1 for s in flow['screens'] if s['release']=='v1')}）")
for label, bad in [
    ("行為が空の画面", [s['id'] for s in flow['screens'] if not s['acts']]),
    ("見える役割が空の画面", [s['id'] for s in flow['screens'] if not s['roles']]),
    ("source が空の画面", [s['id'] for s in flow['screens'] if not s['source']]),
    ("source が空の行為", [a['id'] for p in flow['backbone'] for a in p['acts'] if not a['source']]),
    ("source が空のオブジェクト", [o['name'] for o in flow['objects'] if not o['source']]),
]:
    print(f"{label}:", bad or "なし")
used = {d for s in flow['screens'] for d in s['source']} | {d for p in flow['backbone'] for a in p['acts'] for d in a['source']} \
     | {d for o in flow['objects'] for d in o['source']} | {d for r in flow['roles'] for d in r['source']} \
     | {d for j in flow['jobs'] for d in j['source']} | {d for b in flow['blueprint'].values() for d in b['source']} \
     | {d for n in flow['navigation']['sections'] for d in n['source']}
print(f"参照した決定: {len(used)} 件")
