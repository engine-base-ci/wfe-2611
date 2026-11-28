# K-830 ワークスペースを消す手続き（requestWorkspaceDeletion・POST /workspace/deletion）・取り消す（cancelWorkspaceDeletion・DELETE /workspace/deletion）
#   振る舞いの本体は apps/api/src/features/F10/workspace/deletion.ts（DB の関数 app.workspace_deletion_request・app.workspace_deletion_cancel）。
#   入口の言葉は write（本体の PERMS・口の中で app.workspace_can('delete_workspace') を見る・D-154.83）。どちらも本人確認を取り直す（直前 15 分・D-154.18）。
#   名前は正確に比べる（全角半角・前後の空白・大小を同じとみなさない）。合わないのは DB の中身で決まるので 409・E-WS-030（契約に書けない 422 は使わない）。
#   書き出しは無い（D-154.4）。14 日後に消すのは運営（段 11 は消す仕組みを作らない・D-148.9）
INPUTS = {
    "requestWorkspaceDeletion": ("WorkspaceDeletionInput", {"confirm_name": "string"}),
}

# 答え：始めた・取り消した後の手続きの今（取り消しは全部 null）
RESPONSES = {
    "requestWorkspaceDeletion": ("WorkspaceDeletion", {"deletion": "object"}),
    "cancelWorkspaceDeletion": ("WorkspaceDeletion", {"deletion": "object"}),
}

# 始めても作る行は無い（会社の行の時刻を立てるだけ）ので 200
SUCCESS_STATUS = {"requestWorkspaceDeletion": 200}

# apps/api/src/features/F10/workspace/deletion.ts（名前の欄は必須・1〜100 字）
REQUIRED_INPUTS = {
    "requestWorkspaceDeletion": ["confirm_name"],
}
VALUE_RANGES = {
    "requestWorkspaceDeletion": {
        "confirm_name": {"minLength": 1, "maxLength": 100},
    },
}

# 権限（403）・本人確認（403）・名前と状態（409）・入力の形（422・始めるだけ）・DB が落ちた（503）
_FORBIDDEN = {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
              "trigger": "消す権限が無い（app.workspace_can('delete_workspace') が不可：既定のマネージャー・メンバー・閲覧のみ・兼務のマネージャー）",
              "ears_form": "UNWANTED: IF 消す権限の無い人が呼んだなら、Kaname は 403 を返し、手続きも記録も受け箱も変えない"}
_STEP_UP = {"status": 403, "code": "STEP_UP_REQUIRED", "body": {"error": "step_up_required", "code": "STEP_UP_REQUIRED"},
            "trigger": "本人確認の取り直しが直前 15 分の内に無い",
            "ears_form": "UNWANTED: IF 取り直しが直前 15 分の内に無いなら、Kaname は 403 と STEP_UP_REQUIRED を返し、手続きを変えない"}
_DOWN = {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "手続き・受け箱・記録を書く DB が落ちた（取引ごと戻る）",
         "ears_form": "UNWANTED: IF 手続き・受け箱・記録を書く DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、何も残さない"}
ERRORS_4XX = {
    "requestWorkspaceDeletion": [
        _FORBIDDEN,
        _STEP_UP,
        {"status": 409, "code": "E-WS-030", "body": {"error": "conflict", "code": "E-WS-030"}, "errors": ["E-WS-030", "E-WS-031"],
         "trigger": "打った名前が今の名前と正確に同じでない（E-WS-030）／すでに消す手続き中（E-WS-031・同時に始めた 2 本目も）",
         "ears_form": "UNWANTED: IF 打った名前が合わないか、すでに手続き中なら、Kaname は 409 を返し、手続きも記録も受け箱も変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR"},
         "trigger": "名前の欄が無い・文字でない・空・NUL を含む・101 字以上・知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力の形が決まりに合わないなら、Kaname は 422 を返し、手続きを始めない"},
        _DOWN,
    ],
    "cancelWorkspaceDeletion": [
        _FORBIDDEN,
        _STEP_UP,
        {"status": 409, "code": "E-WS-032", "body": {"error": "conflict", "code": "E-WS-032"}, "errors": ["E-WS-032", "E-WS-033"],
         "trigger": "始めて 14 日を過ぎた（E-WS-032）／消す手続き中でない（E-WS-033）",
         "ears_form": "UNWANTED: IF 14 日を過ぎたか、手続き中でないなら、Kaname は 409 を返し、手続きも記録も変えない"},
        _DOWN,
    ],
}
