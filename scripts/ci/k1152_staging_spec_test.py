#!/usr/bin/env python3
"""K-1152 の形の試験：段 7 の統合テスト（apps/e2e/staging/k1152-own-ticket-talk.spec.ts）と道具（_lib/enter-steps.ts）の置き場・名前・行 ID・
逃げ道が無いこと・DB と環境の値を読まないこと・認証アプリの 6 けたが RFC 6238 の式であること・口で直に段を変えるのは承認待ちの間の 1 回だけであること。行 ID は K1152-FM-NNN。
staging にはつながない（試験の本体が流れるのは、main から手で起こす staging-e2e.yml の回だけ）。チケットの CI（G65）で流れる"""
from __future__ import annotations

import pathlib
import re
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
STAGING = ROOT / "apps" / "e2e" / "staging"
LIB = STAGING / "_lib"
SPEC = STAGING / "k1152-own-ticket-talk.spec.ts"
STEPS = LIB / "enter-steps.ts"
TICKET = ROOT / "11_tickets" / "K-1152.md"
G65 = ROOT / "scripts" / "ci" / "g65.d" / "K-1152.txt"
ROW = r"K1152-STG-\d{2}"
WITH_TEST = ["K1152-STG-01", "K1152-STG-02", "K1152-STG-03"]   # 試験を持つ行
NO_TEST = ["K1152-STG-04", "K1152-STG-05"]                     # staging では作れない行（理由つきで試験を持たない）
MAX_TEST_MS = 480_000                                          # 1 本の上限（K-65 と同じ 8 分）


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


