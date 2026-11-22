# K-332：契約の口 acceptInvitation（ログインしていない人の分）の契約の形の表に足す分（K-325 の断片）
NO_REQUIRED_INPUTS = {
    "acceptInvitation": "name・password はログインしていない人だけが要る（条件つき・ログイン中は空の体・K-333）。無いときは口が 422 E-VAL-007・E-VAL-005（features/F2/invitations/accept.ts の check・K-332）",
}
# apps/api/src/features/F2/invitations/accept.ts の check（ログインしていない人だけが名前とパスワードを要る＝条件つきなので必須にしない）
UNEXPRESSIBLE_422 = {
    "acceptInvitation": [
        "ログインしていない人の名前が空・NFKC と前後の空白を落として 100 文字を超える（E-VAL-007）",
        "パスワードが 12 文字より短い・128 文字を超える（E-VAL-005・E-VAL-026）",
        "漏れたことのあるパスワード（E-VAL-011）",
        "リンクの招待で新しく参加するときのメールが無い・空・形が違う（E-INV-013）",
    ],
}
