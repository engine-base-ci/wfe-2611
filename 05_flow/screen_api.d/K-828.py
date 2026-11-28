# K-828 会社のロゴを変える口（uploadWorkspaceLogo・POST /api/v1/workspace/logo・D-154.4）
# 体は multipart/form-data の欄 file 1 つ（契約の入口の multipart の道で読む・JSON の strict な形の対象外）。入力の形は空にして、欄は口が確かめる
#   種類は中身の先頭の印（PNG・JPEG・WebP）・大きさは 2 MB まで（apps/api/src/features/F10/workspace/logo.ts）
INPUTS = {
    "uploadWorkspaceLogo": ("WorkspaceLogoInput", {}),
}

# 答え：置いたロゴ { kind: "image", url }（url は置き場の期限つき URL・読む口 getWorkspaceSettings と同じ作り）
RESPONSES = {
    "uploadWorkspaceLogo": ("WorkspaceLogo", {"logo": "object"}),
}

# 管理者でない（403）・2 MB を超える（413・E-WS-010）・画像の種類が違う（422・E-WS-011）・file の欄が無い・multipart でない（422）・
#   置き場に置けない（502・E-WS-012）・DB に書けない（503・E-PAGE-003）
ERRORS_4XX = {
    "uploadWorkspaceLogo": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "管理者でない（マネージャー・メンバー・閲覧のみ・兼務のマネージャー・止めた人）",
         "ears_form": "UNWANTED: IF 管理者でないなら、Kaname は 403 を返し、ロゴを置かず変えない"},
        {"status": 413, "code": "E-WS-010", "body": {"error": "limit", "code": "E-WS-010"}, "errors": ["E-WS-010"],
         "trigger": "ファイルが 2 MB（2,097,152 バイト）を超える・体が 2 MB ＋ 64 KB を超える（入口で読み切らない）",
         "ears_form": "UNWANTED: IF ロゴのファイルが 2 MB を超えるなら、Kaname は 413 と E-WS-010 を返し、ロゴを置かず変えない"},
        {"status": 422, "code": "E-WS-011", "body": {"error": "validation", "code": "E-WS-011"}, "errors": ["E-WS-011"],
         "trigger": "中身の先頭の印が PNG・JPEG・WebP でない（SVG・GIF・空のファイル・画像でない物。content-type と名前は見ない）",
         "ears_form": "UNWANTED: IF ロゴの中身が PNG・JPEG・WebP の画像でないなら、Kaname は 422 と E-WS-011 を返し、ロゴを置かず変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "file の欄が無い・ファイルでない（欄 file）・体が multipart/form-data でない・読めない（欄 body）",
         "ears_form": "UNWANTED: IF file の欄が無いか体が multipart でないなら、Kaname は 422 と欄ごとの理由を返し、ロゴを置かず変えない"},
        {"status": 502, "code": "E-WS-012", "body": {"error": "external", "code": "E-WS-012"}, "errors": ["E-WS-012"],
         "trigger": "置き場（関門 C4）に置けない",
         "ears_form": "UNWANTED: IF 置き場にロゴを置けないなら、Kaname は 502 と E-WS-012 を返し、前のロゴのまま記録も残さない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "ロゴを書く DB の関数が使えない（先に置いた実体は消す）",
         "ears_form": "UNWANTED: IF ロゴを DB に書けないなら、Kaname は 503 と E-PAGE-003 を返し、前のロゴのまま先に置いた実体を消す"},
    ],
}

# 契約に書けない値の決まり（K-144 の SHAPE_024）：口の振る舞いのまま 422。契約の形の表（scripts/ci/contract_shape.d/K-828.py）と同じ並び
UNEXPRESSIBLE_422 = {
    "uploadWorkspaceLogo": [
        "file の欄が無い・ファイルでない（欄 file）",
        "体が multipart/form-data でない・読めない（欄 body・入口 op.ts の multipart の道）",
        "中身の先頭の印が PNG・JPEG・WebP でない（E-WS-011・content-type と名前は見ない）",
    ],
}
