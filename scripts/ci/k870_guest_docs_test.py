#!/usr/bin/env python3
"""K-870 の試験：段 12 の決定ログ §155（D-155.1〜55）・流れ（取引先を持たない・検収を作らない）・外枠の左のメニュー・親の md・正本と絵の左のメニューの字。

  python3 scripts/ci/k870_guest_docs_test.py      行 ID は K870-DC-NNN・K870-FL-NNN・K870-NV-NNN・K870-PR-NNN・K870-DS-NNN（11_tickets/K-870.md の表と 1 対 1）

決まり：
  ・取引先を別の登録として持たない（D-155.35・代表の答え answer=4961f0280e9a）。先方の人は役割「ゲスト」（DB の値 requester）・
    見え方はゲストのグループ単位（D-155.37）。左のメニューの「取引先」は「届いた依頼」になる（社内の R1・R2 だけ）。
  ・検収を作らない（D-155.44・answer=6ba09f587792）：行為 A126 と対象「検収」を消し、A123 は「チケットをゲストのグループに見せる」に言い換える。
  ・取引先と検収に当たる決定の行は superseded。どの行かは SUPERSEDED（全部）・PARTIAL（一部）が決める（この葉の PM の決め 2026-11-23）。
  ・流れの中の「取引先」の字は、段 10（決まりを物としてなくす）が外すルールの物（A131・rules・「ルール」）だけ残ってよい。
  ・取引先の口（A121 の口）と検収の口（A126 の口）は K-924・K-926 が先に契約から外す前提（11_tickets/K-870.md の依存の理由）。
テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
DECISIONS = ROOT / "01_hearing" / "決定ログ_進行中.md"
FLOW = ROOT / "05_flow" / "flow.json"
FLOWS = ROOT / "05_flow" / "flows.json"
NAV = ROOT / "apps" / "web" / "lib" / "nav.ts"
ROUTES = ROOT / "apps" / "web" / "lib" / "routes.ts"
BUILT = ROOT / "apps" / "web" / "lib" / "built-routes.ts"
K71 = ROOT / "11_tickets" / "K-71.md"
K144 = ROOT / "11_tickets" / "K-144.md"
SELF = ROOT / "11_tickets" / "K-870.md"
DESIGN = ROOT / "04_design" / "DESIGN-kaname.md"
PREVIEW = ROOT / "04_design" / "DESIGN-kaname-preview.html"
GEN_PREVIEW = ROOT / "04_design" / "gen_preview.py"
CANVAS = ROOT / "04_design" / "canvas"
CANVAS_BASE = ROOT / "04_design" / "canvas_gen" / "base"
COUNT = 55
# 全部 superseded（行の頭が「（superseded」）：取引先の登録・ページ・決まり・先方の人の役割・見えない取引先・種別ごとの既定・画面と道・言葉・これから・検収の全部（頼む・返事・完了の条件・催促・取り下げ）
SUPERSEDED = {1, 3, 5, 6, 13, 15, 16, 17, 18, 19, 20, 22, 23, 24, 28, 29, 31, 32, 34}
# 一部 superseded（行の頭が「（一部 superseded」か「（検収の部分は superseded」）：検収と期限の部分だけが直る
PARTIAL = {8, 14, 21, 25, 26, 33, 36, 37}
# 代表の答え・言葉の行（「高本さん」と answer=<12 桁>）。38 は PM の仮置き・52・54 は PM の決め（どれも「高本さん」と書かない）
ANSWERED = (35, 36, 37, *range(39, 52), 53, 55)
ANSWER_ID = re.compile(r"answer=[0-9a-f]{12}")
# D-155.35（取引先を持たない・v1 に入れる）の代表の答え
ANSWER = "4961f0280e9a"
RULE_WORDS = re.compile(r"ルール|その取引先のチケットだけに効く")


def section_rows() -> tuple[dict[int, str], list[int]]:
    text = DECISIONS.read_text(encoding="utf-8")
    m = re.search(r"^## 155\.", text, re.M)
    if not m:
        raise AssertionError("決定ログに §155 が無い")
    rest = text[m.start() + 1 :]
    nxt = re.search(r"^## \d+\.", rest, re.M)
    body = text[m.start() :] if not nxt else text[m.start() : m.start() + 1 + nxt.start()]
    rows: dict[int, str] = {}
    order: list[int] = []
    for ln in body.splitlines():
        r = re.match(r"^\|\s*D-155\.(\d+)\s*\|", ln)
        if r:
            rows.setdefault(int(r.group(1)), ln)
            order.append(int(r.group(1)))
    return rows, order


def lead(line: str) -> str:
    """表の行の「内容」の欄の頭（| D-155.n | 項目 | 内容 |）"""
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    return cells[2] if len(cells) > 2 else ""


def walk(o: object, path: tuple[str, ...] = (), own: tuple[str, ...] = ()):
    """文字列ごとに (道, 文字, 外側の要素の id・name・key の並び) を出す。外側の要素は dict ごとに歩いて集める"""
    if isinstance(o, dict):
        names = own + tuple(str(o[k]) for k in ("id", "name", "key") if isinstance(o.get(k), str))
        for k, v in o.items():
            yield from walk(v, path + (str(k),), names)
    elif isinstance(o, list):
        for v in o:
            yield from walk(v, path, own)
    elif isinstance(o, str):
        yield path, o, own


def rule_owned(path: tuple[str, ...], own: tuple[str, ...]) -> bool:
    """段 10 が外すルールの物か：道に rules・A131 が在る・外側の要素の id・name が A131・rules・ルール"""
    return any(x in ("A131", "rules", "ルール") for x in (*path, *own))


def run_py(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run([sys.executable, *args], cwd=ROOT, capture_output=True, text=True, timeout=300)


class DecisionLog(unittest.TestCase):
    def test_K870_DC_001_section_rows(self) -> None:
        """§155 の表に D-155.1〜55 が順にちょうど 1 回ずつ（n 行目が D-155.n）"""
        _, order = section_rows()
        self.assertEqual(order, list(range(1, COUNT + 1)))

    def test_K870_DC_002_superseded(self) -> None:
        """全部 superseded は 19 行だけ（行の頭が「（superseded」）・一部 superseded は 8 行だけ（頭が「（一部 superseded」か「（検収の部分は superseded」）。全部の行は置き換え先 D-155.35〜52 を書く"""
        rows, _ = section_rows()
        full = {n for n, ln in rows.items() if lead(ln).startswith("（superseded")}
        part = {n for n, ln in rows.items() if lead(ln).startswith(("（一部 superseded", "（検収の部分は superseded"))}
        self.assertEqual(full, SUPERSEDED)
        self.assertEqual(part, PARTIAL)
        for n in SUPERSEDED:
            self.assertRegex(rows[n], r"D-155\.(3[5-9]|4[0-9]|5[0-2])", f"D-155.{n} の置き換え先")

    def test_K870_DC_003_answers(self) -> None:
        """代表の答え・言葉の行（35・36・37・39〜51・53・55）は「高本さん」と answer=<12 桁>に結ぶ。38 は PM の仮置き・52・54 は PM の決めと書き、「高本さん」を書かない"""
        rows, _ = section_rows()
        for n in ANSWERED:
            self.assertIn("高本さん", rows[n], f"D-155.{n}")
            self.assertRegex(rows[n], ANSWER_ID, f"D-155.{n}")
            self.assertNotIn("answer=answer=", rows[n], f"D-155.{n}")
        self.assertIn("answer=" + ANSWER, rows[35])
        self.assertIn("仮置き", rows[38])
        self.assertNotIn("高本さん", rows[38])
        self.assertIn("PM の決め", rows[52])
        self.assertIn("PM の決め", rows[54])
        self.assertNotIn("高本さん", rows[54])
        self.assertNotIn("高本さん", rows[52])

    def test_K870_DC_004_error_head_and_migration(self) -> None:
        """D-155.26：エラーの頭は E-GST-（E-CLI- でない）・枠の置き場 errors.d・migration の名前 2026112709NN00"""
        rows, _ = section_rows()
        self.assertIn("E-GST-", rows[26])
        self.assertNotIn("E-CLI-", rows[26])
        self.assertIn("2026112709NN00", rows[26])

    def test_K870_DC_005_decisions_of_self(self) -> None:
        """この葉の頭の decisions: に D-155.1〜55 が全部在る（trace_gate の T8 の導出物）"""
        head = SELF.read_text(encoding="utf-8").split("---", 2)[1]
        line = next(l for l in head.splitlines() if l.startswith("decisions:"))
        self.assertEqual({int(n) for n in re.findall(r"D-155\.(\d+)", line)}, set(range(1, COUNT + 1)))

    def test_K870_DC_006_trace_gate(self) -> None:
        """決定の検査 trace_gate.py と decision_source_gate.py が 0 で終わる（G60・--since D-130）"""
        r = run_py("scripts/ci/trace_gate.py")
        self.assertEqual(r.returncode, 0, r.stdout[-1500:] + r.stderr[-500:])
        r = run_py(
            "scripts/ci/decision_source_gate.py",
            "--log", "01_hearing/決定ログ_進行中.md",
            "--answers", "01_hearing/decider-answers.jsonl",
            "--label", "高本さん",
            "--since", "D-130",
        )
        self.assertEqual(r.returncode, 0, r.stdout[-1500:] + r.stderr[-500:])


class FlowAndNav(unittest.TestCase):
    def test_K870_FL_001_no_clients_act_or_screen(self) -> None:
        """flow.json：行為 A121・A126 と画面 clients が無い・「取引先」の区画（段）は「届いた依頼」で A122〜A125 を持ち、A123 は「チケットをゲストのグループに見せる」"""
        flow = json.loads(FLOW.read_text(encoding="utf-8"))
        acts = {a["id"] for ph in flow["backbone"] for a in ph["acts"]}
        for gone in ("A121", "A126"):
            self.assertNotIn(gone, acts)
            self.assertNotIn(gone, flow["blueprint"])
            self.assertNotIn(gone, flow["act_to_screen"])
        self.assertNotIn("clients", {s["id"] for s in flow["screens"]})
        ph = [p for p in flow["backbone"] if p["phase"] == "届いた依頼"]
        self.assertEqual(len(ph), 1)
        self.assertEqual([a["id"] for a in ph[0]["acts"]], ["A122", "A123", "A124", "A125"])
        a123 = next(a for a in ph[0]["acts"] if a["id"] == "A123")
        self.assertIn("ゲストのグループに見せる", a123["act"])
        self.assertFalse([p for p in flow["backbone"] if p["phase"] == "取引先"])

    def test_K870_FL_002_flows_json(self) -> None:
        """flows.json：F11 の名前に「ゲスト」・行為は A122〜A125・名前に「取引先」が無い"""
        flows = json.loads(FLOWS.read_text(encoding="utf-8"))
        f11 = next(f for f in flows["flows"] if f["id"] == "F11")
        self.assertIn("ゲスト", f11["name"])
        self.assertNotIn("取引先", f11["name"])
        self.assertEqual(f11["acts"], ["A122", "A123", "A124", "A125"])

    def test_K870_FL_003_navigation(self) -> None:
        """導線：主ナビの区画に clients が無く、「届いた依頼」（key requests・画面 requests だけ）が R1・R2 にだけ在る。R3 は無い・R4 は portal・clients の第 2 ナビが無い"""
        nav = json.loads(FLOW.read_text(encoding="utf-8"))["navigation"]
        keys = [s["key"] for s in nav["sections"]]
        self.assertNotIn("clients", keys)
        sec = next(s for s in nav["sections"] if s["key"] == "requests")
        self.assertEqual(sec["label"], "届いた依頼")
        self.assertEqual(sec["screens"], ["requests"])
        sr = nav["sections_by_role"]
        self.assertIn("requests", sr["R1"])
        self.assertIn("requests", sr["R2"])
        self.assertNotIn("requests", sr["R3"])
        self.assertEqual(sr["R4"], ["portal", "me"])
        self.assertFalse([k for k, v in sr.items() if "clients" in v])
        self.assertNotIn("clients", nav["sub_by_screen"])
        self.assertFalse([k for k, v in nav["by_role"].items() if "clients" in v])

    def test_K870_FL_004_words(self) -> None:
        """流れの中の「取引先」の字は、段 10 が外すルールの物だけ（要素の id・name が A131・rules・ルール、か道にそれが在る）。「検収」の字は flow.json のどこにも無い。役割 R4・用事 J18・対象・画面 requests・portal はゲストの言葉"""
        flow = json.loads(FLOW.read_text(encoding="utf-8"))
        bad = [(p, s) for p, s, own in walk(flow) if "取引先" in s and not (RULE_WORDS.search(s) or rule_owned(p, own))]
        self.assertEqual(bad, [], "\n".join(f"{'/'.join(p)}: {s}" for p, s in bad[:10]))
        kenshu = [(p, s_) for p, s_, _ in walk(flow) if "検収" in s_]
        self.assertEqual(kenshu, [], "\n".join(f"{'/'.join(p)}: {s_}" for p, s_ in kenshu[:10]))
        r4 = next(r for r in flow["roles"] if r["id"] == "R4")
        self.assertIn("ゲスト", r4["name"])
        j18 = next(j for j in flow["jobs"] if j["id"] == "J18")
        self.assertIn("ゲスト", j18["statement"])
        names = {o["name"] for o in flow["objects"]}
        self.assertNotIn("取引先", names)
        self.assertNotIn("検収", names)
        self.assertIn("ゲストのグループ", names)
        screens = {s["id"]: s for s in flow["screens"]}
        for sid in ("requests", "portal"):
            self.assertIn("ゲスト", screens[sid]["purpose"], sid)

    def test_K870_FL_005_flow_gates(self) -> None:
        """流れの検査 flow_gate.py（G1〜G10）・flow_db_gate.py・trace_gate.py が 0 で終わる（K-924・K-926 が先に A121・A126 の口を外してある前提）"""
        r = run_py("scripts/ci/flow_gate.py", "--flow", "05_flow/flow.json", "--choke", "03_architecture/choke-points.json")
        self.assertEqual(r.returncode, 0, r.stdout[-1500:])
        r = run_py("scripts/ci/flow_db_gate.py")
        self.assertEqual(r.returncode, 0, r.stdout[-1500:])
        api = (ROOT / "05_flow" / "screen_api.py").read_text(encoding="utf-8")
        for gone in ("A121", "A126"):
            self.assertNotIn(gone, api)

    def test_K870_NV_001_generated_nav_and_routes(self) -> None:
        """生成物：nav.ts・routes.ts に clients（キー・画面・/clients）が無く、左のメニューの項目「届いた依頼」（/requests）が在る。gen_routes.mjs check が 0"""
        for p in (NAV, ROUTES):
            src = p.read_text(encoding="utf-8")
            self.assertNotIn('"clients"', src, p.name)
            self.assertNotIn("/clients", src, p.name)
        nav = NAV.read_text(encoding="utf-8")
        self.assertEqual(len(re.findall(r'"label": "届いた依頼"', nav)), 1)
        self.assertIn('"route": "/requests"', nav)
        flow_nav = json.loads(FLOW.read_text(encoding="utf-8"))["navigation"]
        self.assertFalse([x["label"] for x in flow_nav["sections"] if "取引先" in x["label"]])
        r = subprocess.run(["node", "scripts/ci/gen_routes.mjs", "check"], cwd=ROOT, capture_output=True, text=True, timeout=120)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_K870_NV_002_built_routes(self) -> None:
        """built-routes.ts に /clients が無い（作っていない道の一覧）"""
        self.assertNotIn("/clients", BUILT.read_text(encoding="utf-8"))


class ParentsAndDesign(unittest.TestCase):
    def test_K870_PR_001_k71(self) -> None:
        """親 K-71：題に「ゲスト」・screens は portal と requests だけ・decisions に D-155.35〜52"""
        head = K71.read_text(encoding="utf-8").split("---", 2)[1]
        title = next(l for l in head.splitlines() if l.startswith("title:"))
        screens = next(l for l in head.splitlines() if l.startswith("screens:"))
        decisions = next(l for l in head.splitlines() if l.startswith("decisions:"))
        self.assertIn("ゲスト", title)
        self.assertNotIn("取引先", title)
        self.assertEqual(screens.replace(" ", ""), "screens:[portal,requests]")
        for n in range(35, 53):
            self.assertIn(f"D-155.{n}", decisions)

    def test_K870_PR_002_k144_sentence(self) -> None:
        """K-144 の `*_ids` の文の client_id に、段 12 で取引先を持たなくなったことと D-155.35 を添える（前の記録は消さない）"""
        src = K144.read_text(encoding="utf-8")
        line = next(l for l in src.splitlines() if "listTickets の kind_id" in l)
        self.assertIn("client_id", line)
        self.assertIn("D-155.35", line)

    def test_K870_DS_001_design_words(self) -> None:
        """正本 DESIGN-kaname.md・プレビュー・作り手 gen_preview.py に「取引先」が無い（h1 の例・左のバー・一覧の行の高さの例は「届いた依頼」など）"""
        for p in (DESIGN, PREVIEW, GEN_PREVIEW):
            self.assertNotIn("取引先", p.read_text(encoding="utf-8"), p.name)
        self.assertIn("届いた依頼", DESIGN.read_text(encoding="utf-8"))

    def test_K870_DS_002_canvas_menu(self) -> None:
        """絵：左のメニューの項目（kn-lbl と title）と作り手の元（canvas_gen/base）に「取引先」が無く「届いた依頼」になっている"""
        pat = re.compile(r'kn-lbl">取引先|title="取引先"')
        bad = []
        for d in (CANVAS, CANVAS_BASE):
            for p in sorted(d.glob("*.dc.html")):
                if pat.search(p.read_text(encoding="utf-8")):
                    bad.append(p.name)
        self.assertEqual(bad, [], bad[:10])
        n = sum(p.read_text(encoding="utf-8").count('kn-lbl">届いた依頼') for p in CANVAS.glob("*.dc.html"))
        self.assertGreaterEqual(n, 100, "左のメニューを持つ絵（前は 122 枚）が全部「届いた依頼」になっている")

    def test_K870_PR_003_old_tickets_words(self) -> None:
        """本線の古い葉 K-60・K-62・K-64・K-92 の md に「取引先」が無く、役が合わない人の列は「ゲスト」"""
        for k in ("K-60", "K-62", "K-64", "K-92"):
            src = (ROOT / "11_tickets" / f"{k}.md").read_text(encoding="utf-8")
            self.assertNotIn("取引先", src, k)
        for k in ("K-60", "K-62"):
            self.assertIn("ゲスト", (ROOT / "11_tickets" / f"{k}.md").read_text(encoding="utf-8"), k)

    def test_K870_DS_004_edparent(self) -> None:
        """正の絵 EdParent：生成元 ed2.py と絵に「親の担当・取引先」が無く「親の担当・節目を写す」が在る"""
        for p in (ROOT / "04_design" / "canvas_gen" / "ed2.py", CANVAS / "EdParent.dc.html"):
            src = p.read_text(encoding="utf-8")
            self.assertNotIn("親の担当・取引先", src, p.name)
            self.assertIn("親の担当・節目を写す", src, p.name)

    def test_K870_DS_005_canvas_screens_map(self) -> None:
        """絵の対応表 04_design/canvas-screens.json：画面 clients の行が無く、取引先の絵 6 枚は（K-925 が外すまでの橋として）ファイルが在る間は画面 requests に入っている。canvas_gate.py（CV1〜CV4）が 0 で終わる"""
        mp = json.loads((ROOT / "04_design" / "canvas-screens.json").read_text(encoding="utf-8"))["screens"]
        self.assertNotIn("clients", mp)
        for pic in ("CuList", "CuPage", "CuShare", "CuReview", "EdClient", "EdContact"):
            if (CANVAS / f"{pic}.dc.html").exists():  # K-925 が外した後は絵が無いので見ない（外した後も緑のまま）
                self.assertIn(pic, mp["requests"], pic)
        r = run_py("scripts/ci/canvas_gate.py")
        self.assertEqual(r.returncode, 0, r.stdout[-1500:] + r.stderr[-500:])

    def test_K870_DS_003_canvas_design_gate(self) -> None:
        """絵と正本の検査 canvas_design_gate.py が 0 で終わる"""
        r = run_py("scripts/ci/canvas_design_gate.py")
        self.assertEqual(r.returncode, 0, r.stdout[-1500:] + r.stderr[-500:])


if __name__ == "__main__":
    unittest.main()
