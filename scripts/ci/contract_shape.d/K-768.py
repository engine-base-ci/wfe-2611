# K-768 まとめて承認の口（previewBulkApproval・bulkApprove）の契約の形の表に足す分（K-325 の断片）
REQUIRED_INPUTS = {
    "bulkApprove": {"approval_ids"},
}
NO_REQUIRED_INPUTS = {
    "previewBulkApproval": "approval_ids は無くてよい（無ければ自分が承認する全部）",
}
VALUE_RANGES = {
    "previewBulkApproval": {"approval_ids": {"minItems": 1, "maxItems": 50}},
    "bulkApprove": {"approval_ids": {"minItems": 1, "maxItems": 50}},
}
