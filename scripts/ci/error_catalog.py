#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""error_catalog.py — エラー一覧（第13軸）を「導出 → 検査 → テスト行 → 報告」する（汎用。パスは全部引数で渡す）

なぜ要るか:
  エラーは「実装したのに一度も出ない」（G-08）「上流が止めるので下流に届かない」（G-02）「正しい入力でも出る」
  の 3 つの壊れ方をする。3 つとも機能テストでは出ない。だから **エラーを一覧（正本）にし、1 件ずつ
  「出る条件を作って出す」「正しい入力では出ない」「出た文言と一手が正しい」を行にして流す**。
  一覧は人が思いつきで書くと漏れるので、モックの異常状態・関門・行為の裏側・普遍の類型から機械で導出し、
  漏れをゲートで捕まえる。

コマンド:
  derive  --out errors.json [--mocks DIR] [--choke choke-points.json] [--flow flow.json] [--existing errors.json]
          モック（状態タブの異常系）・関門（横断的関心事の拒否）・行為の裏側・普遍の類型 から候補を作る。
          既存の一覧があれば足りない候補だけ追記する（上書きしない）
  gate    --catalog errors.json [--mocks DIR] [--spec DIR] [--choke choke-points.json] [--strict]
          E1 必須項目 / E2 文言（内部語・空・一手なし） / E3 モックの異常状態が一覧にある /
          E4 一覧の各行にテスト行がある / E5 重複 / E6 「起きてはいけない」は 2 層以上 /
          E7 普遍の類型が全部埋まっている（または N/A＋理由）/ E8 出ない条件（false_when）がある /
          E9 各関門に 1 件以上（--choke。where.choke_point か covers:[C1,…]）
  rows    --catalog errors.json --spec DIR
          <spec>/errors.md に L1 の行（11 列）を生成する。1 エラー＝3 行（出る／出ない／文言と一手）
  report  --catalog errors.json
          類型ごとの一覧を markdown で出す

一覧（errors.json）の 1 件:
  {"id":"E-AUTH-001","class":"auth","where":{"screen":"login","state":"e"},
   "when":"メールかパスワードが違う（5 回目までは回数を出す）","false_when":"正しい組み合わせ",
   "message":"メールアドレスかパスワードが違います。あと 4 回で 15 分ロックします",
   "action":"入力し直す／パスワードを忘れた","undo":false,
   "layers":["UI","API","DB"],"must_not":true,
   "reproduce":{"setup":"登録済みのアカウント","steps":["誤ったパスワードで送信"],"needs":"なし"},
   "severity":"high","source":["D-042"],"support_code":"AUTH-001"}
  class は普遍の類型（下の CLASSES）。N/A にするなら {"class":"payment","na":true,"reason":"…"} を置く。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Any

# ---------------------------------------------------------------- 普遍の類型（どのプロジェクトにもある壊れ方）
CLASSES = [
    ("auth",        "入れない・本人でない（認証・セッション・2 段階・口座状態の波及）"),
    ("permission",  "権限がない（役割・見える範囲・直接 URL）"),
    ("validation",  "入力が受け付けられない（必須・形式・値域・表記ゆらぎ）"),
    ("not_found",   "無い・消えた・取り消された（期限切れ・削除済み・招待取消）"),
    ("conflict",    "同時に変えた・二重（同時編集・二重送信・採番衝突・既に登録済み）"),
    ("dependency",  "行き先がない・つながらない（親が無い・紐づけ無し・未配分）"),
    ("external",    "外部が失敗した（相手サーバー・API・画面が変わった・規約で不可）"),
    ("connectivity","つながっていない（オフライン・常駐アプリ未接続・PC が閉じている）"),
    ("gate",        "関門が止めた（承認待ち・ポリシー off・宛先不許可・レート・サービス台帳）"),
    ("no_signal",   "終わったのに合図がない（完了信号なし・空応答・途中で切れた）"),
    ("limit",       "上限（プラン・サイズ・件数・レート・有限資源の枯渇）"),
    ("data",        "データが壊れている・足りない（復号失敗・移行中・スキーマ不一致）"),
    ("payment",     "支払い（失敗・期限切れ・二重課金の防止）"),
    ("timeout",     "時間切れ（長い実行・待ち・切り替わりの瞬間）"),
]
CLASS_IDS = [c for c, _ in CLASSES]

