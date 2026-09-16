#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_tasks.py — task-decomposition v3.1（api_first）を機械生成。
   入力: 09_features/features.json・07_functional/*.json・08_api/endpoints.json・errors.json・flow.json・モック・決定ログ
   出力: 07_tasks/tickets.json（信頼源・JIT 用インライン込み）・TASK-CARDS.md/.html・DEPENDENCIES.md・td-decisions.json
         07_qa/test-specs/screens/<sid>.md ほか（L1 行の正本・11 列）・journeys/plan.json（L2）
   規約: test-ladder（L1 はタスクと同時）・decision-traceability（source・決定の summary 逐語）・choke-points・JIT"""
import json, re, os, math, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
F = json.load(open("05_flow/flow.json", encoding="utf-8")); BP = F["blueprint"]
FD = json.load(open("09_features/features.json", encoding="utf-8")); FEAT = {f["id"]: f for f in FD["items"]}
S = {s["id"]: s for s in json.load(open("07_functional/screens.json", encoding="utf-8"))["items"]}
E = {e["id"]: e for e in json.load(open("07_functional/entities.json", encoding="utf-8"))["entities"]}
EP = {e["id"]: e for e in json.load(open("08_api/endpoints.json", encoding="utf-8"))["endpoints"]}
ERR = json.load(open("07_qa/test-specs/errors.json", encoding="utf-8"))["errors"]
LOG = open("01_hearing/決定ログ_進行中.md", encoding="utf-8").read()
SUMM = {m.group(1): re.sub(r"\s*-->\s*$", "", m.group(2)).strip() for m in re.finditer(r"decision: (D-\d{3})\n.*?summary: ([^\n]*)", LOG, re.S)}
TODAY = datetime.date.today().isoformat(); CAP = 10; SPEC = "07_qa/test-specs"
acts = {a["id"]: a for ph in F["backbone"] for a in ph["acts"]}
ERR_BY_SCREEN, ERR_BY_ACT = {}, {}
for e in ERR:
    w = e.get("where", {}); ERR_BY_SCREEN.setdefault(w.get("screen"), []).append(e); ERR_BY_ACT.setdefault(w.get("act"), []).append(e)
def two_axis(h, kind, crit=False):
    fac = {"infra": 15, "db": 12, "api": 12, "ui": 10, "e2e": 10, "spec": 6}[kind] if not crit else 4
    ai = round(h / fac, 1); rv = 1.0 if crit else 0.0
    return {"estimate_hours_human": h, "estimate_hours_ai": ai, "human_review_h": rv, "wall_clock_h_ai": round(ai + rv, 1), "ai_acceleration_factor": fac, "blocking_dependencies_h": 0, "estimate_method": "reference", "estimate_confidence": "medium", "estimate_hours": round(ai + rv, 1), "estimate_sessions": max(1, math.ceil((ai + rv) / 4))}
def dsum(src): return [{"id": s.split(".")[0], "summary": SUMM.get(s.split(".")[0], "")} for s in list(dict.fromkeys(x.split(".")[0] for x in src if x.startswith("D-")))[:4]]
REG_BASE = ["pnpm test（該当パッケージ）PASS", "pnpm typecheck 0 errors（触ったファイル）", "coverage >= 80%（触ったファイル）", "pnpm lint OK", "python3 scripts/ci/layer_audit.py --run PASS", "関門の迂回検出（choke-points ci_check）PASS", "audit MD（07_tasks/audit/<id>.md）に impl line を記入"]
REG_UI = REG_BASE + ["mock-impl-diff（h1・状態・第2ナビ・列の値）PASS", "AC-R9 動作実証：実ブラウザで全操作要素を押し、遷移／別 GET 再取得／表示変化を確認。href は実在ルートを機械照合"]
# ---------------------------------------------------------------- QA 行（L1）の正本
qa_files = {}   # file → [rows]
def qrow(file, prefix, screen, view, item, pre, steps, expect, note, task):
    rows = qa_files.setdefault(file, []); rid = f"{prefix}-{len([r for r in rows if r[0].startswith(prefix)]) + 1:03d}"
    rows.append((rid, screen, view, item, pre, steps, expect, "", note, task, "L1")); return rid
def variance_rows(file, prefix, sid, task, html):
    ids = []
    if "<input" in html or "<textarea" in html:
        for k, it in [("全角／半角", "メール・数値・コードを全角で入れる"), ("前後と途中の空白", "空白付きで入れる"), ("記号の種別（ハイフン・長音）", "‐ ー − を混ぜる"), ("Unicode 正規化（NFC/NFD）", "macOS の入力（NFD）で入れる"), ("大文字小文字", "メールを大文字で入れる")]:
            ids.append(qrow(file, prefix, sid, "表記ゆらぎ", f"{k}：{it}", "入力欄がある状態", "入力して保存", "同一として扱われ、サーバー側で正規化されて保存される（クライアント側だけに頼らない）", "human-grade-qa 第11軸", task))
    else: ids.append(qrow(file, prefix, sid, "表記ゆらぎ", "N/A：この画面に入力欄が無い", "—", "—", "—", "理由つき N/A", task))
    return ids
def g_rows(file, prefix, sid, task, chokes, tables, kind):
    ids = []
    ids.append(qrow(file, prefix, sid, "G-11 外部リソースの実在", "触る外部リソースが staging と production に存在する" if chokes & {"C4", "C6", "C8", "C1"} else "N/A：外部リソースを触らない", "migration/IaC 適用後", "起動時の存在確認を読む", "無ければ起動時に落ちる（黙って 502 にならない）", "環境ごと", task))
    ids.append(qrow(file, prefix, sid, "G-12 切り替わりの瞬間", "Bridge が切れた直後 0 秒・鮮度窓の内側に操作する" if chokes & {"C1", "C3", "C5"} or kind == "ui" else "N/A：状態の切替を持たない", "本番稼働中", "PC を閉じた直後に主アクションを押す", "「AI は止まっています」が出て、押した内容は失われない", "", task))
    ids.append(qrow(file, prefix, sid, "G-13 機能の組み合わせ", "実行中 × 切替／中断 × 再開／別ロール同時 の直積のうち該当分", "—", "同時に起こす", "後勝ちでなく、規則どおり（承認は 1 人 1 回・切替は次の実行から）", "features.json combination_points", task))
    ids.append(qrow(file, prefix, sid, "G-14 口座状態の波及", "退会・停止・権限変更・パスワード変更の後に、この機能の既存セッション・接続・共有リンクが無効" if kind != "infra" else "N/A：口座状態を持たない基盤", "ログイン中の別端末と Bridge", "権限を変える", "別端末と Bridge は 0 秒で 401（sessions が revoked）", "", task))
    ids.append(qrow(file, prefix, sid, "G-15 信号なし終了", "外部・モデル・プロセスが完了信号を出さずに終わる／空を返す" if chokes & {"C1", "C3", "C5"} else "N/A：外部を呼ばない", "外部を故意に切る", "実行する", "成功扱いにせず、502 と次の一手（人へのハンドオフ）", "", task))
    ids.append(qrow(file, prefix, sid, "G-16 有限資源", f"消費する資源：DB 接続（プール経由）・{'外部 API レート' if 'C1' in chokes else 'メモリ'}。1 要求あたり 1 接続以下・上限時は待機列", "同時 50 要求", "同時に叩く", "ログインが落ちない・接続上限に張り付かない（関門 C2 のプール）", "L4 で負荷試験", task))
    return ids
def error_rows(sid, aid):
    ids = []
    for e in (ERR_BY_SCREEN.get(sid, []) if sid else []) + (ERR_BY_ACT.get(aid, []) if aid else []):
        ids += [f'{e["id"]}-A', f'{e["id"]}-B', f'{e["id"]}-C']
    return sorted(set(ids))
PREV_STATUS = {x["id"]: x.get("status", "todo") for x in (json.load(open("07_tasks/tickets.json", encoding="utf-8"))["tasks"] if os.path.exists("07_tasks/tickets.json") else [])}   # 再生成で done を todo に戻さない（状態は実装の結果）
tasks = []; tid_of_feature = {}
def newtask(tid, title, group, layer, phase, kind, feature_ids, **kw):
    crit = kw.pop("critical", False); h = kw.pop("hours"); ta = two_axis(h, kind, crit)
    src = kw.pop("source", []); t = {"id": tid, "title": title, "category": kw.pop("category", "backend"), "label": "NEW", "feature_id": feature_ids[0] if feature_ids else None, "feature_ids": feature_ids,
         "screen_ids": kw.pop("screen_ids", []), "entity_ids": kw.pop("entity_ids", []), "acts": kw.pop("acts", []), "legacy_task_id": None, "phase": phase, "wave": None, "group": group, "deliverable_layer": layer, "stage": kw.pop("stage", "v1"),
         "depends_on": kw.pop("depends_on", []), "choke_points": kw.pop("choke_points", []), "choke_points_rationale": kw.pop("choke_rationale", ""), "forbidden_direct_apis_reminder": ["fetch", "axios", "undici", "pg / drizzle の生クライアント（関門の外）", "child_process", "fs（関門の外）", "nodemailer / resend（関門の外）", "anthropic / openai SDK（関門の外）"],
         "files_changed": kw.pop("files_changed", []), "files_changed_predicted": kw.pop("fcp", {"new": [], "modify": [], "shared_read": [], "forbidden": ["packages/gateways/**（関門の実装は Group F だけ）"]}),
         "acceptance_criteria": kw.pop("ac", {"structural": [], "functional": [], "regression": REG_BASE}), "access_policies_required": kw.pop("policies", []), "spec_links": kw.pop("spec_links", []),
         "audit_md_path": f"07_tasks/audit/{tid}.md", "status": PREV_STATUS.get(tid, "todo"), "qa_rows": kw.pop("qa_rows", {"l1": [], "l2_flows": []}), "test_scenarios_inline": kw.pop("scenarios", []), "source": src, "decision_summaries": dsum(src), "critical": crit, "why": kw.pop("why", "")}
    t["acceptance_criteria_inline"] = {"tier_1_structural": t["acceptance_criteria"]["structural"], "tier_2_functional": [{"type": x.split(":")[0], "text": x, "critical": x.startswith("UNWANTED") and crit} for x in t["acceptance_criteria"]["functional"]], "tier_3_regression": t["acceptance_criteria"]["regression"]}
    t.update(ta); tasks.append(t)
    for f in feature_ids: tid_of_feature.setdefault(f, []).append(tid)
    return t
def split(h_ai_wall, n_max=8):
    return max(1, math.ceil(h_ai_wall / n_max))
# ---------------------------------------------------------------- Group F（Foundation）← features Group A
for f in [x for x in FD["items"] if x["group"] == "A"]:
    n = split(f["wall_clock_h_ai"]); chokes = [f["id"].split("-")[-1]] if f["kind"] == "infra" and f["id"].split("-")[-1].startswith("C") else []
    for i in range(n):
        tid = f"T-F-{len([t for t in tasks if t['group']=='F'])+1:02d}"; part = f"（{i+1}/{n}）" if n > 1 else ""
        fcp = {"new": [".github/workflows/ci.yml", "packages/db/migrations/0001_foundation.sql", "packages/gateways/README.md"] if f["kind"] == "infra" and not chokes else ([f"packages/gateways/{chokes[0].lower()}/index.ts", f"scripts/ci/choke_{chokes[0].lower()}.py"] if chokes else [f"packages/db/migrations/00{i+2}_{f['id'][-2:]}.sql", f"packages/db/policies/{f['id'][-2:]}.sql"]), "modify": ["package.json"], "shared_read": ["03_architecture/choke-points.json", "03_architecture/ER図.md", "02_tech_stack/selected-stack.json"], "forbidden": ["apps/web/**（基盤の段階で画面を触らない）"]}
        rows = []; sp = f"{SPEC}/prod-smoke.md" if f["kind"] == "infra" else f"{SPEC}/rls-matrix.md"; pre = "FND-" + f["id"].split("-")[-1]
        rows.append(qrow(sp, pre, "基盤", "基盤の存在", f"{f['name'][:40]}：CI／関門／表が staging と production に存在し、無ければ起動で落ちる", "migration/IaC 適用後", "起動時の存在確認を読む・CI を 1 回回す", "全部存在・gate が動く", "G-11", tid))
        rows.append(qrow(sp, pre, "基盤", "上流を故意に壊す", f"{f['name'][:40]}：SET LOCAL を飛ばす／関門を迂回する／権限を落とす", "staging", "壊した状態で要求", "他テナントの行が取れない・迂回は CI で fail・副作用が起きない", "G-02", tid))
        rows += g_rows(sp, pre, "基盤", tid, set(chokes) | ({"C2"} if f["kind"] == "db" else set()), [E[x]["table_name"] for x in f["entity_ids"]], "infra")
        newtask(tid, f["name"][:60] + part, "F", "foundation", "1_foundation", f["kind"] if f["kind"] in ("infra", "db", "api") else "infra", [f["id"]], category="infra" if f["kind"] == "infra" else "db", hours=round(f["estimate_hours_human"] / n), critical=f["human_review_h"] > 0, entity_ids=f["entity_ids"], choke_points=chokes or (["C2"] if f["kind"] == "db" else []), choke_rationale=f["role"], fcp=fcp, files_changed=[x + " (new)" for x in fcp["new"]] + [x + " (modify)" for x in fcp["modify"]],
                ac={"structural": [] if not chokes else [f"UBIQUITOUS: 関門 {chokes[0]} は 03_architecture/choke-points.json の gateway_path と forbidden_direct_apis どおりに実装され、迂回は CI で fail する"], "functional": f["ears_ac_seed"][:6] or [f"UBIQUITOUS: {f['role']}", f"UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない"], "regression": REG_BASE}, policies=[p["name"] for x in f["entity_ids"] for p in E[x]["access_control_policies"]][:12], spec_links=["03_architecture/アーキテクチャ設計書.md", "03_architecture/choke-points.json", "03_architecture/ER図.md"], qa_rows={"l1": rows, "l2_flows": []}, scenarios=[{"name": "存在確認", "steps": ["staging を起動"], "expected": "存在確認が全部通る"}, {"name": "上流を壊す", "steps": ["SET LOCAL を飛ばして要求"], "expected": "他テナントの行が取れない"}], source=f["source"], why=f.get("why", ""))
F_ids = [t["id"] for t in tasks]
# ---------------------------------------------------------------- Group D（Data）← ER の節ごと
sections = {}
for e in E.values(): sections.setdefault(e["section"], []).append(e)
for i, (sec, ents) in enumerate(sections.items(), 1):
    tid = f"T-D-{i:02d}"; tb = [e["table_name"] for e in ents]; pol = [p["name"] for e in ents for p in e["access_control_policies"]]
    src = sorted({s for e in ents for s in e["source"]})[:10]; crit = any(t in ("permissions", "sessions", "credentials", "account_events", "invoices", "payments") for t in tb)
    sp = f"{SPEC}/rls-matrix.md"; pre = f"RLS-D{i:02d}"; rows = []
    for e in ents:
        rows.append(qrow(sp, pre, e["table_name"], "RLS 越境", f"{e['table_name']}：他テナントの行を SELECT / UPDATE できない（SET LOCAL を正しく／飛ばして両方）", "2 テナントのデータ", "別テナントの id で要求", "0 行・403（副作用なし）", "G-02", tid))
        if any(p["name"].endswith("self_only_write") for p in e["access_control_policies"]): rows.append(qrow(sp, pre, e["table_name"], "本人のもの", f"{e['table_name']}：本人の行は権限なしで直せ、他人の行は権限が要る", "担当者でログイン", "自分の行と他人の行を更新", "自分の行 200・他人の行 403", "D-073.1", tid))
    rows += g_rows(sp, pre, sec[:20], tid, {"C2"}, tb, "db")
    newtask(tid, f"データ層 {sec[:36]}（{len(ents)} 表・migration・RLS・索引・seed）", "D", "foundation", "2_data", "db", [], category="db", hours=6 * len(ents) + 4, critical=crit, entity_ids=[e["id"] for e in ents], depends_on=["T-F-01", "T-F-02", "T-F-03"] if len(F_ids) >= 3 else F_ids, choke_points=["C2"], choke_rationale="表と行レベル制御の作成（関門 C2 の中）",
            fcp={"new": [f"packages/db/migrations/{100+i:04d}_{sec[:2]}.sql", f"packages/db/policies/{tb[0]}.sql", f"packages/db/seed/{tb[0]}.ts"], "modify": ["packages/db/schema.ts"], "shared_read": ["03_architecture/ER図.md", "07_functional/entities.json"], "forbidden": ["apps/**", "apps/api/**"]}, files_changed=[f"packages/db/migrations/{100+i:04d}_{sec[:2]}.sql (new)", f"packages/db/policies/{tb[0]}.sql (new)", "packages/db/schema.ts (modify)"],
            ac={"structural": [f"UBIQUITOUS: 表 {', '.join(tb[:6])}{' …' if len(tb) > 6 else ''} が ER 図 §{sec[:12]} の列・型・関係どおりに存在し、全表に RLS が定義されている（RLS 未定義の表は CI で作れない）"], "functional": [f"UNWANTED: IF 他テナントの行を SELECT/UPDATE しようとしたら 0 行／403 で副作用が起きない（{tb[0]}_tenant_read）"] + [f"UBIQUITOUS: {p}" for p in pol[:6]], "regression": REG_BASE}, policies=pol, spec_links=["03_architecture/ER図.md", "07_functional/entities.json"], qa_rows={"l1": rows, "l2_flows": []}, scenarios=[{"name": "RLS 越境", "steps": ["テナント A でログイン", "テナント B の id で GET"], "expected": "0 行"}], source=src)
D_ids = [t["id"] for t in tasks if t["group"] == "D"]
# ---------------------------------------------------------------- Group A（API）← features Group B（用事ごと・endpoint を最大 6 本ずつ）
def _stage_of(e): return "v2" if e["screens"] and all(S[s].get("release") == "v2" for s in e["screens"]) else "v1"   # 段階 2 の画面だけが呼ぶ endpoint は段階 2 のタスク
for stage, f in [(st, x) for st in ("v1", "v2") for x in FD["items"] if x["group"] == "B"]:   # 番号は段階 1 を先に全部（段階 2 を足しても既存の ID が動かない）
    eps = [EP[e] for e in f["api_endpoints"] if _stage_of(EP[e]) == stage]
    if stage == "v2" and not eps: continue
    chunks = [eps[i:i+6] for i in range(0, len(eps), 6)] or [[]]
    for ci, ch in enumerate(chunks, 1):
        tid = f"T-A-{len([t for t in tasks if t['group']=='A'])+1:02d}"; part = f"（{ci}/{len(chunks)}）" if len(chunks) > 1 else ""
        a_ids = sorted({a for e in ch for a in e["acts"]}) or f["acts"]; chokes = sorted({c for e in ch for c in e["choke_points"]}); ents = sorted({x for e in ch for x in e["related_entities"]}) or f["entity_ids"]
        scr = sorted({s for e in ch for s in e["screens"] if S[s].get("release") == stage}); pol = sorted({p for e in ch for p in e["access_control_policies"]})
        sp = f"{SPEC}/screens/{scr[0]}.md" if scr else f"{SPEC}/rls-matrix.md"; pre = "API-" + tid.split("-")[-1]; rows = []
        for e in ch:
            rows.append(qrow(sp, pre, scr[0] if scr else "API", "API 正常", f"{e['method']} {e['path']}：{e['description'][:40]}", "権限のある会員", "呼ぶ", f"{e['outputs_2xx']['status']} と {e['outputs_2xx']['body'][:40]}", " ".join(e["acts"]), tid))
            for x in e["outputs_4xx"][:4]: rows.append(qrow(sp, pre, scr[0] if scr else "API", "API 異常", f"{e['method']} {e['path']}：{x['trigger'][:50]}", "—", "条件を作って呼ぶ", f"{x['status']} {x['code']}。副作用なし", x["ears_form"][:40], tid))
            rows.append(qrow(sp, pre, scr[0] if scr else "API", "状態", f"{e['method']} {e['path']}：0 件／大量（1,000）／重複／初回／2 回目", "—", "各状態で呼ぶ", "0 件は空配列、大量はページング、重複は 409、2 回目は冪等", "", tid))
        rows += g_rows(sp, pre, scr[0] if scr else "API", tid, set(chokes) | {"C2"}, [E[x]["table_name"] for x in ents], "api")
        errs = sorted({r for a in a_ids for r in error_rows(None, a)})
        newtask(tid, f"API {f['name'][:34]}{part}（{len(ch)} endpoint{'・段階 2' if stage == 'v2' else ''}）", "A", "backend", "3_api" if stage == "v1" else "9_v2_api", "api", [f["id"]], category="backend", stage=stage, hours=round(f["estimate_hours_human"] / len(chunks)), critical=f["human_review_h"] > 0, screen_ids=scr, entity_ids=ents, acts=a_ids, depends_on=F_ids[:5] + [t for t in D_ids if set(E[x]["id"] for x in ents) & set(tasks[[t_["id"] for t_ in tasks].index(t)]["entity_ids"])] + [f"T-F-{i:02d}" for i in range(1, len(F_ids)+1) if tasks[i-1]["choke_points"] and tasks[i-1]["choke_points"][0] in chokes],
                choke_points=chokes, choke_rationale="・".join(sorted({x for e in ch for x in e["outward_side_effects"]})) or "永続化のみ（C2）", fcp={"new": sorted({e["implementation_path"].split("::")[0] for e in ch}) + [f"apps/api/src/services/{f['id'][-2:]}.ts", f"apps/api/tests/{f['id'][-2:]}.spec.ts"], "modify": ["apps/api/src/app.ts"], "shared_read": ["08_api/openapi.yaml", "08_api/endpoints.json", "07_functional/entities.json"], "forbidden": ["apps/web/**", "packages/gateways/**（呼ぶだけ・直さない）"]},
                files_changed=[x + " (new)" for x in sorted({e["implementation_path"].split("::")[0] for e in ch})] + ["apps/api/src/app.ts (modify)"],
                ac={"structural": [f"UBIQUITOUS: {e['method']} {e['path']} は 08_api/openapi.yaml の operation {e['implementation_path'].split('::')[1]} どおりの入出力（{e['outputs_2xx']['status']} と 4xx {'/'.join(str(x['status']) for x in e['outputs_4xx'])}）" for e in ch], "functional": [x for e in ch for x in e["ears_ac_seed"][:3]] + [next((x for x in e["ears_ac_seed"] if x.startswith("UNWANTED")), "UNWANTED: IF 権限が無いなら 403 で副作用を起こさない") for e in ch][:3] + [f"UBIQUITOUS: 行レベル制御 {p} が効く" for p in pol[:4]], "regression": REG_BASE + ["契約テスト（OpenAPI）PASS", "endpoint 実在性チェック PASS"]},
                policies=pol, spec_links=["08_api/openapi.yaml", "08_api/API-SPEC.md", "07_functional/features.json#" + f["id"]] + [f"06_mockup/{stage}/{stage}-{s}.html" for s in scr[:3]], qa_rows={"l1": rows + errs, "l2_flows": [j["id"] for j in f["journey_candidates"]]}, scenarios=[{"name": f"{e['method']} {e['path']}", "steps": ["権限のある会員で呼ぶ", "権限の無い会員で呼ぶ", "別テナントの id で呼ぶ"], "expected": f"{e['outputs_2xx']['status']} / 403 / 404"} for e in ch], source=f["source"])
A_ids = [t["id"] for t in tasks if t["group"] == "A"]
# ---------------------------------------------------------------- Group U-shared
US = [("シェル（サイドバー・レール・第2ナビ・三画面・下タブ・枠の導出 data-frame・役割の出し分け data-roles）", ["D-065.1", "D-070.1", "D-072.2", "D-072.16", "D-073.8"], 24, ["apps/web/components/shell/*.tsx"]), ("自分のAIのパネルと会話の部品（assistant-ui・AG-UI・選択肢・承認カード・受領・引用・取り消し）", ["D-057.1", "D-062.1", "D-066.1", "D-072.19"], 32, ["apps/web/components/ai/*.tsx"]),
      ("API クライアントと型（OpenAPI → types.ts・TanStack Query・別 GET 再取得・401 で入り直し）", ["D-043.2", "D-051.1", "D-053.2"], 12, ["apps/web/lib/api/*.ts"]), ("認証の配管（ログイン・2 段階認証・招待・入り直し・端末の失効表示）", ["D-042.8", "D-051.2", "D-076.1"], 12, ["apps/web/app/(auth)/**"]),
      ("デザイントークンと部品（Tailwind @theme・shadcn/ui Base UI・Lucide・表・カード・札・空状態・止まっている帯）", ["D-052.1", "D-067.1", "D-071.5", "D-071.6"], 16, ["apps/web/styles/tokens.css", "apps/web/components/ui/*.tsx"]), ("タイムライン（svar-gantt・棒を押すと詳細・1023 以下は切替）と見え方の切替（リスト／カンバン／カレンダー）", ["D-079.1", "D-079.3", "D-079.4", "D-068.9"], 16, ["apps/web/components/views/*.tsx"])]
for i, (name, src, h, files) in enumerate(US, 1):
    tid = f"T-US-{i:02d}"; sp = f"{SPEC}/visual-fidelity-audit.md"; pre = f"USH-{i:02d}"
    rows = [qrow(sp, pre, "共通", "共通シェル", f"{name[:30]}：共通シェルを含む全画面で scrollWidth - clientWidth <= 1（375・768・1024・1440）", "全画面", "各幅で開く", "溢れ 0・本文 720 以上（1180+）", "G-05", tid), qrow(sp, pre, "共通", "役割の出し分け", "役割を切り替えると data-roles の塊が切り替わり、錠前だけの画面が無い", "4 役割", "切替", "役割ごとの中身が出る（G15）", "", tid)] + g_rows(sp, pre, "共通", tid, set(), [], "ui")
    newtask(tid, name, "U-shared", "ui", "4_ui_foundation", "ui", [], category="frontend", hours=h, depends_on=["T-F-01", "T-F-05"] + A_ids[:1], choke_points=[], choke_rationale="画面の部品。外界に出ない（API は関門の先）", fcp={"new": files, "modify": ["apps/web/app/layout.tsx"], "shared_read": ["04_design/DESIGN-kaname.md", "06_mockup/_shell.py", "08_api/types.ts"], "forbidden": ["packages/**"]}, files_changed=[x + " (new)" for x in files],
            ac={"structural": [f"STATE-DRIVEN: WHILE アプリの枠で描画中 THEN {name[:40]} が DESIGN-kaname.md のトークンとモックのシェル（_shell.py）と一致する"], "functional": ["UBIQUITOUS: 共通シェルを含む全画面で横溢れ 0・本文 720 以上（1180+）", "UNWANTED: IF セッションが 401 なら入り直しに落ち、入力途中の内容は失わない"], "regression": REG_UI}, spec_links=["04_design/DESIGN-kaname.md", "06_mockup/_shell.py"], qa_rows={"l1": rows, "l2_flows": []}, scenarios=[{"name": "4 幅で開く", "steps": ["375/768/1024/1440 で全画面"], "expected": "溢れ 0"}], source=src)
US_ids = [t["id"] for t in tasks if t["group"] == "U-shared"]
# ---------------------------------------------------------------- Group U-screen（画面ごと）
import re as _re2
def page_dir(s):
    """flow の route → Next.js App Router のフォルダ（:id → [id]。外の画面は (public)、それ以外は (app)）"""
    r = _re2.sub(r":(\w+)", r"[\1]", (s.get("route") or "/" + s["id"]).strip("/")); return ("(public)/" if NEEDS_LOGIN.get(s["id"], True) is False else "(app)/") + r
NEEDS_LOGIN = {x["id"]: x.get("needs_login", True) for x in F["screens"]}
for f in sorted([x for x in FD["items"] if x["group"] == "C"], key=lambda x: S[x["screen_ids"][0]].get("release", "v1")):   # 段階 2 の画面は仕様が揃った時点で（D-082〜D-085）タスクにし、Wave は段階 1 の後
    sid = f["screen_ids"][0]; s = S[sid]; tid = f"T-U-{len([t for t in tasks if t['group']=='U-screen'])+1:02d}"; html = open(s["mock_path"], encoding="utf-8").read() if s.get("mock_path") else ""
    sp = f"{SPEC}/screens/{sid}.md"; pre = "SCR-" + sid.upper(); rows = []
    for st in s["states"]: rows.append(qrow(sp, pre, sid, "状態", f"状態「{st['label']}」がモックどおりに出る（h1・第2ナビ・列の値がダミー固定でない）", "その状態を作る", "画面を開く", f"モック {s['mock_path']} の状態 {st['id']} と一致", "G-06・G-07", tid))
    for r in s["access_roles"]: rows.append(qrow(sp, pre, sid, "役割", f"役割 {r} で開くと、その役割の中身（data-roles）が出て、他の役割の中身は出ない", f"{r} でログイン", "画面を開く", "役割ごとの中身（G15）", "", tid))
    if s.get("primary_action"): rows.append(qrow(sp, pre, sid, "主アクション", f"「{s['primary_action']}」を押すと対応する endpoint が呼ばれ、別 GET で再取得した画面に反映される", "権限のある会員", "押す", "DB と画面が変わる（G-01・G-03）", " ".join(f"{a['method']} {a['path_draft']}" for a in s["required_apis"][:2] if a["role"] != "transition"), tid))
    for tr in s["transitions"][:8]: rows.append(qrow(sp, pre, sid, "到達性", f"リンク先 {tr} が実在ルートで 200 で開く", "—", "押す", f"/{tr} が開く（G-04）", "", tid))
    rows.append(qrow(sp, pre, sid, "横溢れ", "375・768・1024・1440 で scrollWidth - clientWidth <= 1、1180+ で本文 720 以上", "—", "各幅で開く", "溢れ 0", "G-05", tid))
    rows.append(qrow(sp, pre, sid, "空・止まっている", "データ 0 件の状態と AI が止まっている状態が cover 宣言どおりに出る", "PS2 / PS4", "開く", "空状態と止まっている帯", "G18", tid))
    rows += variance_rows(sp, pre, sid, tid, html); rows += g_rows(sp, pre, sid, tid, set(), [E[x]["table_name"] for x in s["related_entities"]], "ui")
    errs = error_rows(sid, None); eps = [EP[e] for e in f["api_endpoints"]]
    jobs = sorted({acts[a]["jobs"][0] for a in s["acts"] if a in acts and acts[a]["jobs"]}); deps = US_ids + [t["id"] for t in tasks if t["group"] == "A" and set(t["acts"]) & set(s["acts"])]
    _rel = s.get("release", "v1")
    newtask(tid, f"画面 {s['name']}（{len(s['states'])} 状態・{'/'.join(s['access_roles'])}{'・段階 2' if _rel == 'v2' else ''}）", "U-screen", "ui", "5_ui_parallel" if _rel == "v1" else "9_v2_ui", "ui", [f["id"]], category="frontend", stage=_rel, hours=f["estimate_hours_human"], screen_ids=[sid], entity_ids=s["related_entities"], acts=s["acts"], depends_on=deps, choke_points=[], choke_rationale="画面。外界に出ない（API は関門の先）",
            fcp={"new": [f"apps/web/app/{page_dir(s)}/page.tsx", f"apps/web/components/screens/{sid}/*.tsx", f"apps/web/tests/screens/{sid}.spec.ts"], "modify": [], "shared_read": [s["mock_path"] or "", "08_api/types.ts", f"07_functional/screens.json#{sid}"], "forbidden": ["apps/web/components/shell/**（共通シェルは T-US-01）", "packages/**"]}, files_changed=[f"apps/web/app/{page_dir(s)}/page.tsx (new)", f"apps/web/tests/screens/{sid}.spec.ts (new)"],
            ac={"structural": [f"UBIQUITOUS: 画面 {sid} は URL {s.get('route')} で開く（apps/web/app/{page_dir(s)}/page.tsx。遷移の href は flow の route と機械照合）", f"STATE-DRIVEN: WHILE 画面 {sid} が描画中 THEN h1「{s['h1_text'][:30]}」・第2ナビ {' / '.join(s['section_h2_texts'][:5])}・状態 {len(s['states'])}（{'、'.join(x['label'] for x in s['states'][:5])}）がモック {s['mock_path']} と一致する", f"STATE-DRIVEN: WHILE 役割 {'/'.join(s['access_roles'])} で開いたとき THEN 役割ごとの中身（data-roles）が出て、錠前だけの画面が無い"], "functional": [x for e in eps for x in e["ears_ac_seed"][:2]][:6] + [f"EVENT-DRIVEN: WHEN 「{s.get('primary_action') or '主アクション'}」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する", "UNWANTED: IF 列の値が実データでも「—」固定なら未実装として落とす"], "regression": REG_UI},
            policies=[], spec_links=[s["mock_path"] or "", f"07_functional/screens.json#{sid}", "08_api/screen-api-coverage.json"] + [f"01_hearing/決定ログ_進行中.md#{x}" for x in s["source"][:3]], qa_rows={"l1": rows + errs, "l2_flows": [j["id"] for j in f["journey_candidates"]]}, scenarios=[{"name": f"状態 {st['label']}", "steps": ["状態を作る", "開く"], "expected": "モックと一致"} for st in s["states"][:4]] + [{"name": "主アクション", "steps": ["押す", "別 GET"], "expected": "反映"}], source=f["source"])
U_ids = [t["id"] for t in tasks if t["group"] == "U-screen"]
# ---------------------------------------------------------------- Group I（結線・流れ・仕上げ）← features D / E
for f in [x for x in FD["items"] if x["group"] in ("D", "E")]:
    tid = f"T-I-{len([t for t in tasks if t['group']=='I'])+1:02d}"; comps = [c for d in f["depends_on"] for c in tid_of_feature.get(d, [])]
    sp = f"{SPEC}/journeys/plan.json" if f["id"].startswith("F-V3-D-E2E") else f"{SPEC}/zero-state.md"; pre = "INT-" + tid.split("-")[-1]; rows = []
    if f["id"].startswith("F-V3-D-E2E"):
        sp = f"{SPEC}/zero-state.md"
        rows.append(qrow(sp, pre, "流れ", "前提が揃っている", f"{f['name'][:40]}：runnable_after のタスクが全部 done で、各行為の画面が 200 で開く", "staging", "流れの各画面を順に開く", "全部開く（404 なし）", "L2 の入口", tid))
        rows.append(qrow(sp, pre, "流れ", "0 件で始める", f"{f['name'][:40]}：データ 0 件の会社で最初から通す", "新しいテスト会社", "最初から最後まで操作", "各段で空状態が出て、途中で詰まらない", "zero-state", tid))
    if not f["id"].startswith("F-V3-D-E2E"):
        rows.append(qrow(sp, pre, "結線", "価値経路が通る", f"{f['name'][:50]}：stub・echo・境界 throw が残っていない。実データで最後まで通る", "staging", "経路を最後まで操作", "結線されている（部品単体の緑では代替不可）", "結線", tid))
        rows += g_rows(sp, pre, "結線", tid, set(), [], "wiring")
    newtask(tid, f["name"][:64], "I", "polish" if f["group"] == "E" else "integration", "6_integration", "e2e", [f["id"]], category="test", hours=f["estimate_hours_human"], critical=f["human_review_h"] > 0, acts=f["acts"], depends_on=sorted(set(comps))[:24] or A_ids[:1], choke_points=sorted({c for x in f.get("external_resources", []) for c in []}), choke_rationale="結線・横断試験（部品の関門をそのまま使う）",
            fcp={"new": [f"apps/e2e/{f['id'].lower()}.spec.ts"], "modify": [], "shared_read": ["09_features/features.json", "07_qa/test-specs/journeys/plan.json"], "forbidden": []}, files_changed=[f"apps/e2e/{f['id'].lower()}.spec.ts (new)"],
            ac={"structural": [], "functional": (f["ears_ac_seed"][:6] or [f"UBIQUITOUS: {f['role']}"]) + ([] if any(x.startswith("UNWANTED") for x in f["ears_ac_seed"][:6]) else ["UNWANTED: IF この検査が赤のままなら、リリース判定を通さない（緑を貼るまで完了と言わない）"]), "regression": REG_BASE + ["流れ（L2）の全行 PASS を正本に書き戻す"]}, spec_links=["09_features/DAG.md"], qa_rows={"l1": rows, "l2_flows": [j["id"] for j in f["journey_candidates"]]}, scenarios=[{"name": f["name"][:30], "steps": ["最初から最後まで操作"], "expected": f["ears_ac_seed"][0][:60] if f["ears_ac_seed"] else "通る"}], source=f["source"], why=f.get("role", ""))
# ---------------------------------------------------------------- Group S（スキル制作・運営の資産）← 10_skills/catalog.json（D-080）
CAT = json.load(open("10_skills/catalog.json", encoding="utf-8"))["skills"]; KIND_JA = {"meta": "構築メタ", "goal": "目標スキル", "duty": "業務スキル"}; KIND_H = {"meta": 12, "goal": 10, "duty": 8}
ops_sk = next((t["id"] for t in tasks if t["group"] == "U-screen" and "ops-skills" in t["screen_ids"]), None); ops_api = next((t["id"] for t in tasks if t["group"] == "A" and "A80" in t["acts"]), None)
sp = f"{SPEC}/skills.md"; rows = []; pre = "SKL-00"
for k, it in [("必須の節", "SKILL.md に 発動条件／読む入力／手順／出す出力／判定基準／禁止／テスト場面 が全部ある"), ("禁止の中身", "資格情報・会社名・個人名・金額の実値が SKILL.md／references／evals に無い"), ("テスト場面", "evals/scenarios.json に 5 場面以上、各場面に given/when/then/look_at"), ("版と changelog", "version が changelog の最新と一致"), ("catalog と一致", "id がフォルダ名と catalog.json に一致し、draft の一式が存在")]:
    rows.append(qrow(sp, pre, "10_skills", "一式の検査", f"{k}：{it}", "10_skills に一式", "python3 scripts/ci/skill_pkg_gate.py 10_skills", "欠けがあれば FAIL（運営の画面からも上げられない）", "D-080.4", "T-S-01"))
rows.append(qrow(sp, pre, "ops-skills", "上げる側の検査", "検査に落ちた一式を運営の画面から上げる", "落ちる一式", "アップロードで落とす", "どの節・どの禁止語で落ちたかが出て、版は作られない", "D-080.4", "T-S-01"))
newtask("T-S-01", "スキル一式の形式・雛形・検査（skill_pkg_gate を運営のアップロードに結線）", "S", "content", "7_content", "spec", [], category="spec", hours=8, critical=True, acts=["A80"], screen_ids=["ops-skills"], depends_on=[x for x in (ops_sk, ops_api) if x], choke_points=["C4"], choke_rationale="一式は C4（オブジェクト置き場）に置き、検査は上げる前に走る",
        fcp={"new": ["10_skills/README.md", "10_skills/_template/SKILL.md", "10_skills/_template/evals/scenarios.json", "scripts/ci/skill_pkg_gate.py", "apps/api/skills/validate.ts"], "modify": ["10_skills/catalog.json"], "shared_read": ["01_hearing/決定ログ_進行中.md"], "forbidden": ["packages/gateways/**"]}, files_changed=["10_skills/README.md (new)", "10_skills/_template/SKILL.md (new)", "scripts/ci/skill_pkg_gate.py (new)", "apps/api/skills/validate.ts (new)"],
        ac={"structural": ["UBIQUITOUS: 10_skills/_template の一式（SKILL.md＋references＋evals/scenarios.json）が D-080.1 の節どおりで、skill_pkg_gate.py SK1〜SK6 が PASS する"], "functional": ["EVENT-DRIVEN: WHEN 運営がスキルの一式を上げたら、システムは skill_pkg_gate と同じ検査（必須の節・禁止の中身・場面 5・版）を走らせ、通った一式だけを skill_versions に作る", "UNWANTED: IF 一式に資格情報・会社名・個人名が含まれていたら、版を作らず、どの節で落ちたかを返す（中身は証跡に残さない）", "UBIQUITOUS: 会社側の画面には名前・目的・版だけが見え、一式の中身は見えない（D-078）"], "regression": REG_BASE}, spec_links=["10_skills/README.md", "01_hearing/決定ログ_進行中.md#80"], qa_rows={"l1": rows, "l2_flows": []}, scenarios=[{"name": "落ちる一式を上げる", "steps": ["禁止語を含む SKILL.md を上げる"], "expected": "版が作られず、落ちた節が出る"}], source=["D-080.1", "D-080.4", "D-078.2"], why="スキルの中身の形式と検査（D-080）")
for i, c in enumerate(CAT, 2):
    tid = f"T-S-{i:02d}"; pre = f"SKL-{i:02d}"; rows = []; sid = "goals" if c["kind"] == "goal" else ("ai-staff-detail" if c["kind"] == "duty" else "company-model")
    for j in range(1, 6): rows.append(qrow(sp, pre, sid, f"場面 {j}", f"{c['name']}：evals/scenarios.json の場面 {j} を運営のテスト会社で動かす", "テスト会社（データ 0 件から場面の状態を作る）", "自分のAIに場面の when を言う", "then のとおりの出力・判定（look_at の画面で確認）", "D-080.5", tid))
    rows.append(qrow(sp, pre, sid, "禁止", f"{c['name']}：外に出る操作・目標の勝手な確定をしない", "テスト会社", "外に出る操作を含む依頼をする", "関門と承認に落ち、スキルから直接は呼ばれない", "D-080.1", tid))
    rows.append(qrow(sp, pre, sid, "働いた記録", f"{c['name']}：どの版が働いたかが AI社員の動きと証跡に出る", "装着済み", "1 回動かして証跡を開く", "skill_version_id が action_runs に残り、証跡に名前と版が出る", "D-080.9", tid))
    newtask(tid, f"スキル制作 {KIND_JA[c['kind']]}「{c['name']}」（元ネタ {'・'.join(c['origin'][:2])}）", "S", "content", "7_content", "spec", [], category="spec", hours=KIND_H[c["kind"]], critical=True, acts=["A80", "A81"], screen_ids=["ops-skills"], depends_on=["T-S-01"], choke_points=[], choke_rationale="中身の制作。外界には触れない（テストはテスト会社の中）",
            fcp={"new": [f"10_skills/{c['id']}/SKILL.md", f"10_skills/{c['id']}/evals/scenarios.json", f"10_skills/{c['id']}/references/"], "modify": ["10_skills/catalog.json"], "shared_read": ["10_skills/_template/SKILL.md", "10_skills/README.md"], "forbidden": ["packages/**", "apps/**"]}, files_changed=[f"10_skills/{c['id']}/SKILL.md (new)", f"10_skills/{c['id']}/evals/scenarios.json (new)", "10_skills/catalog.json (modify)"],
            ac={"structural": [f"UBIQUITOUS: 10_skills/{c['id']} が雛形の節を全部持ち、skill_pkg_gate.py が PASS（catalog の status が draft → 版を出したら released）"], "functional": [f"EVENT-DRIVEN: WHEN 自分のAIが「{c['name']}」の発動条件に当たったら、システムはこのスキルを読み、出す出力のオブジェクトを変える（案として。人が確定する）", f"UNWANTED: IF テスト会社の 5 場面のうち 1 つでも期待と違ったら、版は出せない（配布先に届かない）", "UNWANTED: IF スキルが外に出る操作や資格情報の参照を含んでいたら、検査で落ちる"], "regression": REG_BASE[4:5] + ["python3 scripts/ci/skill_pkg_gate.py 10_skills PASS", "運営のテスト会社で evals の全場面 PASS を skill_test_runs に記録"]}, spec_links=[f"10_skills/{c['id']}/SKILL.md", "10_skills/README.md"], qa_rows={"l1": rows, "l2_flows": []}, scenarios=[{"name": "5 場面", "steps": ["テスト会社で場面 1〜5"], "expected": "全部 then どおり"}], source=c["source"] + ["D-080.2", "D-080.7"], why=f"{KIND_JA[c['kind']]}の中身を HQ の {'・'.join(c['origin'])} から汎用化して作る（D-080）")
# ---------------------------------------------------------------- Group V2（後回し＝段階 2 の仕様づくり）← 決定ログの「段階 2：…」の文と flow.json の deferred
# 後回しにした決定の文は、実装タスクにならないだけでなく「仕様づくり」のタスクにもならず日程から消えていた（2026-09-15・user「v2 のモックとか仕様書とかいつ作るの？」）。
# 文（D-xxx.n）ごとに 1 タスク。段階 2 の実装タスクは、その仕様が揃って flow の release に入った時点で本スクリプトが通常の Group として生成する。
LOG = open("01_hearing/決定ログ_進行中.md", encoding="utf-8").read(); DEFER = []
for sec in re.split(r"\n(?=## \d+\. )", LOG):
    m = re.search(r"decision: (D-\d{3})", sec); st = re.search(r"status: (\w+)", sec)
    if not m or not st or st.group(1) != "confirmed": continue
    tb = sec.split("### 決めたこと", 1)
    if len(tb) < 2: continue
    rows = [r for r in tb[1].split("\n") if r.startswith("| ") and not r.startswith("| 項目") and not r.startswith("|---")]
    for i, r in enumerate(rows, 1):
        cells = [c.strip() for c in r.strip().strip("|").split("|")]
        if re.match(r"^段階 ?2", cells[0]): DEFER.append({"clause": f"{m.group(1)}.{i}", "item": (re.sub(r"^段階 ?2\s*[：:]?\s*(で足す|以降)?\s*", "", cells[0]).strip() or (cells[1] if len(cells) > 1 else "")[:40]), "text": cells[1] if len(cells) > 1 else "", "refs": sorted(set(re.findall(r"D-\d{3}(?:\.\d+)?", cells[1] if len(cells) > 1 else "")))})
flow_defer = {k: v for k, v in F.get("deferred", {}).items()}
F_last = [t["id"] for t in tasks if t["group"] == "F"][-1:]
sp = f"{SPEC}/spec-work.md"
for i, d in enumerate(DEFER, 1):
    tid = f"T-V2-{i:02d}"; pre = f"SPC-{i:02d}"; rows = []; scr = [k for k, v in flow_defer.items() if d["clause"] in v and not k.startswith("A")]; acts_ = [k for k, v in flow_defer.items() if d["clause"] in v and k.startswith("A")]
    for k, it, exp in [("決定ログ", f"{d['item']}：決定ログに節（decision／status／reflect_in／決めたこと表）が足され、trace_gate T1〜T10 が緑", "trace_gate PASS"), ("画面と行為", f"{d['item']}：flow.json に行為・画面が入り、G17 の deferred からこの文が消える（release を v1 か次の段階に）", "flow_gate G1〜G10・G17 PASS"), ("モック", f"{d['item']}：モックが時点・役割・空／止まっている を持ち、治具（状態・横溢れ・レイアウト）が緑", "mock_state・role_gate・ui_lint・治具 ★0"), ("DB と設計書", f"{d['item']}：オブジェクトに ER 図の表と設計書の節がある（G20）。エラー一覧に異常状態が足されている（E1〜E9）", "er_gate・error_catalog gate PASS"), ("下流の再生成", f"{d['item']}：functional → api → features → tasks → tickets → waves → test-plan を再生成し、実装タスクが日程に出る", "layer_audit --run PASS・ticket_gate PASS")]:
        rows.append(qrow(sp, pre, "仕様", k, it, "この文が後回しのまま", "仕様づくりを 1 周回す", exp, d["clause"], tid))
    newtask(tid, f"段階 2 の仕様づくり：{d['item'][:40]}", "V2", "spec", "8_spec_v2", "spec", [], category="spec", hours=16, critical=False, acts=acts_, screen_ids=[], depends_on=F_last, choke_points=[], choke_rationale="仕様の作業。外界には触れない",
            fcp={"new": ["01_hearing/決定ログ_進行中.md#新しい節", "06_mockup/s_p11.py"], "modify": ["05_flow/data.py", "03_architecture/ER図.md", "03_architecture/アーキテクチャ設計書.md", "07_qa/test-specs/errors.json"], "shared_read": ["01_hearing/ヒアリングサマリー.md#段階リリース", "05_flow/flow.json#deferred"], "forbidden": ["apps/**", "packages/**（仕様が揃うまで実装しない）"]},
            files_changed=["01_hearing/決定ログ_進行中.md (modify)", "05_flow/data.py (modify)", "06_mockup/s_p11.py (new)", "03_architecture/ER図.md (modify)"],
            ac={"structural": [f"UBIQUITOUS: {d['item']} の画面・行為が flow.json の release に入り、G17 の deferred から {d['clause']} が消えている"], "functional": [f"EVENT-DRIVEN: WHEN 決定ログに {d['item']} の節を足したら、システム（ゲート）は trace_gate T1〜T10・flow_gate G17・er_gate G20・layer_audit G21 を全部緑で通す", "UNWANTED: IF 決定の無い後回しや、オブジェクトの無い『作る・配る・版』の文が残ったら、G17／T10 が赤のまま実装タスクを生成しない"], "regression": ["python3 scripts/ci/layer_audit.py --run PASS", "python3 scripts/ci/td_gate.py（TD11：後回しの文に仕様づくりのタスク）PASS"]},
            spec_links=["01_hearing/ヒアリングサマリー.md", "05_flow/flow.json"], qa_rows={"l1": rows, "l2_flows": []}, scenarios=[{"name": "仕様を 1 周回す", "steps": ["決定 → flow → モック → ER → 下流"], "expected": "実装タスクが日程に出る"}], source=[d["clause"]] + d["refs"], why=f"後回しにした文 {d['clause']}「{d['item']}」の仕様を作る（D-081.7：後回しは日程に載せる）")
# ---------------------------------------------------------------- エラー一覧の行（errors.md）をタスクに割り当て、タスク列を埋める
by_choke = {t["choke_points"][0]: t["id"] for t in tasks if t["group"] == "F" and t["choke_points"] and t["choke_points"][0].startswith("C")}
fallback = next((t["id"] for t in tasks if t["group"] == "I" and "セキュリティ監査" in t["title"]), tasks[-1]["id"])
assigned = {r for t in tasks for r in t["qa_rows"]["l1"]}
for e in ERR:
    ids3 = [f'{e["id"]}-{x}' for x in "ABC"]
    if "-NA" in e["id"] or any(r in assigned for r in ids3): continue   # N/A の類型は行を持たない
    w = e.get("where", {}); tgt = by_choke.get(w.get("choke_point")) or next((by_choke[c] for c in (e.get("covers") or []) if c in by_choke), None) or fallback
    tt = next(x for x in tasks if x["id"] == tgt); tt["qa_rows"]["l1"] += ids3; assigned.update(ids3)
owner = {}
for t in tasks:
    for r in t["qa_rows"]["l1"]:
        if r.startswith("E-"): owner.setdefault(r, []).append(t["id"])
ep = f"{SPEC}/errors.md"; lines = open(ep, encoding="utf-8").read().split("\n"); out = []
for ln in lines:
    if ln.startswith("| E-"):
        cells = [c.strip() for c in ln.strip().strip("|").split("|")]
        if len(cells) >= 11: cells[9] = " ".join(owner.get(cells[0], [])); cells[10] = cells[10] or "L1"; ln = "| " + " | ".join(cells) + " |"
    out.append(ln)
open(ep, "w", encoding="utf-8").write("\n".join(out))
# ---------------------------------------------------------------- 流れ（L2）：journeys/plan.json
jrows = []
for j in FD["journeys"]:
    impl = sorted({t["id"] for t in tasks if t["group"] in ("A", "U-screen") and set(t["acts"]) & set(j["acts"])})
    for k, a in enumerate(j["acts"], 1):
        rid = f"{j['id'].replace('-', '')}-{k:02d}"; b = BP.get(a, {})
        jrows.append({"id": rid, "journey": j["id"], "name": j["name"], "act": a, "role": "/".join(acts[a]["roles"]), "step": b.get("human") or acts[a]["act"], "expected": b.get("backstage", ""), "screen": (F["act_to_screen"].get(a) or [""])[0], "depends_on": [f"{j['id'].replace('-', '')}-{k-1:02d}"] if k > 1 else [], "runnable_after": sorted({t["id"] for t in tasks if t["group"] in ("A", "U-screen") and a in t["acts"]}), "result": "", "task": ""})
    for t in tasks:
        if t["group"] == "I" and any(jc["id"] == j["id"] for jc in FEAT.get(t["feature_id"], {}).get("journey_candidates", [])): t["qa_rows"]["l2_flows"] = sorted(set(t["qa_rows"]["l2_flows"]) | {j["id"]})
json.dump({"version": "v3.2", "created_at": TODAY, "_doc": "背骨のフェーズ → 流れ（J-xx）。runnable_after は揃うべきタスク。05_flow/build_tasks.py が生成", "rows": jrows}, open(f"{SPEC}/journeys/plan.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
# ---------------------------------------------------------------- Wave（依存順・CAP）
order = ["F", "D", "V2", "A", "U-shared", "U-screen", "I", "S"]; w = 0; waves = []
for stage, g in [(st, g) for st in ("v1", "v2") for g in order]:   # 段階 1 の全 Wave の後に段階 2（A → U-screen）
    fs = [t for t in tasks if t["group"] == g and t.get("stage", "v1") == stage]
    for i in range(0, len(fs), CAP):
        ch = fs[i:i+CAP]
        waves.append({"wave": w, "group": g, "stage": stage, "tasks": [t["id"] for t in ch], "parallel": len(ch), "wall_clock_h_ai": round(max(t["wall_clock_h_ai"] for t in ch) + 0.5, 1), "estimate_hours_human": sum(t["estimate_hours_human"] for t in ch), "estimate_hours_ai_compute": round(sum(t["estimate_hours_ai"] for t in ch), 1)})
        for t in ch: t["wave"] = w
        w += 1
# ---------------------------------------------------------------- 正本（11 列）を書く
HDR = "| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |\n|---|---|---|---|---|---|---|---|---|---|---|\n"
for fp, rows in qa_files.items():
    if fp.endswith("plan.json"): continue
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    title = os.path.basename(fp).replace(".md", "")
    # 正本の行は ID を変えない・作り直さない（test-ladder §9）。再生成しても「結果」列（実装者が staging で書いた PASS／BLOCKED）は残す
    prev_res = {}
    if os.path.exists(fp):
        for ln in open(fp, encoding="utf-8"):
            if ln.startswith("| ") and not ln.startswith("| ID "):
                cells = [c.strip() for c in ln.strip().strip("|").split("|")]
                if len(cells) >= 11 and cells[7]: prev_res[cells[0]] = cells[7]
    rows = [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7] or prev_res.get(r[0], ""), r[8], r[9], r[10]) for r in rows]
    kept = sum(1 for r in rows if r[7])
    body = f"# {title} テスト仕様（L1・機械生成）\n\n> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く（再生成しても残る。結果あり {kept} 行）。\n\n" + HDR + "".join("| " + " | ".join(str(c).replace("|", "／") for c in r) + " |\n" for r in rows)
    open(fp, "w", encoding="utf-8").write(body)
# ---------------------------------------------------------------- tickets.json ほか
by = lambda key: {k: sum(1 for t in tasks if t[key] == k) for k in sorted({t[key] for t in tasks})}
tot_h = sum(t["estimate_hours_human"] for t in tasks); tot_ai = round(sum(t["estimate_hours_ai"] for t in tasks), 1); rv = sum(t["human_review_h"] for t in tasks)
summary = {"total_tasks": len(tasks), "by_group": by("group"), "by_category": by("category"), "by_label": {"NEW": len(tasks)}, "by_deliverable_layer": by("deliverable_layer"), "by_phase": by("phase"),
           "by_screen_coverage": {"covered_screens": len({s for t in tasks for s in t["screen_ids"]}), "total_screens": len(S), "uncovered_screens": [s for s in S if not any(s in t["screen_ids"] for t in tasks)]},
           "total_estimate_hours_human": tot_h, "total_estimate_hours_ai_compute": tot_ai, "human_review_total_h": rv, "total_wall_clock_h_ai_parallel": round(sum(x["wall_clock_h_ai"] for x in waves), 1), "parallel_capacity": CAP, "calendar_days_ai": math.ceil(sum(x["wall_clock_h_ai"] for x in waves) / 6), "calendar_days_human": math.ceil(tot_h / 8), "total_estimate_hours": round(sum(t["estimate_hours"] for t in tasks), 1), "total_estimate_sessions": sum(t["estimate_sessions"] for t in tasks), "qa_rows_total": sum(len(t["qa_rows"]["l1"]) for t in tasks), "journeys": len(FD["journeys"])}
json.dump({"version": "v3.2", "project": "Kaname", "created_at": TODAY, "decomposition_mode": "api_first", "api_design_ref": {"openapi_path": "08_api/openapi.yaml", "screen_api_coverage_path": "08_api/screen-api-coverage.json", "contract_frozen_at": TODAY}, "_doc": "05_flow/build_tasks.py が機械生成。手で直さない。途中変更は差分（qa_delta.py）", "source": ["D-053.1", "D-036.4"], "summary": summary, "waves": waves, "tasks": tasks}, open("07_tasks/tickets.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump({"meta": {"project": "Kaname", "created_at": TODAY, "skill_version": "v3.2-machine", "total_tasks": len(tasks)}, "context": {"project_type": "SaaS（マルチテナント・AI社員・運営）", "team_type": f"並列セッション {CAP}", "decomposition_granularity": "AI 8h 以内／1 PR", "done_definition": "3-tier AC 全 pass ＋ CI gate ＋ 結線（stub は完了でない）", "deliverable_layer_order": "foundation → backend → ui → integration → polish（content＝スキル制作は開発と並行）", "decomposition_mode": "api_first（複数クライアント・並列 AI・モック先行・RLS が多い）"},
           "decision_log": [{"decision": "api_first（横切り）", "reason": "Web・Bridge・将来のアプリが同じ契約を叩き、AI が 10 並列で画面を作る。仕様は凍結済み", "alternatives": ["縦切り（垂直スライス）"], "tradeoffs": "触れるものが出るのは UI 並列の Wave まで遅い → 流れ J-01（登録〜はじめの設定）を最初の UI Wave に寄せて早く触れるようにする", "source": ["D-043.2", "D-053.1"]},
                            {"decision": "L1 行をタスクと同時に機械生成", "reason": "実装後に全体を見て書くと細部が抜ける（test-ladder）", "alternatives": ["human-grade-qa で後からまとめて"], "tradeoffs": "行数が多い（機械生成なので保守は再生成）", "source": ["D-069.6"]}],
           "task_patterns": [{"pattern_name": "関門先行 Foundation ＋ 用事ごとの API ＋ 画面ごとの UI ＋ 結線 I", "applicable_to": "モック先行・並列 AI の SaaS", "description": "F/D/A/U-shared/U-screen/I の 6 Group ＋ S（スキル制作・D-080）＋ V2（後回しの仕様づくり・D-081）、Wave は CAP で分割"}],
           "risk_flags": [{"task_id": t["id"], "risk_type": "致命級（人のレビュー）", "description": t["title"][:50], "mitigation": "human_review_h を持つ。上流を故意に壊す検証"} for t in tasks if t["critical"]][:20],
           "research": {"sources": [], "findings": ["機械生成のため件数は入力ではなく出力"], "research_date": TODAY}}, open("07_tasks/td-decisions.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
md = [f"# Kaname v3 タスク分解結果（api_first・{TODAY}）", "", "## サマリー", "", f"- 総タスク数：{len(tasks)}（{' / '.join(f'{k} {v}' for k, v in summary['by_group'].items())}）", f"- 画面の被覆：{summary['by_screen_coverage']['covered_screens']}/{summary['by_screen_coverage']['total_screens']}", f"- L1 テスト行：{summary['qa_rows_total']}（正本 07_qa/test-specs）／ 流れ（L2）：{summary['journeys']}",
      f"- 工数：Human {tot_h} h（{summary['calendar_days_human']} 日）／ AI 計算 {tot_ai} h ＋ 人のレビュー {rv} h → wall-clock {summary['total_wall_clock_h_ai_parallel']} h（{summary['calendar_days_ai']} 日・並列 {CAP}）", f"- Wave 数：{len(waves)}", "", "## Group 別タスク一覧", ""]
for g in order:
    md += [f"### Group {g}", "", "| ID | タイトル | category | layer | Human h | AI h | wall-clock | wave | depends_on | L1 行 |", "|---|---|---|---|---|---|---|---|---|---|"] + [f"| {t['id']} | {t['title'][:50]} | {t['category']} | {t['deliverable_layer']} | {t['estimate_hours_human']} | {t['estimate_hours_ai']} | {t['wall_clock_h_ai']} | {t['wave']} | {len(t['depends_on'])} | {len(t['qa_rows']['l1'])} |" for t in tasks if t["group"] == g] + [""]
md += ["## タスクカード（1 枚ずつ）", ""]
for t in tasks:
    md += [f"### {t['id']} {t['title']}", "", f"- group {t['group']} / layer {t['deliverable_layer']} / phase {t['phase']} / wave {t['wave']} / Human {t['estimate_hours_human']} h・AI {t['estimate_hours_ai']} h・wall-clock {t['wall_clock_h_ai']} h", f"- 行為 {' '.join(t['acts']) or '—'} / 画面 {' '.join(t['screen_ids']) or '—'} / 表 {' '.join(E[x]['table_name'] for x in t['entity_ids'][:6]) or '—'} / 関門 {' '.join(t['choke_points']) or '—（' + t['choke_points_rationale'] + '）'}", f"- 依存 {' '.join(t['depends_on'][:10]) or '—'}", f"- 根拠（逐語）：" + " ／ ".join(f"{d['id']}「{d['summary'][:60]}」" for d in t["decision_summaries"][:2]), "- 触るファイル：" + "、".join(t["files_changed"][:4]), "- AC（Tier 1）：" + " ／ ".join(x[:80] for x in t["acceptance_criteria"]["structural"][:2]), "- AC（Tier 2）：" + " ／ ".join(x[:80] for x in t["acceptance_criteria"]["functional"][:3]), f"- L1 行 {len(t['qa_rows']['l1'])}（{t['qa_rows']['l1'][:3]} …）／ L2 {t['qa_rows']['l2_flows'] or '—'}", f"- audit: {t['audit_md_path']}", ""]
open("07_tasks/TASK-CARDS.md", "w", encoding="utf-8").write("\n".join(md))
dep = [f"# v3 Dependencies / Wave Plan — Kaname（{TODAY}）", "", "| 指標 | 値 |", "|---|---|", f"| 総 task 数 | {len(tasks)} |", f"| Human 工数 | {tot_h} h |", f"| AI wall-clock | {summary['total_wall_clock_h_ai_parallel']} h（並列 {CAP}） |", "", "## Wave 構成", "", "| Wave | Group | task 数 | 並列 | Human h | AI 計算 h | wall-clock h |", "|---|---|---|---|---|---|---|"] + [f"| {x['wave']} | {x['group']} | {len(x['tasks'])} | {x['parallel']} | {x['estimate_hours_human']} | {x['estimate_hours_ai_compute']} | {x['wall_clock_h_ai']} |" for x in waves]
dep += ["", "## 依存 DAG", ""] + [f"- {t['id']} ← {' '.join(t['depends_on'][:8])}{' …' if len(t['depends_on']) > 8 else ''}" for t in tasks] + ["", "## CI gate", "", "lint / typecheck / coverage 80 / 契約テスト / endpoint 実在性 / 関門の迂回検出 / RLS を故意に壊す / mock-impl-diff / layer_audit / qa-ladder validate。全 PASS で auto-merge、1 つでも fail で retry、3 回で人へ。", ""]
open("07_tasks/DEPENDENCIES.md", "w", encoding="utf-8").write("\n".join(dep))
rows_ = lambda hdr, rs: "<table><thead><tr>" + "".join(f"<th>{h}</th>" for h in hdr) + "</tr></thead><tbody>" + "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rs) + "</tbody></table>"
html = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>Kaname タスクカード v3</title><style>body{{font-family:-apple-system,'Hiragino Sans',sans-serif;max-width:1300px;margin:32px auto;padding:0 20px;color:#1c2230;line-height:1.6}}table{{border-collapse:collapse;width:100%;font-size:12px;margin:10px 0 24px}}th,td{{border-bottom:1px solid #e3e6ec;padding:5px 7px;text-align:left;vertical-align:top}}th{{background:#f4f5f8}}.bar{{display:inline-block;height:8px;background:#22345C;border-radius:4px}}.bar.ai{{background:#2e9e6b}}details{{margin:4px 0}}</style></head><body>
<h1>Kaname タスクカード（v3.2・api_first・{TODAY}）</h1><p>タスク {len(tasks)} ／ Wave {len(waves)} ／ L1 行 {summary['qa_rows_total']} ／ Human {tot_h} h ／ AI wall-clock {summary['total_wall_clock_h_ai_parallel']} h（並列 {CAP}）</p>
<h2>Wave（二軸）</h2>{rows_(["Wave","Group","task","並列","Human h","AI 計算 h","wall-clock h","Human 棒 ／ AI 棒"], [[x['wave'], x['group'], len(x['tasks']), x['parallel'], x['estimate_hours_human'], x['estimate_hours_ai_compute'], x['wall_clock_h_ai'], f'<span class="bar" style="width:{min(300, x["estimate_hours_human"]/3)}px"></span><br><span class="bar ai" style="width:{min(300, x["wall_clock_h_ai"]*10)}px"></span>'] for x in waves])}
<h2>タスク</h2>{''.join(f"<details><summary>{t['id']} {t['title']} — {t['group']} / wave {t['wave']} / Human {t['estimate_hours_human']}h・AI {t['wall_clock_h_ai']}h / L1 {len(t['qa_rows']['l1'])}</summary><p>行為 {' '.join(t['acts']) or '—'}／画面 {' '.join(t['screen_ids']) or '—'}／関門 {' '.join(t['choke_points']) or '—'}／依存 {' '.join(t['depends_on'][:8])}</p><p>根拠：{' ／ '.join(d['id'] + '「' + d['summary'][:70] + '」' for d in t['decision_summaries'][:2])}</p><ul>" + ''.join(f'<li>{x}</li>' for x in (t['acceptance_criteria']['structural'] + t['acceptance_criteria']['functional'])[:6]) + '</ul></details>' for t in tasks)}
</body></html>"""
open("07_tasks/TASK-CARDS.html", "w", encoding="utf-8").write(html)
print(f"tasks {len(tasks)} {summary['by_group']} / waves {len(waves)} / L1 rows {summary['qa_rows_total']} / journeys {len(jrows)} rows / screens {summary['by_screen_coverage']['covered_screens']}/{len(S)} / human {tot_h}h ai wall {summary['total_wall_clock_h_ai_parallel']}h")
