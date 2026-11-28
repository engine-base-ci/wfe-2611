#!/usr/bin/env python3
"""K-640 の試験：CI の定義の全部の組が、リポジトリの変数 CI_RUNNER で台を替えられる形で書かれている。変数が無ければ今までの台（自分の Mac の使い捨ての Linux の VM）。

  python3 scripts/ci/k640_runs_on_test.py      全部の行（行 ID は K640-CI-NNN。11_tickets/K-640.md の行の表と 1 対 1）

見る物：作り手（05_flow/build_testplan.py）と、作った 3 つの定義（.github/workflows/v3-gate.yml・staging-e2e.yml・release-gate.yml）。
台の式は、GitHub の式のうちこの形だけを読む小さな読み手（このファイルの resolve）で、変数の値ごとに本当に評価する
（字があるかだけでは、既定の台を取り違えても緑になるため）。知らない形は黙って通さず止める。
ほかの試験（k172・k173・k174・k204・k258・k323）は、ここの default_of で「変数が無いときの台」を読む。
"""
from __future__ import annotations

import ast
import json
import pathlib
import re
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
WORKFLOWS = ("v3-gate.yml", "staging-e2e.yml", "release-gate.yml")
EXPR = "${{ fromJSON(vars.CI_RUNNER || '[\"self-hosted\",\"linux-vm\"]') }}"
VAR_NAME = "CI_RUNNER"
SHAPE = re.compile(r"\$\{\{\s*fromJSON\(\s*vars\.([A-Za-z_][A-Za-z0-9_]*)\s*\|\|\s*'([^']*)'\s*\)\s*\}\}")


def resolve(expr: str, value: str = "") -> str | list[str]:
    """job の runs-on の式を、変数 CI_RUNNER の値（無ければ空の字）で評価する。式が知らない形・値が台の名前として読めない形なら ValueError。
    GitHub と同じく、変数が空の字なら右（既定）を使い、空でない字（空白だけでも）は JSON として読む"""
    m = SHAPE.fullmatch(str(expr).strip())
    if not m:
        raise ValueError(f"台の式がこの試験の読み手の知らない形：{expr!r}")
    if m.group(1) != VAR_NAME:
        raise ValueError(f"台を選ぶ変数は {VAR_NAME} だけ（{m.group(1)}）")
    picked = value if value != "" else m.group(2)
    got = json.loads(picked)
    names = [got] if isinstance(got, str) else got
    if not isinstance(names, list) or not names or not all(isinstance(x, str) and x.strip() for x in names):
        raise ValueError(f"台の名前は空でない文字か、その配列：{picked!r}")
    return got


def default_of(runs_on) -> list[str]:
    """変数が無いときの台。式でも、今までの書き方（配列）でも読める（ほかの試験が「今までの台」を比べるときに使う）"""
    got = resolve(runs_on) if isinstance(runs_on, str) else runs_on
    return [got] if isinstance(got, str) else list(got)


def load(name: str) -> dict:
    return yaml.safe_load((ROOT / ".github" / "workflows" / name).read_text(encoding="utf-8"))


def text(name: str) -> str:
    return (ROOT / ".github" / "workflows" / name).read_text(encoding="utf-8")


def all_jobs() -> list[tuple[str, str, dict]]:
    return [(wf, job, j) for wf in WORKFLOWS for job, j in load(wf)["jobs"].items()]


