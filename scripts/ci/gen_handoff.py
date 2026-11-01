#!/usr/bin/env python3
"""発注者確認の手順（Rule 12）を操作要素の一覧から機械で出す。1 チケット＝1 本＝単体で触れる。

  python3 scripts/ci/gen_handoff.py --tickets 07_tasks/tickets.json --screens 07_functional/screens.json \
      --ops 07_qa/test-specs/ops --spec 07_qa/test-specs --out 07_tasks/handoff --base http://127.0.0.1:3124 [--task T-U-05 …]

規則:
  H1 そのチケットだけで完結させる。前に要るもの（入る・データを置く）を「その前に」に書く
  H2 **今は押せない要素を手順に入れない**。正本の結果列が BLOCKED の行は「今はまだ（理由）」に回す（押して 404 を踏ませない）
  H3 1 手順＝1 操作＋**何が起きれば OK か**（期待は正本の行から引く）
  H4 末尾に `OK: YYYY-MM-DD 名前`（op_gate.py の O3 が読む）。既にある OK／NG の行は再生成で消さない
プロジェクト名は持たない。
"""
from __future__ import annotations
import argparse, glob, json, os, re, sys

VERB = {"button": "押す", "link": "押す", "input": "入れる", "checkbox": "切り替える", "select": "選ぶ", "textarea": "入れる", "tab": "押す", "toggle": "開く", "error": "わざと起こす", "radio": "選ぶ"}
EXPECT = {"button": "画面が変わる・保存される・文言が出る（押しても何も起きないなら NG）", "input": "入れた値がそのまま入る（送信に載る）",
          "textarea": "入れた値がそのまま入る（送信に載る）", "checkbox": "切り替わる", "radio": "選べる", "select": "選べる",
          "tab": "中身が入れ替わる", "toggle": "開く・閉じる"}
ORDER = {"input": 0, "textarea": 0, "checkbox": 1, "radio": 1, "select": 1, "button": 2, "tab": 3, "toggle": 3, "link": 4, "error": 5}
# 押した結果が種類だけでは言えない的は、ここで言葉にする（発注者が何を見ればよいか分かるように）
WIDTHS = [   # レスポンシブ（G-05）。仕様の「横溢れ」1 行を、幅ごとに触って確かめる形にほどく
    (375, "横スクロールが出ない。文字が読める大きさ（11px 以上）で、入力欄を押しても勝手に拡大しない（16px 以上）。ボタンが指で押せる（24px 以上）。スマホで使わせない画面なら『PC で開いてください』と出て、崩れた画面を見せない"),
    (768, "横スクロールが出ない。ヘッダ・ナビが箱からはみ出さない（縮んだタブ・チップの文字が切れない）"),
    (1024, "横スクロールが出ない。第2ナビと本文が重ならない"),
    (1440, "横スクロールが出ない。本文が 720px 以上あり、左に寄らない"),
]

BY_LABEL = {"パスワードを表示": "伏せ字（●●●）が読める文字に変わる。アイコンが目に斜線になり、もう一度押すと伏せ字に戻る"}


def load_rows(spec: str) -> dict[str, dict]:
    rows = {}
    for fp in glob.glob(os.path.join(spec, "**", "*.md"), recursive=True):
        for ln in open(fp, encoding="utf-8"):
            if not ln.startswith("| ") or ln.startswith("| ID "):
                continue
            c = [x.strip() for x in ln.strip().strip("|").split("|")]
            if len(c) < 11 or not re.match(r"^[A-Z]", c[0]):
                continue
            rows[c[0]] = {"view": c[2], "item": c[3], "pre": c[4], "steps": c[5], "expect": c[6], "result": c[7], "note": c[8]}
    return rows


def op_row(rows: dict, tid_rows: list[str], key: str) -> dict | None:
    """備考 op=<key> の行を引く（結果が BLOCKED なら手順に入れない）"""
    for rid in tid_rows:
        r = rows.get(rid)
        if r and r["view"] == "操作" and r["note"].strip() == f"op={key}":
            return {**r, "id": rid}
    return None


# このチケットで決めたこと（仕様の行）のうち、人が画面で触って確かめられるもの。機械だけで見る行（API・RLS・判定・押せるものの一覧・状態の見た目・役割）は除く
MACHINE_VIEW = re.compile(r"^(API|RLS|G-1\d|状態$|役割$|本人のもの|操作$|メール$|共通シェル$|発注者確認$|エラーが出ない$|文言と一手が正しい$|到達性$|横溢れ$|空・止まっている$|主アクション$|役割の出し分け$|前提が揃っている$|置き場$|資格情報$|残さない$|他人の分$)")
# 人が画面から起こせない条件（時刻・鍵・置き場・回線を裏で壊す）を作る行も、人の手順には入れない（試験が見る）
MACHINE_HOW = re.compile(r"(時刻を|時間前にする|無効な値|書けなくして|落とす|ネットワークを切る|30 分待つ|上限に当たった|data-|endpoint|別 GET|cover|^N/A)")
MACHINE_STEP = re.compile(r"(依存の一覧|node |python3|pnpm|vitest|CI |ci:|scripts/|自己検査|単体試験|\.test\.)")


