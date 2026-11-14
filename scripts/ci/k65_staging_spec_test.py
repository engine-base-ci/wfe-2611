#!/usr/bin/env python3
"""K-65 の形の試験：staging を指す統合テスト（apps/e2e/staging）の置き場・名前・行 ID・設定・記録に秘密を出さない書き方。行 ID は K65-FM-NNN。
staging にはつながない（試験の本体が流れるのは、main から手で起こす staging-e2e.yml の回だけ）。チケットの CI（G65）で流れる"""
from __future__ import annotations

import json
import os
import pathlib
import re
import subprocess
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
E2E = ROOT / "apps" / "e2e"
STAGING = E2E / "staging"
LIB = STAGING / "_lib"
SPEC = STAGING / "k65-walking-skeleton.spec.ts"
CONFIG = E2E / "playwright.staging.config.ts"
TICKET = ROOT / "11_tickets" / "K-65.md"
FAKE = ROOT / "scripts" / "dev" / "fake-claude-demo.mjs"
ROW = r"K65-STG-\d{2}"
WITH_TEST = [f"K65-STG-0{n}" for n in range(1, 8)]      # 試験を持つ行
NO_TEST = ["K65-STG-08", "K65-STG-09"]                    # staging では作れない行（理由つきで試験を持たない）
ENV_NAMES = {"STAGING_BASE_URL", "STAGING_API_BASE", "STAGING_RESEND_READ_KEY",
             "PLAYWRIGHT_JUNIT_OUTPUT_NAME", "RUNNER_TEMP", "KANAME_CLAUDE_BIN"}
MAX_TEST_MS = 480_000


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


def code(path: pathlib.Path) -> str:
    """注釈（// の行と行末の // …・/* … */）を除いた中身。注釈に書いた説明の字で赤にしない"""
    text = re.sub(r"/\*.*?\*/", "", read(path), flags=re.S)
    return "\n".join(re.sub(r"(^|\s)//.*$", "", ln) for ln in text.splitlines())


def sources() -> list[pathlib.Path]:
    found = sorted(p for p in STAGING.rglob("*") if p.suffix in (".ts", ".mts", ".mjs"))
    return [*found, CONFIG]


def titles() -> list[str]:
    return re.findall(r'^test\(\s*"([^"]+)"', read(SPEC), flags=re.M)


def steps(name: str, job: str) -> list[dict]:
    return yaml.safe_load(read(ROOT / ".github/workflows" / name))["jobs"][job]["steps"]


