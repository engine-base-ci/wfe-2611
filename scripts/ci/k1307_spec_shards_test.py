#!/usr/bin/env python3
"""K-1307：spec の組の重い段（G57・G65）を別の組にして同時に流し、G65 は中の試験を置き場の変数 SPEC_SHARDS の数に分ける。

変数が無い（か 1）の回は、spec の組が今と全く同じに G57・G65 を流し、組 spec-parts は飛ぶ。2 以上なら spec の組は G57・G65 を流さず、
spec-parts が G57 を 1 組・G65 の並びを N 組に分けて流す（命令は 1 本も減らさない・組の中は && と同じく赤で止まる）。

  python3 scripts/ci/k1307_spec_shards_test.py      全部の行（行 ID は K1307-CI-NNN。11_tickets/K-1307.md の行の表と 1 対 1）
"""
from __future__ import annotations

import contextlib
import io
import json
import os
import pathlib
import re
import shlex
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "ci"))
import gate_cmds  # noqa: E402
import spec_run  # noqa: E402
from k1304_web_shards_test import ev  # noqa: E402  GitHub の式を値で評価する（K-1304 と同じ読み方）

WF = yaml.safe_load((ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8"))
JOBS = WF["jobs"]
BUILDER = (ROOT / "05_flow/build_testplan.py").read_text(encoding="utf-8")
PLAN = json.loads((ROOT / "07_qa/test-plan/test-plan.json").read_text(encoding="utf-8"))
G65_DIR = ROOT / "scripts/ci/g65.d"
LAST = "python3 scripts/ci/k248_scope_reach_test.py"
ME = "python3 scripts/ci/k1307_spec_shards_test.py"
SO = "needs.static.outputs"
HEAVY57 = "(steps.scope.outputs.full == 'true' || contains(steps.scope.outputs.gates, ',57,'))"
N_EXPR = f"fromJSON({SO}.spec_shards || '1')"


def cmds() -> list[str]:
    return gate_cmds.commands(G65_DIR, last=LAST)


def plan_gate(gid: int) -> dict:
    return next(g for g in PLAN["gates"] if g["id"] == gid and g["job"] == "spec")


def step(job: str, prefix: str) -> dict:
    hits = [s for s in JOBS[job]["steps"] if str(s.get("name", "")).startswith(prefix)]
    assert len(hits) == 1, (job, prefix, len(hits))
    return hits[0]


def ctx(shards: str, parts: str = "", part: str = "", full: str = "true", gates: str = "") -> dict[str, object]:
    return {"matrix.part": part, f"{SO}.spec_shards": shards, f"{SO}.spec_parts": parts, "steps.spec_shards.outputs.spec_shards": shards,
            "steps.scope.outputs.full": full, "steps.scope.outputs.gates": gates}


def runs(job: str, c: dict[str, object]) -> list[str]:
    """その回に流れる、名前のある段（if を値で評価した結果）"""
    out = []
    for s in JOBS[job]["steps"]:
        cond = s.get("if")
        if cond and "hashFiles" in str(cond):
            continue   # 置き場の中のファイルで決まる段は別の行（K1307-CI-007）で見る
        if cond is None or ev(str(cond) if str(cond).startswith("${{") else "${{ " + str(cond) + " }}", c):
            out.append(str(s.get("name") or s.get("uses") or s.get("run")))
    return out


# ---------------------------------------------------------------- spec_run.py を、命令を記録するだけの偽の subprocess で流す
class Run:
    def __init__(self, codes: list[int] | None = None) -> None:
        self.calls: list[list[str]] = []
        self.codes = list(codes or [])

    def __call__(self, cmd, **kw):   # noqa: ANN001
        self.calls.append(list(cmd))
        return subprocess.CompletedProcess(cmd, self.codes.pop(0) if self.codes else 0)


def go(argv: list[str], env: dict[str, str], codes: list[int] | None = None) -> tuple[int, list[list[str]], str]:
    fake = Run(codes)
    base = {k: v for k, v in os.environ.items() if not k.startswith(("SPEC_", "CI_"))}
    out = io.StringIO()
    old = os.getcwd()
    os.chdir(ROOT)
    try:
        with mock.patch.dict(os.environ, {**base, **env}, clear=True), mock.patch.object(spec_run.subprocess, "run", fake), \
                mock.patch.object(sys, "argv", ["spec_run.py", *argv]), contextlib.redirect_stdout(out):
            code = spec_run.main()
    finally:
        os.chdir(old)
    return code, fake.calls, out.getvalue()


class ShardCount(unittest.TestCase):
    def test_K1307_CI_001_variable_value_to_parts(self) -> None:
        """K1307-CI-001 入力：変数の値 → 分ける数と組の一覧。空は 1（spec-parts は飛ぶ印 off）。数でない・範囲の外は赤で出力を書かない"""
        self.assertEqual([spec_run.shard_count(v) for v in ("", "  ", "1", "3", "20")], [1, 1, 1, 3, 20])
        for bad in ("0", "21", "-1", "abc", "2.5", "3x", "３"):
            with self.subTest(bad), self.assertRaises(ValueError):
                spec_run.shard_count(bad)
        self.assertEqual(spec_run.parts(1), ["off"])
        self.assertEqual(spec_run.parts(3), ["g57", "g65-1", "g65-2", "g65-3"])
        with tempfile.TemporaryDirectory() as t:
            for raw, want in (("", ("1", ["off"])), ("3", ("3", ["g57", "g65-1", "g65-2", "g65-3"]))):
                out = pathlib.Path(t) / f"out-{raw or 'none'}"
                code, calls, _ = go(["shards", "--github-output", str(out)], {"SPEC_SHARDS_VAR": raw} if raw else {})
                got = dict(ln.split("=", 1) for ln in out.read_text(encoding="utf-8").splitlines())
                self.assertEqual((code, calls, got["spec_shards"], json.loads(got["spec_parts"])), (0, [], want[0], want[1]), raw)
            out = pathlib.Path(t) / "out-bad"
            code, _, text = go(["shards", "--github-output", str(out)], {"SPEC_SHARDS_VAR": "abc"})
            self.assertEqual(code, 1)
            self.assertIn("★", text)
            self.assertFalse(out.exists(), "読めない値では出力を書かない（spec の組が黙って今の形で流れ、static は赤）")


class Split(unittest.TestCase):
    def test_K1307_CI_002_split_keeps_every_command_once_in_order_and_last_at_end(self) -> None:
        """K1307-CI-002 対象の状態：本物の g65.d の並びを 1〜6 組に分ける。和は並びとちょうど同じ・組の中は元の順・k248 は最後の組の最後"""
        full = cmds()
        self.assertEqual(full[-1], LAST, "（前提）並びの最後は k248")
        self.assertEqual(spec_run.split(full, 1), [full], "1 組は今の並びそのもの")
        for n in range(2, 7):
            with self.subTest(n):
                got = spec_run.split(full, n)
                self.assertEqual(len(got), n)
                flat = [c for g in got for c in g]
                self.assertEqual(sorted(flat), sorted(full), "足し引きなし")
                self.assertEqual(len(flat), len(set(flat)), "重なりなし")
                for g in got:
                    self.assertTrue(g, "空の組を作らない")
                    self.assertEqual(g, [c for c in full if c in g], "組の中は元の並びの順")
                self.assertEqual(got[-1][-1], LAST, "k248 は最後の組の最後（K248-G57-016）")
                self.assertEqual(got, spec_run.split(full, n), "同じ入力で同じ分け方")
        with self.assertRaises(ValueError):
            spec_run.split(["a", LAST, "b"], 2)

    def test_K1307_CI_003_balanced_by_measured_seconds(self) -> None:
        """K1307-CI-003 時間の流れ：実測の重さで均す。3 組なら k248 が 1 つで 1 組・ほかの 2 組はどちらも k248 より軽い"""
        full = cmds()
        got = spec_run.split(full, 3)
        loads = [sum(spec_run.weight(c) for c in g) for g in got]
        self.assertEqual(got[-1], [LAST], f"いちばん重い k248 は 1 つで 1 組：{loads}")
        self.assertLess(max(loads[:-1]), spec_run.weight(LAST), f"ほかの組は k248 の組より短い：{loads}")
        self.assertEqual(spec_run.SECONDS[LAST], 370, "（実測）段の全部の CI の回 45816366366 の k248")
        self.assertTrue(all(c in full for c in spec_run.SECONDS), "重さの表は今の並びの命令だけ（消えた命令を残さない）")


class RunPart(unittest.TestCase):
    def test_K1307_CI_004_part_runs_its_commands_in_order(self) -> None:
        """K1307-CI-004 対象の状態：g65-2（3 組）は分けた 2 番目の命令だけを順に、引数に分けて流し 0 で終わる"""
        want = spec_run.split(cmds(), 3)[1]
        code, calls, text = go(["g65"], {"SPEC_PART": "g65-2", "SPEC_SHARDS": "3"})
        self.assertEqual(code, 0)
        self.assertEqual(calls, [shlex.split(c) for c in want])
        self.assertIn(f"{len(want)} 本", text)

    def test_K1307_CI_005_red_stops_rest_of_part_like_and_chain(self) -> None:
        """K1307-CI-005 失敗：組の 2 本目が赤（番号 3）なら、その組の残りは流さず 3 で終わり ★ と残りの本数を出す（&& と同じ）"""
        want = spec_run.split(cmds(), 3)[0]
        self.assertGreater(len(want), 2, "（前提）1 番目の組は 3 本以上")
        code, calls, text = go(["g65"], {"SPEC_PART": "g65-1", "SPEC_SHARDS": "3"}, codes=[0, 3])
        self.assertEqual(code, 3)
        self.assertEqual(calls, [shlex.split(c) for c in want[:2]], "赤の後ろは流さない")
        self.assertIn("★", text)
        self.assertIn(f"残り {len(want) - 2} 本", text)

    def test_K1307_CI_006_unknown_part_or_bad_shards_is_red_without_running(self) -> None:
        """K1307-CI-006 守り：組の一覧に無い組・G65 でない組・1 組の回・読めない数は、命令 0 で 1 と ★"""
        for env in ({"SPEC_PART": "g65-4", "SPEC_SHARDS": "3"}, {"SPEC_PART": "g57", "SPEC_SHARDS": "3"},
                    {"SPEC_PART": "g65-1", "SPEC_SHARDS": "1"}, {"SPEC_PART": "", "SPEC_SHARDS": "3"},
                    {"SPEC_PART": "g65-1", "SPEC_SHARDS": "abc"}, {"SPEC_PART": "g65-x", "SPEC_SHARDS": "2"}):
            with self.subTest(env):
                code, calls, text = go(["g65"], env)
                self.assertEqual((code, calls), (1, []))
                self.assertIn("★", text)

    def test_K1307_CI_007_real_processes_stop_at_first_red(self) -> None:
        """K1307-CI-007 入力：本物の子の process。置き場の 4 本を 2 組に分け、赤の 1 本の後ろは同じ組だけ流れない"""
        with tempfile.TemporaryDirectory() as t:
            d = pathlib.Path(t)
            g = d / "g.d"
            g.mkdir()
            for name, rc in (("a", 0), ("b", 0), ("c", 4), ("d", 0)):
                (d / f"{name}.py").write_text(f"import pathlib, sys\npathlib.Path({str(d / (name + '.ran'))!r}).write_text('x')\nsys.exit({rc})\n",
                                              encoding="utf-8")
            (g / "_base.txt").write_text("".join(f"{sys.executable} {d / n}.py\n" for n in "abcd"), encoding="utf-8")
            last = f"{sys.executable} {d / 'd'}.py"
            parts = spec_run.split(gate_cmds.commands(g, last=last), 2, last)
            self.assertEqual(parts, [[f"{sys.executable} {d / 'a'}.py", f"{sys.executable} {d / 'b'}.py"],
                                     [f"{sys.executable} {d / 'c'}.py", last]], "（前提）重さが同じなら前の組から順に入る")
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(spec_run.run_part("g65-1", 2, g, last), 0)
                self.assertEqual(spec_run.run_part("g65-2", 2, g, last), 4)
            self.assertEqual(sorted(p.stem for p in d.glob("*.ran")), ["a", "b", "c"], "赤の c の後ろの d は流れない（別の組の a・b は流れる）")
        # junit/ の無い作業場所でも、junit/<名前> に書く命令が書ける（spec の組では前の段が作る置き場を、分けた組は g65 が流す前に作る）
        with tempfile.TemporaryDirectory() as t:
            d = pathlib.Path(t)
            g = d / "g.d"
            g.mkdir()
            (d / "w.py").write_text("import pathlib\npathlib.Path('junit/w.xml').write_text('<testsuites/>')\n", encoding="utf-8")
            (d / "z.py").write_text("pass\n", encoding="utf-8")
            (g / "_base.txt").write_text(f"{sys.executable} {d / 'w.py'}\n{sys.executable} {d / 'z.py'}\n", encoding="utf-8")
            last = f"{sys.executable} {d / 'z.py'}"
            self.assertFalse((d / "junit").exists(), "（前提）junit/ は無い")
            old = os.getcwd()
            os.chdir(d)
            try:
                with contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(spec_run.run_part("g65-1", 2, g, last), 0, "junit/ が無くても赤にならない")
            finally:
                os.chdir(old)
            self.assertTrue((d / "junit" / "w.xml").exists(), "junit/w.xml が書けた")


class Workflow(unittest.TestCase):
    def test_K1307_CI_008_one_group_run_is_same_as_now(self) -> None:
        """K1307-CI-008 入口：1 組の回（spec_shards が 1・空）は spec の組が G57・G65 を今の命令で流し、spec-parts は飛ぶ"""
        g65 = step("spec", "G65 ")
        self.assertEqual(str(g65["run"]).strip(), gate_cmds.script(G65_DIR, last=LAST), "G65 の命令は今の && の並びそのもの")
        self.assertEqual(str(step("spec", "G57 ")["run"]).strip(), plan_gate(57)["script"].strip())
        for shards in ("1", ""):
            with self.subTest(shards):
                c = ctx(shards, parts="" if not shards else '["off"]')
                got = runs("spec", c)
                self.assertTrue(any(n.startswith("G57 ") for n in got) and any(n.startswith("G65 ") for n in got))
                self.assertFalse(ev(JOBS["spec-parts"]["if"], c), "spec-parts は飛ぶ")
                self.assertEqual(ev(JOBS["spec-parts"]["strategy"]["matrix"]["part"], c), ["off"], "飛ぶ回も matrix は空にしない")
        c = ctx("1", full="false", gates=",27,")
        self.assertFalse(any(n.startswith("G57 ") for n in runs("spec", c)), "範囲の回の G57 の条件は今と同じ（gates に無ければ流さない）")

    def test_K1307_CI_009_split_run_moves_g57_g65_to_parts(self) -> None:
        """K1307-CI-009 入口：3 組の回は spec の組で G57・G65 を流さず（ほかの段は今のまま）、spec-parts の 4 組がそれぞれ自分の段だけ流す"""
        parts = json.dumps(spec_run.parts(3))
        c = ctx("3", parts)
        names = runs("spec", c)
        self.assertFalse(any(n.startswith(("G57 ", "G65 ")) for n in names))
        self.assertEqual(len(runs("spec", ctx("1"))) - len(names), 2, "spec の組から外れるのは G57 と G65 の 2 段だけ")
        job = JOBS["spec-parts"]
        self.assertTrue(ev(job["if"], c))
        self.assertEqual(ev(job["strategy"]["matrix"]["part"], c), ["g57", "g65-1", "g65-2", "g65-3"])
        self.assertIs(job["strategy"]["fail-fast"], False)
        self.assertEqual(job["needs"], ["static"])
        self.assertEqual(job["env"], {"SPEC_PART": "${{ matrix.part }}", "SPEC_SHARDS": "${{ needs.static.outputs.spec_shards }}"})
        self.assertEqual(ev(job["name"], {"matrix.part": "g65-2"}), "spec (g65-2)")
        g57p, g65p = step("spec-parts", "G57.p "), step("spec-parts", "G65.p ")
        self.assertEqual(str(g57p["run"]).strip(), str(step("spec", "G57 ")["run"]).strip(), "G57 は spec と同じ命令")
        self.assertEqual(str(g65p["run"]).strip(), "python3 scripts/ci/spec_run.py g65")
        self.assertNotIn("env", g57p)
        self.assertNotIn("env", g65p)
        for part, want in (("g57", ["G57.p "]), ("g65-1", ["G65.p "]), ("g65-3", ["G65.p "])):
            with self.subTest(part):
                got = [n for n in runs("spec-parts", ctx("3", parts, part)) if re.match(r"G\d+\.p ", n)]
                self.assertEqual([n[:6] for n in got], want)
        self.assertEqual([n for n in runs("spec-parts", ctx("3", parts, "g57", full="false", gates=",27,")) if n.startswith("G57.p")], [],
                         "範囲の回の G57 の条件は spec と同じ")
        self.assertEqual(len([n for n in runs("spec-parts", ctx("3", parts, "g57", full="false", gates=",57,")) if n.startswith("G57.p")]), 1)
        # 準備は spec と同じ（checkout・部品・Python・DB・本線との分かれ目）・DB を消す段が最後で always()
        head = lambda j: [s for s in JOBS[j]["steps"][: next(i for i, s in enumerate(JOBS[j]["steps"]) if s.get("id") == "scope") + 1]]   # noqa: E731
        self.assertEqual(head("spec-parts"), head("spec"))
        self.assertIn("docker rm -f", str(JOBS["spec-parts"]["steps"][-1].get("run")))
        self.assertEqual(JOBS["spec-parts"]["steps"][-1].get("if"), "always()")

    def test_K1307_CI_010_static_step_and_outputs(self) -> None:
        """K1307-CI-010 守り：static に id spec_shards の段が 1 つ（env は SPEC_SHARDS_VAR だけ・命令の文字に vars を入れない・if は !cancelled()＝static の前の段が赤でも流れ、
        spec と spec-parts が同じ数を見る）と出力 2 つ。
        spec の組は static の出力を見ず（static が赤でも流す・K-143）、自分の段 id spec_shards（同じ命令・if は !cancelled()）の出力で G57・G65 を決める"""
        hits = [s for s in JOBS["static"]["steps"] if s.get("id") == "spec_shards"]
        self.assertEqual(len(hits), 1)
        s = hits[0]
        self.assertEqual(s.get("env"), {"SPEC_SHARDS_VAR": "${{ vars.SPEC_SHARDS }}"})
        self.assertEqual(s["run"].strip(), 'python3 scripts/ci/spec_run.py shards --github-output "$GITHUB_OUTPUT"')
        self.assertEqual(s.get("if"), "${{ !cancelled() }}", "static の前の段が赤でも流す（spec の組の自分の段と同じ数を出す）")
        own = [x for x in JOBS["spec"]["steps"] if x.get("id") == "spec_shards"]
        self.assertEqual(len(own), 1)
        self.assertEqual((own[0].get("env"), own[0]["run"].strip(), own[0].get("if")), (s.get("env"), s["run"].strip(), s.get("if")))
        sids = [x.get("id") or x.get("name") for x in JOBS["spec"]["steps"]]
        self.assertLess(sids.index("spec_shards"), sids.index(str(step("spec", "G57 ")["name"])), "G57・G65 より前")
        for x in JOBS["spec"]["steps"]:
            self.assertNotIn("needs.static", str(x.get("if", "")), x.get("name"))
        for p in ("G57 ", "G65 "):
            self.assertIn("fromJSON(steps.spec_shards.outputs.spec_shards || '1') < 2", str(step("spec", p)["if"]))
        out = JOBS["static"]["outputs"]
        self.assertEqual((out["spec_shards"], out["spec_parts"]),
                         ("${{ steps.spec_shards.outputs.spec_shards }}", "${{ steps.spec_shards.outputs.spec_parts }}"))
        ids = [x.get("id") for x in JOBS["static"]["steps"]]
        self.assertLess(ids.index("scope"), ids.index("spec_shards"))

    def test_K1307_CI_011_junit_names_and_waits(self) -> None:
        """K1307-CI-011 入口：JUnit を書いた組だけ junit-spec-parts-<組> を上げる（空なら赤・赤の組でも）。junit の組は spec-parts も待つ"""
        ups = [s for s in JOBS["spec-parts"]["steps"] if str(s.get("uses", "")).startswith("actions/upload-artifact@")]
        self.assertEqual(len(ups), 1)
        u = ups[0]
        self.assertEqual(u["if"], "${{ always() && hashFiles('junit/*.xml') != '' }}")
        self.assertEqual((u["with"]["name"], u["with"]["path"], u["with"]["if-no-files-found"]),
                         ("junit-spec-parts-${{ matrix.part }}", "junit/", "error"))
        hook = [x for x in JOBS["spec-parts"]["steps"] if str(x.get("name", "")).startswith("準備の時間切れを見分ける")]
        self.assertEqual(len(hook), 1, "K-193 の時間切れの見分けを spec-parts にも置く")
        self.assertEqual((hook[0].get("if"), hook[0]["run"].strip()), ("${{ failure() }}", "python3 scripts/ci/hook_timeout.py note junit"))
        names = [str(x.get("name") or x.get("uses")) for x in JOBS["spec-parts"]["steps"]]
        self.assertLess(names.index(str(step("spec-parts", "G65.p ")["name"])), names.index(str(hook[0]["name"])), "G65.p の後")
        self.assertIn("spec-parts", JOBS["junit"]["needs"])
        self.assertIn("always()", str(JOBS["junit"]["if"]))
        node = [c for c in cmds() if "junit/spec-k216-mjs.xml" in c]
        self.assertEqual(len(node), 1, "JUnit を書く G65 の命令は k216 の node の試験 1 本（置き場の名前は今のまま）")
        self.assertEqual(sum(node[0] in g for g in spec_run.split(cmds(), 3)), 1, "分けても 1 組だけが書く（名前が重ならない）")

    def test_K1307_CI_012_wiring_and_single_last(self) -> None:
        """K1307-CI-012 入口：g65.d/K-1307.txt がこの試験 1 行で CI の定義に在る。spec_run の G65_LAST と作り手の G65_LAST が同じ"""
        self.assertEqual((G65_DIR / "K-1307.txt").read_text(encoding="utf-8").strip(), ME)
        self.assertIn(ME, str(step("spec", "G65 ")["run"]))
        m = re.search(r'^G65_LAST = "([^"]+)"', BUILDER, re.M)
        self.assertEqual(m.group(1) if m else None, spec_run.G65_LAST)
        self.assertEqual(spec_run.G65_DIR, pathlib.Path("scripts/ci/g65.d"))
        for w in ("SPEC_SHARDS_STEP", "spec-parts", "spec_run.py g65", "SPEC_SPLIT"):
            self.assertIn(w, BUILDER, "CI の定義は作り手から（手で直さない）")


if __name__ == "__main__":
    unittest.main(verbosity=2)
