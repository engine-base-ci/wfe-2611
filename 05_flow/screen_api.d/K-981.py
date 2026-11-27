# K-981 運営が月の請求書をまとめて出す口（issueOpsInvoices）の振る舞いの断り方（入力と答えの形は K-1005）
#   出せる月は日本の今の月より前だけ。出す物が無ければ断る（D-156.31）。振る舞いの本体は apps/api/src/features/F12/ops/invoices-issue.ts
ERRORS_4XX = {
    "issueOpsInvoices": [
        {"status": 409, "code": "E-BILL-002", "body": {"error": "conflict", "code": "E-BILL-002"}, "errors": ["E-BILL-002", "E-BILL-003"],
         "trigger": "日本の今月か来月より先の月を出す（下書きも同じ・E-BILL-002）・その月の請求書がもう全部出ている・同時に 2 回押した後の 1 つ（E-BILL-003）。欄も details も付けない",
         "ears_form": "UNWANTED: IF まだ締めていない月か、出す物が無い月を出そうとしたなら、Kaname は 409 と E-BILL-002／E-BILL-003 を返し、請求書も記録も鈴も書かない"},
        # K-1013 が足した（同じ口の表は 1 つのファイルにしか置けない）：PDF を作った後・出す前に中身が変わった
        {"status": 409, "code": "E-BILL-006", "body": {"error": "conflict", "code": "E-BILL-006"}, "errors": ["E-BILL-006"],
         "trigger": "請求書の PDF を作った後・出す前に、その月の会社の額が変わった（プランが変わった等・K-1013）。欄も details も付けない",
         "ears_form": "UNWANTED: IF 請求書の PDF を作った後に出す額が変わったなら、Kaname は 409 と E-BILL-006 を返し、置いた PDF を消して請求書も記録も鈴も書かない"},
    ],
}
