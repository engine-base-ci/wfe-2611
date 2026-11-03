"""rls_policies.py — 表の形からの当てはめ（build_functional.py）では決まらない行の守り（RLS）を、表ごとに書く所（D-128.115）。

build_functional.py は ER 図の列の印（<scoped>・<common>・本人の列）から RLS を当てはめる。でも次の 2 つは形からは分からない：
  1) 子の表は親の見え方に従う（チケットの本文・版・分類は、元のチケットを読める人だけ）。会社の列だけ見ると、グループの外の人にも見えてしまう
  2) 関わっている人（担当者・承認する人・渡された相手）はグループの外でも読める
ここに書いた表は、当てはめの代わりにこの方針を entities.json に入れる（scripts/ci/gen_rls.py がそこから SQL を作る）。

述語の中の関数は migration で作る：
  app.ticket_visible(ticket_id)  … そのチケットを読めるか（会社の中・見える層か関わっている人）
  app.ticket_writable(ticket_id) … そのチケットに書けるか（その層の edit の権限か担当者）
"""

T = "current_setting('app.tenant_id', true)::uuid"
U = "current_setting('app.user_id', true)::uuid"
OPS_GRANT = lambda t: f"current_setting('app.role', true) = 'ops' AND EXISTS (SELECT 1 FROM support_access_grants g WHERE g.tenant_id = {t}.tenant_id AND g.expires_at > now() AND g.revoked_at IS NULL)"
SRC_T = ["D-128.115", "D-073.1", "D-128.88"]


def ops_read(t: str) -> dict:
    return {"name": f"{t}_ops_read_with_grant", "operation": "select", "role": "ops", "predicate": OPS_GRANT(t),
            "rationale": "運営は理由つき・1 時間・見るだけの許可があるときだけ（D-128.68）", "source": ["D-128.68"]}


def child_of_ticket(t: str, write_ops: str = "insert,update,delete") -> list[dict]:
    """チケットの子の表：元のチケットを読める人だけ読む・書ける人だけ書く"""
    pol = [{"name": f"{t}_ticket_read", "operation": "select", "role": "member", "predicate": f"tenant_id = {T} AND app.ticket_visible(ticket_id)",
            "rationale": "元のチケットを読める人だけ（グループの外の人・他の会社には見せない）", "source": SRC_T}]
    if write_ops:
        pol.append({"name": f"{t}_ticket_write", "operation": write_ops, "role": "member", "predicate": f"tenant_id = {T} AND app.ticket_writable(ticket_id)",
                    "rationale": "元のチケットに書ける人だけ", "source": SRC_T})
    return pol + [ops_read(t)]


def workspace_master(t: str) -> list[dict]:
    """ワークスペースで共通の決まり（種別・段・軸・渡すとき）：メンバーは読む・直すのはワークスペース全体の edit を持つ人（既定は管理者・D-125.66）"""
    return [{"name": f"{t}_tenant_read", "operation": "select", "role": "member", "predicate": f"tenant_id = {T}",
             "rationale": "ワークスペースのメンバーは読む（チケットを作る・絞る・渡すときに使う）", "source": ["D-125.67"]},
            {"name": f"{t}_permission_write", "operation": "insert,update,delete", "role": "member",
             "predicate": f"tenant_id = {T} AND has_permission({U}, '{t}', NULL, 'edit')",
             "rationale": "決まりを直せる人（ワークスペース全体の edit・既定は管理者）", "source": ["D-125.66", "D-128.97"]},
            ops_read(t)]


POLICIES: dict[str, list[dict]] = {
    # チケット：読む＝見える層か関わっている人／作る＝その層の edit／直す＝その層の edit か担当者／消す（行の削除）は誰もしない（論理削除だけ・D-128.84）
    "tickets": [
        {"name": "tickets_read", "operation": "select", "role": "member",
         "predicate": f"tenant_id = {T} AND (scope_id = ANY(visible_scopes({U})) OR assignee_member_id = {U} OR app.ticket_involved(id, {U}))",
         "rationale": "そのグループを見られる人と、グループの外でも関わっている人（担当者・承認する人・渡された相手）", "source": SRC_T},
        {"name": "tickets_create", "operation": "insert", "role": "member",
         "predicate": f"tenant_id = {T} AND has_permission({U}, 'tickets', scope_id, 'edit')",
         "rationale": "そのグループで書ける人だけが作る（自分を担当者にしても、書けないグループには作れない）", "source": SRC_T},
        {"name": "tickets_update", "operation": "update", "role": "member",
         "predicate": f"tenant_id = {T} AND (has_permission({U}, 'tickets', scope_id, 'edit') OR assignee_member_id = {U})",
         "rationale": "そのグループで書ける人と担当者（消す・戻すは論理削除で、ここを通る）", "source": SRC_T + ["D-128.84"]},
        ops_read("tickets"),
    ],
    "ticket_sections": child_of_ticket("ticket_sections"),
    "ticket_section_versions": child_of_ticket("ticket_section_versions", "insert"),   # 版は追記だけ（直さない・消さない）
    "ticket_class_values": child_of_ticket("ticket_class_values"),
    "ticket_kinds": workspace_master("ticket_kinds"),
    "kind_sections": workspace_master("kind_sections"),
    "ticket_stages": workspace_master("ticket_stages"),
    "class_axes": workspace_master("class_axes"),
    "class_values": workspace_master("class_values"),
    "handover_rules": workspace_master("handover_rules"),
    # 登録の保留（ログインの前）。表は kaname_auth の側にあり、登録の口（auth-ext）だけが読み書きする。アプリの役からは誰も読めない
    "pending_signup": [{"name": "pending_signup_no_app_access", "operation": "select", "role": "member", "predicate": "false",
                        "rationale": "ログインの前の保留。アプリの役からは読めない（登録の口だけが kaname_auth の側で扱う・D-088.2）", "source": ["D-088.2", "D-128.115"]}],
}

# 誰でも（ログイン済みなら）読める・書けるのは本当のマスタだけ。それ以外でまだ直していない表と、直すチケット（zt_gate.py の ZT3 が見る）
PENDING_CHILD_TABLES = {
    "knowledge_page_versions": "KN-40（元のページを読める人だけ）",
    "client_groups": "KN-41（元の取引先を見られる人だけ）",
    "terms_consents": "KN-42（本人だけ）",
    "passkeys": "KN-46（置き場所を決める：Better Auth の側なら API からは触らない）",
    "skill_versions": "KN-44（会社ごとの業務の型を入れる前に、元の型を見られる人だけにする）",
}
