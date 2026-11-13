#!/usr/bin/env python3
"""K-186：CI の画面の試験で、画面の写真と報告を残さない・上げない（決める人 2026-11-13・answer=f0a119a288f6）"""
from __future__ import annotations

import pathlib
import re
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]


def web_steps() -> list[dict]:
    wf = yaml.safe_load((ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8"))
    return wf["jobs"]["web"]["steps"]


class WebArtifact(unittest.TestCase):
    def test_K186_CI_001_web_does_not_upload_screenshots(self) -> None:
        ups = [s for s in web_steps() if str(s.get("uses", "")).startswith("actions/upload-artifact")]
        names = [str((s.get("with") or {}).get("name")) for s in ups]
        self.assertNotIn("playwright-report-web", names, "画面の写真と HTML の報告を上げている")
        self.assertEqual(names.count("ci-results"), 1, "結果の記録（ci-results）を上げる段が 1 つ要る")
        self.assertEqual(names.count("junit-web"), 1, "JUnit の記録（junit-web）を上げる段が 1 つ要る")
        ci = [s for s in ups if (s.get("with") or {}).get("name") == "ci-results"][0]
        self.assertIn("!cancelled()", str(ci.get("if", "")))
        ju = [s for s in ups if (s.get("with") or {}).get("name") == "junit-web"][0]
        self.assertIn("always()", str(ju.get("if", "")))

    def test_K186_CI_002_row_test_takes_no_screenshot(self) -> None:
        src = (ROOT / "apps/web/tests/_lib/row.ts").read_text(encoding="utf-8")
        body = re.search(r"export function row\(.*?\n\}\n", src, re.S)
        self.assertIsNotNone(body, "row の定義を読めない")
        self.assertNotIn("screenshot", body.group(0))   # type: ignore[union-attr]
        self.assertNotIn("info.attach", body.group(0))  # type: ignore[union-attr]

    def test_K186_CI_003_unreadable_is_red(self) -> None:
        steps = web_steps()
        self.assertTrue(steps, "web の組の段を読めない")
        self.assertTrue([s for s in steps if str(s.get("uses", "")).startswith("actions/upload-artifact")],
                        "web の組の upload の段を 1 つも拾えない（拾い方が壊れた）")


if __name__ == "__main__":
    unittest.main(verbosity=2)
