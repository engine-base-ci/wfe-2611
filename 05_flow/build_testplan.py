#!/usr/bin/env python3
"""build_testplan.py — S11 test-verification の成果物を上流から機械生成する（手で書かない）。
入力: 07_tasks/tickets.json（3-tier AC・qa_rows）／08_api/ears-ac-seed.json（EARS）／07_functional/entities.json（RLS）／
      03_architecture/foundation_gates.json（CI ゲート 26）／choke-points.json／02_tech_stack/selected-stack.json／07_qa/test-specs
出力: 07_qa/test-plan/test-plan.json（信頼源）・test-plan.md・test-plan.html・ears-test-mapping.json・access-matrix.json・.github/workflows/v3-gate.yml
検査: scripts/ci/tv_gate.py"""
import json, re, os, datetime, html
TODAY = datetime.date.today().isoformat(); OUT = "07_qa/test-plan"
J = lambda p: json.load(open(p, encoding="utf-8"))
T = J("07_tasks/tickets.json"); TASKS = T["tasks"]; EARS = J("08_api/ears-ac-seed.json")["ac_seeds"]; EN = J("07_functional/entities.json"); EN = EN.get("entities") or EN["items"]
FG = J("03_architecture/foundation_gates.json"); CP = J("03_architecture/choke-points.json")["choke_points"]; ST = J("02_tech_stack/selected-stack.json")["stack"]
ERR = J("07_qa/test-specs/errors.json")["errors"]; JR = J("07_qa/test-specs/journeys/plan.json")["rows"]
# 根拠の決定は作る仕事のチケット（11_tickets）と関門から。しまった 07_tasks の source は使わない（D-128.117）
KN = J("11_tickets/tickets.json")["tickets"]
SRC = sorted({s for t in KN for s in t.get("decisions", []) if s.startswith("D-")} | {s for c in CP for s in c.get("source", []) if str(s).startswith("D-")})
# ---------------------------------------------------------------- 3-tier AC ↔ テスト段
TIER_MAP = [
    {"tier": "structural（モック・契約と一致）", "level": "mock-impl drift lint／OpenAPI 契約", "tool": "pnpm ci:mock-impl-diff（h1・状態・第2ナビ・列の値）／pnpm ci:openapi-diff", "gate": "ui-mock-impl-diff・G11", "ladder": "L1"},
    {"tier": "functional.api（EARS EVENT-DRIVEN）", "level": "契約＋結合（実 Postgres）", "tool": "pnpm test（EARS から生成した test）＋ Schemathesis（openapi.yaml → fuzz）", "gate": "backend-coverage・G3", "ladder": "L1"},
    {"tier": "functional.unwanted 401/403（EARS UNWANTED）", "level": "認可・RLS（role × operation）", "tool": "access-matrix.json → pnpm ci:access-matrix（他テナント・権限なし・本人のみ）", "gate": "backend-access-matrix・G4/G6", "ladder": "L1"},
    {"tier": "functional.unwanted 422/409/429", "level": "unit（検証・冪等・レート）", "tool": "pnpm test（正規化の入出力表＝表記ゆらぎ・境界値）", "gate": "backend-coverage・G3", "ladder": "L1"},
    {"tier": "functional.unwanted 502（G-15）", "level": "結合（外部を故意に切る）", "tool": "pnpm test（Bridge／外部のスタブが完了信号なしで終わる）", "gate": "backend-coverage", "ladder": "L1"},
    {"tier": "functional.acceptance（行為が最後まで通る）", "level": "E2E（staging）", "tool": "Playwright（journeys/plan.json の流れ・runnable_after が揃った順）", "gate": "e2e・G15", "ladder": "L2"},
    {"tier": "regression.coverage", "level": "coverage", "tool": "pnpm test -- --coverage（lines 80／branches 70）", "gate": "backend-coverage・G3", "ladder": "L1"},
    {"tier": "regression.lint／type", "level": "静的", "tool": "pnpm lint／pnpm type-check／AC validator", "gate": "static・G1/G2/G14", "ladder": "L1"},
    {"tier": "regression.choke（関門の迂回）", "level": "静的解析（import グラフ）", "tool": "pnpm ci:choke -- --id C1..C8／no-dynamic-call／例外台帳", "gate": "static・G16〜G25", "ladder": "L1"},
    {"tier": "regression.spec（仕様の層）", "level": "仕様ゲート（Python）", "tool": "layer_audit --run／qa-ladder validate／error_catalog gate／skill_pkg_gate", "gate": "spec・G27〜G31", "ladder": "L1"},
    {"tier": "regression.task（そのタスクの L1 行）", "level": "正本の行", "tool": "qa-ladder gate --task <ブランチのタスク>", "gate": "task-gate・G32", "ladder": "L1"},
    {"tier": "L3〜L5（Wave・リリース・全体）", "level": "回帰（差分）", "tool": "completion_gate.sh／qa-coverage.py／負荷（k6・L4 のみ）", "gate": "締め（CI 外・手動起動）", "ladder": "L3-L5"},
]
# ---------------------------------------------------------------- EARS → test（1 文 1 test）
def slug(ep):
    m, p = ep.split(" ", 1); return (m.lower() + "_" + re.sub(r"[^a-z0-9]+", "_", p.lower().replace("/api/v1/", "")).strip("_"))
