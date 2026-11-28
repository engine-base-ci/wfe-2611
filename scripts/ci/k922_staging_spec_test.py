#!/usr/bin/env python3
"""K-922 の形の試験：段 12 の統合テスト（apps/e2e/staging/k922-guest.spec.ts）と道具（_lib/guest-steps.ts）の置き場・名前・行 ID・
逃げ道が無いこと・DB と環境の値を読まないこと・招待のリンクを記録に出さないこと・G65 から流れること。行 ID は K922-FM-NNN。
staging にはつながない（試験の本体が流れるのは、main から手で起こす staging-e2e.yml の回だけ）。チケットの CI（G65）で流れる。
形は K-418 の scripts/ci/k418_staging_spec_test.py と同じ（段 9 の統合テストの形の試験）"""
from __future__ import annotations

import pathlib
import re
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
STAGING = ROOT / "apps" / "e2e" / "staging"
LIB = STAGING / "_lib"
SPEC = STAGING / "k922-guest.spec.ts"
STEPS = LIB / "guest-steps.ts"
TICKET = ROOT / "11_tickets" / "K-922.md"
G65 = ROOT / "scripts" / "ci" / "g65.d" / "K-922.txt"
ROW = r"K922-STG-\d{2}"
WITH_TEST = ["K922-STG-01", "K922-STG-02"]       # 試験を持つ行
NO_TEST = ["K922-STG-03", "K922-STG-04"]         # staging では作れない行（理由つきで試験を持たない）
MAX_TEST_MS = 240_000                            # 設定の 1 本の上限（playwright.staging.config.ts の timeout）


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


def code(path: pathlib.Path) -> str:
    """注釈（// の行と行末の // …・/* … */）を除いた中身。注釈に書いた説明の字で赤にしない"""
    text = re.sub(r"/\*.*?\*/", "", read(path), flags=re.S)
    return "\n".join(re.sub(r"(^|\s)//.*$", "", ln) for ln in text.splitlines())


def titles() -> list[str]:
    return re.findall(r'^test\(\s*"([^"]+)"', read(SPEC), flags=re.M)


def body_of(name: str) -> str:
    return read(SPEC).split(f'test("{name}"', 1)[1].split("\ntest(", 1)[0]


