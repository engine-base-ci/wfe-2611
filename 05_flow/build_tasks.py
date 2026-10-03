#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_tasks.py — task-decomposition v3.1（api_first）を機械生成。
   入力: 09_features/features.json・07_functional/*.json・08_api/endpoints.json・errors.json・flow.json・モック・決定ログ
   出力: 07_tasks/tickets.json（信頼源・JIT 用インライン込み）・TASK-CARDS.md/.html・DEPENDENCIES.md・td-decisions.json
         07_qa/test-specs/screens/<sid>.md ほか（L1 行の正本・11 列）・journeys/plan.json（L2）
   規約: test-ladder（L1 はタスクと同時）・decision-traceability（source・決定の summary 逐語）・choke-points・JIT"""
import glob, json, re, os, math, datetime
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
# 既に出してある行の ID を「行の中身」で引けるようにする。
# 途中に行が 1 本増えただけで後ろの ID が全部ずれると、実ブラウザで取った結果が別の行に付く。
# だから連番ではなく「同じ中身なら同じ ID・新しい行だけ末尾の番号」にする（test-ladder §9「ID は変えない」）
def _cell(x) -> str:
    """正本のセルと同じ形にする。書き出しは | を ／ に置き換え、読み出しは前後の空白を落とす"""
    return str(x).replace("|", "／").strip()

_OLD_ID: dict[tuple, list[str]] = {}
# 操作の行は、出る状態の一覧が増減すると文字が変わる（状態を 1 つ足しただけで同じボタンが別の行になり、結果ごと「もう無い行」へ移った・2026-10-01）。
# 文字どおりで見つからないときは「（状態 …）」を除いた形で引き、いちばん古い ID（最初からの持ち主）を引き継ぐ
_OLD_LOOSE: dict[tuple, list[str]] = {}
_LIVE: set[str] = set()   # 前回の仕様書で今の画面の行だった ID（末尾の「もう無い行」でない方）
_bare = lambda item: str(item).split("（状態 ")[0].strip()
_MAX_SEQ: dict[str, int] = {}
for _fp in glob.glob(f"{SPEC}/**/*.md", recursive=True):
    _now = True
    for _ln in open(_fp, encoding="utf-8"):
        if _ln.startswith("## もう無い行"):
            _now = False
        if not _ln.startswith("| ") or _ln.startswith("| ID "):
            continue
        _c = [x.strip() for x in _ln.strip().strip("|").split("|")]
        if len(_c) < 11 or not re.match(r"^[A-Z]", _c[0]):
            continue
        _pre, _, _num = _c[0].rpartition("-")
        if not _num.isdigit():
            continue
        _MAX_SEQ[_pre] = max(_MAX_SEQ.get(_pre, 0), int(_num))
        # 備考は後からゲート（ops_block・write_results）が書き換えるので鍵に入れない
        _OLD_ID.setdefault((_pre, _c[1], _c[2], _c[3]), []).append(_c[0])
        if _now:
            _LIVE.add(_c[0])
        if "（状態 " in _c[3]:
            _OLD_LOOSE.setdefault((_pre, _c[1], _c[2], _bare(_c[3])), []).append(_c[0])
for _k in _OLD_LOOSE:
    _OLD_LOOSE[_k].sort(key=lambda i: int(i.rpartition("-")[2]))

def qrow(file, prefix, screen, view, item, pre, steps, expect, note, task):
    rows = qa_files.setdefault(file, [])
    used = {r[0] for f in qa_files.values() for r in f}
    key = (prefix,) + tuple(_cell(x) for x in (screen, view, item))
    rid = ""
    exact = list(_OLD_ID.get(key, []))
    loose = _OLD_LOOSE.get((prefix, _cell(screen), _cell(view), _bare(_cell(item))), []) if "（状態 " in str(item) else []
    # 1. 前回いまの画面の行だった ID（文字どおり → 状態を除いた形）  2. 文字どおりに当たる古い行
    #    状態を除いた形でしか当たらない古い ID は呼び戻さない（ずっと前に役目を終えた ID が今の行を押し出した・2026-10-01）
    cands = [i for i in exact if i in _LIVE] + [i for i in loose if i in _LIVE and i not in exact] + [i for i in exact if i not in _LIVE]
    for cand in cands:
        if cand not in used:
            rid = cand
            break
    if not rid:
        _MAX_SEQ[prefix] = _MAX_SEQ.get(prefix, 0) + 1
        rid = f"{prefix}-{_MAX_SEQ[prefix]:03d}"
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
OPS_DIR = f"{SPEC}/ops"   # scripts/ci/derive_ops.py がモックから出す操作要素（L1 の分母。人が列挙しない）
def _ops(sid): return json.load(open(f"{OPS_DIR}/{sid}.json", encoding="utf-8"))["ops"] if os.path.exists(f"{OPS_DIR}/{sid}.json") else []
OP_KIND_JA = {"button": "ボタン", "link": "リンク", "input": "入力欄", "checkbox": "チェック", "select": "選択", "textarea": "入力欄", "tab": "タブ", "toggle": "開閉", "error": "エラー文言", "radio": "選択肢"}
def _op_expect(o):
    k = o["kind"]
    if k == "link": return (f"/{o['target']} が実在ルートで 200 で開く（G-04）" if o.get("target") else "リンク先が開く（外なら新しいタブ）")
    if k == "button": return "押すと処理が起き、結果（遷移・DB の変化・表示の変化）が確認できる。押しても何も起きないなら未実装（G-01）"
    if k in ("input", "textarea"): return "入力が受け付けられ、送信に載って別 GET で読める（G-01・反映）"
    if k in ("checkbox", "radio", "select"): return "切り替わり、送信に載る"
    if k == "tab": return "押すと中身が切り替わる（URL か表示で分かる）"
    if k == "toggle": return "開閉する"
    return "その条件を実際に作ると文言が出て、一手（直す導線）がある。作れないならデッドコード（G-08）"
def ops_rows(file, prefix, sid, task, ops):
    """操作要素 1 つ＝L1 の行 1 つ。結果は op_gate.py が「行 ID を名前に持つ実ブラウザのテストが通った」で検査する（説明文の PASS は赤）"""
    ids = []
    for o in ops:
        st = "・".join(o["states"]); roles = " ".join(o["roles"]) or "全役割"
        ids.append(qrow(file, prefix, sid, "操作", f"{OP_KIND_JA.get(o['kind'], o['kind'])}「{o['label']}」（状態 {st}）", f"状態 {o['states'][0]} を作る（{roles}）", "押す／入れる（実ブラウザ）" if o["kind"] != "error" else "その条件を作る", _op_expect(o), f"op={o['key']}", task))
    return ids
MAIL_SCREENS = {sid for sid, sc in S.items() if any("C6" in (BP.get(a, {}).get("choke_points") or []) for a in sc.get("acts", []))}
def mail_rows(file, prefix, sid, task):
    """メール（関門 C6）に触る画面の行：出す・届く・文面・届かないとき。dev は Resend の鍵、staging は送信ドメインの検証が前提（G-11）"""
    if sid not in MAIL_SCREENS: return []
    return [qrow(file, prefix, sid, "メール", "送る操作をすると実際に送られる（API のログに「送った」が出る・黙って落ちない）", "Resend の鍵が入っている", "送る操作をする", "ログに「[mail] 送った → 宛先」。落ちたら「送れなかった」と理由", "G-15・関門 C6", task),
            qrow(file, prefix, sid, "メール", "自分の受信箱に届く（迷惑メールに入らない）", "実在するアドレス", "届いたメールを開く", "件名・差出人・本文が読める。リンクを押すと目的の画面が開く", "関門 C6", task),
            qrow(file, prefix, sid, "メール", "文面に内部の言葉（ID・関門・テーブル名）が出ていない。誰宛てか・何をすればよいかが 1 行で分かる", "届いたメール", "本文を読む", "宛先の名前・用件・次の一手・差出人。内部語なし", "ui_lint の対象外なので人が見る", task),
            qrow(file, prefix, sid, "メール", "届かないときに詰まらない（再送の導線がある・登録の有無は漏らさない）", "存在しないアドレス／受信箱が拒否", "送る → 届かない", "画面は「送りました」のまま（有無を漏らさない）。再送で回復できる", "G-15", task),
            qrow(file, prefix, sid, "メール", "送れなかったものが「送った」になっていない（送出先が返す拒否を握り潰さない）", "送信ドメインが未検証、または宛先が拒否される", "拒否されるアドレスに送る", "ログに「[mail] 送れなかった → 宛先: 理由」。「送った」は出ない", "G-15。send は投げずに error を返すので、呼ぶ側が必ず見る", task)]
def handoff_row(file, prefix, sid, task):
    return qrow(file, prefix, sid, "発注者確認", f"手順 07_tasks/handoff/{task}.md を発注者が実際に触って OK を出す（Rule 12）", "staging か ローカル", "手順どおりに触る", "手順の末尾に「OK: 日付 名前」が書かれる。無い間は BLOCKED（発注者の確認待ち）", "Rule 12", task)
def error_rows(sid, aid):
    ids = []
    for e in (ERR_BY_SCREEN.get(sid, []) if sid else []) + (ERR_BY_ACT.get(aid, []) if aid else []):
        ids += [f'{e["id"]}-A', f'{e["id"]}-B', f'{e["id"]}-C']
    return sorted(set(ids))
_PREV_TASKS = json.load(open("07_tasks/tickets.json", encoding="utf-8"))["tasks"] if os.path.exists("07_tasks/tickets.json") else []
PREV_STATUS = {x["id"]: x.get("status", "todo") for x in _PREV_TASKS}   # 再生成で done を todo に戻さない（状態は実装の結果）
PREV_STAMP = {x["id"]: {k: x[k] for k in ("done_at", "started_at") if x.get(k)} for x in _PREV_TASKS}   # 実績の日も消さない
tasks = []; tid_of_feature = {}
def newtask(tid, title, group, layer, phase, kind, feature_ids, **kw):
    crit = kw.pop("critical", False); h = kw.pop("hours"); ta = two_axis(h, kind, crit)
    src = kw.pop("source", []); t = {"id": tid, "title": title, "category": kw.pop("category", "backend"), "label": "NEW", "feature_id": feature_ids[0] if feature_ids else None, "feature_ids": feature_ids,
         "screen_ids": kw.pop("screen_ids", []), "entity_ids": kw.pop("entity_ids", []), "acts": kw.pop("acts", []), "legacy_task_id": None, "phase": phase, "wave": None, "group": group, "deliverable_layer": layer, "stage": kw.pop("stage", "v1"),
         "depends_on": kw.pop("depends_on", []), "choke_points": kw.pop("choke_points", []), "choke_points_rationale": kw.pop("choke_rationale", ""), "forbidden_direct_apis_reminder": ["fetch", "axios", "undici", "pg / drizzle の生クライアント（関門の外）", "child_process", "fs（関門の外）", "nodemailer / resend（関門の外）", "anthropic / openai SDK（関門の外）"],
         "files_changed": kw.pop("files_changed", []), "files_changed_predicted": kw.pop("fcp", {"new": [], "modify": [], "shared_read": [], "forbidden": ["packages/gateways/**（関門の実装は Group F だけ）"]}),
         "acceptance_criteria": kw.pop("ac", {"structural": [], "functional": [], "regression": REG_BASE}), "access_policies_required": kw.pop("policies", []), "spec_links": kw.pop("spec_links", []),
         "audit_md_path": f"07_tasks/audit/{tid}.md", "status": PREV_STATUS.get(tid, "todo"), **PREV_STAMP.get(tid, {}), "qa_rows": kw.pop("qa_rows", {"l1": [], "l2_flows": []}), "test_scenarios_inline": kw.pop("scenarios", []), "source": src, "decision_summaries": dsum(src), "critical": crit, "why": kw.pop("why", "")}
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
        fcp = {"new": [".github/workflows/ci.yml", "packages/db/migrations/0001_foundation.sql", "packages/gateways/README.md"] + (["apps/api/package.json"] if "OpenAPI" in f["name"] else []) if f["kind"] == "infra" and not chokes else ([f"packages/gateways/{chokes[0].lower()}/index.ts", f"scripts/ci/choke_{chokes[0].lower()}.py"] if chokes else [f"packages/db/migrations/00{i+2}_{f['id'][-2:]}.sql", f"packages/db/policies/{f['id'][-2:]}.sql"]), "modify": ["package.json"], "shared_read": ["03_architecture/choke-points.json", "03_architecture/ER図.md", "02_tech_stack/selected-stack.json"], "forbidden": ["apps/web/**（基盤の段階で画面を触らない）"]}
        rows = []; sp = f"{SPEC}/prod-smoke.md" if f["kind"] == "infra" else f"{SPEC}/rls-matrix.md"; pre = "FND-" + f["id"].split("-")[-1]
        rows.append(qrow(sp, pre, "基盤", "基盤の存在", f"{f['name'][:40]}：CI／関門／表が staging と production に存在し、無ければ起動で落ちる", "migration/IaC 適用後", "起動時の存在確認を読む・CI を 1 回回す", "全部存在・gate が動く", "G-11", tid))
        rows.append(qrow(sp, pre, "基盤", "上流を故意に壊す", f"{f['name'][:40]}：SET LOCAL を飛ばす／関門を迂回する／権限を落とす", "staging", "壊した状態で要求", "他テナントの行が取れない・迂回は CI で fail・副作用が起きない", "G-02", tid))
        rows += g_rows(sp, pre, "基盤", tid, set(chokes) | ({"C2"} if f["kind"] == "db" else set()), [E[x]["table_name"] for x in f["entity_ids"]], "infra")
        newtask(tid, f["name"][:60] + part, "F", "foundation", "1_foundation", f["kind"] if f["kind"] in ("infra", "db", "api") else "infra", [f["id"]], category="infra" if f["kind"] == "infra" else "db", hours=round(f["estimate_hours_human"] / n), critical=f["human_review_h"] > 0, depends_on=sorted({t["id"] for d in f.get("depends_on", []) for t in tasks if d in t["feature_ids"]}), entity_ids=f["entity_ids"], choke_points=chokes or (["C2"] if f["kind"] == "db" else []), choke_rationale=f["role"], fcp=fcp, files_changed=[x + " (new)" for x in fcp["new"]] + [x + " (modify)" for x in fcp["modify"]],
                ac={"structural": [] if not chokes else [f"UBIQUITOUS: 関門 {chokes[0]} は 03_architecture/choke-points.json の gateway_path と forbidden_direct_apis どおりに実装され、迂回は CI で fail する"], "functional": f["ears_ac_seed"][:6] or [f"UBIQUITOUS: {f['role']}", f"UNWANTED: IF 基盤の検査が無い状態で後段の PR が来たら merge しない"], "regression": REG_BASE}, policies=[p["name"] for x in f["entity_ids"] for p in E[x]["access_control_policies"]][:12], spec_links=["03_architecture/アーキテクチャ設計書.md", "03_architecture/choke-points.json", "03_architecture/ER図.md"], qa_rows={"l1": rows, "l2_flows": []}, scenarios=[{"name": "存在確認", "steps": ["staging を起動"], "expected": "存在確認が全部通る"}, {"name": "上流を壊す", "steps": ["SET LOCAL を飛ばして要求"], "expected": "他テナントの行が取れない"}], source=f["source"], why=f.get("why", ""))
F_ids = [t["id"] for t in tasks]
# ---------------------------------------------------------------- Group D（Data）← ER の節ごと
sections = {}
for e in E.values(): sections.setdefault(e["section"], []).append(e)
for i, (sec, ents) in enumerate(sections.items(), 1):
    tid = f"T-D-{i:02d}"; tb = [e["table_name"] for e in ents]; pol = [p["name"] for e in ents for p in e["access_control_policies"]]
    src = sorted({s for e in ents for s in e["source"]}); crit = any(t in ("permissions", "sessions", "credentials", "account_events", "invoices", "payments") for t in tb)
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
US = [("シェル（サイドバー・レール・第2ナビ・三画面・下タブ・枠の導出 data-frame・役割の出し分け data-roles）", ["D-065.1", "D-070.1", "D-072.2", "D-072.16", "D-073.8"], 24, ["apps/web/components/shell/*.tsx"]), ("自分のAIのパネルと会話の部品（会話は AgentChat 1 つ・右パネルは共通の枠が必ず出す・選択肢・承認カード・受領・引用・取り消し・別の作りは chat_one で赤）", ["D-062.1", "D-066.1", "D-072.19", "D-103.1", "D-103.2", "D-103.3", "D-103.4", "D-103.5", "D-104.1"], 32, ["apps/web/components/ai/*.tsx", "apps/web/components/shell/app-shell.tsx", "scripts/ci/chat_one.mjs"]),
      ("API クライアントと型（OpenAPI → types.ts・TanStack Query・別 GET 再取得・401 で入り直し）", ["D-043.2", "D-051.1", "D-053.2"], 12, ["apps/web/lib/api/*.ts"]), ("認証の配管（ログイン・2 段階認証・招待・入り直し・端末の失効表示）", ["D-042.8", "D-051.2", "D-076.1"], 12, ["apps/web/app/(auth)/**"]),
      ("デザイントークンと部品（Tailwind @theme・shadcn/ui Base UI・Lucide・表・カード・札・空状態・止まっている帯）", ["D-052.1", "D-067.1", "D-071.5", "D-071.6"], 16, ["apps/web/styles/tokens.css", "apps/web/components/ui/*.tsx"]), ("タイムライン（svar-gantt・棒を押すと詳細・1023 以下は切替）と見え方の切替（リスト／カンバン／カレンダー）", ["D-079.1", "D-079.3", "D-079.4", "D-068.9"], 16, ["apps/web/components/views/*.tsx"])]
