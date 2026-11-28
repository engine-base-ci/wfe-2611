# K-1009 運営の人のできることを変える・外す口（updateOpsMemberCaps・removeOpsMember）：契約の形は screen_api.d/K-1009.py に書いた。ここは口が「無い」ことで 422 にする欄だけ
REQUIRED_INPUTS = {
    "updateOpsMemberCaps": {"caps"},   # apps/api/src/features/F12/ops/team-edit.ts の checkCapsInput（できることが無いは 422・strict）
}