# 状態タブの表示名から「異常系」を拾う（正規表現・既定。--error-words で足す／--ignore-words で除く）
#   「つながった」「取り消す（操作）」「送った後」のような正常系を拾わないよう、否定形・完了形で書く
ERROR_WORDS = [r"失敗", r"止ま(っ|る)", r"エラー", r"期限切れ", r"送れな", r"つなが(らない|っていない)", r"取り消(し済|された)",
               r"既に", r"できな", r"見えな", r"詰ま", r"行き先", r"未配分", r"閉じて", r"ロック", r"違いま", r"無効", r"拒否", r"上限",
               r"オフライン", r"壊れ", r"判断できない", r"error", r"fail", r"expired", r"invalid", r"denied", r"offline", r"limit"]
# 文言に出してはいけないもの（顧客に見える文字列）
FORBID_IN_MESSAGE = [r"\bnull\b", r"\bundefined\b", r"\bNaN\b", r"Exception", r"Traceback", r"stack", r"\b5\d\d\b",
                     r"\b4\d\d\b", r"TypeError", r"SQL", r"\bJSON\b", r"\bA\d{2}\b", r"\bR\d\b", r"\bD-\d{3}\b",
                     r"\bC\d\b", r"goal_id", r"tenant", r"rollup", r"\bpush\b", r"\bpull\b"]
REQUIRED = ["id", "class", "when", "false_when", "message", "action", "layers", "reproduce", "severity", "source"]
SEVERITY = ["critical", "high", "medium", "low"]


def load(p: str) -> Any:
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def save(p: str, d: Any) -> None:
    os.makedirs(os.path.dirname(p) or ".", exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=1)


# ---------------------------------------------------------------- モックの異常状態を拾う
def mock_error_states(mocks: str, words: list[str], ignore: list[str] | None = None) -> list[dict]:
    """<div class="states"> の button[data-t] と、その表示名から異常系を拾う。ファイル名が画面 ID"""
    ignore = ignore or []
    out = []
    if not mocks or not os.path.isdir(mocks):
        return out
    prefix = os.path.basename(mocks.rstrip("/")) + "-"
    for f in sorted(os.listdir(mocks)):
        if not (f.startswith(prefix) and f.endswith(".html")) or "index" in f:
            continue
        sid = f[len(prefix):-5]
        t = open(os.path.join(mocks, f), encoding="utf-8", errors="ignore").read()
        m = re.search(r'<div class="states"[^>]*>(.*?)</div>', t, re.S)
        if not m:
            continue
        for b in re.finditer(r'<button[^>]*data-t="([^"]+)"[^>]*>(.*?)</button>', m.group(1), re.S):
            label = re.sub(r"<[^>]+>", "", b.group(2)).strip()
            if any(re.search(w, label, re.I) for w in words) and not any(re.search(w, label, re.I) for w in ignore):
                out.append({"screen": sid, "state": b.group(1), "label": label})
    return out


