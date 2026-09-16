# -*- coding: utf-8 -*-
"""画面の各状態 → 製品の時点（flow.json の product_states）。無い状態はビルドを止める（L-007）。"""
PS = {
 "signup": {"n":"PS0","e":"PS0"}, "verify-email": {"n":"PS0","ok":"PS0","x":"PS0"},
 "invite-accept": {"n":"PS3","r4":"PS3","x":"PS3"}, "mfa-setup": {"n":"PS0","rc":"PS0"},
 "login": {"n":"PS3","m":"PS3","e":"PS3"}, "password-reset": {"n":"PS3","s":"PS3","p":"PS3"},
 "onboard-interview": {"nb":"PS0","n":"PS1","0":"PS1","f":"PS1"}, "onboard-draft": {"n":"PS2","f":"PS2","e":"PS2"},
 "bridge-setup": {"n":"PS0","ok":"PS1","ng":"PS0","s":"PS3"}, "credentials": {"n":"PS2","a":"PS2","i":"PS2","s":"PS3"},
 "onboard-testrun": {"n":"PS2","0":"PS2","x":"PS2"}, "onboard-golive": {"n":"PS2","ok":"PS3"},
 "today": {"n":"PS3","m":"PS3","v":"PS3","r3":"PS3","e":"PS0","s":"PS4"}, "approvals": {"n":"PS3","r3":"PS3","s":"PS3","e":"PS3"},
 "clone-thread": {"n":"PS3","l":"PS3","a":"PS3"}, "tasks": {"n":"PS3","k":"PS3","c":"PS3","g":"PS3","b":"PS3","a":"PS3","h":"PS3","d":"PS3","p":"PS3","o":"PS3"},
 "clone-chat": {"n":"PS3","c":"PS3","q":"PS3","t":"PS3","f":"PS3","s":"PS3","r":"PS3","x":"PS4","k":"PS3","b":"PS3","0":"PS3"}, "search": {"n":"PS3","0":"PS3"},
 "records": {"k":"PS3","n":"PS3","s":"PS3","r3":"PS3","o":"PS3"}, "record-detail": {"n":"PS3","m":"PS3","r4":"PS3"},
 "ai-activity": {"n":"PS3","one":"PS3"}, "goals": {"n":"PS3","tl":"PS3","u":"PS3","r3":"PS3","s":"PS3"},
 "goal-allocation": {"n":"PS3","m":"PS3","l":"PS3","u":"PS3"}, "goal-edit": {"n":"PS3"}, "my-progress": {"me":"PS3","r3":"PS3","r4":"PS3"},
 "review": {"n":"PS3","q":"PS3","c":"PS3"}, "hypotheses": {"n":"PS3","tl":"PS3","a":"PS3"}, "duties": {"n":"PS3","k":"PS3","t":"PS2","r2":"PS3"},
 "clone-memory": {"n":"PS3","t":"PS3"}, "ledger-def": {"n":"PS3"}, "company-model": {"n":"PS3","v":"PS3","t":"PS3"},
 "automation-repair": {"n":"PS4","d":"PS3","0":"PS3"}, "audit": {"n":"PS3","u":"PS3","x":"PS3","o":"PS3"}, "policies": {"n":"PS3"},
 "members": {"n":"PS3","l":"PS3","p":"PS3","x":"PS3","r":"PS3"}, "member-detail": {"n":"PS3","c":"PS3","o":"PS3"}, "inquiry": {"n":"PS3","t":"PS3","w":"PS3"}, "notices": {"n":"PS3"}, "billing": {"n":"PS3","c":"PS3"}, "account": {"n":"PS3"}, "company-settings": {"n":"PS3"}, "import": {"n":"PS3"}, "services": {"n":"PS3"}, "ops-notices": {"n":"PS3"}, "ops-billing": {"n":"PS3"}, "ops-services": {"n":"PS3"}, "ops-skills": {"n":"PS3","d":"PS3","u":"PS3"}, "ops-tenant": {"n":"PS3"}, "ops-review": {"n":"PS3"}, "ops-audit": {"n":"PS3"}, "ops-home": {"n":"PS3","s":"PS3","p":"PS3"}, "ops-catalog": {"n":"PS3","d":"PS3","r":"PS3","t":"PS3","g":"PS3","p":"PS3"}, "ops-support": {"n":"PS3"}, "ai-staff": {"n":"PS3","a":"PS3"}, "ai-staff-detail": {"n":"PS3","m":"PS3","k":"PS3","x":"PS3"},
 "security-brief": {"n":"PS3"}, "export": {"n":"PS3"}, "billing-setup": {"n":"PS0","ok":"PS0","x":"PS0","i":"PS0"}, "llm-routes": {"n":"PS3","k":"PS3","x":"PS3"}, "app-setup": {"n":"PS3","p":"PS3","x":"PS3"}, "disclosure": {"n":"PS3","v":"PS3","x":"PS3"}, "ops-llm": {"n":"PS3","x":"PS3"}, "ops-disclosure": {"n":"PS3","d":"PS3"}, "account-close": {"d":"PS3","p":"PS3","n":"PS3","x":"PS0"},
}

