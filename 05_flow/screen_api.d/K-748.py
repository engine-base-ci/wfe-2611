# K-748 承認待ちを種類で絞る・並べ替える（listApprovalQueue の kind・sort・札の横の種類ごとの数・D-153.10・D-153.30・D-153.32）
#   QUERIES（["kind", "sort"]）と META（counts は object）は本体の行のまま。値域だけをここに書く（K-468 の仕組み。契約と fuzz の書き物で、
#   入口は値を読まない。決まった値以外を 422 にするのは口 apps/api/src/features/F5/approve-complete/queue-more.ts）。
#   sort は表の列ではない（入口・作り手の OWN_SORT_OPS）。counts の中身は { total, artifact, handover }（形は object のまま）
QUERY_RANGES = {
    "listApprovalQueue": {
        "kind": {"enum": ["artifact", "handover"]},
        "sort": {"enum": ["due", "waiting", "title"]},
    },
}
