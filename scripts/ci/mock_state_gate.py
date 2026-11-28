#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""製品状態ゲート（静的）── 画面の各状態が「製品のどの時点か」を宣言し、その時点に無いものを描いていないかを検査する。

 由来（2026-09-10）：外部の常駐アプリを「まだつないでいない」画面の右に、AI の会話パネルが出ていた。
   AI はそれがつながるまで話せないと決めてあった（決定ログ）のに、モックが画面ごとに独立して作られ、
   「この画面はどの時点か」を持っていなかった。同型：はじめの設定の途中で承認待ち 3 のバッジが出る。

 規則（screen-derivation.md §9）：
   - flow.json に product_states（時点の列。各時点が持つ caps）を置く
   - モックの各状態パネル（.statepane）は data-ps="<時点ID>" を必ず持つ
   - 時点に依存する部品は data-requires="<cap>" を持ち、その cap が無い時点では出さない（実機検査は make_state_rig.py）

使い方: python3 mock_state_gate.py --flow <flow.json> --mocks <モックのフォルダ>
"""
import argparse, json, os, re, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--flow", required=True); ap.add_argument("--mocks", required=True)
    a = ap.parse_args()
    flow = json.load(open(a.flow, encoding="utf-8"))
    ps = flow.get("product_states") or []
    fails = []
    if not ps:
        fails.append(("S0", "flow.json に product_states が無い（製品の時点の列）", [a.flow]))
    ids = {p["id"] for p in ps}
    caps_all = set(c for p in ps for c in p.get("caps", []))
    pane_re = re.compile(r'<div class="statepane"[^>]*>')
    ps_re = re.compile(r'data-ps="([^"]+)"')
    req_re = re.compile(r'data-requires="([^"]+)"')
    nops, badps, badreq, n_panes, badcss = [], [], [], 0, []
    for f in sorted(os.listdir(a.mocks)):
        if not f.endswith(".html") or "index" in f: continue
        t = open(os.path.join(a.mocks, f), encoding="utf-8").read()
        for st in re.findall(r"<style>(.*?)</style>", t, re.S):
            if st.count("{") != st.count("}"): badcss.append(f"{f}: {{ {st.count('{')} / }} {st.count('}')}")
        for m in pane_re.finditer(t):
            n_panes += 1
            mm = ps_re.search(m.group(0))
            if not mm: nops.append(f"{f} #{re.search(r'id=\"([^\"]+)\"', m.group(0)).group(1) if 'id=' in m.group(0) else '?'}")
            elif mm.group(1) not in ids: badps.append(f"{f}: {mm.group(1)}")
        for r in req_re.findall(t):
            for c in r.split():
                if c not in caps_all: badreq.append(f"{f}: data-requires={c}")
    if nops: fails.append(("S1", "data-ps（製品の時点）を宣言していない状態パネル", nops))
    if badps: fails.append(("S2", "product_states に無い時点ID", sorted(set(badps))))
    if badcss: fails.append(("S4", "<style> の括弧が釣り合っていない（以降の規則が全部無効になる）", badcss))
    if badreq: fails.append(("S3", "product_states のどの caps にも無い data-requires", sorted(set(badreq))))
    # S5 クラス名の衝突：共通 CSS で「単独のクラス」として箱の性質（余白・配置・寸法）を持つ名前を、画面側が複合クラスの一部として
    #    別の意味で使っている（例：共通 .empty{padding:56px} を .nx.empty に流用 → 行が 200px に膨らんだ事故）。名前を変える
    BOX = re.compile(r"\b(padding|margin|width|height|position|display|text-align|inset|top|left)\s*:")
    badcls = []
    for f in sorted(x for x in os.listdir(a.mocks) if x.endswith('.html') and 'index' not in x and not x.startswith('_')):
        h = open(os.path.join(a.mocks, f), encoding="utf-8", errors="ignore").read()
        styles = re.findall(r"<style>(.*?)</style>", h, re.S)
        css = "\n".join(styles)
        # 単独クラス規則（`.x{...}`）で箱の性質を持つもの
        # 単独クラス＝規則の先頭（直前が } か行頭）から `.x{` まで他のセレクタが無いもの。`.trow .nx{` の .nx は数えない
        solo = {m.group(1) for m in re.finditer(r"(?:^|\})\s*\.([a-zA-Z][\w-]*)\s*\{([^}]*)\}", css, re.M) if BOX.search(m.group(2))}
        # 複合クラス（`.a.b`）の後ろ側が solo に含まれ、かつ .a 側が solo に無い（＝別部品の中で名前を再利用している）
        for m in re.finditer(r"\.([a-zA-Z][\w-]*)\.([a-zA-Z][\w-]*)\s*[{,:]", css):
            a1, b1 = m.group(1), m.group(2)
            if b1 in solo and a1 not in solo:
                badcls.append(f"{f}: .{a1}.{b1} ← 共通の .{b1} が箱の性質を持つ（名前を変える）")
    if badcls: fails.append(("S5", "クラス名の衝突（共通の単独クラスを複合クラスの一部として流用）", sorted(set(badcls))))
    print(f"製品の時点 {len(ps)} / 状態パネル {n_panes}")
    if fails:
        print(f"\nFAIL — {len(fails)} 件")
        for g, t, items in fails:
            print(f"\n[{g}] {t}: {len(items)} 件")
            for i in items[:20]: print("      -", i)
            if len(items) > 20: print(f"      … 他 {len(items)-20} 件")
        print("\n時点を宣言しない状態は「いつの画面か分からない画面」。宣言してから実機検査（make_state_rig.py）へ。")
        return 1
    print("PASS — S0〜S5 すべて緑。次は make_state_rig.py で実機検査。")
    return 0

if __name__ == "__main__":
    sys.exit(main())
