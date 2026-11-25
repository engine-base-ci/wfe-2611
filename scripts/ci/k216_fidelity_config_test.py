#!/usr/bin/env python3
"""K-216 の試験（突き合わせの設定）：段 1 の画面とキャンバスの組を 1 か所に持ち、組ごとに要る要素と値を必須にし、
入れた組は外せない・弱められない（scripts/ci/fidelity_config.py）。

  python3 scripts/ci/k216_fidelity_config_test.py      行 ID は K216-VF-NNN（11_tickets/K-216.md の行の表と 1 対 1）

設定 04_design/fidelity.json：
  {"_doc": …, "groups": [{"id", "kind", "canvas"（04_design/canvas の名前）, "app"（画面の道）, "state"（画面を整える道具の鍵）,
    "widths", "pairs"（[{name, role, canvas, app, props}]）, "owner"（直すチケット）, "enrolled"（突き合わせに入れたか）}]}
  ・組の種類（kind）ごとに要る役（role）がそろい、役ごとに要る値（props）がそろう（下の KINDS・ROLES は K-216.md の表と同じ）
  ・段 1 の組（下の GROUPS の 21 組）が全部在る（入れていなくても在る。持ち主の画面のチケットが直して enrolled にする）。
    ただし組ごと外した記録（設定の頭の removed_groups・K-1300）の在る組は無くてよい
  ・enrolled の組は、画面を整える道具（apps/web/tests/_lib/fidelity-states.ts）に鍵が在る
  ・本線との分かれ目で enrolled だった組は、消せない・enrolled を戻せない・比べる（役×値×幅）を減らせない・セレクタも state も替えられない
作りものの設定は tempfile の中に作る。git には GIT_ で始まる環境の値を除いて渡す。
"""
from __future__ import annotations

import copy
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
GATE = HERE / "fidelity_config.py"
CONFIG = ROOT / "04_design" / "fidelity.json"
CANVAS = ROOT / "04_design" / "canvas"
TICKETS = ROOT / "11_tickets"

ROLES = {
    "h1": ["font-size", "font-weight", "line-height", "color", "x", "y"],
    "head": ["background-color", "border-bottom-color", "border-bottom-width", "padding-top", "padding-left", "height", "width", "x", "y"],
    "body": ["padding-top", "padding-left", "width", "x", "y"],
    "primary": ["height", "background-color", "color", "font-size", "font-weight", "border-radius", "x", "y"],
    "input": ["width", "height", "background-color", "border-top-color", "border-radius", "font-size"],
    "card": ["background-color", "border-top-color", "border-radius", "padding-top", "padding-left", "width", "x"],
    "band": ["background-color", "border-top-color", "border-radius", "padding-top", "width", "x", "y"],
    "band-title": ["font-size", "font-weight"],
    "dialog": ["width", "border-radius", "background-color", "x", "y"],
    "dialog-title": ["font-size", "font-weight"],
    "nav": ["width", "background-color", "x"],
    "nav-items": ["texts", "height", "font-size"],
    "subnav": ["texts", "width", "x"],
    "bar": ["height", "background-color", "texts"],
    "tabs": ["texts", "height"],
}
KINDS = {
    "page": (["h1", "head", "body"], [1440, 375]),
    "form": (["h1", "head", "body", "input", "primary"], [1440, 375]),
    "auth": (["card", "h1", "input", "primary"], [1440, 375]),
    "auth-msg": (["card", "h1", "primary"], [1440, 375]),
    "doc": (["card", "h1"], [1440, 375]),
    "band": (["band", "band-title"], [1440, 375]),
    "dialog": (["dialog", "dialog-title", "primary"], [1440, 375]),
    "shell-nav": (["nav", "nav-items", "bar"], [1440]),
    "shell-sub": (["nav", "subnav"], [1440]),
    "shell-tabs": (["tabs"], [375]),
}
GROUPS = {
    "signup": ("auth", "AuthSignup", "K-255"), "signup-waiting": ("auth-msg", "AuthVerify", "K-255"),
    "login": ("auth", "AuthLogin", "K-221"), "login-2fa": ("auth", "Auth2FA", "K-221"), "legal": ("doc", "LegalPage", "K-232"),
    "tickets-first": ("page", "OnHome", "K-251"), "tickets-main": ("page", "Main", "K-251"), "tickets-list": ("page", "List", "K-252"),
    "tickets-new": ("form", "Create", "K-224"), "tickets-new-sections": ("form", "Create", "K-225"),
    "ticket-detail": ("page", "TicketDetail", "K-226"), "band-approval": ("band", "TicketDetail", "K-227"),
    "band-running": ("band", "StRunning", "K-228"), "band-failed": ("band", "StFailed", "K-228"),
    # 承認の小窓は 1 枚の絵に移した（3 つを並べた見本 StModal は幅 375 で潰れる）
    "approve-modal": ("dialog", "StApproveModal", "K-229"), "approvals": ("page", "Approvals", "K-231"),
    "bridge-code": ("dialog", "EdPC", "K-230"), "bridge-connected": ("page", "MePC", "K-230"), "bridge-shell": ("shell-sub", "MePC", "K-220"),
    "shell-nav": ("shell-nav", "Main", "K-138"), "shell-tabs": ("shell-tabs", "MobileList", "K-138"),
}


