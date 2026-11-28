#!/usr/bin/env python3
"""cut_m1.py — 節目①のまとまり（KN-8〜KN-17）を 1 作業のチケットに切る（2026-11-03 高本さん：節目ごとに一気に切ってから作る）。
   ・API は下の PLAN に 1 本ずつ書く（どのチケットが作るか）。節目①の画面の API は全部、ちょうど 1 枚の 1 作業のチケットに入る
   ・共有の画面（tickets など）の API のうち、節目②・③で作るものは、そのまとまりの apis に明示する（EXPLICIT）
   ・各チケットのテスト仕様の行は、API ごとの生成の試験（apps/api/test/generated）・場合表（G33）・契約 fuzz（G36）・画面の仕様書と実ブラウザ（G28）を指す
   決定（decisions）は、その API の根拠（endpoints.json の source）と、まとまりの決定の和
使い方: python3 scripts/tickets/cut_m1.py [--write]   （--write が無ければ一覧だけ出す）
"""
import json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding="utf-8"))
E = {e["operation_id"]: e for e in J("08_api/endpoints.json")["endpoints"]}
M = J("07_qa/test-plan/ears-test-mapping.json")["mappings"]
LOG = open(os.path.join(ROOT, "01_hearing/決定ログ_進行中.md"), encoding="utf-8").read()
DUE = "2026-11-20"

