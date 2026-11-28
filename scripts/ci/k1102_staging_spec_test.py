#!/usr/bin/env python3
"""K-1102 の形の試験：段 13 の統合テストの運営の筋（apps/e2e/staging/k1102-f12-ops.spec.ts と _lib/ops-steps.ts）の置き場・行 ID・逃げ道・
記録に出さない書き方と、staging の試験だけの運営の人のパスキー（K-1101 の秘密）を読む口（site.ts・staging-e2e.yml・伏せる台本）。行 ID は K1102-FM-NNN。
staging にはつながない（試験の本体が流れるのは、main から手で起こす staging-e2e.yml の回だけ）。チケットの CI（G65）で流れる"""
from __future__ import annotations

import os
import pathlib
import re
import subprocess
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
STAGING = ROOT / "apps" / "e2e" / "staging"
SPEC = STAGING / "k1102-f12-ops.spec.ts"
LIB = STAGING / "_lib" / "ops-steps.ts"
SITE = STAGING / "_lib" / "site.ts"
TICKET = ROOT / "11_tickets" / "K-1102.md"
G65 = ROOT / "scripts" / "ci" / "g65.d" / "K-1102.txt"
WORKFLOW = ROOT / ".github" / "workflows" / "staging-e2e.yml"
GENERATOR = ROOT / "05_flow" / "build_testplan.py"
WITH_TEST = ["K1102-STG-01", "K1102-STG-02"]
OPS_NAMES = {"STAGING_OPS_PASSKEY_KEY", "STAGING_OPS_PASSKEY_ID", "STAGING_OPS_PASSKEY_USER"}
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


