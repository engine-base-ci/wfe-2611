#!/usr/bin/env python3
"""K-456 の形の試験：段 5 の統合テスト（apps/e2e/staging/k456-f4.spec.ts）と道具（_lib/f4-steps.ts・_lib/auth-steps.ts）の置き場・名前・行 ID・
逃げ道が無いこと・DB と環境の値を読まないこと・記録に出す物が無いこと・画面の名前が正本どおりであること。行 ID は K456-FM-NNN。
staging にはつながない（試験の本体が流れるのは、main から手で起こす staging-e2e.yml の回だけ）。チケットの CI（G65）で流れる"""
from __future__ import annotations

import pathlib
import re
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
STAGING = ROOT / "apps" / "e2e" / "staging"
LIB = STAGING / "_lib"
SPEC = STAGING / "k456-f4.spec.ts"
STEPS = LIB / "f4-steps.ts"
AUTH = LIB / "auth-steps.ts"
TICKET = ROOT / "11_tickets" / "K-456.md"
G65 = ROOT / "scripts" / "ci" / "g65.d" / "K-456.txt"
ROW = r"K456-STG-\d{2}"
WITH_TEST = ["K456-STG-01", "K456-STG-02"]       # 試験を持つ行
NO_TEST = ["K456-STG-03", "K456-STG-04"]         # staging では作れない行（理由つきで試験を持たない）
MAX_TEST_MS = 240_000                            # 設定の 1 本の上限（playwright.staging.config.ts の timeout）
FILES = (SPEC, STEPS, AUTH)


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