def own_checks(rows: dict, l1: list[str]) -> tuple[list[str], list[str]]:
    """チケットの L1 行のうち人が触って確かめるもの → (手順, 今はまだのもの)"""
    steps, later = [], []
    for rid in l1:
        r = rows.get(rid)
        if not r or MACHINE_VIEW.match(r["view"]) or MACHINE_STEP.search(r["steps"] + r["pre"]) or MACHINE_HOW.search(r["item"] + " " + r["steps"]):
            continue
        if "生成元から消えた" in r["note"]:
            continue
        if r["result"].startswith("BLOCKED"):
            later.append(f"{r['item'][:50]} … {reason(r['result'])[:70]}")
            continue
        pre = f"（前提：{r['pre']}）" if r["pre"] and r["pre"] not in ("—", "-") else ""
        how = re.sub(r"（実ブラウザ）", "", r["steps"]).strip() or "触る"
        steps.append(f"{r['item']}{pre}：{how} → **{r['expect']}**")
    return steps, later


def reason(text: str) -> str:
    m = re.search(r"（(.+)）\s*$", text.strip())
    return (m.group(1) if m else text).strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickets", required=True); ap.add_argument("--screens", required=True); ap.add_argument("--ops", required=True)
    ap.add_argument("--spec", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--task", action="append", default=[]); ap.add_argument("--base", default="http://127.0.0.1:3124")
    a = ap.parse_args()
    # 画面の言葉と手順の言葉をそろえる（モックは例の人の名前で描く。実物はまだその名前を持たない）
    cfgp = os.path.join(a.spec, "handoff.json")
    rewrite: dict[str, str] = (json.load(open(cfgp, encoding="utf-8")).get("label_rewrite") or {}) if os.path.exists(cfgp) else {}
    def say(t: str) -> str:
        for k, v in rewrite.items():
            t = t.replace(k, v)
        return t
    S = {s["id"]: s for s in json.load(open(a.screens, encoding="utf-8"))["items"]}
    T = json.load(open(a.tickets, encoding="utf-8"))["tasks"]
    rows = load_rows(a.spec)
    jp = os.path.join(a.spec, "journeys", "plan.json")
    J = json.load(open(jp, encoding="utf-8"))["rows"] if os.path.exists(jp) else []
    needs_login = {s["id"]: s.get("needs_login", True) for s in json.load(open(a.screens, encoding="utf-8"))["items"]}
    os.makedirs(a.out, exist_ok=True)
    n = 0
    for t in T:
        if a.task and t["id"] not in a.task:
            continue
        sids = t.get("screen_ids") or []
        flows = ((t.get("qa_rows") or {}).get("l2_flows") or []) if t.get("deliverable_layer") == "integration" else []
        if not sids and not flows and not t["id"].startswith("T-US-"):
            continue
        l1 = (t.get("qa_rows") or {}).get("l1") or []
        steps: list[str] = []
        later: list[str] = []
        before: list[str] = []
        for sid in sids:
            s = S.get(sid, {})
            route = s.get("route") or "/" + sid
            if needs_login.get(sid, True):
                before.append("先に入っておく（下の『入っておく』）")
            op = os.path.join(a.ops, f"{sid}.json")
            ops = json.load(open(op, encoding="utf-8"))["ops"] if os.path.exists(op) else []
            # 見出しは画面の名前で言う。モックの h1 は例の人の名前（「高本AI」）が入っていることがあり、
            # そのまま手順に書くと、正しい画面を見た人が NG を付けてしまう
            _h1 = s.get("name") or s.get("h1_text", "")
            steps.append(f"**{a.base}{route}** を開く。見出しが「{_h1}」で、横にスクロールしない")
            if t.get("deliverable_layer") != "ui":
                continue   # 画面の押せるもの一つひとつは、その画面のチケットの手順にある。ここではこのチケットで決めたことだけを確かめる
            seen = set()
            for o in sorted(ops, key=lambda o: ("" if o["states"][0] == "共通" else o["states"][0], ORDER.get(o["kind"], 9))):
                k = (o["kind"], o["label"])
                if k in seen:
                    continue
                seen.add(k)
                r = op_row(rows, l1, o["key"])
                label = o["label"][:40]
                if r and r["result"].startswith("BLOCKED"):
                    later.append(f"「{label}」… {reason(r['result'])[:70]}")
                    continue
                st = "" if o["states"][0] == "共通" else f"（状態：{o['states'][0]}）"
                if o["kind"] == "error":
                    steps.append(f"わざと「{label}…」になる操作をする{st} → **その文言と、直す導線が出る**")
                elif o["kind"] == "link":
                    dest = (S.get(o["target"], {}).get("route") or ("/" + o["target"])) if o.get("target") else ""
                    name = S.get(o.get("target") or "", {}).get("name", "")
                    steps.append(f"「{label}」を押す{st} → **{dest} が開く**（{name}）。戻る" if dest else f"「{label}」を押す{st} → **リンク先が開く**（戻る）")
                else:
                    exp = BY_LABEL.get(o["label"]) or EXPECT.get(o["kind"]) or (r["expect"] if r else "").split("（")[0][:44] or "何かが起きる"
                    steps.append(f"「{label}」を{VERB.get(o['kind'], '押す')}{st} → **{exp}**")
        _own, _own_later = own_checks(rows, l1)   # このチケットで決めたこと（2026-10-01 user「手動でのテストを現状でできるものを全て」）
        steps += _own
        later += _own_later
        for f in flows:   # 流れ（L2）：ジャーニーの行を順番に、1 行＝1 手順
            for r in [x for x in J if x.get("journey") == f]:
                scr = S.get(r.get("screen") or "", {})
                where = f"（{a.base}{scr.get('route')}）" if scr.get("route") else ""
                steps.append(f"{r['step']}{where} → **{r['expected']}**")
        for sid in sids:   # メール（関門 C6）に触る画面：受信箱を開いて見る（機械では読めない）
            if any(r and r["view"] == "メール" for r in (rows.get(x) for x in l1)):
                steps.append("**自分の受信箱**を開く → **届いている**（迷惑メールも見る）。件名・差出人・本文が読め、リンクを押すと目的の画面が開く")
                steps.append("本文を読む → **内部の言葉（ID・テーブル名）が無く、誰宛てで何をすればよいかが分かる**")
                steps.append("`.dev-logs/api.log` の `[mail]` の行を見る → **「送った → 自分のアドレス」が出ている**。「送れなかった」が出ていたら、その理由が NG の中身")
                break
        for sid in (sids if t.get("deliverable_layer") == "ui" else []):   # レスポンシブ：幅ごとに 1 行（1 画面 1 回だけ。画面のチケットで）
            s = S.get(sid, {})
            route = s.get("route") or "/" + sid
            for w, exp in WIDTHS:
                steps.append(f"ブラウザの幅を **{w}px** にして **{a.base}{route}** を開き直す → **{exp}**")
        if t["id"].startswith("T-US-"):
            steps.append(f"**{a.base}/dev/shell** を開き、役割（R1〜R6）と時点（PS0〜PS4）を切り替えて、サイドバー・下タブ・自分のAIのパネルの項目を押す（見本の画面。dev でだけ出る）")
        if not steps:
            continue
        steps = [say(x) for x in steps]
        later = [say(x) for x in later]
        fp = os.path.join(a.out, f"{t['id']}.md")
        keep = [ln.rstrip("\n") for ln in open(fp, encoding="utf-8")] if os.path.exists(fp) else []
        keep = [x for x in keep if re.match(r"^(OK|NG):", x.strip()) and "YYYY" not in x]   # 見本の行は残さない
        head = "登録から最後まで、止めずに続けて通します。" if flows else "この 1 枚を触って確かめます。"
        body = [f"# {t['id']} {t['title']}", "", f"発注者が触って確かめる手順です。所要 15〜30 分。**dev（ローカル）で確かめます。** {head}", "",
                "## その前に", "", "1. `bash scripts/dev/up.sh` を実行する（DB → API → 画面が立つ）"]
        if before:
            body += [f"2. {a.base}/signup で会社を作る（メールの確認リンクは `.dev-logs/api.log` の「verify →」の行をブラウザに貼る）", "3. そのまま入った状態で下へ"]
        flow_screens = [r.get("screen") for f in flows for r in J if r.get("journey") == f]
        if any(":" in (S.get(x, {}).get("route") or "") for x in list(sids) + flow_screens):
            body += ["", "招待の URL は画面がまだ無いので、次で作ってください（出た URL をブラウザに貼る）。", "",
                     "```bash", "bash scripts/dev/invite.sh", "```"]
        body += ["", "## 手順", ""] + [f"{i}. {st}" for i, st in enumerate(steps, 1)]
        if later:
            body += ["", "## 今はまだ押せないもの（理由つき・触らなくてよい）", ""] + [f"- {x}" for x in sorted(set(later))]
        body += ["", "## 結果", "",
                 "よければ次の 1 行を書いて保存してください（このまま貼って、日付と名前を変える）。",
                 "", "```", "OK: YYYY-MM-DD 名前", "```", "",
                 "違うところがあれば `NG: 何が違うか` を書いてください。1 行で構いません。", ""] + keep
        open(fp, "w", encoding="utf-8").write("\n".join(body) + "\n")
        n += 1
    print(f"手順 {n} 本 → {a.out}（base {a.base}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
