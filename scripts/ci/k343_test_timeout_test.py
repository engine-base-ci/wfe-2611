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
# 命令で上限を上書きする所は、リポジトリの全部から探す（package.json・CI の定義・vitest を起こす台本 scripts/ci/ci_scope.py・cut_check.py・spec-dependencies.yaml など）。
# チケットの文書とこの試験自身は除く
RUNNERS = [".", ":!11_tickets", ":!scripts/ci/k343_test_timeout_test.py"]
# 待つだけの道具の上限（試験の上限ではない）。この呼び出しの中の timeout: は見ない
WAITERS = re.compile(r"\bexpect\s*\.\s*poll\b|\bvi\s*\.\s*waitFor\b")
# 口と DB を使う試験の置き場（vitest.config.ts の include のうち apps/web・apps/bridge を除く。どちらも根の設定で流れる）
API_DB_TESTS = ["apps/api/*.test.ts", "packages/*.test.ts"]


def git(*args: str) -> str:
    return subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, text=True, encoding="utf-8").stdout


def strip_comments(text: str) -> str:
    """注釈（/* … */ と // …）を外す。文字（"…" '…' `…`）の中の // や /* は残す。行の数は変えない"""
    out: list[str] = []
    i, quote = 0, ""
    while i < len(text):
        c = text[i]
        if quote:
            out.append(c)
            if c == "\\" and i + 1 < len(text):
                out.append(text[i + 1])
                i += 2
                continue
            if c == quote:
                quote = ""
        elif c in "\"'`":
            quote = c
            out.append(c)
        elif text.startswith("//", i):
            j = text.find("\n", i)
            i = len(text) if j < 0 else j
            continue
        elif text.startswith("/*", i):
            j = text.find("*/", i + 2)
            end = len(text) if j < 0 else j + 2
            out.append("\n" * text.count("\n", i, end))
            i = end
            continue
        else:
            out.append(c)
        i += 1
    return "".join(out)


def call_spans(text: str, start: re.Pattern[str]) -> list[tuple[int, int]]:
    """start に当たる呼び出し（名前のすぐ後の括弧から、対になる閉じ括弧まで）の文字の範囲。呼び出しが何行に折り返していても全部入る"""
    spans: list[tuple[int, int]] = []
    for m in start.finditer(text):
        j = text.find("(", m.end())
        if j < 0:
            continue
        depth, k = 0, j
        while k < len(text):
            depth += {"(": 1, ")": -1}.get(text[k], 0)
            k += 1
            if depth == 0:
                break
        spans.append((m.start(), k))
    return spans


def test_block(text: str) -> str:
    """test: { … } の中身（注釈を外した後の文字）"""
    text = strip_comments(text)
    m = re.search(r"\btest\s*:\s*\{", text)
    assert m, "vitest.config.ts に test: { … } が無い"
    depth, i = 1, m.end()
    while depth and i < len(text):
        depth += {"{": 1, "}": -1}.get(text[i], 0)
        i += 1
    return text[m.end(): i - 1]


def top_level_keys(block: str) -> dict[str, str]:
    """test: の直下（入れ子でない所）の「名前: 値」。coverage: { … } などの中の物は入らない"""
    keys: dict[str, str] = {}
    depth = 0
    for m in re.finditer(r"[{}\[\]()]|\b([A-Za-z]+)\s*:\s*([\d_]+)", block):
        tok = m.group(0)
        if tok in "{[(":
            depth += 1
        elif tok in "}])":
            depth -= 1
        elif depth == 0:
            keys.setdefault(m.group(1), m.group(2))
            keys[m.group(1) + "#count"] = str(int(keys.get(m.group(1) + "#count", "0")) + 1)
    return keys


def ms(raw: str) -> int:
    return int(raw.replace("_", ""))


class ConfigTest(unittest.TestCase):
    def test_K343_TT_001_test_timeout_is_30s_or_more(self) -> None:
        text = CONFIG.read_text(encoding="utf-8")
        hits = re.findall(r"\btestTimeout\s*:\s*([\d_]+)", strip_comments(text))   # 注釈の中の文字は数えない
        self.assertEqual(len(hits), 1, "testTimeout は vitest.config.ts に 1 か所（既定の 5 秒のままにしない）")
        keys = top_level_keys(test_block(text))
        self.assertEqual(keys.get("testTimeout#count"), "1", "testTimeout は test: の直下に書く（coverage: などの中ではない）")
        self.assertGreaterEqual(ms(keys["testTimeout"]), FLOOR_MS, "口の試験の上限は 30 秒以上")
        lines = text.splitlines()
        at = next(i for i, ln in enumerate(lines) if re.search(r"\btestTimeout\s*:\s*[\d_]+", ln))
        around = "\n".join(lines[max(0, at - 6): at + 1])   # 値の訳は値のすぐ上の注釈に書く
        self.assertIn("パスワード", around, "なぜ上げるか（パスワードを確かめる重い計算）を注釈に")
        self.assertIn("c58ca37bdab7", around, "決める人の答えの番号を注釈に")

    def test_K343_TT_002_hook_timeout_is_30s_or_more(self) -> None:
        text = CONFIG.read_text(encoding="utf-8")
        hits = re.findall(r"\bhookTimeout\s*:\s*([\d_]+)", strip_comments(text))
        self.assertEqual(len(hits), 1, "hookTimeout は vitest.config.ts に 1 か所（K-193）")
        keys = top_level_keys(test_block(text))
        self.assertEqual(keys.get("hookTimeout#count"), "1", "hookTimeout は test: の直下に書く")
        self.assertGreaterEqual(ms(keys["hookTimeout"]), FLOOR_MS, "準備（beforeAll など）の上限も 30 秒以上")

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
            text = strip_comments((ROOT / f).read_text(encoding="utf-8"))
            # 待つだけの道具（expect.poll・vi.waitFor）の上限は試験の上限ではない。その呼び出しの括弧の中は、何行に折り返していても見ない
            waits = call_spans(text, WAITERS)
            for pat in (r"(?m)^\s*\}\s*,\s*([\d_]+)\s*\)", r"\b(?:testTimeout|hookTimeout|timeout)\s*:\s*([\d_]+)"):
                for m in re.finditer(pat, text):
                    if pat.startswith(r"\b") and any(a <= m.start() < b for a, b in waits):
                        continue
                    seen += 1
                    if ms(m.group(1)) < FLOOR_MS:
                        n = text.count("\n", 0, m.start()) + 1
                        short.append(f"{f}:{n}: {m.group(0).strip()}")
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
