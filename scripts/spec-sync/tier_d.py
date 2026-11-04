#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tier D — 振る舞い波及（behavioral completeness）の機械検査。

 由来（2026-09-17）：D-120「人が直したら AI が把握する。**一部じゃなく基本どこでも**」と決めたのに、
 画面 29 枚のうち当たっていたのは 1 枚だった。それでも A/B/C/F/T は全部緑で、
 「反映率 100%」と報告できてしまった。反映率は「1 か所でも参照されていれば緑」の数字で、
 「全部に当たっている」ではない。

 SKILL.md には Tier D が書いてあったが、**スクリプトが無かった**。
 散文の指示は飛ばせる。飛ばせる指示は実装されていないのと同じ（L-004）。だから機械にする。

 検査（すべて blocking）
   D1 面の線     alignment_decisions の各件が must_be_reflected_in に「面」を持つか。
                 決定の文に「全画面」「どこでも」「すべての」「全部」「必ず」があるのに
                 画面の線（既定 mockup / screens / 画面）が無ければ FAIL。
   D2 数の宣言   面の線に count（最低何枚に当たっていること）があるか。
                 「全画面」系の決定は count: all を書く。書かないと 1 枚で緑になる。
   D3 実数       宣言した count を実物が満たすか。glob で数えて足りなければ FAIL。
   D0 分母    正本（決定ログ）で「画面に反映する」と書いた決定が、全部 alignment_decisions
              に登録されているか。**登録件数を人が決めさせない。**
              由来（2026-09-17）：D1〜D4 を作ったのに、その分母を手で書いた
              alignment_decisions（24 件）にしたため、正本の 81 件のうち 57 件が
              最初から視界の外だった。人が思い出す方式をゲートの中に作り直していた。
              件数は入力ではなく出力（L-004・L-006）。
   D5 追跡    画面に印はあるのに導出物（screens[].source）に決定が無い、
              またはその逆。実装と追跡が食い違ったまま緑にしない。
   D4 下流の線   決定が新しい要素（エンティティ・状態・操作）を必須化したのに、
                 api / schema / side_effects の線が無ければ WARN（その層が未着手なら情報のみ）。

使い方:
  python3 tier_d.py --project-root . [--map spec-dependencies.yaml] [--json]
