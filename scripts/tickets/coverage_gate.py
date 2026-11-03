#!/usr/bin/env python3
"""coverage_gate.py — 11_tickets が、作るもの（画面・API・行為・後回し）を漏らさず持っているかの検査（D-128.117）。
しまった作業の分解（07_tasks・D-128.114）を読んでいた G14（td_gate）・G26（関門の宣言）の代わり。

 KC1 第1フェーズの画面（flow.json の release v1）が、どれかのチケットの screens にある
 KC2 契約の API（08_api/endpoints.json）が、どれかのチケットの screens（API の画面）か apis にある
 KC3 第1フェーズの行為が、どれかのチケットの screens（行為の画面）にある
 KC4 1 作業のチケットは choke_points（触る関門 C1〜C8）か choke_none（触らない理由）を持つ。apis を持つなら、その API の関門を全部書いている
 KC5 チケットの screens・apis・choke_points が実在する（無い画面・API・関門を書かない）
 KC6 後回しの決定（flow.json の deferred・決定ログの「段階 2：」の行）が、どれかのチケットの decisions にある（後回しは日程から消えない）
 KC7 1 本の API は、apis に書くなら 1 枚のチケットだけ。画面を複数のまとまりで分けている API（tickets など）は、どれか 1 枚の apis に明示する（二重・宙ぶらりんを作らない）
 KC8 1 作業まで切ったまとまりの画面の API は、全部どれかの 1 作業のチケットの apis にある（か、別のまとまりの apis に明示してある）。切ったのに子に入っていない API を作らない

まだ 1 作業に切っていないまとまり（split: これから）が持つ画面・API は「まだ切っていない」と数える（赤にしない）。
使い方: python3 scripts/tickets/coverage_gate.py [--only KC4]
"""
import argparse, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.dirname(__file__))
from build_index import load  # noqa: E402