class F4StagingShape(unittest.TestCase):
    def test_K456_FM_001_place_and_imports(self) -> None:
        self.assertTrue(SPEC.is_file(), "統合テストの試験が置き場の直下に在る（設定の testMatch k<数>-… に当たる名前）")
        self.assertRegex(SPEC.relative_to(STAGING.parent).as_posix(), r"^staging/k\d+-[^/]+\.spec\.ts$")
        self.assertTrue(STEPS.is_file(), "段 5 の画面の 1 歩は _lib/f4-steps.ts に置く")
        self.assertTrue(AUTH.is_file(), "入り方の 1 歩は _lib/auth-steps.ts に置く")
        for p in FILES:
            for target in re.findall(r"""(?:from|import\(|require\()\s*["']([^"']+)["']""", read(p)):
                self.assertNotRegex(target, r"journeys|apps/web|\.\./\.\./web|packages/",
                                    f"{p.name}：前の通し・画面の試験の道具・製品の部品を読まない（{target}）")

    def test_K456_FM_002_row_ids(self) -> None:
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

    def test_K456_FM_003_no_way_around(self) -> None:
        banned = {
            r"\btest\.(skip|fixme|fail|only)\b|\bdescribe\.(skip|only|fixme)\b": "飛ばす・赤を見込む・1 本だけ流す",
            r"waitForTimeout\(": "固定の待ち",
            r"\.route\(|routeFromHAR|\.fulfill\(": "口の答えを網の手前で作る",
            r"\.catch\(\s*\(\s*\)\s*=>": "失敗の握りつぶし",
            r"x-forwarded-for": "送り元の付け替え",
        }
        for p in FILES:
            for pattern, why in banned.items():
                self.assertNotRegex(code(p), pattern, f"{p.name}：{why}")
        self.assertNotRegex(code(SPEC), r"(?<!test\.)\bsetTimeout\(", "試験の中で時間で待たない（test.setTimeout は別）")
        for name in titles():
            self.assertGreaterEqual(len(re.findall(r"\bexpect(?:\.poll)?\(", body_of(name))), 8,
                                    f"{name.split(' ')[0]}：確かめを持つ（空の試験で緑にしない）")

    def test_K456_FM_004_never_reads_db_or_env(self) -> None:
        for p in FILES:
            text = code(p)
            self.assertNotRegex(text, r"""from\s+["']pg["']|\bDATABASE|\badmin\(|\bnew\s+Client\(|postgres(ql)?://""",
                                f"{p.name}：DB につながない（確かめは画面・口の読み直し・Resend の記録だけ）")
            self.assertNotRegex(text, r"process\.env|\benv\[", f"{p.name}：環境の値を読まない（読むのは site.ts・resend.ts だけ）")

    def test_K456_FM_005_nothing_secret_in_records(self) -> None:
        for p in FILES:
            text = code(p)
            self.assertNotRegex(text, r"\bconsole\.\w+\(|\.attach\(|\.screenshot\(|tracing\.", f"{p.name}：標準出力・写し・添え物を残さない")
            self.assertNotRegex(text, r"vercel\.app|supabase\.co|https://[a-z0-9.-]+\.[a-z]{2,}", f"{p.name}：住所を書かない")
            self.assertNotRegex(text, r"toHaveURL\(|waitForURL\(", f"{p.name}：住所そのものを比べない（道を比べる）")
            domains = set(re.findall(r"@([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b", text))
            self.assertEqual(domains, set(), f"{p.name}：宛先を書かない（宛先は steps.ts の person だけが作る）")
        self.assertIn("person(", code(SPEC), "人は steps.ts の person で作る（宛先は Resend の試験用・パスワードは伏せる形）")
        self.assertNotRegex(code(SPEC), r"password\s*:", "試験の中でパスワードを作らない")

    def test_K456_FM_006_time_limits(self) -> None:
        for name in titles():
            limits = [int(x.replace("_", "")) for x in re.findall(r"test\.setTimeout\(([\d_]+)\)", body_of(name))]
            self.assertEqual(len(limits), 1, f"{name.split(' ')[0]}：上限を 1 つ持つ")
            self.assertLessEqual(limits[0], MAX_TEST_MS, f"{name.split(' ')[0]}：1 本の上限は設定の 4 分まで")

    def test_K456_FM_007_runs_in_g65(self) -> None:
        self.assertTrue(G65.is_file(), "G65 の置き場（g65.d/K-456.txt）に命令が在る")
        lines = [ln.strip() for ln in read(G65).splitlines() if ln.strip()]
        self.assertEqual(lines, ["python3 scripts/ci/k456_staging_spec_test.py"], "1 行 1 命令・この形の試験だけ")

    def test_K456_FM_008_totp_matches_rfc6238(self) -> None:
        # RFC 6238 の付録 B の見本（鍵 "12345678901234567890"・SHA-1・59 秒 → 287082）を、道具の totpOf と同じ式で照らす
        text = code(AUTH)
        self.assertRegex(text, r'createHmac\("sha1"', "SHA-1")
        self.assertRegex(text, r"Math\.floor\(at / 30_000\)", "30 秒ごと")
        self.assertRegex(text, r"% 1_000_000", "6 けた")
        script = (
            "import('node:crypto').then(({createHmac}) => {"
            " const key = Buffer.from('12345678901234567890'); const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(59000 / 30000)));"
            " const mac = createHmac('sha1', key).update(c).digest(); const off = mac[mac.length - 1] & 15;"
            " process.stdout.write(String((mac.readUInt32BE(off) & 0x7fffffff) % 1000000).padStart(6, '0')); })"
        )
        out = subprocess.run(["node", "--input-type=module", "-e", script], text=True, capture_output=True, cwd=ROOT,
                             check=True).stdout
        self.assertEqual(out, "287082", "道具と同じ式が RFC の見本の値を出す")

    def test_K456_FM_009_screen_names_match_the_screens(self) -> None:
        # 画面の名前は K-442〜K-452 の md と、その画面の試験から。道具の中の名前が書き換わって黙って別の物を押さないよう、決め手の名前を照らす
        text = read(STEPS)
        for name in ["複製して開く", "親にする", "親チケットを決める", "つながりを足す", "つなぐ", "版と差分", "本文を直す", "書き終える",
                     "＋ 確認項目を足す", "確認項目を足す", "完了にする", "子チケット・つながり", "番号か題名で探す", "チケットを探す"]:
            self.assertIn(name, text, f"f4-steps.ts：画面の名前「{name}」を押す・探す 1 歩がある")
        for pattern in [r"本文を版 \$\{n\} に戻す", r"\.k-f4d-pair", r"\.k-f4d-name"]:
            self.assertRegex(text, pattern, f"f4-steps.ts：版・項目の表の名前の組み立て {pattern}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
