#!/usr/bin/env python3
"""zt_gate.py — ゼロトラストの決まり（03_architecture/ゼロトラストの決まり.md・D-128.88）の検査。

設計の検査（赤なら止める）：
  ZT1  画面の表（05_flow/screen_api.py）から作る API は全部「誰が呼べるか」を持つ。言葉は決まりの §2 のものだけ
  ZT5  本人確認を取り直す操作（決まりの ZT5）に step_up が付いている
  ZT9  運営の画面の API は ops:<できること> だけ。顧客の画面の API は ops: を使わない
  ZT2  契約で、権限が public でない API がログイン不要になっていない（その逆も）・client の API は契約でも client
  ZT4  取引先の人（client）の API は /portal/ の下だけ。/portal/ の API は client だけ
実装の残り（数を出す。--strict のときだけ赤）：
  ZT3  ER 図 §16 の表で、packages/db/policies に RLS の決まりが無いもの
  ZT6  セッションの期限と見張り（操作が無いと 12 時間・IP や国の急な変化）
  ZT11 画面の守りの設定（Content-Security-Policy など）

使い方: python3 scripts/ci/zt_gate.py [--strict]
"""
from __future__ import annotations
import glob, importlib.util, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WORDS = {"public", "read", "write", "assignee", "approver", "recipient", "self", "manager", "admin", "client", "device"}
OPS_CAPS = {"any", "inquiry", "peek", "money", "stop", "notice", "distribute", "plan_propose", "plan_decide", "ops_people"}
# 本人確認を取り直す操作（D-125.139・D-128.68・D-128.70）。表に出てきたら step_up が要る
STEP_UP_REQUIRED = {"approveApproval", "createCredential", "updateCredential", "updateMemberRole", "updateMemberPermissions",
                    "createExport", "openPeek", "stopWorkspace", "recordPayment", "decidePlanProposal",
                    "startTwoFactor", "disableTwoFactor", "regenerateBackupCodes", "changePassword", "deletePasskey", "resetMemberTwoFactor",
                    "requestEmailChange", "revokeMyDevice", "releaseOpsWorkType", "rollbackOpsWorkType", "releaseOpsTemplate",
                    "updateMemberGroups", "suspendMember", "resumeMember", "removeMember", "updateWorkspacePermissions",
                    "changePlan", "requestWorkspaceDeletion", "createInvitations", "createInvitationLink",
                    "changeOpsWorkspacePlan", "resumeWorkspace", "issueOpsInvoices", "addOpsMember", "updateOpsMemberCaps", "removeOpsMember"}
PUBLIC_OK = {"signup", "verify-email", "login", "password-reset", "invite-accept"}   # ログイン前の画面だけが public を使える


def load_screen_api():
    spec = importlib.util.spec_from_file_location("screen_api", os.path.join(ROOT, "05_flow", "screen_api.py"))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod


def design_fails(sa) -> list[str]:
    fails = []
    perms = getattr(sa, "PERMS", {})
    for sid, rows in sa.SCREEN_API.items():
        for m, path, _act, _table, opid, _more in rows:
            if opid not in perms:
                fails.append(f"[ZT1] {sid} {m} {path}（{opid}）に「誰が呼べるか」が無い"); continue
            who, scope, step = perms[opid]
            ok_word = who in WORDS or (who.startswith("ops:") and who[4:] in OPS_CAPS)
            if not ok_word: fails.append(f"[ZT1] {opid} の権限 {who!r} は決まりの言葉に無い")
            if not str(scope).strip(): fails.append(f"[ZT1] {opid} の範囲の説明が空")
            if opid in STEP_UP_REQUIRED and not step: fails.append(f"[ZT5] {opid} は本人確認の取り直しが要る操作なのに step_up が無い")
            if sid.startswith("ops-") and not who.startswith("ops:"): fails.append(f"[ZT9] 運営の画面 {sid} の {opid} が ops: でない（{who}）")
            if not sid.startswith("ops-") and who.startswith("ops:"): fails.append(f"[ZT9] 顧客の画面 {sid} の {opid} が ops: を使っている")
            if who == "device" and not path.startswith("/bridge/"): fails.append(f"[ZT10] {opid} は PC の印（device）で呼ぶのに /bridge/ の下に無い")
            if path.startswith("/bridge/") and who not in ("device", "self"): fails.append(f"[ZT10] {opid}（/bridge/）は device か self でなければならない")
            if who == "client" and not path.startswith("/portal"): fails.append(f"[ZT4] {opid} は取引先の人（client）が呼ぶのに /portal/ の下に無い")
            if path.startswith("/portal") and who != "client": fails.append(f"[ZT4] {opid}（/portal/）は client でなければならない")
            if sid == "portal" and who != "client": fails.append(f"[ZT4] クライアントの場所の {opid} が client でない（{who}）")
            if who == "public" and sid not in PUBLIC_OK: fails.append(f"[ZT1] ログイン前ではない画面 {sid} の {opid} が public になっている")
    # ZT2：契約（08_api/endpoints.json）で、権限が public でない API がログイン不要になっていないか
    ep = os.path.join(ROOT, "08_api", "endpoints.json")
    if os.path.exists(ep):
        import json
        for e in json.load(open(ep, encoding="utf-8"))["endpoints"]:
            pm = e.get("permission")
            if pm and pm["who"] != "public" and e.get("auth", {}).get("role") == "public":
                fails.append(f"[ZT2] {e['method']} {e['path']} は権限 {pm['who']} なのに契約ではログイン不要（public）になっている")
            if pm and pm["who"] == "client" and e.get("auth", {}).get("role") != "client":
                fails.append(f"[ZT2] {e['method']} {e['path']} は権限 client なのに契約の役割が client でない")
            if pm and pm["who"] == "public" and e.get("auth", {}).get("role") != "public":
                fails.append(f"[ZT2] {e['method']} {e['path']} は権限 public なのに契約ではログインが要る")
    return fails