def clean_env() -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env.update({"GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.invalid",
                "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.invalid"})
    return env


def group(gid: str, kind: str = "page", enrolled: bool = False, state: str = "s1", **kw) -> dict:
    roles, widths = KINDS[kind]
    g = {"id": gid, "kind": kind, "canvas": "Main", "app": "/tickets", "state": state, "widths": list(widths), "owner": "K-1",
         "enrolled": enrolled,
         "pairs": [{"name": r, "role": r, "canvas": f".c-{r}", "app": f".a-{r}", "props": list(ROLES[r])} for r in roles]}
    g.update(kw)
    return g


class Fake:
    """作りものの根：04_design/canvas/Main.dc.html・11_tickets/K-1.md・画面を整える道具（鍵 s1 だけ）"""

    def __init__(self) -> None:
        self.root = pathlib.Path(tempfile.mkdtemp(prefix="k216-"))
        self.write("04_design/canvas/Main.dc.html", "<h1>チケット</h1>")
        self.write("11_tickets/K-1.md", "---\nid: K-1\n---\n")
        self.write("apps/web/tests/_lib/fidelity-states.ts", 'export const FIDELITY_STATES = {\n  "s1": async () => {},\n};\n')

    def write(self, rel: str, text: str) -> None:
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")

    def config(self, groups: list[dict]) -> None:
        self.write("04_design/fidelity.json", json.dumps({"_doc": "試し", "groups": groups}, ensure_ascii=False))

    def run(self, *extra: str, required: str = "g1") -> subprocess.CompletedProcess:
        args = [sys.executable, str(GATE), "--root", str(self.root), "--required", required, *extra]
        return subprocess.run(args, capture_output=True, text=True, env=clean_env(), cwd=self.root)

    def git(self, *a: str) -> None:
        subprocess.run(["git", *a], cwd=self.root, env=clean_env(), capture_output=True, text=True, check=True)

    def close(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)


class ShapeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.f = Fake()

    def tearDown(self) -> None:
        self.f.close()

    def test_K216_VF_001_group_shape(self) -> None:
        """K216-VF-001 組の欄（絵が在る・知っている種類・種類の幅を含む・持ち主が在る）が欠けると 1。そろえば 0"""
        self.f.config([group("g1")])
        self.assertEqual(self.f.run("--no-base").returncode, 0, self.f.run("--no-base").stdout)
        for bad in (group("g1", canvas="Nai"), {**group("g1"), "kind": "nai"},group("g1", widths=[1440]), group("g1", owner="K-99999")):
            self.f.config([bad])
            self.assertEqual(self.f.run("--no-base").returncode, 1, bad)

    def test_K216_VF_002_kind_needs_roles(self) -> None:
        """K216-VF-002 種類に要る役が欠けると 1 で、組と役の名前を出す（作る画面の組に入力欄が無い・外枠の組に左のメニューの項目が無い）"""
        g = group("g1", kind="form")
        g["pairs"] = [p for p in g["pairs"] if p["role"] != "input"]
        self.f.config([g])
        r = self.f.run("--no-base")
        self.assertEqual(r.returncode, 1)
        self.assertIn("input", r.stdout)
        s = group("g1", kind="shell-nav")
        s["pairs"] = [p for p in s["pairs"] if p["role"] != "nav-items"]
        self.f.config([s])
        self.assertEqual(self.f.run("--no-base").returncode, 1)

    def test_K216_VF_003_role_needs_props(self) -> None:
        """K216-VF-003 役に要る値が欠けると 1 で、役と値の名前を出す（見出しの帯に padding-left が無い・見出しに x が無い）"""
        for role, prop in (("head", "padding-left"), ("h1", "x")):
            g = group("g1")
            for p in g["pairs"]:
                if p["role"] == role:
                    p["props"].remove(prop)
            self.f.config([g])
            r = self.f.run("--no-base")
            self.assertEqual(r.returncode, 1, (role, prop))
            self.assertIn(prop, r.stdout)

    def test_K216_VF_004_required_groups(self) -> None:
        """K216-VF-004 段 1 の組（--required で渡した id）が設定に無ければ 1 で、その id を出す"""
        self.f.config([group("g1")])
        r = self.f.run("--no-base", required="g1,g2")
        self.assertEqual(r.returncode, 1)
        self.assertIn("g2", r.stdout)

    def test_K216_VF_012_enrolled_needs_state(self) -> None:
        """K216-VF-012 enrolled の組の鍵が画面を整える道具に無ければ 1。enrolled でない組は鍵が無くても 0"""
        self.f.config([group("g1", state="nai")])
        self.assertEqual(self.f.run("--no-base").returncode, 0)
        self.f.config([group("g1", enrolled=True, state="nai")])
        self.assertEqual(self.f.run("--no-base").returncode, 1)
        self.f.config([group("g1", enrolled=True)])
        self.assertEqual(self.f.run("--no-base").returncode, 0)


class RatchetTest(unittest.TestCase):
    def setUp(self) -> None:
        self.f = Fake()
        self.f.git("init", "-q")
        self.base = [group("g1", enrolled=True), group("g2")]
        self.f.config(self.base)
        self.f.git("add", "-A")
        self.f.git("commit", "-qm", "base")

    def tearDown(self) -> None:
        self.f.close()

    def check(self, groups: list[dict]) -> int:
        self.f.config(groups)
        return self.f.run("--base-ref", "HEAD", required="g1,g2").returncode

    def test_K216_VF_013_cannot_unenroll(self) -> None:
        """K216-VF-013 分かれ目で enrolled の組を false に戻す・消すと 1。増やす（g2 を入れる）のは 0。版が読めない・比べ方の指定が無いと 1"""
        self.assertEqual(self.check([group("g1", enrolled=True), group("g2", enrolled=True)]), 0)
        self.assertEqual(self.check([group("g1"), group("g2")]), 1)
        self.assertEqual(self.check([group("g2")]), 1)
        self.assertEqual(self.f.run("--base-ref", "nai-ref-x", required="g1,g2").returncode, 1)
        self.assertEqual(self.f.run(required="g1,g2").returncode, 1)

    def test_K216_VF_014_cannot_weaken(self) -> None:
        """K216-VF-014 分かれ目で enrolled の組の、値を減らす・幅を減らす・役の要素を消す・セレクタを替えると 1。値と幅を足すのは 0"""
        more = copy.deepcopy(self.base)
        more[0]["pairs"][0]["props"].append("letter-spacing")
        more[0]["widths"].append(768)
        self.assertEqual(self.check(more), 0, "足すのは通る")
        self.f.git("add", "-A")
        self.f.git("commit", "-qm", "more")
        edits = {
            "値を減らした": lambda g: g[0]["pairs"][0]["props"].remove("letter-spacing"),
            "幅を減らした": lambda g: g[0]["widths"].remove(768),
            "役の要素を消した": lambda g: g[0]["pairs"].append(g[0]["pairs"].pop(0)) or g[0]["pairs"].pop(),
            "セレクタを替えた": lambda g: g[0]["pairs"][0].update(app="body"),
        }
        for why, edit in edits.items():
            g = copy.deepcopy(more)
            edit(g)
            self.assertEqual(self.check(g), 1, why)