# ---------------------------------------------------------------- 導出
def derive(a: argparse.Namespace) -> int:
    words = ERROR_WORDS + [w for w in (a.error_words or "").split(",") if w]
    ignore = [w for w in (a.ignore_words or "").split(",") if w]
    existing = load(a.existing) if a.existing and os.path.exists(a.existing) else {"errors": []}
    have = {(e.get("where", {}).get("screen"), e.get("where", {}).get("state")) for e in existing["errors"]}
    have_cp = {e.get("where", {}).get("choke_point") for e in existing["errors"]} | {c for e in existing["errors"] for c in e.get("covers", [])} | \
              {e.get("choke_point") for e in existing["errors"] if e.get("na")}
    have_act = {e.get("where", {}).get("act") for e in existing["errors"]} | {e.get("act") for e in existing["errors"] if e.get("na")}
    have_scr = {e.get("where", {}).get("screen") for e in existing["errors"]}
    cands = []
    n = 0
    # 1) モックの異常状態
    for st in mock_error_states(a.mocks, words, ignore):
        if (st["screen"], st["state"]) in have:
            continue
        n += 1
        cands.append({"id": f"E-MOCK-{n:03d}", "class": "TODO", "where": {"screen": st["screen"], "state": st["state"]},
                      "when": f"TODO: 「{st['label']}」が出る条件", "false_when": "TODO", "message": "TODO: モックの文言をそのまま",
                      "action": "TODO: 次の一手", "layers": ["UI"], "must_not": False,
                      "reproduce": {"setup": "TODO", "steps": ["TODO"], "needs": "TODO"},
                      "severity": "medium", "source": ["TODO"], "_from": "mock"})
    # 2) 関門（関門ごとに 1 件以上。どの横断的関心事で止まるかは _hints に列挙）
    if a.choke and os.path.exists(a.choke):
        cp = load(a.choke)
        for c in cp.get("choke_points", []):
            if c["id"] in have_cp:
                continue
            n += 1
            cands.append({"id": f"E-GATE-{n:03d}", "class": "gate", "where": {"choke_point": c["id"]},
                          "when": f"TODO: 関門 {c['name']} が止める条件（_hints から選ぶ。1 件で足りなければ増やす）", "false_when": "TODO",
                          "message": "TODO", "action": "TODO", "layers": ["API"], "must_not": True,
                          "reproduce": {"setup": "TODO", "steps": ["TODO: 関門を通る操作で、横断的関心事を満たさない状態を作る"], "needs": "TODO"},
                          "severity": "high", "source": list(c.get("source", [])) or ["TODO"], "_from": "choke",
                          "_hints": list(c.get("cross_cutting_handled_here", []))})
    # 3) 行為の裏側（auto / backstage に外部・プロセス・通知があるもの）
    if a.flow and os.path.exists(a.flow):
        fl = load(a.flow)
        for aid, b in fl.get("blueprint", {}).items():
            txt = (b.get("auto", "") + " " + b.get("backstage", ""))
            if any(k in txt for k in ["外", "送", "実行", "通知", "呼", "起動", "接続", "トークン", "失効"]):
                if aid in have_act or b.get("screen") in have_scr:
                    continue
                n += 1
                cands.append({"id": f"E-ACT-{n:03d}", "class": "TODO", "where": {"act": aid, "screen": b.get("screen")}, "_act": aid,
                              "when": f"TODO: 行為 {aid} の裏側（{txt[:40]}…）が失敗したとき", "false_when": "TODO",
                              "message": "TODO", "action": "TODO", "layers": ["API"], "must_not": False,
                              "reproduce": {"setup": "TODO", "steps": ["TODO: 裏側を故意に壊す（止める・切る・遅らせる）"], "needs": "TODO"},
                              "severity": "medium", "source": list(b.get("source", [])) or ["TODO"], "_from": "blueprint"})
    # 4) 普遍の類型で 1 件も無いもの
    classes_have = {e.get("class") for e in existing["errors"]} | {e.get("class") for e in cands}
    for cid, desc in CLASSES:
        if cid not in classes_have:
            n += 1
            cands.append({"id": f"E-{cid.upper()}-001", "class": cid, "where": {}, "when": f"TODO: {desc}", "false_when": "TODO",
                          "message": "TODO", "action": "TODO", "layers": ["UI"], "must_not": False,
                          "reproduce": {"setup": "TODO", "steps": ["TODO"], "needs": "TODO"}, "severity": "medium",
                          "source": ["TODO"], "_from": "class", "_hint": "この類型が本当に無いなら {\"class\":\"" + cid + "\",\"na\":true,\"reason\":\"…\"} にする"})
    out = {"version": existing.get("version", "1.0"), "_doc": existing.get("_doc", "エラーの正本。1 件＝出る条件・出ない条件・文言・一手・層・再現手順。人が思いつきで足さず derive → gate で漏れを捕まえる"),
           "classes": [{"id": c, "desc": d} for c, d in CLASSES], "errors": existing["errors"] + cands}
    save(a.out, out)
    print(f"{a.out}: 既存 {len(existing['errors'])} 件 + 候補 {len(cands)} 件（TODO を埋めてから gate）")
    return 0