class K1102StagingShape(unittest.TestCase):
    def test_K1102_FM_001_place_and_imports(self) -> None:
        self.assertTrue(SPEC.exists(), "試験は apps/e2e/staging/k1102-f12-ops.spec.ts（設定の testMatch k<数>-*.spec.ts に当たる名前）")
        self.assertTrue(LIB.exists(), "道具は apps/e2e/staging/_lib/ops-steps.ts")
        for p in (SPEC, LIB):
            for imp in re.findall(r'from\s+"([^"]+)"', code(p)):
                self.assertFalse(imp.startswith(("../../web", "../journeys", "@kaname/")),
                                 f"{p.name} が {imp} を読む（staging の外の道具・製品の部品を読まない）")

    def test_K1102_FM_002_rows_and_tests(self) -> None:
        got = [t.split(" ")[0] for t in titles()]
        self.assertEqual(got, WITH_TEST, "試験は 2 本で、名前の頭が K1102-STG-01・02 の順")
        self.assertNotRegex(read(SPEC), r"test\.describe\(", "入れ子なし")
        md = read(TICKET)
        skip = judge_skip()
        for row in WITH_TEST:
            self.assertIn(f"| {row} |", md, f"{row} がチケットの行の表に在る")
            self.assertRegex(skip, rf"- {row}: \S", f"{row} が judge-skip に訳つきで在る（staging の回の JUnit で決める）")

    def test_K1102_FM_003_no_escape(self) -> None:
        bad = [r"\.skip\(", r"\.fixme\(", r"\.fail\(", r"\.only\(", r"waitForTimeout", r"(?<!test\.)setTimeout\(", r"page\.route\(",
               r"\.fulfill\(", r"x-forwarded-for", r"catch\(\s*\(\)\s*=>\s*(undefined|null|\{\s*\})\s*\)", r"\.isVisible\("]
        for p in (SPEC, LIB):
            text = code(p)
            for rx in bad:
                self.assertIsNone(re.search(rx, text), f"{p.name} に逃げ道 {rx}")
        for b in re.split(r"^test\(", code(SPEC), flags=re.M)[1:]:
            self.assertGreaterEqual(len(re.findall(r"\bexpect\b", b)), 8, "どの試験も確かめを 8 か所以上持つ")

    def test_K1102_FM_004_no_db_no_env(self) -> None:
        for p in (SPEC, LIB):
            text = code(p)
            for rx in [r"\bpg\b", r"DATABASE", r"admin\(", r"postgres(ql)?://", r"process\.env", r"\benv\["]:
                self.assertIsNone(re.search(rx, text), f"{p.name} が DB か環境の値を読む（{rx}）。読むのは site.ts・resend.ts だけ")
        self.assertRegex(code(LIB), r'import \{[^}]*\bopsPasskey\b[^}]*\} from "\./site"', "鍵は site.ts の opsPasskey から受ける")
        self.assertNotIn("opsPasskey", code(SPEC), "試験は鍵に触らない（道具の中だけ）")

    def test_K1102_FM_005_no_leak(self) -> None:
        for p in (SPEC, LIB):
            text = code(p)
            for rx in [r"console\.", r"\.screenshot\(", r"tracing", r"attach\(", r"vercel\.app", r"supabase\.co",
                       r"https?://", r"toHaveURL", r"waitForURL", r"[\w.+-]+@[\w-]+\.[\w.]+"]:
                self.assertIsNone(re.search(rx, text), f"{p.name} に記録に出る道 {rx}")
        lib = code(LIB)
        uses = re.findall(r"\bk\.(key|id|user)\b", lib)
        self.assertEqual(sorted(uses), ["id", "key", "user"], "鍵の 3 つは CDP の addCredential に 1 回ずつ渡すだけ")
        self.assertNotRegex(lib, r"\.(fill|type|evaluate)\([^)]*\bk\.", "鍵を画面に打たない・ページの中に渡さない")

    def test_K1102_FM_006_timeout(self) -> None:
        bodies = re.split(r"^test\(", code(SPEC), flags=re.M)[1:]
        self.assertEqual(len(bodies), len(WITH_TEST))
        for b in bodies:
            ms = re.findall(r"test\.setTimeout\((\d[\d_]*)\)", b)
            self.assertEqual(len(ms), 1, "どの試験も test.setTimeout を 1 つ持つ")
            self.assertLessEqual(int(ms[0].replace("_", "")), MAX_TEST_MS, "1 本は 8 分まで")

    def test_K1102_FM_007_g65(self) -> None:
        lines = [ln for ln in read(G65).splitlines() if ln.strip()]
        self.assertEqual(lines, ["python3 scripts/ci/k1102_staging_spec_test.py"])

    def test_K1102_FM_008_names_passed(self) -> None:
        site = code(SITE)
        needs = set(re.findall(r'need\("([A-Z0-9_]+)"\)', site))
        self.assertLessEqual(OPS_NAMES, needs, "site.ts が 3 つの名前を need で読む")
        for name in OPS_NAMES:
            self.assertNotRegex(site, rf'^export const \w+ = need\("{name}"\)', f"{name} は関数の中で読む（無い回でも K-65・K-999 の試験を落とさない）")
        steps = yaml.safe_load(read(WORKFLOW))["jobs"]["e2e"]["steps"]
        run = [s for s in steps if str(s.get("run", "")).strip() == "pnpm e2e:staging"]
        self.assertEqual(len(run), 1, "統合テストの段は 1 つ")
        env = run[0].get("env", {})
        for name in OPS_NAMES:
            self.assertEqual(env.get(name), "${{ secrets.%s }}" % name, f"統合テストの段が {name} を秘密から渡す")
        health = [s for s in steps if "staging_health.py" in str(s.get("run", ""))]
        for s in health:
            self.assertFalse(OPS_NAMES & set(s.get("env", {})), "健康診断の段には渡さない（渡すのは統合テストの段だけ）")
        gen = read(GENERATOR)
        for name in OPS_NAMES:
            self.assertIn(name, gen, f"作り手（build_testplan.py）が {name} を持つ（staging-e2e.yml は生成物）")

    def test_K1102_FM_009_scrub_hides_keys(self) -> None:
        # 作りものの PEM の形。秘密の検査（G43）の形に当たらないよう、実行時に組み立てる（検査は弱めない・K-65 の PLANTED_DB_URL と同じ）
        body = "K1102planted0" + "planted1" + "planted2-pem-body"
        edge = "-" * 5
        pem = f"{edge}BEGIN {'PRIVATE'} KEY{edge}\n{body}\n{edge}END {'PRIVATE'} KEY{edge}\n"
        planted = {
            "STAGING_BASE_URL": "https://k1102-web-shape.example.test",
            "STAGING_OPS_PASSKEY_KEY": pem,
            "STAGING_OPS_PASSKEY_ID": "k1102PlantedCredentialId0123456789abcdef",
            "STAGING_OPS_PASSKEY_USER": "k1102PlantedUserHandle0123456789",
        }
        sample = "\n".join([f"addCredential failed {planted['STAGING_OPS_PASSKEY_KEY']}",
                            f"credential {planted['STAGING_OPS_PASSKEY_ID']} user {planted['STAGING_OPS_PASSKEY_USER']}"])
        script = ("import('./apps/e2e/staging/_lib/scrub.mjs').then(async (m) => {"
                  " let s = ''; for await (const c of process.stdin) s += c; process.stdout.write(m.scrub(s)); })")
        env = {**{k: v for k, v in os.environ.items() if not k.startswith("STAGING_")}, **planted}
        out = subprocess.run(["node", "-e", script], cwd=ROOT, env=env, input=sample, capture_output=True, text=True, timeout=60)
        self.assertEqual(out.returncode, 0, out.stderr[-400:])
        for gone in ("k1102PlantedCredentialId", "k1102PlantedUserHandle", "K1102planted0planted1"):
            self.assertNotIn(gone, out.stdout, f"伏せ残し：{gone}")

    def test_K1102_FM_010_names_and_paths(self) -> None:
        lib = read(LIB)
        for name in ["運営のログイン", "パスキーで入る", "自分が持つ", "返す", "お知らせを送る", "題", "本文", "送る", "中を見る", "理由",
                     "見る時間", "見るだけで開く", "パスキーで確かめる", "そのほかの操作", "止める", "再開する", "変える案を作る"]:
            self.assertIn(f'"{name}"', lib, f"道具に画面の名前「{name}」が在る")
        for path in ['"/ops/login"', '"/ops/support"', '"/ops/skills/plans"', "/ops/tenants/", r"ops\/inquiries\/[^/]+\/replies",
                     r"ops\/workspaces\/[^/]+\/peeks", r"ops\/workspaces\/[^/]+\/stop", r"ops\/workspaces\/[^/]+\/resume"]:
            self.assertIn(path, lib, f"道具に道 {path} が在る")
        spec = read(SPEC)
        for path in ['"/ops/shell"', '"/ops/plans"', '"/ops/templates"', '"/ops/operations"', '"/inquiries"', '"/notices"', '"/service-status"']:
            self.assertIn(path, spec, f"試験が口 {path} を読み直す")


if __name__ == "__main__":
    unittest.main()
