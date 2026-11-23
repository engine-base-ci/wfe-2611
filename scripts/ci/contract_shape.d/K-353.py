# K-353 上書きの口（updateCredential）と消す口（deleteCredential）の契約の形の表に足す分（K-325 の断片）
import credential_patterns as _CP  # 手助けは断片の中で読む（置き場の断片を 1 つずつ実行する試験にも通る・K-383）
#   消す口は体を受けない（DELETE）ので、どの表にも載せない（NO_REQUIRED_INPUTS は体を受ける口だけ・K144-SHAPE-020）
NO_REQUIRED_INPUTS = {
    "updateCredential": "どの欄も無くてよい（変える欄だけを送る）。変える物が 1 つも無いときは口が 422 E-CRED-008（features/F3/credentials/update.ts・K-353）",
}
# apps/api/src/features/F3/credentials/update.ts の checkFields（2 段階の種類は決まった値だけ・使える場所は 1〜20 個）
VALUE_RANGES = {
    "updateCredential": {
        "two_factor": {"enum": ["none", "totp", "sms", "email", "push"]},
        "destinations": {"minItems": 1, "maxItems": 20, "items": {"type": "string", "pattern": _CP.DEST}, "description": "契約の pattern に合っても、互換形で書いた公開の接尾辞だけ（ᶜo.jp・ⓒⓞ.jp など）は 422・E-CRED-002 で断る（預けた物がどこでも使えてしまうのを防ぐ守り・K-383）"},
        "login": {"pattern": _CP.LOGIN},
        "password": {"minLength": 1},
        "value": {"minLength": 1},
        "totp_secret": {"pattern": _CP.TOTP},
        "expires_on": {"pattern": _CP.EXPIRES},
    },
}
UNEXPRESSIBLE_422: dict = {}   # 決まりは全部 VALUE_RANGES と INPUT_RULES で契約に書いた。今日より前の期限・預けた物の種類で決まる混ざりは 409（K-383・PM の決め）