# ---------------------------------------------------------------- 検査
def gate(a: argparse.Namespace) -> int:
    skipped = [n for n, v in (("E3", a.mocks), ("E4", a.spec), ("E9", a.choke)) if not v]
    if skipped and not getattr(a, "allow_partial", False):
        print(f"FAIL — 検査していないものがある: {' '.join(skipped)}（--mocks --spec --choke を渡す。飛ばすなら --allow-partial を明示）"); return 2
    cat = load(a.catalog)
    errs = [e for e in cat.get("errors", []) if not e.get("na")]
    nas = [e for e in cat.get("errors", []) if e.get("na")]
    fails: list[tuple[str, str, list[str]]] = []
    warns: list[str] = []

    # E1 必須項目
    bad = []
    for e in errs:
        miss = [k for k in REQUIRED if k not in e or e[k] in ("", [], {}, None)]
        rp = e.get("reproduce", {}) if isinstance(e.get("reproduce"), dict) else {}
        if not rp.get("steps"):
            miss.append("reproduce.steps")
        if e.get("severity") not in SEVERITY:
            miss.append("severity∈" + "/".join(SEVERITY))
        if e.get("class") not in CLASS_IDS:
            miss.append("class∈普遍の類型")
        todo = [k for k in ("when", "false_when", "message", "action") if "TODO" in str(e.get(k, ""))] + \
               (["source"] if "TODO" in json.dumps(e.get("source", []), ensure_ascii=False) else []) + \
               (["reproduce"] if "TODO" in json.dumps(rp, ensure_ascii=False) else [])
        if miss or todo:
            bad.append(f'{e.get("id","?")}: 欠け {miss} TODO {todo}')
    if bad:
        fails.append(("E1", "必須項目が欠けている・TODO が残っている", bad))

    # E2 文言
    bad = []
    for e in errs:
        m = str(e.get("message", ""))
        hit = [p for p in FORBID_IN_MESSAGE if re.search(p, m)]
        if hit:
            bad.append(f'{e["id"]}: 内部語 {hit} ←「{m[:40]}」')
        if len(m) < 8:
            bad.append(f'{e["id"]}: 文言が短すぎる（何が起きたかが無い）')
        if not str(e.get("action", "")).strip():
            bad.append(f'{e["id"]}: 一手が無い')
    if bad:
        fails.append(("E2", "文言に内部語がある・何が起きたか／次の一手が無い", bad))

    # E3 モックの異常状態が一覧にある
    if a.mocks:
        words = ERROR_WORDS + [w for w in (a.error_words or "").split(",") if w]
        ignore = [w for w in (a.ignore_words or "").split(",") if w]
        have = {(e.get("where", {}).get("screen"), e.get("where", {}).get("state")) for e in errs}
        bad = [f'{s["screen"]}#{s["state"]}「{s["label"]}」' for s in mock_error_states(a.mocks, words, ignore)
               if (s["screen"], s["state"]) not in have]
        if bad:
            fails.append(("E3", "モックの異常状態が一覧に無い（一覧に足すか、異常系でないなら状態名を変える）", bad))

    # E4 テスト行
    if a.spec:
        p = os.path.join(a.spec, "errors.md")
        if not os.path.exists(p):
            fails.append(("E4", "テスト行が無い（rows で生成する）", [p]))
        else:
            t = open(p, encoding="utf-8").read()
            bad = [e["id"] for e in errs if e["id"] not in t]
            if bad:
                fails.append(("E4", "テスト行に無いエラー（rows を作り直す）", bad))

    # E5 重複
    ids = [e["id"] for e in cat.get("errors", [])]
    dup = sorted({i for i in ids if ids.count(i) > 1})
    if dup:
        fails.append(("E5", "ID の重複", dup))
    msgs: dict[str, list[str]] = {}
    for e in errs:
        msgs.setdefault(str(e.get("message", "")).strip(), []).append(e["id"])
    same = [f'{v} が同じ文言' for k, v in msgs.items() if len(v) > 1 and k]
    if same:
        warns.append("同じ文言のエラーが複数（意図的なら可）: " + "; ".join(same))

    # E6 「起きてはいけない」は 2 層以上（G-02）
    bad = [f'{e["id"]}: {e.get("layers")}' for e in errs if e.get("must_not") and len(e.get("layers", [])) < 2]
    if bad:
        fails.append(("E6", "「起きてはいけない」なのに 1 層でしか守っていない（UI/API/DB のうち 2 層以上）", bad))

    # E7 普遍の類型の被覆
    have_cls = {e.get("class") for e in errs} | {e.get("class") for e in nas if e.get("reason")}
    bad = [f'{c}（{d}）' for c, d in CLASSES if c not in have_cls]
    noreason = [e.get("class") for e in nas if not e.get("reason")]
    if bad:
        fails.append(("E7", "普遍の類型で 1 件も無く N/A の理由も無い", bad))
    if noreason:
        fails.append(("E7", "N/A に理由が無い", noreason))

    # E9 関門の被覆（--choke があるとき）：各関門に 1 件以上（where.choke_point か covers）
    if a.choke and os.path.exists(a.choke):
        cp = load(a.choke)
        have_cp = {e.get("where", {}).get("choke_point") for e in errs} | {c for e in errs for c in e.get("covers", [])} | \
                  {e.get("choke_point") for e in nas if e.get("reason")}
        bad = [f'{c["id"]} {c["name"]}' for c in cp.get("choke_points", []) if c["id"] not in have_cp]
        if bad:
            fails.append(("E9", "関門にエラーが 1 件も無い（関門が止めたとき何を出すかが未定義）", bad))

    # E8 出ない条件
    bad = [e["id"] for e in errs if len(str(e.get("false_when", "")).strip()) < 3]
    if bad:
        fails.append(("E8", "「正しい入力では出ない」条件（false_when）が無い", bad))

    print(f"エラー一覧 {len(errs)} 件（N/A {len(nas)}）／類型 {len([c for c in have_cls if c in CLASS_IDS])}/{len(CLASSES)}")
    for w in warns:
        print("  warn " + w)
    if fails:
        print(f"\nFAIL — {len(fails)} 件")
        for g, title, items in fails:
            print(f"[{g}] {title}: {len(items)} 件")
            for x in items[:14]:
                print(f"      - {x}")
            if len(items) > 14:
                print(f"      … 他 {len(items) - 14} 件")
        return 1
    print("PASS — E1〜E9 すべて緑")
    return 0