# T-US-00：apps/web の土台。画面のタスクは「apps/web がある・Playwright が動く・CI にブラウザの job がある」前提で書かれているのに、それを作るタスクが無かった（2026-09-16 user「そのチケットに行った際にちゃんとそれができる状態か」）
_sp0 = f"{SPEC}/visual-fidelity-audit.md"; _pre0 = "USH-00"; _tid0 = "T-US-00"
_rows0 = [qrow(_sp0, _pre0, "共通", "起動", "apps/web（Next.js 15 App Router・Tailwind・shadcn/ui・lucide-react）がローカルで起動し GET / が 200。業務ロジックは持たず API を呼ぶだけ", "pnpm dev", "/ を開く", "200・共通シェル無しでも落ちない", "D-043.3", _tid0),
          qrow(_sp0, _pre0, "共通", "到達性", "ナビ・カード・ボタンの href 集合 ⇔ 実在ルート集合（flow.json の route）を機械照合する検査がある（apps/web/tests/reachability.spec.ts）", "ルートを 1 つ消す", "検査を流す", "赤になる（消したルートを指す href が出る）・戻すと緑", "G-04", _tid0),
          qrow(_sp0, _pre0, "共通", "実ブラウザ", "Playwright（Chromium）で 375・768・1024・1440 の scrollWidth − clientWidth を数値で測る土台（apps/web/tests/_lib）が動く", "pnpm exec playwright test", "4 幅で / を開く", "4 幅とも 0・数値が結果に出る", "G-05・L-003", _tid0),
          qrow(_sp0, _pre0, "共通", "CI", "PR で CI のブラウザ job（foundation_gates #15）が走り、赤なら merge できない", "到達性を故意に壊した PR", "CI を見る", "job が赤・merge がブロックされる", "", _tid0),
          qrow(_sp0, _pre0, "共通", "実行環境", "画面の L1・流れの L2 を流す staging（本番と同じ構成をもう 1 組）が存在し、apps/web がそこに配られる。無い間は「ローカルの実ブラウザで流し、staging の行は BLOCKED（理由つき）」を備考に書く", "staging の URL", "/ を開く", "200・API と DB が staging のもの", "G-11", _tid0)] + g_rows(_sp0, _pre0, "共通", _tid0, set(), [], "ui") + [
    # 入口と行き先の規則（D-086）。画面ではなく規則なので画面の導出（G1〜G10）では守れない。ID を変えないため末尾に足す
          qrow(_sp0, _pre0, "共通", "入口", "入っていない人が / を開くと 入る画面（login）へ送られる（素のプレースホルダを出さない・D-086）", "入っていない", "/ を開く", "/login が開く", "D-086", _tid0),
          qrow(_sp0, _pre0, "共通", "入口", "入っている人が / を開くと 製品の時点の画面へ送られる（PC をつないでいなければ 自分のPCをつなぐ）", "入っている・Bridge 未接続", "/ を開く", "/setup/bridge が開く", "D-086", _tid0),
          qrow(_sp0, _pre0, "共通", "入口", "入っている人（PC をつないだ後）が / を開くと 今日 へ送られる", "入っている・Bridge 接続済み", "/ を開く", "今日（/today）がまだ無い間は、ある画面（会話モード /ai/chat）が開く。入口はまだ無い画面へ送り返さない（404 → 入口 → 404 の輪を作らない）。今日 ができたら /today が開く", "D-086 D-086.6", _tid0),
          qrow(_sp0, _pre0, "共通", "無いパス", "存在しないパスは「この画面はありません」と戻る導線を出す（素の 404 にしない・D-086）", "—", "/no-such-page を開く", "文言と戻る導線が出て、押すと入口か入る画面へ", "D-086", _tid0),
          qrow(_sp0, _pre0, "共通", "権限外", "その権限で見えない画面に直接 URL で来たら「この権限では見えない」と見える画面への導線を出す（無言の空画面にしない・D-086）", "閲覧のみで入っている", "その権限で見えない画面の URL を開く", "文言と導線が出る", "D-086", _tid0),
    # はじめの設定は飛ばせない（D-089）。進み具合（members.setup_step 0〜6）を見て、通していない人を今の段へ戻す
          qrow(_sp0, _pre0, "共通", "はじめの設定", "はじめの設定を 1 つも通していない人がログインすると 自分のPCをつなぐ（段 1）へ送られる（今日 へ飛ばさない）", "登録直後・段 0", "ログインする", "/setup/bridge が開く", "D-089", _tid0),
          qrow(_sp0, _pre0, "共通", "はじめの設定", "途中まで通した人がログイン・/ を開くと、次にやる段へ送られる（進んだところまで戻す）", "段 1 まで通した", "ログインし直す／/ を開く", "/onboard/interview（段 2）が開く", "D-089", _tid0),
          qrow(_sp0, _pre0, "共通", "はじめの設定", "通していない人が先の段の画面を直接 URL で開くと、今の段へ戻される（先の画面の中身を一瞬も見せない）", "段 1 まで通した", "/settings/credentials（段 4）を開く", "/onboard/interview（段 2）へ戻る", "D-089", _tid0),
          qrow(_sp0, _pre0, "共通", "はじめの設定", "いま開いている画面がその段そのものなら通す（戻し続けてその段から出られなくならない）", "段 3 まで通した", "/settings/credentials（段 4）を開く", "そのまま開く", "D-089", _tid0),
          qrow(_sp0, _pre0, "共通", "はじめの設定", "進み具合は戻らない。先の段まで通した人が前の段を開き直しても、記録は下がらない", "段 3 まで通した", "段 2 の画面を開いて操作する", "記録は 3 のまま（/ を開くと段 4 へ）", "D-089", _tid0),
          qrow(_sp0, _pre0, "共通", "はじめの設定", "手順バーに、通し終わった段が済（チェック）で出る", "段 1 まで通した", "はじめの設定の画面を開く", "段 1 にチェック・読み上げが「1 PCをつなぐ（済）」", "D-089", _tid0),
    # 自分のPCをつなぐ は「どこで開いているか」で 3 つに分かれる（D-089.8）。ダウンロード＝インストール動線
          qrow(_sp0, _pre0, "共通", "つなぐ画面の出し分け", "ブラウザで Bridge が入っていない人には、ダウンロード（インストール動線）と手順 1〜4 が出る", "Bridge を止める", "自分のPCをつなぐ を開く", "ダウンロードの置き場が見え、手順 1 から出る", "D-089.8", _tid0),
          qrow(_sp0, _pre0, "共通", "つなぐ画面の出し分け", "ブラウザで Bridge が動いている人には、ダウンロードもコードも出さず、見つけた時点でつながる（押す操作も要らない）", "Bridge を起動する", "自分のPCをつなぐ を開く", "ダウンロードが消え、押さずにつながる。うまくいかないとき用に押す道だけ残っている", "D-089.8 D-089.10", _tid0),
          qrow(_sp0, _pre0, "共通", "つなぐ画面の出し分け", "アプリ（Bridge の窓）の中で開いた人は、入れる作業も接続コードも要らず自動でつながる", "Bridge の窓から開く", "自分のPCをつなぐ を開く", "ダウンロードも手順 1〜4 も出ず、そのままつながる", "D-089.8", _tid0),
          qrow(_sp0, _pre0, "共通", "つなぐ画面の出し分け", "Bridge がこの PC の中だけで開く口は、許可した画面の出どころ以外には応えない（居ることも教えない）", "Bridge を起動する", "別の出どころから ping を投げる", "403。接続コードの総当たりも 1 分 5 回で止まる", "D-089.8", _tid0),
    # まだ作っていない画面への行き止まり（2026-09-22 user「残っている 404 もやりましょうかね」）。ナビは設計から生成されるので、まだ無い画面も指す
          qrow(_sp0, _pre0, "共通", "到達性", "まだ作っていない画面は、ナビで押せない印（準備中）で出る。押して 404 の行き止まりに当たらない", "画面が無い section がある", "アプリの枠を開いてナビを見る", "その項目はリンクでなく「準備中」。リンクは全部 200 で開く", "G-04", _tid0),
          qrow(_sp0, _pre0, "共通", "到達性", "もうある画面の一覧（built-routes）が実ファイル（app/**/page.tsx）と一致する。手で足した・消した取り残しが無い", "—", "一覧と実ファイルを突き合わせる", "差分 0（画面を作れば自動で印が消える）", "G-04", _tid0),
          qrow(_sp0, _pre0, "共通", "無いパス", "設計にあってまだ作っていない画面の URL を直接開くと、画面の名前つきで「まだありません」と戻る導線が出る（素の 404 にしない）", "—", "未実装の画面の URL を開く", "「〈画面名〉はまだありません」と戻る導線", "D-086", _tid0),
    # ログインだけ生きていて会社の人が無い（会社が消えた・登録の途中で壊れた）とき（2026-09-27：手元で ② 話す が進めず ④ が空白になった）
          qrow(_sp0, _pre0, "共通", "入っていない", "ログインは生きているが会社の人が無い人が画面を開くと、空白で止まらず 入る画面（login?next=）へ送られ、手元の鍵は捨てられる", "会社の人を消したアカウントでログイン済み", "ログイン情報・自分のAIと話す を開く（実ブラウザ）", "どちらも /login?next=… に移り、空白にならない", "D-086.4", _tid0),
]
newtask(_tid0, "apps/web の土台（Next.js 15 App Router の雛形・Playwright と実ブラウザの検査・ナビ href ⇔ 実在ルートの照合・CI のブラウザ job・ローカル起動）", "U-shared", "ui", "4_ui_foundation", "ui", [], category="frontend", hours=16, depends_on=["T-F-01", "T-F-15"], choke_points=[], choke_rationale="画面の土台。外界に出ない（API は関門の先）",
        fcp={"new": ["apps/web/package.json", "apps/web/next.config.ts", "apps/web/app/layout.tsx", "apps/web/app/page.tsx", "apps/web/playwright.config.ts", "apps/web/tests/_lib/browser.ts", "apps/web/tests/reachability.spec.ts", "apps/e2e/package.json", "apps/e2e/playwright.config.ts", ".claude/launch.json"], "modify": [".github/workflows/v3-gate.yml", "pnpm-workspace.yaml"], "shared_read": ["02_tech_stack/selected-stack.json", "05_flow/flow.json#screens.route", "03_architecture/foundation_gates.json#15"], "forbidden": ["packages/**", "apps/web/components/**（部品は T-US-01〜06）"]},
        files_changed=["apps/web/package.json (new)", "apps/web/app/layout.tsx (new)", "apps/web/playwright.config.ts (new)", "apps/web/tests/reachability.spec.ts (new)", "apps/e2e/package.json (new)", ".github/workflows/v3-gate.yml (modify)"],
        ac={"structural": ["UBIQUITOUS: apps/web は 02_tech_stack/selected-stack.json の frontend（Next.js 15 App Router・Tailwind・shadcn/ui・lucide-react）で組まれ、業務ロジックを持たず API（08_api）を呼ぶだけ（D-043.3）", "UBIQUITOUS: Playwright の設定と CI のブラウザ job（03_architecture/foundation_gates.json #15）が存在し、UI を含む PR で走る"],
            "functional": ["EVENT-DRIVEN: WHEN pnpm exec playwright test を流したら THEN 実ブラウザ（Chromium）で 到達性（ナビ・カードの href ⇔ flow.json の route）と 4 幅の横溢れの測定が走り、結果が正本の行に書ける", "UNWANTED: IF 実在しないルートを指す href があれば 到達性の検査が赤になり merge できない", "UNWANTED: IF staging が無いなら、画面の L1 行はローカルの実ブラウザで流し、staging の行は BLOCKED（理由つき）として残す。ローカルの緑を staging の PASS と書かない"],
            "regression": REG_UI}, spec_links=["02_tech_stack/selected-stack.json", "03_architecture/foundation_gates.json", ".claude/rules/web/testing.md"], qa_rows={"l1": _rows0, "l2_flows": []},
        scenarios=[{"name": "到達性を壊す", "steps": ["ルートを 1 つ消して検査"], "expected": "赤・戻すと緑"}, {"name": "4 幅", "steps": ["375/768/1024/1440 で /"], "expected": "溢れ 0 が数値で出る"}], source=["D-043.3", "D-067.1", "D-084.1"], why="画面のタスク（T-US-01〜06・T-U-*）が前提にする apps/web・Playwright・CI のブラウザ job を作る。無いと画面のチケットは着手できても動作実証（L-003）ができない")
