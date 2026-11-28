#!/usr/bin/env python3
"""K-999 の形の試験：段 13 の統合テスト（apps/e2e/staging/k999-f12.spec.ts と _lib/f12-steps.ts）の置き場・行 ID・逃げ道・記録に出さない書き方。
行 ID は K999-FM-NNN。staging にはつながない（試験の本体が流れるのは、main から手で起こす staging-e2e.yml の回だけ）。チケットの CI（G65）で流れる"""
from __future__ import annotations

import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
STAGING = ROOT / "apps" / "e2e" / "staging"
SPEC = STAGING / "k999-f12.spec.ts"
LIB = STAGING / "_lib" / "f12-steps.ts"
TICKET = ROOT / "11_tickets" / "K-999.md"
G65 = ROOT / "scripts" / "ci" / "g65.d" / "K-999.txt"
WITH_TEST = ["K999-STG-01", "K999-STG-02"]
NO_TEST = ["K999-STG-03", "K999-STG-04", "K999-STG-05", "K999-STG-06", "K999-H-001"]
MAX_TEST_MS = 480_000


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


def code(path: pathlib.Path) -> str:
    """注釈（// の行と行末の // …・/* … */）を除いた中身。注釈に書いた説明の字で赤にしない"""
    text = re.sub(r"/\*.*?\*/", "", read(path), flags=re.S)
    return "\n".join(re.sub(r"(^|\s)//.*$", "", ln) for ln in text.splitlines())


def titles() -> list[str]:
    return re.findall(r'^test\(\s*"([^"]+)"', read(SPEC), flags=re.M)


def judge_skip() -> str:
    m = re.search(r"```judge-skip\n(.*?)```", read(TICKET), flags=re.S)
    return m.group(1) if m else ""


class K999StagingShape(unittest.TestCase):
    def test_K999_FM_001_place_and_imports(self) -> None:
        self.assertTrue(SPEC.exists(), "試験は apps/e2e/staging/k999-f12.spec.ts（設定の testMatch k<数>-*.spec.ts に当たる名前）")
        self.assertTrue(LIB.exists(), "道具は apps/e2e/staging/_lib/f12-steps.ts")
        for p in (SPEC, LIB):
            imports = re.findall(r'from\s+"([^"]+)"', code(p))
            for imp in imports:
                self.assertFalse(imp.startswith(("../../web", "../journeys", "@kaname/")), f"{p.name} が {imp} を読む（staging の外の道具・製品の部品を読まない）")

    def test_K999_FM_002_rows_and_tests(self) -> None:
        got = [t.split(" ")[0] for t in titles()]
        self.assertEqual(got, WITH_TEST, "試験は 2 本で、名前の頭が K999-STG-01・02 の順")
        self.assertNotRegex(read(SPEC), r"test\.describe\(", "入れ子なし")
        md = read(TICKET)
        skip = judge_skip()
        for row in WITH_TEST + NO_TEST:
            self.assertIn(f"| {row} |", md, f"{row} がチケットの行の表に在る")
        for row in NO_TEST + WITH_TEST:
            self.assertRegex(skip, rf"- {row}: \S", f"{row} が judge-skip に訳つきで在る")

    def test_K999_FM_003_no_escape(self) -> None:
        bad = [r"\.skip\(", r"\.fixme\(", r"\.fail\(", r"\.only\(", r"waitForTimeout", r"(?<!test\.)setTimeout\(", r"page\.route\(",
               r"\.fulfill\(", r"x-forwarded-for", r"catch\(\s*\(\)\s*=>\s*(undefined|null|\{\s*\})\s*\)"]
        for p in (SPEC, LIB):
            text = code(p)
            for rx in bad:
                self.assertIsNone(re.search(rx, text), f"{p.name} に逃げ道 {rx}")
        bodies = re.split(r'^test\(', code(SPEC), flags=re.M)[1:]
        for b in bodies:
            self.assertGreaterEqual(len(re.findall(r"\bexpect\b", b)), 8, "どの試験も確かめを 8 か所以上持つ")

    def test_K999_FM_004_no_db_no_env(self) -> None:
        for p in (SPEC, LIB):
            text = code(p)
            for rx in [r"\bpg\b", r"DATABASE", r"admin\(", r"postgres(ql)?://", r"process\.env", r"\benv\["]:
                self.assertIsNone(re.search(rx, text), f"{p.name} が DB か環境の値を読む（{rx}）。読むのは site.ts・resend.ts だけ")

    def test_K999_FM_005_no_leak(self) -> None:
        for p in (SPEC, LIB):
            text = code(p)
            for rx in [r"console\.", r"\.screenshot\(", r"tracing", r"attach\(", r"vercel\.app", r"supabase\.co",
                       r"https?://", r"toHaveURL", r"waitForURL", r"[\w.+-]+@[\w-]+\.[\w.]+"]:
                self.assertIsNone(re.search(rx, text), f"{p.name} に記録に出る道 {rx}")
            self.assertNotRegex(text, r"password\s*[:=]\s*\"", f"{p.name} の中でパスワードを作らない（person で作る）")

    def test_K999_FM_006_timeout(self) -> None:
        bodies = re.split(r'^test\(', code(SPEC), flags=re.M)[1:]
        self.assertEqual(len(bodies), len(WITH_TEST))
        for b in bodies:
            ms = re.findall(r"test\.setTimeout\((\d[\d_]*)\)", b)
            self.assertEqual(len(ms), 1, "どの試験も test.setTimeout を 1 つ持つ")
            self.assertLessEqual(int(ms[0].replace("_", "")), MAX_TEST_MS, "1 本は 8 分まで")

    def test_K999_FM_007_g65(self) -> None:
        lines = [ln for ln in read(G65).splitlines() if ln.strip()]
        self.assertEqual(lines, ["python3 scripts/ci/k999_staging_spec_test.py"])

    def test_K999_FM_008_names_and_paths(self) -> None:
        lib = read(LIB)
        for name in ["困ったとき・お知らせ", "問い合わせる", "何について", "うまく動かない", "題", "内容", "送る", "返事を書く",
                     "解決したので済みにする"]:
            self.assertIn(f'"{name}"', lib, f"道具に画面の名前「{name}」が在る")
        for path in ['"/notices"', '"/inquiry"', '"/billing"', '"/settings/company"', r"inquiries\/[^/]+\/messages", r"inquiries\/[^/]+\/resolve"]:
            self.assertIn(path, lib, f"道具に道 {path} が在る")
        spec = read(SPEC)
        for path in ['"/service-status"', '"/notices"', '"/inquiries"', '"/workspace/billing"', '"/workspace/plans"']:
            self.assertIn(path, spec, f"試験が口 {path} を読み直す")


if __name__ == "__main__":
    unittest.main()
