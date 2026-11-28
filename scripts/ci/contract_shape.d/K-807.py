# K-807 招待を送り直す口（resendInvitation）・取り消す口（revokeInvitation）の契約の形の表に足す分（K-325 の断片）。
# どちらも体を受けない（送り直すは空の体だけ・strict）。招待は道の id（uuid）で引く。DB の中身で決まる断りは 404・409（控え帳）
REQUIRED_INPUTS = {}
NO_REQUIRED_INPUTS = {
    "resendInvitation": '体は空（欄を持たない）。送り直すかは招待の行の状態で決まる',
}
PATH_PATTERNS = {}
VALUE_RANGES = {}
UNEXPRESSIBLE_422: dict = {}
AGENT_ANSWERS = {}