class EveryJobUsesTheVariable(unittest.TestCase):
    def test_K640_CI_001_every_job_in_every_workflow_has_the_same_expression(self):
        jobs = all_jobs()
        self.assertGreaterEqual(len(jobs), 18, "v3-gate 16 組・staging-e2e 1 組・release-gate 1 組。組が消えたら気づく")
        for wf, job, j in jobs:
            with self.subTest(f"{wf} {job}"):
                self.assertEqual(j.get("runs-on"), EXPR, "台の式は 1 字も違わない（組ごとに別の書き方を作らない）")
        for wf in WORKFLOWS:
            self.assertEqual(len(re.findall(r"^\s+runs-on:", text(wf), re.M)), len(load(wf)["jobs"]), f"{wf}：runs-on の行の数＝組の数")

    def test_K640_CI_006_staging_and_release_follow_the_same_variable(self):
        for wf in ("staging-e2e.yml", "release-gate.yml"):
            with self.subTest(wf):
                for job, j in load(wf)["jobs"].items():
                    self.assertEqual(j.get("runs-on"), EXPR, f"{wf} {job}")
        stg = load("staging-e2e.yml")["jobs"]["e2e"]
        self.assertEqual(stg.get("environment"), "staging", "staging の住所と鍵は Environment だけから（台を替えても変えない）")
        self.assertEqual(stg.get("if"), "github.ref == 'refs/heads/main'", "main からだけ起こせる条件は変えない")


class ExpressionValue(unittest.TestCase):
    def test_K640_CI_002_without_the_variable_the_old_vm_label(self):
        label = (yaml.safe_load((ROOT / "ticket-flow.yaml").read_text(encoding="utf-8")).get("vm") or {}).get("label")
        self.assertTrue(label, "（前提）ticket-flow.yaml の vm.label")
        self.assertEqual(resolve(EXPR, ""), ["self-hosted", label], "変数が無い・空なら、今までどおり自分の Mac の使い捨ての VM（self-hosted と vm.label）")
        for wf, job, j in all_jobs():
            self.assertEqual(default_of(j["runs-on"]), ["self-hosted", label], f"{wf} {job}")

    def test_K640_CI_003_variable_value_picks_the_runner(self):
        self.assertEqual(resolve(EXPR, '"ubuntu-24.04"'), "ubuntu-24.04", "文字 1 つ")
        self.assertEqual(resolve(EXPR, '["ubuntu-24.04"]'), ["ubuntu-24.04"], "配列 1 つ")
        self.assertEqual(resolve(EXPR, '["self-hosted","linux-vm"]'), ["self-hosted", "linux-vm"], "今までの台を変数で明示してもよい")
        for bad in ("ubuntu-24.04", "[]", '[""]', "[1]", "{}", " ", "null", "7"):
            with self.subTest(bad):
                with self.assertRaises(ValueError, msg=f"台として読めない値 {bad!r} は黙って通さない（GitHub でも組が始まらず赤になる）"):
                    resolve(EXPR, bad)
        with self.assertRaises(ValueError, msg="読み手が知らない式は止める"):
            resolve("${{ vars.CI_RUNNER }}", "")
        with self.assertRaises(ValueError, msg="別の変数を読む式は止める"):
            resolve("${{ fromJSON(vars.OTHER || '[\"self-hosted\"]') }}", "")


class OnlyTheVariable(unittest.TestCase):
    def test_K640_CI_004_no_outside_value_picks_the_machine(self):
        for wf, job, j in all_jobs():
            expr = str(j.get("runs-on"))
            for banned in ("inputs.", "secrets.", "github.", "env.", "needs.", "matrix."):
                self.assertNotIn(banned, expr, f"{wf} {job}：台の式が {banned} を読む（外から来る値で台を選べてしまう）")
        words = re.findall(r"[A-Za-z_][A-Za-z0-9_.]*", re.sub(r"'[^']*'", "", EXPR))
        self.assertEqual(sorted(set(words)), ["fromJSON", "vars.CI_RUNNER"], "式が読む語は fromJSON と変数 CI_RUNNER だけ")
        for wf in WORKFLOWS:
            self.assertNotRegex(text(wf), r"(?<![\w-])(ubuntu-|macos-|windows-)\d", f"{wf} に GitHub の台の名前を直に書かない（台の名前は変数にだけ置く）")

    def test_K640_CI_005_maker_has_one_definition_and_no_raw_label(self):
        maker = (ROOT / "05_flow" / "build_testplan.py").read_text(encoding="utf-8")
        self.assertEqual(len(re.findall(r"^RUNS_ON\s*=", maker, re.M)), 1, "式の定義は作り手に 1 つ")
        defined = ast.literal_eval(re.search(r"^RUNS_ON\s*=\s*(.*)$", maker, re.M).group(1))
        self.assertEqual(defined, EXPR, "作り手の定義の値がこの試験の式と同じ")
        lines = [ln for ln in maker.splitlines() if "runs-on:" in ln]
        self.assertGreaterEqual(len(lines), 12, "作り手の runs-on の行（今 12）")
        for ln in lines:
            self.assertEqual(ln.strip(), "runs-on: {RUNS_ON}", "作り手の runs-on の行はどれも定義の名前を差す（台の名前を直に書かない）")


