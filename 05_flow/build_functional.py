#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_functional.py — functional-breakdown の 4 JSON ＋ 三方向マトリクスを、flow.json・ER図・モック・エラー一覧から機械生成する。
   人が列挙しない（L-004・L-005）。各要素は上流の source を引き継ぐ（decision-traceability）。
   出力: 07_functional/{entities,features,roles,screens,traceability-matrix}.json ＋ functional-breakdown.md/.html
"""
import json, re, os, glob, datetime
import importlib.util as _ilu_rls, os as _os_rls
_spec_rls = _ilu_rls.spec_from_file_location("rls_policies", _os_rls.path.join(_os_rls.path.dirname(_os_rls.path.abspath(__file__)), "rls_policies.py")); _RLS = _ilu_rls.module_from_spec(_spec_rls); _spec_rls.loader.exec_module(_RLS)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
F = json.load(open("05_flow/flow.json", encoding="utf-8"))
ER = open("03_architecture/ER図.md", encoding="utf-8").read()
ERR = json.load(open("07_qa/test-specs/errors.json", encoding="utf-8"))["errors"]
TODAY = datetime.date.today().isoformat()
OUT = "07_functional"
D = lambda s: sorted(set(re.findall(r"\bD-\d{3}(?:\.\d+)?\b", s)))

# ---------------------------------------------------------------- ER → entities
# 表 → 決定（末尾のトレーサビリティ表）
tbl_dec = {}
for m in re.finditer(r"^\| (D-\d{3}) \|[^|]*\|([^|\n]*)\|", ER, flags=re.M):
    for t in re.findall(r"`([a-z_]+)`", m.group(2)): tbl_dec.setdefault(t, set()).add(m.group(1))
# オブジェクト ↔ テーブル
obj_tbl = {}
mp = ER.split("## オブジェクト ↔ テーブル")[1].split("\n## ")[0]
for m in re.finditer(r"^\| ([^|`\n]+?) \| ([^|\n]*) \|", mp, flags=re.M):
    if m.group(1).strip() in ("オブジェクト", "---"): continue
    obj_tbl[m.group(1).strip()] = [t.split(".")[0].split("(")[0].strip() for t in re.findall(r"`([a-z_.()= ]+)`", m.group(2))]
# 関係（mermaid）
rels = {}
for m in re.finditer(r"^\s*([a-z_]+) (\|\||\}o|o\||\}\|)--(o\{|\|\||o\||\|\{) ([a-z_]+) : \"?([^\"\n]*)\"?", ER, flags=re.M):
    a, b, lab = m.group(1), m.group(4), m.group(5).strip()
    rels.setdefault(a, []).append({"to": b, "label": lab}); rels.setdefault(b, []).append({"from": a, "label": lab})
# 実体の ID は表の名前で引き継ぐ（並び順で振らない：表を 1 つ消しただけで後ろの ID が全部ずれ、参照が別の表を指すのを防ぐ・L-023）
try:
    _PREV_EID = {e["table_name"]: e["id"] for e in json.load(open("07_functional/entities.json", encoding="utf-8"))["entities"]}
except (FileNotFoundError, KeyError, json.JSONDecodeError):
    _PREV_EID = {}
_NEXT_EID = [max([int(v[2:]) for v in _PREV_EID.values()] or [0])]
def _eid(table):
    if table in _PREV_EID: return _PREV_EID[table]
    _NEXT_EID[0] += 1
    return f"E-{_NEXT_EID[0]:03d}"
entities, seen = [], set()
sec = ""; sec_dec = []
for line in ER.split("\n"):
    if line.startswith("## "): sec = line; sec_dec = D(line)
    m = re.match(r"^\| \**`([a-z_]+)`\** \|([^|\n]*)\|([^|\n]*)\|", line)
    if not m: continue
    name, cols, note = m.group(1), m.group(2), m.group(3)
    if not ("/" in cols or "<common>" in cols or "<scoped>" in cols or "<versioned>" in cols) or name in seen: continue
    seen.add(name)
    fields = []
    _cols = re.sub(r"（[^）]*）", lambda m: m.group(0).replace("/", "／"), cols)   # 括弧の中の / は区切りではない
    for c in [c.strip() for c in _cols.split("/")]:
        c = re.sub(r"[*`]", "", c).strip()
        if not c: continue
        fname = re.split(r"[（(\s]", c)[0]
        fields.append({"name": fname, "note": c[len(fname):].strip("（）() ") or None})
    is_ops = "tenant_id＝運営" in cols or "tenant_id＝運営" in note   # 運営の表（行は運営テナント）。列の欄の（tenant_id＝運営）が印
    iso = "ops_scoped" if is_ops else ("scope_layered" if "<scoped>" in cols or "<versioned>" in cols else ("account_scoped" if "<common>" in cols or "tenant_id" in cols else "none"))
    owner = any(f["name"] in ("owner_member_id", "member_id", "opened_by_member_id", "requested_by", "grantee_member_id") for f in fields)
    pol = []
    if iso == "none":
        pol = [{"name": f"{name}_all_read", "operation": "select", "role": "authenticated", "predicate": "true", "rationale": "マスタ。全員が読む", "source": ["D-026"]},
               {"name": f"{name}_ops_write", "operation": "insert,update,delete", "role": "ops", "predicate": "current_setting('app.role', true) = 'ops'", "rationale": "マスタは運営だけが変える", "source": ["D-037", "D-077.4"]}]
    elif iso == "ops_scoped":
        pol = [{"name": f"{name}_ops_all", "operation": "all", "role": "ops", "predicate": "tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops'", "rationale": "運営テナントの行。顧客は読めない", "source": ["D-073.7", "D-077.4"]}]
    else:
        pol = [{"name": f"{name}_tenant_read", "operation": "select", "role": "member", "predicate": "tenant_id = current_setting('app.tenant_id', true)::uuid" + (" AND scope_id = ANY(visible_scopes(current_setting('app.user_id', true)::uuid))" if iso == "scope_layered" else ""), "rationale": "会社の中・見える層だけ（担当者・閲覧のみも自分の範囲は見える）", "source": ["D-026.1", "D-058.5", "D-073.1"]},
               {"name": f"{name}_permission_write", "operation": "insert,update,delete", "role": "member", "predicate": "tenant_id = current_setting('app.tenant_id', true)::uuid AND has_permission(current_setting('app.user_id', true)::uuid, '" + name + "', scope_id, 'edit')" if iso == "scope_layered" else "tenant_id = current_setting('app.tenant_id', true)::uuid AND has_permission(current_setting('app.user_id', true)::uuid, '" + name + "', NULL, 'edit')", "rationale": "権限＝誰に×何に×どの層で×できること", "source": ["D-073.1", "D-073.2", "D-073.3"]},
               {"name": f"{name}_ops_read_with_grant", "operation": "select", "role": "ops", "predicate": "current_setting('app.role', true) = 'ops' AND EXISTS (SELECT 1 FROM support_access_grants g WHERE g.tenant_id = " + name + ".tenant_id AND g.expires_at > now() AND g.revoked_at IS NULL)", "rationale": "運営は既定で読めない。規約で先に許可をもらい、中を見るを持つ運営の人が理由を書いて開いた 1 時間だけ（見るだけ）。したことは両側の証跡へ", "source": ["D-074.5", "D-125.128", "D-128.68", "D-128.108", "D-077.7"]}]
        # 権限そのもの・運営への許可・セッションは「本人のもの」でも自分で書けない（自分に権限を付与できてしまう。T-F-02 の RLS テストで発覚・2026-09-15）
        # 本人だけが読む表（ER の備考に「本人だけが読む」）：同じ会社の人にも見せない（自分のAI の使用量・記憶のまとめ・許可の決まり。D-104.14・D-104.16・D-105.2）
        if owner and "本人だけが読む" in note:
            _oc = next(f["name"] for f in fields if f["name"] in ("owner_member_id", "member_id", "opened_by_member_id", "requested_by", "grantee_member_id"))
            pol[0] = {**pol[0], "name": f"{name}_self_read", "predicate": "tenant_id = current_setting('app.tenant_id', true)::uuid AND " + _oc + " = current_setting('app.user_id', true)::uuid", "rationale": "本人だけが読む（同じ会社の人にも見せない）", "source": ["D-073.1", "D-104.14", "D-104.16", "D-105.2"]}
            pol = [x for x in pol if not x["name"].endswith(("_ops_read_with_grant", "_permission_write"))]   # 運営にも・権限のある人にも見せない／書かせない（本人のものは本人だけ）
        if owner and name not in ("permissions", "support_access_grants", "sessions", "ops_members", "invitations"): pol.insert(1, {"name": f"{name}_self_only_write", "operation": "insert,update,delete", "role": "member", "predicate": "tenant_id = current_setting('app.tenant_id', true)::uuid AND " + next(f["name"] for f in fields if f["name"] in ("owner_member_id", "member_id", "opened_by_member_id", "requested_by", "grantee_member_id")) + " = current_setting('app.user_id', true)::uuid", "rationale": "本人のもの（個人の範囲）は権限なしで自由", "source": ["D-073.1"]})
    ops_cols = [f["name"] for f in fields if f["name"].endswith("ops_member_id")]
    if iso in ("account_scoped", "scope_layered") and ops_cols and name not in ("support_access_grants",):  # 運営への許可は顧客だけが書く（D-042）
        # 運営が対応して書き込む行（assignee／reviewer／decided_by／recorded_by の運営メンバー列を持つ表）。運営は会社の 1 社の中で対応する（D-075・D-077）
        ops_ops = "insert,update" if any(c.startswith("recorded_by") for c in ops_cols) else "update"
        pol.append({"name": f"{name}_ops_write", "operation": ops_ops, "role": "ops", "predicate": "current_setting('app.role', true) = 'ops' AND tenant_id = current_setting('app.tenant_id', true)::uuid", "rationale": "運営が対応して書く行（" + "・".join(ops_cols) + "）。会社の 1 社の中で・証跡に残す", "source": ["D-075", "D-077.1"]})
    if "追記専用" in note:   # 証跡は関門の関数（app.record_*・security definer）だけが書く。直接の INSERT/UPDATE/DELETE は無い（ER 注記 3）
        pol = [p if p["operation"] == "select" else {**p, "operation": "select"} for p in pol if p["operation"] in ("select", "all")] + [{"name": f"{name}_append_only", "operation": "insert,update,delete", "role": "system", "predicate": "false", "rationale": "追記専用。書き込みは関門の関数 app.record_*（security definer）だけ。UPDATE/DELETE は誰にも無い", "source": ["D-042.3", "D-074.4"]}]
    if name in _RLS.POLICIES:   # 形からは決まらない守り（子の表は親に従う・関わる人）は 05_flow/rls_policies.py が正（D-128.115）
        pol = _RLS.POLICIES[name]
    src = sorted(set(D(note)) | tbl_dec.get(name, set()) | set(sec_dec))
    if not src: src = ["D-010"]   # 会社モデル＝1 つの定義（§1〜§6 の表は D-010 の背骨）
    entities.append({"id": _eid(name), "name": name, "table_name": name, "section": sec.strip("# ").split("（")[0], "fields": fields, "relations": rels.get(name, []),
                     "soft_delete": "<common>" in cols or "<scoped>" in cols or "<versioned>" in cols, "timestamps": True, "tenant_field": "tenant_id" if iso != "none" else None,
                     "indexes": [], "computed": [], "tenant_isolation": {"type": iso, "column": "tenant_id" if iso != "none" else None, "fk_table": "tenants" if iso != "none" else None},
                     "access_control_policies": pol, "legacy_drift_notes": None, "note": note.strip(), "status": "decided", "decided_at": TODAY, "source": src})
ent_by_tbl = {e["table_name"]: e["id"] for e in entities}
_tbl_by_id = {e["id"]: e["table_name"] for e in entities}

# ---------------------------------------------------------------- screens（flow と 1 対 1）
acts = {a["id"]: dict(a, phase=ph["phase"]) for ph in F["backbone"] for a in ph["acts"]}
BP = F["blueprint"]; NAV = F["navigation"]; sub = NAV.get("sub_by_screen", {})
sec_of = {}
for s in NAV.get("sections", []):
    for sid in s.get("screens", []): sec_of[sid] = s.get("key") or s.get("label")
GET = ("見る", "読む", "確かめる", "開く", "一覧", "探す", "検索", "眺め")
POST = ("作る", "足す", "招く", "登録", "上げる", "出す", "送る", "入れる", "話す", "答える", "聞く", "許可", "記録", "配る", "教える", "つなぐ", "預ける", "取り込", "審査", "承認")
PATCH = ("直す", "変える", "書き換える", "改訂", "決める", "整える", "更新", "絞る", "止める", "戻す", "確定", "動かす", "整理", "片づけ")
DELETE = ("消す", "抜ける", "退会", "外す", "取り消")
def method_of(text):
    if any(w in text for w in DELETE): return "DELETE"
    if any(w in text for w in PATCH): return "PATCH"
    if any(w in text for w in POST): return "POST"
    return "GET"
def tables_of(objs): return [t for o in objs for t in obj_tbl.get(o, []) if t in ent_by_tbl]
def api_for_act(aid, scr):
    a = acts[aid]; m = method_of(a["act"]); tb = tables_of(scr["objects"]) or ["tenants"]; t = tb[0]
    if m != "GET" and scr["id"].startswith("ops-"):
        # 運営が書く先は運営が書ける表（運営の資産 ops_all／マスタ ops_write／運営が対応する行 *_ops_write）。追記専用は除く。書けるのが update だけなら PATCH
        pol_of = {e["table_name"]: e["access_control_policies"] for e in entities}
        def ops_ops(x): return {op for p in pol_of.get(x, []) if p["role"] == "ops" and p["operation"] != "select" for op in p["operation"].split(",")}
        writable = [x for x in tb if ops_ops(x)]
        if writable: t = writable[0]; tb = [t] + [x for x in tb if x != t]
        if m == "POST" and t in pol_of and ops_ops(t) and not (ops_ops(t) & {"insert", "all"}): m = "PATCH"
    if m != "GET" and not scr["id"].startswith("ops-"):
        # 書く先は呼ぶ人が書ける表（運営の資産・マスタは会社の人が書けない＝RLS で 403 になる）。無ければ先頭のまま
        iso_of = {e["table_name"]: e["tenant_isolation"]["type"] for e in entities}
        append_only = {e["table_name"] for e in entities if any(p["role"] == "system" for p in e["access_control_policies"])}
        writable = [x for x in tb if iso_of.get(x) not in ("none", "ops_scoped") and x not in append_only]  # 追記専用（証跡）は API から直接書かない（関門の関数だけ）
        if writable: t = writable[0]; tb = [t] + [x for x in tb if x != t]
    path = f"/api/{t}" + ("/:id" if m in ("PATCH", "DELETE") else "")
    return {"act": aid, "role": "data_fetch" if m == "GET" else "action", "method": m, "path_draft": path, "auth": "session（会社・層・権限）", "related_entities": [ent_by_tbl[x] for x in tb[:4]], "choke_points": BP.get(aid, {}).get("choke_points", []), "source": a["source"]}
ROUTE_OF = {s["id"]: s.get("route") for s in F["screens"]}
# 第1フェーズの画面 → API（D-128.78）。ここに書いた画面は推測ではなくこの表を使う
import importlib.util as _ilu
_spec = _ilu.spec_from_file_location("screen_api", os.path.join(ROOT, "05_flow", "screen_api.py")); _sa = _ilu.module_from_spec(_spec); _spec.loader.exec_module(_sa)
def apis_from_table(sid):
    out = []
    for m, path, aid, table, opid, more in _sa.SCREEN_API[sid]:
        tb = [t for t in [table] + list(more) if t in ent_by_tbl]
        missing = [t for t in [table] + list(more) if t not in ent_by_tbl]
        if missing: raise SystemExit(f"screen_api.py の {sid} {m} {path}：ER 図に無い表 {missing}")
        for one in aid.split("|"):
            out.append(_api_row(one, m, path, table, opid, tb))
    return out
def _api_row(aid, m, path, table, opid, tb):
        src = acts[aid]["source"] if aid in acts else []
        return ({"act": aid, "role": "data_fetch" if m == "GET" else "action", "method": m, "path_draft": "/api" + path, "table": table, "operation_id": opid,
                    "auth": "session（会社・層・権限）", "related_entities": [ent_by_tbl[x] for x in tb], "choke_points": _chokes(aid, m, opid), "source": src})
_FILE_OPS = {"createTicketAttachment", "createTicketImport", "issueOpsInvoices"}  # issueOpsInvoices：請求書の PDF を作って置く（K-1013）
_NOTIFY_OPS = {"createTicketMessage", "createTicketHandover", "answerTicketHandover", "requestAcceptance", "requestAdminRecovery", "requestInvitationResend"}
def _chokes(aid, m, opid):
    c = set(BP.get(aid, {}).get("choke_points", []))
    if m != "GET": c.add("C2")              # DB に書く API は全部 C2（永続化）を通る
    if opid in _FILE_OPS: c.add("C4")       # ファイルを受け取る・作って置く
    if opid in _NOTIFY_OPS: c.add("C6")     # 知らせを送る
    return sorted(c)
screens = []
for s in F["screens"]:
    sid = s["id"]; mp_ = f"06_mockup/{s.get('release', 'v1')}/{s.get('release', 'v1')}-{sid}.html"; html = open(mp_, encoding="utf-8").read() if os.path.exists(mp_) else ""
    states = [{"id": a_, "label": re.sub(r"<[^>]+>", "", b_).strip()} for a_, b_ in re.findall(r'data-t="([^"]+)"><span class="mk"></span>([^<]*)', html)] or [{"id": "n", "label": "通常"}]
    trans = sorted({t for t in re.findall(r'href="v1-([a-z0-9-]+)\.html"', html) if t != sid and t != "index"})
    h1 = re.search(r"<h1[^>]*>([^<]*)</h1>", html); h1 = h1.group(1).strip() if h1 else s["name"]
    subs = [x["label"] for x in sub.get(sid, [])]
    tb = tables_of(s["objects"])
    _static = getattr(_sa, "STATIC_SCREENS", {})
    apis = ([] if sid in _static else apis_from_table(sid) if sid in _sa.SCREEN_API else [api_for_act(a, s) for a in s["acts"] if a in acts]) + [{"role": "transition", "method": "navigate", "path_draft": ROUTE_OF.get(t, f"/{t}"), "to_screen": t, "source": s["source"][:1]} for t in trans]
    screens.append({"id": sid, "name": s["name"], "purpose": s["purpose"], "acts": s["acts"], "objects": s["objects"], "primary_action": s.get("primary_action"),
                    "fields": [], "layout": NAV.get("layout", {}).get("by_screen", {}).get(sid, "single"), "actions": [s.get("primary_action")] if s.get("primary_action") else [],
                    "states": states, "transitions": trans, "responsive": "375/768/1024/1440（横溢れ 0・本文 720 以上）", "responsive_breakpoints": ["375", "768", "1024", "1440"],
                    "access_roles": s["roles"], "edit_roles": [r for r in s["roles"] if r != "R4"], "related_apis": apis, "required_apis": apis,
                    "related_entities": list(dict.fromkeys([ent_by_tbl[x] for x in tb] + [r for a in apis if a.get("operation_id") for r in a["related_entities"]])), "mock_path": mp_ if html else None, "route": s.get("route"),
                    "meta_tags": {"screen_id": sid, "screen_name": s["name"], "category": sec_of.get(sid, "outside"), "status": "decided", "version": s.get("release", "v1")},
                    "h1_text": h1, "kpi_labels": subs if sid in ("today", "ops-home", "billing", "ops-billing") else [], "section_h2_texts": subs,
                    "checklist": [], "release": s.get("release"), "has_shell": s.get("has_shell"), "legacy_drift_notes": None, "status": "decided", "decided_at": TODAY, "source": s["source"]})
scr_by_id = {x["id"]: x for x in screens}

# ---------------------------------------------------------------- features（用事ごと ＋ 関門ごと）
a2s = F["act_to_screen"]
def ears_for(aid):
    a, b = acts[aid], BP.get(aid, {})
    out = [f"EVENT-DRIVEN: WHEN {'／'.join(a['roles'])} が「{b.get('human') or a['act']}」したとき THEN Kaname は「{b.get('backstage', '')}」を行う" + (f"（自動側：{b['auto']}）" if b.get("auto") and b["auto"] != "—" else "")]
    for e in ERR:
        w = e.get("where", {})
        if w.get("act") == aid or (w.get("screen") and w.get("screen") in a2s.get(aid, []) and e.get("must_not")):
            out.append(f"UNWANTED: IF {e['when']} THEN Kaname は「{e['message']}」を出し、{e['action']}（{e['id']}）")
    return out
features = []
for j in F["jobs"]:
    jacts = [a for a in acts.values() if j["id"] in a["jobs"]]
    if not jacts: continue
    rs = sorted({s for a in jacts for s in a2s.get(a["id"], []) if s in scr_by_id})
    ck = sorted({c for a in jacts for c in BP.get(a["id"], {}).get("choke_points", [])})
    ents = sorted({e for s in rs for e in scr_by_id[s]["related_entities"]})
    eps = []
    for a in jacts:
        for s in a2s.get(a["id"], []):
            if s in scr_by_id: eps.append(api_for_act(a["id"], scr_by_id[s]) | {"inputs": "画面の入力（モック参照）", "outputs_2xx": "更新後の対象", "outputs_4xx": [e["id"] for e in ERR if e.get("where", {}).get("act") == a["id"]], "rate_limit": "C1 の規則" if "C1" in BP.get(a["id"], {}).get("choke_points", []) else None})
    errs = [e["id"] for e in ERR if e.get("where", {}).get("act") in [a["id"] for a in jacts] or e.get("where", {}).get("screen") in rs]
    features.append({"id": f"F-{len(features)+1:03d}", "name": j["statement"], "category": "job", "job": j["id"], "acts": [a["id"] for a in jacts],
                     "happy_path": [f'{a["id"]} {BP.get(a["id"], {}).get("human") or a["act"]}' for a in jacts], "error_paths": errs, "policies": ck,
                     "notifications": ["C6 通知送出（届け先は notification_preferences）"] if "C6" in ck else [], "audit_logs": ["audit_events（追記専用）"] if "C2" in ck else [],
                     "access_roles": j["roles"], "external_services": ["外部サービス（サービス台帳の可否・正規連携）"] if "C1" in ck else [],
                     "related_screens": rs, "related_entities": ents, "api_endpoints": eps, "ears_ac_seed": [x for a in jacts for x in ears_for(a["id"])],
                     "checklist": [], "legacy_drift_notes": None, "status": "decided", "decided_at": TODAY, "source": sorted(set(j["source"]) | {x for a in jacts for x in a["source"]})})
CH = json.load(open("03_architecture/choke-points.json", encoding="utf-8"))["choke_points"]
for c in CH:
    rs = sorted({s for aid, b in BP.items() if c["id"] in b.get("choke_points", []) for s in a2s.get(aid, []) if s in scr_by_id})
    features.append({"id": f"F-{len(features)+1:03d}", "name": f"関門 {c['id']} {c['name']}", "category": "cross-cutting", "choke_point": c["id"], "acts": sorted(aid for aid, b in BP.items() if c["id"] in b.get("choke_points", [])),
                     "happy_path": [f"外界に出る前に {c['name']} の関門を通る"], "error_paths": [e["id"] for e in ERR if e.get("where", {}).get("choke_point") == c["id"] or c["id"] in (e.get("covers") or [])],
                     "policies": c.get("cross_cutting_handled_here", []), "notifications": [], "audit_logs": ["audit_events"], "access_roles": ["R1", "R2", "R3", "R4", "R6"], "external_services": [],
                     "related_screens": rs, "related_entities": [], "api_endpoints": [], "ears_ac_seed": [f"UBIQUITOUS: Kaname は {c['name']} を必ず関門 {c['id']} 経由で行い、{x} を関門の中で 1 回だけ処理する" for x in c.get("cross_cutting_handled_here", [])[:3]],
                     "checklist": [], "legacy_drift_notes": None, "status": "decided", "decided_at": TODAY, "source": c.get("source", [])})

# ---------------------------------------------------------------- roles
PRED = {"self_only": "owner_member_id = current_setting('app.user_id', true)::uuid",
        "tenant": "tenant_id = current_setting('app.tenant_id', true)::uuid",
        "scope_visible": "scope_id = ANY(visible_scopes(current_setting('app.user_id', true)::uuid))",
        "permission": "has_permission(current_setting('app.user_id', true)::uuid, <target_kind>, scope_id, <ability>)",
        "ops_grant": "current_setting('app.role', true) = 'ops' AND EXISTS (SELECT 1 FROM support_access_grants g WHERE g.tenant_id = row.tenant_id AND g.expires_at > now() AND g.revoked_at IS NULL)"}
roles = []
for r in F["roles"]:
    scr = [s["id"] for s in screens if r["id"] in s["access_roles"]]
    oc = [{"object": "本人のもの（記憶・目標・ルール・タスク・自分のAI）", "constraint": "権限なしで自由", "access_predicate_expr": PRED["self_only"], "source": ["D-073.1"]},
          {"object": "会社の中の見える範囲", "constraint": "見える層だけ", "access_predicate_expr": PRED["tenant"] + " AND " + PRED["scope_visible"], "source": ["D-026.1", "D-058.5"]},
          {"object": "それ以外（会社・層のもの）", "constraint": "権限＝誰に×何に×どの層で×できること", "access_predicate_expr": PRED["tenant"] + " AND " + PRED["permission"], "source": ["D-073.2", "D-073.3"]}]
    if r["id"] == "R4": oc = [oc[1] | {"constraint": "共有された範囲を見るだけ（書き込まない）"}]
    if r["id"] == "R6": oc = [{"object": "運営テナントのマスタ・証跡", "constraint": "運営の権限（support / billing / catalog / admin）", "access_predicate_expr": "current_setting('app.role', true) = 'ops'", "source": ["D-073.7", "D-077.4"]},
                             {"object": "顧客テナントの行", "constraint": "既定で読めない。理由つき・1 時間の中を見るの許可のときだけ。両側の証跡へ", "access_predicate_expr": PRED["ops_grant"], "source": ["D-074.5", "D-125.128", "D-128.68", "D-077.7"]}]
    roles.append({"id": r["id"], "name": r["name"], "desc": r["desc"], "frequency": r["frequency"], "screens": scr, "nav": NAV.get("by_role", {}).get(r["id"], []), "object_constraints": oc, "status": "decided", "decided_at": TODAY, "source": r["source"]})
matrix_roles = {s["id"]: {r["id"]: ("edit" if r["id"] in s["edit_roles"] else ("view" if r["id"] in s["access_roles"] else "-")) for r in roles} for s in screens}

# ---------------------------------------------------------------- traceability matrix
f_by_s = {}
for f_ in features:
    for s in f_["related_screens"]: f_by_s.setdefault(s, []).append(f_["id"])
matrix = [{"screen_id": s["id"], "screen_name": s["name"], "features": f_by_s.get(s["id"], []), "entities": [f'{e} {_tbl_by_id[e]}' for e in s["related_entities"]],
           "related_apis": [f'{a["method"]} {a["path_draft"]}' for a in s["required_apis"]], "access_roles": s["access_roles"]} for s in screens]
tm = {"version": "v3.1", "created_at": TODAY, "summary": {"screens_count": len(screens), "features_count": len(features), "entities_count": len(entities),
      "uncovered_screens": [s["id"] for s in screens if not s["required_apis"] and s["id"] not in getattr(_sa, "STATIC_SCREENS", {})],
      "static_screens": [{"screen_id": k, "reason": v.get("reason", ""), "source": v.get("source", [])} for k, v in sorted(getattr(_sa, "STATIC_SCREENS", {}).items())], "uncovered_features": [f_["id"] for f_ in features if not f_["related_screens"] and f_["category"] == "job"]},
      "matrix": matrix, "screen_to_apis": [{"screen_id": s["id"], "screen_name": s["name"], "required_apis": [{k: v for k, v in a.items() if k in ("role", "method", "path_draft", "act", "to_screen")} for a in s["required_apis"]]} for s in screens],
      "entity_to_usages": [{"entity_id": e["id"], "entity_name": e["table_name"], "used_by_screens": [s["id"] for s in screens if e["id"] in s["related_entities"]], "used_by_features": [f_["id"] for f_ in features if e["id"] in f_["related_entities"]]} for e in entities],
      "feature_to_dependencies": [{"feature_id": f_["id"], "feature_name": f_["name"], "screens": f_["related_screens"], "entities": f_["related_entities"], "api_endpoints_draft": sorted({f'{a["method"]} {a["path_draft"]}' for a in f_["api_endpoints"]})} for f_ in features]}

os.makedirs(OUT, exist_ok=True)
meta = {"version": "v3.1", "created_at": TODAY, "_doc": "05_flow/build_functional.py が flow.json・ER図・モック・errors.json から生成。手で直さない。", "source": ["D-053.1", "D-053.2", "D-010"]}
json.dump({"meta": meta, "entities": entities}, open(f"{OUT}/entities.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump({"meta": meta, "items": features}, open(f"{OUT}/features.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump({"meta": meta, "roles": roles, "matrix": matrix_roles}, open(f"{OUT}/roles.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump({"meta": meta, "items": screens}, open(f"{OUT}/screens.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(tm, open(f"{OUT}/traceability-matrix.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# ---------------------------------------------------------------- MD / HTML
md = [f"# Kaname 機能分解（functional-breakdown）v3.1 — {TODAY}", "", "> 信頼源は 07_functional/*.json（05_flow/build_functional.py が機械生成）。この文書は写し。", "",
      "## 完了サマリー", "", "| 種別 | 件数 | 根拠（source）| 備考 |", "|---|---|---|---|",
      f"| エンティティ | {len(entities)} | 全件 | ER図 §1〜§14 の表から。table_name・tenant_isolation・access_control_policies |",
      f"| 機能 | {len(features)} | 全件 | 用事 {sum(1 for f_ in features if f_['category']=='job')} ＋ 関門 {sum(1 for f_ in features if f_['category']!='job')}。api_endpoints（下書き）・ears_ac_seed |",
      f"| ロール | {len(roles)} | 全件 | 権限の型（誰に×何に×どの層で×できること）を access_predicate_expr で |",
      f"| 画面 | {len(screens)} | 全件 | flow.json と 1 対 1。states はモックの状態タブ、transitions はモックのリンクから |", "",
      "## エンティティ", "", "| ID | テーブル | 節 | 分離 | 方針 | 根拠 |", "|---|---|---|---|---|---|"]
md += [f"| {e['id']} | `{e['table_name']}` | {e['section']} | {e['tenant_isolation']['type']} | {len(e['access_control_policies'])} | {' '.join(e['source'][:4])} |" for e in entities]
md += ["", "## 機能", "", "| ID | 機能 | 行為 | 画面 | API 下書き | EARS | 根拠 |", "|---|---|---|---|---|---|---|"]
md += [f"| {f_['id']} | {f_['name'][:40]} | {len(f_['acts'])} | {len(f_['related_screens'])} | {len(f_['api_endpoints'])} | {len(f_['ears_ac_seed'])} | {' '.join(f_['source'][:3])} |" for f_ in features]
md += ["", "## ロール", "", "| ID | ロール | 画面数 | 制約 |", "|---|---|---|---|"] + [f"| {r['id']} | {r['name']} | {len(r['screens'])} | {' ／ '.join(o['constraint'] for o in r['object_constraints'])} |" for r in roles]
md += ["", "## 画面", "", "| ID | 画面 | 行為 | 状態 | 遷移 | 必要 API | エンティティ | 役割 |", "|---|---|---|---|---|---|---|---|"]
md += [f"| {s['id']} | {s['name']} | {' '.join(s['acts'])} | {len(s['states'])} | {len(s['transitions'])} | {len(s['required_apis'])} | {len(s['related_entities'])} | {' '.join(s['access_roles'])} |" for s in screens]
md += ["", "## 引き継ぎ", "", "- api-design：`traceability-matrix.json` の `screen_to_apis`（path_draft は下書き。確定は api-design）", "- task-decomposition：`features.json` の `ears_ac_seed`（Tier 2）、`screens.json` の `mock_path` / `h1_text` / `section_h2_texts`（Tier 1）、`entities.json` の `access_control_policies`（access control verifier）",
       f"- 未被覆：画面 {len(tm['summary']['uncovered_screens'])} ／ 機能 {len(tm['summary']['uncovered_features'])}", ""]
open(f"{OUT}/functional-breakdown.md", "w", encoding="utf-8").write("\n".join(md))
rows = lambda hdr, rs: "<table><thead><tr>" + "".join(f"<th>{h}</th>" for h in hdr) + "</tr></thead><tbody>" + "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rs) + "</tbody></table>"
html = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>Kaname 機能分解 v3.1</title><style>body{{font-family:-apple-system,'Hiragino Sans',sans-serif;max-width:1100px;margin:32px auto;padding:0 20px;color:#1c2230;line-height:1.6}}table{{border-collapse:collapse;width:100%;font-size:13px;margin:10px 0 24px}}th,td{{border-bottom:1px solid #e3e6ec;padding:6px 8px;text-align:left;vertical-align:top}}th{{background:#f4f5f8}}code{{background:#f4f5f8;padding:1px 4px;border-radius:3px}}h2{{margin-top:36px}}</style></head><body>
<h1>Kaname 機能分解（functional-breakdown）v3.1</h1><p>{TODAY} · 信頼源は <code>07_functional/*.json</code>（機械生成）。エンティティ {len(entities)} ／ 機能 {len(features)} ／ ロール {len(roles)} ／ 画面 {len(screens)}</p>
<h2>エンティティ</h2>{rows(["ID","テーブル","節","分離","方針","根拠"], [[e['id'], f"<code>{e['table_name']}</code>", e['section'], e['tenant_isolation']['type'], len(e['access_control_policies']), ' '.join(e['source'][:4])] for e in entities])}
<h2>機能</h2>{rows(["ID","機能","行為","画面","API 下書き","EARS","根拠"], [[f_['id'], f_['name'], ' '.join(f_['acts']), ' '.join(f_['related_screens']), len(f_['api_endpoints']), len(f_['ears_ac_seed']), ' '.join(f_['source'][:3])] for f_ in features])}
<h2>ロール</h2>{rows(["ID","ロール","画面数","制約（述語）"], [[r['id'], r['name'], len(r['screens']), '<br>'.join(f"{o['constraint']}：<code>{o['access_predicate_expr']}</code>" for o in r['object_constraints'])] for r in roles])}
<h2>画面</h2>{rows(["ID","画面","行為","状態","遷移先","必要 API","エンティティ","役割"], [[s['id'], s['name'], ' '.join(s['acts']), '、'.join(x['label'] for x in s['states']), ' '.join(s['transitions']), '<br>'.join(f"{a['method']} {a['path_draft']}" for a in s['required_apis']), ' '.join(s['related_entities']), ' '.join(s['access_roles'])] for s in screens])}
</body></html>"""
open(f"{OUT}/functional-breakdown.html", "w", encoding="utf-8").write(html)
print(f"entities {len(entities)} / features {len(features)} / roles {len(roles)} / screens {len(screens)} / 未被覆 画面 {len(tm['summary']['uncovered_screens'])} 機能 {len(tm['summary']['uncovered_features'])} / source 空: entities {sum(1 for e in entities if not e['source'])} features {sum(1 for f_ in features if not f_['source'])} screens {sum(1 for s in screens if not s['source'])}")
