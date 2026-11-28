#!/usr/bin/env python3
"""発注者確認の入口（README）を機械で出す。「今 dev で触れるチケット」と「その順番」。

  python3 scripts/ci/gen_handoff_index.py --tickets 07_tasks/tickets.json --screens 07_functional/screens.json \
      --spec 07_qa/test-specs --out 07_tasks/handoff/README.md --base http://localhost:3124

触れる＝status done かつ画面のタスク（層 ui）。並びは はじめの設定の順（flow の画面の順）。
各行に 状態（未確認／OK／NG）を出す。手順ファイルの `OK:` を読む。
"""
from __future__ import annotations
import argparse, glob, json, os, re, sys


def state_of(fp: str) -> str:
    if not os.path.exists(fp):
        return "手順なし"
    t = open(fp, encoding="utf-8").read()
    if re.search(r"^NG:", t, re.M):
        return "NG（直し待ち）"
    if re.search(r"^OK:\s*\d{4}-\d{2}-\d{2}\s+\S+", t, re.M):
        return "OK"
    return "未確認"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickets", required=True); ap.add_argument("--screens", required=True); ap.add_argument("--spec", required=True)
    ap.add_argument("--out", required=True); ap.add_argument("--base", default="http://localhost:3124")
    a = ap.parse_args()
    S = {s["id"]: s for s in json.load(open(a.screens, encoding="utf-8"))["items"]}
    order = {sid: i for i, sid in enumerate(S)}
    T = json.load(open(a.tickets, encoding="utf-8"))["tasks"]
    done_ui = [t for t in T if t.get("status") == "done" and t.get("deliverable_layer") == "ui"]
    ready = [t for t in done_ui if t.get("screen_ids")]
    base_t = [t for t in done_ui if not t.get("screen_ids")]   # 土台（画面が無い。見本の画面で見る）
    ready.sort(key=lambda t: order.get((t.get("screen_ids") or [""])[0], 999))
    d = os.path.dirname(a.out)
    L = ["# 触って確かめる（dev・ローカル）", "",
         "作った順に 1 本ずつ触って、よければ手順ファイルの末尾に `OK: 日付 名前` を書いてください。",
         "その 1 行が入ったチケットだけ staging に上げます（dev → stg → prd）。", "",
         "## 立ち上げ", "", "```bash", "bash scripts/dev/up.sh", "```", "",
         f"- 画面 {a.base}　API http://127.0.0.1:3011", "- 止める `bash scripts/dev/up.sh --stop`／今どうなっているか `bash scripts/dev/up.sh --status`",
         "- **メールは実際に送ります（Resend・差出人は noreply@engine-base.com）。** 送信ドメインは検証済みなので、どの宛先にも届きます。送れなかったときは `.dev-logs/api.log` に「[mail] 送れなかった → …」と理由が出ます",
         "- 運営（ENGINE BASE）の宛先は **info@engine-base.com**（問い合わせの届け先・運営アカウントのログイン名）",
         f"- **メールが届かないときは {a.base}/dev/mail を開いてください。** 送ったリンクが並んでいて、そこから押して先へ進めます（ローカルで確かめるためだけの画面）",
         "- 自分のAI（自分の PC の Bridge が動かす本物の Claude Code）と話せます。先に「自分のPCをつなぐ」で Kaname Bridge を入れてつないでください。まだ作っていないものは、各手順の「今はまだ押せないもの」に理由つきで書いてあります", "",
         "## 今 触れるもの", "",
         "| # | チケット | 画面 | URL | 手順 | 状態 |", "|---|---|---|---|---|---|"]
    n = 0
    for t in ready:
        sid = (t.get("screen_ids") or [None])[0]
        s = S.get(sid, {})
        route = s.get("route", "")
        n += 1
        fp = os.path.join(d, f"{t['id']}.md")
        L.append(f"| {n} | {t['id']} | {s.get('name', t['title'][:24])} | {a.base}{route} | [{t['id']}.md]({t['id']}.md) | {state_of(fp)} |")
    # 作り終わっていて、実ブラウザで押した証拠があるが、まだ完了の印を付けていないチケット（会話・Bridge など）。触れるのに入口に出ていなかった（2026-10-01）
    proof = set()
    for fp in glob.glob(os.path.join(a.spec, "**", "*.md"), recursive=True):
        for ln in open(fp, encoding="utf-8"):
            c = [x.strip() for x in ln.strip().strip("|").split("|")] if ln.startswith("| ") else []
            if len(c) >= 11 and c[7].startswith("PASS") and "実 Chrome" in c[7]:
                proof.update(x.strip() for x in c[9].split(","))
    built = [t for t in T if t.get("status") != "done" and t["id"] in proof and os.path.exists(os.path.join(d, f"{t['id']}.md"))]
    if built:
        L += ["", "## 作り終わっていて触れるもの（完了の印はまだ）", "",
              "画面の裏側（自分のAI・Bridge・会話の動き）のチケットです。画面は上の表のものを使います。", "",
              "| チケット | 中身 | 手順 | 状態 |", "|---|---|---|---|"]
        for t in built:
            L.append(f"| {t['id']} | {t['title'][:44]} | [{t['id']}.md]({t['id']}.md) | {state_of(os.path.join(d, t['id'] + '.md'))} |")
    if base_t:
        L += ["", "## 土台（画面ではなく見本で見る）", "",
              f"サイドバー・自分のAIのパネル・部品・タイムラインは、見本の画面 **{a.base}/dev/shell**・`/dev/ui`・`/dev/views` で役割と時点を切り替えて見ます。", "",
              "| チケット | 中身 | 手順 | 状態 |", "|---|---|---|---|"]
        for t in base_t:
            L.append(f"| {t['id']} | {t['title'][:38]} | [{t['id']}.md]({t['id']}.md) | {state_of(os.path.join(d, t['id'] + '.md'))} |")
    L += ["", "## 通し（流れ）", "",
          "1 枚ずつの確認が済んだら、登録から最後まで続けて通します。今できるのは **J-01 契約・登録**（登録 → メールの確認 → 招待 → 2 段階）です。",
          f"手順は [T-I-09.md](T-I-09.md)（状態：{state_of(os.path.join(d, 'T-I-09.md'))}）。", "",
          "## 書き方", "", "```", "OK: 2026-09-20 高本", "```", "",
          "違うところがあれば `NG: 何が違うか` を 1 行で。次の回でそこだけ直します。", ""]
    # 手で足した節（確認表の URL など）は作り直しても残す
    if os.path.exists(a.out):
        prev = open(a.out, encoding="utf-8").read()
        m = re.search(r"^## 確認表.*", prev, re.M | re.S)
        if m:
            L += ["", m.group(0).rstrip()]
    open(a.out, "w", encoding="utf-8").write("\n".join(L) + "\n")
    print(f"入口 → {a.out}（触れる {n} 本）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