def classify(line):
    form = line.split(":")[0]; s = re.search(r"\b(401|403|404|409|422|429|502)\b", line); code = s.group(1) if s else ""
    if form == "EVENT-DRIVEN": return form, code, "contract+integration", "backend-coverage", "ok"
    if form == "UBIQUITOUS": return form, code, "contract", "backend-coverage", "shape"
    if code in ("401", "403"): return form, code, "access", "backend-access-matrix", "rejected_" + code
    if code == "429": return form, code, "unit", "backend-coverage", "rate_limited"
    if code == "502": return form, code, "integration（外部を切る・G-15）", "backend-coverage", "upstream_failed"
    if code == "409": return form, code, "unit（冪等）", "backend-coverage", "conflict"
    if code == "404": return form, code, "unit", "backend-coverage", "not_found"
    return form, code, "unit（検証・表記ゆらぎ）", "backend-coverage", "rejected_422"
task_by_text = {}
for t in TASKS:
    for a in t["acceptance_criteria_inline"]["tier_2_functional"]: task_by_text.setdefault(a["text"], []).append(t["id"])
mappings = []; n = 0
for e in EARS:
    sl = slug(e["endpoint"]); seen = {}
    for line in e["ears_ac_seed"]:
        n += 1; form, code, level, gate, kind = classify(line); k = f"{kind}"; seen[k] = seen.get(k, 0) + 1; fn = f"test_{sl}_{k}" + (f"_{seen[k]}" if seen[k] > 1 else "")
        mappings.append({"test_id": f"TC-{n:03d}", "endpoint": e["endpoint"], "feature_id": e["feature_id"], "acts": e["acts"], "screens": e["screen_ids"], "ears_form": form, "http_code": code, "ears_text": line,
                         "test_file": f"apps/api/test/generated/{sl}.test.ts", "test_function": fn, "test_level": level, "gate": gate, "ladder": "L1", "tasks": task_by_text.get(line, [])})
