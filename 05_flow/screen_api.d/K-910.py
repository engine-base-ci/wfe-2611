# K-910 依頼を書く間に分身が聞く口（askPortalRequestQuestions）
#   聞けるかは K-878 の app.guest_ok() だけで決める。担当の PC が閉じていれば聞かない（エラーではなく 200 の available false・D-128.101）。
#   SCREEN_API・RESPONSES・PERMS の行は本体の前からある行を直した（ここには同じ鍵を書かない）。ここは本体に無い鍵だけ
INPUTS = {
    "askPortalRequestQuestions": ("PortalQuestionsInput", {"body": "string"}),
}
REQUIRED_INPUTS = {
    "askPortalRequestQuestions": ["body"],   # apps/api/src/features/F11/portal/questions.ts の checkBody（無い・空・空白だけは 422 欄 body）
}
VALUE_RANGES = {
    "askPortalRequestQuestions": {   # apps/api/src/features/F11/portal/questions.ts の checkBody
        "body": {"minLength": 1, "maxLength": 10000},
    },
}
ERRORS_4XX = {
    "askPortalRequestQuestions": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "ゲストでない（役割 requester でない・グループに入っていない・止めた・抜けた・グループから外された・グループが消えた）・社内の人（入口）",
         "ears_form": "UNWANTED: IF 呼んだ人がゲストのグループに入った今のゲストでないなら、Kaname は 403 を返し、仕事を積まない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR", "details": []}, "errors": [],
         "trigger": "本文が無い・空・空白だけ・10000 字を超える・文字でない・NUL を含む／知らない欄",
         "ears_form": "UNWANTED: IF 本文の値が決まりの外なら、Kaname は 422 と欄ごとの理由を返し、仕事を積まない"},
    ],
}
