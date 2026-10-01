#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""決定のトレーサビリティを双方向で検査する（.claude/rules/common/decision-traceability.md §5 の正本実装）

 「決めたのに反映されていない」を人の記憶ではなく機械で捕まえる。
 T1〜T7 のどれか1つでも落ちたら exit 1。下流スキルはこれが緑になるまで進めない。

 T8（2026-09-15 追加）: 決定 ID を「参照した」だけでは、決定の中身が全部反映されたことにならない。
   §42 の顧客側の行を画面にして §42 を参照した時点で、運営側の行（明示的許可＋証跡・退会時の消去）に画面が無くても
   T1〜T7 は緑だった。だから決定を「文」（節の「### 決めたこと」表の 1 行 = D-042.3）に割り、文ごとに参照を検査する。
   source に "D-042.3" のように文の番号を書く。文の無い決定（表が無い）は T8 の対象外。
   検査対象は spec-dependencies.yaml の decision_traceability.clauses（since: 日付 / ids: [...]）で決め、
   それ以外の決定は「文の被覆」を報告だけする（--clauses で一覧）。
 T7（2026-09-10 追加）: reflect_in は決定を書いた本人が書くので、狭く書けば T6 は素通りする。
   だから「必ず参照されるべき層」（要件のまとめ 等）は spec-dependencies.yaml の required_layers に固定し、
   confirmed の決定が全部そこから参照されているかを検査する。要件一覧（requirements_index）は
   正本から機械生成し、手で書いた要約が正本になりすまさないようにする（--index で生成、T7 で鮮度を検査）。

T12（2026-09-27 追加）: 決定のメタ amends: [D-xxx.n] で「別の決定の文を改めた」ことを書く。改められた文を根拠に持つ要素が
  改める決定を持っていなければ赤（前提が変わったのに置き場・設計が古いまま、を機械で出す）。

使い方:
  python3 trace_gate.py                  # spec-dependencies.yaml の decision_traceability を読んで全検査
  python3 trace_gate.py --json           # CI 用
  python3 trace_gate.py --snapshot       # T5 の基準（前回の節数・参照数）を更新
  python3 trace_gate.py --report         # 未反映の決定を一覧で出す（作業指示になる）
  python3 trace_gate.py --index          # 要件一覧（requirements_index.file）を正本から生成する
  python3 trace_gate.py --clauses        # 決定ごとの「文の被覆」（何行のうち何行が画面・導出物に出たか）を一覧
