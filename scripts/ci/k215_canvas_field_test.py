#!/usr/bin/env python3
"""K-215 の試験：画面を作る・変えるチケットに「正のモック（突き合わせの組）」の欄を必須にし、組の持ち主と結ぶ（scripts/ci/canvas_field_gate.py）。

  python3 scripts/ci/k215_canvas_field_test.py      行 ID は K215-CF-NNN（11_tickets/K-215.md の行の表と 1 対 1）

当てるチケット（11_tickets/K-*.md の直下）：stage が「確認中」「完了」（取り込み済み）でなく、子を持たず、次のどれかに当たるもの（D-143.5）
  ・頭の screens が空でない ・頭の area が「画面」 ・頭の changes に apps/web/(app|features|components/k|styles)/ の道がある
当てたチケット：
  ・頭の canvas: [<組の id>, …] が 1 つ以上。組は 04_design/fidelity.json に在り、組の owner がこのチケット（状態は組が持つ）
    全部の画面に効くチケット（トークン・土台の部品・速さ）は canvas: [全部の組]（入れた組を全部緑のまま保つ。ほかの id と混ぜない）
  ・逆向き：fidelity.json の組の owner が canvas を持つチケットなら、その canvas に組の id が在る
  ・今ある当てはまるチケットで canvas の無いものは台帳 scripts/ci/canvas_field_ledger.json に載せて通す。台帳は減らすだけ
作りもののチケットは tempfile の中に作る。git には GIT_ で始まる環境の値を除いて渡す。
"""
from __future__ import annotations

import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
GATE = HERE / "canvas_field_gate.py"
LEDGER = HERE / "canvas_field_ledger.json"
WORKFLOW = ROOT / ".github" / "workflows" / "v3-gate.yml"
TICKETS = ROOT / "11_tickets"


def clean_env() -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env.update({"GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.invalid",
                "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.invalid"})
    return env


class Fake:
    def __init__(self) -> None:
        self.root = pathlib.Path(tempfile.mkdtemp(prefix="k215-"))
        self.groups({"g1": "K-9", "g2": "K-9", "g3": "K-8"})
        self.ledger([])

    def write(self, rel: str, text: str) -> None:
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")

    def groups(self, owners: dict[str, str]) -> None:
        self.write("04_design/fidelity.json", json.dumps(
            {"_doc": "試し", "groups": [{"id": g, "owner": o, "enrolled": False} for g, o in owners.items()]}))

    def ticket(self, tid: str, stage: str = "未着手", canvas: str | None = "[g1, g2]", **head: str) -> None:
        fields = {"id": tid, "stage": stage, "screens": "[tickets]", "area": "画面", **head}
        text = "---\n" + "".join(f"{k}: {v}\n" for k, v in fields.items() if v is not None)
        text += (f"canvas: {canvas}\n" if canvas is not None else "") + "---\n\n## 目的\n\n試し\n"
        self.write(f"11_tickets/{tid}.md", text)

    def ledger(self, tickets: list[str]) -> None:
        self.write("scripts/ci/canvas_field_ledger.json",
                   json.dumps({"_doc": "試し", "entries": [{"ticket": t, "reason": "前からあるチケット"} for t in tickets]}, ensure_ascii=False))

    def run(self, *extra: str) -> subprocess.CompletedProcess:
        return subprocess.run([sys.executable, str(GATE), "--root", str(self.root), *extra],
                              capture_output=True, text=True, env=clean_env(), cwd=self.root)

    def git(self, *a: str) -> None:
        subprocess.run(["git", *a], cwd=self.root, env=clean_env(), capture_output=True, text=True, check=True)

    def close(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)


class FieldTest(unittest.TestCase):
    def setUp(self) -> None:
        self.f = Fake()
        self.f.ticket("K-8", canvas="[g3]")

    def tearDown(self) -> None:
        self.f.close()

    def test_K215_CF_001_missing_canvas_is_red_by_any_trigger(self) -> None:
        """K215-CF-001 canvas が無いと 1 で番号を出す。当たり方は 3 つのどれでも（screens あり／area が画面／changes が apps/web/features）"""
        for head in ({}, {"screens": None}, {"screens": None, "area": "試験", "changes": "[apps/web/features/F4/x.tsx]"}):
            self.f.ticket("K-9", canvas=None, **head)
            r = self.f.run("--no-base")
            self.assertEqual(r.returncode, 1, head)
            self.assertIn("K-9", r.stdout)

    def test_K215_CF_002_good_ticket_is_green(self) -> None:
        """K215-CF-002 canvas: [g1, g2]（どちらも在り、持ち主がこのチケット）なら 0"""
        self.f.ticket("K-9")
        self.assertEqual(self.f.run("--no-base").returncode, 0, self.f.run("--no-base").stdout)

    def test_K215_CF_003_unknown_group_is_red(self) -> None:
        """K215-CF-003 canvas の組が fidelity.json に無い（絵の名前や無い状態を書いた）と 1 で、その名前を出す"""
        self.f.ticket("K-9", canvas="[g1, g2, Main/存在しない状態]")
        r = self.f.run("--no-base")
        self.assertEqual(r.returncode, 1)
        self.assertIn("Main/存在しない状態", r.stdout)

    def test_K215_CF_004_group_of_other_owner_is_red(self) -> None:
        """K215-CF-004 canvas の組の持ち主が別のチケット（g3 の持ち主は K-8）だと 1"""
        self.f.ticket("K-9", canvas="[g1, g2, g3]")
        self.assertEqual(self.f.run("--no-base").returncode, 1)

    def test_K215_CF_005_owned_group_missing_from_canvas_is_red(self) -> None:
        """K215-CF-005 逆向き：持ち主の組（g2）を自分の canvas に書いていないと 1 で、組の id を出す"""
        self.f.ticket("K-9", canvas="[g1]")
        r = self.f.run("--no-base")
        self.assertEqual(r.returncode, 1)
        self.assertIn("g2", r.stdout)

    def test_K215_CF_006_not_applied(self) -> None:
        """K215-CF-006 確認中・完了のチケット、子を持つ親、当たり方の 3 つのどれにも当たらないチケットは canvas が無くても 0"""
        self.f.ticket("K-9")
        self.f.ticket("K-7", stage="確認中", canvas=None)
        self.f.ticket("K-6", stage="完了", canvas=None)
        self.f.ticket("K-5", canvas=None)
        self.f.ticket("K-4", canvas="[全部の組]", parent="K-5")
        self.f.ticket("K-3", canvas=None, screens=None, area="試験", changes="[scripts/ci/x.py]")
        self.assertEqual(self.f.run("--no-base").returncode, 0, self.f.run("--no-base").stdout)

    def test_K215_CF_007_started_ticket_still_checked(self) -> None:
        """K215-CF-007 着手した後（作業中・保留）に canvas を消すと 1"""
        for stage in ("作業中", "保留"):
            self.f.ticket("K-9", stage=stage, canvas=None)
            self.assertEqual(self.f.run("--no-base").returncode, 1, stage)

    def test_K215_CF_008_all_groups(self) -> None:
        """K215-CF-008 canvas: [全部の組] は 0（持ち主の組が無いチケット）。ほかの id と混ぜると 1"""
        self.f.groups({"g3": "K-8"})
        self.f.ticket("K-9", canvas="[全部の組]")
        self.assertEqual(self.f.run("--no-base").returncode, 0)
        self.f.ticket("K-9", canvas="[全部の組, g3]")
        self.assertEqual(self.f.run("--no-base").returncode, 1)


