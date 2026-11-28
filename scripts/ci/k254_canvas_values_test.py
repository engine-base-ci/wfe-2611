#!/usr/bin/env python3
"""K-254 の試験（キャンバスを正本と決定にそろえる）：文字の段・値の検査の台本と CI の段・幅の台帳・作り手の流し直し。

  python3 scripts/ci/k254_canvas_values_test.py      行 ID は K254-CV-NNN（11_tickets/K-254.md の行の表と 1 対 1）

実 Chrome で絵を開いて幅と入力欄の文字を数で見る行（K254-UI-NNN）は apps/web/tests/k/k254-canvas-layout.spec.ts が持つ。
本物の木は読むだけ（作り手は写しの置き場 KANAME_CANVAS で流す）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
"""
from __future__ import annotations

import ast
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CANVAS = ROOT / "04_design" / "canvas"
GEN = ROOT / "04_design" / "canvas_gen"
DESIGN = ROOT / "04_design" / "DESIGN-kaname.md"
GATE = HERE / "canvas_design_gate.py"
LEDGER = HERE / "canvas_layout_ledger.json"
FIDELITY = ROOT / "04_design" / "fidelity.json"
WORKFLOW = ROOT / ".github" / "workflows" / "v3-gate.yml"
CI_SCOPE = HERE / "ci_scope.json"
LEDGER_CAP = 97          # 台帳を入れた時点の絵の数の上限（2026-11-16 に幅 375・768・1440 で測った、横溢れか潰れた箱のある絵）。減らすだけ
K257_BOARDS = {"TicketDetail", "StRunning", "StFailed"}   # 絵を起こし直すチケット（K-257）が直す段 1 の絵（2026-11-16 に測って壊れていた 3 枚）
FIXED_HERE = {"EdPC", "MePC"}                                       # このチケットが直す段 1 の絵（設定の画面のそろえで直る）


def boards() -> list[pathlib.Path]:
    return sorted(CANVAS.glob("*.dc.html"))


def type_sizes() -> set[int]:
    """正本の typography の段の fontSize（px）"""
    block = re.search(r"^typography:\n(.*?)^\S", DESIGN.read_text(encoding="utf-8"), re.S | re.M)
    assert block, "DESIGN-kaname.md に typography が無い"
    return {int(x) for x in re.findall(r"fontSize:\s*(\d+)px", block.group(1))}


