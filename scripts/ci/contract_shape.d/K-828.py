# K-828 会社のロゴを変える口（uploadWorkspaceLogo）の契約の形の表に足す分
#   体は multipart/form-data（契約の入口の multipart の道・JSON の入力の形は空）。欄 file と中身の確かめは口（apps/api/src/features/F10/workspace/logo.ts）
REQUIRED_INPUTS = {}
NO_REQUIRED_INPUTS = {
    "uploadWorkspaceLogo": "体は multipart/form-data の欄 file 1 つで、JSON の入力の形を持たない。file が無い・ファイルでないは口が 422（欄 file）にする（logo.ts の badFile）",
}
PATH_PATTERNS = {}
VALUE_RANGES = {}
UNEXPRESSIBLE_422 = {
    "uploadWorkspaceLogo": [
        "file の欄が無い・ファイルでない（欄 file）",
        "体が multipart/form-data でない・読めない（欄 body・入口 op.ts の multipart の道）",
        "中身の先頭の印が PNG・JPEG・WebP でない（E-WS-011・content-type と名前は見ない）",
    ],
}
AGENT_ANSWERS = {}
