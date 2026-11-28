# K-144（契約の形の試験を段11〜13 の口に当てる）が足した分（K-1112：本体 screen_api.py の表に直に足さず、葉ごとのファイルに書く）
ERRORS_4XX = {
    "getOpsShell": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [], "trigger": "運営の DB の関数が、読む・書く行が無いこと（P0002）を知らせた（共通の読み替え ops/db.ts の opsErrorReply）", "ears_form": "UNWANTED: IF 運営の DB の関数が行が無いと知らせたなら、Kaname は 404 を返し、何も変えない"},
    ],
}
