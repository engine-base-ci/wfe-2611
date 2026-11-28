# K-834 自分の顔の写真（uploadAvatar）の契約の形の表に足す分（K-325 の断片）
# apps/api/src/features/F10/me/avatar.ts（体は multipart：file か reset=true のどちらか 1 つ。JSON の必須の欄は無い）
REQUIRED_INPUTS = {}
NO_REQUIRED_INPUTS = {
    "uploadAvatar": "体は multipart（入口の multipart の道・K-828）。JSON の必須の欄は無く、file か reset=true のどちらか 1 つを口が見て、合わなければ 422（欄 file）",
}
PATH_PATTERNS = {}
VALUE_RANGES = {}
UNEXPRESSIBLE_422 = {
    "uploadAvatar": ["体が multipart の欄 file か reset=true のどちらか 1 つでない（JSON の形に書けない）",
                     "ファイルの中身が PNG・JPEG・WebP でない（中身の先頭の印で見る・E-ME-011）"],
}
AGENT_ANSWERS = {}