class StagingSpecShape(unittest.TestCase):
    def test_K65_FM_001_place_and_names(self) -> None:
        specs = sorted(p.relative_to(E2E).as_posix() for p in STAGING.rglob("*.spec.ts"))
        self.assertIn("staging/k65-walking-skeleton.spec.ts", specs, "統合テストの試験が置き場に在る")
        for s in specs:
            self.assertRegex(s, r"^staging/k\d+-[^/]+\.spec\.ts$", "置き場の直下・名前はチケットの番号で始める")
        for p in sources():
            for target in re.findall(r"""(?:from|import\(|require\()\s*["']([^"']+)["']""", read(p)):
                self.assertNotRegex(target, r"journeys|apps/web|\.\./\.\./web|packages/", f"{p.name}：前の通し・画面の試験の道具・製品の部品を読まない（{target}）")

    def test_K65_FM_002_row_ids(self) -> None:
        names = titles()
        ids = [n.split(" ")[0] for n in names]
        self.assertEqual(ids, WITH_TEST, "試験の名前の頭は行 ID。01〜07 が 1 本ずつ、この順")
        self.assertEqual(len(re.findall(r"^test\(", read(SPEC), flags=re.M)), len(WITH_TEST), "名前を読めなかった試験が無い")
        self.assertNotRegex(read(SPEC), r"^\s*(test\.describe|describe)\(", "入れ子にしない（名前の頭が行 ID のまま記録に出る）")
        doc = read(TICKET)
        rows = re.findall(rf"^\| ({ROW}) \|", doc, flags=re.M)
        self.assertEqual(sorted(set(rows)), sorted(WITH_TEST + NO_TEST), "チケットの行の表と、試験を持つ行・持たない行が合う")
        skip = re.search(r"```judge-skip\n(.*?)```", doc, flags=re.S)
        self.assertIsNotNone(skip, "チケットに、チケットの CI で判定しない行の訳（judge-skip）が在る")
        skipped = re.findall(rf"^- ({ROW}): \S", skip.group(1), flags=re.M)
        self.assertEqual(sorted(skipped), sorted(WITH_TEST + NO_TEST), "staging の回で決める行は、どれも訳つきで judge-skip に在る")

    def test_K65_FM_003_no_way_around(self) -> None:
        banned = {
            r"\btest\.(skip|fixme|fail|only)\b|\bdescribe\.(skip|only|fixme)\b": "飛ばす・赤を見込む・1 本だけ流す",
            r"waitForTimeout\(": "固定の待ち",
            r"\.route\(|routeFromHAR|\.fulfill\(": "口の答えを網の手前で作る",
            r"\.catch\(\s*\(\s*\)\s*=>": "失敗の握りつぶし",
            r"x-forwarded-for": "送り元の付け替え",
        }
        for p in [SPEC, LIB / "steps.ts"]:
            for pattern, why in banned.items():
                if p != SPEC and "握りつぶし" in why:
                    continue   # 道具は、口の答えが JSON でないときに空として読む所が在る（番号はそのまま返す）。試験の中では握りつぶさない
                self.assertNotRegex(code(p), pattern, f"{p.name}：{why}")
        self.assertNotRegex(code(SPEC), r"(?<!test\.)\bsetTimeout\(", "試験の中で時間で待たない（test.setTimeout は別）")
        self.assertGreaterEqual(len(re.findall(r"\bexpect(?:\.poll)?\(", code(SPEC))), 60, "確かめが在る（空の試験で緑にしない）")
        for name in titles():
            body = read(SPEC).split(f'test("{name}"', 1)[1].split("\ntest(", 1)[0]
            self.assertRegex(body, r"\bexpect(?:\.poll)?\(", f"{name.split(' ')[0]}：確かめを持つ")

    def test_K65_FM_004_never_reads_db(self) -> None:
        for p in sources():
            self.assertNotRegex(code(p), r"""from\s+["']pg["']|\bDATABASE|\badmin\(|\bnew\s+Client\(|postgres(ql)?://[^\s"']*@""",
                                f"{p.name}：DB につながない（確かめは画面・口の読み直し・Resend の記録だけ）")
        self.assertNotIn("pg", json.loads(read(E2E / "package.json")).get("devDependencies", {}), "apps/e2e に DB の部品を足さない")

    def test_K65_FM_005_config(self) -> None:
        text = code(CONFIG)
        self.assertRegex(text, r'testDir:\s*"\./staging"')
        self.assertRegex(text, r'\[\s*"junit"\s*,\s*\{\s*outputFile:\s*JUNIT\s*\}\s*\]', "JUnit の報告・出し先は回が渡す道")
        self.assertRegex(text, r'JUNIT\s*=\s*process\.env\["PLAYWRIGHT_JUNIT_OUTPUT_NAME"\]')
        self.assertRegex(text, r'"\./staging/_lib/scrub-reporter\.ts"\s*,\s*\{\s*junit:\s*JUNIT\s*\}', "伏せ直す報告に同じ道を渡す")
        self.assertNotRegex(text, r'\[\s*"(html|list|line|dot|json|blob|github)"', "落ちた文をそのまま出す報告・写しを残す報告を使わない")
        for key in ("trace", "screenshot", "video"):
            self.assertRegex(text, rf'{key}:\s*"off"', f"{key} を残さない")
            self.assertEqual(len(re.findall(rf"\b{key}:", text)), 1, f"{key} の設定は 1 か所")
        self.assertRegex(text, r"retries:\s*0\b", "流し直しで通さない")
        self.assertRegex(text, r"workers:\s*1\b", "1 本ずつ順に")
        self.assertRegex(text, r"forbidOnly:\s*true\b")
        self.assertNotRegex(text, r"globalSetup|globalTeardown|webServer", "手元のサーバーを立てない・前後の台本を持たない")
        self.assertRegex(text, r"if\s*\(!BASE_URL\)\s*throw", "住所が無い回は止まる（手元の画面へ落とさない）")
        self.assertNotRegex(text, r"127\.0\.0\.1|localhost", "手元の住所を既定にしない")

    def test_K65_FM_006_env_names(self) -> None:
        may_read = {"site.ts", "scrub.mjs", "bridge.ts", "playwright.staging.config.ts", "k65-walking-skeleton.spec.ts"}
        seen: set[str] = set()
        for p in sources():
            text = code(p)
            if "process.env" in text or re.search(r"\benv\[", text):
                self.assertIn(p.name, may_read, f"{p.name}：環境の値を読む所を増やさない")
            seen |= set(re.findall(r"""process\.env\[\s*["']([A-Z0-9_]+)["']\s*\]""", text))
            self.assertNotRegex(text, r"process\.env\.[A-Za-z_]", f"{p.name}：環境の値は名前の字で読む（検査が名前を拾える形）")
        self.assertLessEqual(seen, ENV_NAMES, "読む環境の値の名前は決めた物だけ")
        needs = set(re.findall(r'(?:need|site)\("([A-Z0-9_]+)"\)', code(LIB / "site.ts")))
        self.assertEqual(needs, {"STAGING_BASE_URL", "STAGING_API_BASE", "STAGING_RESEND_READ_KEY"})
        run = [s for s in steps("staging-e2e.yml", "e2e") if str(s.get("run", "")).strip() == "pnpm e2e:staging"]
        self.assertEqual(len(run), 1, "統合テストの段は 1 つ")
        self.assertLessEqual(needs | {"PLAYWRIGHT_JUNIT_OUTPUT_NAME"}, set(run[0].get("env", {})), "試験が要る名前は、統合テストの段が渡している")

    def test_K65_FM_007_nothing_secret_in_records(self) -> None:
        for p in sources():
            text = code(p)
            self.assertNotRegex(text, r"\bconsole\.\w+\(", f"{p.name}：標準出力に書かない")
            self.assertNotRegex(text, r"\.attach\(|\.screenshot\(|tracing\.", f"{p.name}：写し・添え物を残さない")
            if p.name != "scrub.mjs":
                self.assertNotRegex(text, r"vercel\.app|supabase\.co|https://(?!api\.resend\.com)[a-z0-9.-]+\.[a-z]{2,}",
                                    f"{p.name}：住所を書かない（Resend の口のほか）")
        for p in [SPEC, LIB / "steps.ts"]:
            self.assertNotRegex(code(p), r"toHaveURL\(|waitForURL\(|page\.url\(\)\s*\)\s*\.to",
                                f"{p.name}：住所そのものを比べない（落ちた文に住所が出る）。道（pathname）を比べる")
        writes = re.findall(r"process\.stdout\.write\(", code(LIB / "scrub-reporter.ts"))
        self.assertGreaterEqual(len(writes), 1)
        for line in code(LIB / "scrub-reporter.ts").splitlines():
            if "process.stdout.write(" in line and "error" in line.lower():
                self.assertIn("short(", line, "落ちた文は伏せてから出す")
        self.assertRegex(code(LIB / "scrub-reporter.ts"), r"const short = [^;]*?scrub\(", "short は伏せる台本を通す")

    def test_K65_FM_008_scrub_works(self) -> None:
        planted = {
            "STAGING_BASE_URL": "https://k65-web-shape.example.test",
            "STAGING_API_BASE": "https://k65-api-shape.example.test/",
            "STAGING_RESEND_READ_KEY": "planted-key-value-0123456789",
            "STAGING_DATABASE_READ_URL": "postgresql://reader:planted-pass-99@db.k65-shape.example.test:6543/postgres?sslmode=verify-full",
        }
        sample = "\n".join([
            'navigating to "https://k65-web-shape.example.test/verify-email?token=PLANTEDTOKEN123&amp;x=1"',
            "fetch https://k65-api-shape.example.test/api/v1/tickets failed (k65-api-shape.example.test)",
            "to delivered+k65-abc123@resend.dev key planted-key-value-0123456789",
            "authorization: Bearer abcdefghijklmnopqrstuvwxyz012345",
            "device kpc_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq",
            "pool postgresql://reader:planted-pass-99@db.k65-shape.example.test:6543/postgres?sslmode=verify-full",
            "xml postgresql://reader:planted-pass-99@db.k65-shape.example.test:6543/postgres?sslmode=verify-full&amp;a=b",
            "file https://abcdefgh.supabase.co/storage/v1/object/sign/x?X-Amz-Signature=deadbeefdeadbeef",
            "site kaname-web-abc123.vercel.app",
            "<testcase name=\"K65-STG-01 正常\">",
        ])
        script = ("import('./apps/e2e/staging/_lib/scrub.mjs').then(async (m) => {"
                  " let s = ''; for await (const c of process.stdin) s += c; process.stdout.write(m.scrub(s)); })")
        env = {**{k: v for k, v in os.environ.items() if not k.startswith("STAGING_")}, **planted}
        out = subprocess.run(["node", "-e", script], cwd=ROOT, env=env, input=sample, capture_output=True, text=True, timeout=60)
        self.assertEqual(out.returncode, 0, out.stderr[-400:])
        for gone in ("k65-web-shape", "k65-api-shape", "PLANTEDTOKEN123", "delivered+k65-abc123", "planted-key-value",
                     "abcdefghijklmnopqrstuvwxyz012345", "kpc_ABCDEFGH", "planted-pass-99", "db.k65-shape", "abcdefgh.supabase.co",
                     "deadbeefdeadbeef", "kaname-web-abc123"):
            self.assertNotIn(gone, out.stdout, f"伏せ残し：{gone}")
        self.assertIn('<testcase name="K65-STG-01 正常">', out.stdout, "試験の名前（行 ID）は残す＝判定が読める")
        self.assertEqual(len(out.stdout.splitlines()), len(sample.splitlines()), "行を消さない（伏せるだけ）")

    def test_K65_FM_009_reporter_rewrites_junit(self) -> None:
        text = code(LIB / "scrub-reporter.ts")
        exit_body = text.split("onExit()", 1)[1]
        self.assertRegex(exit_body, r"writeFileSync\(this\.junit,\s*scrub\(readFileSync\(this\.junit", "JUnit を、書き終わった後（onExit）に伏せて書き戻す")
        self.assertRegex(exit_body, r"if\s*\(!existsSync\(this\.junit\)\)\s*return", "記録が無い回に、空の記録を作らない")
        self.assertRegex(text, r"printsToStdio\(\)[^{]*\{\s*return true", "ほかの報告に標準出力を書かせない")
        self.assertRegex(text, r'if\s*\(!options\.junit\)\s*throw', "道が渡っていない設定は止まる（伏せずに通さない）")

    def test_K65_FM_010_recipients_and_password(self) -> None:
        domains: set[str] = set()
        for p in sources():
            if p.name != "scrub.mjs":
                domains |= set(re.findall(r"@([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b", code(p)))
        self.assertLessEqual(domains - {"playwright/test", "playwright/test/reporter"}, {"resend.dev", "engine-base.com"},
                             "書いてよい宛先の形は Resend の試験用（と、差出人・返信先の期待値）だけ")
        steps_ts = code(LIB / "steps.ts")
        self.assertRegex(steps_ts, r"email:\s*`delivered\+k65-\$\{mark\}@resend\.dev`", "宛先は毎回別の、Resend の試験用の宛先")
        self.assertRegex(steps_ts, r"password:\s*`\$\{randomBytes\(\d+\)", "パスワードは回ごとに作る（決まった字を書かない）")
        self.assertRegex(steps_ts, r"name:\s*`統合テスト ", "人の名前に「統合テスト」の印")
        self.assertRegex(steps_ts, r"company:\s*`統合テストの会社 ", "会社の名前に「統合テスト」の印")

    def test_K65_FM_011_fake_claude_runs_here(self) -> None:
        mode = subprocess.run(["git", "ls-files", "-s", "--", str(FAKE.relative_to(ROOT))], cwd=ROOT, capture_output=True, text=True, check=True).stdout
        self.assertTrue(mode.startswith("100755 "), "偽の Claude Code は実行の許可つきで版に入っている")
        self.assertEqual(read(FAKE).splitlines()[0], "#!/usr/bin/env node", "1 行目で node を呼ぶ")
        out = subprocess.run([str(FAKE), "--version"], capture_output=True, text=True, timeout=60)
        self.assertEqual(out.returncode, 0, "この台で、台本をそのまま起こせる（輪の「動くかで決める」と同じ確かめ）")
        self.assertRegex(out.stdout, r"\d+\.\d+")
        body = read(SPEC).split("const BODY = {", 1)[1].split("}", 1)[0] + read(SPEC).split("const titleOf", 1)[1].split("\n", 1)[0]
        words = sorted(set(re.findall(r'text\.includes\("([^"]+)"\)', read(FAKE))))
        self.assertGreaterEqual(len(words), 10, "偽の AI の合図の語を拾えている")
        for w in words:
            self.assertNotIn(w, body, f"チケットの文に、偽の AI の合図の語を入れない（{w}）")

    def test_K65_FM_012_loop_points_at_staging_only(self) -> None:
        text = code(LIB / "bridge.ts")
        self.assertRegex(text, r'DIST = join\(ROOT, "apps/bridge/dist"\)')
        self.assertRegex(text, r'createRequire\(join\(DIST, "loop\.js"\)\)', "組み立てた物（配布と同じ build の出力）を読む")
        self.assertNotRegex(text, r"apps/bridge/src|\.ts\"\)", "src を直に読まない")
        self.assertRegex(text, r"if\s*\(!existsSync\(join\(DIST, \"loop\.js\"\)\)\)\s*throw", "組み立てが無ければ止まる（飛ばさない）")
        self.assertRegex(text, r'import \{ API \} from "\./site"')
        self.assertEqual(len(re.findall(r"apiBase: API\b", text)), 1, "輪の行き先は staging の口")
        self.assertRegex(text, r"claimCode\(API,", "引き取りの行き先も staging の口")
        self.assertRegex(text, r'process\.env\["KANAME_CLAUDE_BIN"\] = FAKE_CLAUDE', "AI は偽物を差す")
        self.assertNotRegex(text, r"startLocalServer|38617|local\.js|main\.js|electron|KANAME_API_BASE|pkill|child_process",
                            "この PC の中だけの口・窓・ほかのプロセスに触らない")
        env_ts = read(ROOT / "apps/bridge/src/env.ts")
        allow = re.search(r"const ALLOW = \[(.*?)\] as const", env_ts, flags=re.S)
        prefix = re.search(r"const ALLOW_PREFIX = \[(.*?)\] as const", env_ts, flags=re.S)
        self.assertIsNotNone(allow)
        self.assertIsNotNone(prefix)
        self.assertNotRegex(allow.group(1) + prefix.group(1), r"STAGING|RESEND|DATABASE|PLAYWRIGHT|\"S\"|\"ST\"",
                            "輪が起こす子（偽の AI）に渡す環境の許可リストに、staging の名前が無い")
        self.assertIn('"KANAME_CLAUDE_BIN"', env_ts, "輪が読む名前")

    def test_K65_FM_013_only_the_staging_run(self) -> None:
        pkg = json.loads(read(ROOT / "package.json"))["scripts"]
        self.assertEqual(pkg["e2e:staging"], "pnpm --filter @kaname/e2e exec playwright test -c playwright.staging.config.ts")
        gate = read(ROOT / ".github/workflows/v3-gate.yml")
        self.assertNotIn("e2e:staging", gate, "ふだんのチケットの CI では流さない")
        self.assertNotIn("playwright.staging", gate)
        g15 = [g for g in json.loads(read(ROOT / "03_architecture/foundation_gates.json"))["merge_gates"] if g["id"] == 15]
        self.assertEqual((g15[0]["script"], g15[0]["owner_task"]), ("pnpm e2e:staging", "K-65"))
        g65 = [s for s in steps("v3-gate.yml", "spec") if "k204_staging_workflow_test.py" in str(s.get("run", ""))]
        self.assertEqual(len(g65), 1)
        self.assertIn("python3 scripts/ci/k65_staging_spec_test.py", str(g65[0]["run"]), "G65 がこの試験を流す")

    def test_K65_FM_014_typed(self) -> None:
        ts = json.loads(read(E2E / "tsconfig.json"))
        self.assertTrue(ts["compilerOptions"]["strict"])
        self.assertTrue(ts["compilerOptions"]["noEmit"])
        self.assertIn("staging/**/*.ts", ts["include"])
        self.assertIn("playwright.staging.config.ts", ts["include"])
        check = json.loads(read(ROOT / "package.json"))["scripts"]["type-check"]
        self.assertRegex(check, r"&& tsc --noEmit -p apps/e2e/tsconfig\.json\b", "型の検査（G2）が統合テストの試験と道具も見る")

    def test_K65_FM_015_time_limits(self) -> None:
        for name in titles():
            body = read(SPEC).split(f'test("{name}"', 1)[1].split("\ntest(", 1)[0]
            limits = [int(x.replace("_", "")) for x in re.findall(r"test\.setTimeout\(([\d_]+)\)", body)]
            self.assertEqual(len(limits), 1, f"{name.split(' ')[0]}：上限を 1 つ持つ")
            self.assertLessEqual(limits[0], MAX_TEST_MS, f"{name.split(' ')[0]}：1 本の上限は 8 分まで")
        job = yaml.safe_load(read(ROOT / ".github/workflows/staging-e2e.yml"))["jobs"]["e2e"]
        self.assertLessEqual(job["timeout-minutes"], 30, "答えない staging で止まり続けない（回の上限）")


if __name__ == "__main__":
    unittest.main(verbosity=2)