"""
import argparse, json, os, re, sys, yaml, glob

SNAP = ".spec-sync/trace-snapshot.json"


# ---------------------------------------------------------------- 正本の読み取り
def load_decisions(cfg):
    """正本（決定ログ等）から決定を読む。
       HTMLコメントのメタ（decision/status/...）があればそれを使い、
       無ければ節見出しから ID を機械生成する（移行期を通せるように）。"""
    out = {}
    for src in cfg["sources"]:
        p = src["file"]
        if not os.path.exists(p):
            out.setdefault("_missing", []).append(p); continue
        t = open(p, encoding="utf-8").read()
        heads = list(re.finditer(src.get("section_regex", r"^## (\d+)\.\s*(.+)$"), t, re.M))
        for i, m in enumerate(heads):
            num, title = m.group(1), m.group(2).strip()
            body = t[m.end(): heads[i + 1].start() if i + 1 < len(heads) else len(t)]
            meta = {}
            cm = re.search(r"<!--\s*(decision:.*?)-->", body, re.S)
            if cm:
                # HTMLコメント内は行頭が揃っていないので、各行の先頭空白を落としてから読む
                raw = "\n".join(l.strip() for l in cm.group(1).strip().split("\n") if l.strip())
                try:
                    meta = yaml.safe_load(raw) or {}
                    if not isinstance(meta, dict): meta = {}
                except Exception as e:
                    meta = {"_parse_error": str(e)[:80]}
            did = str(meta.get("decision") or f"{src.get('id_prefix','D-')}{int(num):03d}")
            clauses = _clauses(body, src.get("clause_heading", r"^###\s*決めたこと"))
            out[did] = {
                "clauses": clauses,                                   # [(n, 題名)]
                "clauses_out": {str(k): v for k, v in (meta.get("clauses_out") or {}).items()},
                "clauses_noobj": {str(k): v for k, v in (meta.get("clauses_noobj") or {}).items()},
                "amends": [str(x) for x in (meta.get("amends") or [])],   # この決定が改める別の決定の文（T12）
                "id": did, "section": num, "title": title, "file": p,
                "status": meta.get("status", "unlabeled"),
                "decided_at": meta.get("decided_at"),
                "reflect_in": meta.get("reflect_in") or [],
                "summary": meta.get("summary"),
                "reason": meta.get("reason"),
                "has_meta": bool(cm),
                "parse_error": meta.get("_parse_error"),
            }
    return out


def _clauses(body, heading_re):
    """節の「### 決めたこと」の直後の表の各行を「文」として取り出す。1 行 = D-xxx.n。表が無ければ空"""
    m = re.search(heading_re, body, re.M)
    if not m: return []
    rows, started = [], False
    for line in body[m.end():].split("\n"):
        s = line.strip()
        if not s.startswith("|"):
            if started: break
            if s.startswith("#"): break
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        if not started:
            started = True; continue            # ヘッダー
        if set("".join(cells)) <= set("-: "): continue
        title = re.sub(r"\*\*|`", "", cells[0]).strip()
        if title: rows.append((len(rows) + 1, title[:40]))
    return rows


def _base(ref):
    """'D-042.3' → 'D-042'"""
    return str(ref).split(".")[0]


# ---------------------------------------------------------------- 導出物の読み取り
def _dig(obj, path):
    """'backbone[*].acts[*]' のような簡易パスで要素を列挙する"""
    cur = [obj]
    for seg in path.split("."):
        nxt = []
        key, star = (seg[:-3], True) if seg.endswith("[*]") else (seg, False)
        for c in cur:
            if not isinstance(c, dict) or key not in c: continue
            v = c[key]
            if star and isinstance(v, list): nxt.extend(v)
            elif star and isinstance(v, dict): nxt.extend(v.values())   # blueprint のように dict で持つ導出物
            elif not star: nxt.append(v)
        cur = nxt
    return [c for c in cur if isinstance(c, dict)]


def load_products(cfg):
    """導出物の各要素と、その source を集める"""
    elems, missing = [], []
    # file はグロブ可（06_mockup/v1/*.html 等）。1つも無ければ「導出物が無い」
    flat = []
    for pr in cfg["products"]:
        hits = sorted(glob.glob(pr["file"])) if any(ch in pr["file"] for ch in "*?[") else [pr["file"]]
        if not hits: missing.append(pr["file"])
        for h in hits: flat.append({**pr, "file": h})
    for pr in flat:
        p = pr["file"]
        if not os.path.exists(p):
            missing.append(p); continue
        fld = pr.get("source_field", "source")
        if p.endswith(".json") and pr.get("elements"):
            d = json.load(open(p, encoding="utf-8"))
            for path in pr.get("elements", []):
                for e in _dig(d, path):
                    elems.append({"file": p, "path": path,
                                  "id": e.get("id") or e.get("name") or "?",
                                  "source": e.get(fld) or []})
        else:   # テキスト系は本文中の決定ID参照だけを拾う（要素単位の検査はしない）
            t = open(p, encoding="utf-8").read()
            for did in set(re.findall(pr.get("ref_regex", r"\b(D-\d{3}(?:\.\d+)?)\b"), t)):
                elems.append({"file": p, "path": "(text)", "id": "(text)", "source": [did]})
    return elems, missing


