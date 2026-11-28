#!/usr/bin/env python3
"""static_screens.py の自己試験（K-53・テスターのレビュー HIGH）。台帳の画面が被覆済みと数えられる条件（S1〜S4）を、
赤になるべき形を 1 つずつ作って確かめる。使い方: python3 scripts/ci/static_screens_test.py"""
import sys, tempfile, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from static_screens import check  # noqa: E402

GOOD_REASON = "ひな形と設定だけで埋めるので DB も API も読まない（試験の理由）"


class StaticScreensTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.page = self.root / "apps/web/app/(outside)/legal/[kind]/page.tsx"
        self.page.parent.mkdir(parents=True)
        (self.root / "apps/web/features").mkdir(parents=True)
        self.write("apps/web/features/text.ts", 'export const t = () => "文面";\n')
        self.page.write_text('import { t } from "@/features/text";\n// fetch("/api/x") は注釈なので数えない\nexport default () => t();\n')
        self.ledger = {"legal": {"reason": GOOD_REASON, "source": ["D-1"], "code": ["apps/web/app/(outside)/legal"]}}

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, rel, src):
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(src)

    def run_check(self, screen_api=None, flow=("legal",)):
        return check(self.root, set(flow), self.ledger, screen_api or {})

    def test_ok_when_reason_and_code_do_not_call_api(self):
        ok, fails = self.run_check()
        self.assertEqual(ok, {"legal"})
        self.assertEqual(fails, [])

    def test_red_when_reason_is_empty(self):
        self.ledger["legal"]["reason"] = " "
        ok, fails = self.run_check()
        self.assertEqual(ok, set())
        self.assertTrue(any("S1" in w for _, w in fails))

    def test_red_when_source_is_missing(self):
        self.ledger["legal"]["source"] = []
        self.assertTrue(any("S1" in w for _, w in self.run_check()[1]))

    def test_red_when_not_in_flow(self):
        self.assertTrue(any("S2" in w for _, w in self.run_check(flow=())[1]))

    def test_red_when_also_in_screen_api(self):
        ok, fails = self.run_check(screen_api={"legal": [("GET", "/auth/terms/current", "A96", "t", "getCurrentTerms", [])]})
        self.assertEqual(ok, set())
        self.assertTrue(any("S3" in w for _, w in fails))

    def test_red_when_page_calls_fetch(self):
        self.page.write_text('export default async () => (await fetch("https://x.example")).text();\n')
        ok, fails = self.run_check()
        self.assertEqual(ok, set())
        self.assertTrue(any("fetch(" in w for _, w in fails))

    def test_red_when_imported_file_uses_api_client(self):
        self.write("apps/web/features/text.ts", 'import { call } from "@/lib/api";\nexport const t = () => call("getCurrentTerms");\n')
        ok, fails = self.run_check()
        self.assertEqual(ok, set())
        self.assertTrue(any("features/text.ts" in w and "@/lib/api" in w for _, w in fails))

    def test_red_when_relative_import_writes_api_path(self):
        self.write("apps/web/app/(outside)/legal/[kind]/load.ts", 'export const u = "/api/v1/auth/terms/current";\n')
        self.page.write_text('import { u } from "./load";\nexport default () => u;\n')
        self.assertTrue(any("/api/" in w for _, w in self.run_check()[1]))

    def test_red_when_code_entry_is_missing(self):
        self.ledger["legal"]["code"] = ["apps/web/app/(outside)/nowhere"]
        self.assertTrue(any("S4 入口が無い" in w for _, w in self.run_check()[1]))

    def test_red_when_code_is_empty(self):
        self.ledger["legal"]["code"] = []
        self.assertTrue(any("S4" in w for _, w in self.run_check()[1]))


if __name__ == "__main__":
    unittest.main(verbosity=1)
