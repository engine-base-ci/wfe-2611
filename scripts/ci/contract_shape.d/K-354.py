# K-354 PC がログイン情報を取り出す口の契約の形の表に足す分（K-325 の断片）
# apps/api/src/features/F3/credentials/resolve.ts の parseResolve（無ければ 422）
REQUIRED_INPUTS = {
    "resolveCredential": {"job_id", "credential_id", "destination", "executor_key"},
}
VALUE_RANGES = {
    "resolveCredential": {
        "destination": {"maxLength": 2048},
        "executor_key": {"maxLength": 200},
    },
}
UNEXPRESSIBLE_422 = {
    "resolveCredential": [
        "名前に直せない入れる場所・253 文字を超える名前（入口が字をそろえる前の字で new URL の hostname を取り出す）",
        "X25519 の公開の鍵として読めない executor_key（base64 で 44 バイトの SPKI でない）",
    ],
}
