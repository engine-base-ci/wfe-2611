#!/usr/bin/env python3
"""K-773 の形の試験：段 6 の統合テスト（apps/e2e/staging/k773-f5.spec.ts）と道具（_lib/f5-steps.ts）の置き場・名前・行 ID・
逃げ道が無いこと・DB と環境の値を読まないこと・認証アプリの 6 けたが RFC 6238 の式であること。行 ID は K773-FM-NNN。
staging にはつながない（試験の本体が流れるのは、main から手で起こす staging-e2e.yml の回だけ）。チケットの CI（G65）で流れる"""
from __future__ import annotations

import pathlib
import re
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
STAGING = ROOT / "apps" / "e2e" / "staging"
LIB = STAGING / "_lib"
SPEC = STAGING / "k773-f5.spec.ts"
STEPS = LIB / "f5-steps.ts"
TICKET = ROOT / "11_tickets" / "K-773.md"
G65 = ROOT / "scripts" / "ci" / "g65.d" / "K-773.txt"
ROW = r"K773-STG-\d{2}"
WITH_TEST = ["K773-STG-01", "K773-STG-03"]  # 試験を持つ行
NO_TEST = ["K773-STG-02", "K773-STG-04", "K773-STG-05"]                  # staging では作れない行（理由つきで試験を持たない）
MAX_TEST_MS = 480_000                                      # 1 本の上限（K-65 と同じ 8 分。設定の既定 4 分は test.setTimeout で延ばす）


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


