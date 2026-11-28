#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_features.py — feature-decomposition（Group A〜E × Wave・縦割り・結線・流れ候補・組み合わせ・外部リソース・二軸工数）を機械生成。
   入力: flow.json・07_functional/*.json・08_api/endpoints.json・03_architecture/{choke-points,architecture}.json・02_tech_stack/selected-stack.json
   出力: 09_features/features.json（信頼源）・DAG.md・feature-decomposition.md/.html・fd-decisions.json"""
import json, re, os, datetime, math
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
F = json.load(open("05_flow/flow.json", encoding="utf-8")); BP = F["blueprint"]
FB_S = json.load(open("07_functional/screens.json", encoding="utf-8"))["items"]; FB_F = json.load(open("07_functional/features.json", encoding="utf-8"))["items"]
E = json.load(open("07_functional/entities.json", encoding="utf-8"))["entities"]; EP = json.load(open("08_api/endpoints.json", encoding="utf-8"))["endpoints"]
CH = json.load(open("03_architecture/choke-points.json", encoding="utf-8"))["choke_points"]; ARCH = json.load(open("03_architecture/architecture.json", encoding="utf-8"))
STACK = json.load(open("02_tech_stack/selected-stack.json", encoding="utf-8"))
TODAY = datetime.date.today().isoformat(); OUT = "09_features"; CAP = 10
acts = {a["id"]: dict(a, phase=ph["phase"]) for ph in F["backbone"] for a in ph["acts"]}
ent = {e["id"]: e for e in E}; scr = {s["id"]: s for s in FB_S}
ACC = {"infra": 15, "db": 12, "api": 12, "ui": 10, "e2e": 10, "spec": 6, "critical": 4}
def est(kind, h, critical=False):
    f = ACC["critical"] if critical else ACC[kind]; ai = round(h / f, 1); rv = 1.0 if critical else 0.0
    return {"estimate_hours_human": h, "estimate_hours_ai": ai, "human_review_h": rv, "wall_clock_h_ai": round(ai + rv, 1), "ai_acceleration_factor": f, "blocking_dependencies_h": 0, "estimate_method": "reference", "estimate_confidence": "medium"}
def combos(kind, chokes, screens):
    C = [("実行中 × 切替（モード・経路・設定を途中で変える）", "該当" if chokes & {"C1", "C3", "C5"} else "N/A：実行を持たない（サーバーの状態を読むだけ）"),
         ("中断 × 再開（PC が閉じる・Bridge が切れる・タブを閉じる）", "該当" if chokes & {"C1", "C3", "C5"} or kind == "ui" else "N/A：一回の要求で完結する"),
         ("別ロールの同時操作（承認者 2 人・運営と顧客）", "該当" if chokes & {"C2"} or kind == "wiring" else "N/A：読み取りだけ"),
         ("期限切れの瞬間（セッション・招待・サポートアクセス・猶予）", "該当" if kind in ("wiring", "api", "infra") else "N/A：期限を持つ行を触らない"),
         ("退会・停止中の実行（出来事の途中に要求が来る）", "該当" if chokes & {"C1", "C2", "C6", "C7"} else "N/A：口座状態を変えない読み取り")]
    return [{"point": p, "verdict": v} for p, v in C]
def ext_res(chokes, tables):
    r = []
    if "C4" in chokes or any(t in ("attachments", "artifacts", "export_jobs", "imports", "skill_versions") for t in tables): r.append({"resource": "ストレージのバケット（添付・成果物・持ち出し・スキル）", "provision": "migration/IaC で作成。起動時に存在確認（G-11）", "env": ["staging", "production"]})
    if "C6" in chokes: r.append({"resource": "メール送出（Resend）の API キーと送信ドメイン", "provision": "Infisical に置く。DNS（SPF/DKIM）は IaC", "env": ["staging", "production"]})
    if "C8" in chokes or "credentials" in tables or "integrations" in tables: r.append({"resource": "秘密管理（Infisical）のテナント鍵", "provision": "テナント作成時に鍵を分離", "env": ["staging", "production"]})
    if "C3" in chokes: r.append({"resource": "Bridge（Claude Code CLI・本人のサブスク）", "provision": "顧客 PC。staging はテスト会社の PC", "env": ["staging"]})
    if "C7" in chokes: r.append({"resource": "決済（Stripe・段階 2）", "provision": "段階 2。段階 1 は請求書払いで不要", "env": []})
    if "C1" in chokes: r.append({"resource": "外部サービス（サービス台帳の可否）", "provision": "テスト会社の本人アカウント以外に実操作しない", "env": ["staging"]})
    r.append({"resource": "Postgres（Supabase）と RLS", "provision": "migration。staging は dev プロジェクト", "env": ["staging", "production"]})
    return r
def acct(tables, chokes):
    hit = [t for t in tables if t in ("sessions", "credentials", "integrations", "invitations", "support_access_grants", "export_jobs", "notifications")]
    return {"applies": bool(hit) or bool(chokes & {"C8"}), "detail": "退会・停止・権限変更・パスワード変更で sessions を全行 revoked → この機能の接続・トークン・共有リンクも失効（G-14）" if hit else "口座状態の変化で持ち物が変わらない（sessions の失効で API 自体が 401 になる）", "touches": hit}

feats = []; ids = {}
def add(fid, name, group, kind, role, **kw):
    f_ = {"id": fid, "name": name, "group": group, "phase": {"A": "Foundation", "B": "Backend", "C": "UI", "D": "Integration", "E": "Polish"}[group], "kind": kind, "role": role, "category": kw.pop("category", kind),
          "acts": kw.pop("acts", []), "screen_ids": kw.pop("screens", []), "entity_ids": kw.pop("entities", []), "api_endpoints": kw.pop("endpoints", []), "access_control_policies": kw.pop("policies", []),
          "ears_ac_seed": kw.pop("ears", []), "depends_on": kw.pop("depends_on", []), "wired_by": [], "journey_candidates": kw.pop("journeys", []), "combination_points": kw.pop("combos", []),
          "external_resources": kw.pop("external", []), "account_state_impacts": kw.pop("acct", {"applies": False, "detail": "—", "touches": []}), "vertical_slice_components": kw.pop("vsc", {}),
          "ci_gates": {"lint": True, "type_check": True, "test_coverage": True, "access_control_coverage": bool(kw.get("_pol")), "mock_impl_diff": bool(kw.get("_scr")), "ears_validator": True, "layer_audit": True},
          "independence": kw.pop("independence", "medium"), "difficulty": kw.pop("difficulty", "medium"), "risk": kw.pop("risk", ""), "status": "decided", "decided_at": TODAY, "source": kw.pop("source", [])}
    f_.update(kw.pop("estimate")); f_["why"] = kw.pop("why", ""); f_["drift_origin"] = None
    feats.append(f_); ids[fid] = f_; return f_
# ---------------------------------------------------------------- Group A Foundation
A = []
A.append(add("F-V3-A-01", "monorepo と CI（lint・型・カバレッジ 80%・EARS validator・layer_audit）", "A", "infra", "全 PR の merge gate。以後の全 Group の前提", source=["(基盤)", "D-046", "D-050.2"], why="CI が無いまま着手すると drift と権限漏れが素通りする", estimate=est("infra", 24), external=[{"resource": "GitHub Actions・Vercel Preview・Railway staging", "provision": "IaC", "env": ["staging"]}], combos=combos("infra", set(), []), independence="high"))
A.append(add("F-V3-A-02", "アクセス制御の土台（RLS・app.tenant_id / app.user_id / app.role・has_permission()・visible_scopes()・permissions / layers / abilities）", "A", "db", "権限＝誰に×何に×どの層で×できること を DB 層で 1 回だけ実装", entities=[e["id"] for e in E if e["table_name"] in ("tenants", "scopes", "layers", "members", "permissions", "abilities", "target_kinds")], source=["D-026.1", "D-073.1", "D-073.2", "D-073.3", "D-073.4", "D-058.5"], estimate=est("db", 40, critical=True), combos=combos("infra", {"C2"}, []), external=ext_res({"C2"}, []), independence="high", difficulty="hard", risk="上流を故意に壊す検証（SET を飛ばす）が無いと正常系で判別できない", _pol=True))
A.append(add("F-V3-A-03", "証跡の土台（audit_events / ops_audit_events / security_events 追記専用・エクスポート）", "A", "db", "全操作の記録を 1 か所に", entities=[e["id"] for e in E if e["table_name"] in ("audit_events", "ops_audit_events", "security_events", "export_jobs")], source=["D-042.3", "D-074.4", "D-075.6", "D-077.7"], estimate=est("db", 16), combos=combos("infra", {"C2", "C4"}, []), external=ext_res({"C4"}, ["export_jobs"]), independence="high", _pol=True))
A.append(add("F-V3-A-04", "認証とセッション（Better Auth・sessions 表・全失効・2 段階認証・端末）", "A", "api", "ログイン → sessions → SET LOCAL → RLS。退会・停止・権限変更・パスワード変更で全行 revoked", entities=[e["id"] for e in E if e["table_name"] in ("sessions", "members", "invitations")], endpoints=[e["id"] for e in EP if e["auth"]["role"] == "public" or "sessions" in e["path"]], source=["D-042.8", "D-051.2", "D-074.2", "D-076.1"], estimate=est("api", 32, critical=True), combos=combos("api", {"C2"}, []), external=ext_res({"C2"}, ["sessions"]), acct=acct(["sessions", "invitations"], set()), independence="medium", difficulty="hard", risk="失効がトークン期限に頼る実装になると G-14 が破れる", _pol=True))
for c in CH:
    A.append(add(f"F-V3-A-{c['id']}", f"関門 {c['id']} {c['name']}（生 API の直接呼び出し禁止・CI で迂回検出）", "A", "infra", "外界に出る唯一の道。横断的関心事をここで 1 回だけ", category="choke", source=c.get("source", []) + ["D-050.2"], estimate=est("infra", 12, critical=c["id"] in ("C7", "C8")), combos=combos("infra", {c["id"]}, []), external=ext_res({c["id"]}, []), independence="high", why=f"迂回すると {', '.join(c.get('cross_cutting_handled_here', [])[:3])} が漏れる"))
A.append(add("F-V3-A-05", "OpenAPI → TS 型生成・契約テスト・endpoint 実在性チェック（API ↦ UI の依存方向を固定）", "A", "infra", "API 契約を信頼源にし frontend/backend が離れないようにする", source=["D-043.2", "D-051.1", "D-053.2"], estimate=est("infra", 12), combos=combos("infra", set(), []), independence="high"))
A.append(add("F-V3-A-06", "外部リソースのコード化（バケット・Resend・Infisical・DNS・staging）と起動時の存在確認", "A", "infra", "G-11。ダッシュボードで作る前提を無くす", source=["D-046", "D-049.5", "(基盤)"], estimate=est("infra", 16), combos=combos("infra", {"C4", "C6", "C8"}, []), external=ext_res({"C4", "C6", "C8"}, ["attachments"]), independence="high"))
A.append(add("F-V3-A-07", "エラー一覧の実行時（error_events・文言と次の一手を errors.json から引く・出せないエラーの検出）", "A", "api", "エラーは正本から。出せないエラーはデッドコード", entities=[e["id"] for e in E if e["table_name"] == "error_events"], source=["D-069.1", "D-069.3", "D-069.4"], estimate=est("api", 12), combos=combos("api", set(), []), independence="high"))
A.append(add("F-V3-A-08", "配置と staging の実体（apps/api の起動口 server.ts・Dockerfile・Railway／Vercel／Supabase／Infisical の環境・認証の schema 名を Supabase の auth と衝突させない・役割のパスワードを環境から・本番と同じ手順で起動時確認）", "A", "infra", "画面のタスクがブラウザで L1 を流す staging を、本番と同じ migration／deploy で作れる状態にする（G-11）。2026-09-16 user「staging を作る。作り方を出して」で、API の起動口と Dockerfile が無い・Better Auth の schema auth が Supabase と衝突する・役割のパスワードが migration に直書き、が見つかった", depends_on=["F-V3-A-05", "F-V3-A-06"], source=["D-053.1", "D-046", "(基盤)"], why="staging が無いと画面の L1・流れの L2 は流せない（ローカルの緑を staging の PASS と書けない）", estimate=est("infra", 20), external=[{"resource": "staging（Supabase 別プロジェクト・Railway 環境・Vercel Preview・Infisical staging）と production", "provision": "手順は infra/provision/README.md。口座と課金は PM が作り、コードは同じ migration／deploy を流す", "env": ["staging", "production"]}], combos=combos("infra", set(), []), independence="high", difficulty="medium", risk="Supabase の auth schema は GoTrue が持つ。Better Auth を同じ名前に置くと auth.users／auth.sessions が衝突する"))
A_ids = [f_["id"] for f_ in A]
# ---------------------------------------------------------------- Group B Backend（用事ごとの縦割り・裏側）
B = []
for fb in [x for x in FB_F if x["category"] == "job"]:
    fid = f"F-V3-B-{fb['job'][1:]:0>2}"; eps = [e for e in EP if set(e["acts"]) & set(fb["acts"])]; ents = sorted({x for e in eps for x in e["related_entities"]} | set(fb["related_entities"]))
    chokes = {c for e in eps for c in e["choke_points"]}; tables = [ent[x]["table_name"] for x in ents]
    pol = sorted({p for e in eps for p in e["access_control_policies"]})
    crit = bool(chokes & {"C7", "C8"}) or any(t in ("permissions", "sessions", "credentials", "account_events") for t in tables)
    B.append(add(fid, f"{fb['name'][:38]} — データ・API・権限", "B", "api", f"用事 {fb['job']} の裏側（{len(eps)} endpoint・{len(ents)} 表）", category="job", acts=fb["acts"], entities=ents, endpoints=[e["id"] for e in eps], policies=pol, ears=fb["ears_ac_seed"][:12] + [x for e in eps for x in e["ears_ac_seed"][:2]],
                 depends_on=["F-V3-A-01", "F-V3-A-02", "F-V3-A-03", "F-V3-A-04", "F-V3-A-05", "F-V3-A-07"] + [f"F-V3-A-{c}" for c in sorted(chokes)], source=fb["source"], estimate=est("api", 6 * len(eps) + 3 * len(ents) + 8, critical=crit),
                 combos=combos("api", chokes, []), external=ext_res(chokes, tables), acct=acct(tables, chokes), vsc={"entities": ents, "api_endpoints": [e["id"] for e in eps], "access_control_policies": pol, "tests": ["契約テスト（OpenAPI）", "RLS を故意に壊す", "関門の迂回検出", "L1 行（qa_rows）"], "middleware": ["session", "rate_limit", "idempotency（POST）"], "screens": []},
                 independence="medium", difficulty="hard" if crit else "medium", risk="関門を通らない直接呼び出し・RLS 拒否に頼った副作用", _pol=True))
B_ids = [f_["id"] for f_ in B]
job_of_act = {a: fb["job"] for fb in FB_F if fb["category"] == "job" for a in fb["acts"]}
# ---------------------------------------------------------------- Group C UI（画面ごとの縦割り・部品は既存トークン）
C = []
for s in FB_S:
    jobs = sorted({job_of_act[a] for a in s["acts"] if a in job_of_act}); deps = [f"F-V3-B-{j[1:]:0>2}" for j in jobs if f"F-V3-B-{j[1:]:0>2}" in ids] + ["F-V3-A-01", "F-V3-A-05"]
    eps = [a for a in s["required_apis"] if a["role"] != "transition"]; chokes = set()
    C.append(add(f"F-V3-C-{s['id']}", f"画面 {s['name']}（{len(s['states'])} 状態・{len(s['access_roles'])} 役割）", "C", "ui", s["purpose"][:60], acts=s["acts"], screens=[s["id"]], entities=s["related_entities"], endpoints=[e["id"] for e in EP if set(e["acts"]) & set(s["acts"])],
                 ears=[f"UBIQUITOUS: 画面 {s['id']} はモック {s['mock_path']} の状態 {len(s['states'])}（{'、'.join(x['label'] for x in s['states'][:6])}）と役割 {'/'.join(s['access_roles'])} を実装し、h1 は「{s['h1_text'][:30]}」", f"EVENT-DRIVEN: WHEN 主アクション「{s.get('primary_action') or '—'}」を押したとき THEN 対応する endpoint を呼び、結果を別 GET で再取得して画面に反映する"],
                 depends_on=deps, source=s["source"], estimate=est("ui", 4 + 2.5 * len(s["states"]) + 1.5 * len(s["access_roles"])), combos=combos("ui", chokes, [s["id"]]), external=[], acct={"applies": False, "detail": "画面は sessions の 401 で入り直しに落ちる", "touches": []},
                 vsc={"entities": s["related_entities"], "api_endpoints": [e["id"] for e in EP if set(e["acts"]) & set(s["acts"])], "access_control_policies": [], "tests": ["mock-impl-diff（h1・状態・第2ナビ）", "役割ごとの中身（G15）", "横溢れ 4 幅・本文幅", "実機で全操作要素を押す（G-01）", "L1 行"], "middleware": [], "screens": [s["id"]]},
                 independence="medium", difficulty="medium" if len(s["states"]) <= 4 else "hard", risk="モックの状態と役割を落とす・API を呼ばずにダミーで描く", _scr=True))
C_ids = [f_["id"] for f_ in C]
# ---------------------------------------------------------------- Group D 結線（コンポーネントを価値経路につなぐ）＋ E2E（流れ）
def wire(fid, name, role, comps, source, h, ears, journeys=None, chokes=None, tables=None, crit=False):
    chokes = chokes or set(); tables = tables or []
    f_ = add(fid, name, "D", "wiring", role, category="wiring", depends_on=comps, source=source, estimate=est("e2e", h, critical=crit), ears=ears, combos=combos("wiring", chokes, []), external=ext_res(chokes, tables), acct=acct(tables, chokes), journeys=journeys or [], independence="low", difficulty="hard", risk="stub・echo・境界で throw のまま「完了」に見える")
    for c in comps:
        if c in ids: ids[c]["wired_by"].append(fid)
    return f_
D = []
D.append(wire("F-V3-D-01", "実行ループの結線（自分のAI → 配る → AI社員 action_runs → 関門 → 一次確認 → 承認待ち → 画面）", "指示から承認まで 1 本の経路が実データで通る", ["F-V3-A-C1", "F-V3-A-C2", "F-V3-A-C3", "F-V3-A-C5"] + [f for f in B_ids if any(a in ids[f]["acts"] for a in ("A14", "A15", "A16", "A17", "A18", "A19", "A20"))] + [f"F-V3-C-{s}" for s in ("clone-chat", "clone-thread", "approvals", "ai-activity", "tasks", "today") if f"F-V3-C-{s}" in ids], ["D-010.1", "D-012.1", "D-055.1", "D-062.1", "D-066.1", "D-104.1"], 32, ["EVENT-DRIVEN: WHEN 自分のAIに「請求書を作って」と言ったとき THEN AI社員が動き、一次確認を経て承認待ちに実データで並び、承認すると外に出る（stub なし）", "UNWANTED: IF Bridge が切れているなら、実行は止まり「AI は止まっています」が出て、承認待ちは失われない"], chokes={"C1", "C2", "C3", "C5"}, tables=["action_runs", "approvals"], crit=True))
D.append(wire("F-V3-D-02", "認証 → 会社 → 権限 → 画面の解禁（login → sessions → SET LOCAL → RLS → 役割ごとの画面）", "入った人に、その人の範囲だけが実データで出る", ["F-V3-A-02", "F-V3-A-04"] + [f"F-V3-C-{s}" for s in ("login", "signup", "invite-accept", "mfa-setup", "today") if f"F-V3-C-{s}" in ids], ["D-073.1", "D-073.2", "D-058.5", "D-074.2"], 20, ["EVENT-DRIVEN: WHEN 担当者でログインしたとき THEN 会社の数字が出ず、配られた分と本人のものだけが出る", "UNWANTED: IF 退会・停止・権限変更・パスワード変更の直後なら、既存のセッションと Bridge は 0 秒で 401 になる"], chokes={"C2"}, tables=["sessions", "permissions"], crit=True))
D.append(wire("F-V3-D-03", "画面 → API → DB の通し配線（契約テスト・型生成同期・endpoint 実在性・別 GET で再取得）", "全画面が実経路で描く（モック fetch を残さない）", ["F-V3-A-05"] + C_ids, ["D-043.2", "D-053.2"], 24, ["UBIQUITOUS: 全画面の required_apis は実在の endpoint を呼び、書き込みは別 GET で再取得して反映する（G-03・G-06）", "UNWANTED: IF モックの値（—・ダミー）が実データでも固定なら、その列は未実装として落とす（G-07）"], chokes=set()))
D.append(wire("F-V3-D-04", "運営 ↔ 顧客の往復（問い合わせ → 受信箱 → 会社の詳細で返答 → 顧客の問い合わせに届く／お知らせ → 配達 → 既読）", "両側の画面と証跡に同じ行が出る", [f for f in B_ids if any(a in ids[f]["acts"] for a in ("A67", "A68", "A70", "A71", "A64"))] + [f"F-V3-C-{s}" for s in ("inquiry", "notices", "ops-support", "ops-tenant", "ops-notices") if f"F-V3-C-{s}" in ids] + ["F-V3-A-C6"], ["D-075.1", "D-075.2", "D-077.1", "D-077.3", "D-077.8"], 20, ["EVENT-DRIVEN: WHEN 運営が会社の詳細で返答したとき THEN 顧客の問い合わせに届き、両方の証跡に残り、通知の届け先に従って知らせる", "UNWANTED: IF 運営が許可の無い会社の台帳を読もうとしたら 403 で、その試みが運営の証跡に残る"], chokes={"C2", "C6"}, tables=["inquiries", "notices", "support_access_grants"]))
D.append(wire("F-V3-D-05", "出来事の依存処理 → 全失効（人が抜ける・退会・休止・権限変更・プラン変更・層を消す・AI社員を消す）", "全オブジェクトが表どおりに 消える／残る／移る／止まる／失効 する", ["F-V3-A-04", "F-V3-A-03"] + [f for f in B_ids if any(a in ids[f]["acts"] for a in ("A62", "A66", "A69", "A41", "A40"))] + [f"F-V3-C-{s}" for s in ("account-close", "member-detail", "members", "billing", "ai-staff-detail") if f"F-V3-C-{s}" in ids], ["D-074.1", "D-074.2", "D-074.3", "D-076.13", "D-078.7"], 28, ["EVENT-DRIVEN: WHEN 担当者を無効にしたとき THEN 引き継ぎ先が未決なら止まり、決めたら タスク・承認・AI社員・長 が表どおりに動き、本人のセッションと Bridge は 0 秒で失効する", "UNWANTED: IF 退会の猶予中に自動実行の要求が来たら、外には出ず止まる"], chokes={"C2", "C6", "C8"}, tables=["account_events", "sessions", "credentials", "integrations"], crit=True))
D.append(wire("F-V3-D-06", "スキルの配布 → 装着 → Bridge が読む → どのスキルが働いたかが証跡に出る", "運営が上げた版が、会社の AI社員の動きに実際に効く", [f for f in B_ids if any(a in ids[f]["acts"] for a in ("A80", "A81", "A59", "A79"))] + [f"F-V3-C-{s}" for s in ("ops-skills", "ai-staff-detail", "goals", "ai-activity") if f"F-V3-C-{s}" in ids] + ["F-V3-A-C3", "F-V3-A-C4"], ["D-078.1", "D-078.2", "D-078.3", "D-078.5", "D-078.6"], 20, ["EVENT-DRIVEN: WHEN 運営がテスト通過の版を出したとき THEN 配布先の会社の AI社員は次の実行からその版で動き、動きと証跡に版が出る", "UNWANTED: IF 会社の権限者が外したスキルなら、その AI社員では働かない"], chokes={"C3", "C4"}, tables=["skill_versions", "skill_attachments"]))
D.append(wire("F-V3-D-07", "通知の結線（出来事 → 届け先 → outbox → 配達 → 既読・失敗時の再送）", "承認待ち・止まった・お知らせが、選んだ経路で 1 回だけ届く", ["F-V3-A-C6"] + [f for f in B_ids if any(a in ids[f]["acts"] for a in ("A68", "A71", "A15"))] + [f"F-V3-C-{s}" for s in ("notices", "today") if f"F-V3-C-{s}" in ids], ["D-043", "D-075.2", "D-075.3"], 12, ["EVENT-DRIVEN: WHEN 承認待ちが来たとき THEN 届け先に従ってアプリ内とメールに 1 回だけ届く（dedupe_key）", "UNWANTED: IF 送出に失敗したら再送し、証跡に残す。二重には送らない"], chokes={"C6"}, tables=["notifications", "notification_preferences"]))
D.append(wire("F-V3-D-08", "課金の結線（プラン → 契約 → 月次の請求書 → 入金の記録 → 未収 → 休止の案内）", "請求書払いが月次で回り、未収が休止まで自動で辿る", [f for f in B_ids if any(a in ids[f]["acts"] for a in ("A69", "A72", "A79"))] + [f"F-V3-C-{s}" for s in ("billing", "ops-billing", "ops-tenant") if f"F-V3-C-{s}" in ids] + ["F-V3-A-C7", "F-V3-A-C4"], ["D-075.4", "D-075.5", "D-077.1", "D-002"], 16, ["EVENT-DRIVEN: WHEN 月初になったとき THEN 全社の請求書が発行され PDF が出て、会社側の請求書に並ぶ", "UNWANTED: IF 未収が 30 日を超えたら休止の案内が出て、休止中は AI社員と自動実行だけ止まりデータは残る"], chokes={"C4", "C6", "C7"}, tables=["invoices", "payments", "subscriptions"], crit=True))
# 流れ候補（背骨のフェーズ → J-xx。感覚で列挙しない）
journeys = []
for i, ph in enumerate(F["backbone"], 1):
    ja = [a["id"] for a in ph["acts"] if a.get("release") == "v1"]
    if not ja: continue
    jid = f"J-{i:02d}"; roles = sorted({r for a in ja for r in acts[a]["roles"]}); feats_ = sorted({f_["id"] for f_ in B + C if set(f_["acts"]) & set(ja)})
    journeys.append({"id": jid, "name": ph["phase"], "acts": ja, "roles": roles, "features": feats_, "observed": [f'{a}: {BP.get(a, {}).get("backstage", "")}' for a in ja][:8], "source": sorted({x for a in ja for x in acts[a]["source"]})[:6]})
for j in journeys:
    for fid in j["features"]:
        ids[fid]["journey_candidates"].append({"id": j["id"], "name": j["name"], "roles": j["roles"], "depends_on_features": [x for x in j["features"] if x != fid][:8], "observed": j["observed"][:3]})
    D.append(wire(f"F-V3-D-E2E-{j['id'][2:]}", f"流れ {j['id']} {j['name']} を最後まで通す（L2）", "役割をまたいで 1 本の流れが実結果で成立する", j["features"], j["source"], 6 + 2 * len(j["acts"]), [f"EVENT-DRIVEN: WHEN {'／'.join(j['roles'])} が {j['acts'][0]} から {j['acts'][-1]} まで順に操作したとき THEN {j['observed'][-1] if j['observed'] else ''}", "UNWANTED: IF 途中の行為で止まったら、次の行為に進めず、止まった理由が画面と証跡に出る"], journeys=[{"id": j["id"], "name": j["name"], "roles": j["roles"], "depends_on_features": j["features"], "observed": j["observed"]}]))
D.append(wire("F-V3-D-09", "drift 検出（モック ↔ 実装：h1・状態・第2ナビ・列の値／仕様 ↔ 実装：states・transitions・related_apis）", "仕様と実装のずれを機械で出す", ["F-V3-A-01", "F-V3-A-05"] + C_ids, ["D-053.2", "D-059.1"], 12, ["UBIQUITOUS: 全画面の h1・状態・第2ナビ・列の値がモックと一致し、states / transitions / related_apis が実装に 1 対 1 で対応する（G-06・G-07）"], chokes=set()))
D_ids = [f_["id"] for f_ in D]
# ---------------------------------------------------------------- Group E Polish
Ef = []
Ef.append(add("F-V3-E-01", "負荷試験（同時接続・集中時の rps・失敗率・接続プール）と有限資源の枯渇", "E", "e2e", "1 人で動く ≠ N 人で動く（G-16）", depends_on=D_ids[:3], source=["(基盤)", "D-004.10"], estimate=est("e2e", 16), combos=combos("infra", {"C2"}, []), external=ext_res({"C2"}, []), independence="low", risk="専用接続の多用で接続上限に張り付く"))
Ef.append(add("F-V3-E-02", "セキュリティ監査（RLS を故意に壊す・関門の迂回・運営の越境・資格情報の露出）", "E", "e2e", "起きてはいけないことを層ごとに数える（G-02）", depends_on=["F-V3-A-02", "F-V3-A-C8", "F-V3-D-02", "F-V3-D-05"], source=["D-042.6", "D-042.8", "D-074.5"], estimate=est("e2e", 16, critical=True), combos=combos("infra", {"C2", "C8"}, []), external=ext_res({"C8"}, ["credentials"]), independence="low"))
Ef.append(add("F-V3-E-03", "ポータビリティと依存の境界の検査（境界外 import・ベンダー固有 SQL・台帳との整合）", "E", "infra", "基盤を替えるときの依存箇所を物理的に閉じ込める", depends_on=["F-V3-A-01"], source=["D-049.1", "D-050.1", "D-050.2"], estimate=est("infra", 8), combos=combos("infra", set(), []), independence="high"))
Ef.append(add("F-V3-E-04", "文書とリリース準備（できること・できないことの開示・API 仕様の公開・変更履歴）", "E", "spec", "顧客と情シスに出す文書を成果物から機械生成", depends_on=D_ids, source=["D-042.1", "D-042.10"], estimate=est("spec", 12), combos=combos("infra", set(), []), independence="low"))
# ---------------------------------------------------------------- Wave（依存順・並列 CAP）
order = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4}; wave_no = 0; waves = []
for g in "ABCDE":
    fs = [f_ for f_ in feats if f_["group"] == g]; fs.sort(key=lambda f_: (-len([x for x in feats if f_["id"] in x["depends_on"]]), f_["id"]))
    for i in range(0, len(fs), CAP):
        chunk = fs[i:i + CAP]; ai = sum(f_["wall_clock_h_ai"] for f_ in chunk); hum = sum(f_["estimate_hours_human"] for f_ in chunk)
        waves.append({"wave": wave_no, "group": g, "phase": chunk[0]["phase"], "features": [f_["id"] for f_ in chunk], "parallel": len(chunk), "wall_clock_h_ai": round(max(f_["wall_clock_h_ai"] for f_ in chunk) + 0.5, 1), "estimate_hours_human": hum, "estimate_hours_ai_compute": round(ai, 1)})
        for f_ in chunk: f_["wave"] = wave_no
        wave_no += 1
# 孤立コンポーネント（結線されていない B/C）
orphans = [f_["id"] for f_ in feats if f_["group"] in ("B", "C") and not f_["wired_by"]]
# 循環
def cyc():
    seen, stack = set(), set()
    def dfs(n):
        if n in stack: return True
        if n in seen: return False
        seen.add(n); stack.add(n)
        for d in ids[n]["depends_on"]:
            if d in ids and dfs(d): return True
        stack.discard(n); return False
    return [f_["id"] for f_ in feats if dfs(f_["id"])]
tot_h = sum(f_["estimate_hours_human"] for f_ in feats); tot_ai = sum(f_["estimate_hours_ai"] for f_ in feats); rv = sum(f_["human_review_h"] for f_ in feats)
summary = {"total_features": len(feats), "by_group": {g: sum(1 for f_ in feats if f_["group"] == g) for g in "ABCDE"}, "waves": len(waves), "parallel_capacity": CAP, "total_estimate_hours_human": tot_h, "total_estimate_hours_ai_compute": round(tot_ai, 1), "human_review_total_h": rv, "total_wall_clock_h_ai_parallel": round(sum(w["wall_clock_h_ai"] for w in waves), 1), "calendar_days_ai": math.ceil(sum(w["wall_clock_h_ai"] for w in waves) / 6), "calendar_days_human": math.ceil(tot_h / 8), "orphan_components": orphans, "cycles": cyc()}
os.makedirs(OUT, exist_ok=True)
json.dump({"meta": {"version": "v3", "created_at": TODAY, "_doc": "05_flow/build_features.py が機械生成。手で直さない", "source": ["D-053.1", "D-036.4", "D-010"]}, "summary": summary, "items": feats, "waves": waves, "journeys": journeys}, open(f"{OUT}/features.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump({"meta": {"project": "Kaname", "created_at": TODAY, "skill_version": "v3", "total_features": len(feats), "parallel_groups": len(waves)}, "context": {"project_type": "SaaS（マルチテナント・AI社員・運営コンソール）", "scale": "大規模（59 画面・83 表・56 endpoint）", "priority": "quality"},
           "decision_log": [{"decision": "Group A に関門 8 本と権限の土台を置き、Backend を用事ごとの縦割りに", "reason": "外界に出る道は関門だけ。権限は DB 層で 1 回", "alternatives": ["機能ごとに認可を書く"], "tradeoffs": "Foundation が重い（Wave 0〜1）", "source": ["D-050.2", "D-073.1"]},
                            {"decision": "UI は画面ごと 1 PR", "reason": "モックと 1 対 1・役割ごとの中身・状態を落とさない", "alternatives": ["用事ごとに画面をまとめる"], "tradeoffs": "PR 数が多い（59）", "source": ["D-053.1", "D-073.8"]},
                            {"decision": "結線（D）を独立機能に", "reason": "部品を作っても価値経路が通らないと stub のまま完了に見える", "alternatives": ["結合テストだけ"], "tradeoffs": "結線に工数が要る", "source": ["D-010.1", "D-012.1"]}],
           "decomposition_patterns": [{"pattern_name": "関門先行 Foundation", "applicable_to": "外部に副作用を出す SaaS", "description": "C1〜C8 を最初に作り、迂回を CI で落とす"}, {"pattern_name": "用事ごとの縦割り Backend ＋ 画面ごとの UI ＋ 結線 D", "applicable_to": "モック先行のプロジェクト", "description": "B は用事、C は画面、D が両者を実経路でつなぐ"}],
           "research": {"sources": [], "findings": ["結線機能を独立させないと stub のまま完了に見える（本スキルの汎用規則）"], "research_date": TODAY}}, open(f"{OUT}/fd-decisions.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
# DAG.md / md / html
lines = [f"# DAG / Wave Plan — Kaname（{TODAY}）", "", "## 物量", "", "| 指標 | 値 |", "|---|---|", f"| 総機能数 | {len(feats)}（A {summary['by_group']['A']} / B {summary['by_group']['B']} / C {summary['by_group']['C']} / D {summary['by_group']['D']} / E {summary['by_group']['E']}） |", f"| Wave 数 | {len(waves)} |", f"| 並列度上限 | {CAP} |",
         f"| 工数 Human | {tot_h} h（{summary['calendar_days_human']} 日） |", f"| 工数 AI 並列 | 計算 {summary['total_estimate_hours_ai_compute']} h ＋ 人のレビュー {rv} h → wall-clock {summary['total_wall_clock_h_ai_parallel']} h（{summary['calendar_days_ai']} 日） |", f"| 孤立コンポーネント | {len(orphans)} |", f"| 循環 | {len(summary['cycles'])} |", "",
         "## Wave 別並列実行プラン", "", "| Wave | Group | 機能数 | 並列 | Human h | AI 計算 h | wall-clock h |", "|---|---|---|---|---|---|---|"]
lines += [f"| {w['wave']} | {w['group']} {w['phase']} | {len(w['features'])} | {w['parallel']} | {w['estimate_hours_human']} | {w['estimate_hours_ai_compute']} | {w['wall_clock_h_ai']} |" for w in waves]
lines += ["", "## 依存 DAG（Group 順）", ""] + [f"- {f_['id']} {f_['name'][:44]} ← {' '.join(f_['depends_on'][:6])}{' …' if len(f_['depends_on']) > 6 else ''}  ⇢ 結線 {' '.join(f_['wired_by'])}" for f_ in feats]
lines += ["", "## 流れ候補（L2・背骨から）", ""] + [f"- {j['id']} {j['name']}：{' → '.join(j['acts'])}（{'/'.join(j['roles'])}）" for j in journeys]
lines += ["", "## Risk flags", "", "| 機能 | risk | mitigation |", "|---|---|---|"] + [f"| {f_['id']} | {f_['risk']} | 人のレビュー {f_['human_review_h']} h |" for f_ in feats if f_["human_review_h"]]
lines += ["", "## 失敗 retry プロトコル", "", "1. CI が PR に失敗を貼る 2. 同じ機能の retry を別ブランチで起動 3. 3 回連続失敗で人にエスカレーション", ""]
open(f"{OUT}/DAG.md", "w", encoding="utf-8").write("\n".join(lines))
md = [f"# Kaname 機能分解結果（feature-decomposition v3・{TODAY}）", "", "## 分解の方針", "", "- 外界に出る道は関門 C1〜C8 だけ。権限は DB 層で 1 回。Foundation（A）が終わるまで Backend を解禁しない", "- Backend は用事ごとの縦割り（データ・API・権限・テスト）、UI は画面ごと 1 PR（モックと 1 対 1・役割ごとの中身）", "- 結線（D）を独立機能にした。部品を作っただけでは価値経路が通らない", "", "## 機能構造の概要", ""]
for g in "ABCDE":
    md += [f"### Group {g}（{ {'A':'Foundation','B':'Backend','C':'UI','D':'Integration','E':'Polish'}[g] }）", "", "| ID | 機能 | 依存 | Human h | AI h | wall-clock | 結線 |", "|---|---|---|---|---|---|---|"] + [f"| {f_['id']} | {f_['name'][:48]} | {len(f_['depends_on'])} | {f_['estimate_hours_human']} | {f_['estimate_hours_ai']} | {f_['wall_clock_h_ai']} | {' '.join(f_['wired_by'])} |" for f_ in feats if f_["group"] == g] + [""]
md += ["## 開発フェーズと順序", "", "Wave 0（Foundation）→ Backend → UI → Integration（結線・流れ）→ Polish。Wave 内も data → service → API → 画面の順。", "", f"## 集計（二軸）", "", f"| Human | AI 計算 | 人のレビュー | wall-clock（並列 {CAP}） | 日数 Human | 日数 AI |", "|---|---|---|---|---|---|", f"| {tot_h} h | {summary['total_estimate_hours_ai_compute']} h | {rv} h | {summary['total_wall_clock_h_ai_parallel']} h | {summary['calendar_days_human']} | {summary['calendar_days_ai']} |", ""]
open(f"{OUT}/feature-decomposition.md", "w", encoding="utf-8").write("\n".join(md))
rows = lambda hdr, rs: "<table><thead><tr>" + "".join(f"<th>{h}</th>" for h in hdr) + "</tr></thead><tbody>" + "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rs) + "</tbody></table>"
html = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>Kaname 機能分解 v3</title><style>body{{font-family:-apple-system,'Hiragino Sans',sans-serif;max-width:1200px;margin:32px auto;padding:0 20px;color:#1c2230;line-height:1.6}}table{{border-collapse:collapse;width:100%;font-size:12.5px;margin:10px 0 24px}}th,td{{border-bottom:1px solid #e3e6ec;padding:6px 8px;text-align:left;vertical-align:top}}th{{background:#f4f5f8}}.bar{{display:inline-block;height:8px;background:#22345C;border-radius:4px;vertical-align:middle}}.bar.ai{{background:#2e9e6b}}button{{margin-right:8px}}</style></head><body>
<h1>Kaname 機能分解（feature-decomposition v3・{TODAY}）</h1><p>機能 {len(feats)}（A {summary['by_group']['A']} / B {summary['by_group']['B']} / C {summary['by_group']['C']} / D {summary['by_group']['D']} / E {summary['by_group']['E']}）／ Wave {len(waves)} ／ 並列 {CAP} ／ 孤立 {len(orphans)} ／ 循環 {len(summary['cycles'])}</p>
<p><button onclick="document.body.dataset.axis='human'">Human-baseline</button><button onclick="document.body.dataset.axis='ai'">AI-accelerated</button> 二軸：Human {tot_h} h ／ AI wall-clock {summary['total_wall_clock_h_ai_parallel']} h</p>
<h2>Wave</h2>{rows(["Wave","Group","機能数","並列","Human h","AI 計算 h","wall-clock h","棒"], [[w['wave'], f"{w['group']} {w['phase']}", len(w['features']), w['parallel'], w['estimate_hours_human'], w['estimate_hours_ai_compute'], w['wall_clock_h_ai'], f'<span class="bar" style="width:{min(300, w["estimate_hours_human"]/2)}px"></span><br><span class="bar ai" style="width:{min(300, w["wall_clock_h_ai"]*6)}px"></span>'] for w in waves])}
<h2>機能</h2>{rows(["ID","機能","Group","Wave","依存","結線","Human h","AI h","wall-clock","根拠"], [[f_['id'], f_['name'], f_['group'], f_.get('wave'), ' '.join(f_['depends_on'][:5]), ' '.join(f_['wired_by']), f_['estimate_hours_human'], f_['estimate_hours_ai'], f_['wall_clock_h_ai'], ' '.join(f_['source'][:3])] for f_ in feats])}
<h2>流れ候補（L2）</h2>{rows(["ID","流れ","行為","役割","機能"], [[j['id'], j['name'], ' → '.join(j['acts']), '/'.join(j['roles']), ' '.join(j['features'][:8])] for j in journeys])}
</body></html>"""
open(f"{OUT}/feature-decomposition.html", "w", encoding="utf-8").write(html)
print(f"features {len(feats)} {summary['by_group']} / waves {len(waves)} / journeys {len(journeys)} / orphans {orphans} / cycles {summary['cycles']} / human {tot_h}h ai wall {summary['total_wall_clock_h_ai_parallel']}h")
