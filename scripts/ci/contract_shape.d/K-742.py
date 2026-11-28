# K-742 自分で直す口（editApproval）の契約の形の表に足す分（K-325 の断片）
# apps/api/src/features/F5/more/edit.ts の parseEdit（無ければ 422・欄つき）。長さの上限は置かない（D-130.3）
REQUIRED_INPUTS = {
    "editApproval": {"text", "version"},
}
VALUE_RANGES = {
    "editApproval": {
        "text": {"pattern": "\\S"},
        "version": {"minimum": 1},
    },
}