class F5StagingShape(unittest.TestCase):
    def test_K773_FM_001_place_and_imports(self) -> None:
        self.assertTrue(SPEC.is_file(), "統合テストの試験が置き場の直下に在る（設定の testMatch k<数>-… に当たる名前）")
        self.assertRegex(SPEC.relative_to(STAGING.parent).as_posix(), r"^staging/k\d+-[^/]+\.spec\.ts$")
        self.assertTrue(STEPS.is_file(), "段 6 の画面の 1 歩は _lib/f5-steps.ts に置く")
        for p in (SPEC, STEPS):
            for target in re.findall(r"""(?:from|import\(|require\()\s*["']([^"']+)["']""", read(p)):
                self.assertNotRegex(target, r"journeys|apps/web|\.\./\.\./web|packages/",
                                    f"{p.name}：前の通し・画面の試験の道具・製品の部品を読まない（{target}）")

    def test_K773_FM_002_row_ids(self) -> None:
        ids = [n.split(" ")[0] for n in titles()]
        self.assertEqual(ids, WITH_TEST, "試験の名前の頭は行 ID。01・03 が 1 本ずつ、この順")
        self.assertEqual(len(re.findall(r"^test\(", read(SPEC), flags=re.M)), len(WITH_TEST), "名前を読めなかった試験が無い")
        self.assertNotRegex(read(SPEC), r"^\s*(test\.describe|describe)\(", "入れ子にしない（名前の頭が行 ID のまま記録に出る）")
        doc = read(TICKET)
        rows = re.findall(rf"^\| ({ROW}) \|", doc, flags=re.M)
        self.assertEqual(sorted(set(rows)), sorted(WITH_TEST + NO_TEST), "チケットの行の表と、試験を持つ行・持たない行が合う")
        skip = re.search(r"```judge-skip\n(.*?)```", doc, flags=re.S)
        self.assertIsNotNone(skip, "チケットに、チケットの CI で判定しない行の訳（judge-skip）が在る")
        skipped = re.findall(rf"^- ({ROW}): \S", skip.group(1), flags=re.M)
        self.assertEqual(sorted(skipped), sorted(WITH_TEST + NO_TEST), "staging の回で決める行は、どれも訳つきで judge-skip に在る")

    def test_K773_FM_003_no_way_around(self) -> None:
        banned = {
            r"\btest\.(skip|fixme|fail|only)\b|\bdescribe\.(skip|only|fixme)\b": "飛ばす・赤を見込む・1 本だけ流す",
            r"waitForTimeout\(": "固定の待ち",
            r"\.route\(|routeFromHAR|\.fulfill\(": "口の答えを網の手前で作る",
            r"\.catch\(|\bcatch\s*(\(\s*\w*\s*\))?\s*\{": "失敗の握りつぶし（.catch・catch {}）",
            r"page\.evaluate\(|\bfetch\(|method:\s*[\"']POST": "口を直に叩いて画面の操作を飛ばす（読み直しは steps.ts の readAs の GET だけ）",
            r"x-forwarded-for": "送り元の付け替え",
        }
        for p in (SPEC, STEPS):
            for pattern, why in banned.items():
                self.assertNotRegex(code(p), pattern, f"{p.name}：{why}")
        for p in (SPEC, STEPS):
            self.assertNotRegex(code(p), r"(?<!test\.)\bsetTimeout\(", f"{p.name}：時間で待たない（test.setTimeout は別）")
        for name in titles():
            self.assertGreaterEqual(len(re.findall(r"\bexpect(?:\.poll)?\(", body_of(name))), 6,
                                    f"{name.split(' ')[0]}：確かめを持つ（空の試験で緑にしない）")

    def test_K773_FM_004_never_reads_db_or_env(self) -> None:
        for p in (SPEC, STEPS):
            text = code(p)
            self.assertNotRegex(text, r"""from\s+["']pg["']|\bDATABASE|\badmin\(|\bnew\s+Client\(|postgres(ql)?://""",
                                f"{p.name}：DB につながない（確かめは画面・口の読み直し・Resend の記録だけ）")
            self.assertNotRegex(text, r"process\.env|\benv\[", f"{p.name}：環境の値を読まない（読むのは site.ts・resend.ts だけ）")

    def test_K773_FM_005_nothing_secret_in_records(self) -> None:
        for p in (SPEC, STEPS):
            text = code(p)
            self.assertNotRegex(text, r"\bconsole\.\w+\(|\.attach\(|\.screenshot\(|tracing\.", f"{p.name}：標準出力・写し・添え物を残さない")
            self.assertNotRegex(text, r"vercel\.app|supabase\.co|https://[a-z0-9.-]+\.[a-z]{2,}", f"{p.name}：住所を書かない")
            self.assertNotRegex(text, r"toHaveURL\(|waitForURL\(", f"{p.name}：住所そのものを比べない（道を比べる）")
            domains = set(re.findall(r"@([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b", text))
            self.assertEqual(domains, set(), f"{p.name}：宛先を書かない（宛先は steps.ts の person だけが作る）")
        self.assertIn("person(", code(SPEC), "人は steps.ts の person で作る（宛先は Resend の試験用・パスワードは伏せる形）")
        self.assertNotRegex(code(SPEC), r"password\s*:", "試験の中でパスワードを作らない")

    def test_K773_FM_006_time_limits(self) -> None:
        for name in titles():
            limits = [int(x.replace("_", "")) for x in re.findall(r"test\.setTimeout\(([\d_]+)\)", body_of(name))]
            self.assertEqual(len(limits), 1, f"{name.split(' ')[0]}：上限を 1 つ持つ")
            self.assertLessEqual(limits[0], MAX_TEST_MS, f"{name.split(' ')[0]}：1 本の上限は 8 分まで")

    def test_K773_FM_007_runs_in_g65(self) -> None:
        self.assertTrue(G65.is_file(), "G65 の置き場（g65.d/K-773.txt）に命令が在る")
        lines = [ln.strip() for ln in read(G65).splitlines() if ln.strip()]
        self.assertEqual(lines, ["python3 scripts/ci/k773_staging_spec_test.py"], "1 行 1 命令・この形の試験だけ")

    def test_K773_FM_008_totp_matches_rfc6238(self) -> None:
        # RFC 6238 の付録 B の見本（鍵 "12345678901234567890"・SHA-1・59 秒 → 287082）を、道具の totpOf と同じ式で照らす
        text = code(STEPS)
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

    def test_K773_FM_009_step_s1_failure_goes_red(self) -> None:
        # 手順 S1（staging に作る）が途中で失敗しても、待ちに上限があり、赤で止まる（緑と言わない）
        spec = code(SPEC)
        for limit in ("firstView", "toApproval", "toExecuted", "talkReply"):
            self.assertRegex(spec, rf"timeout:\s*LIMIT\.{limit}\b", f"待ち（LIMIT.{limit}）が試験の timeout に渡る")
        self.assertRegex(spec, r"firstView:\s*30_000", "PC の輪の最初の合図は 30 秒まで")
        self.assertRegex(spec, r"toApproval:\s*120_000", "承認待ちの帯は 120 秒まで")
        self.assertRegex(spec, r"toExecuted:\s*120_000", "実行が終わるまでは 120 秒まで")
        self.assertRegex(spec, r"talkReply:\s*120_000", "偽の AI の返事は 120 秒まで")
        self.assertRegex(code(STEPS), r"timeout:\s*90_000", "確認のメールが Resend の記録に出るのを待つのは 90 秒まで")
        self.assertRegex(body_of(titles()[0]), r"expect\(await signUpAndEnter\([^)]*\)[^)]*\)\.toBe\(201\)",
                         "1 本目は登録の口が 201 を返すことを確かめる")
        for name in titles()[1:]:
            self.assertRegex(body_of(name), r"expect\(shared\.ready[^\n]*\.toBe\(true\)",
                             f"{name.split(' ')[0]}：1 本目が先に通っていなければ先頭で赤")
        self.assertRegex(body_of(titles()[0]), r"shared\.ready = true;\s*\}\);\s*$", "1 本目は最後まで通ったときだけ ready にする")

    def test_K773_FM_011_k65_check_none_text(self) -> None:
        # 確認の字は K-739 の後「検査なし」になる。K-65 の通しが本物の staging に期待する字を、この葉が替える（K-739 の申し送り）
        k65 = code(STAGING / "k65-walking-skeleton.spec.ts")
        self.assertRegex(k65, r'checkNone:\s*"検査なし",', "K-65 の checkNone は「検査なし」")
        self.assertNotIn("まだ流していません", k65, "古い字「（まだ流していません）」が残らない")

    def test_K773_FM_010_no_cleanup_of_staging_things(self) -> None:
        # 片付ける口が無い（F10・F12 ができてから）ので、試験は作った物を片付けない。afterAll は PC の輪と窓を閉じるだけ
        spec = code(SPEC)
        hook = re.search(r"test\.afterAll\(async \(\) => \{(.*?)\n\}\);", spec, flags=re.S)
        self.assertIsNotNone(hook, "afterAll が在る（PC の輪とブラウザの窓を閉じる）")
        body = hook.group(1)
        calls = sorted(re.findall(r"shared\.(\w+)\?\.close\(\)", body))
        self.assertEqual(calls, ["ctx", "pc"], "afterAll が呼ぶのは輪と窓を閉じる分だけ")
        self.assertEqual(len(re.findall(r"\w+\(", body)), 2, "ほかの呼び出しを持たない")
        for p in (SPEC, STEPS):
            self.assertNotRegex(code(p), r"""["']DELETE["']|\.delete\(|\.remove\(|\.destroy\(""",
                                f"{p.name}：staging の物を消す・外す呼び出しを持たない（止めるは画面の［止める］だけ）")


if __name__ == "__main__":
    unittest.main(verbosity=2)
