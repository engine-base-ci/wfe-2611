# K-576 項目を点の形に戻す口（restoreTicketItems）の契約の形の表に足す分（K-325 の断片）
#   口は apps/api/src/features/F4/versions/item-restore.ts の checkItemRestore。screen_api.d/K-576.py の REQUIRED_INPUTS・VALUE_RANGES と同じ 1 つ

REQUIRED_INPUTS = {"restoreTicketItems": {"from", "to"}}
VALUE_RANGES = {"restoreTicketItems": {"from": {"minimum": 1}, "to": {"minimum": 1}}}
UNEXPRESSIBLE_422: dict = {}   # 登録先の決まりが住所を求めるので置く