# 役割ごとの中身が「同じでよい」と決めた画面（G15・role_gate.py）。ここに無い役割は data-roles の塊で出し分ける。
# 宣言は正直に：組織の形や役割で中身が変わる画面（今日・承認待ち・タスク・目標・会社モデル…）は書かない＝赤のまま残す。
ROLE_SAME = {
 "signup": "R1 R2", "verify-email": "R1 R2", "login": "R1 R2 R3 R4", "password-reset": "R1 R2 R3", "mfa-setup": "R1 R2 R3", "invite-accept": "R3 R4",
 "onboard-interview": "R1 R2", "onboard-draft": "R1 R2", "onboard-testrun": "R1 R2", "onboard-golive": "R1 R2",
 "bridge-setup": "R1 R2", "credentials": "R1 R2", "billing-setup": "R1 R2", "llm-routes": "R1 R2", "app-setup": "R1 R2 R3 R4", "disclosure": "R1 R2", "ops-llm": "R6", "ops-disclosure": "R6", "automation-repair": "R1 R2", "audit": "R1 R2", "security-brief": "R1 R2", "export": "R1 R2", "account-close": "R1 R2",
 "ledger-def": "R1 R2", "search": "R1 R2 R3 R4", "member-detail": "R1 R2", "review": "R1 R2", "hypotheses": "R1 R2", "ai-staff": "R1 R2", "ai-staff-detail": "R1 R2",
 "ops-home": "R6", "ops-catalog": "R6", "ops-support": "R6", "ops-tenant": "R6", "ops-review": "R6", "ops-audit": "R6", "ops-notices": "R6", "ops-billing": "R6", "ops-services": "R6", "ops-skills": "R6",
 "inquiry": "R1 R2 R3 R4", "notices": "R1 R2 R3 R4", "account": "R1 R2 R3 R4", "billing": "R1 R2", "company-settings": "R1 R2", "import": "R1 R2", "services": "R1 R2",
}

# 時点の被覆（G18・coverage_review.py）。empty=空（データ無し）の状態 id、stopped=AI が止まっている（PS4）の状態 id。
# 無い画面は書かない＝赤で残す（作っていないものを「同じ」と言わない）。na は当てはまらない理由
COVER = {
 "today": {"empty": "e", "stopped": "s"}, "clone-chat": {"stopped": "x"}, "automation-repair": {"stopped": "n", "na": "empty 止まっているものが無いときは画面自体が出ない"},
 "bridge-setup": {"empty": "n", "na": "stopped この画面が止まっているの入口"}, "credentials": {"na": "stopped 資格情報は AI と無関係に見える"},
 "signup": {"na": "empty stopped ログイン前"}, "verify-email": {"na": "empty stopped ログイン前"}, "login": {"na": "empty stopped ログイン前"}, "password-reset": {"na": "empty stopped ログイン前"},
 "mfa-setup": {"na": "empty stopped ログイン前"}, "invite-accept": {"na": "empty stopped ログイン前"},
 "onboard-interview": {"empty": "0", "na": "stopped はじめの設定（PS1）は AI が動いている前提"}, "onboard-draft": {"na": "empty stopped たたき台がある時点だけ"},
 "onboard-testrun": {"empty": "0", "na": "stopped テスト中に止まったら失敗の状態 x"}, "onboard-golive": {"na": "empty stopped 切替の 1 画面"},
}