"""
from __future__ import annotations
import argparse, glob, json, os, re, subprocess, sys

try:
    import yaml
except ImportError:
    print("FAIL — PyYAML が要ります（pip install pyyaml）"); sys.exit(2)

# 「どこでも効く」と書いた決定を見つける語
# 語彙はプロジェクトごとに違う。依存マップの tier_d: で足せる（下の load_cfg）。
#   tier_d:
#     all_words: ["全部署で", "どの拠点でも"]   # 「どこでも効く」と読む語を足す
#     screen_hints: ["ui/", "pages/"]          # 画面の線と見なす語を足す
#     screen_example: "06_mockup/v1/*.html"    # 直し方のメッセージに出す例
PRODUCT = None
SOURCES: list = []
ALL_WORDS = ("全画面", "どこでも", "すべての画面", "全部の画面", "一部じゃなく",
             "すべてに", "全部に", "必ず付く", "必ず出", "画面ごとに書かない",
             "列挙して足すのではなく", "直せる場所すべて", "直せるもの全部")
SCREEN_HINTS = ("mockup", "screens", "画面", "mock")
API_HINTS = ("api", "openapi", "endpoints")
SCHEMA_HINTS = ("ER図", "er.json", "entities", "schema", "migrations")
SIDE_HINTS = ("side_effects", "通知", "notification", "課金", "billing", "証跡", "audit")


# --- 正本・導出物・モックを「自分で見つける」-------------------------------
#  2026-09-17：ここに 01_hearing/決定ログ.md や 05_flow/flow.json を直書きしていた。
#  直書きすると、そのフォルダ名を使っていないプロジェクトでは黙って何も検査しない
#  （＝緑になる）。ファイル名はプロジェクトごとに違う。だから探す。
#  探し方は「形」で決める：決定のメタを持つ .md が正本、screens[] を持つ .json が画面の導出物、
#  画面 ID と名前が一致する .html の集まりがモック。


def resolve_sources(root: str, M: dict, ads) -> list:
    """決定の正本（決定メタ <!-- decision: --> を持つ .md）を見つける。"""
    cands, out = [], []
    dt = M.get("decision_traceability") or {}
    for x in (dt.get("sources") or []):
        if isinstance(x, dict) and x.get("file"):
            cands.append(x["file"])
    for ad in ads:
        for m in re.finditer(r"([^\s（(]+\.md)", str(ad.get("source", ""))):
            cands.append(m.group(1))
    if not cands:  # 宣言が無いときは探しに行く
        for dp, dns, fns in os.walk(root):
            dns[:] = [d for d in dns if not d.startswith((".", "node_modules"))]
            cands += [os.path.relpath(os.path.join(dp, f), root)
                      for f in fns if f.endswith(".md")]
    for rel in dict.fromkeys(cands):
        p = os.path.join(root, rel)
        if os.path.exists(p) and re.search(
                r"<!--\s*decision:", open(p, encoding="utf-8", errors="ignore").read()):
            out.append(rel)
    return out


def resolve_screens_product(root: str, M: dict):
    """画面の導出物（screens[] を持つ .json）を見つける。"""
    cands = []
    dt = M.get("decision_traceability") or {}
    for x in (dt.get("products") or []):
        f = x.get("file") if isinstance(x, dict) else x
        if f and str(f).endswith(".json"):
            cands.append(str(f))
    for k in ("flow_gate", "downstream_coverage"):
        v = M.get(k)
        if isinstance(v, dict) and str(v.get("file", "")).endswith(".json"):
            cands.append(v["file"])
    if not cands:
        for dp, dns, fns in os.walk(root):
            dns[:] = [d for d in dns if not d.startswith((".", "node_modules"))]
            cands += [os.path.relpath(os.path.join(dp, f), root)
                      for f in fns if f.endswith(".json")]
    for rel in dict.fromkeys(cands):
        p = os.path.join(root, rel)
        if not os.path.exists(p):
            continue
        try:
            d = json.load(open(p, encoding="utf-8"))
        except Exception:  # noqa: BLE001
            continue
        sc = d.get("screens")
        if isinstance(sc, list) and sc and isinstance(sc[0], dict) and "id" in sc[0]:
            return rel, sc
    return None, []


def resolve_mocks(root: str, M: dict, screens) -> tuple:
    """モックの置き場と、画面 ID → ファイルの対応を見つける。

    画面 ID と名前が一致する .html が一番多く入っているフォルダを、そのプロジェクトの
    モック置き場とみなす。接頭辞（v1- など）は自動で見つける。
    """
    ids = {s["id"] for s in screens}
    best, best_dir, best_pre = {}, None, ""
    for dp, dns, fns in os.walk(root):
        dns[:] = [d for d in dns if not d.startswith((".", "node_modules"))]
        htmls = [f for f in fns if f.endswith(".html")]
        if not htmls:
            continue
        pres = {""}
        for f in htmls:
            m = re.match(r"([A-Za-z0-9]+[-_])", f)
            if m:
                pres.add(m.group(1))
        for pre in pres:
            hit = {}
            for f in htmls:
                base = f[:-5]
                if pre and base.startswith(pre):
                    base = base[len(pre):]
                if base in ids:
                    hit[base] = os.path.join(dp, f)
            if len(hit) > len(best):
                best, best_dir, best_pre = hit, dp, pre
    return best_dir, best_pre, best


def load_cfg(M: dict):
    """プロジェクト固有の語彙を依存マップから読む（無ければ既定のまま）。"""
    c = (M.get("tier_d") or {}) if isinstance(M.get("tier_d"), dict) else {}
    words = tuple(ALL_WORDS) + tuple(c.get("all_words") or [])
    hints = tuple(SCREEN_HINTS) + tuple(c.get("screen_hints") or [])
    example = c.get("screen_example") or "画面のファイル（グロブ可）"
    return words, hints, example


def _hits(text: str, hints) -> bool:
    t = text.lower()
    return any(h.lower() in t for h in hints)


def load_sources(root: str, ads) -> dict:
    """決定ログの本文を決定 ID ごとに読む。

    ここが Tier D の肝。依存マップの `decision:` は人が書いた 1 行要約で、
    「一部じゃなく基本どこでも」のような効く範囲の指定はたいてい正本の本文にしかない。
    要約だけを見ると要約が正本になりすます（L-006）。だから本文を引く。
    """
    texts: dict[str, str] = {}
    files = SOURCES_CACHE.get("files") or []
    for rel in files:
        p = os.path.join(root, rel)
        if not os.path.exists(p):
            continue
        body = open(p, encoding="utf-8", errors="ignore").read()
        # 「<!-- decision: D-xxx …」から次の decision までを、その決定の本文とする
        marks = [(m.group(1), m.start()) for m in re.finditer(r"<!--\s*decision:\s*(D-\d+)", body)]
        for i, (did, st) in enumerate(marks):
            en = marks[i + 1][1] if i + 1 < len(marks) else len(body)
            texts[did] = texts.get(did, "") + body[st:en]
            SRC_FILES[did] = rel
    return texts


SOURCES_CACHE: dict = {}
SRC_FILES: dict = {}


def log_screen_decisions(root: str, ads) -> dict:
    """正本から「画面に反映する」と書いた決定を全部拾う（分母は正本が決める）。"""
    out = {}
    for rel in (SOURCES_CACHE.get("files") or []):
        p = os.path.join(root, rel)
        if not os.path.exists(p):
            continue
        body = open(p, encoding="utf-8", errors="ignore").read()
        marks = [(m.group(1), m.start()) for m in re.finditer(r"<!--\s*decision:\s*(D-\d+)", body)]
        for i, (did, st) in enumerate(marks):
            en = marks[i + 1][1] if i + 1 < len(marks) else len(body)
            meta = body[st:en].split("-->")[0]
            if "status: confirmed" not in meta:
                continue
            tg = reflect_targets(meta)
            if tg:
                out[did] = tg
    return out


def reflect_targets(meta: str) -> list:
    """決定のメタから reflect_in の行き先を全部取る（層を限定しない）。

    `reflect_in: [flow.json/backbone, ER図/members, mockup/backlog, アーキテクチャ設計書]`
    のような書き方から (層, 対象) を取り出す。**画面だけを特別扱いしない。**
    ここを「mockup だけ」にしていたので、ER・API・タスク・テスト・文書の未判定が
    ずっと黙っていた（2026-09-17 user「どこに対しても漏れが一切でない更新をしないといけない」）。
    """
    m = re.search(r"reflect_in:\s*\[(.*?)\]", meta, re.S)
    if not m:
        return []
    out = []
    for tok in m.group(1).split(","):
        tok = tok.strip().strip("'\"")
        if not tok:
            continue
        layer, _, target = tok.partition("/")
        out.append((layer.strip(), target.strip()))
    return out


def resolve_layer(root: str, layer: str, cache: dict) -> list:
    """層の名前（ER図 / flow.json / mockup / アーキテクチャ設計書 …）を、
    ディスクの実物に当てる。フォルダ名の付け方はプロジェクトごとに違うので探す。"""
    if layer in cache:
        return cache[layer]
    key = os.path.splitext(layer)[0].lower()
    hits = []
    for dp, dns, fns in os.walk(root):
        dns[:] = [d for d in dns if not d.startswith((".", "node_modules", "__pycache__"))]
        rel_d = os.path.relpath(dp, root)
        if key and key in rel_d.lower():
            hits.append(rel_d)
        for f in fns:
            if key and key in f.lower():
                hits.append(os.path.relpath(os.path.join(dp, f), root))
    # フォルダよりファイルを優先する。フォルダを反映先にすると
    # count の検査が「1 件も無い」で空回りする
    files = [h for h in set(hits) if os.path.isfile(os.path.join(root, h))]
    # 生成器（.py / .sh）は成果物ではない。成果物があるならそちらを選ぶ
    data = [h for h in files if not h.endswith((".py", ".sh", ".mjs", ".js", ".ts"))]
    # 層の名前がそのままファイル名なら、それが正本（flow.json は flow.html ではない）
    same = [h for h in data if os.path.basename(h).lower() == layer.lower()]
    exact = same or [h for h in data if os.path.basename(h).lower().startswith(key)]
    cache[layer] = (sorted(exact) or sorted(data) or sorted(files)
                    or sorted(set(hits)))[:6]
    return cache[layer]


def decision_ids(ad) -> list:
    return re.findall(r"D-\d+", str(ad.get("source", "")) + " " + str(ad.get("decision", "")))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project-root", default=".")
    ap.add_argument("--map", default="spec-dependencies.yaml")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--register-pairs", action="store_true",
                    help="未判定の 決定×反映先 に、確かめ方を機械で付けて地図に書く")
    ap.add_argument("--register", action="store_true",
                    help="正本にあって未登録の決定を、地図に機械生成して足す（件数を人が決めない）")
    a = ap.parse_args()
    root = os.path.abspath(a.project_root)
    mp = os.path.join(root, a.map)
    if not os.path.exists(mp):
        print(f"FAIL — 依存マップがありません: {mp}"); return 2
    M = yaml.safe_load(open(mp, encoding="utf-8")) or {}
    ads = M.get("alignment_decisions") or []
    if not ads:
        print("FAIL — alignment_decisions が空。決定を登録してから回す"); return 2

    ALLW, SCRH, EXAMPLE = load_cfg(M)
    # 正本・導出物・モックを自分で見つける（パスを直書きしない）
    global PRODUCT, SOURCES
    SOURCES = resolve_sources(root, M, ads)
    SOURCES_CACHE["files"] = SOURCES
    PRODUCT, SCREENS = resolve_screens_product(root, M)
    MOCKDIR, MOCKPRE, MOCKS = resolve_mocks(root, M, SCREENS)
    # 画面とモック（Kaname ではキャンバスの絵）の対応表を地図が名指ししていれば、ファイル名で探さずにそれを読む（K-45）
    smi = M.get("screen_mock_index") or {}
    if smi.get("file") and os.path.exists(os.path.join(root, smi["file"])):
        idx = json.load(open(os.path.join(root, smi["file"]), encoding="utf-8"))
        MOCKDIR = os.path.join(root, smi.get("dir", ""))
        MOCKPRE = ""
        MOCKS = {sid: os.path.join(MOCKDIR, bs[0] + smi.get("ext", ".html"))
                 for sid, bs in (idx.get("screens") or {}).items() if bs}
    SRC = load_sources(root, ads)
    fails, warns, rows, not_started = [], [], [], []

    # D7 ID の重複。同じ番号が 2 つあると、読む側が片方を黙って落とす
    import collections
    dup = {k: v for k, v in collections.Counter(
        str(x.get("id")) for x in ads).items() if v > 1}
    if dup:
        fails.append(f"D7 地図の ID が重複している {dup}（別の決定が同じ番号を名乗ると、"
                     f"片方が黙って無視される）")

    # D0 分母は正本が決める。マップに無い決定は「登録漏れ」＝検査されていない
    LOGSCR = log_screen_decisions(root, ads)
    registered = set()
    for ad in ads:
        registered |= set(decision_ids(ad))
    missing = sorted(d for d in LOGSCR if d not in registered)
    rows.append({"id": "D0", "file": "正本が反映先を持つ決定", "want": len(LOGSCR),
                 "found": len(LOGSCR), "hit": len(LOGSCR) - len(missing)})
    if missing:
        fails.append(f"D0 分母が足りない：正本が反映先を書いた決定 {len(LOGSCR)} 件のうち "
                     f"**{len(missing)} 件が alignment_decisions に無い**＝検査されていない。"
                     f"件数を人が決めない（L-004）。未登録: " + " ".join(missing[:30])
                     + (f" …他 {len(missing)-30}" if len(missing) > 30 else ""))

    # D8 未判定：正本が作る 決定 × 反映先 の全組に、確かめる手段があるか。
    #  層を限定しない（画面・ER・API・タスク・テスト・文書、どれでも同じ扱い）。
    LAYER_CACHE: dict = {}
    pairs, nolayer = {}, []
    ALLW_TARGET = ("all", "*", "全画面", "すべて", "全部")
    for did, tgs in LOGSCR.items():
        expanded = []
        for layer, target in tgs:
            if target in ALLW_TARGET and MOCKS:
                expanded += [(layer, sid) for sid in sorted(MOCKS)]
            else:
                expanded.append((layer, target))
        for layer, target in expanded:
            found_layer = resolve_layer(root, layer, LAYER_CACHE)
            # 正本が層を「mockup/…」のような呼び名で書いていて、実際のフォルダ名が
            # 違う（ui/pages など）ことはよくある。見つけたモックで当てる。
            if not found_layer and target in MOCKS:
                found_layer = [os.path.relpath(MOCKS[target], root)]
            if not found_layer and target in {x["id"] for x in SCREENS}:
                found_layer = [PRODUCT or ""]
            if not found_layer:
                nolayer.append(f"{did} の reflect_in「{layer}"
                               f"{'/' + target if target else ''}」に当たる実物がプロジェクトに無い")
                continue
            pairs[(did, layer, target)] = None
    covered = {}
    for ad in ads:
        dids = decision_ids(ad)
        for r in (ad.get("must_be_reflected_in") or []):
            how = ("印" if r.get("marker") else "ゲート" if r.get("gate")
                   else "実機の証拠" if r.get("evidence")
                   else "追跡" if r.get("trace")
                   else "未着手" if str(r.get("todo") or "").strip()
                   else "効かない" if str(r.get("not_applicable") or "").strip() else None)
            if not how:
                continue
            txt = f'{r.get("file", "")} {r.get("trace", "")} {r.get("check", "")}'
            for key in list(pairs):
                did, layer, target = key
                if did not in dids:
                    continue
                if (target and target in txt) or os.path.splitext(layer)[0] in txt \
                        or r.get("gate") or r.get("evidence") \
                        or how in ("未着手", "効かない"):
                    covered[key] = how
        for k, label in (("manual", "手で見る"), ("not_applicable", "効かない"),
                         ("reason", "理由あり")):
            if ad.get(k):
                for key in list(pairs):
                    if key[0] in dids:
                        covered[key] = label
    undecided = sorted(k for k in pairs if k not in covered)
    rows.append({"id": "D8", "file": "決定 × 反映先（全層）", "want": len(pairs),
                 "found": len(pairs), "hit": len(pairs) - len(undecided)})
    if nolayer:
        fails.append(f"D8 反映先の実物が無い {len(nolayer)} 件： " + " ／ ".join(nolayer[:8])
                     + (f" …他 {len(nolayer)-8}" if len(nolayer) > 8 else ""))
    if undecided:
        bylayer: dict = {}
        for did, layer, target in undecided:
            bylayer.setdefault(layer, set()).add(did)
        fails.append(
            f"D8 未判定 {len(undecided)} / {len(pairs)} 組："
            f"確かめる手段（印・ゲート・実機の証拠・手で見る＋理由・効かない＋理由）が決まっていない。"
            + " ／ ".join(f"{k}: {len(v)} 決定" for k, v in sorted(
                bylayer.items(), key=lambda x: -len(x[1]))[:10]))

    for ad in ads:
        aid = ad.get("id", "?")
        # 「この製品では使わない」と理由つきで決めたものは検査しない（T4 と同じ扱い）。
        # 理由の無い out_of_scope は逃げ道になるので、検査対象のまま残す
        if str(ad.get("status", "")) == "out_of_scope" and str(ad.get("reason") or "").strip():
            not_started.append(f'{aid}: スコープ外（{str(ad.get("reason"))[:60]}）')
            continue
        body = "".join(SRC.get(d, "") for d in decision_ids(ad))
        text = f'{ad.get("decision","")} {ad.get("note","")} {body}'
        refs = ad.get("must_be_reflected_in") or []
        files = " ".join(str(r.get("file", "")) for r in refs)
        wants_all = any(w in text for w in ALLW)
        # 同じ決定を担う行が複数あるとき、画面の線はそのうちどれかにあればよい
        sibling_files = " ".join(
            str(r2.get("file", "")) + " " + str(r2.get("trace", ""))
            for ad2 in ads if set(decision_ids(ad2)) & set(decision_ids(ad))
            for r2 in (ad2.get("must_be_reflected_in") or []))
        has_screen = _hits(files + " " + sibling_files, SCRH)
        # 画面の線が「まだ作っていない」として理由つきで宣言されているなら、
        # 線が無いのではなく順番待ち。赤にしない（未着手は D6 が数える）
        if not has_screen and any(
                str(r2.get("todo") or r2.get("not_applicable") or "").strip()
                for ad2 in ads if set(decision_ids(ad2)) & set(decision_ids(ad))
                for r2 in (ad2.get("must_be_reflected_in") or [])):
            has_screen = True
        # まだ作っていない反映先は「未着手（理由つき）」。赤にはしないが数は出す。
        # 理由の無い放置は通さない（todo に中身が無ければ検査対象のまま）
        # まだ作っていない（todo）／この層には効かない（not_applicable）。
        # どちらも **理由が書かれているときだけ** 検査から外す
        todo_refs = [r for r in refs
                     if str(r.get("todo") or "").strip()
                     or str(r.get("not_applicable") or "").strip()]
        had_refs = bool(refs)          # 未着手を外した結果を「空」と誤らない
        refs = [r for r in refs if r not in todo_refs]
        not_started.extend(
            f'{ad.get("id")}: {r.get("todo") or r.get("not_applicable")}' for r in todo_refs)
        counts = [r for r in refs if r.get("count") is not None]
        gates = [r for r in refs if r.get("gate")]
        evids = [r for r in refs if r.get("evidence")]

        # D1 面の線
        if wants_all and not has_screen:
            fails.append(f'{aid}「{ad.get("decision","")[:34]}」: '
                         f'「どこでも効く」と書いてあるのに **画面の線が無い**'
                         f'（must_be_reflected_in に画面の線を足す。例: {EXAMPLE}）')
        elif not refs and not had_refs:
            fails.append(f'{aid}: must_be_reflected_in が空')

        # D2 数の宣言
        # 画面の線が「まだ作っていない」だけなら、数の宣言は作ってから。順番待ちを赤にしない
        only_todo = bool(todo_refs) and not refs
        if wants_all and has_screen and not counts and not gates and not evids and not only_todo:
            fails.append(f'{aid}「{ad.get("decision","")[:34]}」: '
                         f'画面の線はあるが **count も gate も無い**'
                         f'（count: all か、全画面に効かせる gate: を書く。'
                         f'どちらも無いと 1 枚当てただけで緑になる）')

        # D5 追跡：画面（導出物）の source に、その決定が載っているか。
        #  画面に実装しても導出物に書き戻さなければ、次に誰かが見たとき「入っていない」に見える。
        #  実装と追跡がずれたまま緑にしない（要約が正本になりすます・L-006）。
        for r in [x for x in refs if x.get("trace")]:
            tr = str(r.get("trace"))
            mm = re.match(r"\s*(D-[\d.]+)\s*->\s*screens:\s*\[(.*?)\]", tr)
            if not mm:
                fails.append(f'{aid}: trace の書き方が違う（"D-0xx -> screens: [a, b]"）: {tr}')
                continue
            did, want = mm.group(1), [x.strip() for x in mm.group(2).split(",") if x.strip()]
            if want and want[0] in ("all", "*", "全画面"):
                want = sorted(MOCKS)   # 「全画面」は作ってある画面すべて
            # しまった画面の見本（.html）を指す行は、画面の導出物（PRODUCT・flow.json）を読む（Kaname・K-34）
            rf = str(r.get("file") or "")
            fl = os.path.join(root, rf if rf.endswith(".json") else str(PRODUCT or rf))
            if not os.path.exists(fl):
                fails.append(f'{aid}: 導出物 {r.get("file")} が無い'); continue
            F = json.load(open(fl, encoding="utf-8"))
            by = {x["id"]: x for x in (F.get("screens") or [])}
            ghost = [sid for sid in want if sid not in by]
            miss = [sid for sid in want if sid in by and did.split(".")[0] not in
                    {y.split(".")[0] for y in (by[sid].get("source") or [])}]
            rows.append({"id": aid, "file": f"追跡 {did}", "want": len(want),
                         "found": len(want), "hit": len(want) - len(miss) - len(ghost)})
            if ghost:
                fails.append(f'{aid}: 決定が指す画面 {ghost} が {PRODUCT} に無い'
                             f'（継承元の画面名のまま／書き方が違う。'
                             f'正本の reflect_in を直す）')
            if miss:
                fails.append(f'{aid}: 画面 {miss} の source に {did} が無い'
                             f'（実装したなら {PRODUCT} に書き戻す。'
                             f'入れないと決めたなら決定の reflect_in から外す）')

        # D3c 実機の証拠
        #  実ブラウザでしか測れない決定（説明が本体を押し下げていないか・一気に見せていないか）は、
        #  シェルのゲートで回せない。だから「測った証拠のファイル」を要求する。
        #  ファイルが無い／status が pass でない／画面より古い ＝ 測っていない ＝ 赤。
        #  「実ブラウザで見ました」という自己申告を緑にしない（L-018）。
        for r in evids:
            ev = os.path.join(root, str(r.get("evidence")))
            src = sorted(f for f in glob.glob(os.path.join(root, str(r.get("file", ""))))
                         if os.path.isfile(f))
            newest = max((os.path.getmtime(f) for f in src), default=0)
            rows.append({"id": aid, "file": f'証拠: {r.get("evidence")}', "want": "gate",
                         "found": 1, "hit": 0})
            if not os.path.exists(ev):
                fails.append(f'{aid}: 実機で測った証拠 {r.get("evidence")} が無い'
                             f'（{r.get("check","")}）── 測っていないものを緑にしない')
                continue
            try:
                body = json.load(open(ev, encoding="utf-8"))
            except Exception as e:  # noqa: BLE001
                fails.append(f'{aid}: 証拠 {r.get("evidence")} が読めない（{e}）'); continue
            if str(body.get("status")) != "pass":
                fails.append(f'{aid}: 証拠 {r.get("evidence")} が pass でない'
                             f'（{body.get("status")}）'); continue
            if os.path.getmtime(ev) < newest:
                fails.append(f'{aid}: 証拠 {r.get("evidence")} が画面より古い'
                             f'（画面を作り直したら測り直す）'); continue
            rows[-1]["hit"] = 1

        # D3b ゲート（「全画面に効く」を数ではなく検査で保証する形）
        for r in gates:
            cmd = str(r.get("gate"))
            try:
                rr = subprocess.run(cmd, shell=True, cwd=root, capture_output=True,
                                    text=True, timeout=600)
            except Exception as e:  # noqa: BLE001
                fails.append(f'{aid}: gate が起動できない（{cmd}）: {e}'); continue
            rows.append({"id": aid, "file": f"gate: {cmd}", "want": "gate",
                         "found": 1, "hit": 1 if rr.returncode == 0 else 0})
            if rr.returncode != 0:
                tail = [ln for ln in rr.stdout.splitlines() if ln.strip()][-3:]
                fails.append(f'{aid}: gate が赤（{cmd}）: ' + " / ".join(t.strip() for t in tail))

        # D3 実数
        for r in refs:
            want = r.get("count")
            if want is None:
                continue
            pat = os.path.join(root, str(r.get("file", "")))
            found = [f for f in sorted(glob.glob(pat, recursive=("**" in pat)))
                     if os.path.isfile(f)]
            exc = r.get("exclude")
            if exc:
                found = [f for f in found if not re.search(exc, os.path.basename(f))]
            if not found:
                fails.append(f'{aid}: {r.get("file")} が 1 件も無い'
                             f'（count を書いた線が空を指している＝検査が空回りしている）')
                continue
            marker = r.get("marker")
            if marker:
                # marker は 1 本でも配列でもよい。配列は「全部あること」
                pats = marker if isinstance(marker, list) else [marker]
                hit = [f for f in found
                       if all(re.search(x, open(f, encoding="utf-8", errors="ignore").read(),
                                        re.S) for x in pats)]
            else:
                hit = found
            need = len(found) if str(want) == "all" else int(want)
            rows.append({"id": aid, "file": r.get("file"), "want": want,
                         "found": len(found), "hit": len(hit)})
            if len(hit) < need:
                fails.append(f'{aid}「{ad.get("decision","")[:28]}」: '
                             f'{r.get("file")} に当たっているのは **{len(hit)} / {need}**'
                             + (f'（印: {marker}）' if marker else ""))

        # D4 下流の線
        if re.search(r"エンティティ|オブジェクト|表|テーブル|状態|操作|項目", text):
            if not _hits(files, SCHEMA_HINTS):
                warns.append(f'{aid}: データの線（ER図 / entities）が無い')
            if not _hits(files, API_HINTS):
                warns.append(f'{aid}: API の線が無い（その層が未着手なら情報のみ）')

    # D6 モック ↔ 画面（双方向）。作っていない画面／どの画面でもないモックを出す。
    #  置き場もファイル名の付け方もプロジェクトごとに違うので、探して当てる。
    if SCREENS:
        want = {s2["id"] for s2 in SCREENS
                if str(s2.get("release", "")) in ("", "v1") or not s2.get("release")}
        made = set(MOCKS)
        rows.append({"id": "D6", "file": f"モック（{MOCKDIR or '見つからない'}）",
                     "want": len(want), "found": len(want), "hit": len(want & made)})
        if not MOCKDIR:
            warns.append("D6: 画面 ID と一致する .html が見つからない（まだモックが無い）")
        else:
            nomock = sorted(want - made)
            extra = sorted(made - {s2["id"] for s2 in SCREENS})
            if nomock:
                fails.append(f"D6 作っていない画面 {len(nomock)} / {len(want)}: "
                             + " ".join(nomock[:25])
                             + (f" …他 {len(nomock)-25}" if len(nomock) > 25 else ""))
            if extra:
                fails.append(f"D6 どの画面でもないモック: {' '.join(extra[:15])}")

    if a.register_pairs and undecided:
        # 未判定の組に、確かめ方を機械で付ける。人が 339 行を手で書かない（L-004）。
        #   画面の層        → 追跡（導出物の source に決定 ID があるか）
        #   それ以外の層    → 印（その成果物の中に決定 ID の参照があるか＝T6 と同じ考え方）
        # ここで「緑になる」のではなく「判定できる状態になる」。
        # 実際に反映されていないものは、この後の実行で赤として出る。
        byk: dict = {}
        for did, layer, target in undecided:
            byk.setdefault((did, layer), []).append(target)
        add, used = [], {str(x.get("id")) for x in ads}
        for (did, layer), tgs in sorted(byk.items()):
            aid_new = f"AD-{did[2:]}-{re.sub(r'[^A-Za-z0-9]', '', layer)[:10] or 'X'}"
            n2 = 2
            base = aid_new
            while aid_new in used:
                aid_new = f"{base}-{n2}"; n2 += 1
            used.add(aid_new)
            arts = resolve_layer(root, layer, LAYER_CACHE)
            is_screen = any(t in MOCKS for t in tgs) or layer.lower() in ("mockup", "screens", "画面")
            if is_screen and PRODUCT:
                line = (f"  - file: {PRODUCT}\n"
                        f"    check: 画面 {' '.join(tgs)} の source に {did} がある\n"
                        f"    trace: \"{did} -> screens: [{', '.join(tgs)}]\"\n")
            else:
                art = arts[0] if arts else ""
                isdir = bool(art) and os.path.isdir(os.path.join(root, art))
                line = (f"  - file: {art + '/**/*' if isdir else art}\n"
                        f"    check: {layer}{'/' + tgs[0] if tgs[0] else ''} に {did} の反映がある\n"
                        f"    marker: ['{did}']\n"
                        f"    count: {1 if isdir else 'all'}\n")
            summ = ""
            mm = re.search(r"summary:\s*(.+?)(?:\n|-->)", SRC.get(did, ""), re.S)
            if mm:
                summ = " ".join(mm.group(1).split())[:70]
            add.append(f"- id: {aid_new}\n"
                       f"  decision: {summ or did}\n"
                       f"  source: {SRC_FILES.get(did, '正本')}（{did}）\n"
                       f"  must_be_reflected_in:\n" + line)
        raw = open(os.path.join(root, a.map), encoding="utf-8").read()
        key = "\ndownstream_coverage:"
        pos = raw.index(key) if key in raw else len(raw)
        raw = raw[:pos] + "\n" + "".join(add) + raw[pos:]
        open(os.path.join(root, a.map), "w", encoding="utf-8").write(raw)
        print(f"未判定 {len(undecided)} 組に確かめ方を付けました（{len(add)} 件を地図に追加）。"
              f"もう一度回すと、実際に反映されていないものが赤で出ます。")
        return 2

    if a.register and missing:
        add = []
        used = {str(x.get("id")) for x in ads}
        for did in missing:
            aid_new = f"AD-{did[2:]}"
            if aid_new in used:          # 既存の ID とぶつけない（別物が同じ番号になる）
                n2 = 2
                while f"{aid_new}-{n2}" in used:
                    n2 += 1
                aid_new = f"{aid_new}-{n2}"
            used.add(aid_new)
            scr = LOGSCR[did]
            summ = ""
            mm = re.search(r"summary:\s*(.+?)(?:\n|-->)", SRC.get(did, ""), re.S)
            if mm:
                summ = " ".join(mm.group(1).split())[:70]
            # 反映先は (層, 対象) の組（reflect_targets）。層ごとに、その実物に決定の印があるかを確かめる行を作る（K-45）。
            # 画面の層（mockup・screens）だけ trace にする。以前は画面だけと思い込み、組をつなごうとして落ちていた
            items = []
            lcache: dict = {}
            for layer, tgt in scr:
                files = resolve_layer(root, layer, lcache) or []
                rel = os.path.relpath(files[0], root) if files else layer
                if layer.lower() in ("mockup", "screens") and tgt:
                    items.append(f"  - file: {PRODUCT}\n    check: 画面 {tgt} の source に {did} がある\n"
                                 f"    trace: \"{did} -> screens: [{tgt}]\"\n")
                else:
                    items.append(f"  - file: {rel}\n    check: {layer}{'/' + tgt if tgt else ''} に {did} の反映がある\n"
                                 f"    marker: [{did}]\n    count: all\n")
            add.append(
                f"- id: {aid_new}\n"
                f"  decision: {summ or did}\n"
                f"  decided_at: 正本を見る\n"
                f"  source: {SRC_FILES.get(did, (SOURCES or ['正本'])[0])}（{did}）\n"
                f"  must_be_reflected_in:\n" + "".join(items))
        raw = open(os.path.join(root, a.map), encoding="utf-8").read()
        key = "\ndownstream_coverage:"
        pos = raw.index(key) if key in raw else len(raw)
        raw = raw[:pos] + "\n" + "".join(add) + raw[pos:]
        open(os.path.join(root, a.map), "w", encoding="utf-8").write(raw)
        print(f"地図に {len(add)} 件を足しました（正本から機械生成）。もう一度回してください。")
        return 2

    out = {"tier": "D", "status": "pass" if not fails else "fail",
           "decisions": len(ads), "sources_read": len(SRC),
           "not_started": not_started, "failures": fails, "warnings": warns, "counts": rows}
    if a.json:
        print(json.dumps(out, ensure_ascii=False, indent=1)); return 0 if not fails else 2

    print(f"Tier D 振る舞い波及")
    print(f"  正本 {SOURCES}")
    print(f"  画面の導出物 {PRODUCT}（{len(SCREENS)} 画面）")
    print(f"  モック {MOCKDIR}（印 '{MOCKPRE}'・{len(MOCKS)} 枚）")
    print(f"  登録 {len(ads)} 件 / 正本が反映先を書いた決定 {len(LOGSCR)} 件")
    for r in rows:
        if str(r["want"]) == "gate":
            print(f'  {"OK" if r["hit"] else "★"} {r["id"]:<8} {r["file"]}')
            continue
        need = r["found"] if str(r["want"]) == "all" else int(r["want"])
        print(f'  {"OK" if r["hit"] >= need else "★"} {r["id"]:<8} {r["file"]:<28} '
              f'{r["hit"]} / {need}')
    if not_started:
        print(f"\n  未着手（理由つき・赤にしない） {len(not_started)} 件")
        for x in not_started[:6]:
            print("    -", x)
        if len(not_started) > 6:
            print(f"    … 他 {len(not_started)-6}")
    if warns:
        print(f"\n  warn {len(warns)} 件")
        for w in warns[:10]:
            print("    -", w)
    if fails:
        print(f"\nFAIL — 振る舞いが全部に届いていない {len(fails)} 件")
        for f in fails[:25]:
            print("  ★", f)
        if len(fails) > 25:
            print(f"  … 他 {len(fails)-25} 件")
        print("\n「決めた」は「1 か所に書いた」ではない。決めた範囲に全部届いて初めて反映。")
        return 2
    print("\nPASS — D 決めた範囲に全部届いている")
    return 0


if __name__ == "__main__":
    sys.exit(main())
