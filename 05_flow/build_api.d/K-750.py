# K-750 決めた履歴を読む口（listApprovalHistory）の続きの印は鍵の文字列（決めた時刻の字|id を base64url）で受ける。
#   入口 apps/api/src/contract/op.ts の KEY_CURSOR_OPS にも同じ口を足した（K-1121 の README のとおり・契約と入口は同じ集まり）
KEY_CURSOR_OPS = {"listApprovalHistory"}
