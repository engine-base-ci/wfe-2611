# K-906 先方の場所を読む口（getPortalHome・getPortalTicket・listPortalNotices）
#   見えるか見えないかは K-878 の app.guest_ok() と K-881 の app.guest_sees_ticket(tid) だけで決める（D-155.41・D-155.42）。
#   SCREEN_API・RESPONSES・PERMS の行は本体の前からある行を直した（ここには同じ鍵を書かない）。ここは本体に無い断りの行だけ
_FORBIDDEN = {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
              "trigger": "ゲストでない（役割 requester でない・グループに入っていない・止めた・抜けた・グループが消えた）・社内の人（入口）",
              "ears_form": "UNWANTED: IF 呼んだ人がゲストのグループに入った今のゲストでないなら、Kaname は 403 を返し、何も返さず何も書かない"}
_PORTAL_GONE = {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
                "trigger": "先方の人の場所（ゲストのグループ）が読めない（関数が null・portal/home.ts の readPortal・K-144 の SHAPE_010 で足した）",
                "ears_form": "UNWANTED: IF 先方の人の場所が読めないなら、Kaname は 404 を返し、中身を返さない"}
ERRORS_4XX = {
    "getPortalHome": [dict(_FORBIDDEN), dict(_PORTAL_GONE)],
    "listPortalNotices": [dict(_FORBIDDEN), dict(_PORTAL_GONE)],
    "getPortalTicket": [
        dict(_FORBIDDEN),
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "見せていない・外した・別のグループにだけ見せた・消した・下書き・別の会社・無い id（在るかを漏らさない・欄なし）",
         "ears_form": "UNWANTED: IF チケットが自分のゲストのグループに見せられていないなら、Kaname は 404 を返し、題も本文も返さない"},
    ],
}