def impl_todo() -> list[str]:
    todo = []
    er = open(os.path.join(ROOT, "03_architecture", "ER図.md"), encoding="utf-8").read()
    sec = er.split("## 16.")[1].split("\n## ")[0] if "## 16." in er else ""
    tables = sorted(set(re.findall(r"^\| \*\*`([a-z_]+)`\*\*", sec, flags=re.M)))
    pol = "".join(open(f, encoding="utf-8").read() for f in glob.glob(os.path.join(ROOT, "packages", "db", "policies", "*.sql")))
    for t in tables:
        if not re.search(rf"\bon\s+(?:public\.)?{t}\b", pol, flags=re.I): todo.append(f"[ZT3] {t} に RLS の決まりが無い")
    auth = "".join(open(f, encoding="utf-8").read() for f in glob.glob(os.path.join(ROOT, "packages", "auth", "src", "**", "*.ts"), recursive=True))
    if not re.search(r"idle|IDLE_", auth): todo.append("[ZT6] 操作が無いときの期限（12 時間）が packages/auth に無い")
    if not re.search(r"country|geo|ip_change|ipChange", auth): todo.append("[ZT6] IP・国の急な変化で入り直させる仕組みが packages/auth に無い")
    web = "".join(open(f, encoding="utf-8").read() for f in glob.glob(os.path.join(ROOT, "apps", "web", "next.config.*")) + glob.glob(os.path.join(ROOT, "apps", "web", "middleware.*")))
    op = open(os.path.join(ROOT, "apps", "api", "src", "contract", "op.ts"), encoding="utf-8").read() if os.path.exists(os.path.join(ROOT, "apps", "api", "src", "contract", "op.ts")) else ""
    if '"client"' not in op: todo.append("[ZT4] 契約の入口（apps/api/src/contract/op.ts）が取引先の人（client）を分けていない。client は /portal/ の API だけ通す")
    if "Content-Security-Policy" not in web: todo.append("[ZT11] Content-Security-Policy が apps/web に無い")
    # ZT1（実装）：契約の外で登録されている道すじ（手で書いた /api/auth-ext・Bridge・預けたログイン情報 など）
    #   Better Auth そのものの /api/auth/* は部品の中身なので数えない。全部を契約に入れるか、理由つきで除外するまで残りに出す
    outside = []
    for f in glob.glob(os.path.join(ROOT, "apps", "api", "src", "auth", "*.ts")):
        for m, pth in re.findall(r'app\.(get|post|patch|put|delete)\("([^"]+)"', open(f, encoding="utf-8").read()):
            outside.append(f"{m.upper()} /api/auth-ext{pth}")
    if outside: todo.append(f"[ZT1] 契約の外で登録されている道すじ {len(outside)} 本（apps/api/src/auth/*.ts）。契約に入れて誰が呼べるかを書く")
    return todo


def main() -> int:
    strict = "--strict" in sys.argv
    sa = load_screen_api()
    fails = design_fails(sa)
    todo = impl_todo()
    n_api = sum(len(r) for r in sa.SCREEN_API.values())
    print(f"ゼロトラスト：画面の表の API {n_api} 本 ／ 設計の赤 {len(fails)} ／ 実装の残り {len(todo)}")
    for f in fails: print("  ★ " + f)
    for t in todo: print("  ・ " + t)
    if fails: print("FAIL — 設計の決まりを満たしていない"); return 2
    if strict and todo: print("FAIL — 実装の残りがある（--strict）"); return 2
    print("PASS — 設計の決まりは満たしている" + ("（実装の残りは作る段で 0 にする）" if todo else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