# ---------------------------------------------------------------- 検査
def run(cfg, snapshot):
    D = load_decisions(cfg)
    missing_src = D.pop("_missing", [])
    elems, missing_prod = load_products(cfg)
    oos = {str(x["section"]): x.get("reason") for x in cfg.get("out_of_scope", [])}

    referenced, ref_full, ref_kind = {}, {}, {}
    for e in elems:
        for s in e["source"] or []:
            referenced.setdefault(_base(s), []).append(f'{e["file"]}#{e["id"]}')     # 節（決定）単位
            ref_full.setdefault(str(s), []).append(f'{e["file"]}#{e["id"]}')         # 文（D-xxx.n）単位
            ref_kind.setdefault(str(s), set()).add(str(e.get("path") or ""))          # 文 → 要素の種類（objects[*] 等）

    fails, warns = [], []

    # T1 決定 → 導出物
    unref = [d for d in D.values()
             if d["status"] in ("confirmed", "unlabeled")
             and d["id"] not in referenced
             and d["section"] not in oos]
    if unref:
        fails.append(("T1", "どの導出物からも参照されていない決定（＝未反映）",
                      [f'{d["id"]} §{d["section"]} {d["title"][:44]}' for d in unref]))

    # T2 導出物 → 決定
    nosrc = [e for e in elems if e["path"] != "(text)" and not e["source"]]
    if nosrc:
        fails.append(("T2", "source を持たない導出物の要素",
                      [f'{e["file"]}#{e["id"]}' for e in nosrc]))

    # T3 参照の実在
    ghost = sorted({s for s in referenced if s not in D and re.match(r"^D-\d{3}", str(s))})   # "(基盤)" 等の印は決定 ID ではない（feature-decomposition の規約）
    for s in ref_full:
        if "." in s and _base(s) in D:
            n = s.split(".", 1)[1]
            if not n.isdigit() or int(n) > len(D[_base(s)]["clauses"]): ghost.append(f"{s}（文が無い）")
    if ghost:
        fails.append(("T3", "存在しない決定IDを指している source", ghost))

    # T4 スコープ外の理由
    noreason = [s for s, r in oos.items() if not r]
    if noreason:
        fails.append(("T4", "理由の無い out_of_scope", [f"§{s}" for s in noreason]))

    # T5 正本の増加を検出
    if snapshot:
        if len(D) > snapshot.get("decisions", 0) and len(referenced) <= snapshot.get("referenced", 0):
            fails.append(("T5", "決定が増えたのに参照が増えていない",
                          [f'決定 {snapshot.get("decisions")}→{len(D)} / '
                           f'参照 {snapshot.get("referenced")}→{len(referenced)}']))

    # T6 reflect_in の履行
    bad_reflect = []
    for d in D.values():
        if d["status"] != "confirmed" or not d["reflect_in"]: continue
        hit = referenced.get(d["id"], [])
        for layer in d["reflect_in"]:
            if not any(str(layer).split("/")[0] in h for h in hit):
                bad_reflect.append(f'{d["id"]} の reflect_in「{layer}」に参照が無い')
    if bad_reflect:
        fails.append(("T6", "reflect_in に挙げた層に参照が無い", bad_reflect))

    # T8 文の被覆（決定 ID の参照ではなく、決めたことの 1 行ごとに導出物があるか）
    ccfg = cfg.get("clauses") or {}
    since, ids = str(ccfg.get("since") or ""), set(ccfg.get("ids") or [])
    all_blocking = bool(ccfg.get("all"))
    t8, t9, t10 = [], [], []
    ASSET = re.compile(str(ccfg.get("object_words") or r"アップロード|配布|配る|版|資産|マスタ|台帳|一覧|正本|記録|履歴|定義"))
    if ccfg.get("require_table"):
        for d in D.values():
            if d["status"] == "confirmed" and not d["clauses"] and d["section"] not in oos:
                t9.append(f'{d["id"]} §{d["section"]} {d["title"][:40]}：### 決めたこと の表が無い（1 行 = 1 文に割る）')
    for d in D.values():
        d["clause_cov"] = None
        if d["status"] != "confirmed" or not d["clauses"] or d["section"] in oos: continue
        hit = [n for n, _ in d["clauses"] if f'{d["id"]}.{n}' in ref_full or str(n) in d["clauses_out"]]
        d["clause_cov"] = (len(hit), len(d["clauses"]))
        blocking = all_blocking or d["id"] in ids or (since and str(d.get("decided_at") or "") >= since)
        d["clause_blocking"] = bool(blocking)
        if blocking:
            for n, title in d["clauses"]:
                if f'{d["id"]}.{n}' not in ref_full and str(n) not in d["clauses_out"]:
                    t8.append(f'{d["id"]}.{n} 「{title}」に導出物が無い（画面・行為・要素の source に {d["id"]}.{n} を書くか、clauses_out に理由）')
                elif ASSET.search(title) and f'{d["id"]}.{n}' in ref_full and not any(k.startswith("objects") for k in ref_kind.get(f'{d["id"]}.{n}', ())) and str(n) not in d.get("clauses_noobj", {}):
                    t10.append(f'{d["id"]}.{n} 「{title}」は 作る・配る・版・台帳 の文なのにオブジェクトから参照されていない（objects[*] の source に書くか、clauses_noobj に理由）')
    if t8:
        fails.append(("T8", "決めたことの文に導出物が無い（決定 ID を参照していても、その文は反映されていない）", t8))
    if t9:
        fails.append(("T9", "決めたことの表が無い confirmed 決定（文に割らないと文の被覆を検査できない）", t9))
    if t10:
        fails.append(("T10", "資産・配布物・台帳の文が裏側の動きとしてしか反映されていない（オブジェクトが無い＝画面も DB も出ない）", t10))

    # T12 改められた文に取り残された要素（2026-09-27・D-097.9）
    #   決定が別の決定の文を改めるときはメタに amends: [D-045.4] と書く。改められた文を根拠に持つ要素（JSON の要素・テキストの文書）が
    #   改める決定を持っていなければ赤。由来：§55 が §45 の前提（サーバーで長く動かす）を段階 1 から外したのに、置き場（Railway）が残った
    t12 = []
    by_file = {}
    for e in elems:
        if e["path"] == "(text)":
            by_file.setdefault(e["file"], set()).update(str(x) for x in e["source"] or [])
    units = [(f'{e["file"]}#{e["id"]}', {str(x) for x in e["source"] or []}) for e in elems if e["path"] != "(text)"]
    units += [(f, srcs) for f, srcs in by_file.items()]
    for d in D.values():
        if d["status"] != "confirmed" or not d["amends"]: continue
        for x in d["amends"]:
            hit = (lambda src, x=x: src == x or ("." not in x and src.startswith(x + ".")))
            for name, srcs in units:
                if any(hit(v) for v in srcs) and not any(v == d["id"] or v.startswith(d["id"] + ".") for v in srcs):
                    t12.append(f'{name} は {x} を根拠に持つが、それを改めた {d["id"]}（§{d["section"]}）を持っていない')
    if t12:
        fails.append(("T12", "改められた決定の文を根拠にしたまま取り残された要素（amends）", t12))

    # T7 必須層の被覆（reflect_in に依らず、要件のまとめ等は全 confirmed 決定を参照していなければならない）
    for layer in cfg.get("required_layers", []):
        files = layer.get("files", [])
        miss = []
        for d in D.values():
            if d["status"] != "confirmed" or d["section"] in oos: continue
            if not any(any(h.startswith(f + "#") for f in files) for h in referenced.get(d["id"], [])):
                miss.append(f'{d["id"]} §{d["section"]} {d["title"][:40]}')
        if miss:
            fails.append(("T7", f'必須層「{layer.get("name","?")}」（{", ".join(files)}）に参照が無い決定', miss))
    ri = cfg.get("requirements_index")
    if ri and os.path.exists(ri["file"]):
        if open(ri["file"], encoding="utf-8").read() != render_index(cfg, D, referenced, oos):
            fails.append(("T7", "要件一覧が正本より古い（--index で作り直す）", [ri["file"]]))
    elif ri:
        fails.append(("T7", "要件一覧が無い（--index で作る）", [ri["file"]]))

    # メタ未記入は warn（移行期を通す）
    bad_meta = [f'{d["id"]} §{d["section"]}: {d["parse_error"]}' for d in D.values() if d.get("parse_error")]
    if bad_meta:
        fails.append(("T0", "決定メタ（HTMLコメント）が読めない", bad_meta))

    nometa = [d for d in D.values() if not d["has_meta"]]
    if nometa:
        warns.append(f"メタ（decision/status/reflect_in）未記入の節: {len(nometa)} / {len(D)}")
    if missing_src:  warns.append(f"正本が見つからない: {missing_src}")
    if missing_prod: warns.append(f"導出物が見つからない: {missing_prod}")

    run.ref_full = ref_full
    return D, elems, referenced, oos, fails, warns