# まとまり → [(題, 区画, API の一覧, 画面の一覧, 目的)]
PLAN = {
    "KN-8": [
        ("登録とメールの確認の口", "API", ["createSignup", "resendSignupEmail", "getSignupStatus", "getCurrentTerms", "verifySignup", "consentToTerms"], [],
         "登録（保留の申し込み）・確認のメール・確認・規約の同意を契約の口で作る（今の /api/auth-ext の登録の道すじを移す・K-21 と一緒に）。"),
        ("ログインと 2 段階のコードの口", "API", ["signInWithPassword", "signOut", "verifySignInCode", "getServiceStatus", "requestAdminRecovery"], [],
         "パスワード＋2 段階のコードのログイン・ログアウト・止まっているときの知らせ・管理者に戻してもらう申し出を契約の口で作る。"),
        ("パスワードの再設定の口", "API", ["requestPasswordReset", "resetPassword"], [],
         "メールで届くリンクから新しいパスワードを決め、済んだら全部の端末と Bridge を切る。"),
        ("安全の設定の口（パスキー・2 段階・パスワード・端末）", "API", ["getMySecurity", "renamePasskey", "deletePasskey", "changePassword", "listMySessions", "revokeMySession", "revokeOtherSessions", "startTwoFactor", "confirmTwoFactor", "disableTwoFactor", "regenerateBackupCodes"], [],
         "自分のパスキー・2 段階・予備のコード・パスワード・ログインしている端末を見て直せる口を作る。"),
        ("画面：登録・メールの確認・ログイン・パスワードの再設定", "画面", [], ["signup", "verify-email", "login", "password-reset"],
         "キャンバスの土台（K-22）の上に、登録からログインまでの 4 つの画面を作る。"),
        ("画面：安全の設定", "画面", [], ["mfa-setup"],
         "パスキー・2 段階・予備のコード・端末の一覧の画面を作る（本人確認の取り直しのパスキーもここで・K-19 の申し送り）。"),
    ],
    "KN-9": [
        ("自分の設定の口", "API", ["getMe", "updateMe", "uploadAvatar", "requestEmailChange", "verifyEmailChange", "getNotificationSettings", "updateNotificationSettings", "copyNotificationSettings", "listSetupTasks", "dismissSetupTasks", "getMyUsage", "leaveWorkspace"], [],
         "名前・顔・メールの変更・知らせの設定・はじめにやること・使用量・ワークスペースを抜ける、の口を作る。"),
        ("PC（Bridge）をつなぐ口", "API", ["createPairingCode", "claimPairingCode", "listMyDevices", "updateMyDevice", "revokeMyDevice", "sendHeartbeat", "getLatestBridgeRelease", "downloadBridgeRelease", "reportUsage"], [],
         "つなぐ番号・つないだ端末の一覧と外す・生存の知らせ・配布物・使用量の報告を契約の口で作る（今の /api/auth-ext/bridge の道すじを移す・K-21 と一緒に）。"),
        ("預けたログイン情報の口", "API", ["listCredentials", "createCredential", "updateCredential", "deleteCredential", "checkCredentialLogin", "answerCredentialLoginCheck", "resolveCredential", "reportCredentialCheck"], [],
         "ログイン情報を預ける・確かめる・PC の実行器だけが宛先の合うときに取り出す（D-128.57 の 4 つの守り）口を作る。"),
        ("画面：自分の設定", "画面", [], ["account"], "自分の設定（プロフィール・ログインと安全・端末・所属するワークスペース）の画面を作る。"),
        ("画面：PC をつなぐ", "画面", [], ["bridge-setup"], "PC をつなぐ画面（番号・つながった・切れている間の案内）を作る。"),
        ("画面：預けたログイン情報", "画面", [], ["credentials"], "預けたログイン情報の画面を作る。"),
    ],
    "KN-10": [
        ("一覧と絞り込みの口", "API", ["getShell", "listTickets", "bulkUpdateTickets", "getScopeOverview", "listTicketKinds", "listTicketStages", "listClassAxes", "listMembers"], [],
         "チケットの一覧（表示の切り替え・絞り込み・列・まとめて直す）と、左のバー・上の帯の中身、選ぶための一覧を作る。"),
        ("探すと保存した検索条件の口", "API", ["search", "listSavedViews", "createSavedView", "updateSavedView", "deleteSavedView"], [],
         "探す（チケット・ページ・決定・自分の会話）と、保存した検索条件（作った人とマネージャーが直せる・D-128.119）を作る。"),
        ("CSV の取り込みの口", "API", ["createTicketImport", "getTicketImport", "commitTicketImport"], [],
         "Backlog と汎用の CSV を取り込み、下書きを確定するまで取り込んだ人だけが見て直せる（D-128.119）口を作る。"),
        ("知らせの口", "API", ["listNotifications", "readNotification", "readAllNotifications"], [],
         "上の帯の知らせ（一覧・読んだ・全部読んだ）を作る。新しい端末の知らせ（K-20）もここに出る。"),
        ("画面：チケットの一覧・探す・取り込み", "画面", [], ["tickets"], "チケットの一覧の画面（表示の切り替え・絞り込み・保存した検索条件・CSV の取り込み）を作る。"),
    ],
    "KN-11": [
        ("チケットを作る・読む・直す・消す／戻す・完了の口", "API", ["createTicket", "getTicket", "updateTicket", "previewTicketKindChange", "previewTicketDelete", "deleteTicket", "restoreTicket", "completeTicket", "listWorkTypeCandidates"], [],
         "チケットの 1 件の作る・読む・直す（期限と担当は理由が必須）・種別を変える前の確かめ・消す（子の扱い）・戻す・完了、を作る。"),
        ("本文の区画と版・資料の口", "API", ["updateTicketSection", "listTicketVersions", "restoreTicketVersion", "listTicketReferences", "listTicketArtifacts", "getArtifactVersion", "createTicketAttachment"], [],
         "本文の区画を直して版を残す・前の版に戻す・参照・作ったもの・資料を付ける、を作る。"),
        ("テスト仕様と確認の口", "API", ["listTestSpecs", "createTestSpec", "updateTestSpec", "deleteTestSpec", "lintTestSpecs", "suggestTestSpecs", "listChecks", "markHumanCheck"], [],
         "チケットのテスト仕様（① 機械・② 半分・③ 人）と確認の結果、人の確認の印を作る。"),
        ("決定・つながり・やり取りの口", "API", ["listTicketDecisions", "createTicketDecision", "updateTicketDecision", "listTicketLinks", "createTicketLink", "deleteTicketLink", "listTicketTimeline", "createTicketMessage", "updateTicketMessage", "deleteTicketMessage", "starTicketMessage"], [],
         "チケットの決定ログ・ほかのチケットとのつながり・やり取り（星を付ける）を作る。"),
        ("画面：チケットの 1 件", "画面", [], ["tickets"], "チケットの 1 件の画面（本文と版・テスト仕様と確認・つながり・完了・消す／戻す）を作る。"),
    ],
    "KN-12": [
        ("分身と作業する口", "API", ["getTicketAgentSession", "sendTicketAgentMessage", "applyTicketAgentProposal"], [],
         "右のパネルで分身と話し、差分の案を本文に反映する口を作る（分身は呼んだ人の権限の中で動く）。"),
        ("画面：右のパネルで分身と作業する", "画面", [], ["tickets"], "右のパネルの会話・差分を本文に出す・反映する・確認をやり直す、を作る。"),
    ],
    "KN-13": [
        ("承認の 1 件の口", "API", ["getApproval", "approveApproval", "editApproval", "returnApproval", "stopApproval", "withdrawApproval"], [],
         "承認する（取り消せない操作は直前の本人確認）・直して承認・理由つきで戻す・止める・取り下げる、を作る。"),
        ("承認待ちの一覧とまとめて承認の口", "API", ["listApprovalQueue", "listApprovalHistory", "previewBulkApproval", "bulkApprove"], [],
         "承認待ち・済んだものの一覧と、条件（D-128.86）に合うものだけまとめて承認、を作る。"),
        ("画面：承認待ち", "画面", [], ["approvals"], "承認待ちの画面を作る。"),
    ],
    "KN-14": [
        ("会話の口", "API", ["listConversations", "createConversation", "getConversation", "updateConversation", "deleteConversation", "listConversationMessages", "sendConversationMessage", "answerAgentPermission", "stopConversation", "createConversationAttachment"], [],
         "分身との会話（分ける・名前・星・記憶に残さない・消す・書きながらの返事・許可の 3 択・止める・資料）を契約の口で作る（今の /api/auth-ext/agent の道すじを移す・K-21 と一緒に）。"),
        ("知っていること（記憶と覚えたいこと）の口", "API", ["getMyClone", "updateMyClone", "countKnows", "listMemories", "createMemory", "updateMemory", "deleteMemory", "promoteMemoryToRule", "listLearningCandidates", "acceptLearningCandidate", "dismissLearningCandidate", "postponeLearningCandidate", "requestRuleException"], [],
         "分身の設定・記憶・覚えたいことの候補（受ける・外す・あとで・決まりの例外を頼む）を作る。"),
        ("作ったものの口", "API", ["createArtifactFromMessage", "updateArtifact", "restoreArtifactVersion"], [],
         "会話から作ったもの（文書・表など）と、その版を作る。"),
        ("やったことの口", "API", ["listCloneActivity", "exportCloneActivity", "getCloneGrowth", "getCloneNow"], [],
         "分身がやったこと・いまやっていること・育ち・書き出しを作る。"),
        ("画面：分身の部屋（会話と知っていること）", "画面", [], ["clone-chat"], "分身の部屋の会話と知っていることの画面を作る。"),
        ("画面：分身の部屋（やったこと）", "画面", [], ["ai-activity"], "分身の部屋のやったことの画面を作る。"),
    ],
    "KN-15": [
        ("PC が仕事を受けて返す口", "API", ["takeBridgeJob", "getJobControl", "reportJobProgress", "reportBrowserState", "askFromBridge", "getBridgeQuestionAnswer", "callKanameTool", "putArtifactFromBridge", "mirrorConversationEntries", "finishBridgeJob", "getFileForBridge"], [],
         "PC の Bridge が、渡された仕事だけを受け、進み具合・質問・道具・作ったもの・終わりを返す口を作る（口は全部 /bridge/ の下・ZT10）。"),
        ("実行の 1 件・任せる・試す・止める・やり直す・引き取るの口", "API", ["getActionRun", "listTicketRuns", "delegateTicket", "dryRunTicket", "stopActionRun", "retryActionRun", "takeoverActionRun"], [],
         "チケットを分身に任せる・宛先を自分にして試す・実行の 1 件・止める・やり直す・自分でやるに切り替える、を作る。"),
        ("承認から実行・外に出すまで（実行待ちは 24 時間で聞き直す）", "流れ", [], [],
         "承認したものを PC の分身が実行し、関門（外に出す・通知・ファイル）を通って外に出す。PC が切れていたら実行待ちにして 24 時間で聞き直す。"),
    ],
    "KN-16": [
        ("運営の業務の型を配る口", "API", ["listOpsWorkTypes", "getOpsWorkType", "uploadWorkTypePackage", "getWorkTypeUpload", "releaseOpsWorkType", "rollbackOpsWorkType"], [],
         "運営が全社向けの業務の型を上げ、確かめて配り、戻せる口を作る（節目①は運営の全社向けだけ）。"),
        ("運営のテンプレートと運営の操作の記録の口", "API", ["listOpsTemplates", "getOpsTemplate", "releaseOpsTemplate", "listOperations"], [],
         "チケットの形などのテンプレートを配る口と、運営がしたことの一覧を作る。"),
        ("画面：運営の配るもの", "画面", [], ["ops-skills"], "運営の配るもの（業務の型・テンプレート）の画面を作る。"),
    ],
    "KN-17": [
        ("題材：応募文", "流れ", [], [], "応募文をチケットから作り、確かめ、承認して外に出すまでを通す。"),
        ("題材：見積", "流れ", [], [], "見積をチケットから作り、確かめ、承認して外に出すまでを通す。"),
        ("題材：請求書", "流れ", [], [], "請求書をチケットから作り、確かめ、承認して外に出すまでを通す。"),
        ("題材：問い合わせの返信", "流れ", [], [], "問い合わせへの返信をチケットから作り、確かめ、承認して外に出すまでを通す。"),
        ("題材：メール", "流れ", [], [], "メールをチケットから作り、確かめ、承認して送るまでを通す。"),
    ],
}
# 共有の画面にあるが、節目②・③（か作り済み）のまとまりで作る API。まとまりの apis に明示する
EXPLICIT = {
    "KN-22": ["createTicketHandover", "answerTicketHandover", "listHandoverRules"],
    "KN-20": ["makeKindTemplateFromTicket"],
    "KN-27": ["requestAcceptance", "updateTicketClientShare"],
    "KN-26": ["listClients"],
    "KN-30": ["listOpsPlans", "listPlanHistory", "listPlanProposals", "createPlanProposal", "updatePlanProposal", "getPlanProposalImpact", "submitPlanProposal", "decidePlanProposal", "returnPlanProposal"],
    "KN-19": ["resetMemberTwoFactor"],
    "K-19": ["stepUp"],
    "KN-21": ["listRules", "createRule", "checkRule"],   # 最初に作るのはルールの画面（節目②）。取引先（節目③）・決まり（節目②）は同じ口を使う
}
FLOW_CHOKE = {"承認から実行・外に出すまで（実行待ちは 24 時間で聞き直す）": ["C1", "C2", "C5", "C6"]}
TOPIC_CHOKE = ["C1", "C2", "C3", "C5", "C6"]