class OwnTicketStagingShape(unittest.TestCase):
    def test_K1152_FM_001_place_and_imports(self) -> None:
        self.assertTrue(SPEC.is_file(), "統合テストの試験が置き場の直下に在る（設定の testMatch k<数>-… に当たる名前）")
        self.assertRegex(SPEC.relative_to(STAGING.parent).as_posix(), r"^staging/k\d+-[^/]+\.spec\.ts$")
        self.assertTrue(STEPS.is_file(), "入る 1 歩は _lib/enter-steps.ts（持ち主は K-1151。この葉は運ばず、本線に入った物を読む）")
        used = re.search(r'import \{([^}]*)\} from "\./_lib/enter-steps";', read(SPEC))
        self.assertIsNotNone(used, "試験は入る 1 歩の道具を読む")
        for fn in [x.strip() for x in used.group(1).split(",") if x.strip()]:
            self.assertRegex(read(STEPS), rf"(?m)^export (async function|const) {fn}\b", f"道具に {fn} が在る（K-1151 の版）")
        for p in (SPEC, STEPS):
            for target in re.findall(r"""(?:from|import\(|require\()\s*["']([^"']+)["']""", read(p)):
                self.assertNotRegex(target, r"journeys|apps/web|\.\./\.\./web|packages/",
                                    f"{p.name}：前の通し・画面の試験の道具・製品の部品を読まない（{target}）")

    def test_K1152_FM_002_row_ids(self) -> None:
        ids = [n.split(" ")[0] for n in titles()]
        self.assertEqual(ids, WITH_TEST, "試験の名前の頭は行 ID。01〜03 が 1 本ずつ、この順")
        self.assertEqual(len(re.findall(r"^test\(", read(SPEC), flags=re.M)), len(WITH_TEST), "名前を読めなかった試験が無い")
        self.assertNotRegex(read(SPEC), r"^\s*(test\.describe|describe)\(", "入れ子にしない（名前の頭が行 ID のまま記録に出る）")
        doc = read(TICKET)
        rows = re.findall(rf"^\| ({ROW}) \|", doc, flags=re.M)
        self.assertEqual(sorted(set(rows)), sorted(WITH_TEST + NO_TEST), "チケットの行の表と、試験を持つ行・持たない行が合う")
        skip = re.search(r"```judge-skip\n(.*?)```", doc, flags=re.S)
        self.assertIsNotNone(skip, "チケットに、チケットの CI で判定しない行の訳（judge-skip）が在る")
        skipped = re.findall(rf"^- ({ROW}): \S", skip.group(1), flags=re.M)
        self.assertEqual(sorted(skipped), sorted(WITH_TEST + NO_TEST), "staging の回で決める行は、どれも訳つきで judge-skip に在る")
        for row in NO_TEST:
            why = re.search(rf"^- {row}: (.*)$", skip.group(1), flags=re.M).group(1)
            self.assertRegex(why, r"K\d+-[A-Z0-9]+-\d+", f"{row}：試験を持たない行は、受け持ちの行 ID を名指しする")

    def test_K1152_FM_003_no_way_around(self) -> None:
        banned = {
            r"\btest\.(skip|fixme|fail|only)\b|\bdescribe\.(skip|only|fixme)\b": "飛ばす・赤を見込む・1 本だけ流す",
            r"waitForTimeout\(": "固定の待ち",
            r"\.route\(|routeFromHAR|\.fulfill\(": "口の答えを網の手前で作る",
            r"\.catch\(|\bcatch\s*(\(\s*\w*\s*\))?\s*\{": "失敗の握りつぶし（.catch・catch {}）",
            r"x-forwarded-for": "送り元の付け替え",
        }
        for p in (SPEC, STEPS):
            for pattern, why in banned.items():
                self.assertNotRegex(code(p), pattern, f"{p.name}：{why}")
        for p in (SPEC, STEPS):
            self.assertNotRegex(code(p), r"(?<!test\.)\bsetTimeout\(", f"{p.name}：時間で待たない（test.setTimeout は別）")
        self.assertNotRegex(code(SPEC), r"page\.evaluate\(|\bfetch\(",
                            "試験の本体で口を直に呼ばない（直に呼ぶのは道具の sendAs・patchAs と steps.ts の readAs だけ）")
        for name in titles():
            self.assertGreaterEqual(len(re.findall(r"\bexpect(?:\.poll)?\(", body_of(name))), 8,
                                    f"{name.split(' ')[0]}：確かめを持つ（空の試験で緑にしない）")

    def test_K1152_FM_004_never_reads_db_or_env(self) -> None:
        for p in (SPEC, STEPS):
            text = code(p)
            self.assertNotRegex(text, r"""from\s+["']pg["']|\bDATABASE|\badmin\(|\bnew\s+Client\(|postgres(ql)?://""",
                                f"{p.name}：DB につながない（確かめは画面・口の読み直しだけ）")
            self.assertNotRegex(text, r"process\.env|\benv\[", f"{p.name}：環境の値を読まない（読むのは site.ts・resend.ts だけ）")

    def test_K1152_FM_005_nothing_secret_in_records(self) -> None:
        for p in (SPEC, STEPS):
            text = code(p)
            self.assertNotRegex(text, r"\bconsole\.\w+\(|\.attach\(|\.screenshot\(|tracing\.", f"{p.name}：標準出力・写し・添え物を残さない")
            self.assertNotRegex(text, r"vercel\.app|supabase\.co|https://[a-z0-9.-]+\.[a-z]{2,}", f"{p.name}：住所を書かない")
            self.assertNotRegex(text, r"toHaveURL\(|waitForURL\(", f"{p.name}：住所そのものを比べない（道を比べる）")
            domains = set(re.findall(r"@([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b", text))
            self.assertEqual(domains, set(), f"{p.name}：宛先を書かない（宛先は steps.ts の person だけが作る）")
        spec = code(SPEC)
        self.assertIn("person(", spec, "人は steps.ts の person で作る（宛先は Resend の試験用・パスワードは伏せる形）")
        self.assertNotRegex(spec, r"password\s*:", "試験の中でパスワードを作らない")

    def test_K1152_FM_006_direct_stage_change_only_while_locked(self) -> None:
        # 画面が押させない操作（段を口で直に変える）は、承認待ちの間に断られることを見る 1 回だけ。ほかの段の変更は画面の札とメニューで通す
        spec = code(SPEC)
        calls = re.findall(r"patchAs\(page, `/tickets/\$\{t\}`", spec)
        self.assertEqual(len(calls), 1, "段を口で直に変えるのは 1 回だけ")
        second = body_of(titles()[1])
        self.assertLess(second.index("MSG.waitingMe"), second.index("patchAs("), "承認待ちの帯が出てから送る")
        self.assertRegex(second, r"expect\(r\.status[^\n]*\)\.toBe\(409\)", "断られた番号は 409")
        self.assertIn("startLoop(", second, "F5 とまたぐ筋は本物の PC の輪を回す")
        self.assertNotIn("startLoop(", body_of(titles()[0]), "1 本目は PC を使わない")

    def test_K1152_FM_007_time_limits(self) -> None:
        for name in titles():
            limits = [int(x.replace("_", "")) for x in re.findall(r"test\.setTimeout\(([\d_]+)\)", body_of(name))]
            self.assertEqual(len(limits), 1, f"{name.split(' ')[0]}：上限を 1 つ持つ")
            self.assertLessEqual(limits[0], MAX_TEST_MS, f"{name.split(' ')[0]}：1 本の上限は 8 分まで")

    def test_K1152_FM_008_runs_in_g65(self) -> None:
        self.assertTrue(G65.is_file(), "G65 の置き場（g65.d/K-1152.txt）に命令が在る")
        lines = [ln.strip() for ln in read(G65).splitlines() if ln.strip()]
        self.assertEqual(lines, ["python3 scripts/ci/k1152_staging_spec_test.py"], "1 行 1 命令・この形の試験だけ")

    def test_K1152_FM_009_totp_matches_rfc6238(self) -> None:
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

    def test_K1152_FM_010_step_s1_failure_goes_red(self) -> None:
        # 手順 S1（staging に作る）が途中で失敗しても、待ちに上限があり、赤で止まる（緑と言わない）
        spec = code(SPEC)
        for limit in ("firstView", "toApproval"):
            self.assertRegex(spec, rf"timeout:\s*LIMIT\.{limit}\b", f"待ち（LIMIT.{limit}）が試験の timeout に渡る")
        self.assertRegex(spec, r"toApproval:\s*120_000", "承認待ちの帯は 120 秒まで")
        self.assertRegex(spec, r"firstView:\s*30_000", "PC の輪の最初の合図は 30 秒まで")
        self.assertRegex(code(STEPS), r"timeout:\s*90_000", "確認のメールが Resend の記録に出るのを待つのは 90 秒まで")
        self.assertRegex(body_of(titles()[0]), r"signUpAndEnter\(page, me\)\)\.status[^\n]*\.toBe\(201\)", "1 本目：登録の口が 201")
        self.assertRegex(body_of(titles()[2]), r"signUpAndEnter\(page, other\)\)\.status[^\n]*\.toBe\(201\)", "3 本目：登録の口が 201")
        self.assertRegex(spec, r'test\.describe\.configure\(\{ mode: "serial" \}\)', "1 本目が赤なら後ろは流れない（skip＝通ったと数えない）")
        for name in titles()[1:]:
            self.assertRegex(body_of(name), r"expect\(\s*held\.[^;]*?!== null[^;]*?\)\s*\.toBe\(true\)",
                             f"{name.split(' ')[0]}：1 本目が渡す物が無ければ先頭で赤（serial を外したときの備え）")

    def test_K1152_FM_011_no_cleanup_of_staging_things(self) -> None:
        # 手順 S1 の後片付けの失敗の形が無い：afterAll は PC の窓とブラウザの窓を閉じるだけ。staging の物は消さない（残す）
        spec = code(SPEC)
        hook = re.search(r"test\.afterAll\(async \(\) => \{(.*?)\n\}\);", spec, flags=re.S)
        self.assertIsNotNone(hook, "afterAll が在る（PC とブラウザの窓を閉じる）")
        calls = sorted(re.findall(r"\b(\w+(?:\.\w+)*)\(", hook.group(1)))
        self.assertEqual(calls, ["Promise.all", "c.close", "contexts.splice", "map", "pc.close", "pcs.splice"],
                         "afterAll が呼ぶのは窓を閉じる分だけ")
        for p in (SPEC, STEPS):
            text = code(p)
            self.assertNotRegex(text, r"""["']DELETE["']|\.delete\(|\.remove\(|\.destroy\(""",
                                f"{p.name}：staging の物を口で直に消す・外す呼び出しを持たない")


if __name__ == "__main__":
    unittest.main(verbosity=2)