# 空（データ 0 件）・AI が止まっている の汎用状態を機械で足す画面（build_all.py が _generic.py で生成）。
#  empty=True → 状態 ge（PS2：本番のデータが無い。運営側は PS3）、stopped=True → 状態 gs（PS4：既定の状態と同じ中身＋止まっている帯）。
#  na は当てはまらない理由。手で作った状態がある画面は COVER に直接書く（今日 e/s・承認待ち e・自分のAIとの会話 0/x・検索 0）。
GENERIC = {
 "credentials": {"empty": True}, "approvals": {"stopped": True}, "clone-thread": {"empty": True, "stopped": True}, "tasks": {"empty": True, "stopped": True},
 "ai-activity": {"empty": True, "stopped": True}, "search": {"stopped": True}, "records": {"empty": True, "stopped": True}, "record-detail": {"stopped": True, "na": "empty 1 件の中身は 1 件がある前提で開く"},
 "goals": {"empty": True, "stopped": True}, "goal-allocation": {"empty": True, "stopped": True}, "goal-edit": {"stopped": True, "na": "empty 改訂は目標がある前提で開く"},
 "my-progress": {"empty": True, "stopped": True}, "review": {"empty": True, "stopped": True}, "hypotheses": {"empty": True, "stopped": True}, "duties": {"empty": True, "stopped": True},
 "clone-memory": {"empty": True, "stopped": True}, "ledger-def": {"empty": True, "stopped": True}, "company-model": {"empty": True, "stopped": True}, "audit": {"empty": True, "stopped": True},
 "policies": {"empty": True, "stopped": True}, "members": {"empty": True, "stopped": True}, "ai-staff": {"empty": True, "stopped": True}, "ai-staff-detail": {"stopped": True, "na": "empty 1 体の中身は 1 体がある前提で開く"},
 "security-brief": {"stopped": True, "na": "empty 開示の文書。データが無くても中身は同じ"}, "export": {"stopped": True, "na": "empty 持ち出す対象（設定・証跡）は登録の時点から必ずある"},
 "account-close": {"empty": True, "stopped": True}, "account": {"stopped": True, "na": "empty 自分の情報は登録の時点から必ずある"}, "company-settings": {"stopped": True, "na": "empty 会社の設定は登録の時点から必ずある"},
 "import": {"empty": True, "stopped": True}, "services": {"empty": True, "stopped": True}, "inquiry": {"empty": True, "stopped": True}, "notices": {"empty": True, "stopped": True},
 "billing": {"stopped": True, "na": "empty プランは登録の時点から必ずある"},
 "billing-setup": {"na": "empty 登録前の画面。データは無い stopped 登録の時点で AI は無い"}, "llm-routes": {"stopped": True, "na": "empty 経路は登録の時点から既定（Bridge）がある"},
 "app-setup": {"na": "empty 端末が無い状態は「通知」の状態タブで扱う stopped アプリは AI の停止と関係なく開ける"}, "disclosure": {"stopped": True, "na": "empty 資料は成果物から作る。データが無くても同じ"},
 "ops-llm": {"empty": True, "na": "stopped 運営側に顧客の AI の停止は無い"}, "ops-disclosure": {"empty": True, "na": "stopped 同上"}, "member-detail": {"stopped": True, "na": "empty 1 人の詳細は 1 人がいる前提で開く"},
 "ops-home": {"empty": True, "na": "stopped 運営側に顧客の AI の停止は無い。止まっている会社は受信箱に出る"}, "ops-support": {"empty": True, "na": "stopped 同上"}, "ops-catalog": {"empty": True, "na": "stopped 同上"},
 "ops-services": {"empty": True, "na": "stopped 同上"}, "ops-skills": {"empty": True, "na": "stopped 同上"}, "ops-notices": {"empty": True, "na": "stopped 同上"}, "ops-billing": {"empty": True, "na": "stopped 同上"}, "ops-tenant": {"na": "empty stopped 1 社の中身は 1 社がある前提で開く。運営側に AI の停止は無い"},
 "ops-review": {"empty": True, "na": "stopped 同上"}, "ops-audit": {"empty": True, "na": "stopped 同上"},
}
COVER.update({"approvals": {"empty": "e", **COVER.get("approvals", {})}, "clone-chat": {"empty": "0", **COVER.get("clone-chat", {})}, "search": {"empty": "0"}})
for _sid, _g in GENERIC.items():
    _c = dict(COVER.get(_sid, {}))
    if _g.get("empty"): _c["empty"] = "ge"; PS.setdefault(_sid, {})["ge"] = "PS3" if _sid.startswith("ops-") else "PS2"
    if _g.get("stopped"): _c["stopped"] = "gs"; PS.setdefault(_sid, {})["gs"] = "PS4"
    if _g.get("na"): _c["na"] = (_c.get("na", "") + " " + _g["na"]).strip()
    COVER[_sid] = _c
