#!/usr/bin/env python3
"""K-343 の試験：口の試験（apps/api）と DB を使う packages の試験の時間の上限を、vitest の既定の 5 秒から 30 秒以上にする。行 ID は K343-TT-NNN。
CI の台が混むと、パスワードを確かめる重い計算を含む試験が 5 秒を超えて赤になる（決める人の答え answer=c58ca37bdab7）。
時間を測って落とす形にはしない（台の混み方で揺れる）。設定の値と、上書きしている所を読んで確かめる"""
from __future__ import annotations

import pathlib
import re
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
CONFIG = ROOT / "vitest.config.ts"
FLOOR_MS = 30_000
# 試験を呼ぶ所（vitest の設定の外から上限を上書きできる所）
RUNNERS = ["package.json", "apps/*/package.json", "packages/*/package.json", ".github/workflows/*.yml", "05_flow/build_testplan.py"]
# 口と DB を使う試験の置き場（vitest.config.ts の include のうち apps/web・apps/bridge を除く。どちらも根の設定で流れる）
API_DB_TESTS = ["apps/api/*.test.ts", "packages/*.test.ts"]


def git(*args: str) -> str:
    return subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, text=True, encoding="utf-8").stdout


def test_block(text: str) -> str:
    m = re.search(r"\btest\s*:\s*\{", text)
    assert m, "vitest.config.ts に test: { … } が無い"
    return text[m.end():]


def ms(raw: str) -> int:
    return int(raw.replace("_", ""))


class ConfigTest(unittest.TestCase):
    def test_K343_TT_001_test_timeout_is_30s_or_more(self) -> None:
        text = CONFIG.read_text(encoding="utf-8")
        hits = re.findall(r"\btestTimeout\s*:\s*([\d_]+)", text)
        self.assertEqual(len(hits), 1, "testTimeout は vitest.config.ts に 1 か所（既定の 5 秒のままにしない）")
        self.assertIn("testTimeout", test_block(text), "testTimeout は test: の中に書く")
        self.assertGreaterEqual(ms(hits[0]), FLOOR_MS, "口の試験の上限は 30 秒以上")
        lines = text.splitlines()
        at = next(i for i, ln in enumerate(lines) if re.search(r"\btestTimeout\s*:\s*[\d_]+", ln))
        around = "\n".join(lines[max(0, at - 6): at + 1])   # 値の訳は値のすぐ上の注釈に書く
        self.assertIn("パスワード", around, "なぜ上げるか（パスワードを確かめる重い計算）を注釈に")
        self.assertIn("c58ca37bdab7", around, "決める人の答えの番号を注釈に")

    def test_K343_TT_002_hook_timeout_is_30s_or_more(self) -> None:
        text = CONFIG.read_text(encoding="utf-8")
        hits = re.findall(r"\bhookTimeout\s*:\s*([\d_]+)", text)
        self.assertEqual(len(hits), 1, "hookTimeout は vitest.config.ts に 1 か所（K-193）")
        self.assertGreaterEqual(ms(hits[0]), FLOOR_MS, "準備（beforeAll など）の上限も 30 秒以上")

    def test_K343_TT_003_not_overridden_shorter(self) -> None:
        # 試験を呼ぶ命令で --testTimeout・--hookTimeout を渡して設定を上書きしていない
        out = git("grep", "-n", "-I", "-E", r"--(test|hook)-?[Tt]imeout", "--", *RUNNERS)
        self.assertEqual(out.strip(), "", f"命令で上限を上書きしている：\n{out}")
        # 口と DB の試験の中で、上限を 30 秒より短く上書きしていない（試験の最後の引数・vi.setConfig・{ timeout: N }）
        files = [f for f in git("ls-files", "--", *API_DB_TESTS).splitlines() if f]
        self.assertTrue(files, "口と DB の試験が 1 つも見つからない（探し方が壊れている）")
        short: list[str] = []
        seen = 0
        for f in files:
            for n, ln in enumerate((ROOT / f).read_text(encoding="utf-8").splitlines(), 1):
                for pat in (r"^\s*\}\s*,\s*([\d_]+)\s*\)", r"\b(?:testTimeout|hookTimeout|timeout)\s*:\s*([\d_]+)"):
                    m = re.search(pat, ln)
                    if not m:
                        continue
                    if pat.startswith(r"\b") and "setConfig" not in ln and not re.search(r"\b(it|test|describe|beforeAll|beforeEach|afterAll|afterEach)\b", ln):
                        continue   # 試験の外の timeout（口の呼び出しの待ち時間など）は見ない
                    seen += 1
                    if ms(m.group(1)) < FLOOR_MS:
                        short.append(f"{f}:{n}: {ln.strip()}")
        self.assertGreater(seen, 0, "試験ごとの上限が 1 つも見つからない（K-342 の 60 秒があるはず。探し方が壊れている）")
        self.assertEqual(short, [], "30 秒より短い上限で上書きしている：\n" + "\n".join(short))

    def test_K343_TT_004_one_config_runs_api_and_db_tests(self) -> None:
        # 口と DB の試験は根の vitest.config.ts だけで流れる（別の設定があると、そこは既定の 5 秒のまま）
        configs = [f for f in git("ls-files").splitlines()
                   if re.search(r"(^|/)(vitest\.(config|workspace)|vite\.config)\.[cm]?[jt]s$", f) and "node_modules/" not in f]
        self.assertEqual(configs, ["vitest.config.ts"], "vitest の設定は根の 1 つだけ")
        block = test_block(CONFIG.read_text(encoding="utf-8"))
        for inc in ('"apps/*/test/**/*.test.ts"', '"packages/*/test/**/*.test.ts"', '"packages/*/src/**/*.test.ts"'):
            self.assertIn(inc, block, f"include に {inc}")
        self.assertNotRegex(block, r"\bprojects\s*:|\bworkspace\s*:", "projects で別の上限を持たない")


if __name__ == "__main__":
    unittest.main()