class Values(unittest.TestCase):
    def test_K254_CV_001_no_off_scale_sizes(self):
        """K254-CV-001 どの絵にも font-size 22px・26px が無く、絵に出る文字の大きさはどれも正本の段（typography の fontSize）に在る"""
        scale = type_sizes()
        bad: dict[str, set[int]] = {}
        for f in boards():
            used = {int(x) for x in re.findall(r"font-size:\s*(\d+)px", f.read_text(encoding="utf-8"))}
            off = used - scale
            if off:
                bad[f.stem] = off
        self.assertEqual(bad, {}, "正本の段に無い文字の大きさ（絵：大きさ）")

    def test_K254_CV_002_tokensnap_maps_titles_to_h1(self):
        """K254-CV-002 作り手 tokensnap.py の SIZE が 22→20・26→20（正本の h1）を持つ（文字の大きさだけを寄せ、行の高さは替えない）"""
        src = (GEN / "tokensnap.py").read_text(encoding="utf-8")
        size = re.search(r"SIZE\s*=\s*(\{[^}]*\})", src)
        self.assertTrue(size, "tokensnap.py に SIZE が無い")
        table = ast.literal_eval(size.group(1))
        self.assertEqual(table.get("22"), "20")
        self.assertEqual(table.get("26"), "20")

    def test_K254_CV_003_gate_green_on_canvas(self):
        """K254-CV-003 canvas_design_gate.py が本物のキャンバスで 0 で終わる（D1 色・D2 書体・D3 角丸・D4 文字が 0 件）。D6（正本にあって絵に無い色）は知らせとして出す"""
        r = subprocess.run([sys.executable, str(GATE)], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        for d in ("D1", "D2", "D3", "D4"):
            self.assertRegex(r.stdout, rf"{d}\S*: 0 件")
        self.assertIn("D6", r.stdout)

    def test_K254_CV_004_gate_reds_off_scale(self):
        """K254-CV-004 canvas_design_gate.py --canvas <写し> は、写しの 1 枚に font-size 22px と正本に無い色 #123456 を入れると 1 で終わり、その絵の名前と D1・D4 を出す"""
        with tempfile.TemporaryDirectory() as d:
            for f in boards()[:3]:
                shutil.copy(f, d)
            first = sorted(pathlib.Path(d).glob("*.dc.html"))[0]
            first.write_text(first.read_text(encoding="utf-8").replace("<body", '<body><b style="font-size: 22px; color: #123456">x</b', 1),
                             encoding="utf-8")
            r = subprocess.run([sys.executable, str(GATE), "--canvas", d], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn(first.name.removesuffix(".dc.html"), r.stdout)   # 絵の名前（台帳と同じ書き方）
        self.assertRegex(r.stdout, r"D1\S*: [1-9]")
        self.assertRegex(r.stdout, r"D4\S*: [1-9]")

    def test_K254_CV_005_ci_steps(self):
        """K254-CV-005 CI の段：spec の組に canvas_design_gate.py とこの試験を流す段がある。キャンバスと幅の台帳が変わったら画面の組で幅の試験が流れる（ci_scope.json の data_links）"""
        wf = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        runs = "\n".join(s.get("run") or "" for s in wf["jobs"]["spec"]["steps"])
        self.assertIn("python3 scripts/ci/canvas_design_gate.py", runs)
        # 取り込んだ後も台帳の上限と作り手の流し直しを見るため、同じ段でこの試験も流す（tests: の .py はチケットの回でしか流れない）
        self.assertIn("python3 scripts/ci/k254_canvas_values_test.py", runs)
        links = json.loads(CI_SCOPE.read_text(encoding="utf-8"))["data_links"]
        hit = [x for x in links if "apps/web/tests/k/k254-canvas-layout.spec.ts" in x.get("tests", [])]
        self.assertTrue(hit, "data_links に k254-canvas-layout.spec.ts が無い")
        paths = {p for x in hit for p in x["paths"]}
        self.assertIn("04_design/canvas/*.dc.html", paths)
        self.assertIn("scripts/ci/canvas_layout_ledger.json", paths)


class Ledger(unittest.TestCase):
    def test_K254_CV_006_ledger_shape(self):
        """K254-CV-006 幅の台帳：行は {board, widths, reason}・絵が在る・幅は 375・768・1440 のどれか・理由が空でない・同じ絵が 2 行無い・行の数が上限以下。
        段 1 の絵（突き合わせの組の絵）は台帳に載せない。ただし K-257 が直す 4 枚だけは理由に K-257 を書いて載せてよい。EdPC・MePC は載らない"""
        led = json.loads(LEDGER.read_text(encoding="utf-8"))
        entries = led["entries"]
        names = [e["board"] for e in entries]
        self.assertEqual(len(names), len(set(names)), "同じ絵が 2 行")
        self.assertLessEqual(len(entries), LEDGER_CAP)
        stage1 = {g["canvas"] for g in json.loads(FIDELITY.read_text(encoding="utf-8"))["groups"]}
        for e in entries:
            self.assertTrue((CANVAS / f"{e['board']}.dc.html").is_file(), e["board"])
            self.assertTrue(e["widths"] and set(e["widths"]) <= {375, 768, 1440}, e)
            self.assertTrue(str(e.get("reason", "")).strip(), e)
            if e["board"] in stage1:
                self.assertIn(e["board"], K257_BOARDS, f"{e['board']} は段 1 の絵なので台帳に載せない")
                self.assertIn("K-257", e["reason"])
        self.assertEqual(FIXED_HERE & set(names), set())


class Generators(unittest.TestCase):
    def test_K254_CV_007_regenerate_is_stable(self):
        """K254-CV-007 作り手の流し直し：キャンバスの写しに me.py と shellfix.py（そろえ・値の段・幅 767 以下の入力欄と設定の左の列の決まりを含む）を流しても、どの絵も 1 字も変わらない（手で書いた所が無い）"""
        with tempfile.TemporaryDirectory() as d:
            for f in boards():
                shutil.copy(f, d)
            env = dict(os.environ, KANAME_CANVAS=d.rstrip("/") + "/")
            for script in ("me.py", "shellfix.py"):   # 設定の画面の作り手を流してから、全部の絵のそろえ
                r = subprocess.run([sys.executable, script], cwd=GEN, env=env, capture_output=True, text=True)
                self.assertEqual(r.returncode, 0, script + r.stdout + r.stderr)
            changed = [f.name for f in boards() if (pathlib.Path(d) / f.name).read_text(encoding="utf-8") != f.read_text(encoding="utf-8")]
        self.assertEqual(changed, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
