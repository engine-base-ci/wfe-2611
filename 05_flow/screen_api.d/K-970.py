# K-970 運営が 1 社を止める（stopWorkspace）・再開する（resumeWorkspace）の契約に足す分（D-156.23・D-125.126）
#   入力と答えの形は K-1006 の断片が持つ。ここは欄をまたぐ組み合わせの決まり（INPUT_RULES・K-355 の書き方）と、口が返す 404・409 の行だけ
#   すぐ止める（mode now）は規約に反する（violation）・危ない（danger）ときだけで、止める日（stop_on）を付けない／日を決める（mode scheduled）は stop_on が要る。
#   止める日が今日以前（読むときの日本の暦で決まる）・二重・止めていない会社の再開は DB の中身で決まるので 409（欄なし・契約に書けない決まりの例外は足さない）

INPUT_RULES = {
    "stopWorkspace": {"anyOf": [
        {"required": ["stop_on"], "properties": {"mode": {"enum": ["scheduled"]}}},
        {"not": {"required": ["stop_on"]}, "properties": {"mode": {"enum": ["now"]}, "reason_key": {"enum": ["violation", "danger"]}}},
    ]},
}

ERRORS_4XX = {
    "stopWorkspace": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "指した会社が無い・消した・作りかけ・運営の会社（在るかを漏らさない・欄なし）",
         "ears_form": "UNWANTED: IF 指した会社が無いか運営の会社なら、Kaname は 404 と NOT_FOUND を返し、止める印を書かない"},
        {"status": 409, "code": "E-OPS-003", "body": {"error": "conflict", "code": "E-OPS-003"}, "errors": ["E-OPS-003"],
         "trigger": "もう止めている会社をもう一度止めた・止める予定がある会社に日を決め直した（予定がある会社をすぐ止めるのは通す）",
         "ears_form": "UNWANTED: IF もう止めているか止める日が決まっている会社に日を決め直したら、Kaname は 409 と E-OPS-003 を返し、止める日を変えない"},
        {"status": 409, "code": "E-OPS-006", "body": {"error": "conflict", "code": "E-OPS-006"}, "errors": ["E-OPS-006"],
         "trigger": "日を決めて止めるのに、止める日が日本の今日か昔（明日以降でない）",
         "ears_form": "UNWANTED: IF 止める日が今日以前なら、Kaname は 409 と E-OPS-006 を返し、止める印を書かない"},
    ],
    "resumeWorkspace": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "指した会社が無い・消した・作りかけ・運営の会社（在るかを漏らさない・欄なし）",
         "ears_form": "UNWANTED: IF 指した会社が無いか運営の会社なら、Kaname は 404 と NOT_FOUND を返し、何も書かない"},
        {"status": 409, "code": "E-OPS-004", "body": {"error": "conflict", "code": "E-OPS-004"}, "errors": ["E-OPS-004"],
         "trigger": "止める予定も止めた印も無い会社を再開した",
         "ears_form": "UNWANTED: IF 止めていない会社を再開したら、Kaname は 409 と E-OPS-004 を返し、運営の記録を書かない"},
    ],
}