# ---------------------------------------------------------------- テスト行（L1・11 列）
def rows(a: argparse.Namespace) -> int:
    cat = load(a.catalog)
    errs = [e for e in cat.get("errors", []) if not e.get("na")]
    os.makedirs(a.spec, exist_ok=True)
    p = os.path.join(a.spec, "errors.md")
    L = ["# ERR エラー一覧 画面別テスト仕様（機械生成）", "",
         "> `error_catalog.py rows` が errors.json から生成。手で直さない。1 エラー＝3 行（出る／出ない／文言と一手）。",
         "> 出す方法は「上流を故意に壊す」（止める・切る・遅らせる・権限を落とす・上限を超える）。出せないエラーはデッドコード（G-08）。", "",
         "| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |",
         "|---|---|---|---|---|---|---|---|---|---|---|"]
    for e in errs:
        w = e.get("where", {})
        scr = w.get("screen") or w.get("choke_point") or w.get("act") or "共通"
        rp = e.get("reproduce", {})
        steps = " → ".join(rp.get("steps", []))
        setup = rp.get("setup", "")
        layers = "／".join(e.get("layers", []))
        eid = e["id"]
        L.append(f"| {eid}-A | {scr} | エラーが出る（{e.get('class')}） | {e.get('when')} | {setup} | {steps} | "
                 f"文言「{e.get('message')}」が出て、一手「{e.get('action')}」が押せる。守っている層：{layers} | | 必要なもの：{rp.get('needs','')} | | L1 |")
        L.append(f"| {eid}-B | {scr} | エラーが出ない | {e.get('false_when')} | {setup} | 正しい入力・条件で同じ操作 | "
                 f"エラーは出ず、通常どおり進む（誤検知なし） | | | | L1 |")
        undo = "取り消せる（受領の後に取り消しが出る）" if e.get("undo") else "取り消し不要／不可を正直に言う"
        L.append(f"| {eid}-C | {scr} | 文言と一手が正しい | 何が起きた・次の一手・{undo} | エラーが出た状態 | 文言を読み、一手を押す | "
                 f"内部語が無い。一手を押すと回復する（{e.get('action')}）。{'2 層以上で守っている（上流を壊しても下流が止める）' if e.get('must_not') else ''} | | 重さ：{e.get('severity')} | | L1 |")
    with open(p, "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")
    print(f"{p}: {len(errs)} エラー × 3 行 = {len(errs)*3} 行")
    return 0


def report(a: argparse.Namespace) -> int:
    cat = load(a.catalog)
    by: dict[str, list[dict]] = {}
    for e in cat.get("errors", []):
        by.setdefault(e.get("class", "?"), []).append(e)
    print("| 類型 | 件数 | 例 |")
    print("|---|---|---|")
    for c, d in CLASSES:
        es = by.get(c, [])
        ex = "N/A: " + es[0].get("reason", "") if es and es[0].get("na") else "; ".join(e.get("message", "")[:30] for e in es[:2])
        print(f"| {c}（{d}） | {len([e for e in es if not e.get('na')])} | {ex} |")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("derive"); d.add_argument("--out", required=True); d.add_argument("--mocks"); d.add_argument("--choke")
    d.add_argument("--flow"); d.add_argument("--existing"); d.add_argument("--error-words", default=""); d.add_argument("--ignore-words", default="")
    g = sub.add_parser("gate"); g.add_argument("--catalog", required=True); g.add_argument("--mocks"); g.add_argument("--spec"); g.add_argument("--choke"); g.add_argument("--allow-partial", action="store_true", help="--mocks/--spec/--choke を省いて E3/E4/E9 を飛ばすことを明示的に許す（既定は飛ばした検査があれば FAIL）")
    g.add_argument("--error-words", default=""); g.add_argument("--ignore-words", default=""); g.add_argument("--strict", action="store_true")
    r = sub.add_parser("rows"); r.add_argument("--catalog", required=True); r.add_argument("--spec", required=True)
    p = sub.add_parser("report"); p.add_argument("--catalog", required=True)
    a = ap.parse_args()
    return {"derive": derive, "gate": gate, "rows": rows, "report": report}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