def known(d):
    return f"| {d} |" in LOG or re.search(rf"decision: {re.escape(d)}\b", LOG)


def tests_of(op):
    e = E[op]
    key = f"{e['method']} {e['path']}"
    rows = [m for m in M if m["endpoint"] == key]
    return (rows[0]["test_file"] if rows else None), len(rows)


def ticket_md(tid, parent, title, area, apis, screens, goal, decs, depends):
    chokes = sorted({c for o in apis for c in E[o]["choke_points"]}) if apis else (FLOW_CHOKE.get(title) or (TOPIC_CHOKE if title.startswith("題材") else ["C2"]))
    if area == "画面" and not apis:
        chokes = ["C2"]
    done, steps, tests = [], [], []
    if area == "API":
        done = ["- [ ] 契約の口が hooks（apps/api/src/hooks）か共通の処理で動き、まだの口の 501 で止まらない",
                "- [ ] 口ごとの生成の試験（apps/api/test/generated）の it.todo が全部本物の試験になって緑",
                "- [ ] 行の守り（RLS の場合表・G33）と権限の試験（G41）が、この口の分も緑",
                "- [ ] 契約 fuzz（G36）が、この口を回して緑",
                "- [ ] CI が緑"]
        steps = ["- [ ] " + o + "（" + E[o]["method"] + " " + E[o]["path"] + "）" for o in apis]
        for o in apis:
            f, n = tests_of(o)
            tests.append(f"| {o} の振る舞い（EARS {n} 本：2xx・401・403・404・422・429・形） | ① 機械 | `{f}` | |")
        tests.append("| 行の守り（他の会社・範囲の外の行が取れない） | ① 機械 | `pnpm ci:access-matrix`（G33） | |")
        tests.append("| 契約の外の入力でも 500 を返さない・答えの形が契約どおり | ① 機械 | `pnpm ci:schemathesis`（G36） | |")
    elif area == "画面":
        done = ["- [ ] 画面がキャンバス（04_design/canvas）と DESIGN-kaname.md のとおり（部品は画面の土台 K-22 のもの）",
                "- [ ] 画面の仕様書（07_qa/test-specs/screens/<画面>.md）を新しい画面で書き直し、行が全部 PASS",
                "- [ ] 操作要素 1 つ＝1 行の実ブラウザの試験（行 ID を名前に持つ Playwright・G28）が通る",
                "- [ ] 空・読み込み中・失敗・権限が無い の 4 つの状態がある",
                "- [ ] CI が緑"]
        steps = [f"- [ ] 画面 {s}：仕様書を書く → 作る → 実ブラウザの試験" for s in screens]
        for s in screens:
            tests.append(f"| 画面 {s} の仕様書の行 | ① 機械＋③ 人 | `07_qa/test-specs/screens/{s}.md`（新しい画面で書き直す） | |")
            tests.append(f"| 画面 {s} の操作要素を実ブラウザで押した証拠 | ① 機械 | `pnpm ci:op-gate`（G28） | |")
            tests.append(f"| 画面 {s} の見た目がキャンバスと合う | ② 半分 | visual-fidelity（スクリーンショットの比べ） | |")
    else:
        done = ["- [ ] 流れの自動の試験（ステージングで、本物の PC の Bridge か偽の Bridge を通す）が通る",
                "- [ ] 実ブラウザで流れを通した記録がある",
                "- [ ] 外に出すのは承認のあとだけ・関門を通る（迂回 0）",
                "- [ ] CI が緑"]
        steps = ["- [ ] 流れの仕様（07_qa/test-specs/journeys/plan.json に行を足す）", "- [ ] 自動の試験", "- [ ] 実ブラウザで通す"]
        tests = [f"| {title} の流れ | ① 機械 | `apps/e2e/journeys`（plan.json の行） | |",
                 f"| {title} を実ブラウザで通した記録 | ③ 人 | ステージングの記録 | |"]
    fm = ["---", f"id: {tid}", f"title: {title}", "kind: タスク", "stage: 未着手", f"parent: {parent}", "milestone: 節目①",
          f"area: {area}", "assignee: Claude（このセッション）", f"due: {DUE}", f"decisions: [{', '.join(decs)}]", "split: ",
          f"choke_points: [{', '.join(chokes)}]", f"depends_on: [{', '.join(depends)}]"]
    if apis:
        fm.append(f"apis: [{', '.join(apis)}]")
    if screens:
        fm.append(f"screens: [{', '.join(screens)}]")
    fm.append("---")
    body = ["", "## 目的", "", goal, "", "## 完了の条件", "", *done, "", "## 前提と制約", "",
            "- 決定ログで決まっていることは聞かずに進め、ここに「決定に従った」と残す。決まっていないことはまとまりごとにまとめて聞く（D-128.118）",
            "- 権限の言葉・本人確認・行の確かめは入口（K-14・K-15）が見る。hooks の中でも行の守り（RLS）が効く", "",
            "## 実施事項", "", *steps, "", "## テスト仕様と確認の結果", "", "| 確認項目 | 種類 | 判定のしかた | 結果 |", "|---|---|---|---|", *tests, "",
            "## 成果物", "", "", "", "## 決定ログ", "", "- 決定に従った：" + "・".join(decs), "", "## リスクと懸念", "", "", "", "## 申し送り", "", ""]
    return "\n".join(fm + body)