CHOKE = {f"C{i}" for i in range(1, 9)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", action="append", help="この検査だけ（KC1〜KC6）")
    a = ap.parse_args()
    J = lambda p: json.load(open(os.path.join(ROOT, p), encoding="utf-8"))
    F = J("05_flow/flow.json")
    E = J("08_api/endpoints.json")["endpoints"]
    ts = load()
    kids = {t.get("parent") for t in ts if t.get("parent")}
    leaf = lambda t: t.get("split") != "これから" and t["id"] not in kids
    v1s = [s["id"] for s in F["screens"] if s.get("release") == "v1"]
    v1a = [x["id"] for ph in F["backbone"] for x in ph["acts"] if x.get("release") == "v1"]
    ops = {e["operation_id"]: e for e in E}
    fails: list[tuple[str, str]] = []

    owner_s: dict = {}
    owner_o: dict = {}
    for t in ts:
        for s in t.get("screens", []):
            owner_s.setdefault(s, []).append(t)
        for o in t.get("apis", []):
            owner_o.setdefault(o, []).append(t)

    m = [s for s in v1s if s not in owner_s]
    if m:
        fails.append(("KC1", f"チケットの無い画面 {m}"))

    def ep_owners(e):
        return [t for s in e.get("screens", []) for t in owner_s.get(s, [])] + owner_o.get(e["operation_id"], [])

    m = [f"{e['method']} {e['path']}" for e in E if not ep_owners(e)]
    if m:
        fails.append(("KC2", f"チケットの無い API {len(m)} {m[:4]}"))

    a2s = F.get("act_to_screen", {})
    m = [x for x in v1a if not any(s in owner_s for s in a2s.get(x, []))]
    if m:
        fails.append(("KC3", f"チケットの無い行為 {m[:10]}"))

    m = []
    for t in ts:
        if not leaf(t):
            continue
        cp = set(t.get("choke_points", []))
        if not cp and not t.get("choke_none"):
            m.append(f"{t['id']}（choke_points も choke_none も無い）")
            continue
        need = {c for o in t.get("apis", []) if o in ops for c in ops[o].get("choke_points", [])}
        if need - cp:
            m.append(f"{t['id']}（API の関門 {sorted(need - cp)} が無い）")
    if m:
        fails.append(("KC4", f"触る関門の宣言が欠け {m[:6]}"))

    m = [f"{t['id']}:{s}" for t in ts for s in t.get("screens", []) if s not in v1s]
    m += [f"{t['id']}:{o}" for t in ts for o in t.get("apis", []) if o not in ops]
    m += [f"{t['id']}:{c}" for t in ts for c in t.get("choke_points", []) if c not in CHOKE]
    if m:
        fails.append(("KC5", f"無い画面・API・関門 {m[:6]}"))

    need = set()
    for v in F.get("deferred", {}).values():
        need |= set(re.findall(r"D-\d{3}\.\d+", v))
    logp = os.path.join(ROOT, "01_hearing/決定ログ_進行中.md")
    LOG = open(logp, encoding="utf-8").read() if os.path.exists(logp) else ""
    for sec in re.split(r"\n(?=## \d+\. )", LOG):
        d = re.search(r"decision: (D-\d{3})", sec)
        st = re.search(r"status: (\w+)", sec)
        tb = sec.split("### 決めたこと", 1)
        if not d or not st or st.group(1) != "confirmed" or len(tb) < 2:
            continue
        rows = [r for r in tb[1].split("\n") if r.startswith("| ") and not r.startswith("| 項目") and not r.startswith("|---")]
        need |= {f"{d.group(1)}.{i}" for i, r in enumerate(rows, 1) if re.match(r"^段階 ?2", r.strip().strip("|").split("|")[0].strip())}
    have = {x for t in ts for x in t.get("decisions", [])}
    m = sorted(c for c in need if c not in have and c.split(".")[0] not in have)
    if m:
        fails.append(("KC6", f"後回しの決定を持つチケットが無い {m}"))

    # KC7・KC8：まとまり（節目の下の段）ごとに数える
    byid = {t["id"]: t for t in ts}
    def unit(t):  # そのチケットが属するまとまり（親が節目のチケット）。節目そのものは自分
        cur = t
        while cur.get("parent") and byid.get(cur["parent"], {}).get("parent"):
            cur = byid[cur["parent"]]
        return cur["id"]
    m7, m8 = [], []
    for e in E:
        o = e["operation_id"]
        exp = owner_o.get(o, [])
        if len(exp) > 1:
            m7.append(f"{o}（{'・'.join(t['id'] for t in exp)}）")
            continue
        units = {unit(t) for s in e.get("screens", []) for t in owner_s.get(s, [])}
        if not exp and len(units) > 1:
            m7.append(f"{o}（画面を {'・'.join(sorted(units))} で分けているのに、どこにも明示していない）")
        if not exp:
            split_units = [u for u in units if byid[u].get("split") != "これから"]
            if split_units and len(units) == 1:
                m8.append(f"{o}（{split_units[0]} は切ってあるのに子の apis に無い）")
    if m7:
        fails.append(("KC7", f"API の割り当てが二重か宙ぶらりん {len(m7)} {m7[:4]}"))
    if m8:
        fails.append(("KC8", f"切ったまとまりの子に入っていない API {len(m8)} {m8[:4]}"))

    if a.only:
        fails = [f for f in fails if f[0] in a.only]
    pend_s = sorted(s for s in v1s if s in owner_s and not any(leaf(t) for t in owner_s[s]))
    pend_o = sum(1 for e in E if ep_owners(e) and not any(leaf(t) for t in ep_owners(e)))
    print(f"画面 {len(v1s)}（まだ切っていない {len(pend_s)}）／ API {len(E)}（まだ切っていない {pend_o}）／ 行為 {len(v1a)} ／ 1 作業のチケット {sum(1 for t in ts if leaf(t))}")
    for k, x in fails:
        print(f"  ★ [{k}] {x}")
    sel = "・".join(a.only) if a.only else "KC1〜KC8"
    print(f"PASS — {sel} すべて緑" if not fails else f"FAIL — {len(fails)} 件")
    return 0 if not fails else 2


if __name__ == "__main__":
    sys.exit(main())
