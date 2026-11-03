#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_api.py — api-design の 7 形式を機械生成する（Mock-Driven Contract Generation）。
   入力: 07_functional/{screens,features,entities,traceability-matrix}.json・05_flow/flow.json・03_architecture/choke-points.json・07_qa/test-specs/errors.json
   出力: 08_api/endpoints.json（信頼源）・openapi.yaml・types.ts・api-decisions.json・ears-ac-seed.json・lint-mapping.json・screen-api-coverage.json・api-field-consumption.json・API-SPEC.md・api-spec.html
   各 endpoint に acts / screens / choke_points / source（decision-traceability・screen-derivation・choke-points の責務）。"""
import json, re, os, datetime, yaml
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
F = json.load(open("05_flow/flow.json", encoding="utf-8")); BP = F["blueprint"]
S = json.load(open("07_functional/screens.json", encoding="utf-8"))["items"]; FE = json.load(open("07_functional/features.json", encoding="utf-8"))["items"]
E = json.load(open("07_functional/entities.json", encoding="utf-8"))["entities"]; CH = json.load(open("03_architecture/choke-points.json", encoding="utf-8"))["choke_points"]
ERR = json.load(open("07_qa/test-specs/errors.json", encoding="utf-8"))["errors"]
TODAY = datetime.date.today().isoformat(); OUT = "08_api"; BASE = "/api/v1"
acts = {a["id"]: a for ph in F["backbone"] for a in ph["acts"]}
ent = {e["id"]: e for e in E}; tbl2ent = {e["table_name"]: e for e in E}
feat_of_act = {}
for f_ in FE:
    for a in f_.get("acts", []): feat_of_act.setdefault(a, f_["id"])
chk = {c["id"]: c for c in CH}
OPS_SCREENS = {s["id"] for s in S if s["id"].startswith("ops-")}
PUBLIC = {s["id"] for s in S if s.get("has_shell") is False and s["id"] in ("signup", "login", "verify-email", "password-reset", "invite-accept", "mfa-setup")}

import importlib.util as _ilu
_spec = _ilu.spec_from_file_location("screen_api", os.path.join(os.path.dirname(os.path.abspath(__file__)), "screen_api.py")); _sa = _ilu.module_from_spec(_spec); _spec.loader.exec_module(_sa)
# ---------------------------------------------------------------- endpoints（画面の下書きを (method, path) で束ねる）
eps = {}
V1 = {x["id"] for x in F["screens"] if x.get("release") == "v1"}   # 第1フェーズの画面だけ API にする。後のフェーズの画面の API は 08_api/retired-endpoints.json に決定 ID つきで外す（D-128.112）
for s in S:
    if s["id"] not in V1: continue
    for a in s["required_apis"]:
        if a["role"] == "transition": continue
        path = a["path_draft"].replace("/api/", BASE + "/"); key = (a["method"], path)
        e = eps.setdefault(key, {"method": a["method"], "path": path, "acts": set(), "screens": set(), "related_entities": set(), "choke_points": set(), "source": set(), "features": set(), "table": a.get("table"), "operation_id": a.get("operation_id")})
        if a.get("operation_id") and not e.get("operation_id"): e["operation_id"], e["table"] = a["operation_id"], a.get("table")   # 画面の表の名前を、推測の行より先に使う
        e["acts"].add(a["act"]); e["screens"].add(s["id"]); e["related_entities"].update(a.get("related_entities", [])); e["choke_points"].update(a.get("choke_points", [])); e["source"].update(a.get("source", []) or s["source"]); 
        if feat_of_act.get(a["act"]): e["features"].add(feat_of_act[a["act"]])
def desc(e):
    verbs = "／".join(acts[a]["act"][:28] for a in sorted(e["acts"])[:2]); t = e["path"].split("/")[3] if len(e["path"].split("/")) > 3 else ""
    return f"{ {'GET':'取得','POST':'作成・実行','PATCH':'更新','DELETE':'削除'}[e['method']] }（{t}）— {verbs}"
def four(e):
    auth = e["auth"]["role"] != "public"; out = []
    if auth: out.append({"status": 401, "code": "UNAUTHENTICATED", "body": {"error": "unauthenticated"}, "trigger": "セッションが無い・失効している（退会・停止・権限変更・パスワード変更で即失効）", "ears_form": "UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）"})
    if auth: out.append({"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden"}, "trigger": "権限（誰に×何に×どの層で×できること）が無い、または運営が許可の無い会社を読もうとした", "ears_form": "UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）"})
    if ":id" in e["path"]: out.append({"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found"}, "trigger": "無い・消えた・取り消された（期限切れ・削除済み・他社の行）", "ears_form": "UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を返す（存在を漏らさない）"})
    if e["method"] == "POST": out.append({"status": 409, "code": "CONFLICT", "body": {"error": "conflict"}, "trigger": "二重送信・同時編集・既に登録済み（冪等キーで防ぐ）", "ears_form": "UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない"})
    if e["method"] in ("POST", "PATCH"): out.append({"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "trigger": "必須・形式・値域・表記ゆらぎ（全角半角・空白・記号）", "ears_form": "UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）"})
    out.append({"status": 429, "code": "RATE_LIMITED", "body": {"error": "rate_limited", "retry_after_sec": 60}, "trigger": e["rate_limit"], "ears_form": f"UNWANTED: IF {e['rate_limit']} を超えたら、Kaname は 429 と retry_after_sec を返す"})
    if e["choke_points"] & {"C1", "C3", "C5"}: out.append({"status": 502, "code": "EXTERNAL_FAILED", "body": {"error": "external_failed"}, "trigger": "外部サービス・モデル・プロセスが失敗した／合図を出さずに終わった", "ears_form": "UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す"})
    return out
def ears(e):
    out = []
    for a in sorted(e["acts"]):
        b = BP.get(a, {}); out.append(f"EVENT-DRIVEN: WHEN {e['method']} {e['path']} が「{b.get('human') or acts[a]['act']}」として呼ばれたとき THEN Kaname は「{b.get('backstage','')}」を行い 2xx を返す" + (f"（自動側：{b['auto']}）" if b.get("auto") and b["auto"] != "—" else ""))
    for x in e["outputs_4xx"]: out.append(x["ears_form"])
    for er in ERR:
        w = er.get("where", {})
        if w.get("act") in e["acts"] and er.get("must_not"): out.append(f"UNWANTED: IF {er['when']} THEN Kaname は「{er['message']}」を返し、{er['action']}（{er['id']}）")
    if e["choke_points"]: out.append(f"UBIQUITOUS: {e['method']} {e['path']} の副作用は関門 {'・'.join(sorted(e['choke_points']))} を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う")
    return out
endpoints = []
for (m, p), e in sorted(eps.items(), key=lambda kv: (kv[0][1], ["GET", "POST", "PATCH", "DELETE"].index(kv[0][0]))):
    e["acts"], e["screens"], e["related_entities"], e["choke_points"], e["source"], e["features"] = sorted(e["acts"]), sorted(e["screens"]), sorted(e["related_entities"]), set(e["choke_points"]), sorted(e["source"]), sorted(e["features"])
    role = "public" if set(e["screens"]) <= PUBLIC else ("ops" if set(e["screens"]) <= OPS_SCREENS else "member")
    if e.get("operation_id") in getattr(_sa, "PERMS", {}):   # ログインの要否は画面ではなく API ごとの権限で決める（ZT1・ZT2）
        _who = _sa.PERMS[e["operation_id"]][0]; role = "public" if _who == "public" else ("ops" if _who.startswith("ops:") else ("device" if _who == "device" else ("client" if _who == "client" else "member")))
    e["auth"] = {"role": role, "scheme": "none" if role == "public" else ("device（PC の印。本人の sessions に結ばれ、本人が切られたら止まる）" if role == "device" else "session（Better Auth・sessions 表を見る。app.tenant_id / app.user_id / app.role を SET LOCAL）")}
    e["rate_limit"] = "10/min/ip" if role == "public" else ("120/min/user" if m == "GET" else "60/min/user")
    tname = e.get("table") or (p.split("/")[3] if len(p.split("/")) > 3 else "")
    params = re.findall(r":(\w+)", p)
    e["access_control_policies"] = [pol["name"] for x in e["related_entities"] for pol in ent[x]["access_control_policies"] if (m == "GET" and "read" in pol["name"]) or (m != "GET" and "write" in pol["name"])]
    e["outputs_4xx"] = four(e); e["ears_ac_seed"] = ears(e)
    e["outward_side_effects"] = [chk[c]["name"] for c in sorted(e["choke_points"]) if c in chk and c != "C2"]
    e["side_effect_ordering"] = "認可判定 → ポリシー判定 → 承認確認 → 副作用 → 記録" if m != "GET" else None
    e["choke_points"] = sorted(e["choke_points"]) if m != "GET" else sorted(e["choke_points"] & {"C4", "C8"})
    e["description"] = desc(e)
    e["implementation_path"] = f"apps/api/src/routes/{tname}.ts::" + (e["operation_id"] if e.get("operation_id") else f"{m.lower()}{''.join(w.capitalize() for w in tname.split('_'))}{'ById' if ':id' in p else ''}")
    if e.get("operation_id") in getattr(_sa, "PERMS", {}):   # 誰が呼べるか（ZT1）
        _pm = _sa.PERMS[e["operation_id"]]; e["permission"] = {"who": _pm[0], "scope": _pm[1], "step_up": _pm[2]}
    e["path_params"] = params; e["returns_list"] = (m == "GET" and e["operation_id"].startswith(("list", "search"))) if e.get("operation_id") else (m == "GET" and ":id" not in p)
    e["inputs"] = {"path": params, "body": f"{tname} の入力（types.ts の {''.join(w.capitalize() for w in tname.split('_'))}Input）" if m in ("POST", "PATCH") else None, "query": ["scope_id", "cursor", "limit", "sort"] if m == "GET" and ":id" not in p else []}
    e["outputs_2xx"] = {"status": 201 if m == "POST" else 200, "body": f"{{ data: {''.join(w.capitalize() for w in tname.split('_'))}{'[]' if e['returns_list'] else ''}, meta?: {{ cursor, limit, total }} }}"}
    e["id"] = f"EP-{len(endpoints)+1:03d}"; e["feature_id"] = e["features"][0] if e["features"] else None
    endpoints.append(e)
# 行為 → endpoint の逆被覆
acts_without = sorted(a for a in acts if not any(a in e["acts"] for e in endpoints) and acts[a].get("release") == "v1")
# ---------------------------------------------------------------- 画面カバレッジ
cov = []; deferred_screens = sorted(x["id"] for x in S if x["id"] not in V1)
for s in S:
    if s["id"] not in V1: continue
    req = [{"role": a["role"], "endpoint": f'{a["method"]} {a["path_draft"].replace("/api/", BASE + "/")}', "act": a.get("act")} for a in s["required_apis"] if a["role"] != "transition"]
    have = {f'{e["method"]} {e["path"]}' for e in endpoints}; miss = [r["endpoint"] for r in req if r["endpoint"] not in have]
    cov.append({"screen_id": s["id"], "screen_name": s["name"], "mock_path": s.get("mock_path"), "required_apis": req, "transitions": s.get("transitions", []), "coverage_status": "OK" if not miss and req else ("NG" if miss else "NONE"), "missing": miss})
# ---------------------------------------------------------------- 逆カバレッジ（フィールド → 消費画面）
INTERNAL_TABLES = {"search_embeddings": "検索用の内部の索引（段階 1 は作らない・D-099.2）。画面には元の行（記憶・台帳・証跡）が出る",
                   "bridge_jobs": "PC（Bridge）に仕事を渡す内部の順番待ち。画面には実行（action_runs）として出る（D-121.2）",
                   "bridge_job_events": "同上の出来事。画面には実行の段・手順として出る",
                   "memory_proposals": "第1フェーズは「覚えたいこと」（learning_candidates）に置き換えた（D-128.41・D-128.79）",
                   "task_handovers": "第1フェーズは「渡す」（ticket_handovers）に置き換えた（D-128.79）",
                   "billing_events": "カード払い（段階 2・D-082.3）の webhook の写し。第1フェーズは請求書払い"}
INTERNAL = {"id", "tenant_id", "created_at", "updated_at", "created_by", "updated_by", "deleted_at", "scope_id", "version", "token_hash", "package_ref", "storage_ref", "vault_ref", "content_hash", "locator", "embedding", "dedupe_key"}
consumption = []
for e in E:
    scr = [s["id"] for s in S if e["id"] in s["related_entities"]]
    for f_ in e["fields"]:
        n = f_["name"]; is_master = e["tenant_isolation"]["type"] == "none"; internal = n in INTERNAL or n.startswith("<") or is_master or e["table_name"] in INTERNAL_TABLES
        consumption.append({"entity": e["table_name"], "field": n, "consumed_by_screens": [] if internal else scr, "internal": internal, "reason": ("マスタ。label は各画面の札・選択肢として出る" if is_master else INTERNAL_TABLES[e["table_name"]] if e["table_name"] in INTERNAL_TABLES else ("共通列・参照 ID・秘密の実体は画面に出さない" if internal else (None if scr else "★ どの画面にも出ない")))})
unconsumed = [c for c in consumption if not c["internal"] and not c["consumed_by_screens"]]
# ---------------------------------------------------------------- OpenAPI / types.ts
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(__file__), "..", "scripts", "ci"))
from colrules import Rules, load_rules, openapi_of  # noqa: E402  DB（gen_ddl）と同じ規則で契約の型を決める
_cr = load_rules(); _R = Rules(E, _cr.get("aliases", {}), _cr.get("vector_dim", 1536))

def ptype(n, note, e=None):
    if n == "id" or n == "tenant_id": return {"type": "string", "format": "uuid"}
    if n in ("created_at", "updated_at"): return {"type": "string", "format": "date-time"}
    if e is None: return {"type": "string"}
    return openapi_of(_R.col_type(e, {"name": n, "note": note})[0])
schemas = {}
for e in E:
    name = "".join(w.capitalize() for w in e["table_name"].split("_"))
    props = {f_["name"]: ptype(f_["name"], f_.get("note"), e) for f_ in e["fields"] if not f_["name"].startswith("<")}
    for c in ("id", "tenant_id", "created_at", "updated_at"): props.setdefault(c, ptype(c, ""))
    schemas[name] = {"type": "object", "properties": props, "required": ["id"], "x-table": e["table_name"], "x-source": e["source"]}
    schemas[name + "Input"] = {"type": "object", "properties": {k: v for k, v in props.items() if k not in INTERNAL}}
for _op, (_n, _props) in _sa.RESPONSES.items():   # 表の行ではない答えの形（D-128.78）
    schemas[_n] = {"type": "object", "properties": {k: ({"type": "array", "items": {"type": "object"}} if v == "array" else {"type": v}) for k, v in _props.items()}, "x-operation": _op}
schemas["Error"] = {"type": "object", "properties": {"error": {"type": "string"}, "code": {"type": "string"}, "message": {"type": "string"}, "details": {"type": "array", "items": {"type": "object"}}, "retry_after_sec": {"type": "integer"}}, "required": ["error"]}
paths = {}
for e in endpoints:
    tname = e.get("table") or e["path"].split("/")[3]; name = _sa.RESPONSES[e["operation_id"]][0] if e.get("operation_id") in _sa.RESPONSES else "".join(w.capitalize() for w in tname.split("_")); op = {"operationId": e["implementation_path"].split("::")[1], "summary": e["description"], "tags": [tname], "x-acts": e["acts"], "x-screens": e["screens"], "x-choke-points": e["choke_points"], "x-source": e["source"], **({"x-permission": e["permission"]["who"], "x-permission-scope": e["permission"]["scope"], "x-step-up": e["permission"]["step_up"]} if e.get("permission") else {}), "security": [] if e["auth"]["role"] == "public" else [{"session": []}]}
    op["parameters"] = [{"name": n, "in": "path", "required": True, "schema": {"type": "string", "format": "uuid"} if n == "id" else {"type": "string"}} for n in e["path_params"]]
    if e.get("operation_id") in _sa.QUERIES: op["parameters"] += [{"name": q, "in": "query", "schema": {"type": "string"}} for q in _sa.QUERIES[e["operation_id"]] + (["cursor", "limit", "sort"] if e["returns_list"] else [])]
    elif e["returns_list"]: op["parameters"] += [{"name": q, "in": "query", "schema": {"type": "string"}} for q in ("scope_id", "cursor", "limit", "sort")]
    if not op["parameters"]: del op["parameters"]
    tbl = "".join(w.capitalize() for w in tname.split("_"))
    if e["method"] in ("POST", "PATCH"): op["requestBody"] = {"required": True, "content": {"application/json": {"schema": {"$ref": f"#/components/schemas/{tbl}Input"}}}}
    ok = {"description": "成功", "content": {"application/json": {"schema": {"type": "object", "properties": {"data": {"type": "array", "items": {"$ref": f"#/components/schemas/{name}"}} if e["returns_list"] else {"$ref": f"#/components/schemas/{name}"}, "meta": {"type": "object", **({"properties": {k: {"type": v} for k, v in getattr(_sa, "META", {}).get(e.get("operation_id"), {}).items()}} if e.get("operation_id") in getattr(_sa, "META", {}) else {})}}}}}}
    op["responses"] = {str(e["outputs_2xx"]["status"]): ok, **{str(x["status"]): {"description": x["code"], "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}}} for x in e["outputs_4xx"]}}
    paths.setdefault(re.sub(r":(\w+)", r"{\1}", e["path"]), {})[e["method"].lower()] = op
openapi = {"openapi": "3.0.3", "info": {"title": "Kaname API", "version": "1.0.0", "description": f"Mock-Driven Contract Generation。{TODAY} 凍結。信頼源は 08_api/endpoints.json。x-acts / x-screens / x-choke-points / x-source で行為・画面・関門・決定に辿れる"},
           "servers": [{"url": BASE}], "components": {"securitySchemes": {"session": {"type": "http", "scheme": "bearer", "description": "Better Auth のセッション。sessions 表を見て失効を判定"}}, "schemas": schemas}, "paths": paths}
ts = ["// 生成物（05_flow/build_api.py）。手で直さない。OpenAPI 3.0.3 と同じ内容。", "export type ApiResponse<T> = { data: T; meta?: { cursor?: string; limit?: number; total?: number } };", "export type ApiError = { error: string; code?: string; message?: string; details?: Array<{ field: string; message: string }>; retry_after_sec?: number };", ""]
def tst(p): return {"string": "string", "number": "number", "boolean": "boolean", "object": "Record<string, unknown>", "array": "string[]", "integer": "number"}[p["type"]]
for n, sc in schemas.items():
    if n == "Error": continue
    ts.append(f"export type {n} = {{ " + "; ".join(f"{k}{'?' if k not in sc.get('required', []) else ''}: {tst(v)}" for k, v in sc["properties"].items()) + " };")
ts.append(""); ts.append("export const ENDPOINTS = " + json.dumps([{"id": e["id"], "method": e["method"], "path": e["path"], "acts": e["acts"], "screens": e["screens"]} for e in endpoints], ensure_ascii=False, indent=1) + " as const;")
# ---------------------------------------------------------------- 書き出し
os.makedirs(OUT, exist_ok=True)
meta = {"version": "v3.1", "created_at": TODAY, "frozen_at": TODAY, "base_url": BASE, "_doc": "05_flow/build_api.py が機械生成。手で直さない。凍結後の変更は決定（ADR）＋影響解析", "source": ["D-043.2", "D-051.1", "D-051.2", "D-053.1"]}
json.dump({"meta": meta, "endpoints": endpoints, "acts_without_endpoint": acts_without, "deferred_screens": deferred_screens}, open(f"{OUT}/endpoints.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
yaml.safe_dump(openapi, open(f"{OUT}/openapi.yaml", "w", encoding="utf-8"), allow_unicode=True, sort_keys=False, width=200)
open(f"{OUT}/types.ts", "w", encoding="utf-8").write("\n".join(ts) + "\n")
json.dump({"meta": {"project": "Kaname", "created_at": TODAY, "skill_version": "v3.1", "total_endpoints": len(endpoints)}, "context": {"api_style": "REST（独立 API 層・Hono・OpenAPI が契約）", "auth_method": "セッション（Better Auth・トークンベース・sessions 表で失効）", "versioning": "url（/api/v1）", "contract_test_framework": "OpenAPI-driven（schemathesis 系）＋ 型生成同期 check（未確定：段階 1 凍結時に確認）"},
           "decision_log": [{"decision": "REST（独立 API 層）", "reason": "Web・Bridge・将来のアプリの 3 クライアントが同じ契約を叩く", "alternatives": ["GraphQL", "tRPC"], "tradeoffs": "画面ごとの集約は BFF ではなく画面の必要 API を列挙して担保", "source": ["D-043.2", "D-051.1"]},
                            {"decision": "認証はトークンベース・失効は sessions 表", "reason": "アプリ対応。退会・停止・権限変更・パスワード変更で即失効（G-14）", "alternatives": ["Cookie セッションのみ"], "tradeoffs": "全リクエストで sessions を引く（インデックス必須）", "source": ["D-051.2", "D-074.2", "D-076.1"]},
                            {"decision": "副作用の順序を固定", "reason": "認可 → ポリシー → 承認 → 副作用 → 記録。RLS 拒否に頼ると副作用だけ実行される", "alternatives": [], "tradeoffs": "", "source": ["D-042.2", "D-050.2"]},
                            {"decision": "運営の読み取りは中を見るの許可（理由つき・1 時間・見るだけ）があるときだけ", "reason": "運営は既定で顧客データを読めない。規約で先に許可をもらう形に改めた（D-125.128）", "alternatives": ["会社が範囲と期限つきで許可する（D-074.5・やめた）"], "tradeoffs": "見るたびに理由と本人確認の取り直しが要る", "source": ["D-074.5", "D-125.128", "D-128.68", "D-077.7"]}],
           "api_patterns": [{"pattern_name": "一覧＋1 件＋作成＋更新＋削除", "applicable_to": "台帳・目標・タスク・メンバー等", "endpoints": ["GET /x", "GET /x/:id", "POST /x", "PATCH /x/:id", "DELETE /x/:id"]}, {"pattern_name": "出来事の依存処理", "applicable_to": "退会・停止・権限変更・プラン変更・層を消す・AI社員を消す", "endpoints": ["POST /account_events", "PATCH /account_event_items/:id", "POST /account_events/:id/resolve"]}],
           "research": {"sources": [], "findings": ["契約は OpenAPI 3.0.3。x-acts / x-screens / x-choke-points / x-source で行為・画面・関門・決定に辿れる"], "research_date": TODAY}}, open(f"{OUT}/api-decisions.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump({"version": "v3", "skill": "api-design", "endpoints_count": len(endpoints), "ac_seeds": [{"endpoint": f'{e["method"]} {e["path"]}', "feature_id": e["feature_id"], "screen_ids": e["screens"], "acts": e["acts"], "ears_ac_seed": e["ears_ac_seed"], "source": e["source"]} for e in endpoints]}, open(f"{OUT}/ears-ac-seed.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump({"version": "v3", "skill": "api-design", "endpoints": [{"method": e["method"], "path": e["path"], "implementation_path": e["implementation_path"], "screen_ids_referencing": e["screens"], "acts": e["acts"]} for e in endpoints]}, open(f"{OUT}/lint-mapping.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump({"version": "v3.1", "skill": "api-design", "frozen_at": TODAY, "summary": {"total_screens": len(cov), "total_apis": len(endpoints), "coverage_rate": round(sum(1 for c in cov if c["coverage_status"] == "OK") / len(cov), 3), "uncovered_screens": [c["screen_id"] for c in cov if c["coverage_status"] != "OK"], "acts_without_endpoint": acts_without}, "screens": cov}, open(f"{OUT}/screen-api-coverage.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump({"version": "v3.1", "skill": "api-design", "rule": "各レスポンスのフィールドは最低 1 つの画面で消費される。内部専用は internal=true と理由（暗黙除外なし）", "fields": consumption, "unconsumed": [f'{c["entity"]}.{c["field"]}' for c in unconsumed]}, open(f"{OUT}/api-field-consumption.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
md = [f"# Kaname API 設計書 v1.0（{TODAY} 凍結）", "", "> 信頼源は `08_api/endpoints.json` と `openapi.yaml`（05_flow/build_api.py が機械生成）。", "", "## 1. 設計方針", "", "- REST・独立 API 層（Hono・TypeScript）・契約は OpenAPI 3.0.3・URL 版（/api/v1）。Web・Bridge・将来のアプリが同じ契約を叩く（D-043・D-051）",
      "- 認証はトークンベース。失効は `sessions` 表（退会・停止・権限変更・パスワード変更で即失効）。API 層は冒頭で `SET LOCAL app.tenant_id / app.user_id / app.role`", "- 副作用の順序：認可 → ポリシー → 承認 → 副作用 → 記録。書き込み系 endpoint は関門（C1〜C8）を必ず通る", "- 運営（ops）は既定で顧客の行を読めない。`support_access_grants` があるときだけ", "",
      "## 2. エンドポイント一覧", "", "| ID | メソッド | パス | 説明 | 行為 | 画面 | 役割 | 関門 | 4xx |", "|---|---|---|---|---|---|---|---|---|"]
md += [f"| {e['id']} | {e['method']} | `{e['path']}` | {e['description'][:36]} | {' '.join(e['acts'])} | {len(e['screens'])} | {e['auth']['role']} | {' '.join(e['choke_points'])} | {' '.join(str(x['status']) for x in e['outputs_4xx'])} |" for e in endpoints]
md += ["", "## 3. 画面 ↔ API カバレッジ", "", f"- 画面 {len(cov)} ／ OK {sum(1 for c in cov if c['coverage_status']=='OK')} ／ 未カバー {[c['screen_id'] for c in cov if c['coverage_status']!='OK']}", f"- endpoint の無い行為（v1）{acts_without}", "",
       "## 4. 逆カバレッジ（フィールド → 画面）", "", f"- 検査したフィールド {len(consumption)} ／ 内部専用 {sum(1 for c in consumption if c['internal'])} ／ どの画面にも出ない {len(unconsumed)}", *([f"  - ★ {x}" for x in [f'{c["entity"]}.{c["field"]}' for c in unconsumed][:40]]), "",
       "## 5. 共通仕様", "", "- 正常：`{ data, meta? }`。エラー：`{ error, code, message, details?, retry_after_sec? }`", "- 401 未認証／403 権限なし／404 無い（存在を漏らさない）／409 二重／422 入力（表記ゆらぎはサーバーで正規化）／429 レート／502 外部の失敗（信号なし終了を成功にしない）", "- ヘッダー：Authorization: Bearer / Content-Type: application/json / X-Request-ID / Idempotency-Key（POST）", "",
       "## 6. 変更履歴", "", f"- v1.0 {TODAY} 凍結（endpoints {len(endpoints)}）", ""]
open(f"{OUT}/API-SPEC.md", "w", encoding="utf-8").write("\n".join(md))
rows = lambda hdr, rs: "<table><thead><tr>" + "".join(f"<th>{h}</th>" for h in hdr) + "</tr></thead><tbody>" + "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rs) + "</tbody></table>"
html = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>Kaname API 設計書 v1.0</title><style>body{{font-family:-apple-system,'Hiragino Sans',sans-serif;max-width:1200px;margin:32px auto;padding:0 20px;color:#1c2230;line-height:1.6}}table{{border-collapse:collapse;width:100%;font-size:12.5px;margin:10px 0 24px}}th,td{{border-bottom:1px solid #e3e6ec;padding:6px 8px;text-align:left;vertical-align:top}}th{{background:#f4f5f8}}code{{background:#f4f5f8;padding:1px 4px;border-radius:3px}}details{{margin:6px 0}}</style></head><body>
<h1>Kaname API 設計書 v1.0（{TODAY} 凍結）</h1><p>endpoints {len(endpoints)} ／ 画面 {len(cov)}（OK {sum(1 for c in cov if c['coverage_status']=='OK')}）／ フィールド {len(consumption)}（どの画面にも出ない {len(unconsumed)}）</p>
<h2>エンドポイント</h2>{rows(["ID","メソッド","パス","説明","行為","画面","役割","関門","4xx","実装"], [[e['id'], e['method'], f"<code>{e['path']}</code>", e['description'], ' '.join(e['acts']), ' '.join(e['screens']), e['auth']['role'], ' '.join(e['choke_points']), ' '.join(str(x['status']) for x in e['outputs_4xx']), f"<code>{e['implementation_path']}</code>"] for e in endpoints])}
<h2>EARS（endpoint ごと）</h2>{''.join(f"<details><summary>{e['method']} {e['path']}</summary><ul>" + ''.join(f'<li>{x}</li>' for x in e['ears_ac_seed']) + '</ul></details>' for e in endpoints)}
<h2>画面 ↔ API</h2>{rows(["画面","必要 API","状態"], [[c['screen_id'], '<br>'.join(f"{r['role']}: {r['endpoint']}" for r in c['required_apis']), c['coverage_status']] for c in cov])}
</body></html>"""
open(f"{OUT}/api-spec.html", "w", encoding="utf-8").write(html)
print(f"後のフェーズの画面 {len(deferred_screens)}（API は作らない・D-128.112）")
print(f"endpoints {len(endpoints)} / 画面 OK {sum(1 for c in cov if c['coverage_status']=='OK')}/{len(cov)} / endpoint の無い行為 {len(acts_without)} {acts_without[:12]} / どの画面にも出ないフィールド {len(unconsumed)}")
