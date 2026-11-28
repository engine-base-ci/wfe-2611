# K-993 会社の側のひな形の新しい版の口（listKindTemplateUpdates・applyKindTemplateUpdate）（D-156.20・D-156.56・D-125.72・D-156.12・D-156.17）
#   一覧：届いていて、まだ選んでいない版（tenant_distributions の offered_version > version_in_use かつ chosen is null）。
#     1 行は 7 欄。差（diffs）は読むときに、会社が手を付けていない所だけで作る（届いた後に直した・消した所は出ない）
#   選ぶ：choice は change（差を今の会社の行に当てる）か keep（何も変えない）。どちらも選んだ印を残し、一覧から消える
#   振る舞いの本体は apps/api/src/features/F9/settings/template-updates.ts と DB の関数（20261128013300_kind_template_updates.sql）

_ROW = {"id": "uuid", "part": "string", "part_name": "string", "from_version": "integer", "to_version": "integer",
        "released_at": "string?", "diffs": "array"}

# 体は strict（知らない欄は 422）。道の :id は uuid（tenant_distributions.id）
INPUTS = {
    "applyKindTemplateUpdate": ("KindTemplateUpdateApplyInput", {"choice": "string"}),
}

REQUIRED_INPUTS = {
    "applyKindTemplateUpdate": ["choice"],   # apps/api/src/features/F9/settings/template-updates.ts（無いと 422）
}

VALUE_RANGES = {
    "applyKindTemplateUpdate": {
        "choice": {"enum": ["change", "keep"]},
    },
}

# 一覧も選ぶも同じ 7 欄の行（選んだ答えの diffs は空）
RESPONSES = {
    "listKindTemplateUpdates": ("KindTemplateUpdate", dict(_ROW)),
    "applyKindTemplateUpdate": ("KindTemplateUpdate", dict(_ROW)),
}

# 一覧は問い合わせの値を受けない（届いた版の決まった並び）
QUERIES = {
    "listKindTemplateUpdates": [],
}
LIST_DETAILS = {
    "listKindTemplateUpdates": {"sort": False, "desc": "取得（tenant_distributions）— 会社に届いていて、まだ選んでいないひな形の新しい版と、手を付けていない所の差を見る"},
}

# 一覧は 60/min/user（運営のひな形の一覧と同じ・K993-API-012）。選ぶは POST の既定の 60/min/user のまま
RATES = {
    "listKindTemplateUpdates": "60/min/user",
}

ERRORS_4XX = {
    "listKindTemplateUpdates": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [], "trigger": "DB の関数が行が無いこと（P0002）を知らせた（kind-template-updates の共通の読み替え failed）", "ears_form": "UNWANTED: IF DB の関数が行が無いと知らせたなら、Kaname は 404 を返し、何も変えない"},
    ],
    "applyKindTemplateUpdate": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "その会社の使い始めの行に無い id（ほかの会社の行・消した行）。欄・details は付けない",
         "ears_form": "UNWANTED: IF 無い・ほかの会社の届いた版を選ぼうとしたなら、Kaname は 404 を返し、何も変えない"},
        {"status": 409, "code": "E-OPS-025", "body": {"error": "conflict", "code": "E-OPS-025"}, "errors": ["E-OPS-025"],
         "trigger": "もう選んだ・届いていない版（同時に 2 回選んだ後の 1 つも）。欄も details も付けない",
         "ears_form": "UNWANTED: IF もう選んだか届いていない版を選ぼうとしたなら、Kaname は 409 と E-OPS-025 を返し、何も変えない"},
    ],
}

# 統合の枝で足した（K-144 の契約の形の試験・直しの担当 XC）
SUCCESS_STATUS = {
    "applyKindTemplateUpdate": 200,   # 作らず状態を変えるだけ・口は 200 を返す（K-144 の SHAPE_010）
}