class GuestStagingShape(unittest.TestCase):
    def test_K922_FM_001_place_and_imports(self) -> None:
        self.assertTrue(SPEC.is_file(), "統合テストの試験が置き場の直下に在る（設定の testMatch k<数>-… に当たる名前）")
        self.assertRegex(SPEC.relative_to(STAGING.parent).as_posix(), r"^staging/k\d+-[^/]+\.spec\.ts$")
        self.assertTrue(STEPS.is_file(), "段 12 の画面の 1 歩は _lib/guest-steps.ts に置く")
        for p in (SPEC, STEPS):
            for target in re.findall(r"""(?:from|import\(|require\()\s*["']([^"']+)["']""", read(p)):
                self.assertNotRegex(target, r"journeys|apps/web|\.\./\.\./web|packages/",
                                    f"{p.name}：前の通し・画面の試験の道具・製品の部品を読まない（{target}）")

    def test_K922_FM_002_row_ids(self) -> None:
        ids = [n.split(" ")[0] for n in titles()]
        self.assertEqual(ids, WITH_TEST, "試験の名前の頭は行 ID。01・02 が 1 本ずつ、この順")
        self.assertEqual(len(re.findall(r"^test\(", read(SPEC), flags=re.M)), len(WITH_TEST), "名前を読めなかった試験が無い")
        self.assertNotRegex(read(SPEC), r"^\s*(test\.describe|describe)\(", "入れ子にしない（名前の頭が行 ID のまま記録に出る）")
        doc = read(TICKET)
        rows = re.findall(rf"^\| ({ROW}) \|", doc, flags=re.M)
        self.assertEqual(sorted(set(rows)), sorted(WITH_TEST + NO_TEST), "チケットの行の表と、試験を持つ行・持たない行が合う")
        skip = re.search(r"```judge-skip\n(.*?)```", doc, flags=re.S)
        self.assertIsNotNone(skip, "チケットに、チケットの CI で判定しない行の訳（judge-skip）が在る")
        skipped = re.findall(rf"^- ({ROW}): \S", skip.group(1), flags=re.M)
        self.assertEqual(sorted(skipped), sorted(WITH_TEST + NO_TEST), "staging の回で決める行は、どれも訳つきで judge-skip に在る")

    def test_K922_FM_003_no_way_around(self) -> None:
        banned = {
            r"\btest\.(skip|fixme|fail|only)\b|\bdescribe\.(skip|only|fixme)\b": "飛ばす・赤を見込む・1 本だけ流す",
            r"waitForTimeout\(": "固定の待ち",
            r"\.route\(|routeFromHAR|\.fulfill\(": "口の答えを網の手前で作る",
            r"\.catch\(\s*\(\s*\)\s*=>": "失敗の握りつぶし",
            r"x-forwarded-for": "送り元の付け替え",
        }
        for p in (SPEC, STEPS):
            for pattern, why in banned.items():
                self.assertNotRegex(code(p), pattern, f"{p.name}：{why}")
        self.assertNotRegex(code(SPEC), r"(?<!test\.)\bsetTimeout\(", "試験の中で時間で待たない（test.setTimeout は別）")
        for name in titles():
            self.assertGreaterEqual(len(re.findall(r"\bexpect(?:\.poll)?\(", body_of(name))), 8,
                                    f"{name.split(' ')[0]}：確かめを持つ（空の試験で緑にしない）")

    def test_K922_FM_004_never_reads_db_or_env(self) -> None:
        for p in (SPEC, STEPS):
            text = code(p)
            self.assertNotRegex(text, r"""from\s+["']pg["']|\bDATABASE|\badmin\(|\bnew\s+Client\(|postgres(ql)?://""",
                                f"{p.name}：DB につながない（確かめは画面・口の読み直し・Resend の記録だけ）")
            self.assertNotRegex(text, r"process\.env|\benv\[", f"{p.name}：環境の値を読まない（読むのは site.ts・resend.ts だけ）")

    def test_K922_FM_005_nothing_secret_in_records(self) -> None:
        for p in (SPEC, STEPS):
            text = code(p)
            self.assertNotRegex(text, r"\bconsole\.\w+\(|\.attach\(|\.screenshot\(|tracing\.", f"{p.name}：標準出力・写し・添え物を残さない")
            self.assertNotRegex(text, r"vercel\.app|supabase\.co|https://[a-z0-9.-]+\.[a-z]{2,}", f"{p.name}：住所を書かない")
            self.assertNotRegex(text, r"toHaveURL\(|waitForURL\(", f"{p.name}：住所そのものを比べない（道を比べる）")
            domains = set(re.findall(r"@([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b", text))
            self.assertEqual(domains, set(), f"{p.name}：宛先を書かない（宛先は steps.ts の person だけが作る）")
        self.assertIn("person(", code(SPEC), "人は steps.ts の person で作る（宛先は Resend の試験用・パスワードは伏せる形）")
        self.assertNotRegex(code(SPEC), r"password\s*:", "試験の中でパスワードを作らない")

    def test_K922_FM_006_invite_link_is_hidden(self) -> None:
        planted = ("K922-STG-01 招く: Error: page.goto: net::ERR_FAILED at "
                   "https://web.k922-shape.example.test/invite/AbCdEfGhIjKlMnOpQrStUvWx_123-xyz\n")
        script = ("import('./apps/e2e/staging/_lib/scrub.mjs').then(async (m) => {"
                  " let s = ''; for await (const c of process.stdin) s += c; process.stdout.write(m.scrub(s, {})); })")
        out = subprocess.run(["node", "--input-type=module", "-e", script], input=planted, text=True,
                             capture_output=True, cwd=ROOT, check=True).stdout
        self.assertNotIn("AbCdEfGhIjKlMnOpQrStUvWx_123-xyz", out, "招待のリンクの印を伏せる")
        self.assertIn("/invite/［伏せた］", out)
        self.assertIn("K922-STG-01", out, "試験の名前（行 ID）は残す")

    def test_K922_FM_007_time_limits(self) -> None:
        for name in titles():
            limits = [int(x.replace("_", "")) for x in re.findall(r"test\.setTimeout\(([\d_]+)\)", body_of(name))]
            self.assertEqual(len(limits), 1, f"{name.split(' ')[0]}：上限を 1 つ持つ")
            self.assertLessEqual(limits[0], MAX_TEST_MS, f"{name.split(' ')[0]}：1 本の上限は設定の 4 分まで")

    def test_K922_FM_008_runs_in_g65(self) -> None:
        self.assertTrue(G65.is_file(), "G65 の置き場（g65.d/K-922.txt）に命令が在る")
        lines = [ln.strip() for ln in read(G65).splitlines() if ln.strip()]
        self.assertEqual(lines, ["python3 scripts/ci/k922_staging_spec_test.py"], "1 行 1 命令・この形の試験だけ")


if __name__ == "__main__":
    unittest.main(verbosity=2)
