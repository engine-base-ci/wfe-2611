# K-401 渡す口・答える口（createTicketHandover・answerTicketHandover）の契約の形の表に足す分（K-325 の断片）
# apps/api/src/features/F8/handovers/input.ts（種類と決め方は決まった値だけ）
REQUIRED_INPUTS = {
    "createTicketHandover": {"kind"},
    "answerTicketHandover": {"decision"},
}
VALUE_RANGES = {
    "createTicketHandover": {"kind": {"enum": ["pass", "offer", "distribute", "escalate"]}},
    "answerTicketHandover": {"decision": {"enum": ["accept", "decline"]}},
}
UNEXPRESSIBLE_422 = {
    "createTicketHandover": [
        "上へ上げる（escalate）は段 9 では作らない（E-HND-001）",
        "理由が空・空白だけ（E-HND-007）",
        "返事の期限が日時の形でない・今より後でない（E-HND-008）",
        "相手がいない・自分・止まっている・招待中・見つからない（E-HND-013・010・006・014）・グループが見つからない（E-HND-012）",
        "一緒に切り替えるものの形・決まりと合わない（E-HND-011）",
        "申し出に相手・期限を付けた・人とグループの両方",
    ],
    "answerTicketHandover": [
        "断る理由が空（E-HND-007）",
        "一緒に切り替えるものの形（E-HND-011）",
        "上へ上げるの渡し（E-HND-001）",
    ],
}
