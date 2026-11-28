# K-811 役割を変える口（updateMemberRole）の契約の形の表に足す分（K-325 の断片）
# apps/api/src/features/F10/admin/members/role.ts（role_key は無ければ 422）
REQUIRED_INPUTS = {
    "updateMemberRole": {"role_key"},
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
# 役割は決まった 4 つ（owner・requester は選べない）
VALUE_RANGES = {
    "updateMemberRole": {
        "role_key": {"enum": ["manager", "member", "viewer", "admin"]},
    },
}
# 形の決まりは全部 VALUE_RANGES に書く。グループ・相手の有無は DB の中身で決まるので 404・409（控え帳）
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}
