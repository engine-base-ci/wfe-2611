# K-948 の口の契約の形の表に足す分（統合の枝・05_flow/screen_api.d/K-948.py の必須と値の範囲を写す・直しの担当 XC）
REQUIRED_INPUTS = {
    "addOpsInquiryNote": {"body"},   # screen_api.d/K-948.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
    "createInquiry": {"body", "title", "topic"},   # screen_api.d/K-948.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
    "postInquiryMessage": {"body"},   # screen_api.d/K-948.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
    "replyOpsInquiry": {"body"},   # screen_api.d/K-948.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
    "uploadInquiryAttachment": {"content_type", "name", "size"},   # screen_api.d/K-948.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
}
NO_REQUIRED_INPUTS = {
    "resolveMyInquiry": '体は空（欄を持たない）。済みにするかは行の状態で決まる',
    "updateOpsInquiry": '欄はどれも任意で、少なくとも 1 つ・組み合わせの決まりは入力の形の allOf（INPUT_RULES）が断る',
}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "addOpsInquiryNote": {"body": {"minLength": 1, "maxLength": 4000, "pattern": "\\S"}},   # screen_api.d/K-948.py の VALUE_RANGES と同じ（統合の枝で写した）
    "createInquiry": {"topic": {"enum": ["usage", "trouble", "billing", "other"]}, "title": {"minLength": 1, "maxLength": 100, "pattern": "\\S"}, "body": {"minLength": 1, "maxLength": 4000, "pattern": "\\S"}, "attachment_ids": {"maxItems": 5}},   # screen_api.d/K-948.py の VALUE_RANGES と同じ（統合の枝で写した）
    "postInquiryMessage": {"body": {"minLength": 1, "maxLength": 4000, "pattern": "\\S"}, "attachment_ids": {"maxItems": 5}},   # screen_api.d/K-948.py の VALUE_RANGES と同じ（統合の枝で写した）
    "replyOpsInquiry": {"body": {"minLength": 1, "maxLength": 4000, "pattern": "\\S"}},   # screen_api.d/K-948.py の VALUE_RANGES と同じ（統合の枝で写した）
    "uploadInquiryAttachment": {"name": {"minLength": 1, "maxLength": 200}, "content_type": {"enum": ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "application/zip"]}, "size": {"minimum": 1, "maximum": 10485760}},   # screen_api.d/K-948.py の VALUE_RANGES と同じ（統合の枝で写した）
}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}
