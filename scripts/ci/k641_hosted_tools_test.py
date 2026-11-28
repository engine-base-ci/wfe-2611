#!/usr/bin/env python3
"""K-641 の試験：GitHub の台（ubuntu-24.04）に無い道具を、段の中で入れる。入っていれば飛ばす（Mac の箱の像では何も入れない）。

  python3 scripts/ci/k641_hosted_tools_test.py      全部の行（行 ID は K641-CI-NNN。11_tickets/K-641.md の行の表と 1 対 1）

見る物：CI の定義（.github/workflows/v3-gate.yml）の web の組と、像を温める命令（ticket-flow.yaml の vm.warm）。
道具をそろえる段の命令は、偽の sudo・lsof を PATH に置いて本物の bash で流し、呼ばれた順を見る（apt に触らない・決まった時間で終わる）。
"""
from __future__ import annotations

import os
import pathlib
import re
import stat
import subprocess
import tempfile
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
WF = yaml.safe_load((ROOT / ".github" / "workflows" / "v3-gate.yml").read_text(encoding="utf-8"))
CFG = yaml.safe_load((ROOT / "ticket-flow.yaml").read_text(encoding="utf-8"))
JOBS = WF["jobs"]
TOOLS_MARK = "台の道具をそろえる"
BASH = "/bin/bash"


def runs(job: str) -> list[str]:
    return [str(s.get("run", "")) for s in JOBS[job].get("steps", [])]


def tools_steps(job: str) -> list[tuple[int, dict]]:
    return [(i, s) for i, s in enumerate(JOBS[job].get("steps", [])) if TOOLS_MARK in str(s.get("name", ""))]


def the_run() -> str:
    found = tools_steps("web")
    assert len(found) == 1, f"web の組に道具をそろえる段がちょうど 1 つ（見つかった数 {len(found)}）"
    return str(found[0][1]["run"])


def fake(d: pathlib.Path, name: str, body: str) -> None:
    f = d / name
    f.write_text("#!/bin/bash\n" + body, encoding="utf-8")
    f.chmod(f.stat().st_mode | stat.S_IEXEC)


def go(have_lsof: bool, update_rc: int = 0, install_rc: int = 0) -> tuple[int, list[str]]:
    """段の命令を本物の bash で流す。PATH は偽の物だけ（本物の lsof・apt を見ない）。戻りは（終了コード, sudo に渡った命令の並び）"""
    with tempfile.TemporaryDirectory() as t:
        d = pathlib.Path(t)
        log = d / "sudo.log"
        fake(d, "sudo", f'echo "$*" >> "{log}"\ncase "$*" in *update*) exit {update_rc};; *install*) exit {install_rc};; esac\n')
        if have_lsof:
            fake(d, "lsof", "exit 0\n")
        r = subprocess.run([BASH, "-e", "-o", "pipefail", "-c", the_run()], env={"PATH": str(d)}, capture_output=True, text=True, timeout=30)
        calls = log.read_text(encoding="utf-8").splitlines() if log.exists() else []
        return r.returncode, calls


class StepPlace(unittest.TestCase):
    def test_K641_CI_001_web_job_has_the_step_before_first_lsof_and_deps_with_browser(self):
        runs_web = runs("web")
        at = tools_steps("web")[0][0]
        first_lsof = next(i for i, r in enumerate(runs_web) if "lsof" in r and TOOLS_MARK not in str(JOBS["web"]["steps"][i].get("name", "")))
        self.assertLess(at, first_lsof, "lsof を使う最初の段（番号が空いているか）より前に入れる")
        for job, j in JOBS.items():
            uses = [i for i, r in enumerate(runs(job)) if re.search(r"\blsof\b", r) and TOOLS_MARK not in str(j["steps"][i].get("name", ""))]
            if uses:
                with self.subTest(job):
                    self.assertTrue(tools_steps(job) and tools_steps(job)[0][0] < uses[0], f"{job}：lsof を使う組は、使う前に道具をそろえる段を持つ")
        pw = [r for r in runs_web if "playwright install" in r]
        self.assertEqual(len(pw), 1, "web の組のブラウザの用意は 1 つ")
        self.assertRegex(pw[0], r"playwright install --with-deps chromium\b", "字体（日本語）と部品も入れる。像の温めと同じ命令")
        warm = [str(w) for w in (CFG.get("vm") or {}).get("warm") or [] if "playwright install" in str(w)]
        self.assertTrue(warm and all("--with-deps chromium" in w for w in warm), "（前提）像の温めも --with-deps chromium")
        self.assertEqual(pw[0].split("#")[0].strip().split("exec ")[-1], warm[0].split("exec ")[-1], "命令の後ろ（playwright install --with-deps chromium）が像の温めと同じ")


class StepBehaviour(unittest.TestCase):
    def test_K641_CI_002_present_skips_absent_installs_in_order(self):
        code, calls = go(have_lsof=True)
        self.assertEqual((code, calls), (0, []), "入っていれば sudo も apt も呼ばない（像の Mac の箱では何も入れない）")
        code, calls = go(have_lsof=False)
        self.assertEqual(code, 0)
        self.assertEqual(len(calls), 2, f"sudo に渡る命令は 2 つ：{calls}")
        self.assertRegex(calls[0], r"^apt-get update\b")
        self.assertRegex(calls[1], r"^apt-get install -y\b.*\blsof$")

    def test_K641_CI_003_failures_make_the_step_red_and_stop_early(self):
        code, calls = go(have_lsof=False, install_rc=100)
        self.assertNotEqual(code, 0, "入れるのに失敗したら段が赤（番号の確かめが lsof 無しで静かに通らない）")
        code, calls = go(have_lsof=False, update_rc=100)
        self.assertNotEqual(code, 0, "apt の更新が落ちたら赤")
        self.assertEqual(len(calls), 1, "更新が落ちたら install まで進まない")


class StepStaysSmall(unittest.TestCase):
    def test_K641_CI_004_only_lsof_and_only_through_apt(self):
        run = the_run()
        self.assertEqual(sorted({x.strip() for x in re.findall(r"apt-get install\b[^;&}]*", run)}), ["apt-get install -y -qq lsof"], "入れる物は lsof だけ（足すときはこの試験と一覧を直す）")
        for banned in ("curl", "wget", "| sh", "| bash", "pip ", "npm ", "pnpm ", "brew"):
            self.assertNotIn(banned, run, f"外から取って流す形（{banned}）にしない：入れる道は distro の apt だけ")
        self.assertNotIn("${{", run, "外から来る値を命令の字に入れない")

    def test_K641_CI_005_other_jobs_stay_free_of_apt(self):
        for job in JOBS:
            if job == "web":
                continue
            with self.subTest(job):
                self.assertFalse([r for r in runs(job) if re.search(r"\bapt-get\b|\bsudo\b", r)], f"{job}：web の組のほかに、apt・sudo を呼ぶ段を足さない（組の時間を増やさない）")
        self.assertFalse(tools_steps("static") or tools_steps("database") or tools_steps("unit") or tools_steps("spec"), "道具をそろえる段は web の組だけ")


if __name__ == "__main__":
    unittest.main(verbosity=2)
