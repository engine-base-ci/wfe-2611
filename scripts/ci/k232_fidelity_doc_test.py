#!/usr/bin/env python3
"""K-232 の試験（突き合わせの設定・長い文面の見出し）：種類 doc の組の見出し（役 h1）だけ縦の位置 y を外せる。
ほかの値（x・字の大きさ・太さ など）と、doc 以外の種類の見出しの y は今までどおり要る（scripts/ci/fidelity_config.py の KIND_OPTIONAL）。

  python3 scripts/ci/k232_fidelity_doc_test.py      行 ID は K232-CI-NNN（11_tickets/K-232.md の行の表と 1 対 1）

作りものの根（絵・持ち主のチケット・画面を整える道具・設定）は tempfile の中に作り、検査を子プロセスで流す（--no-base）。
"""
from __future__ import annotations

import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
GATE = HERE / "fidelity_config.py"

H1 = ["font-size", "font-weight", "line-height", "color", "x", "y"]
CARD = ["background-color", "border-top-color", "border-radius", "padding-top", "padding-left", "width", "x"]
PRIMARY = ["height", "background-color", "color", "font-size", "font-weight", "border-radius", "x", "y"]


def pair(role: str, props: list[str]) -> dict:
    return {"name": role, "role": role, "canvas": f".c-{role}", "app": f".a-{role}", "props": list(props)}


def group(kind: str, h1: list[str]) -> dict:
    pairs = [pair("card", CARD), pair("h1", h1)]
    if kind == "auth-msg":
        pairs.append(pair("primary", PRIMARY))
    return {"id": "g1", "kind": kind, "canvas": "Doc", "app": "/legal/terms", "state": "s1", "widths": [1440, 375],
            "owner": "K-1", "enrolled": True, "pairs": pairs}


class DocHeadingTest(unittest.TestCase):
    def setUp(self) -> None:
        self.root = pathlib.Path(tempfile.mkdtemp(prefix="k232-"))
        self.write("04_design/canvas/Doc.dc.html", "<b>文面</b>")
        self.write("11_tickets/K-1.md", "---\nid: K-1\n---\n")
        self.write("apps/web/tests/_lib/fidelity-states.ts", 'export const FIDELITY_STATES = {\n  "s1": async () => {},\n};\n')

    def tearDown(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)

    def write(self, rel: str, text: str) -> None:
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")

    def run_gate(self, g: dict) -> subprocess.CompletedProcess:
        self.write("04_design/fidelity.json", json.dumps({"_doc": "試し", "groups": [g]}, ensure_ascii=False))
        args = [sys.executable, str(GATE), "--root", str(self.root), "--required", "g1", "--no-base"]
        return subprocess.run(args, capture_output=True, text=True, cwd=self.root)

    def test_K232_CI_001_doc_heading_without_y(self) -> None:
        """K232-CI-001 種類 doc の組の見出しは、y が無くても在っても 0（緑）で終わる"""
        no_y = [x for x in H1 if x != "y"]
        r = self.run_gate(group("doc", no_y))
        self.assertEqual(r.returncode, 0, r.stdout)
        r = self.run_gate(group("doc", H1))
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_K232_CI_002_other_kinds_still_need_y(self) -> None:
        """K232-CI-002 doc 以外（auth-msg）の見出しに y が無ければ 1 で「値 y」を出す。doc でも見出しの y 以外の値（字の大きさ・太さ・行の高さ・色・x）や
        箱（card）の値を 1 つでも外せば 1 でその値の名前を出す。外せる表は doc の h1 の y だけ"""
        r = self.run_gate(group("auth-msg", [x for x in H1 if x != "y"]))
        self.assertEqual(r.returncode, 1, r.stdout)
        self.assertIn("値 y", r.stdout)
        for need in [x for x in H1 if x != "y"]:
            with self.subTest(h1=need):
                r = self.run_gate(group("doc", [x for x in H1 if x != need]))
                self.assertEqual(r.returncode, 1, r.stdout)
                self.assertIn(f"値 {need}", r.stdout)
        for need in CARD:
            with self.subTest(card=need):
                g = group("doc", H1)
                g["pairs"][0]["props"] = [x for x in CARD if x != need]
                r = self.run_gate(g)
                self.assertEqual(r.returncode, 1, r.stdout)
                self.assertIn(f"値 {need}", r.stdout)
        sys.path.insert(0, str(HERE))
        try:
            import fidelity_config  # noqa: PLC0415
        finally:
            sys.path.remove(str(HERE))
        self.assertEqual(fidelity_config.KIND_OPTIONAL, {"doc": {"h1": ["y"]}})


if __name__ == "__main__":
    unittest.main()