class LedgerTest(unittest.TestCase):
    def setUp(self) -> None:
        self.f = Fake()
        self.f.groups({})

    def tearDown(self) -> None:
        self.f.close()

    def test_K215_CF_009_ledger_passes_and_stale_is_red(self) -> None:
        """K215-CF-009 台帳に載ったチケットは canvas が無くても 0。canvas を書いた・ファイルが無いのに台帳に残れば 1（「台帳から消す」）。
        取り込み済み（確認中）になって当たらなくなった行は 0 のまま「台帳から消してよい」と出す（取り込みの台本が stage を書いた回を赤にしない）"""
        self.f.ticket("K-9", canvas=None)
        self.f.ledger(["K-9"])
        self.assertEqual(self.f.run("--no-base").returncode, 0)
        self.f.ticket("K-9", canvas="[全部の組]")
        r = self.f.run("--no-base")
        self.assertEqual(r.returncode, 1)
        self.assertIn("台帳から消す", r.stdout)
        self.f.ticket("K-9", stage="確認中", canvas=None)
        r = self.f.run("--no-base")
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertIn("台帳から消してよい", r.stdout)
        self.f.ledger(["K-404"])
        self.assertEqual(self.f.run("--no-base").returncode, 1)

    def test_K215_CF_010_ledger_cannot_grow(self) -> None:
        """K215-CF-010 分かれ目の台帳に無いチケットを足すと 1。比べる版が読めない・比べ方の指定が無いと 1"""
        self.f.git("init", "-q")
        self.f.ticket("K-9", canvas=None)
        self.f.ticket("K-11", canvas=None)
        self.f.ledger(["K-9"])
        self.f.git("add", "-A")
        self.f.git("commit", "-qm", "base")
        self.f.ledger(["K-9", "K-11"])
        self.assertEqual(self.f.run("--ledger-base-ref", "HEAD").returncode, 1)
        self.assertEqual(self.f.run("--ledger-base-ref", "nai-ref-x").returncode, 1)
        self.assertEqual(self.f.run().returncode, 1)


class RealTest(unittest.TestCase):
    def test_K215_CF_011_real_tree_green(self) -> None:
        """K215-CF-011 本物の 11_tickets・fidelity.json・台帳で 0 で終わる。台帳の行はどれも理由があり、K-213 の子は載っていない（台帳が減って 0 行になっても成り立つ）"""
        r = subprocess.run([sys.executable, str(GATE), "--no-base"], cwd=ROOT, capture_output=True, text=True, env=clean_env())
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        for e in json.loads(LEDGER.read_text(encoding="utf-8"))["entries"]:
            self.assertTrue(e["reason"].strip(), e)
            head = (TICKETS / f"{e['ticket']}.md").read_text(encoding="utf-8").split("\n---", 1)[0]
            self.assertNotRegex(head, r"(?m)^parent:\s*K-213\s*$", e)


class WiringTest(unittest.TestCase):
    def test_K215_CF_012_runs_in_ci(self) -> None:
        """K215-CF-012 CI の spec の組に G68 の段が 1 つ在り、canvas_field_gate.py を本線との分かれ目と比べて流し、この試験も流す。continue-on-error が無い"""
        wf = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        steps = [s for s in wf["jobs"]["spec"]["steps"] if str(s.get("name", "")).startswith("G68 ")]
        self.assertEqual(len(steps), 1)
        run = steps[0]["run"]
        self.assertIn("python3 scripts/ci/canvas_field_gate.py --ledger-base-ref", run)
        self.assertIn("python3 scripts/ci/k215_canvas_field_test.py", run)
        self.assertNotIn("continue-on-error", steps[0])


if __name__ == "__main__":
    unittest.main(verbosity=2)
