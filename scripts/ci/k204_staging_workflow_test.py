#!/usr/bin/env python3
"""K-204 の試験：staging を指す統合テストの回（.github/workflows/staging-e2e.yml）の形。行 ID は K204-CI-NNN。
見るのは CI の定義と、定義を読む検査だけ。staging にはつながない（つなぐのは、main から手で起こした staging-e2e.yml の回だけ）"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
WF = ROOT / ".github" / "workflows"
NAMES = ["STAGING_BASE_URL", "STAGING_API_BASE", "STAGING_DATABASE_READ_URL", "STAGING_RESEND_READ_KEY"]
SPECS = "apps/e2e/staging/**/*.spec.ts"      # 統合テストの置き場（K-65 が作る物だけ）。前の通し apps/e2e/journeys は当てない
HEALTH = r"scripts/ci/staging_health\.py"
RUN = r"pnpm (-s )?e2e:staging\b"


def text(name: str = "staging-e2e.yml") -> str:
    return (WF / name).read_text(encoding="utf-8")


def load(name: str = "staging-e2e.yml") -> dict:
    return yaml.safe_load(text(name))


def job() -> dict:
    return load()["jobs"]["e2e"]


def steps() -> list[dict]:
    return job()["steps"]


def find(pattern: str) -> list[int]:
    return [i for i, s in enumerate(steps()) if re.search(pattern, str(s.get("run", "")))]


def one(pattern: str) -> dict:
    hit = find(pattern)
    assert len(hit) == 1, f"{pattern} の段は 1 つ（今 {len(hit)}）"
    return steps()[hit[0]]


class StagingWorkflow(unittest.TestCase):
    def test_K204_CI_001_only_by_hand(self) -> None:
        wf = load()
        on = wf.get("on", wf.get(True))        # YAML は on: を真偽の True に読む
        on = on if isinstance(on, dict) else {str(on): None}
        self.assertEqual(list(on), ["workflow_dispatch"], "staging を指す回は手で起こしたときだけ（push・PR・時刻では起きない）")

    def test_K204_CI_002_ticket_ci_never_touches_staging(self) -> None:
        for name in ("v3-gate.yml", "release-gate.yml"):
            self.assertNotIn("STAGING_", text(name), f"{name} が staging の住所や鍵の名前を読む")
        self.assertNotIn("e2e", load("v3-gate.yml")["jobs"], "ふだんの CI に、staging を指す組が残っている")
        self.assertNotIn("has-ui", text("v3-gate.yml"), "頭の注釈や条件に、札で起きる e2e の書き方が残っている")

    def test_K204_CI_003_own_vm_only(self) -> None:
        self.assertEqual(job()["runs-on"], ["self-hosted", "linux-vm"])
        self.assertNotRegex(text(), r"ubuntu-|macos-|windows-", "GitHub の台を使わない")

    def test_K204_CI_004_secrets_only_where_needed(self) -> None:
        wf = load()
        for where, env in (("定義の env", wf.get("env")), ("組の env", job().get("env"))):
            self.assertNotIn("secrets", json.dumps(env or {}), f"{where} に secrets を書くと、全部の段（依存の部品の後処理・組み立て）に渡る")
        holders = [i for i, s in enumerate(steps()) if "secrets" in json.dumps(s, ensure_ascii=False)]
        self.assertEqual(holders, sorted(find(HEALTH) + find(RUN)), "secrets を持つ段は、健康診断と統合テストの 2 つだけ")
        for i in holders:
            env = steps()[i].get("env") or {}
            for name in NAMES:
                self.assertEqual(str(env.get(name, "")).replace(" ", ""), "${{secrets.%s}}" % name, f"{name} は同じ名前の secrets から")
            self.assertNotIn("secrets", str(steps()[i].get("run", "")) + json.dumps(steps()[i].get("with") or {}), "secrets は env だけに書く")
        self.assertEqual(sorted(set(re.findall(r"secrets\.([A-Za-z0-9_]+)", text()))), sorted(NAMES), "読む secrets はこの 4 つだけ")
        self.assertNotRegex(text(), r"toJSON\(\s*secrets|secrets\s*\[|secrets:\s*inherit", "secrets をまとめて渡す・名前を作って読む形")
        self.assertNotRegex(text(), r"https?://[a-z0-9-]+\.(vercel\.app|supabase\.co)", "staging の住所を定義に書かない")

    def test_K204_CI_005_health_first_and_stops(self) -> None:
        health, run = find(HEALTH), find(RUN)
        self.assertEqual((len(health), len(run)), (1, 1), "健康診断の段と統合テストの段は 1 つずつ")
        self.assertLess(health[0], run[0], "健康診断が先")
        h, r = steps()[health[0]], steps()[run[0]]
        cmd = str(h["run"])
        for name in ("STAGING_DATABASE_READ_URL", "STAGING_RESEND_READ_KEY"):
            self.assertRegex(cmd, rf"--need\s+{name}\b", f"{name} が空なら、当てる前に止まる")
        lines = [x.strip() for x in cmd.splitlines() if x.strip()]
        self.assertRegex(lines[0], r"^node scripts/ci/staging_db_migrations\.mjs > \S+$", "先に DB の migration の一覧を読む（落ちたら次の行へ進まない）")
        self.assertRegex(cmd, r"staging_health\.py[^\n]*--applied\s+\S+", "読んだ一覧を健康診断に渡す（DB を見ていない回を緑にしない）")
        self.assertNotIn("if", h, "健康診断の段に条件を付けて飛ばさない")
        self.assertEqual(str(r.get("if", "")).replace("${{", "").replace("}}", "").strip(), f"hashFiles('{SPECS}') != ''",
                         "統合テストの段の条件は「試験が在る」の 1 つだけ（cancelled・always・failure を足すと、健康診断が赤でも流れる）")
        self.assertNotIn("continue-on-error", job(), "組に、落ちても緑にする印を付けない")
        for s in (h, r):
            self.assertNotIn("continue-on-error", s, "落ちても先へ進む印を付けない")
            self.assertNotIn("shell", s, "shell を書き換えて、途中の失敗で止まる既定（-e）を外さない")
            self.assertNotRegex(str(s["run"]), r"\||;\s*true\b|set \+e", "終わりの値を握りつぶさない（|| true・パイプ・set +e）")

    def test_K204_CI_006_no_specs_is_said_not_green(self) -> None:
        note = [s for s in steps() if f"hashFiles('{SPECS}') == ''" in str(s.get("if", ""))]
        self.assertEqual(len(note), 1, "試験が無い回は、そう言う段が 1 つ")
        self.assertIn("統合テストがまだ無い", str(note[0].get("run", "")))
        self.assertIn("::warning", str(note[0].get("run", "")), "回のまとめに出る形で言う")
        self.assertNotIn("apps/e2e/journeys", text(), "前の通し（j01・j02＝DB に書く）を、staging の鍵を持った回で流さない")
        old = subprocess.run(["git", "-C", str(ROOT), "ls-files", "-z", "apps/e2e/staging"], capture_output=True).stdout
        specs = [x for x in old.decode("utf-8").split("\0") if x.endswith(".spec.ts")]
        self.assertTrue(all(pathlib.PurePosixPath(x).name.startswith("k") for x in specs), "置き場に入るのは、チケットの番号で始まる統合テストだけ")

    def test_K204_CI_007_junit_only_and_short_lived(self) -> None:
        ups = [s for s in steps() if str(s.get("uses", "")).startswith("actions/upload-artifact")]
        self.assertEqual([(s.get("with") or {}).get("name") for s in ups], ["junit"], "上げるのは JUnit の記録 1 つ（名前は ticket-flow の ci.artifact と同じ）")
        self.assertIn("!cancelled()", str(ups[0].get("if", "")), "落ちた回も記録を上げる")
        w = ups[0].get("with") or {}
        self.assertNotRegex(str(w.get("path", "")), r"playwright-report|test-results|pw-reports", "画面の写しと報告は上げない（K-186 と同じ）")
        self.assertIsInstance(w.get("retention-days"), int, "記録を残す日数を書く（落ちた文に住所やリンクが乗りうる）")
        self.assertLessEqual(w["retention-days"], 7)
        run = one(RUN)
        self.assertRegex(str((run.get("env") or {}).get("PLAYWRIGHT_JUNIT_OUTPUT_NAME", "")), r"junit/[\w.-]+\.xml$", "JUnit の出し先")

    def test_K204_CI_008_generated(self) -> None:
        gens = json.loads((ROOT / "scripts/ci/generated.json").read_text(encoding="utf-8"))["generators"]
        mine = [g for g in gens if "build_testplan.py" in g["run"]]
        self.assertEqual(len(mine), 1)
        self.assertIn(".github/workflows/staging-e2e.yml", mine[0]["outputs"], "手で直した差は生成物の検査が赤にする")
        cfg = yaml.safe_load((ROOT / "ticket-flow.yaml").read_text(encoding="utf-8"))
        self.assertIn(".github/workflows/staging-e2e.yml", cfg["changes_ignore"], "作り手が作り直す物")
        self.assertRegex(text().splitlines()[0], r"build_testplan\.py が生成")

    def test_K204_CI_009_one_at_a_time(self) -> None:
        conc = load().get("concurrency") or job().get("concurrency") or {}
        self.assertEqual(conc.get("group"), "staging-e2e", "staging を指す回は同時に 1 つ（試験のデータと回数の制限が混ざる）")
        self.assertIs(conc.get("cancel-in-progress"), False, "後から来た回が、流れている回を止めない")

    def test_K204_CI_010_bounded(self) -> None:
        limit = job().get("timeout-minutes")
        self.assertIsInstance(limit, int, "答えない staging に台を取られ続けない")
        self.assertLessEqual(limit, 30)

    def test_K204_CI_011_read_only_token(self) -> None:
        self.assertEqual(load().get("permissions") or job().get("permissions"), {"contents": "read"})

    def test_K204_CI_012_gate_table(self) -> None:
        gates = json.loads((ROOT / "03_architecture/foundation_gates.json").read_text(encoding="utf-8"))["merge_gates"]
        g15 = [g for g in gates if g["id"] == 15][0]
        self.assertEqual(g15["script"], "pnpm e2e:staging", "G15 は staging の統合テスト（前の画面の試験 e2e:web でも、前の通し e2e:journeys でもない）")
        self.assertIn("staging-e2e.yml", g15["condition"])
        self.assertEqual(g15["owner_task"], "K-65")
        pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
        self.assertEqual(pkg["scripts"].get("e2e:staging"), "pnpm --filter @kaname/e2e exec playwright test -c playwright.staging.config.ts",
                         "統合テストは自分の設定（置き場 apps/e2e/staging）で流す。前の通しの設定（journeys）を使わない")
        plan = json.loads((ROOT / "07_qa/test-plan/test-plan.json").read_text(encoding="utf-8"))
        self.assertNotIn("has-ui", json.dumps(plan, ensure_ascii=False), "has-ui の札で起きる、の書き方が残っている")

    def test_K204_CI_013_gate_table_checker(self) -> None:
        r = subprocess.run([sys.executable, "scripts/ci/tv_gate.py"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=300)
        self.assertEqual(r.returncode, 0, "基盤ゲートの表の検査が赤（TV1：G15 を staging-e2e.yml で見つけられていない、など）\n" + r.stdout[-400:])
        src = (ROOT / "scripts/ci/tv_gate.py").read_text(encoding="utf-8")
        self.assertIn("staging-e2e.yml", src, "TV1 が staging-e2e.yml を読む")
        g15 = one(RUN)
        self.assertIn("G15", str(g15.get("name", "")), "統合テストの段の名前に G15")

    def test_K204_CI_014_main_only(self) -> None:
        cond = str(job().get("if", "")).replace("${{", "").replace("}}", "").strip()
        self.assertEqual(cond, "github.ref == 'refs/heads/main'", "枝から起こした回では、組ごと流れない（柵。枝で定義を書き換えれば外せるので壁ではない）")

    def test_K204_CI_016_read_only_role_over_verified_tls(self) -> None:
        self.assertNotIn("ADMIN", text(), "CI に DB の管理者の接続を渡さない（読むだけの役の接続だけ）")
        reader = (ROOT / "scripts/ci/staging_db_migrations.mjs").read_text(encoding="utf-8")
        self.assertIn("STAGING_DATABASE_READ_URL", reader, "DB を読む台本が読む名前は、secrets の名前と同じ")
        self.assertNotIn("ADMIN", reader)
        off = r"rejectUnauthorized\s*:\s*false|no-verify|sslmode=(disable|allow|prefer|require)\b|NODE_TLS_REJECT_UNAUTHORIZED"
        for name, body in (("staging-e2e.yml", text()), ("staging_db_migrations.mjs", reader)):
            self.assertIsNone(re.search(off, body), f"{name} に、TLS の確かめを外す・弱める書き方")
        doc = (ROOT / "infra/STAGING.md").read_text(encoding="utf-8")
        for need in ("create role kaname_ci_read", "grant select on table app.schema_migrations to kaname_ci_read", "sslmode=verify-full"):
            self.assertIn(need, doc, f"手順書に「{need}」")
        self.assertNotRegex(doc, r"password\s+'(?!ここに自分で作った値')[^']*'", "役を作る文の合言葉の所に、置き字のほかが書いてある")

    def test_K204_CI_015_nothing_prints_values(self) -> None:
        for s in steps():
            run = str(s.get("run", ""))
            self.assertIsNone(re.search(r"set -[a-z]*x|\bprintenv\b|^\s*env\s*$|^\s*env\s*[|>]", run, re.M), f"環境の値を丸ごと出す命令：{s.get('name')}")
            self.assertNotRegex(run, r"\$\{?STAGING_", f"値を命令の引数や echo に開いている（伏せ字は切り出した値に効かない）：{s.get('name')}")
        self.assertNotRegex(text(), r"ACTIONS_STEP_DEBUG|ACTIONS_RUNNER_DEBUG", "詳しい記録の印を定義で立てない")

    def test_K204_CI_017_secrets_live_in_environment(self) -> None:
        self.assertEqual(job().get("environment"), "staging",
                         "秘密は Environment「staging」の Environment secrets に在る。組がその名前をそのまま指さないと 4 つとも空で渡る（式で作らない・url を付けない）")
        self.assertEqual(list(load()["jobs"]), ["e2e"], "Environment を持たない組を足さない（起こせる枝を main だけにする決まりが掛からない）")
        doc = (ROOT / "infra/STAGING.md").read_text(encoding="utf-8")
        self.assertIn("Environment secrets", doc, "手順書の入れ先は Environment「staging」の Environment secrets")
        self.assertNotRegex(doc, r"(?i)repository secret", "手順書に、リポジトリの側の secrets に入れる書き方が残っている")


if __name__ == "__main__":
    unittest.main(verbosity=2)
