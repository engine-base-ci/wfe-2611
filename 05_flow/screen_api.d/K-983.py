# K-983（listOpsInvoices）
#   答えの形・問い合わせの値（month・state）・LIST_DETAILS の行は K-1005 の断片が持つ。この葉の limit の上限 100（limit_max）は
#   K-1005 の LIST_DETAILS の同じ口の行に入れる（同じ鍵を 2 つのファイルが持つと止まる・registry_d）。この葉が足す鍵は無い
