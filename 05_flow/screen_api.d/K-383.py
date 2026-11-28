# K-383 やり取りを読む口（listTicketTimeline）
#   問い合わせ：filter（all／talk／mine）・before_at と before_id（いちばん古い行の時刻と id・両方か無し）。汎用の cursor は受けない（422）。
#   答えの 1 件の形 TimelineItem は screen_api.py の RESPONSES（K-385・K-386 の書く口も同じ名前・同じ欄で答える）
QUERIES = {"listTicketTimeline": ["filter", "before_at", "before_id"]}

LIST_DETAILS = {
    "listTicketTimeline": {"limit_max": 100, "sort": False, "desc": "取得（ticket_messages）— やり取りを新しい方から読む（前を見る・すべて／話だけ／自分あて・新しい数・候補の人）", "meta": "{ limit, older_count, new_count, mine_count, post_count, people? }"},
}

META = {
    "listTicketTimeline": {"older_count": "integer", "new_count": "integer", "mine_count": "integer", "post_count": "integer", "people": "array"},
}
