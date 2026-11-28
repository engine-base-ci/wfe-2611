# K-913 ゲストの「初めて」の印はホームを開いたときだけ（代表の決め answer=b187f0c59dec・PM の決め：口に印を付けるかの入力を足す）
#   getPortalHome（K-906）に問い合わせ visit を 1 つ足す。ホーム以外の画面の外枠は visit=elsewhere で読み、初めての記録（portal.first_visit）を書かない。
#   visit なし（ホームの読み）は K-906 のまま。値は elsewhere だけ（ほかは口 home.ts が DB を呼ぶ前に 422・入口と同じ形・欄 visit。入口 op.ts の list の枝は visit を見ない）
QUERIES = {
    "getPortalHome": ["visit"],
}
QUERY_RANGES = {
    "getPortalHome": {"visit": {"enum": ["elsewhere"]}},
}