json.dump({"version": "v3", "skill": "test-verification", "created_at": TODAY, "_doc": "08_api/ears-ac-seed.json の 1 文 = 1 test。05_flow/build_testplan.py が生成。tickets の tier_2 と同じ文なので、実装者は tasks の列で自分の分を引く",
           "generator": "packages/api/test/generate_from_ears.ts（EARS の文 → vitest/jest の骨組み。EVENT-DRIVEN=正常・UNWANTED=異常・UBIQUITOUS=契約の形）", "counts": {"endpoints": len(EARS), "tests": len(mappings), "by_form": {f: sum(1 for m in mappings if m["ears_form"] == f) for f in ("EVENT-DRIVEN", "UNWANTED", "UBIQUITOUS")}},
           "mappings": mappings}, open(f"{OUT}/ears-test-mapping.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
# ---------------------------------------------------------------- access matrix（RLS の policy × 場合）
CASES = {"select": [("同じ会社・見える範囲", "OK"), ("同じ会社・見えない層", "NG（0 行）"), ("他の会社（SET LOCAL を別テナントに）", "NG（0 行）"), ("SET LOCAL を飛ばす", "NG（0 行・エラー）")],
         "insert,update,delete": [("権限あり・自分の範囲", "OK"), ("権限なし（担当者・閲覧のみ）", "NG（403・副作用なし）"), ("他の会社", "NG（0 行・副作用なし）"), ("SET LOCAL を飛ばす", "NG（エラー）")]}
ROLE_JA = {"member": "会社の人（R1〜R4・権限で分かれる）", "ops": "運営（R6）", "authenticated": "ログイン済み（本人のもの）", "client": "取引先の人（クライアントの場所）"}
# 取引先の人：役が合わない・他の会社・文脈なしでは 0 行。自分の取引先の行が読める・書けることは packages/db/test/clients.test.ts で見る（先方の人の登録が要る）
CASES_CLIENT = [("取引先として登録されていない人が client の文脈で", "NG（0 行・副作用なし）"), ("他の会社（取引先の人）", "NG（0 行・副作用なし）"), ("SET LOCAL を飛ばす", "NG（0 行・エラー）")]
CASES_AUTH = [("ログイン済み（会社の人）", "OK"), ("SET LOCAL を飛ばす", "NG（0 行）")]
CASES_SYSTEM = [("関門の関数（app.record_*）から", "OK"), ("会社の人が直接 INSERT", "NG（弾く）"), ("UPDATE／DELETE（誰でも）", "NG（追記専用）")]
CASES_OPS_OWN = [("運営の文脈", "OK"), ("会社の人（自社の文脈）", "NG（0 行）"), ("SET LOCAL を飛ばす", "NG（0 行）")]
CASES_OPS_WRITE = [("運営の文脈", "OK"), ("会社の人（運営でない）", "NG（弾く・副作用なし）"), ("SET LOCAL を飛ばす", "NG（弾く）")]
am = []
# 業務の表（public）として作らない表は場合表に入れない（KN-47）：ログインの部品の側（kaname_auth）と、ER 図で「段階 1 は作らない」と決めた表
NOT_PUBLIC = {"passkeys": "ログインの部品の側（kaname_auth・D-128.119）", "pending_signup": "ログインの部品の側（kaname_auth・D-088.2）"}
NOT_BUILT = {e["table_name"]: "段階 1 は作らない（D-099.2）" for e in EN if "段階 1 は作らない" in (e.get("note") or "")}
for en in EN:
    if en["table_name"] in NOT_PUBLIC or en["table_name"] in NOT_BUILT:
        continue
    for p in en["access_control_policies"]:
        cases = CASES_OPS_OWN if p["name"].endswith(("_ops_own", "_ops_all")) else CASES_SYSTEM if p["role"] == "system" else CASES_CLIENT if p["role"] == "client" else CASES_AUTH if p["role"] == "authenticated" else (CASES_OPS_WRITE if p["role"] == "ops" and p["operation"] != "select" else CASES.get(p["operation"], CASES["select"] if p["operation"] == "select" else CASES["insert,update,delete"]))
        for case, exp in cases:
            if p["role"] == "ops" and "他の会社" in case: exp = "NG（顧客が許可した範囲・期限の中だけ OK）"
            # 同じ表に「ログイン済みなら読める」（運営が全社に出す版・型）があれば、会社の人が読めるのはそちらの守り
            if p["name"].endswith(("_ops_own", "_ops_all")) and "会社の人" in case and any(x["role"] == "authenticated" and x["operation"] == "select" for x in en["access_control_policies"]):
                exp = "OK（全社向けの読みの policy で読める）"
            if p["name"].endswith("self_only_write") and "権限なし" in case: exp = "OK（自分の行だけ）・他人の行は NG"
            am.append({"entity": en["id"], "table": en["table_name"], "policy": p["name"], "role": p["role"], "role_ja": ROLE_JA.get(p["role"], p["role"]), "operation": p["operation"], "case": case, "expected": exp, "predicate": p["predicate"][:160], "source": p.get("source", [])})
json.dump({"version": "v3", "created_at": TODAY, "_doc": "entities.json の access_control_policies × 場合（見える範囲／見えない層／他の会社／SET LOCAL 無し／権限なし）。1 行 1 test。pnpm ci:access-matrix が全行を実 Postgres で流す",
           "counts": {"entities": len(EN), "policies": sum(len(e["access_control_policies"]) for e in EN), "cases": len(am)}, "cases": am}, open(f"{OUT}/access-matrix.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
# ---------------------------------------------------------------- CI ゲート（26 ＋ 仕様の層 ＋ タスク）
SPEC_GATES = [
    {"id": 27, "name": "層の棚卸し（G21）", "script": "python3 scripts/ci/layer_audit.py --run", "job": "spec", "blocking": True},
    {"id": 28, "name": "正本 ↔ tickets の参照整合（qa-ladder validate）", "script": "python3 scripts/ci/qa-ladder.py validate --spec 07_qa/test-specs --tickets 07_tasks/tickets.json", "job": "spec", "blocking": True},
    {"id": 29, "name": "エラー一覧 E1〜E9（引数を省かない）", "script": "python3 scripts/ci/error_catalog.py gate --catalog 07_qa/test-specs/errors.json --mocks 06_mockup/v1 --spec 07_qa/test-specs --choke 03_architecture/choke-points.json", "job": "spec", "blocking": True},
    {"id": 30, "name": "スキル一式 SK1〜SK6", "script": "python3 scripts/ci/skill_pkg_gate.py 10_skills", "job": "spec", "blocking": True},
    {"id": 31, "name": "テスト計画の整合 TV1〜TV8", "script": "python3 scripts/ci/tv_gate.py", "job": "spec", "blocking": True},
    {"id": 32, "name": "そのタスクの L1 行（ブランチ task/<ID>）", "script": "python3 scripts/ci/qa-ladder.py gate --spec 07_qa/test-specs --tickets 07_tasks/tickets.json --task \"$TASK_ID\"", "job": "task-gate", "blocking": True},
    {"id": 33, "name": "RLS の場合表（access-matrix.json 全行）", "script": "pnpm ci:access-matrix -- --matrix 07_qa/test-plan/access-matrix.json", "job": "database", "blocking": True},
    {"id": 34, "name": "EARS → test の対応（mapping の test が全部存在）", "script": "pnpm ci:ears-mapping -- --mapping 07_qa/test-plan/ears-test-mapping.json", "job": "database", "blocking": True},
    {"id": 35, "name": "有限資源の静的検査（G-16：関門外の生クライアント・タイムアウト無し・冪等キー無しの書込）", "script": "pnpm ci:resource-static", "job": "static", "blocking": True},
    {"id": 36, "name": "契約 fuzz（Schemathesis・openapi.yaml・作った口を本物の DB の上で叩く。答えの形の元の DB の列の書き出しも確かめる）", "script": "pip install -q schemathesis==4.33.0 && pnpm ci:schemathesis", "job": "database", "blocking": True},
    {"id": 37, "name": "デザインのトークンと新しい部品（正本どおり・明るい／暗いのコントラスト AA・生の値 D1〜D4）", "script": "python3 04_design/gen_tokens.py --web --check && python3 scripts/ci/design_gate.py --design 04_design/DESIGN-kaname.md --mocks apps/web/components/k --css apps/web/styles/k-tokens.css --part", "job": "spec", "blocking": True},
    {"id": 38, "name": "生成物が全部最新（作り手を全部回して、中身が変わる生成物・落ちる作り手・目録に無い生成物を赤にする・D-128.123）", "script": "python3 scripts/ci/generated_gate.py --selftest && python3 scripts/ci/generated_gate.py", "job": "spec", "blocking": True},
    {"id": 46, "name": "使っている部品が技術の選定の記録と合う（package.json と selected-stack.json の packages を 1 対 1・D-128.123）", "script": "python3 scripts/ci/stack_gate.py --selftest && python3 scripts/ci/stack_gate.py", "job": "spec", "blocking": True},
    {"id": 47, "name": "書いた検査が CI から回る・検査の自己試験（ci_wiring_gate・エラーの参照・自己試験 4 本・D-128.123）", "script": "python3 scripts/ci/ci_wiring_gate.py --selftest && python3 scripts/ci/ci_wiring_gate.py && pnpm -s ci:errors-used && pnpm -s ci:errors-used:selftest && pnpm -s ci:sql-guard:selftest && pnpm -s ci:chat-one:selftest && python3 scripts/ci/qa_delta.py --selftest", "job": "spec", "blocking": True},
]
ALL_GATES = [{**g, "job": "database" if g["id"] in (3, 4, 6, 12) else ("e2e" if g["id"] == 15 else "static")} for g in FG["merge_gates"]] + SPEC_GATES
def step(g): return f'      - name: "G{g["id"]} {g["name"]}{" [CRITICAL]" if g["id"] in FG.get("kaname_critical_gates", []) else ""}"\n        if: ${{{{ !cancelled() }}}}\n        run: {g["script"]}\n'   # 前の検査が赤でも次の検査を流す（赤を全部いっぺんに見る。job は赤のまま）
NODE = "      - uses: actions/checkout@v4\n      - uses: pnpm/action-setup@v4\n      - uses: actions/setup-node@v4\n        with: { node-version: '${{ env.NODE_VERSION }}', cache: pnpm }\n      - run: pnpm install --frozen-lockfile\n"
PYS = "      - uses: actions/checkout@v4\n      - uses: actions/setup-python@v5\n        with: { python-version: '3.12' }\n      - run: pip install pyyaml\n"
yml = f"""# .github/workflows/v3-gate.yml — Kaname CI ゲート {len(ALL_GATES)} 本（05_flow/build_testplan.py が生成。手で直さない）
# 方針: {FG['policy']}
# 段: static（静的・関門）→ database（実 Postgres・RLS・契約）／ spec（仕様の層・Python）／ task-gate（そのタスクの L1 行）→ e2e（has-ui）→ auto-merge
name: v3-gate
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
concurrency:
  group: ${{{{ github.workflow }}}}-${{{{ github.ref }}}}
  cancel-in-progress: true
env:
  NODE_VERSION: '22'
  PNPM_VERSION: '10'
jobs:
  static:
    runs-on: ubuntu-latest
    steps:
{NODE}{''.join(step(g) for g in ALL_GATES if g['job'] == 'static')}
  database:
    runs-on: ubuntu-latest
    needs: [static]
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env: {{ POSTGRES_PASSWORD: postgres, POSTGRES_DB: kaname_test }}
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
    env:
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/kaname_test
    steps:
{NODE}{''.join(step(g) for g in ALL_GATES if g['job'] == 'database')}
  spec:
    runs-on: ubuntu-latest
    # 仕様の層の検査は Python だけでなく pnpm の検査と DB の検査も呼ぶ（層の棚卸し G21）。database と同じ Postgres を付ける
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env: {{ POSTGRES_PASSWORD: postgres, POSTGRES_DB: kaname_test }}
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
    env:
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/kaname_test
    steps:
{NODE}      - uses: actions/setup-python@v5
        with: {{ python-version: '3.12' }}
      - run: pip install pyyaml
{''.join(step(g) for g in ALL_GATES if g['job'] == 'spec')}
  task-gate:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request' && startsWith(github.head_ref, 'task/')
    needs: [spec]
    steps:
{PYS}      - name: "ブランチ名からタスク ID を取る（task/T-A-01 → T-A-01）"
        run: echo "TASK_ID=${{{{ github.head_ref }}}}" | sed 's#task/##' >> "$GITHUB_ENV"
{''.join(step(g) for g in ALL_GATES if g['job'] == 'task-gate')}
  e2e:
    runs-on: ubuntu-latest
    if: contains(github.event.pull_request.labels.*.name, 'has-ui')
    needs: [static, database, spec]
    env:
      BASE_URL: ${{{{ secrets.STAGING_BASE_URL }}}}
    steps:
{NODE}      - run: pnpm --filter @kaname/web exec playwright install --with-deps chromium
{''.join(step(g) for g in ALL_GATES if g['job'] == 'e2e')}      - uses: actions/upload-artifact@v4
        if: failure()
        with: {{ name: playwright-report, path: apps/web/playwright-report/ }}
  auto-merge:
    runs-on: ubuntu-latest
    needs: [static, database, spec, task-gate]
    if: github.event_name == 'pull_request' && !contains(github.event.pull_request.labels.*.name, 'no-auto-merge')
    permissions: {{ contents: write, pull-requests: write }}
    steps:
      - name: Enable auto-merge (squash)
        run: gh pr merge --squash --auto "${{{{ github.event.pull_request.number }}}}"
        env:
          GH_TOKEN: ${{{{ secrets.GITHUB_TOKEN }}}}
"""
open(".github/workflows/v3-gate.yml", "w", encoding="utf-8").write(yml)
# 本番に出す前の関門（D-128.113）。ふだんの CI はゼロトラストの残りが「増えない」ことだけ見る。本番の前は残りが 0・秘密なし・弱点なし を求める
release_yml = f"""# .github/workflows/release-gate.yml — 本番に出す前の関門（05_flow/build_testplan.py が生成。手で直さない・D-128.113）
# 本番へのデプロイは、この関門が緑のときだけにする（Vercel の本番デプロイを、このワークフローの成功に結び付ける）
name: release-gate
on:
  workflow_dispatch:
  push:
    tags: ['v*']
  release:
    types: [published]
env:
  NODE_VERSION: '22'
  PNPM_VERSION: '10'
jobs:
  release-gate:
    runs-on: ubuntu-latest
    steps:
{NODE}      - name: "ゼロトラストの実装の残りが 0（--strict）"
        run: pnpm ci:zt:strict
      - name: "権限の試験（契約の全 API）"
        run: pnpm ci:authz
      - name: "契約の外の道すじが無い"
        run: pnpm ci:endpoints
      - name: "秘密の混入が無い"
        run: pnpm ci:secret-scan
      - name: "本番で使う部品に moderate 以上の弱点が無い"
        run: pnpm audit --prod --audit-level=moderate
"""
open(".github/workflows/release-gate.yml", "w", encoding="utf-8").write(release_yml)
# ---------------------------------------------------------------- リスク・対象外・枠組み
crit_tasks = [t for t in TASKS if t["critical"]]
RISK = [
    {"area": "テナント越え（RLS・SET LOCAL）", "risk": "高", "why": "1 社のデータが別の会社に見える。旧製品の死因の 1 つ", "tests": "access-matrix 全行（G33）・G4/G6・上流を故意に壊す行（rls-matrix.md）", "priority": "最優先"},
    {"area": "関門の迂回（外に出る操作・資格情報）", "risk": "高", "why": "承認前の送信・課金・資格情報の露出", "tests": "G16〜G25（静的解析）・UNWANTED 403 の副作用なし", "priority": "最優先"},
    {"area": "口座状態の波及（退会・停止・権限変更）", "risk": "高", "why": "退会後もセッション・Bridge が生きる（G-14）", "tests": "leave 表の行（7 出来事）・sessions revoked 0 秒", "priority": "最優先"},
    {"area": "AI の無言終了・Bridge 切断（G-15／G-12）", "risk": "中", "why": "exit 0 で空応答が完了扱いになる／切断直後 90 秒の誤表示", "tests": "502 の UNWANTED（外部を切る）・切替直後 0 秒の行", "priority": "優先"},
    {"area": "契約のずれ（画面 ↔ API ↔ 型）", "risk": "中", "why": "3 クライアントが同じ契約を叩く。ずれると UI 断線（G-03）", "tests": "G11 openapi-diff・Schemathesis（G36）・mock-impl-diff", "priority": "優先"},
    {"area": "表記ゆらぎ・境界値", "risk": "中", "why": "全角で入れた利用者がログインできず離脱した事故", "tests": "unit の入出力表（screens/*.md 表記ゆらぎ行）", "priority": "優先"},
    {"area": "見た目の細部（色・余白）", "risk": "低", "why": "治具（状態・横溢れ・レイアウト）で既に測っている", "tests": "mock-impl-diff だけ。スナップショット比較は入口画面 3 枚に限定", "priority": "後回し"},
]
NOT_TESTED = ["画面の見た目のスナップショット全画面（治具の実測で代替。入口 3 画面だけ）", "負荷の実測（L1〜L3 では静的検査 G35 のみ。L4 リリース前に k6 で同時 50・集中時 rps・失敗率を実測）", "本番データを触る通し（本番は L4 のスモークだけ。通しは staging）", "Bridge 経由の実 LLM 応答の内容評価（AI 実動は ai-runtime-matrix の行で見る。CI では完了信号の有無と形だけ）"]
TS = ST.get("testing", {})
FRAMEWORK = {"unit_contract": TS.get("unit_contract", "未定（selected-stack.json の stack.testing に無い → user に確認。決め打ちしない）"), "contract_fuzz": TS.get("contract_fuzz", "Schemathesis（openapi.yaml）"), "consumer_contract": TS.get("consumer_contract", "未定"), "e2e": TS.get("e2e", ST.get("e2e", "未定")), "access": "実 Postgres（pgvector/pg16）で SET LOCAL を切り替えて流す（pnpm ci:access-matrix）", "load": TS.get("load", "k6（L4 のみ）"), "ci": "GitHub Actions（.github/workflows/v3-gate.yml）"}
MOCK = {"db": "モックしない。CI は実 Postgres（migration＋seed）。RLS はモックで再現できない", "external": "C1/C6/C7 の外は記録済み応答のスタブ（関門の中で差し替え）。完了信号なし・タイムアウトのケースを必ず 1 本", "llm": "C3 は Bridge のスタブ（決まった応答・無言終了・途中切断）。実 LLM は staging の L2 で", "storage": "C4 はローカルのバケット代替。G-11 の存在確認は staging と production で実施"}
LADDER = [{"stage": "L1", "what": "tickets qa_rows.l1（正本の行 3,000 超）＋ EARS の test ＋ access-matrix", "where": "staging（単体・契約はローカル可）", "when": "実装した本人が merge 前", "gate": "qa-ladder gate --task（G32）"},
          {"stage": "L2", "what": f"journeys/plan.json {len(JR)} 行（流れ 9）", "where": "staging", "when": "runnable_after が揃った最後のタスクが merge 前", "gate": "同上（揃った流れを自動で含む）"},
          {"stage": "L3", "what": "Wave の L1＋L2 全部 ＋ 前 Wave の回帰（差分）", "where": "staging", "when": "Wave 締め", "gate": "completion_gate.sh"},
          {"stage": "L4", "what": "正本 full ＋ 本番スモーク（prod-smoke.md）＋ 負荷実測", "where": "staging ＋ 本番（スモークのみ）", "when": "リリース前", "gate": "qa-coverage.py STATUS 完了"},
          {"stage": "L5", "what": "full ＋ 正本の鮮度監査", "where": "staging", "when": "年次・大改修", "gate": "同上"}]
plan = {"version": "v3", "project": "Kaname", "created_at": TODAY, "skill": "test-verification", "_doc": "05_flow/build_testplan.py が上流（tickets・EARS・entities・foundation_gates・choke-points・stack）から機械生成。手で直さない", "source": SRC,
        "inputs": {"tickets": len(TASKS), "l1_rows": sum(len(t["qa_rows"]["l1"]) for t in TASKS), "ears_endpoints": len(EARS), "ears_tests": len(mappings), "entities": len(EN), "policies": sum(len(e["access_control_policies"]) for e in EN), "access_cases": len(am), "errors": len(ERR), "journey_rows": len(JR), "critical_tasks": len(crit_tasks)},
        "framework": FRAMEWORK, "tier_mapping": TIER_MAP, "risk": RISK, "not_tested": NOT_TESTED, "mock_strategy": MOCK, "ladder": LADDER,
        "coverage": {"lines": FG["merge_gates"][2]["threshold"]["lines"], "branches": FG["merge_gates"][2]["threshold"]["branches"], "business_logic": 80, "utilities": 60, "note": "閾値は foundation_gates.json G3 から"},
        "gates": ALL_GATES, "stages": {"static": "静的・関門（DB 不要）", "database": "実 Postgres（RLS・契約・coverage・access-matrix・EARS 対応）", "spec": "仕様の層（Python・G21/qa-ladder/エラー一覧/スキル/テスト計画）", "task-gate": "PR のブランチ task/<ID> の L1 行", "e2e": "has-ui ラベルの PR だけ・staging", "auto-merge": "static＋database＋spec＋task-gate が全部緑"},
        "merge_criteria": ["G1〜G36 が全部緑（e2e は has-ui のときだけ）", "ears-test-mapping.json の test が全部存在（G34）", "access-matrix.json の全行 PASS（G33）", "そのタスクの qa_rows.l1 が全行 PASS か理由つき BLOCKED（G32）", "連続 3 回失敗で高本さんへ（foundation_gates.retry_protocol）"],
        "change_follow_up": "仕様・チケットが途中で変わったら qa_delta.py --changed … --gate。EARS の差分は ears-test-mapping.json の差分として出す（全部作り直さない）",
        "critical_gates": FG.get("kaname_critical_gates", []), "retry_protocol": FG.get("retry_protocol", {}), "next_skill": "sprint-planning（S13）"}
json.dump(plan, open(f"{OUT}/test-plan.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
# ---------------------------------------------------------------- MD / HTML（JSON からの写し）
def tbl(h, rows): return "| " + " | ".join(h) + " |\n|" + "---|" * len(h) + "\n" + "".join("| " + " | ".join(str(c).replace("|", "／") for c in r) + " |\n" for r in rows)
md = [f"# Kaname テスト計画（v3・{TODAY}・機械生成）", "", f"> 05_flow/build_testplan.py が生成。信頼源は test-plan.json。根拠の決定：{' '.join(SRC)}", "",
      "## 入力", "", tbl(["項目", "数"], list(plan["inputs"].items())), "## 3-tier AC ↔ テストの段", "", tbl(["3-tier", "段", "道具", "ゲート", "梯子"], [[x["tier"], x["level"], x["tool"], x["gate"], x["ladder"]] for x in TIER_MAP]),
      "## リスク", "", tbl(["領域", "リスク", "理由", "テスト", "優先"], [[x["area"], x["risk"], x["why"], x["tests"], x["priority"]] for x in RISK]), "## テストしないもの（理由つき）", ""] + [f"- {x}" for x in NOT_TESTED] + ["",
      "## 枠組み", "", tbl(["用途", "道具"], list(FRAMEWORK.items())), "## モックの方針", "", tbl(["対象", "方針"], list(MOCK.items())), "## テスト・ラダー", "", tbl(["段", "何を", "どこで", "いつ", "ゲート"], [[x["stage"], x["what"], x["where"], x["when"], x["gate"]] for x in LADDER]),
      f"## CI ゲート {len(ALL_GATES)} 本（.github/workflows/v3-gate.yml）", "", tbl(["#", "名前", "script", "job", "致命"], [[f"G{g['id']}", g["name"], f"`{g['script']}`", g["job"], "★" if g["id"] in plan["critical_gates"] else ""] for g in ALL_GATES]),
      "## マージ可能の判断", ""] + [f"- {x}" for x in plan["merge_criteria"]] + ["", f"## EARS → test（{len(mappings)} 本・ears-test-mapping.json）", "", tbl(["形", "本数"], list(plan["inputs"].items())[:0] + [[k, v] for k, v in {f: sum(1 for m in mappings if m["ears_form"] == f) for f in ("EVENT-DRIVEN", "UNWANTED", "UBIQUITOUS")}.items()]),
      f"## RLS の場合表（{len(am)} 行・access-matrix.json）", "", tbl(["役", "policy 数", "場合 数"], [[ROLE_JA[r], sum(1 for e in EN for p in e['access_control_policies'] if p['role'] == r), sum(1 for c in am if c['role'] == r)] for r in ROLE_JA]),
      "## 途中変更", "", plan["change_follow_up"], "", "## 次", "", plan["next_skill"], ""]
open(f"{OUT}/test-plan.md", "w", encoding="utf-8").write("\n".join(md))
def hrows(h, rows): return "<table><thead><tr>" + "".join(f"<th>{html.escape(str(x))}</th>" for x in h) + "</tr></thead><tbody>" + "".join("<tr>" + "".join(f"<td>{html.escape(str(c))}</td>" for c in r) + "</tr>" for r in rows) + "</tbody></table>"
page = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>Kaname テスト計画</title><style>body{{font:14px/1.6 -apple-system,'Hiragino Sans',sans-serif;margin:32px;color:#1f2328;background:#fafaf8}}table{{border-collapse:collapse;margin:8px 0 20px;width:100%}}th,td{{border:1px solid #d9d6cf;padding:6px 10px;text-align:left;vertical-align:top;font-size:13px}}th{{background:#f0ede6}}h1{{font-size:22px}}h2{{font-size:17px;margin-top:28px;border-bottom:1px solid #d9d6cf;padding-bottom:4px}}code{{background:#eeece6;padding:1px 4px;border-radius:3px}}</style></head><body>
<h1>Kaname テスト計画（v3・{TODAY}）</h1><p>信頼源 test-plan.json（05_flow/build_testplan.py が生成）。tickets {len(TASKS)}／L1 行 {plan['inputs']['l1_rows']}／EARS test {len(mappings)}／RLS の場合 {len(am)}／CI ゲート {len(ALL_GATES)}</p>
<h2>3-tier AC ↔ テストの段</h2>{hrows(["3-tier","段","道具","ゲート","梯子"], [[x["tier"],x["level"],x["tool"],x["gate"],x["ladder"]] for x in TIER_MAP])}
<h2>リスク</h2>{hrows(["領域","リスク","理由","テスト","優先"], [[x["area"],x["risk"],x["why"],x["tests"],x["priority"]] for x in RISK])}
<h2>テストしないもの</h2><ul>{''.join(f'<li>{html.escape(x)}</li>' for x in NOT_TESTED)}</ul>
<h2>枠組み・モックの方針</h2>{hrows(["用途","道具"], list(FRAMEWORK.items()))}{hrows(["対象","方針"], list(MOCK.items()))}
<h2>テスト・ラダー</h2>{hrows(["段","何を","どこで","いつ","ゲート"], [[x["stage"],x["what"],x["where"],x["when"],x["gate"]] for x in LADDER])}
<h2>CI ゲート {len(ALL_GATES)} 本</h2>{hrows(["#","名前","script","job","致命"], [[f"G{g['id']}",g["name"],g["script"],g["job"],"★" if g["id"] in plan["critical_gates"] else ""] for g in ALL_GATES])}
<h2>マージ可能の判断</h2><ul>{''.join(f'<li>{html.escape(x)}</li>' for x in plan["merge_criteria"])}</ul>
<h2>EARS → test（先頭 40）</h2>{hrows(["ID","endpoint","形","code","段","ゲート","タスク"], [[m["test_id"],m["endpoint"],m["ears_form"],m["http_code"],m["test_level"],m["gate"]," ".join(m["tasks"])] for m in mappings[:40]])}
<h2>RLS の場合表（先頭 40）</h2>{hrows(["表","policy","役","操作","場合","期待"], [[c["table"],c["policy"],c["role_ja"],c["operation"],c["case"],c["expected"]] for c in am[:40]])}
</body></html>"""
open(f"{OUT}/test-plan.html", "w", encoding="utf-8").write(page)
print(f"tests {len(mappings)} (endpoints {len(EARS)}) / access cases {len(am)} (policies {plan['inputs']['policies']}) / gates {len(ALL_GATES)} / critical tasks {len(crit_tasks)} → {OUT}/ + .github/workflows/v3-gate.yml")