for i, (name, src, h, files) in enumerate(US, 1):
    tid = f"T-US-{i:02d}"; sp = f"{SPEC}/visual-fidelity-audit.md"; pre = f"USH-{i:02d}"
    rows = [qrow(sp, pre, "共通", "共通シェル", f"{name[:30]}：共通シェルを含む全画面で scrollWidth - clientWidth <= 1（375・768・1024・1440）", "全画面", "各幅で開く", "溢れ 0・本文 720 以上（1180+）", "G-05", tid), qrow(sp, pre, "共通", "役割の出し分け", "役割を切り替えると data-roles の塊が切り替わり、錠前だけの画面が無い", "4 役割", "切替", "役割ごとの中身が出る（G15）", "", tid)] + g_rows(sp, pre, "共通", tid, set(), [], "ui")
    _shell = json.load(open(f"{OPS_DIR}/_shell.json", encoding="utf-8"))["regions"] if os.path.exists(f"{OPS_DIR}/_shell.json") else {}
    for _reg in ({1: ["side", "tabbar", "head"], 2: ["aipanel"]}.get(i, [])): rows += ops_rows(sp, pre, f"共通:{_reg}", tid, _shell.get(_reg, []))   # 共通シェルの操作要素（サイドバー・下タブ＝T-US-01、AI のパネル＝T-US-02）
    if i == 2:   # 会話はどこで開いても同じ 1 本・同じ部品（D-103）。末尾に足す（ID を動かさない）
        rows.append(qrow(sp, pre, "共通:aipanel", "会話は 1 本", "右パネルで言ったことは、会話モードを開くと同じ会話の続きとして出る（部品は AgentChat 1 つ）", "Bridge をつないだ", "右パネルで言う → 会話モードを開く（実ブラウザ）", "会話モードに同じ言葉が出る。会話モードには右パネルを出さない", "D-103.1", tid))
        rows.append(qrow(sp, pre, "共通:aipanel", "添える文脈", "右パネルで言うと、自分のAI への指示に見ている画面（と選んでいる 1 件）が前置きされ、会話の吹き出しには出ない", "Bridge をつないだ", "目標の画面の右パネルで言う（実ブラウザ）", "指示に「いま見ている画面：目標」が付き、吹き出しには本人の言葉だけ", "D-103.2", tid))
        rows.append(qrow(sp, pre, "共通:aipanel", "共通の枠が出す", "右パネルは画面が渡さなくても共通の枠が出す。別の会話の作りは検査で赤（chat_one）", "—", "node scripts/ci/chat_one.mjs と自己検査", "PASS（別の作りを置くと赤）", "D-103.3", tid))
    if i in (1, 2): rows.append(handoff_row(sp, pre, "共通", tid))
    newtask(tid, name, "U-shared", "ui", "4_ui_foundation", "ui", [], category="frontend", hours=h, depends_on=["T-US-00", "T-F-01", "T-F-05"] + A_ids[:1], choke_points=[], choke_rationale="画面の部品。外界に出ない（API は関門の先）", fcp={"new": files, "modify": ["apps/web/app/layout.tsx"], "shared_read": ["04_design/DESIGN-kaname.md", "06_mockup/_shell.py", "08_api/types.ts"], "forbidden": ["packages/**"]}, files_changed=[x + " (new)" for x in files],
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
    rows += ops_rows(sp, pre, sid, tid, _ops(sid)); rows.append(handoff_row(sp, pre, sid, tid)); rows += mail_rows(sp, pre, sid, tid)   # 操作要素 1 つ＝1 行（分母はモックから機械で）＋ 発注者確認（Rule 12）
    errs = error_rows(sid, None); eps = [EP[e] for e in f["api_endpoints"]]
    jobs = sorted({acts[a]["jobs"][0] for a in s["acts"] if a in acts and acts[a]["jobs"]}); deps = US_ids + [t["id"] for t in tasks if t["group"] == "A" and set(t["acts"]) & set(s["acts"])]
    _rel = s.get("release", "v1")
    newtask(tid, f"画面 {s['name']}（{len(s['states'])} 状態・{'/'.join(s['access_roles'])}{'・段階 2' if _rel == 'v2' else ''}）", "U-screen", "ui", "5_ui_parallel" if _rel == "v1" else "9_v2_ui", "ui", [f["id"]], category="frontend", stage=_rel, hours=f["estimate_hours_human"], screen_ids=[sid], entity_ids=s["related_entities"], acts=s["acts"], depends_on=deps, choke_points=[], choke_rationale="画面。外界に出ない（API は関門の先）",
            fcp={"new": [f"apps/web/app/{page_dir(s)}/page.tsx", f"apps/web/components/screens/{sid}/*.tsx", f"apps/web/tests/screens/{sid}.spec.ts"], "modify": [], "shared_read": [s["mock_path"] or "", "08_api/types.ts", f"07_functional/screens.json#{sid}"], "forbidden": ["apps/web/components/shell/**（共通シェルは T-US-01）", "packages/**"]}, files_changed=[f"apps/web/app/{page_dir(s)}/page.tsx (new)", f"apps/web/tests/screens/{sid}.spec.ts (new)"],
            ac={"structural": [f"UBIQUITOUS: 画面 {sid} は URL {s.get('route')} で開く（apps/web/app/{page_dir(s)}/page.tsx。遷移の href は flow の route と機械照合）", f"STATE-DRIVEN: WHILE 画面 {sid} が描画中 THEN h1「{s['h1_text'][:30]}」・第2ナビ {' / '.join(s['section_h2_texts'][:5])}・状態 {len(s['states'])}（{'、'.join(x['label'] for x in s['states'][:5])}）がモック {s['mock_path']} と一致する", f"STATE-DRIVEN: WHILE 役割 {'/'.join(s['access_roles'])} で開いたとき THEN 役割ごとの中身（data-roles）が出て、錠前だけの画面が無い"], "functional": [x for e in eps for x in e["ears_ac_seed"][:2]][:6] + [f"EVENT-DRIVEN: WHEN 「{s.get('primary_action') or '主アクション'}」を押したとき THEN 対応する endpoint が呼ばれ、別 GET で再取得して画面に反映する", "UNWANTED: IF 列の値が実データでも「—」固定なら未実装として落とす"], "regression": REG_UI},
            policies=[], spec_links=[s["mock_path"] or "", f"07_functional/screens.json#{sid}", "08_api/screen-api-coverage.json"] + [f"01_hearing/決定ログ_進行中.md#{x}" for x in s["source"][:3]], qa_rows={"l1": rows + errs, "l2_flows": [j["id"] for j in f["journey_candidates"]]}, scenarios=[{"name": f"状態 {st['label']}", "steps": ["状態を作る", "開く"], "expected": "モックと一致"} for st in s["states"][:4]] + [{"name": "主アクション", "steps": ["押す", "別 GET"], "expected": "反映"}], source=f["source"])
U_ids = [t["id"] for t in tasks if t["group"] == "U-screen"]
# ---------------------------------------------------------------- D-090（受け取って返す）の規則を、画面から押せる行として持つ
# 画面から見える振る舞いなので、行の持ち主は画面のタスク（op_gate は ui の層だけ実ブラウザの証拠を要求する）。
# Bridge 側の実機でしか確かめられない行（自己診断の中身・信号なし終了）は T-B-03 のまま理由つき BLOCKED。
_t_chat = next(t["id"] for t in tasks if t["group"] == "U-screen" and t["screen_ids"] == ["clone-chat"])
_t_br = next(t["id"] for t in tasks if t["group"] == "U-screen" and t["screen_ids"] == ["bridge-setup"])
_by_id = {t["id"]: t for t in tasks}
for _v, _it, _pre_, _st, _ex, _own in [
    ("言う", "画面から言ったことが、この PC の Bridge に渡り、会話に自分の言葉として出る", "つないだ PC・会話モード", "書いて送る", "自分の言葉が会話に出て、仕事が 1 件並ぶ", _t_chat),
    ("待つ", "動いている間は「動いています」と出る（無言で待たせない）", "仕事が並んでいる", "Bridge が取る", "動いていることが画面に出る", _t_chat),
    ("返る", "返事が会話に出る。2 回目からは同じ続き（session）を引き継ぐ", "1 回やりとりした", "もう一度言う", "同じ会話 1 本のまま続き、Claude の session が引き継がれる", _t_chat),
    ("止まる", "止まったら、止まった理由がそのまま会話に出る。自動で再開しない", "仕事が動いている", "途中で止める（上限・終了・時間切れ）", "「ここで止まりました」と理由が会話に出て、勝手に動き出さない", _t_chat),
    ("選ぶ", "止まったときだけ 続きから／最初からやり直す／やめる の 3 つが出て、選ぶまで入力できない", "止まっている", "画面を見る", "3 つが出る・入力欄は止まっている", _t_chat),
    ("続きから", "「続きから」は同じ続き（session）を引き継いで動き直し、元の仕事はやめた扱いになる", "止まっている", "続きから を押す", "新しい仕事が session を引き継いで並び、元は cancelled", _t_chat),
    ("やり直す", "「最初からやり直す」は続き（session）を引き継がず、新しい会話の続きとして動く", "止まっている", "最初からやり直す を押す", "新しい仕事の session が空になる", _t_chat),
    ("やめる", "「やめる」でその仕事は終わる。新しい仕事は並ばない", "止まっている", "やめる を押す", "仕事が cancelled になり、並びは増えない", _t_chat),
    ("履歴", "選んだ後は 3 つのボタンが消え、止まった記録は履歴として残る（押せないボタンを残さない）", "1 度選んだ", "会話を見直す", "ボタンは無く、止まった理由は残っている", _t_chat),
    ("切れる", "知らせが 75 秒来なければ「切れています／PC が閉じている」に変わる（つながった記録があっても接続中と出し続けない）", "つないだ後に Bridge を終了", "つなぐ画面と会話の画面を開く", "渡せないことと、起こせば戻ることが出る", _t_br),
    ("起きる", "起きたら「いま渡せます」に戻り、Bridge が返した自己診断がそのまま出る（できない項目も隠さない）", "Bridge を起動し直す", "つなぐ画面を開く", "渡せる状態に戻り、できる／できません が項目ごとに出る", _t_br),
    ("切れる", "切れている間の経過は人の言葉で出す（「87853 秒」のような機械の数字を見せない）", "1 日以上知らせが来ていない", "つなぐ画面と会話の画面を開く", "「昨日」「N 時間前」のように出る", _t_br),
    ("切れる", "切れていても行き止まりにしない。やることは 1 つだけ出す（Bridge を開く／入れる）。次の段へ逃がす道は出さない", "つないだ記録はあるが、この PC に Bridge が無い", "つなぐ画面を開く", "端末の名前と「Bridge を起こす」ボタンが出る（探させない）。次の段（話す）への導線は出ない", _t_br),
    ("繋ぐ", "Bridge を起動したら、人が押さなくても画面が自分で気づいてつなぐ（数秒ごとに見ている）", "つないでいない・Bridge を起動していない", "Bridge を起動して、画面を見たまま待つ", "押さずに「つながりました」に変わる", _t_br),
    ("繋ぐ", "「接続を確かめる」は、この PC の Bridge を見に行く。押したことと、見つからなかったことを言う", "Bridge を起動していない", "「接続を確かめる」を押す", "確かめている最中が出て、終わると「◯時◯分の時点で見つかりません」と出る", _t_br),
    ("確かめている間", "確かめ終わる前に別の中身（手順・ダウンロード）を出さない。一瞬出てから入れ替わる（チラつき）を作らない", "つなぐ画面を開く", "開いた瞬間から 2 秒間、出ているものを見る", "「確かめています」だけが出て、そのあと 1 回だけ本当の中身に変わる", _t_br),
    ("押せない的", "「まだ配布していません」の置き場は、押したら理由といまできることを言う。押しても何も起きない的を置かない", "配布前", "ダウンロードの置き場を押す", "理由（署名と置き場の用意）と、用意ができたらここから入れられることが出る。コマンドは出さない（人にターミナルを触らせない）", _t_br),
    ("溜める", "PC が閉じている間に言ったことは溜まり、起きたときに順に動く（止まったものは自動で再開しない）", "Bridge を終了", "会話で言う", "溜まったと分かる文が出て、起こすと動く", _t_chat),
    ("新しい会話", "「新しい会話」を押すと今の 1 本が閉じ、次に言ったことが新しい 1 本になる（前のやりとりは消えない）", "やりとりがある", "新しい会話 を押す", "今の 1 本が閉じ、前のやりとりは残る", _t_chat),
    ("つながっていない", "つないでいない人が言おうとしたら、理由を返して受け付けない（黙って捨てない）", "端末を外した", "会話で言う", "「このPCがつながっていません」と出て、仕事は並ばない", _t_chat),
    ("他人の分", "別の端末の鍵では、その人の仕事を取れない（自分の分だけ）", "2 人が別々につないだ", "他人の鍵で取りに行く", "取れない（空・401）", _t_chat),
]:
    _by_id[_own]["qa_rows"]["l1"].append(qrow(f"{SPEC}/bridge.md", "BRG-03", "bridge-setup", _v, _it, _pre_, _st, _ex, "D-090", _own))

# Claude Code を入れるところまで Bridge がやる（D-091）。人はボタンを押すだけで、ターミナルを触らない
for _v, _it, _pre_, _st, _ex in [
    ("入れる", "この PC に Claude Code が無いときだけ「入れる」が出る（入っていれば出さない）", "Bridge が動いている PC", "自分のPCをつなぐ を開く", "無いときだけ理由とボタンが出る・あるときは出ない"),
    ("入れる", "押すと Bridge が入れる。人はターミナルを触らない。進み具合と結末（入った／入らなかった理由）が画面に出る", "Claude Code が無い PC", "「Claude Code を入れる」を押す", "入っていく様子が出て、終わると自己診断が ✓ に変わる"),
    ("入れる", "入ってはいるが本体が落ちてきていない PC（--ignore-scripts 等）では、入れ直さず取り直しだけで直る", "本体だけ欠けた PC", "「Claude Code を入れる」を押す", "取り直して動くようになる"),
    ("入れる", "Node.js（npm）も無い PC では、勝手に別のものを入れず、理由を出して止まる", "npm が無い PC", "「Claude Code を入れる」を押す", "「この PC に Node.js（npm）がありません」と出て、何も入れない"),
    ("ログイン", "ログインは本人がブラウザで 1 回承認する。Bridge は窓を開くだけで、資格情報は見ない", "Claude Code が入っている", "「ログインする」を押す", "窓が開き、承認するのは本人。Bridge も Kaname も鍵を持たない"),
    ("入れる", "この PC の中だけの口なので、他所の画面からは入れるボタンを押せない", "Bridge が動いている", "別の出どころから入れる口を叩く", "403（居ることも教えない）"),
]:
    _by_id[_t_br]["qa_rows"]["l1"].append(qrow(f"{SPEC}/bridge.md", "BRG-CC", "bridge-setup", _v, _it, _pre_, _st, _ex, "D-091", _t_br))
# はじめの設定の手順バー（共通の枠）：まだ届かない段は押せない形で出す（2026-09-28 user「押せる状態になるまでアクティブにしなくていい」・D-089）
_t_iv = next(t["id"] for t in tasks if t["group"] == "U-screen" and t["screen_ids"] == ["onboard-interview"])
_by_id[_t_iv]["qa_rows"]["l1"].append(qrow(f"{SPEC}/screens/onboard-interview.md", "SCR-ONBOARD-INTERVIEW", "onboard-interview", "手順バー",
    "済んだ段と今の段だけ押せる。まだ届かない段は押せない形（aria-disabled・薄く）で出て、押しても動かない（2026-09-28 user「押せる状態になるまでアクティブにしなくていい」）",
    "段 1 が済み・段 2 が今", "手順バーの 3〜6 を押す（実ブラウザ）", "3〜6 はリンクでなく、押しても /onboard/interview のまま。段 2 まで済むと 3 が押せる", "D-089", _t_iv))
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
# ---------------------------------------------------------------- Group B（Bridge＝顧客 PC の実行器）← D-015・D-047・D-055
# 2026-09-21：Bridge を作るタスクがどこにも無かった（171 本中 0 本）。生成の入口（画面／表／API／部品／結線／スキル）の
# どれでもないので一度も出力されず、日程から消えていた（L-016 と同型・user「ここからテスト進めなくなるのでブリッジは作って」）。
# 中身は薄い：AI は作らない。本人のサブスクの Claude Code を起動する（D-047：ブラウザ操作・ファイル・実行・MCP・承認は全部 不要）。
_spb = f"{SPEC}/bridge.md"; _bt = "bridge-setup"
BRIDGE = [
    ("T-B-01", "Bridge の骨組み（Electron・窓・設定の置き場・つなぎ先）", 10, [], ["apps/bridge/package.json", "apps/bridge/tsconfig.json", "apps/bridge/src/main.ts", "apps/bridge/src/preload.ts", "apps/bridge/src/renderer/index.html"],
     "窓が開き、つなぎ先（KANAME_API_BASE）と端末名が出る", "D-015.1"),
    ("T-B-02", "つなぐ（接続コードを引き取って端末として登録・自己診断）", 8, ["T-B-01"], ["apps/bridge/src/main.ts", "apps/api/src/auth/ext.ts", "packages/db/migrations/0026_bridge_claim.sql"],
     "画面の接続コードを入れると sessions に bridge の行がつき、はじめの設定の段 1 が通る", "D-015.2"),
    ("T-B-03", "受け取って返す（指示 → 本人の Claude Code → 結果と証跡をサーバーへ）", 24, ["T-B-02"], ["apps/bridge/src/runner.ts", "apps/bridge/src/queue.ts"],
     "サーバーが積んだ 1 件を Bridge が取り、Claude Code を起動し、結果と証跡が action_runs に残る", "D-015.1", ["D-093.2", "D-093.3", "D-093.4", "D-093.5", "D-093.7", "D-093.8"]),
    ("T-B-04", "見張る（bridge-guard：作業フォルダの外・銀行・CAPTCHA・規約で禁じるサービスを拒む）", 16, ["T-B-03"], ["packages/bridge-guard/src/index.ts", "apps/bridge/src/runner.ts"],
     "範囲外の操作が Bridge の中で拒まれ、拒んだ事実が証跡に出る（関門の外に生の fs を置かない）", "D-015.3"),
    ("T-B-05", "鍵を受け取る（Bridge は Infisical に入らない。Kaname の関門 C8 が解いた値を実行の間だけ受け取り、入力したら捨てる。ディスクに書かない）", 12, ["T-B-04"], ["apps/bridge/src/vault.ts"],
     "AI には参照 ID しか渡らず、Bridge は実行の間だけ値を持ち、終わったら捨てる（ディスク・ログに残らない・関門 C8）", "D-015.4", ["D-102.1", "D-102.2"]),
    ("T-B-08", "道具どまりの文 39 件を棚卸しする（製品にも出すか、理由つきで外すかを 1 文ずつ決める）", 10, [], ["product-reach-exempt.json", "05_flow/flow.json", "07_qa/test-specs/errors.json"],
     "python3 scripts/ci/product_reach.py が緑（製品の層に出ていない confirmed の文が 0・例外は理由つき）", "D-095.3", ["D-095.3"]),
    ("T-B-07", "関門の迂回 55 件を片付けて、関門の検査を CI に並べる（画面の fetch を C1 の対象外にするか例外台帳に載せるかを 1 件ずつ決める）", 12, [], [".github/workflows/v3-gate.yml", "03_architecture/choke-points.json", "03_architecture/choke-point-exceptions.md"],
     "node scripts/ci/choke.mjs --all が緑になり、CI から呼ばれている（迂回は 0 か、理由つきで台帳にある）", "D-095.2", ["D-095.1", "D-095.2"]),
    ("T-B-06", "配布（インストーラ・macOS の公証・Windows の署名・自動更新：署名までは指紋を確かめて自分で入れ替え、署名後は electron-updater）", 20, ["T-B-02"], ["apps/bridge/electron-builder.yml", "apps/bridge/scripts/release.mjs", "apps/bridge/src/update.ts", "apps/api/src/auth/bridge-release.ts", ".github/workflows/bridge-release.yml"],
     "macOS / Windows のインストーラが出て、入れた人に自動で新しい版が届く（指紋を確かめて自分で入れ替える）", "D-015.6", ["D-109.1", "D-109.2", "D-109.3", "D-109.4", "D-109.5", "D-109.6", "D-109.7"]),
]
# 手で触る確認の手順（発注者が dev で踏める形。無いタスクは「手順どおり操作する」のまま）。ID は item で引き継ぐので、ここを書き換えても行 ID は変わらない
BRIDGE_STEPS = {
    "T-B-05": ("①「ログイン情報を預ける」（/settings/credentials）で 追加する → サービス「発注ナビ」→ ログイン名・パスワード・2段階認証の鍵を入れて 保存する ② 一覧に「預けた · 預かり先の番号 …」の行が出る。読み直しても同じ ③ 画面のどこにも入れたパスワード・鍵の文字が出ない（Cmd+F で探す） ④ この行の結果列が PASS（実 Chrome の自動確認：本人の Bridge が動いている仕事のためにだけ受け取り、使った後に消え、証跡 credential.bridge_resolve（C8）が 1 行。他人の鍵・終わった仕事・届かない・欠けた応答は成功にしない）",
              "画面と DB と証跡に値が無い（預かり先の番号だけ）。Bridge は動いている仕事のためにだけ受け取り、使った後は消え、証跡は関門 C8 で 1 行。※実際のログインに使うのは T-B-38（その場で 1 回試す）で触れる"),
}
for _row in BRIDGE:
    _tid, _title, _h, _dep, _files, _ok, _src = _row[:7]
    _more = list(_row[7]) if len(_row) > 7 else []   # 追加で紐づける決定の文（D-093 等）
    _st1, _ok1 = BRIDGE_STEPS.get(_tid, ("手順どおり操作する", _ok))
    _rows = [qrow(_spb, _tid.replace("T-B-", "BRG-"), _bt, "Bridge", _title, "Bridge を入れた PC", _st1, _ok1, _src, _tid),
             qrow(_spb, _tid.replace("T-B-", "BRG-"), _bt, "G-11 外部リソースの実在", f"{_title}：触る外部リソース（本人の Claude Code・Chrome・Kaname の API）が対象の PC に存在する", "対象の PC", "自己診断を走らせる", "無ければ理由が出る（黙って落ちない）", "G-11", _tid),
             qrow(_spb, _tid.replace("T-B-", "BRG-"), _bt, "G-15 信号なし終了", f"{_title}：外部プロセスが完了信号を出さずに終わる・空を返す", "対象の PC", "途中で殺す", "成功にしない。止まったことが画面と証跡に出る", "G-15", _tid)]
    # 1 行 1 イベント（T-B-03・D-093）：途中経過・確認・会話の id・完了の判定。画面は clone-chat（会話モード）
    if _tid == "T-B-03":
        for _v, _it, _pre_, _st, _ex, _src2 in [
            ("待つ", "動いている間、何をしているか（使っている道具・書いている文）が会話に出る（1 行 1 イベント）", "仕事を渡した", "Bridge が途中経過を返す（実ブラウザ）", "「…を使っています」の行が会話に出る。無言で待たせない", "D-093.7"),
            ("選ぶ", "自分のAIが「これを実行していいか」と聞くと、会話に確認カード（何を・どう・許可する／許可しない）が出る", "仕事が動いている", "Bridge が確認を返す（実ブラウザ）", "確認カードが出て、答えるまで自分のAIは待つ", "D-093.3"),
            ("選ぶ", "「許可する」を押すと Bridge に allow が渡り、動き直す。答えは会話の記録と証跡（誰が・いつ・何を）に残る", "確認待ち", "許可する を押す（実ブラウザ）", "Bridge が allow を受け取り、会話に「許可しました」の記録が出て、証跡に bridge.tool_allowed が残る", "D-093.8"),
            ("選ぶ", "「許可しない」を押すと Bridge に deny が渡る。勝手に許可しない", "確認待ち", "許可しない を押す（実ブラウザ）", "Bridge が deny を受け取り、会話に「許可しませんでした」の記録が出る", "D-093.3"),
            ("続きから", "init で会話の id を先に覚えるので、途中で落ちても「続きから」が同じ続きを引き継ぐ", "仕事を渡した", "init だけ返して落とす", "止まった後の「続きから」が init の id を引き継ぐ", "D-093.4"),
            ("止まる", "result の is_error で成否を決める。終了コード 0 でも失敗は失敗（ログインが要る／上限）", "仕事を渡した", "is_error の result を返す", "「終わった」にならず、理由（ログイン・上限）が止まりましたに出る", "D-093.2"),
        ]:
            _rows.append(qrow(_spb, "BRG-03", "clone-chat", _v, _it, _pre_, _st, _ex, _src2, _tid))
    # 配布（T-B-06・D-015.7）：顧客の手順は 3 つだけ。置き場は Kaname のサーバー
    if _tid == "T-B-06":
        for _v, _it, _pre_, _st, _ex in [
            ("受け取る", "ダウンロードは Kaname のサーバーから落ちてくる（顧客に GitHub など外のサービスを見せない）", "配布物を置いた", "つなぐ画面の「macOS 版」を押す", "Kaname の口から実物が落ちてくる"),
            ("受け取る", "置いていないときは「まだ配布していません」と理由を返す（押しても何も起きない的にしない）", "配布物を置いていない", "「macOS 版」を押す", "理由が出る。コマンドは出さない"),
            ("開く", "顧客の手順は ①受け取る ②開く ③初回だけ許可 の 3 つだけ。コマンドも接続コードも打たせない", "配布物を受け取った", "ダブルクリックして開き、許可を押す", "3 手だけでつながる（画面が自分で気づく）"),
            ("署名", "署名が済むまでは OS の警告が出るが、手順は変えない。越え方だけ案内する（Mac は「完了」→ システム設定 → プライバシーとセキュリティ →「このまま開く」。いまの macOS では右クリック → 開く では越えられない。Windows は「詳細情報」→「実行」）", "署名前の版", "開く", "つなぐ画面の「『開いていません』と出たとき」を開くと、Mac と Windows の越え方が出る。コマンドは出さない"),
            ("起こす", "PC を立ち上げると Bridge も一緒に立ち上がる（入れた時点で登録。人が毎回開かない）", "入れて 1 度開いた", "PC を再起動する", "Bridge が立ち上がっていて、画面は最初からつながっている"),
            ("起こす", "止まっているときは、画面のボタン 1 つで起こせる（探させない）。出てこなければ「入っていないかもしれません」と言う", "Bridge を終了した", "「Bridge を起こす」を押す", "Bridge が立ち上がり、画面が自分で気づいてつながる"),
        ]:
            _rows.append(qrow(_spb, "BRG-06", _bt, _v, _it, _pre_, _st, _ex, "D-015.7", _tid))
        # 自分で受け取って入れ替える（D-109）：署名が入るまでの自動更新。指紋が合うときだけ・仕事をしていない間だけ
        for _v, _it, _pre_, _st, _ex, _src2 in [
            ("版の番号", "配布物を作るたびに版の番号が日時から付き、置き場に目録（版・OS と CPU ごとのファイル・指紋・大きさ）が書かれる", "リリースのコマンドを走らせた", "pnpm --filter @kaname/bridge release", "新しい版の zip と dmg ができ、目録に指紋と大きさが載る", "D-109.1"),
            ("置き場", "Kaname は目録に載ったファイルだけを配り、その OS と CPU の中身の場所・指紋・大きさを返す", "目録を置いた", "/bridge/latest?os=mac&arch=arm64 を聞く", "版と中身の場所・指紋・大きさが返り、その場所から同じ中身が落ちてくる。目録に無い名前は 404", "D-109.2"),
            ("新しい版", "Bridge は起動時・1 時間ごと・Kaname に古いと言われたときに見に行き、新しければ裏で受け取る", "新しい版を置いた", "Bridge を開いたまま待つ", "受け取りが始まる（顧客は何もしない）", "D-109.3"),
            ("確かめる", "受け取ったものは指紋と大きさが目録と合うときだけ使う。合わなければ捨てて、理由を 1 回窓に出す", "置き場の中身が目録と違う", "Bridge を開く", "入れ替えず「確かめられなかったので使いませんでした」と出る", "D-109.4"),
            ("入れ替える", "仕事を動かしていない間にだけ入れ替え、立ち上げ直す。つなぎ直しは要らない", "新しい版を受け取った", "仕事が終わるのを待つ", "仕事中は入れ替えず、終わったら新しい版で立ち上がり直し、つながったまま", "D-109.5"),
            ("入れ替えられない", "書けない場所・開発中の起動なら入れ替えず、入れ直しを案内する", "書けない場所に入っている", "Bridge を開く", "「新しい版があります。…入れ直してください」と出て、受け取りにも行かない", "D-109.6"),
        ]:
            _rows.append(qrow(_spb, "BRG-06", _bt, _v, _it, _pre_, _st, _ex, _src2, _tid))
    newtask(_tid, _title, "B", "backend", "3_backend", "code", [], category="backend", hours=_h, critical=True, acts=["A09"], screen_ids=[_bt], depends_on=_dep, choke_points=["C1", "C5"],
            choke_rationale="Bridge は外（Kaname の API）と話し（C1）、本人の PC でプロセスを起動する（C5）。生の呼び出しは関門に寄せる",
            fcp={"new": _files, "modify": [], "shared_read": ["03_architecture/アーキテクチャ設計書.md"], "forbidden": ["apps/web/**"]}, files_changed=[f"{x} (new)" for x in _files],
            ac={"structural": [f"UBIQUITOUS: {_title} の成果物が apps/bridge に存在し、type-check と build が通る"],
                "functional": [f"EVENT-DRIVEN: WHEN 手順どおり操作したら、システムは {_ok}", "UNWANTED: IF つなぎ先に届かなければ、黙って失敗せず理由を画面に出す"], "regression": REG_BASE},
            spec_links=["01_hearing/決定ログ_進行中.md#15", "03_architecture/アーキテクチャ設計書.md"], qa_rows={"l1": _rows, "l2_flows": []},
            scenarios=[{"name": _title, "steps": ["手順どおり"], "expected": _ok}], source=[_src, "D-047.1", "D-055.1"] + _more, why="Bridge は段階1で AI が動く唯一の経路（D-055）。これが無いと v1 は AI が動かない")

# ---------------------------------------------------------------- 意味で探す（D-098）と段階 1 の置き場（D-097）← 2026-09-27
# 決めた時点でタスクにする（決めたのに日程に無い、を作らない・L-013）。段階 1 の探すは自分のAI が PGroonga で探して読む（D-099）。
# ベクトルは境を越えてから、本人の PC で作る（T-B-10・入れ方は Bridge と同じ）。仕事の記録（D-100）は T-B-13。
_sps = f"{SPEC}/screens/search.md"
EXTRA_B = [
    ("T-B-09", "検索の土台（台帳・記憶・証跡の本文に PGroonga の索引・手元と CI の像に PGroonga と pgvector・memories.embedding の仮置きをやめる）", 8, [],
     ["packages/db/migrations/0039_search.sql", "infra/docker-compose.dev.yml", "infra/pg/Dockerfile"],
     ["A21"], ["search"], ["C2"], "永続化だけ（C2）。外には出ない",
     [("土台", "台帳・記憶・証跡の本文に PGroonga の索引があり、日本語の言葉で引ける（分かち書きなしで当たる）", "本文に「請求書」を含む記憶がある", "「請求」で全文検索する", "その記憶が出る", "D-098.2"),
      ("見える範囲", "全文検索の候補は、その人が読める行だけ", "担当者が見えない層の記憶に「請求」がある", "その人の文脈で「請求」を探す", "0 件（行レベルの制御が落とす）", "D-098.3"),
      ("手元の像", "ローカルと CI の Postgres に PGroonga と pgvector の両方があり、本番と同じ migration が通る", "新しい像で DB を作り直した", "pnpm db:migrate", "最後まで通る（拡張が無くて落ちない）", "D-098.9"),
      ("前の置き方", "memories.embedding（1536 次元の仮置き）が無くなっている", "migration 済み", "memories の列を見る", "embedding 列が無い", "D-098.10")],
     "D-099.1", ["D-098.2", "D-098.3", "D-098.9", "D-098.10"], True),
    ("T-B-10", "ベクトルを入れる（境を越えたら）：Bridge がモデルを自分で取り・確かめ・直す（Bridge と同じ扱い）・本人の PC で作る・直された行と新しいモデルは裏で作り直す", 24, ["T-B-11", "T-B-03"],
     ["packages/db/migrations/0040_search_embeddings.sql", "apps/bridge/src/embed.ts", "apps/bridge/src/embed.test.ts", "apps/bridge/src/renderer/index.html", "apps/api/src/auth/ext.ts"],
     ["A21", "A30"], ["search", "bridge-setup"], ["C1", "C2", "C5"], "モデルを配布元から取る（C1）・ベクトルを書く（C2・Bridge の鍵で関数を通す）・本人の PC で推論する（C5）",
     [("取る", "人は何もしない。Bridge が自分でモデルを配布元から取り、sha256 が合えば使う。取っている間は進み具合が Bridge の窓と画面に出る", "モデルがまだ PC に無い・境を越えた", "何もしない（Bridge が始める）", "進み具合が出て、終わると自己診断の「検索のモデル」が OK になる", "D-099.4"),
      ("取る", "空き容量が足りなければ取り始めない。理由とあと何 GB 要るかを出す", "空き容量をわざと減らす", "Bridge が取り始めようとする", "取り始めず、理由が窓と画面に出る（途中で落ちない）", "D-099.4"),
      ("直す", "指紋が合わない・壊れているモデルは使わず、ボタン 1 つで取り直せる", "PC のモデルを壊しておく", "自己診断 → 「取り直す」を押す", "壊れていると出て、押すと取り直して OK に戻る", "D-099.4"),
      ("作る", "ベクトルは本人の PC で作る（サーバーでは作らない）。本文を直すと、その行だけ作り直す", "ベクトルのある記憶が 3 件", "1 件の本文を直す", "直した 1 件だけ content_hash が変わる。サーバーに推論の呼び出しが無い", "D-099.3"),
      ("替える", "新しいモデルを作り直し中で足すと、Bridge が裏で全部作り直し、そろったら切り替わる。そろうまでは古いモデルで探す", "ベクトルのある記憶が 5 件・別のモデルを足した", "途中で検索する → 最後まで待つ", "途中は古いモデルの結果。そろった後は新しいモデルだけが active で、古いベクトルは消える", "D-099.6"),
      ("G-15 信号なし終了", "推論が途中で落ちても、作れたことにしない", "推論を途中で殺す", "記憶を 1 件足す", "ベクトルは入らず、次に Bridge が動いたときに作り直す", "G-15")],
     "D-099.2", ["D-099.3", "D-099.4", "D-099.6", "D-098.4", "D-098.5", "D-098.6", "D-098.8"], False),
    ("T-B-11", "探す（自分のAI が PGroonga で言い換えを広げて探し、読んで選ぶ・人は言葉の一致で探す・探した件数と時間を記録して境を越えたら運営に知らせる）", 14, ["T-B-09"],
     ["apps/api/src/routes/search.ts", "apps/web/app/(app)/search/page.tsx", "apps/web/tests/screens/search.spec.ts"],
     ["A21"], ["search"], ["C2", "C3"], "候補を読む（C2）・自分のAI が探して選ぶ（C3＝Bridge 経由・本人のサブスク）",
     [("探す", "言い換えでも見つかる（「請求の件」で「インボイスの送付」が出る）。自分のAI が検索語を広げて何度か探す", "記憶・台帳がある・Bridge がつながっている", "自分のAI に「請求の件どこ？」と聞く（実ブラウザ）", "言葉が一致しない「インボイスの送付」も出て、どう探したか（使った言葉）が 1 行で出る", "D-099.1"),
      ("探す", "言葉がそのまま一致するものは必ず出る", "本文に「KNM-1234」を含む台帳の行", "探す画面で「KNM-1234」と入れる（実ブラウザ）", "その行が出る", "D-098.2"),
      ("選ぶ", "自分のAI が候補を読んで並べ、なぜそれかを添える。見えない行は候補にも理由にも出ない", "候補が 10 件以上", "自分のAI に聞く（実ブラウザ）", "並びと理由が出る", "D-098.3"),
      ("G-12 切り替わりの瞬間", "Bridge が止まった直後は言葉の一致だけで探し「いまは言葉の一致だけで探しています」と出す", "Bridge を終了した直後", "探す画面で探す（実ブラウザ）", "言葉の一致の結果と、その旨の一文が出る", "D-099.5"),
      ("境", "探すたびに件数と時間が残り、境（5 万件・20 秒以上が週 10 回）を越えたら運営に知らせが出る", "テスト会社で境を越える記録を作る", "運営の画面を開く", "その会社に「ベクトルを入れる判断」の知らせが出る", "D-099.2"),
      ("確かめる", "高本さんの実データで答えが分かっている質問 20 個（言葉が一致しないものを半分以上）を自分のAI に探させ、当たった数を記録する。17 問に届かなければ T-B-10 を前倒しにする", "高本さんの実データ・質問 20 個と正解", "自分のAI に 1 問ずつ聞く（実ブラウザ）", "当たった数と外れた質問が 07_qa/test-specs/search-eval.md に残る。17 問以上ならベクトルなしで完了", "D-099.7")],
     "D-099.1", ["D-099.2", "D-099.5", "D-099.7", "D-098.2", "D-098.3"], True),
    ("T-B-13", "自分のAI の仕事の記録（使った量と道具の呼び出しを残す・中身の全文は集めない）", 6, ["T-B-03"],
     ["packages/db/migrations/0038_bridge_work_record.sql", "apps/bridge/src/stream.ts", "apps/bridge/src/runner.ts", "apps/bridge/src/loop.ts", "apps/api/src/auth/ext.ts", "apps/api/test/bridge_stream.test.ts"],
     ["A20", "A69"], ["clone-chat"], ["C2", "C5"], "Bridge が CLI の出来事から記録を作り（C5）、API が決めた欄だけを DB に書く（C2）",
     [("残す", "道具を使うたびに、名前・対象・成功／失敗・時間が残る", "仕事を渡した", "自分のAI にファイルを読ませる", "bridge_job_events に kind=tool の行（name・target・ok・ms）が残る", "D-100.2"),
      ("残す", "仕事が終わると、使った量（往復数・時間・量・費用の見込み）が結末より先に残る", "仕事を渡した", "最後まで動かす", "kind=usage の行が残り、その後に結末が書かれる", "D-100.1"),
      ("残さない", "ファイルの中身・道具の返り値・途中の文章の全文は Kaname に残らない", "中身の全文を含む記録を送る", "API に送る", "決めた欄だけが残り、全文は捨てられる", "D-100.3"),
      ("散らからない", "道具の記録と使った量は会話の途中経過に出ない", "記録がある仕事", "会話を開く（実ブラウザ）", "会話には「…を使っています」の 1 行だけが出る", "D-100.2")],
     "D-100.1", ["D-100.2", "D-100.3"], True),
    ("T-B-12", "段階 1 の置き場を立てる（Vercel の画面と API の 2 プロジェクト・Supabase 東京・鍵は Vercel の環境変数・Build で migration）", 8, [],
     ["infra/STAGING.md", "apps/api/vercel.json", "apps/api/build-vercel.mjs", "apps/api/src/vercel.ts"],
     ["A09"], ["bridge-setup"], ["C1", "C2"], "置き場の用意。API が外（Supabase・Resend）とつながり（C1）、DB に migration を流す（C2）",
     [("立てる", "kaname-api の /health が 200 で版を返し、起動時確認 4／4 がログに出る", "S0〜S3 を済ませた", "curl で /health", "200。落ちていれば 503 と理由（黙って 502 にしない）", "D-097.5"),
      ("立てる", "Supabase の Transaction pooler に kaname_app／kaname_auth で入れる", "S1 の接続文字列を入れた", "/health と登録を 1 回", "DB に書ける（custom role が pooler を通る）", "D-097.1"),
      ("問い合わせ", "Bridge は仕事が動いていない間 5 秒ごと、動いている最中だけ最長 20 秒待ち受ける", "Bridge をつないだ", "1 時間放っておいた後に言う", "関数の呼び出しが 1 時間あたり約 720 回・言ってから数秒で動き出す", "D-097.4"),
      ("預かり先", "staging では資格情報が Infisical に預けられる（メモリには置かない）", "S2 で Infisical を用意した", "資格情報を保存する（実ブラウザ）", "預けられ、Infisical の /tenants/<会社> に暗号文だけがある", "D-101.1"),
      ("1 周", "新規登録 → 確認メール → Bridge をつなぐ → 自分のAIと話す が staging で通る", "S0〜S4 を済ませた", "実ブラウザで 1 周", "全部通る（L2）", "D-097.1")],
     "D-097.1", ["D-097.3", "D-097.4", "D-097.5", "D-097.6", "D-097.7", "D-101.1"], True),
    ("T-B-14", "資格情報の置き場を Infisical に（会社ごとの置き場・暗号文だけ・Machine Identity で入る・起動時に確かめる）", 6, [],
     ["packages/secrets/src/infisical.ts", "packages/secrets/test/infisical.test.ts", "packages/config/src/index.ts", "apps/api/src/server.ts", "apps/api/src/startup.ts"],
     ["A10"], ["credentials"], ["C8", "C1"], "秘密の読み出しの関門（C8）の中で、置き場（Infisical）とだけ話す（C1 の例外 X-005）",
     [("預ける", "資格情報を保存すると、Infisical の会社の置き場（/tenants/<会社>）に暗号文だけが入る", "Infisical を設定した staging", "資格情報を保存する（実ブラウザ）", "Infisical の画面で見ても中身は暗号文。表（credentials）には参照 ID だけ", "D-101.2"),
      ("分ける", "別の会社の置き場は見に行かない", "会社 A と B が預けた", "A の文脈で B の参照 ID を解く", "見られない（この参照は見られない）", "D-101.2"),
      ("起動", "Infisical に入れない設定では staging／本番は起動しない（黙ってメモリに落とさない）", "INFISICAL_CLIENT_SECRET を間違える", "API を起動する", "起動時の確認 secrets:vault で落ち、/health は 503 と理由", "D-101.4"),
      ("失効", "退会・停止で、その会社の置き場の資格情報が全部失効する", "資格情報を 2 件預けた会社", "会社を停止する", "2 件とも revokedAt が付き、解けなくなる", "D-101.2"),
      ("G-15 信号なし終了", "Infisical に届かないときは預かったことにしない", "Infisical に届かない状態", "資格情報を保存する（実ブラウザ）", "E-SEC-001 の文言と一手が出て、表に行ができない", "D-101.1"),
      ("身元", "Infisical に入るのはサーバー（staging・本番）と運営の人の 3 つだけ。サーバーの身元は kaname project の読み書きだけで、project を作る・消すはできない", "S1b を済ませた", "Infisical の画面で Identities と役割を見る", "身元は 3 つ。サーバーの身元で project を作ろうとすると断られる", "D-102.3"),
      ("上限", "秘密の操作が毎分 96 回（上限の 8 割）に来たら、運営（info@）にメールが届く（1 時間に 1 回まで）", "上限を小さくした設定（secretPerMinute）", "資格情報を続けて読む", "運営にメールが 1 通届く。同じ 1 時間には繰り返さない", "D-102.5"),
      ("上限", "上限に当たったら（429）、待つ秒数つきで「いま混み合っています」と出し、預かったことにしない", "置き場が 429 を返す", "資格情報を保存する（実ブラウザ）", "E-SEC-003 の文言と待つ秒数が出て、表に行ができない", "D-102.5")],
     "D-101.1", ["D-101.2", "D-101.3", "D-101.4", "D-101.6", "D-102.1", "D-102.3", "D-102.4", "D-102.5", "D-102.6", "D-017.1"], True),
]
for _tid, _title, _h, _dep, _files, _acts, _scr, _ch, _chr, _qs, _src, _more, _crit in EXTRA_B:
    _rows = [qrow(_sps if "search" in _scr else _spb, _tid.replace("T-B-", "BRG-"), _scr[0], _v, _it, _pre_, _st, _ex, _s2, _tid) for _v, _it, _pre_, _st, _ex, _s2 in _qs]
    newtask(_tid, _title, "B", "backend", "3_backend", "api", [], category="backend", hours=_h, critical=_crit, acts=_acts, screen_ids=_scr, depends_on=_dep, choke_points=_ch, choke_rationale=_chr,
            fcp={"new": _files, "modify": [], "shared_read": ["03_architecture/アーキテクチャ設計書.md", "03_architecture/ER図.md"], "forbidden": []}, files_changed=[f"{x} (new)" for x in _files],
            ac={"structural": [f"UBIQUITOUS: {_title[:40]} の成果物があり、type-check と build が通る"],
                "functional": [f"EVENT-DRIVEN: WHEN {_qs[0][3]}、システムは {_qs[0][4]}", f"UNWANTED: IF {_qs[-1][2]}、システムは {_qs[-1][4]}"], "regression": REG_BASE},
            spec_links=[f"01_hearing/決定ログ_進行中.md#{_src[2:5].lstrip('0')}", "03_architecture/アーキテクチャ設計書.md"], qa_rows={"l1": _rows, "l2_flows": []},
            scenarios=[{"name": _title[:40], "steps": [q[3] for q in _qs], "expected": _qs[0][4]}], source=[_src] + _more, why=f"{_src[:5]} で決めたことを日程に載せる（決めたのに日程に無い、を作らない）")

# ---------------------------------------------------------------- 自分のAIとの会話の作り込み（D-104）と記憶の毎朝のまとめ（D-105）
# 見た目は会話の部品 1 つ（T-US-08）で 5 か所に効くが、会話を分ける・書きながら出る・止める／直す／順番待ち・資料・許可・使用量・毎朝のまとめ・
# 上げる候補は API・DB・本人の PC の Bridge まで手を入れないと動かない（2026-09-27 すり合わせ）。作る前に確かめること（書きながら出る・使用量・声）は各タスクの最初の行
_spc = f"{SPEC}/screens/clone-chat.md"
EXTRA_CHAT = [
    ("T-B-15", "会話を分ける（新しく話す＝新しいセッション・一覧・探す（名前も中身も）・名前は自動で付き直せる・星・消す・記憶に残さない会話）", 10, ["T-B-13"],
     ["packages/db/migrations/0040_chat_sessions.sql", "apps/api/src/auth/ext.ts", "apps/api/test/chat_sessions.test.ts", "apps/web/lib/agent.ts"],
     ["A88"], ["clone-chat"], ["C2"], "会話と名前・星・消すを DB に書く（C2）。外には出ない", _spc,
     [("分ける", "「新しく話す」を押すと新しい会話ができ、次の一言は新しいセッションで始まる（前の会話の続きにならない）", "会話が 1 つある", "新しく話す → 言う（実ブラウザ）", "一覧に 2 つ並び、新しい方の agent_session_id は前と違う", "D-104.1"),
      ("戻る", "一覧から前の会話を選ぶと、その会話の続きとして話せる（同じセッションを --resume）", "会話が 2 つある", "前の会話を選んで言う（実ブラウザ）", "前の会話の吹き出しの下に続きが出て、agent_session_id が前と同じ", "D-104.1"),
      ("名前", "名前は最初の一言から自動で付き、直すとそれが残る（自動で上書きしない）", "新しい会話", "言う → 名前を直す → もう一度言う", "直した名前のまま・title_auto が false", "D-104.1"),
      ("探す", "一覧で探すと名前も中身も当たり、当たった所が見える", "中身に「着手金」を含む会話", "一覧で「着手金」と探す（実ブラウザ）", "その会話が出て、当たった文が 1 行見える", "D-104.1"),
      ("記憶に残さない", "記憶に残さない会話は、毎朝のまとめで読まれない", "記憶に残さない会話で話した", "翌朝「昨日の会話をまとめる」を押す", "その会話はまとめの読んだ数に入らない", "D-104.1"),
      ("G-14 口座状態の波及", "消した会話は一覧にも探すにも出ず、直接の URL は「この会話はありません」", "会話を消した", "消した会話の URL を開く", "文言と一覧への導線が出る（素の 404 にしない）", "D-086.2")],
     "D-104.1", ["D-062.1", "D-090.1"], True),
    ("T-B-16", "書きながら出る返事と作業の見せ方（Bridge が途中の文・今していること・手順を送る。画面は吹き出しの外に 1 行・手順・経過時間・道具の行）", 12, ["T-B-13"],
     ["apps/bridge/src/stream.ts", "apps/bridge/src/runner.ts", "apps/bridge/src/stream.test.ts", "packages/db/migrations/0041_agent_partial.sql", "apps/api/src/auth/ext.ts"],
     ["A20"], ["clone-chat"], ["C5", "C2"], "Bridge が CLI の出来事を受け（C5）、API が途中の文と印を DB に書く（C2）", _spc,
     [("確かめる", "本人の Claude Code が途中の文を出せるか（--include-partial-messages 等）を実物で確かめ、出せないなら「終わってから一度に」のままにして理由を記録する", "この PC の Claude Code", "短い頼みを 1 件流す", "途中の文が届く・届かないが 07_tasks/audit/T-B-16.md に残る", "D-104.8"),
      ("書きながら", "返事は書きながら少しずつ出る（全部書き終わるまで空で待たせない）", "Bridge がつながっている", "長めの返事を頼む（実ブラウザ）", "吹き出しの文が伸びていき、終わると result と同じになる", "D-104.8"),
      ("作業中", "作業中は吹き出しを出さず「〇〇を調べています…」・手順（済の印）・経過時間・道具の行が出る。終わると「N つの操作・時間」の 1 行に畳まれる", "道具を使う頼み", "頼む（実ブラウザ）", "作業の行が出て、終わると 1 行に畳まれて吹き出しの上に残る", "D-104.8"),
      ("残さない", "道具の返り値の全文は Kaname に残らない（行を開いても対象・成否・時間まで）", "道具を使った仕事", "道具の行を開く", "対象・成否・時間だけ", "D-100.3"),
      ("G-15 信号なし終了", "途中の文が来ていても、完了の知らせが無ければ終わったことにしない", "途中で CLI を殺す", "会話を見る", "「止まりました」と理由。途中の文は答えとして確定しない", "G-15")],
     "D-104.8", ["D-093.7", "D-100.3"], True),
    ("T-B-17", "止める・止めずに直す・順番待ち（Bridge が動いている Claude Code を止める／次の区切りで文を渡す。動いている間に送った文は順番待ち、取り消せる）", 10, ["T-B-16"],
     ["apps/bridge/src/runner.ts", "apps/bridge/src/loop.ts", "apps/api/src/auth/ext.ts", "packages/db/migrations/0042_agent_steer.sql", "apps/api/test/agent_steer.test.ts"],
     ["A89"], ["clone-chat"], ["C5", "C2"], "動いているプロセスを止める・文を渡す（C5）、仕事の状態を書く（C2）", _spc,
     [("止める", "動いている間は送るボタンが止めるに変わり、押すと止まって「止まりました（あなたが止めました）」が出る", "作業中", "止めるを押す（実ブラウザ）", "Claude Code のプロセスが終わり、仕事は stopped・理由つき", "D-104.9"),
      ("直す", "動いている間に送った「止めずに直す」文は、次の区切りで動いている作業に渡る", "作業中", "「宛先は鈴木さんで」と送る（実ブラウザ）", "作業が止まらず、次の区切り以降の動きに反映される（steer の出来事が残る）", "D-104.9"),
      ("順番待ち", "動いている間に送った文は順番待ちに並び、× で取り消せる。今の作業が終わると順に動く", "作業中", "2 つ送り、1 つ取り消す", "取り消した方は動かず（cancelled）、残った方だけ次に動く", "D-104.9"),
      ("止まったら", "止まったら理由だけ出し、ボタンは置かない。次に送る文で続き・別の話が決まる", "止まった会話", "「続けて」と送る", "同じセッションで続きから動く", "D-104.15"),
      ("G-12 切り替わりの瞬間", "止めるを押した直後に届いた途中の文は、止めた後に答えとして出さない", "作業の終わり際", "止めるを押す", "止まりました が最後。後から答えが割り込まない", "G-12"),
      ("エラー", "PC が応答せず止める合図が届かないときは、止めたことにしない", "Bridge を落とす", "止めるを押す", "E-CHAT-003 の文言", "E-CHAT-003")],
     "D-104.9", ["D-104.15", "D-090.4"], True),
    ("T-B-18", "資料と画像を付ける（＋・ドラッグ・貼り付け・長い文は自動で添付・送る前に外せる。置き場に置き、Bridge が期限つきの署名 URL で受け取って自分のAI に渡す）", 12, ["T-B-15"],
     ["apps/api/src/auth/ext.ts", "packages/gateways/src/storage.ts", "apps/bridge/src/attachments.ts", "apps/bridge/src/attachments.test.ts", "apps/web/components/ai/composer.tsx"],
     ["A90"], ["clone-chat"], ["C4", "C2", "C5"], "置き場に置く（C4）・添付の行を書く（C2）・本人の PC の作業場所に置く（C5）", _spc,
     [("付ける", "＋・ドラッグ・貼り付けで付けると、入力欄の上に一覧が出て、送る前に × で外せる", "会話を開く", "画像を貼り付け → 1 つ外す（実ブラウザ）", "一覧に出て、外したものは送られない", "D-104.11"),
      ("渡す", "付けた資料は会社の置き場に置かれ、Bridge が期限つきの署名 URL で受け取り、自分のAI が読める", "Bridge がつながっている", "PDF を付けて「要点を」と頼む（実ブラウザ）", "自分のAI が中身を読んで答える。保存先の鍵は AI への指示に出ない", "D-104.11"),
      ("長い文", "長い文を貼ると自動で添付になる", "—", "1 万字を貼る", "入力欄ではなく添付の一覧に入る", "D-104.11"),
      ("G-11 外部リソースの実在", "置き場（バケット）が staging に存在し、手元の仮の置き場（KANAME_DEV_FAKE_BUCKET）のまま staging に出ない", "staging", "資料を付けて送る", "置き場に実体ができる", "G-11"),
      ("エラー", "置き場に置けなかったら送ったことにせず、付けた一覧と文を残す", "置き場を止める", "送る", "E-CHAT-002 の文言。一覧と文が残る", "E-CHAT-002"),
      ("上限", "大きすぎる資料は置く前に断る", "60MB のファイル", "付ける", "E-LIM-002 の文言", "E-LIM-002")],
     "D-104.11", ["D-066.8", "D-029.1"], True),
    ("T-B-19", "許可のモードと「いつも許可」・問い合わせの答え（毎回聞く／編集は自動／自動で判断／計画だけ／全部許可。3 択＋一言。AskUserQuestion の答えを返す）", 12, ["T-B-16"],
     ["apps/bridge/src/runner.ts", "apps/bridge/src/permission.ts", "apps/api/src/auth/ext.ts", "packages/db/migrations/0043_permission_rules.sql", "scripts/ci/claude-terms.mjs"],
     ["A91", "A35"], ["clone-chat", "policies"], ["C5", "C2"], "Claude Code に公式の許可のモードと許可の一覧を渡す（C5）、答えと決まりを書く（C2）", _spc,
     [("3 択", "許可の問いに 今回だけ／いつも／しない ＋ 一言 で答えられ、答えは証跡に残る", "作業中に許可の問い", "いつも を押す（実ブラウザ）", "次から同じ道具・対象は聞かれない。permission_rules と証跡に行", "D-104.14"),
      ("取り消し", "「いつも」にしたものは ルール › 個人 で一覧・取り消しでき、取り消すと次から聞かれる", "いつも許可が 1 件", "取り消す → 同じ頼み", "また聞かれる", "D-104.14"),
      ("モード", "入力欄で許可のモードを切り替えると、その会話の仕事に公式のモードとして渡る", "会話を開く", "計画だけ にして頼む", "Claude Code が動かず進め方だけ返す", "D-104.14"),
      ("全部許可", "全部許可は本人が選んだときだけで、既定にしない。選ぶときに何が起きるかを出す。検査（claude-terms）は「本人が選んだとき以外に渡していない」を見る", "既定の会話", "何も選ばずに頼む", "bypassPermissions は渡らない。選んだ会話だけ渡る", "D-104.14"),
      ("問い合わせ", "自分のAI からの問い合わせ（選択肢・見本・複数の問い）に答えると、その答えで続きが動く", "問い合わせを出す頼み", "答えて送る（実ブラウザ）", "答えが自分のAI に届いて続きが動く", "D-104.7"),
      ("関門", "許可のモードに関わらず、銀行・規約で自動操作が禁止のサービスは関門で止まる", "全部許可の会話", "禁止のサービスを操作させる", "関門が止め、人へのハンドオフになる", "D-015")],
     "D-104.14", ["D-107.2", "D-104.7", "D-092.2", "D-093.3", "D-093.6"], True),
    ("T-B-20", "自分のAIの使用量（Bridge が Claude Code から 5 時間の枠・週の枠といつ戻るかを受け、アカウントに出す。近い・達したら会話に案内）", 6, ["T-B-16"],
     ["apps/bridge/src/stream.ts", "apps/api/src/auth/ext.ts", "packages/db/migrations/0044_agent_usage.sql"],
     ["A94"], ["account", "clone-chat"], ["C5", "C2"], "CLI の知らせを受け（C5）、最新の値を書く（C2）", f"{SPEC}/screens/account.md",
     [("確かめる", "本人の Claude Code が枠の使用量（割合・いつ戻るか）を知らせるかを実物で確かめ、無ければ上限に当たった知らせだけを使い、理由を記録する", "この PC の Claude Code", "頼みを流して出来事を記録する", "使える値が 07_tasks/audit/T-B-20.md に残る", "D-104.16"),
      ("見る", "アカウント › 自分のAIの使用量 に 5 時間の枠と週の枠の割合と、いつ戻るかが出る", "使用量の知らせを受けた", "開く（実ブラウザ）", "2 つの枠と戻る時刻", "D-104.16"),
      ("案内", "枠の 8 割を越えると会話に案内が出て、達したら戻る時刻まで動けないと出る", "枠 82%", "会話を開く", "案内の帯と使用量へのリンク", "D-104.16"),
      ("エラー", "上限に当たった仕事は止まりました の理由に上限と戻る時刻が出る", "上限に当たる", "頼む", "E-LIM-010 の文言", "E-LIM-010")],
     "D-104.16", ["D-100.1", "D-093.5"], True),
    ("T-B-21", "記憶の毎朝のまとめ（「今日」の一番上のボタン → 溜まった会話と承認・差し戻しを自分のAI が読む → 覚えた／まとめた／上げる候補／捨てた。個人は自動で入れ、整理は前後を残す）", 14, ["T-B-16", "T-B-15"],
     ["packages/db/migrations/0045_memory_digest.sql", "apps/api/src/auth/ext.ts", "apps/bridge/src/runner.ts", "apps/web/app/(app)/today/page.tsx"],
     ["A92", "A30"], ["today", "clone-memory"], ["C3", "C2"], "自分のAI が読んで分ける（C3＝Bridge 経由・本人のサブスク）、記憶とまとめを書く（C2）", f"{SPEC}/screens/today.md",
     [("押す", "時間では動かない。「昨日の会話をまとめる」を押したときだけ始まる", "朝・溜まった会話あり", "何もしない → 押す（実ブラウザ）", "押すまで memory_digests に行ができない。押すと始まる", "D-105.2"),
      ("溜まる", "押さない日は溜まり、ボタンに何日分・会話いくつが出る。次に押すと溜まった分をまとめる", "2 日押さなかった", "今日 を開く → 押す", "「2 日分・会話 7」→ from_on〜to_on が 2 日分", "D-105.2"),
      ("読む", "読むのは自分のAI との会話（記憶に残さない会話を除く）と、その日の承認・差し戻し", "承認 1・差し戻し 1・記憶に残さない会話 1", "押す", "読んだ数に承認と差し戻しが入り、記憶に残さない会話は入らない", "D-105.3"),
      ("直す", "結果は 覚えた／まとめた／上げる候補／捨てた に分けて出て、その場で直す・戻す・拾い直すができる", "まとめ済み", "まとめたものを 戻す（実ブラウザ）", "前の記憶に戻り、superseded_by が外れる", "D-105.4"),
      ("覚えて", "「これ覚えて」と言うと、朝を待たずその場で入り「覚えました」が出る", "会話", "「初回は値引きしない。覚えて」（実ブラウザ）", "memories に 1 行・会話に「覚えました」と記憶の画面へのリンク", "D-105.1"),
      ("エラー", "PC が閉じていたら始めたことにせず、溜まっている量も減らさない", "Bridge を止める", "押す", "E-MEM-001 の文言。溜まった量が変わらない", "E-MEM-001")],
     "D-105.2", ["D-105.1", "D-105.3", "D-105.4", "D-105.5"], True),
    ("T-B-22", "上の層へ上げる候補と食い違い（上げ先は AI が選び本人が送る・OK までは個人で効く・確認者がいない層は 1 つ上へ・決まりは上ほど強い・食い違いは並べて確認者が決める）", 10, ["T-B-21"],
     ["packages/db/migrations/0045_memory_digest.sql", "apps/api/src/auth/ext.ts", "apps/web/app/(app)/ai/memory/page.tsx"],
     ["A93"], ["clone-memory", "today"], ["C2", "C6"], "候補と決定を書く（C2）、決まったら知らせる（C6）", f"{SPEC}/screens/clone-memory.md",
     [("送る", "上げる候補は、本人が上げ先を変えて送るまで上がらない。送ると上げ先の層の確認者の確認待ちに出る", "上げる候補 1", "上げ先を 経理部 に変えて送る（実ブラウザ）", "経理部の長の確認待ちに出る", "D-105.6"),
      ("効く", "OK までは送った人の個人の記憶として効き、OK で上の層に入る", "送った候補", "OK の前後で送った人と別の人の自分のAI に聞く", "OK 前は送った人だけに効き、OK 後は層の全員に効く", "D-105.6"),
      ("繰り上げ", "上げ先の層に確認者がいないときは 1 つ上の層の確認者へ回り、最後は会社の代表", "長のいない層へ送る", "送る", "1 つ上の層の確認者に出る", "D-105.6"),
      ("強さ", "決まり（rule）は上の層ほど強く下で上書きできない。好み・やり方は本人に近い層が勝つ", "会社の決まりと個人の好みがぶつかる", "自分のAI に関係する頼みをする", "決まりに従い、食い違いを本人に示す", "D-105.8"),
      ("食い違い", "同じことへの食い違う提案は 1 件にまとめ、両方の根拠を並べて確認者が決め、決まったら両者に知らせる", "A と B が違う締め日を送る", "確認者が決める（実ブラウザ）", "束が 1 件・決めると両者に知らせ", "D-105.9"),
      ("層", "層が個人だけの会社（一人社長）には上げる候補を出さない。層の段の数が 0〜n でも同じ規則で効く", "一人社長の会社", "まとめる", "上げる候補の群が出ない", "D-105.10")],
     "D-105.6", ["D-105.7", "D-105.8", "D-105.9", "D-105.10", "D-073.1"], True),
    ("T-B-23", "成果物を会話の横で開いて直し、版を残して戻す（返事から書き出す・文書と表はその場で直すと新しい版・版の一覧から戻す・画像や PDF は見るだけ・置き場は関門 C4）", 14, ["T-B-18"],
     ["packages/db/migrations/0045_artifacts.sql", "apps/api/src/auth/artifacts.ts", "apps/api/test/agent_artifacts.test.ts", "apps/web/components/ai/artifact.tsx"],
     ["A95"], ["clone-chat"], ["C4", "C2"], "成果物の中身を置き場に置く（C4）、成果物と版を DB に書く（C2）", _spc,
     [("書き出す", "返事の「書き出す」を押すと、その返事の本文から成果物（md）ができ、会話の横に開く。名前は最初の見出しか最初の行から付く", "自分のAI の返事がある", "書き出す を押す（実ブラウザ）", "横に成果物が開き、artifacts に 1 行・版 1。名前が返事の見出し", "D-106.1"),
      ("横で開く", "閉じても成果物は残り、会話の中の成果物のカードから開き直せる。広い画面は右、狭い画面は全面", "書き出した成果物", "閉じる → カードから開く（実ブラウザ・375 と 1440）", "同じ成果物が開く。375 で横にはみ出さない", "D-106.2"),
      ("直す", "文書と表は横でそのまま直せ、保存すると新しい版になる（上書きしない）", "版 1 の成果物", "直して保存（実ブラウザ）", "版 2 ができ、版 1 の中身は変わらない", "D-106.3"),
      ("戻す", "版の一覧から前の版を開いて戻せる。戻すのも新しい版として残し、どの版も消さない", "版 2 まである", "版 1 に戻す（実ブラウザ）", "版 3 ができ中身は版 1 と同じ。reverted_from=1。版 1〜3 が一覧に残る", "D-106.4"),
      ("見るだけ", "画像・PDF・動画・音声の成果物は横で見るだけ（直す欄を出さない）。表は並べ替えて見られる", "画像の成果物と csv の成果物", "開く（実ブラウザ）", "画像は見るだけ。csv は表で並べ替えられる", "D-106.5"),
      ("置き場", "中身は置き場に置き関門 C4 を通す。大きすぎる成果物は作らず理由を出す。自分のAI に置き場の鍵を見せない", "上限を超える本文", "書き出す", "「大きすぎて成果物にできません」と上限。置き場にも DB にも行ができない", "D-106.6"),
      ("落とす", "手元に落とすのは今の版を自由に", "版 3 の成果物", "落とす（実ブラウザ）", "今の版の中身のファイルが落ちる", "D-106.7"),
      ("G-14 口座状態の波及", "成果物は書き出した人のもの。他の人は直せず、他の会社からは見えない", "別の人・別の会社", "直す API を呼ぶ／一覧を見る", "直せない（0 行）・他の会社の一覧に出ない", "D-106.8")],
     "D-106.1", ["D-106.2", "D-106.3", "D-106.4", "D-106.5", "D-106.6", "D-106.7", "D-106.8", "D-104.5", "D-104.17"], True),
    ("T-B-24", "規約で自動操作が禁止のサービスと銀行を、全部許可でも本人の PC の上で止める（仕事ごとに使わない道具として渡す・道具を使う直前のフックでコマンドと宛先を調べる・止めたら理由と人への案内・証跡）", 12, ["T-B-19"],
     ["packages/db/migrations/0046_bridge_blocked.sql", "apps/bridge/src/guard.ts", "apps/bridge/src/guard-hook.mjs", "apps/bridge/test/guard.test.ts", "apps/api/test/bridge_blocked.test.ts"],
     ["A20"], ["clone-chat"], ["C1", "C5", "C2"], "外への宛先を PC の上で止める（C1）、Claude Code に道具の禁止とフックを渡す（C5）、止めた記録を書く（C2）", _spc,
     [("止める先", "サービス台帳で forbidden と bank のドメイン（下の階層も）を止める。台帳の版が変わったら次の仕事から効く", "台帳に bank のドメイン", "仕事を渡す", "Bridge が受け取る禁止の一覧にそのドメインがある。台帳を変えると次の仕事の一覧が変わる", "D-107.1"),
      ("使わない道具", "仕事を渡すたびに、禁止のドメインへの取り込みを使わない道具として Claude Code に渡す。全部許可でも効く", "全部許可の会話", "仕事を流す", "CLI の引数に --disallowedTools の WebFetch(domain:…) が付く", "D-107.2"),
      ("直前のフック", "道具を使う直前のフックで Bash のコマンド・取り込み・ブラウザ操作の宛先を調べ、禁止のドメインなら止める", "全部許可の会話", "禁止のサービスを操作させる（curl・WebFetch・ブラウザ）", "フックが止め、止めた理由が自分のAI に返る", "D-107.3"),
      ("見せ方", "止めたら作業の行に「〇〇 は規約で自動操作が禁止のため止めました」と出し、返事で人への案内（正規の連携・手作業）を示す", "止まった仕事", "会話を見る（実ブラウザ）", "作業の行に止めた理由と宛先が出る", "D-107.4"),
      ("残す", "止めたことは証跡（誰の仕事・どのサービス・どの道具）に残る", "止まった仕事", "証跡を見る", "bridge_job_events に blocked・audit_events に 1 行", "D-107.5"),
      ("見抜けない形", "文字を組み立てて宛先を作るコマンドなどは完全には見抜けないことを、台帳の説明と設計書に書いている", "設計書", "読む", "見抜けない形が書かれている", "D-107.6"),
      ("資格情報", "止める仕組みに渡るのはドメインの一覧だけで、資格情報は渡らない", "Bridge が受け取る仕事", "受け取った中身を見る", "ドメインの一覧だけ。資格情報・鍵が無い", "D-107.7")],
     "D-107.1", ["D-107.2", "D-107.3", "D-107.4", "D-107.5", "D-107.6", "D-107.7", "D-041", "D-104.14"], True),
    ("T-B-25", "自分のAI が Kaname の道具（MCP）で聞き取ったことをたたき台に置く（目標・台帳・担当業務とAI社員を置く・直す・外す・覚える・読む。鍵はその仕事の間だけ・聞かずに使える・証跡。Bridge は答えを待つ間を上限に数えない）", 12, ["T-B-03"],
     ["packages/db/migrations/0049_agent_tools.sql", "apps/api/src/auth/agent-tools.ts", "apps/api/test/agent_tools.test.ts", "apps/bridge/src/kaname-tools.ts", "apps/bridge/test/kaname-tools.test.ts"],
     ["A06", "A07"], ["onboard-interview", "onboard-draft"], ["C5", "C2"], "Claude Code に道具のサーバーを渡す（C5）、たたき台と証跡を書く（C2）", f"{SPEC}/screens/onboard-interview.md",
     [("道具を渡す", "会話の仕事ごとに、Bridge が本人の Claude Code に Kaname の道具（kaname）を渡す。会話でない仕事には渡さない", "会話の仕事・まとめの仕事", "仕事を渡す", "会話の仕事だけ --mcp-config の kaname とその仕事の鍵が付く", "D-110.1"),
      ("置く", "はじめの設定で会社のことを話すと、自分のAI が目標・台帳・担当業務とAI社員を置き、たたき台の画面にそのまま出る", "Bridge をつないだ", "「たたき台を置いて」と話す → たたき台を開く（実ブラウザ）", "目標・台帳・担当業務とAI社員のカードに置いたものが出る", "D-110.2"),
      ("鍵", "鍵はその仕事の間だけ・本人の会社にだけ効く。終わった仕事の鍵・別の会社の物・知らない道具では書けない", "終わった仕事の鍵・別の会社の目標", "道具を呼ぶ", "401／422 で書けない。別の会社の目標は変わらない", "D-110.3"),
      ("聞かずに使える", "許可のモードが毎回聞くでも、Kaname の道具は許可の問いを出さずに使える", "毎回聞くの会話", "たたき台を置かせる（実ブラウザ）", "許可の問いが出ずに置かれる", "D-110.4"),
      ("残す", "道具で書いたことは証跡（誰の仕事・どの道具・何を）に残る", "置いた後", "証跡を見る", "audit_events に agent.goal_created 等が 1 件ずつ", "D-110.5"),
      ("資格情報", "道具に渡るのは Kaname の宛先とその仕事の鍵だけで、資格情報は渡らない", "Bridge が渡す引数", "引数を見る", "資格情報・Bridge の session が無い", "D-110.6"),
      ("止める目安", "Bridge が仕事を止める目安は何も進まない時間で、本人の答えを待っている間は数えない", "問い合わせに 10 分以上答えない", "答える", "止まらずに続きが動く。何も出ないまま上限を過ぎたときだけ止まる", "D-110.7")],
     "D-110.2", ["D-110.1", "D-110.3", "D-110.4", "D-110.5", "D-110.6", "D-110.7", "D-028.1", "D-030.3", "D-010.1"], True),
    ("T-B-26", "自分のAI の仕事の並びを画面が正しく見せる（開き直すと動いている・答えを待っている会話が出る・別の会話の仕事の後ろで待っている文は、どこを待っているかとそこへの道を出す）", 4, ["T-B-16"],
     ["packages/db/migrations/0050_agent_lane.sql", "apps/web/components/ai/work.tsx", "apps/web/tests/screens/clone-lane.spec.ts"],
     ["A20"], ["clone-chat", "onboard-interview"], ["C2"], "会話のいまを読む（C2 の読み出し）。外には出ない", _spc,
     [("開き直す", "何も選ばずに開くと、自分のAI が動いている・答えを待っている会話が先に出る。読んだ印で更新時刻が動いても古い会話に戻らない", "直して送り直した新しい会話が答えを待っている・前の会話に読んだ印", "開き直す（実ブラウザ）", "答えを待っている問い合わせが出る", "D-104.9"),
      ("並び", "別の会話の仕事（動いている・答えを待っている）の後ろで待っている文は、黙って止まって見せず、どの会話を待っているかとその会話を開く道を出す", "別の会話が答えを待っている", "前の会話で送る（実ブラウザ）", "「別の会話で、自分のAI があなたの答えを待っています」と順番待ちに文が出て、その会話を開ける", "D-104.9")],
     "D-104.9", ["D-104.18", "D-090.2"], True),
    ("T-B-27", "作業中の行が本当のいまを出す（考えている・問い合わせを書いている・返事を書き始めたの切り替わりと最後の動き・PC が応答しなくなったらそう言う・途中で止まった Bridge の仕事は戻ってきたときに理由つきで止める）", 6, ["T-B-16"],
     ["packages/db/migrations/0051_bridge_orphans.sql", "apps/bridge/src/stream.ts", "apps/web/components/ai/work.tsx", "apps/web/tests/screens/clone-progress.spec.ts"],
     ["A20"], ["clone-chat", "onboard-interview"], ["C5", "C2"], "CLI の切り替わりを受ける（C5）、途中経過と後始末を書く（C2）", _spc,
     [("切り替わり", "CLI の切り替わり（考えている・道具を準備している・返事を書き始めた）を読み、人が読む 1 行にして送る。前の書きかけは消す", "問い合わせの後にまた考え始めた", "仕事を流す", "作業の行が「考えています」「あなたへの問い合わせを書いています」「返事を書いています」の順に変わる", "D-104.8"),
      ("いまの動き", "作業中は、いまの動きを「〇〇しています…」の一言で出す（秒数は出さない）", "考えている最中", "会話を見る（実ブラウザ）", "作業の行が「考えています…」で、最後の動きの秒数は出ない", "D-104.8"),
      ("後始末", "Bridge が途中で止まって戻ってきたら、動いたまま残った仕事は理由つきで止まり、次の仕事が渡る", "動いている途中で Bridge が止まった", "Bridge を戻す（実ブラウザ）", "「PC の Bridge が途中で止まったので、ここで止まりました」が出て、書いています のまま残らない", "D-104.15"),
      ("応答なし", "作業中に PC の Bridge が応答しなくなったら、作業の行で「応答がありません（最後の知らせは N 分前）」と言い、書いています と言い続けない", "作業中に Bridge が止まった", "会話を見る（実ブラウザ）", "作業の行に 応答がありません と最後の知らせの時刻", "D-090.8")],
     "D-104.8", ["D-104.15", "D-090.8"], True),
    ("T-B-29", "答えた問い合わせを届かないまま捨てない（Bridge が受け取ったら印を付け、受け取らないまま止まった答えは、同じ会話で次に言ったときに自分のAI へ添えて渡す・二度は渡さない）", 3, ["T-B-16"],
     ["packages/db/migrations/0052_answer_carry.sql", "apps/api/src/auth/ext.ts", "apps/api/test/bridge_orphans.test.ts"],
     ["A20", "A06"], ["clone-chat", "onboard-interview"], ["C2"], "答えの受け渡しの印を書く（C2）", _spc,
     [("渡す", "問い合わせに答えた後、Bridge が受け取らないまま止まったら、同じ会話で次に言ったときに、その答えが自分のAI への指示に添えて渡る", "答えた後に Bridge が止まった", "「続けて」と送る", "自分のAI への指示に「本人はもう答えています」と問いと答えが入り、同じ問いを聞き直さない", "D-104.7"),
      ("二度渡さない", "Bridge が受け取った答え・一度渡した答えは、もう渡さない", "答えを渡した後", "もう一度言う", "指示に答えが重ねて入らない", "D-104.7")],
     "D-104.7", ["D-093.3"], True),
    ("T-B-31", "自分のAI の会話は本人の PC の Claude Code の記録が正本（文を記録と同じ id で写す・つながったとき／仕事の後に記録から写し漏れを取り戻す・同じ文を二度入れない・結末で答えを重ねない）", 8, ["T-B-16"],
     ["packages/db/migrations/0053_transcript_mirror.sql", "apps/bridge/src/transcript.ts", "apps/api/test/transcript_mirror.test.ts", "apps/bridge/test/transcript.test.ts"],
     ["A20", "A06"], ["clone-chat", "onboard-interview"], ["C5", "C4", "C2"], "Claude Code の流れと記録を読む（C5・C4）、写しを書く（C2）", _spc,
     [("流れながら写す", "自分のAI の文は、Claude Code が流すたびに記録と同じ id で Kaname に写り、吹き出しになる。仕事の結末で答えを重ねて足さない", "会話の仕事", "返事を待つ", "文ごとに吹き出しが出て、同じ答えが 2 つ並ばない。作業の記録は最後の文に付く", "D-112.2"),
      ("記録を読む", "本人の PC の記録を session の id で探し、自分のAI の文だけを読む（考えている中身・道具の返り値・本人の文は読まない）", "本人の PC の記録", "読む", "自分のAI の文だけが、記録の id と時刻のまま取り出せる", "D-112.4"),
      ("取り戻す", "途中で Bridge が止まって返事が Kaname に届かなくても、つなぎ直すと本人の PC の記録から返事を取り戻す。同じ文は二度入らない", "考えている途中で Bridge が止まった", "つなぎ直す（実ブラウザ）", "記録にある返事が 1 回だけ会話に出る", "D-112.3"),
      ("本人の会話だけ", "別の人の会話には写せない。id の形が違う・空の文は入れない", "別の人の会話", "写す口を呼ぶ", "入らない", "D-112.1"),
      ("古い Bridge", "文を写さない古い Bridge からの仕事は、今までどおり結末で答えが 1 つ入る", "古い Bridge", "結末を返す", "答えが 1 つ入る", "D-112.1"),
      ("間に合わなかった一言", "仕事が区切りの一言を取りに行った後、結末の前に届いた一言は捨てず、送ったときのモードで次の仕事として並ぶ（本人が止めた仕事では並べない）", "返事が出て仕事が閉じる直前", "続けて送る", "次の仕事として並び、送ったときのモードで動く", "D-104.9")],
     "D-112.1", ["D-112.2", "D-112.3", "D-112.4", "D-112.5", "D-112.6", "D-100.3"], True),
    ("T-B-30", "作業中は 1 行が切り替わる・内部の名前を出さない・絵文字を出さない・選んでもらう質問は問い合わせで（会話の決まりは Kaname が仕事ごとに渡す）", 4, ["T-B-16"],
     ["apps/api/src/auth/conventions.ts", "apps/web/components/ai/work.tsx", "apps/web/components/ai/markdown.tsx", "apps/bridge/src/stream.ts"],
     ["A20"], ["clone-chat", "onboard-interview"], ["C5"], "Claude Code に渡す決まり（C5）。外には出ない", _spc,
     [("1 行", "作業中は道具の行を並べず、いまの動きを 1 行で出して切り替える", "道具を続けて使う仕事", "会話を見る（実ブラウザ）", "作業の行は 1 行だけで、道具の行が並ばない", "D-111.1"),
      ("内部の名前", "作業の行に mcp__… ・select:… ・ToolSearch を出さず、人の言葉にする", "たたき台に置く仕事", "会話を見る（実ブラウザ）", "「たたき台に目標を置いています：〇〇」と出て、画面のどこにも mcp__ が無い", "D-111.2"),
      ("絵文字", "自分のAI の返事に絵文字は出さない（書いてきても消して描く）", "絵文字を含む返事", "会話を見る（実ブラウザ）", "絵文字が消えて、文だけが出る", "D-111.3"),
      ("質問", "本人に選んでもらう質問は問い合わせで出させる（会話の決まりに書き、仕事ごとに渡す）", "会話の仕事", "Bridge が受け取る仕事を見る", "決まりに「AskUserQuestion の問い合わせで出す」「絵文字は使わない」が入って渡る", "D-111.4")],
     "D-111.1", ["D-111.2", "D-111.3", "D-111.4", "D-111.5", "D-104.8"], True),
    ("T-B-28", "この PC の Bridge が別のアカウントでつながっているときは黙って切り替えない（理由を出し、本人が「このアカウントに切り替える」を押したときだけつなぐ）", 3, ["T-B-02"],
     ["apps/bridge/src/main.ts", "apps/bridge/src/local.ts", "apps/web/lib/bridge-presence.ts", "apps/web/tests/screens/setup-gate.spec.ts"],
     ["A09"], ["bridge-setup"], ["C1", "C2"], "Bridge が Kaname に前の鍵を確かめる（C1）、つなぐ記録を書く（C2）", f"{SPEC}/screens/bridge-setup.md",
     [("黙って切り替えない", "この PC の Bridge が別のアカウントでつながっている（前の鍵がまだ通る）なら、つなぐ画面を開いても黙って切り替えず、理由を出す", "Bridge が別のアカウントでつながっている", "つなぐ画面を開く（実ブラウザ）", "「すでに別のアカウントでつながっています」と出て、Bridge はつなぎ直さない", "D-089.10"),
      ("切り替える", "本人が「このアカウントに切り替える」を押したときだけ、この PC の Bridge をこのアカウントにつなぎ直す", "理由が出ている", "「このアカウントに切り替える」を押す（実ブラウザ）", "このアカウントでつながり、仕事を渡せる", "D-089.10")],
     "D-089.10", ["D-089.8", "D-090.6"], True),
    ("T-B-32", "会話が変わったらサーバーから画面に知らせる（DB が member id だけを知らせる・API 1 台 1 本の専用接続で受ける・画面は知らせで読み直す・使えない間は見に行く形に戻る）", 6, ["T-B-16"],
     ["packages/db/migrations/0054_agent_notify.sql", "packages/db/src/listen.ts", "apps/api/src/auth/agent-stream.ts", "apps/web/lib/agent-stream.ts", "apps/api/test/agent_stream.test.ts", "apps/web/tests/screens/clone-push.spec.ts"],
     ["A20"], ["clone-chat", "onboard-interview"], ["C2"], "知らせを出す trigger と、知らせを受ける 1 本の専用接続（C2・台帳 X-008）", _spc,
     [("知らせで出る", "会話が変わると、その人の画面にだけ「変わった」が届いて読み直し、何もしていない間は見に行かない", "会話を開いて何もしていない", "別のタブで言う（実ブラウザ）", "8 秒の間 /agent/state を見に行かず、別のタブで言ったことが 1.5 秒以内に出る", "D-113.1"),
      ("作業中", "作業中の一言と返事は、知らせを受けて出る", "会話の仕事", "言って返事を待つ（実ブラウザ）", "「考えています…」が出て、返事が出る", "D-113.3"),
      ("見に行く形に戻る", "知らせの流れがつながらない間は、今までどおり見に行って出る", "知らせの流れがつながらない", "別のタブで言う（実ブラウザ）", "6 秒ごとに見に行き、言ったことが出る", "D-113.4"),
      ("つなぎ直す", "サーバーの知らせの接続が落ちたら、画面はつなぎ直して、その後も知らせで出る", "知らせの接続を DB の側から切る", "別のタブで言う（実ブラウザ）", "流れがもう一度つながり、言ったことが 1.5 秒以内に出る", "D-113.5"),
      ("ほかの人", "ほかの人の会話が変わっても、自分の流れには届かない", "2 人がそれぞれ流れを開いている", "もう 1 人が言う", "自分の流れに change が来ない", "D-113.2"),
      ("ログアウト", "ログアウトしたら、次の確かめで流れを閉じる", "流れを開いている", "ログアウトする", "end:unauthenticated が来て流れが閉じる", "D-113.6"),
      ("黙って止まらない", "知らせの接続の通信が詰まって確かめの知らせが戻らなければ、落ちたことにして流れに伝える", "知らせの接続の通信が詰まる", "20 秒ごとの確かめ（試験では短く）", "受けている全員に down が伝わる", "D-113.5")],
     "D-113.1", ["D-113.2", "D-113.3", "D-113.4", "D-113.5", "D-113.6", "D-113.7"], True),
    ("T-B-33", "会話の固定枠（1024 以上で会話の箱だけを画面の残りの高さにし、吹き出しだけがスクロールする。段の帯・見出し・右の欄・入力欄は動かない。会話を本文に出す画面は全部 1 つの部品で）", 3, ["T-B-16"],
     ["apps/web/components/ai/frame.tsx", "06_mockup/_chat.py", "apps/web/components/ai/chat.css", "apps/web/tests/screens/chat-frame.spec.ts"],
     ["A20", "A06"], ["clone-chat", "onboard-interview", "onboard-draft"], [], "画面の部品。外界に出ない", _spc,
     [("はじめの設定の話す", "1024 以上では、ページ全体は動かず、会話の中だけがスクロールし、段の帯・分かったこと・入力欄は動かない", "長い会話（1440 と 1024）", "会話を上へ戻す（実ブラウザ）", "ページは動かず、段の帯と分かったことの位置は変わらず、入力欄は画面の中", "D-072.19"),
      ("会話モード", "会話モード（/ai/chat）でも、会話の名前と入力欄は動かず、会話の中だけがスクロールする", "長い会話（1440）", "会話を上へ戻す（実ブラウザ）", "会話の名前の位置は変わらず、入力欄は画面の中", "D-072.19"),
      ("狭い画面", "1023 以下は今までどおりページごとに流れ、会話の中に別のスクロールを作らない", "長い会話（375）", "開く（実ブラウザ）", "会話の中は溢れず、ページごと流れ、横に溢れない", "D-072")],
     "D-072.19", ["D-104.18"], False),
    ("T-B-34", "はじめの設定の「分かったこと」は自分のAI が覚えた事実を「項目：内容」で出す（聞き取りの間だけは分かった事実をその場で覚える・送った文は並べない）", 2, ["T-B-16"],
     ["apps/web/app/(wizard)/onboard/interview/page.tsx", "apps/api/src/auth/conventions.ts", "apps/bridge/src/conventions.ts", "apps/api/test/conventions.test.ts", "apps/bridge/src/kaname-tools.ts"],
     ["A06"], ["onboard-interview"], ["C5"], "Claude Code に渡す決まり（C5）。外には出ない", _spc,
     [("覚えた事実", "分かったことには、自分のAI が覚えた事実だけが「項目：内容」で並び、送った文は並ばない", "覚えた事実が 2 つある会話", "話す画面を開く（実ブラウザ）", "2 つが項目と内容に分かれて並び、「続けて」は並ばない。「記憶に落ちています」が出る", "D-114.1"),
      ("まだ無い", "まだ何も覚えていなければ「まだ何もありません」で、送った文は並べない", "送った文だけの会話", "話す画面を開く（実ブラウザ）", "「まだ何もありません」が出て、送った文は並ばない", "D-114.1"),
      ("決まり", "聞き取りの間は、分かった事実を remember で「項目：内容」の形で残す決まりが渡り、それ以外は「覚えて」と言われたときだけ。Bridge の控えも同じ文", "会話の決まり", "決まりを読む", "聞き取りの決まりが入っていて、控えとずれていない", "D-114.2"),
      ("毎回添える", "はじめの設定から言ったときだけ、自分のAI への依頼に「聞かずに覚える」の 1 行が添えられる（決まりだけでは聞き返していた）", "はじめの設定から言う／会話モードから言う", "依頼を見る", "はじめの設定のときだけ 1 行が入る", "D-114.2"),
      ("道具の形", "覚える道具の説明は「項目：内容」の形を求める（「1 件 1 文」だと文で書かれて分かれない）", "Kaname の道具", "説明を読む", "「項目：内容」があり、「1 件 1 文」が無い", "D-114.2")],
     "D-114.1", ["D-114.2", "D-114.3", "D-114.4"], False),
    ("T-B-35", "吹き出しは AI の返答ごとに 1 つ（分かれるのは道具を使って結果を受け取った所だけ。1 回の返答の中で文が分かれても 1 つにつなぐ）", 2, ["T-B-31"],
     ["apps/bridge/src/transcript.ts", "apps/bridge/src/stream.ts", "apps/bridge/src/loop.ts", "packages/db/migrations/0055_entry_join.sql", "apps/bridge/test/transcript.test.ts", "apps/api/test/transcript_mirror.test.ts"],
     ["A20", "A06"], ["clone-chat", "onboard-interview"], ["C5", "C4", "C2"], "Claude Code の流れと記録を読む（C5・C4）、写しを書く（C2）", _spc,
     [("つなぐ", "1 回の返答の中で文が 2 行に分かれても、最初の文の id のまま 1 つにつなぐ。返答が変わった所でだけ分かれる（流れながら写すとき・記録から取り戻すとき）", "返答の途中に 考える が挟まった記録", "読む・写す", "同じ返答の文は 1 つ、次の返答は別の 1 つ", "D-115.2"),
      ("受ける側", "同じ id で、前の文の続きになった文が届いたら、吹き出しの中身をその続きに書き換える。短い文・前の文から始まらない文では上書きしない", "同じ id の吹き出しがある", "続き／短い文／別の文を送る", "続きだけで書き換わり、新しい吹き出しは足されない", "D-115.3")],
     "D-115.1", ["D-115.2", "D-115.3"], False),
    ("T-B-36", "はじめの設定の進み方（次へ進むボタンは画面の下の帯に 1 つ・進めないときは理由・押せない段は何をすれば開くかを出す・次の段がまだ無いときは行き止まりにしない）", 3, ["T-B-16"],
     ["apps/web/components/wizard/wizard-layout.tsx", "apps/web/lib/onboarding.ts", "06_mockup/_wiz.py", "apps/web/tests/screens/wizard-next.spec.ts"],
     ["A07", "A08"], ["onboard-draft", "onboard-interview", "bridge-setup", "credentials"], [], "画面の部品。外界に出ない", _spc,
     [("帯が見える", "画面が低くても、たたき台の「これでいく」は下の帯に見えていて、押すと段 3 を通して 4 へ進む。主ボタンは 1 つ", "たたき台がある（1512×700）", "帯のボタンを押す（実ブラウザ）", "スクロールせずに見えて、押すとログイン情報へ移り、段 3 を通したと記録される", "D-116.1"),
      ("押せない段", "押せない段を押すと、いまの段で何をすれば開くかが出る。まだ作っていない段はそう出る", "段 3 にいる", "4 と 5 を押す（実ブラウザ）", "「いまの段『3. たたき台』で…と開きます」「まだ作っていません」が出る", "D-116.2"),
      ("進めない理由", "まだ自分のAI に答えていないと、話すの帯は押せず、何をすれば進めるかが出る", "段 1 まで通した", "話すを開く（実ブラウザ）", "帯のボタンが押せず「自分のAI に 1 つ答えると進めます」", "D-116.1"),
      ("まだ無い次の段", "段 4 を通すと、次の段がまだ無いことを書き、「Kaname を開く」で行き止まりにならない", "段 4 まで通した", "帯のボタンを押す（実ブラウザ）", "「まだ使えません」が出て、押すといま使える画面へ移る（5・6 には行かない）", "D-116.6")],
     "D-116.1", ["D-116.2", "D-116.3", "D-116.6"], False),
    ("T-B-37", "AI がブラウザを動かす土台（本人の Chrome＝Claude in Chrome が既定・Bridge 専用のブラウザ＝Playwright MCP・Bridge の窓で選ぶ・つながらないときは会話と自己診断に理由を出す・禁止の宛先は開く前と開いた後の両方で止める・Stagehand はやめる）", 16, ["T-B-02"],
     ["apps/bridge/src/browser.ts", "apps/bridge/src/guard.ts", "apps/bridge/src/runner.ts", "apps/bridge/src/loop.ts", "apps/bridge/src/stream.ts", "apps/bridge/src/main.ts", "apps/bridge/src/renderer/index.html", "packages/db/migrations/0056_bridge_notice.sql", "packages/db/migrations/0057_bridge_browser.sql", "apps/web/components/ai/browser-fix.tsx", "06_mockup/_browser.py", "apps/bridge/test/browser.test.ts", "apps/bridge/test/guard.test.ts", "apps/web/tests/screens/browser-notice.spec.ts"],
     ["A09", "A10"], ["bridge-setup", "clone-chat"], ["C1", "C4", "C5"], "本人の PC のブラウザで外のサービスを開く（C1）、専用のブラウザのログインの状態を PC に置く（C4）、ブラウザの道具を起こす（C5）", _spc,
     [("本人の Chrome", "既定では本人の Chrome（Claude in Chrome）で開き、読み、押し、タブを閉じる。本人の画面で動くのが見える", "Chrome と拡張機能「Claude in Chrome」がつながっている", "会話で「example.com を開いてリンクを押して」と頼む（本物の Claude Code）", "開いて読み、リンクの先の URL を答え、開いたタブを閉じる", "D-119.1"),
      ("専用のブラウザ", "Bridge の窓で「Bridge 専用のブラウザ」を選ぶと、Playwright MCP がインストール済みの Chrome を Bridge の置き場のログインの状態で開く", "専用のブラウザを選んだ", "同じ頼みごとをする（本物の Claude Code）", "開いて読み、リンクの先の URL を答える。ログインの状態は Bridge の置き場に残る", "D-119.1"),
      ("選ぶ", "Bridge の窓で 自分の Chrome／Bridge 専用のブラウザ／使わない を選べ、既定は自分の Chrome。会話の無い仕事（記憶のまとめ）はブラウザを使わない", "Bridge の窓", "選び直して次の仕事を出す", "次の仕事の起動の引数が選んだものになり、記憶のまとめには付かない", "D-119.2"),
      ("つながらない", "拡張機能が無い・Chrome が閉じている・切れた・専用のブラウザを用意できない は、会話に理由と一手の 1 行が出て、自己診断にも出る（黙って終わらない）", "拡張機能がつながっていない", "ブラウザを使う頼みごとをする", "会話に「AI が Chrome を使えませんでした。…」が 1 回だけ出て、自己診断の Chrome の行が赤になる", "D-119.4"),
      ("開いた後", "リンクを押して禁止の宛先に着いたら、そのタブではその先の操作をさせない（閉じる・別の宛先へ移るだけ許す）。止めた記録は証跡に残る", "禁止の一覧に入った宛先へのリンクがあるページ", "リンクを押してその先で読ませる（本物の Claude Code）", "着いた直後に止まり、そのタブで読む・押すは止められ、AI は本人に手で操作する手順を案内する", "D-119.5"),
      ("Stagehand をやめる", "ブラウザの道具は本人のサブスクの Claude Code に渡す 2 つだけ。AI の API を自分で呼ぶ部品（Stagehand）は入れない", "Bridge の依存", "依存の一覧を読む", "Stagehand が無く、ブラウザの操作で API の料金がかからない", "D-119.3"),
      ("Kaname で選ぶ", "PC の画面で 自分の Chrome／Bridge 専用のブラウザ／使わない を選べ、次の仕事から効く。使わないからも戻せる。Bridge の窓にも同じ値が出る", "つないだ PC で「使わない」", "PC の画面で「自分の Chrome」を選び直し、ブラウザを使う頼みごとをする（実ブラウザ）", "選んだものに印が付き、次の仕事に Chrome が渡る", "D-120.1"),
      ("つなぎ方", "会話の 1 行と PC の画面の行から、つなぎ方の手順と公式の入口を開ける（文だけにしない）", "Chrome とつながっていない", "「つなぎ方を見る」を押す（実ブラウザ）", "3 つの手順と Chrome ウェブストアの入口が出る", "D-120.2"),
      ("確かめる", "「もう一度確かめる」で Bridge が小さな仕事で試し、結果がその場と PC の画面の行に出る。会話には出さない", "拡張機能を直した後", "「もう一度確かめる」を押す（実ブラウザ）", "「つながりました」が出て、PC の画面の行が「できる」になる。会話に吹き出しは増えない", "D-120.3"),
      ("切り替える", "その場で Bridge 専用のブラウザに切り替えられる", "Chrome とつながっていない", "「Bridge 専用のブラウザに切り替える」を押す（実ブラウザ）", "PC の画面の選択が専用のブラウザになり、次の仕事から使う", "D-120.4")],
     "D-119.1", ["D-119.2", "D-119.3", "D-119.4", "D-119.5", "D-119.6", "D-019.1", "D-107.3", "D-120.1", "D-120.2", "D-120.3", "D-120.4"], True),
    ("T-B-38", "ログイン情報を預けたらその場で 1 回ログインだけ試す（入れたらそのまま出る・ほかの操作はしない・結果を預けたものの行に出す）", 6, ["T-B-37", "T-B-05"],
     ["apps/bridge/src/login-check.ts", "apps/web/app/(app)/settings/credentials/page.tsx", "apps/web/tests/screens/credentials.spec.ts"],
     ["A10"], ["credentials"], ["C1", "C8"], "外のサービスにログインする（C1）、鍵を解いて渡す（C8）", _spc,
     [("入れた", "預けたら 1 回ログインし、入れたらそのまま出る。ほかの操作はしない", "正しいログイン情報を預けた", "保存する（実ブラウザ）", "預けたものの行に「ログインできました」と出る", "D-117.1"),
      ("入れない", "入れなければ理由を出す（パスワードが違う／2 段階が要る／CAPTCHA／規約で禁止なので試さない）", "違うパスワード・CAPTCHA のサービス", "保存する（実ブラウザ）", "理由と次の一手が出る。何度も試さない", "D-117.1"),
      ("鍵", "鍵は実行の間だけ受け取り、入力したら捨てる。ディスクにも AI にも渡らない", "預けたログイン情報", "ログインに使う", "入力された後、鍵がメモリにもファイルにも残っていない", "D-117.6")],
     "D-117.1", ["D-017.1", "D-117.6"], True),
    ("T-B-39", "2 段階認証（種類を選ぶ・認証アプリは鍵で自動・SMS／メール／スマホ承認はその場で本人に頼む・コードは Bridge だけに・ログインを覚えておく・10 分返事が無ければ止めて本人がいる時間に回す）", 8, ["T-B-37", "T-B-05"],
     ["apps/bridge/src/two-factor.ts", "apps/web/app/(app)/settings/credentials/page.tsx", "apps/web/tests/screens/credentials.spec.ts"],
     ["A10", "A11"], ["credentials", "approvals"], ["C1", "C6", "C8"], "外のサービスにコードを入れる（C1）、本人に知らせる（C6）、鍵から 6 桁を作る（C8）", _spc,
     [("種類", "預けるときに 2 段階の種類を選べる（認証アプリ／SMS／メール／スマホで承認／なし）", "ログイン情報を預ける", "種類を選ぶ（実ブラウザ）", "種類が保存され、認証アプリのときだけ鍵の欄が出る", "D-117.2"),
      ("頼む", "SMS・メール・スマホ承認は、Bridge がコードの画面で止まって本人に頼む。入れたコードは Bridge だけに渡る", "SMS の 2 段階があるサービスにログイン", "承認待ちでコードを入れる（実ブラウザ）", "ログインが通り、コードは AI の会話にも記録にも出ない", "D-117.3"),
      ("覚えておく", "通したログインの状態を本人の PC に残し、毎回は聞かない", "一度通したサービス", "もう一度ログインする", "コードを聞かれない（サービスが求めたときだけ聞く）", "D-117.4"),
      ("返事が無い", "10 分返事が無ければ、その仕事は理由つきで止め、次に本人がいる時間に回す", "コードを頼んだまま 10 分", "待つ", "仕事が理由つきで止まり、何度も試さない", "D-117.5")],
     "D-117.2", ["D-117.3", "D-117.4", "D-117.5", "D-017.2", "D-017.4"], True),
    ("T-B-40", "会話の画面を詰める・広げる（見出しと説明を 1 行に・入力欄を低く・「会話を広げる」で会話だけ・Esc で戻る・測り直しても読んでいる位置を動かさない）", 3, ["T-B-16"],
     ["apps/web/components/wizard/wizard-layout.tsx", "apps/web/components/ai/frame.tsx", "06_mockup/_chat.py", "apps/web/tests/screens/chat-frame.spec.ts"],
     ["A06", "A07"], ["onboard-interview", "onboard-draft"], [], "画面の部品。外界に出ない", _spc,
     [("詰める", "画面が低くても、見出しと説明は 1 行に詰まり、会話に高さが渡る。「Shift+Enter」の行は書いている間だけ出る", "長い会話（1512×640）", "開く・入力欄に入る・1 文字書く・空のまま許可のしかたを押す（実ブラウザ）", "会話が 260px 以上（詰める前は 179px）。見出しと説明が同じ行。案内は書いている間だけ出る。入力欄に入っただけでは形が変わらず、下のボタンを押し損ねない", "D-118.1"),
      ("広げる", "「会話を広げる」で段の帯・説明・分かったことを閉じて会話だけになり、「元に戻す」か Esc で戻る。広げても読んでいた所のまま", "長い会話", "広げる → Esc → 広げる → 元に戻す（実ブラウザ）", "縦にも横にも広がり、いちばん下のまま。ページは動かない。戻すと元の形", "D-118.3")],
     "D-118.1", ["D-118.2", "D-118.3", "D-118.4", "D-072.19"], False),
]
for _tid, _title, _h, _dep, _files, _acts, _scr, _ch, _chr, _spf, _qs, _src, _more, _crit in EXTRA_CHAT:
    _rows = [qrow(_spf, _tid.replace("T-B-", "CHT-"), _scr[0], _v, _it, _pre_, _st, _ex, _s2, _tid) for _v, _it, _pre_, _st, _ex, _s2 in _qs]
    newtask(_tid, _title, "B", "backend", "3_backend", "api", [], category="backend", hours=_h, critical=_crit, acts=_acts, screen_ids=_scr, depends_on=_dep, choke_points=_ch, choke_rationale=_chr,
            fcp={"new": _files, "modify": [], "shared_read": ["03_architecture/アーキテクチャ設計書.md", "03_architecture/ER図.md", "06_mockup/v1/v1-clone-chat.html"], "forbidden": []}, files_changed=[f"{x} (new)" for x in _files],
            ac={"structural": [f"UBIQUITOUS: {_title[:40]} の成果物があり、type-check と build が通る"],
                "functional": [f"EVENT-DRIVEN: WHEN {_qs[1][3]}、システムは {_qs[1][4]}", f"UNWANTED: IF {_qs[-1][2]}、システムは {_qs[-1][4]}"], "regression": REG_BASE},
            spec_links=[f"01_hearing/決定ログ_進行中.md#{_src[2:5].lstrip('0')}", "03_architecture/アーキテクチャ設計書.md", "06_mockup/v1/v1-clone-chat.html"], qa_rows={"l1": _rows, "l2_flows": []},
            scenarios=[{"name": _title[:40], "steps": [q[3] for q in _qs], "expected": _qs[1][4]}], source=[_src] + _more, why=f"{_src[:5]} で決めたことを日程に載せる（決めたのに日程に無い、を作らない）")

# T-US-08：会話の部品の作り込み（D-104）。部品は 1 つ（AgentChat）で 5 か所に効く。書式の描画・作業の行・問い合わせ・許可・入力欄・一覧の印・知らせ・読み上げ
_sp8 = f"{SPEC}/visual-fidelity-audit.md"; _pre8 = "USH-08"; _tid8 = "T-US-08"
_q8 = [("吹き出し", "両方吹き出し。自分は淡い灰、AI は白い面＋罫線。AI の表・図・コード・カードだけ会話の幅いっぱい。名前の横はアイコンと名前", "会話を開く", "モックと並べる（実ブラウザ）", "design_gate の D1〜D4 が赤を増やさず、見た目がモックと一致", "D-104.2"),
       ("書式", "見出し・太字・表（横に動く・コピー）・引用・注意の帯・文中のコード・チェックリスト・数式（MathML）・折りたたみ・蛍光ペン・キー表示・目次・出典の番号・案のタブ・Kaname 内のリンク", "書式を全部含む返事", "描画する（実ブラウザ）", "全部がモックどおり。数式で書体が増えない", "D-104.3"),
       ("図とカード", "状態・人・日付の印・大きな数字・コードの枠（色分け・コピー・畳む）・流れ図・進み具合・予定・並べ替えできる表・目標／タスク／人／AI社員／承認待ちのカード（実物を読み押すと開く）", "カードと図を含む返事", "押す（実ブラウザ）", "カードはその画面が開き、承認待ちはその場で承認できる", "D-104.4"),
       ("資料", "資料のカード・横で開く成果物（直す・版を戻す）・PDF・表計算・画像・動画と音声・地図・リンクのプレビュー・調べた結果・差分・コマンド・フォルダの木・画面の写真", "資料を含む返事", "横で開いて直す（実ブラウザ）", "成果物の版が増え、戻せる", "D-104.5"),
       ("入力欄", "大きな箱。文脈のチップ（× で外す）・添付の一覧・＋・マイク・モデル・使うもの・許可のモード・送る（動いている間は止める）。Shift+Enter で改行・それ以外の Enter で送る。変換を確定する Enter では送らない（Safari の compositionend の直後も）", "会話を開く", "日本語を変換して Enter（Chrome と Safari）", "送られない。確定後の Enter で送られる", "D-104.10"),
       ("入力欄", "書きかけは会話ごとに残り、空の入力欄で ↑ は前に送った文。長すぎると残りの字数が出る", "書きかけ", "別の画面へ移って戻る", "書きかけが残る", "D-104.10"),
       ("声", "マイクで話すと文字になり、直してから送れる（ブラウザの音声認識で日本語が使えるかを先に確かめ、使えない所ではマイクを出さない）", "Chrome", "マイク → 話す → 止める", "入力欄に文字が入る", "D-104.10"),
       ("@", "@ を打つと目標・タスク・人・AI社員・記憶の候補が出て、選ぶと文脈のチップになる", "会話を開く", "@ → 候補を選ぶ", "チップが付き、指示に添えられる", "D-104.10"),
       ("文脈", "今の画面と選んでいる 1 件がチップで見え、外すと自分のAI に渡らない。画面ごとの「よく頼むこと」を押すとそのまま送る", "目標の画面の右パネル", "チップを外して言う", "指示に画面の前置きが付かない", "D-104.12"),
       ("操作", "コピー・直して送り直す（その時点から新しいセッション）・タスクにする・一部を選んで引用して続ける・書き出す（成果物へ）", "返事がある", "それぞれ押す（実ブラウザ）", "コピーされる／新しいセッションで続く／タスクができる／引用付きで入力欄へ／成果物に入る", "D-104.17"),
       ("画面の動き", "上を読んでいる間は勝手に下へ飛ばず「いちばん下へ」が出る。長い会話は上へ戻ると古い分を読み込む。見ていない間の返事に印と件数", "長い会話", "上へ戻る → 新しい返事", "位置が動かず「いちばん下へ」と件数", "D-104.18"),
       ("知らせ", "「終わった」と「許可が要る」をブラウザに知らせる（2 種類を別々にオン・オフ）。その会話を見ている間は出さない", "通知を許可したブラウザ", "別のタブで作業を終わらせる", "通知が 1 つ出る。会話を見ている間は出ない", "D-104.19"),
       ("読み上げとキーボード", "会話は role=log と名前、動いている間は aria-busy、状態の変化は status で伝える。キーボードだけで全部押せる", "読み上げソフト", "Tab だけで会話を操作する", "全部の操作要素に届き、状態の変化が読まれる", "D-104.20"),
       ("最初", "まだ何も話していない会話はあいさつだけ", "新しい会話", "開く", "あいさつだけが出る", "D-104.2"),
       # 2026-09-30 user「モデル単位になっている？？ 見比べてみろや」：Claude のデスクトップと同じ並びと形
       ("モデルと強さ", "許可のモードは左、モデルと考える強さは右に別々の小さなボタン。モデルは版まで入った名前を 1 行ずつ（PC の設定／Opus 5.5／Fable 5.1／Sonnet 5.5／Haiku 4.5）で、選んでいるものにチェック・ほかは数字（数字のキーでも選べる）。強さは 既定／低／中／高／最高／最大", "Bridge をつないだ", "モデルの箱で Sonnet 5.5 を選ぶ・数字のキーで選ぶ・強さで 高 を選ぶ → 送る（実ブラウザ）", "ボタンに Sonnet 5.5 と 高 が出て、CLI の起動に --model claude-sonnet-5-5 --effort high が渡る", "D-104.10"),
       # 2026-10-01 user「パネルの中に入っている」：押して開く箱が一覧や右パネルの枠に切られていた
       ("押して開く箱", "会話の一覧の「…」の箱と、入力欄の選ぶ箱（モデル・考える強さ・許可のモード・@）は、一覧や右パネルの枠に切られず全部見えて、そのまま押せる", "会話が 1 つだけ（一覧の最後の行の「…」）・右パネルの狭い入力欄", "「…」を押す／選ぶ箱を開く（スクロールしない・実ブラウザ）", "箱の項目がすべて画面の中にあり、その位置でいちばん上にあるのが項目そのもの（枠に切られていない）", "D-104.10")]
_rows8 = [qrow(_sp8, _pre8, "共通:会話", v, it, pr, st, ex, s2, _tid8) for v, it, pr, st, ex, s2 in _q8] + [handoff_row(_sp8, _pre8, "共通", _tid8)]
newtask(_tid8, "会話の部品の作り込み（D-104：吹き出し・書式と図とカードと資料の描画・作業の行・問い合わせ・許可の 3 択・入力欄の箱・声・@・文脈・返事への操作・画面の動き・知らせ・読み上げ）", "U-shared", "ui", "4_ui_foundation", "ui", [], category="frontend", hours=40, critical=True,
        depends_on=["T-US-02", "T-B-16"], choke_points=[], choke_rationale="画面の部品。外界に出ない（API は関門の先）", acts=["A20", "A88", "A89", "A90", "A91"], screen_ids=["clone-chat", "onboard-interview", "onboard-draft", "clone-thread"],
        fcp={"new": ["apps/web/components/ai/markdown.tsx", "apps/web/components/ai/work.tsx", "apps/web/components/ai/question.tsx", "apps/web/components/ai/composer.tsx"], "modify": ["apps/web/components/ai/conversation.tsx", "apps/web/components/ai/agent-chat.tsx", "apps/web/components/ai/parts.tsx", "apps/web/lib/agent.ts", "apps/web/styles/tokens.css"], "shared_read": ["04_design/DESIGN-kaname.md", "06_mockup/_chat.py", "06_mockup/_composer.py"], "forbidden": []},
        files_changed=["apps/web/components/ai/markdown.tsx (new)", "apps/web/components/ai/work.tsx (new)", "apps/web/components/ai/question.tsx (new)", "apps/web/components/ai/composer.tsx (new)", "apps/web/components/ai/conversation.tsx (modify)"],
        ac={"structural": ["STATE-DRIVEN: WHILE 会話を描画中 THEN 部品は AgentChat 1 つ（chat_one）で、色・文字・角丸は DESIGN-kaname.md の段だけ（design_gate が赤を増やさない）"],
            "functional": ["EVENT-DRIVEN: WHEN 日本語を変換して Enter THEN 送らない（Safari も）", "UNWANTED: IF 上を読んでいる間に返事が来たら THEN 下へ飛ばず「いちばん下へ」を出す"], "regression": REG_UI},
        spec_links=["01_hearing/決定ログ_進行中.md#104", "04_design/DESIGN-kaname.md", "06_mockup/v1/v1-clone-chat.html", "04_design/チャット調査_2026-09-27.md"], qa_rows={"l1": _rows8, "l2_flows": []},
        scenarios=[{"name": "書式の見本を全部描く", "steps": ["書式を全部含む返事を描画"], "expected": "モックどおり"}], source=["D-104.2", "D-104.3", "D-104.4", "D-104.5", "D-104.6", "D-104.10", "D-104.12", "D-104.13", "D-104.17", "D-104.18", "D-104.19", "D-104.20"],
        why="D-104 の見た目と操作を会話の部品 1 つに入れる（5 か所に同時に効く）")

# ---------------------------------------------------------------- はじめの設定の 5・6 を通す基準（D-116.4・D-116.5）← 2026-09-29
# 画面のタスク（テスト・本番へ）の受け入れ基準に、段を通す条件を足す。5・6 は AI社員を動かす仕組み（実行ループの結線）が要る
_SETUP_PASS = {
    "onboard-testrun": ("D-116.4", "EVENT-DRIVEN: WHEN AI社員を全員 1 回ずつテストモードで動かし、出てきたものを見て「本番に切り替える」を押したとき THEN 段 5 を通したと記録する。まだ試していない AI社員・止まったまま（CAPTCHA 等）の AI社員がいる間は押せない"),
    "onboard-golive": ("D-116.5", "EVENT-DRIVEN: WHEN 切り替える前の確認に赤が無い状態で「切り替える」を押したとき THEN 段 6 を通したと記録し、翌朝から動く。赤が 1 件でもあれば押せない（黄は理由を見て承知すれば押せる）"),
}
for _t in tasks:
    for _sid, (_src, _ac) in _SETUP_PASS.items():
        if _t["group"] == "U-screen" and _sid in _t.get("screen_ids", []):
            _t["acceptance_criteria"]["functional"].append(_ac)
            _t["source"] = sorted(set(_t.get("source", []) + [_src, "D-116.6"]))

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
# 流れの行も ID を変えない・結果を消さない（test-ladder §9）。再生成しても status／result／note／task（apps/e2e が書いた実走の結果）は残す。2026-09-16 に消えて W3 の回帰が赤になった
_prev_j = {r["id"]: r for r in (json.load(open(f"{SPEC}/journeys/plan.json", encoding="utf-8"))["rows"] if os.path.exists(f"{SPEC}/journeys/plan.json") else [])}
for r in jrows:
    for k in ("status", "result", "note", "task"):
        if k in _prev_j.get(r["id"], {}) and k not in r: r[k] = _prev_j[r["id"]][k]
json.dump({"version": "v3.2", "created_at": TODAY, "_doc": "背骨のフェーズ → 流れ（J-xx）。runnable_after は揃うべきタスク。05_flow/build_tasks.py が生成。status／result は apps/e2e の実走が書く（再生成で消えない）", "rows": jrows}, open(f"{SPEC}/journeys/plan.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
# ---------------------------------------------------------------- Wave（依存順・CAP）
order = ["F", "D", "V2", "A", "B", "U-shared", "U-screen", "I", "S"]; w = 0; waves = []   # B＝Bridge（顧客 PC の実行器）。API の後・画面の前（画面が「つないだ」前提で書かれている）; w = 0; waves = []
for stage, g in [(st, g) for st in ("v1", "v2") for g in order]:   # 段階 1 の全 Wave の後に段階 2（A → U-screen）
    fs = [t for t in tasks if t["group"] == g and t.get("stage", "v1") == stage]
    # 同じ Group の中の依存（T-US-00 → T-US-01…）は前の Wave に置く：依存の深さで層に分けてから CAP で割る（同じ Wave の中に依存を作らない）
    byid = {t["id"]: t for t in fs}
    def depth(t):
        ds = [d for d in t.get("depends_on", []) if d in byid and d != t["id"]]
        return 0 if not ds else 1 + max(depth(byid[d]) for d in ds)
    layers = {}
    for t in fs: layers.setdefault(depth(t), []).append(t)
    for ch in [lf[i:i+CAP] for _, lf in sorted(layers.items()) for i in range(0, len(lf), CAP)]:
        waves.append({"wave": w, "group": g, "stage": stage, "tasks": [t["id"] for t in ch], "parallel": len(ch), "wall_clock_h_ai": round(max(t["wall_clock_h_ai"] for t in ch) + 0.5, 1), "estimate_hours_human": sum(t["estimate_hours_human"] for t in ch), "estimate_hours_ai_compute": round(sum(t["estimate_hours_ai"] for t in ch), 1)})
        for t in ch: t["wave"] = w
        w += 1
# ---------------------------------------------------------------- 正本（11 列）を書く
# 正本の全ファイルの結果（行 ID → 結果・備考）。行が別のファイルに移っても消さない（test-ladder §9「ID は変えない」）
# ★さらに、生成器が作らなくなった行も捨てない。捨てると「流した人が書いた実ブラウザの証拠」が黙って消える。
#   2026-09-25 実測：1 回の再生成で 33 行（うち結果つき 12 行）が消えていた（Atelier からの共有 §3 と同型）
PREV_RESULTS, PREV_ROWS = {}, {}
for _fp in glob.glob(f"{SPEC}/**/*.md", recursive=True):
    for _ln in open(_fp, encoding="utf-8"):
        if _ln.startswith("| ") and not _ln.startswith("| ID "):
            _c = [x.strip() for x in _ln.strip().strip("|").split("|")]
            if len(_c) >= 11:
                PREV_ROWS[_c[0]] = (_fp, _c[:11])
                if _c[7]: PREV_RESULTS[_c[0]] = (_c[7], _c[8])
HDR = "| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |\n|---|---|---|---|---|---|---|---|---|---|---|\n"
# 今回の生成で作られた行 ID（ファイルをまたいで集める。行が別ファイルへ移っただけなら「消えた」ではない）
GEN_IDS = {r[0] for _fp, _rows in qa_files.items() if not _fp.endswith("plan.json") for r in _rows}
for fp, rows in qa_files.items():
    if fp.endswith("plan.json"): continue
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    title = os.path.basename(fp).replace(".md", "")
    # 正本の行は ID を変えない・作り直さない（test-ladder §9）。再生成しても「結果」列（実装者が staging で書いた PASS／BLOCKED）は残す
    prev_res = dict(PREV_RESULTS)   # 行が別のファイルへ移っても結果を引き継ぐ（画面の割り当てが変わると消えていた）
    if os.path.exists(fp):
        for ln in open(fp, encoding="utf-8"):
            if ln.startswith("| ") and not ln.startswith("| ID "):
                cells = [c.strip() for c in ln.strip().strip("|").split("|")]
                if len(cells) >= 11 and cells[7]: prev_res[cells[0]] = (cells[7], cells[8])   # 結果と備考（BLOCKED の理由は備考にある・qa-ladder が見る）
    rows = [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7] or prev_res.get(r[0], ("", ""))[0], r[8] or (prev_res.get(r[0], ("", ""))[1] if not r[7] else r[8]), r[9], r[10]) for r in rows]
    # 生成器が作らなくなった行を、そのファイルに残す（結果ごと）。消したいなら備考に理由を書いて人が消す
    gone = [c for i, (pf, c) in PREV_ROWS.items() if pf == fp and i not in GEN_IDS]
    # 今の画面に無い行は、今の行と混ぜず末尾の別の表に置く（2026-10-01 user「現時点での全てのやつにして」。ID と結果は残す＝同じ ID を二度使わない）
    old_rows = []
    for c in gone:
        note = c[8] if "生成元から消えた" in c[8] else (c[8] + ("／" if c[8] else "") + f"削除（生成元から消えた・{TODAY}。結果は残す）")
        old_rows.append(tuple(c[:8]) + (note,) + tuple(c[9:11]))
    kept = sum(1 for r in rows if r[7])
    line = lambda r: "| " + " | ".join(str(c).replace("|", "／") for c in r) + " |\n"
    body = f"# {title} テスト仕様（L1・機械生成）\n\n> 05_flow/build_tasks.py がタスクと同時に生成。ID は変えない。途中変更は qa_delta.py で差分。結果列は staging で流した人が書く（再生成しても残る。今の行 {len(rows)}・結果あり {kept} 行）。\n\n" + HDR + "".join(line(r) for r in rows)
    if old_rows:
        body += f"\n## もう無い行（{len(old_rows)} 行）\n\n> モックや決定が変わって今の画面には無くなった行。ID と当時の結果を残すためだけに置く（同じ ID を二度使わない）。確かめる対象ではない。\n\n" + HDR + "".join(line(r) for r in old_rows)
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
