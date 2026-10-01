#!/usr/bin/env python3
"""操作の実証ゲート（説明文の PASS を赤にする）。

  python3 scripts/ci/op_gate.py --spec 07_qa/test-specs --tickets 07_tasks/tickets.json --report apps/web/test-results/report.json [--report apps/e2e/test-results/report.json] --task T-U-05 [--task …] | --wave W11 --waves 08_schedule/wave-schedule.json | --all

規則（test-ladder §6・L-003 Rule 10 を機械にしたもの）:
  O1 実ブラウザで確かめる観点（既定：操作・状態・主アクション・到達性・横溢れ・空・止まっている・表記ゆらぎ・共通シェル・部品・エラー A/B/C）の行は、
     結果が PASS なら **その行 ID を名前に含む Playwright のテストが、直近の JSON 報告で passed** でなければ赤。
     説明文だけの PASS・テストが無い PASS・落ちたテストの PASS は全部赤。
  O2 結果が空の行は「未実施」で赤。BLOCKED は理由（結果か備考に「（…）」）が無ければ赤。N/A は観点「操作」には書けない（要素がモックにある）。
  O3 「発注者確認」の行は、手順ファイル（テスト項目に書いてある .md）の末尾に「OK: 日付 名前」があるときだけ PASS。無ければ BLOCKED（発注者の確認待ち）だけを許す。
  O4 報告が無い・空・仕様より古い（行の結果が書かれた後に流していない）なら、その旨を赤で出す。
観点の集合は <spec>/op-gate.json（{"evidence_views": [...], "report_max_age_h": 48}）で足せる。プロジェクト名は持たない。
"""
from __future__ import annotations
import argparse, glob, json, os, re, sys, time

DEFAULT_VIEWS = ["操作", "状態", "主アクション", "到達性", "横溢れ", "空・止まっている", "表記ゆらぎ", "共通シェル", "部品", "役割の出し分け", "見え方"]
ID_RE = re.compile(r"\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+-\d{3}(?:-[ABC])?\b")


def load_rows(spec: str) -> dict[str, dict]:
    rows = {}
    for fp in glob.glob(os.path.join(spec, "**", "*.md"), recursive=True):
        for ln in open(fp, encoding="utf-8"):
            if not ln.startswith("| ") or ln.startswith("| ID "):
                continue
            c = [x.strip() for x in ln.strip().strip("|").split("|")]
            if len(c) < 11 or not re.match(r"^[A-Z]", c[0]):
                continue
            rows[c[0]] = {"id": c[0], "file": os.path.relpath(fp), "view": c[2], "item": c[3], "result": c[7], "note": c[8], "task": c[9]}
    return rows


def load_report(paths: list[str]) -> tuple[dict[str, str], float]:
    """テスト名 → 状態（passed/failed/skipped）。
    同じ報告の中では、名前に含まれる行 ID を鍵にして最悪の状態を取る。
    報告どうしは **新しい報告が古い報告を上書きする**（「直近の報告」が真実。古い報告の失敗を、直した後の報告より優先しない）"""
    by_id: dict[str, str] = {}
    newest = 0.0
    rank = {"passed": 0, "skipped": 1, "timedOut": 2, "failed": 2, "interrupted": 2}
    for p in sorted((x for x in paths if os.path.exists(x)), key=os.path.getmtime):
        newest = max(newest, os.path.getmtime(p))
        rep = json.load(open(p, encoding="utf-8"))
        seen_here: set[str] = set()

        def walk(s, path):
            for sp in s.get("specs", []):
                title = " ".join(path + [sp.get("title", "")])
                st = "skipped"
                for t in sp.get("tests", []):
                    for r in t.get("results", []):
                        st = r.get("status", st)
                for rid in ID_RE.findall(title):
                    cur = by_id.get(rid) if rid in seen_here else None   # 別の（古い）報告の値は上書きする
                    if cur is None or rank.get(st, 2) > rank.get(cur, 0):
                        by_id[rid] = st
                    seen_here.add(rid)
            for c in s.get("suites", []):
                walk(c, path + [s.get("title", "")])

        for s in rep.get("suites", []):
            walk(s, [])
    return by_id, newest