def _layer_name(path):
    """参照元ファイルを層の名前に丸める（mockup の html 40 枚を 1 語にする）"""
    base = os.path.basename(path)
    if re.search(r"/v\d+/.*\.html$", path): return "mockup"
    return base

def render_index(cfg, D, referenced, oos):
    """要件一覧 ── 正本の全決定を ID 順に、要約・反映先（宣言）・反映先（実測）つきで並べる。
       手で書かない。正本が変われば --index で作り直す（T7 が鮮度を検査する）。"""
    ri = cfg["requirements_index"]
    src = ", ".join(x["file"] for x in cfg["sources"])
    lines = [f"# {ri.get('title','要件一覧')}", "",
             f"> **機械生成**（`python3 scripts/ci/trace_gate.py --index`）。正本は `{src}`。手で直さない。",
             "> 「反映先（実測）」は導出物が実際に参照している層。空欄＝未反映（T1 で落ちる）。", "",
             "| 決定 | 節 | 状態 | 要件（何を守るか） | 反映先（宣言） | 反映先（実測） |", "|---|---|---|---|---|---|"]
    for d in sorted(D.values(), key=lambda x: x["id"]):
        st = d["status"]
        if d["section"] in oos: st = "out_of_scope"
        summ = (d["summary"] or d["title"]).replace("|", "／").replace("\n", " ")
        decl = ", ".join(str(x) for x in d["reflect_in"]) or "—"
        seen = sorted({_layer_name(h.split("#")[0]) for h in referenced.get(d["id"], [])})
        act = ", ".join(seen) if seen else ("（スコープ外）" if st == "out_of_scope" else "**未反映**")
        cov = d.get("clause_cov")
        if cov: act += f" ／ 文 {cov[0]}/{cov[1]}" + ("" if cov[0] == cov[1] else " **未**")
        lines.append(f"| {d['id']} | §{d['section']} | {st} | {summ} | {decl} | {act} |")
    n_conf = sum(1 for d in D.values() if d["status"] == "confirmed")
    lines += ["", f"決定 {len(D)}（confirmed {n_conf} / スコープ外 {len(oos)}）。", ""]
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--map", default="spec-dependencies.yaml")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--snapshot", action="store_true")
    ap.add_argument("--report", action="store_true")
    ap.add_argument("--index", action="store_true", help="要件一覧を正本から生成する")
    ap.add_argument("--clauses", action="store_true", help="決定ごとの文の被覆を一覧する（T8 の作業指示）")
    a = ap.parse_args()

    if not os.path.exists(a.map):
        print(f"NG: {a.map} が無い。spec-sync-orchestrator の STEP 0 で作る"); return 1
    M = yaml.safe_load(open(a.map, encoding="utf-8"))
    cfg = M.get("decision_traceability")
    if not cfg:
        print("NG: spec-dependencies.yaml に decision_traceability が無い。"
              "正本: .claude/rules/common/decision-traceability.md"); return 1

    snap = json.load(open(SNAP, encoding="utf-8")) if os.path.exists(SNAP) else None
    D, elems, referenced, oos, fails, warns = run(cfg, snap); ref_full = run.ref_full

    if a.index:
        ri = cfg.get("requirements_index")
        if not ri: print("NG: decision_traceability.requirements_index が無い"); return 1
        open(ri["file"], "w", encoding="utf-8").write(render_index(cfg, D, referenced, oos))
        print(f"{ri['file']} を生成（決定 {len(D)}）"); return 0
    if a.snapshot:
        os.makedirs(os.path.dirname(SNAP), exist_ok=True)
        json.dump({"decisions": len(D), "referenced": len(referenced)},
                  open(SNAP, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"基準を更新: 決定 {len(D)} / 参照 {len(referenced)}"); return 0

    conf = sum(1 for d in D.values() if d["status"] == "confirmed")
    if a.json:
        print(json.dumps({"ok": not fails, "decisions": len(D), "confirmed": conf,
                          "referenced": len(referenced), "out_of_scope": len(oos),
                          "elements": len(elems),
                          "fails": [{"gate": g, "title": t, "items": i} for g, t, i in fails],
                          "warns": warns}, ensure_ascii=False, indent=1))
        return 1 if fails else 0

    print(f"決定 {len(D)}（confirmed {conf} / スコープ外 {len(oos)}）"
          f" / 参照されている決定 {len(referenced)} / 導出物の要素 {len(elems)}")
    cov = round(len(referenced) / max(1, len(D)) * 100, 1)
    print(f"反映率: {cov}%")
    cl = [d for d in D.values() if d.get("clause_cov")]
    if cl:
        h = sum(d["clause_cov"][0] for d in cl); n = sum(d["clause_cov"][1] for d in cl)
        blk = [d for d in cl if d.get("clause_blocking")]
        print(f"文の被覆: {h}/{n}（決めたことの表を持つ決定 {len(cl)}・T8 の検査対象 {len(blk)}）")
    if a.clauses:
        print("\n■ 文の被覆（決定ごと。未 = 決定 ID は参照されていても、その文に導出物が無い）")
        for d in sorted(cl, key=lambda x: x["id"]):
            c = d["clause_cov"]; mark = "検査" if d.get("clause_blocking") else "報告"
            print(f'   {d["id"]} §{d["section"]} {c[0]}/{c[1]} [{mark}] {d["title"][:36]}')
            for n, title in d["clauses"]:
                ok = f'{d["id"]}.{n}' in ref_full or str(n) in d["clauses_out"]
                print(f'        {"✓" if ok else "未"} {d["id"]}.{n} {title}')
    if a.report:
        print("\n■ 未反映の決定（これが作業指示になる）")
        for d in D.values():
            if d["status"] in ("confirmed", "unlabeled") and d["id"] not in referenced \
               and d["section"] not in oos:
                print(f'   {d["id"]} §{d["section"]} {d["title"]}')
                if d["summary"]: print(f'        {d["summary"]}')
    print()
    for w in warns: print(f"  warn {w}")
    if warns: print()
    if fails:
        print(f"FAIL — {len(fails)} 件\n")
        for g, t, items in fails:
            print(f"[{g}] {t}: {len(items)} 件")
            for x in items[:14]: print(f"      - {x}")
            if len(items) > 14: print(f"      … 他 {len(items)-14} 件")
            print()
        print("下流スキルへ進んではならない。未反映の決定を反映するか、理由つきで out_of_scope にする。")
        return 1
    print("PASS — T1〜T12 すべて緑")
    return 0


if __name__ == "__main__":
    sys.exit(main())