class OnlyHandStartedTriggers(unittest.TestCase):
    """公開のリポジトリで流す前提：外（fork・コメント・PR）から勝手に起こせる引き金が無い。台の変数が無い公開側で、既定の self-hosted に載る抜け道を作らない"""

    BANNED = ("pull_request", "pull_request_target", "issue_comment", "workflow_run", "pull_request_review", "pull_request_review_comment", "schedule", "repository_dispatch", "issues", "fork")

    @staticmethod
    def on_of(name: str) -> dict:
        doc = load(name)
        on = doc.get("on", doc.get(True))   # YAML 1.1 は on を True に読む
        return on if isinstance(on, dict) else {k: None for k in (on if isinstance(on, list) else [on])}

    def test_K640_CI_007_triggers_are_hand_tag_release_only_and_secrets_are_narrow(self):
        want = {"v3-gate.yml": {"workflow_dispatch"}, "staging-e2e.yml": {"workflow_dispatch"}, "release-gate.yml": {"workflow_dispatch", "push", "release"}}
        for wf, keys in want.items():
            with self.subTest(wf):
                on = self.on_of(wf)
                self.assertEqual(set(on), keys, f"{wf} の on: は今の集合と 1 字も違わない")
                self.assertFalse(set(on) & set(self.BANNED), f"{wf}：外から起こせる引き金がある")
        rel = self.on_of("release-gate.yml")
        self.assertEqual(rel["push"], {"tags": ["v*"]}, "push はタグ v* だけ（枝の引き金 branches を持たない）")
        self.assertEqual(rel["release"], {"types": ["published"]})
        self.assertNotIn("permissions", load("v3-gate.yml"), "（前提）v3-gate は定義の頭に permissions を持たない")
        self.assertEqual(sorted(set(re.findall(r"secrets\.([A-Za-z0-9_]+)", text("v3-gate.yml")))), ["GITHUB_TOKEN"], "v3-gate の秘密は GITHUB_TOKEN だけ")
        self.assertEqual(sorted(set(re.findall(r"secrets\.([A-Za-z0-9_]+)", text("staging-e2e.yml")))), ["STAGING_API_BASE", "STAGING_BASE_URL", "STAGING_DATABASE_READ_URL", "STAGING_OPS_PASSKEY_ID", "STAGING_OPS_PASSKEY_KEY", "STAGING_OPS_PASSKEY_USER", "STAGING_RESEND_READ_KEY"],
                         "staging の秘密は STAGING_ の 7 つだけ（K-1102：運営の人の試験だけのパスキー 3 つ・K-1101 の準備）")
        self.assertNotIn("secrets.", text("release-gate.yml"), "release-gate は秘密を使わない")
        for wf in WORKFLOWS:
            self.assertNotRegex(text(wf), r"secrets\s*:\s*inherit|toJSON\(\s*secrets", f"{wf}：秘密をまとめて渡さない")
        gated = [j for j, v in load("v3-gate.yml")["jobs"].items() if "pull_request" in str(v.get("if", ""))]
        self.assertEqual(sorted(gated), ["auto-merge", "task-gate"], "pull_request の条件を読む組は今の 2 つだけ（引き金が無いので動かない）")


if __name__ == "__main__":
    unittest.main(verbosity=2)