class ReviewTest(unittest.TestCase):
    """レビューの指摘（2026-11-15・PM の決め）"""

    def test_K216_VF_023_cannot_swap_state(self) -> None:
        """K216-VF-023 分かれ目で enrolled の組の state（画面を整える鍵）を別の鍵に替えると 1（易しい状態で比べて弱められない）"""
        f = Fake()
        try:
            f.write("apps/web/tests/_lib/fidelity-states.ts", 'export const FIDELITY_STATES = {\n  "s1": async () => {},\n  "s2": async () => {},\n};\n')
            f.git("init", "-q")
            f.config([group("g1", enrolled=True)])
            f.git("add", "-A")
            f.git("commit", "-qm", "base")
            f.config([group("g1", enrolled=True, state="s2")])
            r = f.run("--base-ref", "HEAD", required="g1")
            self.assertEqual(r.returncode, 1, r.stdout)
            self.assertIn("state", r.stdout)
            f.config([group("g1", enrolled=True)])
            self.assertEqual(f.run("--base-ref", "HEAD", required="g1").returncode, 0)
        finally:
            f.close()

    def test_K216_VF_024_wiring_needs_node_test(self) -> None:
        """K216-VF-024 書いた検査が CI から回るかの検査（ci_wiring_gate）は、.test.mjs を `node --test [旗…]` で流すときだけ回ると数える（`node --check` は流していない）"""
        sys.path.insert(0, str(HERE))
        import ci_wiring_gate  # noqa: E402

        name = "scripts/ci/m.test.mjs"
        self.assertTrue(ci_wiring_gate.is_wired(name, f"node {name}", f"run: node --test --test-reporter=junit {name}", {}))
        self.assertTrue(ci_wiring_gate.is_wired(name, f"node {name}", f"run: node {name}", {}))
        self.assertFalse(ci_wiring_gate.is_wired(name, f"node {name}", f"run: node --check {name}", {}))
        self.assertFalse(ci_wiring_gate.is_wired(name, f"node {name}", "run: node --test scripts/ci/other.test.mjs", {}))


class RealTest(unittest.TestCase):
    def test_K216_VF_015_real_config_green(self) -> None:
        """K216-VF-015 本物の設定（04_design/fidelity.json）は 0 で終わり、段 1 の 21 組が全部在り、組の種類・絵・持ち主が下の表どおり。
        組ごと外した記録（removed_groups）の在る組は、在らないことを見る（K-1300）"""
        r = subprocess.run([sys.executable, str(GATE), "--no-base"], cwd=ROOT, capture_output=True, text=True, env=clean_env())
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        data = json.loads(CONFIG.read_text(encoding="utf-8"))
        got = {g["id"]: (g["kind"], g["canvas"], g["owner"]) for g in data["groups"]}
        gone = {e["group"] for e in data.get("removed_groups") or []}
        for gid, want in GROUPS.items():
            if gid in gone:
                self.assertNotIn(gid, got, f"{gid} は組ごと外した記録が在るのに設定に残る")
                continue
            self.assertEqual(got.get(gid), want, gid)
            self.assertTrue((CANVAS / f"{want[1]}.dc.html").exists(), gid)

    def test_K216_VF_016_default_required_is_the_same(self) -> None:
        """K216-VF-016 検査の既定の段 1 の組（--print-required）が、この試験の 21 組と同じ（一覧を 2 か所でずらさない）"""
        r = subprocess.run([sys.executable, str(GATE), "--print-required"], cwd=ROOT, capture_output=True, text=True, env=clean_env())
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(set(r.stdout.split()), set(GROUPS))

    def test_K216_VF_017_rule_tables_are_the_same(self) -> None:
        """K216-VF-017 検査の種類と役の表（--print-rules の JSON）が、この試験の KINDS・ROLES と同じ"""
        r = subprocess.run([sys.executable, str(GATE), "--print-rules"], cwd=ROOT, capture_output=True, text=True, env=clean_env())
        self.assertEqual(r.returncode, 0, r.stderr)
        rules = json.loads(r.stdout)
        self.assertEqual({k: sorted(v) for k, v in rules["roles"].items()}, {k: sorted(v) for k, v in ROLES.items()})
        self.assertEqual({k: (sorted(v["roles"]), sorted(v["widths"])) for k, v in rules["kinds"].items()},
                         {k: (sorted(r_), sorted(w)) for k, (r_, w) in KINDS.items()})


if __name__ == "__main__":
    unittest.main(verbosity=2)