def main():
    write = "--write" in sys.argv
    ids = sorted(int(f[3:-3]) for f in os.listdir(os.path.join(ROOT, "11_tickets")) if re.match(r"KN-\d+\.md$", f))
    nxt = ids[-1] + 1
    seen = {}
    out = []
    for parent, items in PLAN.items():
        pf = os.path.join(ROOT, "11_tickets", f"{parent}.md")
        ptxt = open(pf, encoding="utf-8").read()
        pdec = re.search(r"^decisions: \[(.*)\]$", ptxt, re.M).group(1).split(", ") if re.search(r"^decisions: \[(.+)\]$", ptxt, re.M) else []
        api_ids = []
        for title, area, apis, screens, goal in items:
            for o in apis:
                if o not in E:
                    sys.exit(f"契約に無い API: {o}")
                if o in seen:
                    sys.exit(f"二重に割り当てた API: {o}（{seen[o]} と {title}）")
                seen[o] = title
            decs = []
            for d in pdec + [s for o in apis for s in E[o].get("source", [])]:
                if d and d not in decs and known(d):
                    decs.append(d)
            tid = f"KN-{nxt}"; nxt += 1
            dep = ["K-22"] + api_ids if area == "画面" else (["K-14", "K-15"] if area == "API" else api_ids or ["KN-15"])
            if area == "API":
                api_ids.append(tid)
            out.append((tid, parent, title, area, apis, screens, goal, decs, dep))
    for o, t in [(o, k) for k, v in EXPLICIT.items() for o in v]:
        if o in seen:
            sys.exit(f"二重に割り当てた API: {o}")
        seen[o] = t
    for t in out:
        print(f"{t[0]} ← {t[1]} [{t[3]}] {t[2]}（API {len(t[4])}・画面 {len(t[5])}）")
    print(f"1 作業のチケット {len(out)} 枚・割り当てた API {len(seen)}")
    if not write:
        return
    if "これから" not in open(os.path.join(ROOT, "11_tickets", "KN-8.md"), encoding="utf-8").read():
        sys.exit("もう切ってある（二重に作らない）。足すときは手で 1 枚ずつ")
    for t in out:
        open(os.path.join(ROOT, "11_tickets", f"{t[0]}.md"), "w", encoding="utf-8").write(ticket_md(*t))
    kids = {}
    for t in out:
        kids.setdefault(t[1], []).append(f"{t[0]}（{t[2]}）")
    for parent, ks in kids.items():
        pf = os.path.join(ROOT, "11_tickets", f"{parent}.md"); s = open(pf, encoding="utf-8").read()
        s = re.sub(r"^split: .*$", "split: " + "・".join(k.split("（")[0] for k in ks), s, count=1, flags=re.M)
        s = s.replace("子のチケット（このあと切る）", "子のチケット：\n" + "\n".join(f"- {k}" for k in ks), 1)
        open(pf, "w", encoding="utf-8").write(s)
    for parent, ops in EXPLICIT.items():
        pf = os.path.join(ROOT, "11_tickets", f"{parent}.md"); s = open(pf, encoding="utf-8").read()
        if re.search(r"^apis: ", s, re.M):
            s = re.sub(r"^apis: \[(.*)\]$", lambda m: "apis: [" + ", ".join(dict.fromkeys([x for x in m.group(1).split(", ") if x] + ops)) + "]", s, count=1, flags=re.M)
        else:
            s = s.replace("\n---\n", f"\napis: [{', '.join(ops)}]\n---\n", 1)
        open(pf, "w", encoding="utf-8").write(s)


if __name__ == "__main__":
    main()