def handoff_ok(item: str) -> tuple[bool, str]:
    m = re.search(r"(\S+\.md)", item)
    if not m:
        return False, "手順ファイルの指定が無い"
    fp = m.group(1)
    if not os.path.exists(fp):
        return False, f"手順ファイルが無い（{fp}）"
    ok = [ln for ln in open(fp, encoding="utf-8") if re.match(r"^OK:\s*\d{4}-\d{2}-\d{2}\s+\S+", ln.strip())]
    return (True, ok[-1].strip()) if ok else (False, f"{fp} に「OK: 日付 名前」が無い")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True)
    ap.add_argument("--tickets", required=True)
    ap.add_argument("--report", action="append", default=[])
    ap.add_argument("--task", action="append", default=[])
    ap.add_argument("--wave", default="")
    ap.add_argument("--waves", default="")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    cfg = {}
    cp = os.path.join(a.spec, "op-gate.json")
    if os.path.exists(cp):
        cfg = json.load(open(cp, encoding="utf-8"))
    views = set(cfg.get("evidence_views", DEFAULT_VIEWS))
    layers = set(cfg.get("layers", ["ui"]))   # 実ブラウザの証拠を要る層（既定 ui）。backend の行は契約の生成テスト（EARS）が証拠＝別ゲート
    tasks = {t["id"]: t for t in json.load(open(a.tickets, encoding="utf-8"))["tasks"]}
    targets = list(a.task)
    if a.wave:
        ws = json.load(open(a.waves, encoding="utf-8"))
        for w in (ws.get("waves", ws) if isinstance(ws, dict) else ws):
            if w.get("id") == a.wave:
                targets += w.get("l1_tasks") or w.get("tasks") or []
    if a.all:
        targets = [t for t, x in tasks.items() if x.get("status") == "done"]
    if not targets:
        print("対象のタスクが無い（--task / --wave / --all）"); return 2
    rows = load_rows(a.spec)
    # 報告の一覧は op-gate.json に 1 つだけ持つ。--report を書かなければそれを使う（呼ぶ側に書き写すと足し忘れる）
    reports = a.report or cfg.get("reports", [])
    by_id, newest = load_report(reports)
    fails: list[str] = []
    stats = {"checked": 0, "evidenced": 0, "blocked": 0, "na": 0}
    if reports and not by_id:
        fails.append(f"O4 報告が無いか空（{', '.join(reports)}）。Playwright を json reporter で流してから")
    elif newest and (time.time() - newest) > cfg.get("report_max_age_h", 48) * 3600:
        fails.append(f"O4 報告が {int((time.time() - newest) / 3600)} 時間前で古い（上限 {cfg.get('report_max_age_h', 48)} h）。流し直す")
    for tid in targets:
        t = tasks.get(tid)
        if not t:
            fails.append(f"{tid}: tickets.json に無い"); continue
        if t.get("deliverable_layer") not in layers:
            continue
        for rid in t.get("qa_rows", {}).get("l1", []):
            r = rows.get(rid)
            if not r:
                fails.append(f"{tid} {rid}: 正本に行が無い"); continue
            v = r["view"]; res = r["result"]
            is_err = bool(re.match(r"^E-.*-[ABC]$", rid))
            if not (v in views or is_err or v == "発注者確認"):
                continue
            stats["checked"] += 1
            if v == "発注者確認":
                ok, why = handoff_ok(r["item"])
                if res.startswith("PASS") and not ok:
                    fails.append(f"{tid} {rid}: 発注者確認が PASS だが {why}")
                elif res.startswith("PASS"):
                    stats["evidenced"] += 1
                elif res.startswith("BLOCKED"):
                    stats["blocked"] += 1
                else:
                    fails.append(f"{tid} {rid}: 発注者確認が未実施（{why}）。BLOCKED（発注者の確認待ち）か OK が要る")
                continue
            if not res:
                fails.append(f"{tid} {rid} [{v}]: 未実施（結果が空）"); continue
            if res.startswith("BLOCKED"):
                if "（" in res or r["note"]:
                    stats["blocked"] += 1
                else:
                    fails.append(f"{tid} {rid} [{v}]: BLOCKED に理由が無い")
                continue
            if res.startswith("N/A") or res.startswith("PASS（該当なし"):
                if v == "操作":
                    fails.append(f"{tid} {rid} [操作]: 要素がモックにある行を N/A にできない（{r['item'][:40]}）")
                else:
                    stats["na"] += 1
                continue
            if res.startswith("PASS"):
                st = by_id.get(rid)
                if st is None:
                    fails.append(f"{tid} {rid} [{v}]: PASS だが行 ID を名前に持つ実ブラウザのテストが無い（説明文の PASS）")
                elif st != "passed":
                    fails.append(f"{tid} {rid} [{v}]: PASS だがテストは {st}")
                else:
                    stats["evidenced"] += 1
                continue
            fails.append(f"{tid} {rid} [{v}]: 結果の形が読めない「{res[:30]}」（PASS／BLOCKED（理由）／N/A（理由））")
    if a.json:
        print(json.dumps({"status": "PASS" if not fails else "FAIL", "fails": fails, "stats": stats}, ensure_ascii=False, indent=1))
    else:
        for f in fails[:80]:
            print("  ✗ " + f)
        if len(fails) > 80:
            print(f"  … ほか {len(fails) - 80} 件")
        print(f"検査 {stats['checked']} 行：実ブラウザの証拠あり {stats['evidenced']}・BLOCKED {stats['blocked']}・N/A {stats['na']}・不合格 {len(fails)}")
        print("PASS — 実ブラウザで押した証拠が全部の行にある" if not fails else f"不合格 — {len(fails)} 件（説明文の PASS は証拠にならない）")
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
