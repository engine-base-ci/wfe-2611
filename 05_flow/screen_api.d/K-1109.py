# K-1109 請求書を出したときの、PDF を付けたメール（issueOpsInvoices が出し終えた後・関門 C6・D-156.53）
#   出したとき（dry_run でない 201）だけ、答えに meta.mail { sent, failed }（宛先の数で数えた整数 2 つ）を足す。data の形は変えない（K-1005）。
#   下書き（dry_run）の 201 は meta を付けない。運営の請求の画面（K-984）が failed が 1 以上なら送れなかった数を出す（D-156.78）
META = {
    "issueOpsInvoices": {"mail": "object"},
}
