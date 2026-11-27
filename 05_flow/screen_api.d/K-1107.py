# K-1107 請求書の型の口（getOpsInvoiceTemplate・updateOpsInvoiceTemplate）。型は運営の会社に 1 つ（D-156.60）
#   出す側の会社の情報（会社名・住所・登録番号・連絡先）・振込先・備考を読む・直す。直すと、これから出す請求書と顧客の振込先に効く
#   振る舞いの本体は apps/api/src/features/F12/ops/invoice-template.ts と app.ops_invoice_template_set（20261128032700）

_TEXT = {"pattern": "\\S"}

# 体は strict（知らない欄は 422）。version は読んだときの版（行が無い間は 0）
INPUTS = {
    "updateOpsInvoiceTemplate": ("OpsInvoiceTemplateInput", {
        "company": "string", "address": "string", "reg_no": "string", "contact": "string",
        "payee": "string", "note": "string", "version": "integer",
    }),
}

REQUIRED_INPUTS = {
    "updateOpsInvoiceTemplate": ["company", "address", "reg_no", "contact", "payee", "version"],   # 備考だけ任意
}

VALUE_RANGES = {
    "updateOpsInvoiceTemplate": {
        "company": {"minLength": 1, "maxLength": 100, **_TEXT},
        "address": {"minLength": 1, "maxLength": 200, **_TEXT},
        "reg_no": {"pattern": "^T[0-9]{13}$"},   # インボイスの登録番号（全角は画面が送る前に半角にする・K-1108）
        "contact": {"minLength": 1, "maxLength": 200, **_TEXT},
        "payee": {"minLength": 1, "maxLength": 200, **_TEXT},
        "note": {"maxLength": 500},
        "version": {"minimum": 0},
    },
}

# 読む・直す の答えは同じ 9 欄（保存していない間は設定の値・version 0・updated_* は null）
_TEMPLATE = {"company": "string", "address": "string", "reg_no": "string", "contact": "string", "payee": "string", "note": "string",
             "version": "integer", "updated_at": "string?", "updated_by_name": "string?"}
RESPONSES = {
    "getOpsInvoiceTemplate": ("OpsInvoiceTemplate", dict(_TEMPLATE)),
    "updateOpsInvoiceTemplate": ("OpsInvoiceTemplate", dict(_TEMPLATE)),
}

ERRORS_4XX = {
    "updateOpsInvoiceTemplate": [
        {"status": 409, "code": "E-BILL-007", "body": {"error": "conflict", "code": "E-BILL-007"}, "errors": ["E-BILL-007"],
         "trigger": "読んだときの版（version）が今の版と違う＝ほかの運営の人が先に直した（同時に 2 人が保存した後の 1 つも同じ）。欄も details も付けない",
         "ears_form": "UNWANTED: IF 送られた版が請求書の型の今の版と違うなら、Kaname は 409 と E-BILL-007 を返し、型も記録も書かない"},
    ],
}

# 画面の口（統合の枝で本体から移した・K-1112・PM の決め 2026-11-28）
SCREEN_API = {
    "ops-billing": [
        ("GET", "/ops/invoice-template", "A72", "ops_invoice_templates", "getOpsInvoiceTemplate", ["members"]),
        ("PUT", "/ops/invoice-template", "A72", "ops_invoice_templates", "updateOpsInvoiceTemplate", ["ops_audit_events"]),
    ],
}

PERMS = {
    "getOpsInvoiceTemplate": ("ops:money", "お金を持つ運営の人（請求書の型・K-1107）", False),
    "updateOpsInvoiceTemplate": ("ops:money", "同上。これから出す請求書の出す側と振込先が変わるので本人確認を取り直す（K-1107）", True),
}
