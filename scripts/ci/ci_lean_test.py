#!/usr/bin/env python3
"""K-156 の試験：チケットの CI の無駄（範囲の表の抜け・G27 の繰り返し・G46 の registry）を止める台本の形。
行 ID（K156-CI-…）は 11_tickets/K-156.md の表に結ぶ。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
決め：D-128.169（範囲に絞る）・D-128.123（同じ種類を止める検査を足す）・D-128.124（21 日）。

  python3 scripts/ci/ci_lean_test.py

試験が決める形（実装はこの名前と形で）:
  scripts/ci/ci_scope.py
    load_rules：決まりの `spec` は任意。あれば {"paths": list, "generated": bool} でなければ ValueError
    root_kind(path, rules, repo)：db → data → doc → **spec** → unmapped。spec ＝ spec.paths に当たる、または spec.generated が真で
        generated.json の outputs に当たる・generator_scripts に入る（全部の型。根の生成物のコードも）
    plan(...)：spec の物は p["spec_only"]（パスの並び）に入り、reasons に「static と spec だけ：<パス>」。全部に倒さず組も足さない
    no_test_path_reads(repo, rules)：root_kind が doc か spec の場所を読む試験・src を返す（data_links の物は data が先に当たる）
  scripts/tickets/ticket_order_gate.py
    generator_scripts(root) -> set[str]：generated.json の run を && で分け、cd <dir> を追い、.py/.mjs/.js/.sh で終わる語のうち
        存在するファイルを根からの相対で返す
  scripts/ci/layer_audit.py
    elsewhere_gates(entry) -> list[str]：層の `elsewhere`（"G2"・"G4・G5"・"G2 type check"）から段の番号 G<N> を順に
    audit(cfg, run, runner=subprocess.run) -> (rows, bad)：rows は {file, exists, kind, result, note, elsewhere?}。
        run のとき、elsewhere のある層は流さず kind「別」・result に「G2 の段で流す」。同じ check の文字は 1 回だけ流す。
        check も manual も elsewhere も無い層は kind「無」で bad。runner(cmd, shell=True, capture_output=True, text=True, cwd=…)
  scripts/ci/ci_wiring_gate.py
    check_elsewhere(layers, jobs, pkg_scripts, scope_rules) -> list[str]（W5 の文）：
        層の elsewhere の段 G<N> は、どれかの組の段の name の頭「G<N> 」。check を && で分けた各部が、その段の run
        （`pnpm [-s] <名前>` は pkg_scripts の中身まで開く）に、pnpm の名前として（part の全部の `pnpm [-s] <名前>`）か、
        台本のパス（.py/.mjs/.js/.sh/.ts で終わる最初の語）として入っていること。どちらも無い part は文字そのものが入っていること。
        段が範囲で決まる組（job の if に needs.static.outputs. を持つ）にあるときは、層の file の glob（* を x に置いた見本）が
        scope_rules の db.paths（database・unit-*）か jobs.<組>.paths（web）に当たらなければ赤
    check(extra=None, layers=None)：layers を渡せば spec-dependencies.yaml の layer_checks の代わりに使う。
        elsewhere のある層の check は「層の棚卸しから回る」に数えない（W1）。W5 も返す
  scripts/ci/stack_gate.py
    LOCK_DATES：記録の置き場（<ROOT>/scripts/ci/lock_dates.json）
    lock_sha(lock_text) -> str：lockfile の中身の sha256（16 進）
    lock_age(lock, ws_text, record, fetch, now, in_ci=False) -> (fails, record_out, asked)：
        in_ci（環境 CI の中）で sha が違えば、registry に聞いて判定したうえで S7 の赤（「lock_dates.json」「stack_gate.py」を含む文・D-133.1）を足す。手元では足さない。
        record は {"_doc", "lockfile_sha256", "asked_on", "dates": {"名前@版": ISO}}（None・形が違えば無いのと同じ）。
        sha が同じなら fetch を呼ばず asked == []・record_out は record のまま。違えば lockfile にあって記録に無い名前@版の
        名前だけ fetch(names) に聞き（asked はその名前の並び）、record_out は lockfile の名前@版だけ（無い物は落とす）・
        lockfile_sha256 は新しい sha・asked_on は now の日付。判定（21 日・minimumReleaseAgeExclude）はいつも now で。
        fetch の答えに _err があれば、その名前だけ S6 の赤（今までどおり）。record_out には聞けた分だけ入る（次は残りだけ聞く）
    check_lock_age(lock, ws_text, times, now)：今までの引数のまま残す（--selftest がそのまま通る）
  scripts/ci/ci_scope.py（画面の組と tickets.json・D-133.5・2026-11-10 answer=a224738a2ce5）
    決まりの jobs.web.ticket_rows = {"file": "11_tickets/tickets.json", "list": "tickets"}（jobs.web.paths には tickets.json を入れない）
    plan：そのファイルが変わったら、比べる元と先頭の JSON を id ごとに比べ、変わった・足した・消した行のチケットが画面を持つ
        （screens が空でない・tests に apps/web/ の物がある）ときだけ web の組。p["web_ticket_rows"] にその番号の並び。
        JSON が読めない（形が違う）ときは web を流す（安全な側）。比べる元にファイルが無ければ空の一覧と比べる
  scripts/ci/ci_scope.py（migration の lint・PM の追加 2026-11-09）
    plan：scope=full でも base が 40 桁で有効なら変えたファイルを読み、migration_files と wide の db を出してから全部に倒す。
        git の R（名前を変えた migration）の新しい名前を added_mig に数え、並びの付け替え（古い名前の行を消し新しい名前の行を足す）は DB の範囲
    squawk_plan(files, base) -> (argv | None, message)：空なら base 無し「比べる元が無いので流さない」／base あり「変えた migration が無い（比べる元 <10 字>）」
  scripts/ci/ci_scope.py と layer_audit.py（G27 の DB の層は DB を触った回だけ・2026-11-10 answer=d72d35c329ba・D-133.6）
    plan：p["db_range"]（真偽）＝ DB の範囲（db.paths：migration・行の守りの SQL・権限の表・引き金）を触った回。全部の回は真。
        outputs(p)["db_range"] は "true" / "false"
    audit(cfg, run, runner=…, db_range=True)：層の `db: true` は db_range が偽なら流さず kind「範囲」・result に「DB の範囲を触っていない」・
        bad に数えない。真なら今までどおり流す。`db` が真偽でない層は kind「無」で bad（形の誤り）
    main：--db-range true|false（既定 true＝安全な側。空の文字も true）。それ以外の値は終わり方 2 と「--db-range」を含む文
    本物：spec-dependencies.yaml の layer_checks で check に DATABASE_URL か packages/db/test を持ち elsewhere の無い層は全部 db: true。
        spec の組の G27 の段は CI_DB_RANGE（steps.scope.outputs.db_range）を --db-range に渡す
  scripts/ci/ci_scope.py（日付だけ変わった生成物・テスター Q 回 2）
    DATE：generated_gate.DATE と同じ形（日付を伏せて比べる）
    date_only(repo, base, head, changes) -> list[str]：changes のうち、generated.json の outputs に当たり、状態が M で、
        比べる元と先頭の中身が DATE を伏せると同じもの（作り手が書く「今日の日付」だけの違い）
    plan：date_only の物は changes から外して数える（範囲・DB の範囲・組の paths・spec_only のどれにも数えない）。
        p["date_only"] にその並び、reasons に「日付だけ：<パス>」。生成物でないファイル・日付の外も変わった物は外さない
"""
from __future__ import annotations

import copy
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "scripts" / "tickets"))
import ci_scope  # noqa: E402
import ci_scope_test as k107  # noqa: E402  （作りものの git の写し・決まり・補助は K-107 の試験の物を使う）
import ci_wiring_gate  # noqa: E402
import layer_audit  # noqa: E402
import stack_gate  # noqa: E402
import ticket_order_gate  # noqa: E402

# 作りものの決まり：K-107 の物に spec を足す。05_flow は paths に入れず、generated.json の作り手として当たることを見る
SPEC_RULES = copy.deepcopy(k107.RULES)
SPEC_RULES["spec"] = {"generated": True, "paths": ["03_architecture/**", "scripts/ci/x.py", "08_api/**", "07_qa/**", "07_functional/**"]}
# K-107 の Repo.commit は引数の名前の最後の部分を NAMES の表で直す（main_ts → main.ts）。この試験で使う名前を足す
k107.NAMES.update({"features_json": "features.json", "build_api_py": "build_api.py", "0001_sql": "0001.sql", "x_py": "x.py", "a_md": "a.md", "new_json": "new.json"})
GENERATED = {"generators":[{"name": "機能の分解", "run": "python3 05_flow/build_api.py", "outputs": ["07_functional/*"]},
                            {"name": "使ってもらい方", "run": "cd 05_flow && python3 build_md.py", "outputs": ["05_flow/使ってもらい方.md"]}]}


def spec_plan(r: k107.Repo, head: str = "HEAD") -> dict:
    return ci_scope.plan(str(r.dir), r.base, head, "auto", rules=SPEC_RULES, tickets_dir=str(r.dir / "11_tickets"),
                         list_tests=lambda files: {f: [] for f in files}, db_tests=lambda: ["packages/a/test/rows.test.ts"])


class SpecRepo(k107.Repo):
    """K-107 の写しに、生成物の目録と作り手と、パッケージに触らないチケット K-3 を足す"""

    def __init__(self) -> None:
        super().__init__()
        r = self.dir
        k107.write(r, "scripts/ci/generated.json", json.dumps(GENERATED, ensure_ascii=False))
        k107.write(r, "05_flow/build_api.py", "print('api')\n")
        k107.write(r, "05_flow/build_md.py", "print('md')\n")
        k107.write(r, "07_functional/features.json", "{}\n")
        k107.write(r, "11_tickets/K-3.md", k107.ticket("K-3", []))
        k107.git(r, "add", "-A")
        k107.git(r, "commit", "-q", "-m", "K-0 chore: 生成物の目録")
        self.base = k107.git(r, "rev-parse", "HEAD")


class ScopeTest(unittest.TestCase):
    """範囲の表：生成物と作り手は static と spec だけ（全部に倒さない）"""

    def setUp(self) -> None:
        self.r = SpecRepo()

    def tearDown(self) -> None:
        self.r.close()

    def test_K156_CI_001_generated_only_is_static_and_spec(self) -> None:
        self.r.commit("K-3 docs: 生成物", **{"07_functional__features_json": '{"a": 1}\n'})
        p = spec_plan(self.r)
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertEqual(p["jobs"], {"unit": False, "database": False, "web": False})
        self.assertEqual(p["unit_shards"], 0)
        self.assertEqual(p["spec_only"], ["07_functional/features.json"])
        self.assertFalse([x for x in p["reasons"] if "unmapped" in x], p["reasons"])
        self.assertTrue(any("static と spec だけ" in x and "07_functional/features.json" in x for x in p["reasons"]), p["reasons"])

    def test_K156_CI_002_generator_only_is_static_and_spec(self) -> None:
        self.r.commit("K-3 chore: 作り手", **{"05_flow__build_api_py": "print('api2')\n"})
        p = spec_plan(self.r)
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertEqual(p["jobs"], {"unit": False, "database": False, "web": False})
        self.assertEqual(p["spec_only"], ["05_flow/build_api.py"])

    def test_K156_CI_003_ci_settings_win_over_spec(self) -> None:
        # scripts/ci/x.py は spec.paths にもあるが、full.ci が先。K-170：チケットの CI は全部に倒さない（理由は残す）
        self.r.commit("K-3 chore: 台本", **{"scripts__ci__x_py": "print(1)\n"})
        p = spec_plan(self.r)
        self.assertNotEqual(p["mode"], "full")
        self.assertIn("ci", {c for c, _ in p["full_reasons"]})
        self.assertEqual(ci_scope.root_kind("scripts/ci/x.py", SPEC_RULES, str(self.r.dir)), "spec")   # 種類としては spec（順は plan が決める）

    def test_K156_CI_004_db_and_data_win_over_spec(self) -> None:
        rules = copy.deepcopy(SPEC_RULES)
        rules["db"]["paths"].append("07_functional/entities.json")
        repo = str(self.r.dir)
        self.assertEqual(ci_scope.root_kind("07_functional/entities.json", rules, repo), "db")
        self.assertEqual(ci_scope.root_kind("07_qa/plan.json", rules, repo), "data")          # data_links が spec（07_qa/**）より先
        self.assertEqual(ci_scope.root_kind("07_functional/features.json", rules, repo), "spec")
        self.assertEqual(ci_scope.root_kind("11_tickets/K-3.md", rules, repo), "doc")           # doc が spec より先

    def test_K156_CI_005_reader_of_spec_file_is_red(self) -> None:
        k107.write(self.r.dir, "apps/x/src/gen.ts", "import { readFileSync } from 'node:fs';\nexport const g = readFileSync('08_api/x.json');\n")
        k107.write(self.r.dir, "08_api/x.json", "{}\n")
        hits = ci_scope.no_test_path_reads(str(self.r.dir), SPEC_RULES)
        self.assertIn(("apps/x/src/gen.ts", "08_api/x.json"), hits)
        rules = copy.deepcopy(SPEC_RULES)
        rules["data_links"].append({"paths": ["08_api/x.json"], "readers": ["apps/x/src/gen.ts"]})
        self.assertNotIn(("apps/x/src/gen.ts", "08_api/x.json"), ci_scope.no_test_path_reads(str(self.r.dir), rules))

    def test_K156_CI_006_spec_shape_and_absence(self) -> None:
        d = pathlib.Path(tempfile.mkdtemp(prefix="k156-"))
        try:
            good = copy.deepcopy(SPEC_RULES)
            (d / "ok.json").write_text(json.dumps(good), encoding="utf-8")
            self.assertEqual(ci_scope.load_rules(str(d / "ok.json"))["spec"]["generated"], True)
            for bad in ({"paths": "08_api/**", "generated": True}, {"paths": [], "generated": "yes"}, ["08_api/**"]):
                rules = copy.deepcopy(SPEC_RULES)
                rules["spec"] = bad
                (d / "bad.json").write_text(json.dumps(rules), encoding="utf-8")
                with self.assertRaises(ValueError, msg=str(bad)):
                    ci_scope.load_rules(str(d / "bad.json"))
            # spec が無い決まり（K-107 の物）は今までどおり unmapped
            self.assertEqual(ci_scope.root_kind("07_functional/features.json", k107.RULES, str(self.r.dir)), "unmapped")
            self.assertEqual(ci_scope.root_kind("05_flow/build_api.py", k107.RULES, str(self.r.dir)), "unmapped")
        finally:
            shutil.rmtree(d, ignore_errors=True)

    def test_K156_CI_007_generator_scripts(self) -> None:
        d = pathlib.Path(tempfile.mkdtemp(prefix="k156-"))
        try:
            k107.write(d, "scripts/ci/generated.json", json.dumps({"generators": [
                {"name": "a", "run": "cd 05_flow && python3 build_md.py", "outputs": []},
                {"name": "b", "run": "node scripts/ci/contract.mjs gen", "outputs": []},
                {"name": "c", "run": "python3 scripts/ci/nothing.py --x", "outputs": []}]}))
            k107.write(d, "05_flow/build_md.py", "")
            k107.write(d, "scripts/ci/contract.mjs", "")
            self.assertEqual(ticket_order_gate.generator_scripts(str(d)), {"05_flow/build_md.py", "scripts/ci/contract.mjs"})
            self.assertEqual(ticket_order_gate.generator_scripts(str(d / "none")), set())
        finally:
            shutil.rmtree(d, ignore_errors=True)


MIG_RENAMED = 'export const MIGRATIONS = [\n  "0002.sql",\n];\nexport const a = 1;\n'


class MigrationLintTest(k107.Base):
    """足した・名前を変えた migration は必ず lint（G58）に乗る（PM の追加・K-62 の TS の見つけもの）"""

    def test_K156_CI_034_full_scope_still_lists_migrations(self) -> None:
        self.r.commit("K-1 feat: mig", packages__a__migrations__0002_sql="select 2;\n", packages__a__src__index_ts=k107.MIG2,
                      **{"11_tickets__K-1.md": k107.ticket("K-1", ["a"], ["db"])})
        p = self.r.plan(scope="full")
        self.assertEqual(p["mode"], "full")
        self.assertIn("requested", {c for c, _ in p["full_reasons"]})
        self.assertEqual(p["migration_files"], ["packages/a/migrations/0002.sql"])
        self.assertIn("db", {c for c, _ in p["wide_reasons"]})

    def test_K156_CI_035_renamed_migration_is_db_range(self) -> None:
        self.r.commit("K-1 feat: renumber", packages__a__migrations__0001_sql=None, packages__a__migrations__0002_sql="select 1;\n",
                      packages__a__src__index_ts=MIG_RENAMED, **{"11_tickets__K-1.md": k107.ticket("K-1", ["a"], ["db"])})
        p = self.r.plan()
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertIn("db", {c for c, _ in p["wide_reasons"]})
        self.assertNotIn("shared", {c for c, _ in p["wide_reasons"]})
        self.assertEqual(p["migration_files"], ["packages/a/migrations/0002.sql"])

    def test_K156_CI_036_squawk_message_tells_no_base_from_no_change(self) -> None:
        argv, msg = ci_scope.squawk_plan([], "")
        self.assertIsNone(argv)
        self.assertIn("比べる元が無い", msg)
        sha = "2b53f5e30d59b3523fd2391ce434931bb07b7c8a"
        argv, msg = ci_scope.squawk_plan([], sha)
        self.assertIsNone(argv)
        self.assertIn("変えた migration が無い", msg)
        self.assertIn(sha[:10], msg)
        argv, _ = ci_scope.squawk_plan(["packages/db/migrations/0092.sql"], sha)
        self.assertEqual(argv, ["pnpm", "exec", "squawk", "packages/db/migrations/0092.sql"])


class RealScopeTest(unittest.TestCase):
    """本物の決まり（scripts/ci/ci_scope.json）の上で"""

    def setUp(self) -> None:
        self.rules = ci_scope.load_rules(str(ROOT / "scripts/ci/ci_scope.json"))
        self.ws = ci_scope.workspace(str(ROOT))

    def test_K156_CI_008_only_provision_stays_unmapped(self) -> None:
        files = [f for f in subprocess.run(["git", "-C", str(ROOT), "ls-files", "-z"], capture_output=True).stdout.decode().split("\0") if f]
        left = []
        for f in files:
            if ci_scope.owner(f, self.ws) or ci_scope.match(f, self.rules["full"]["ci"]) or ci_scope.match(f, self.rules["full"]["lockfile"]):
                continue
            if ci_scope.root_kind(f, self.rules, str(ROOT)) == "unmapped":
                left.append(f)
        self.assertEqual([f for f in left if not f.startswith("infra/provision/")], [], f"unmapped が残っている（spec か no_test_paths に書く）: {left[:20]}")

    def test_K156_CI_033_japanese_name_is_spec(self) -> None:
        self.assertEqual(ci_scope.root_kind("03_architecture/ER図.md", self.rules, str(ROOT)), "spec")
        self.assertEqual(ci_scope.root_kind("08_api/types.ts", self.rules, str(ROOT)), "spec")   # 根の生成物のコードも（G38 が作り直して比べる）


class LayerAuditTest(unittest.TestCase):
    """G27：同じ命令は 1 回・印のある層は流さない"""

    def cfg(self, layers: list[dict]) -> dict:
        return {"decision_traceability": {"products": [], "sources": [{"file": ""}]}, "layer_checks": layers}

    def runner(self, calls: list[str]):
        def run(cmd, **kw):
            calls.append(cmd)
            return subprocess.CompletedProcess(cmd, 0, "ok\n", "")
        return run

    def test_K156_CI_010_same_check_runs_once(self) -> None:
        calls: list[str] = []
        rows, bad = layer_audit.audit(self.cfg([{"file": f"f{i}.json", "check": "python3 scripts/ci/same.py"} for i in range(3)]), True, runner=self.runner(calls))
        self.assertEqual(calls, ["python3 scripts/ci/same.py"])
        self.assertEqual([r["result"] for r in rows], ["OK", "OK", "OK"])
        self.assertEqual(bad, 0)

    def test_K156_CI_011_elsewhere_is_not_run(self) -> None:
        calls: list[str] = []
        rows, bad = layer_audit.audit(self.cfg([{"file": "apps/a/package.json", "check": "pnpm -s type-check", "elsewhere": "G2"},
                                                {"file": "b.json", "check": "python3 scripts/ci/b.py"}]), True, runner=self.runner(calls))
        self.assertEqual(calls, ["python3 scripts/ci/b.py"])
        self.assertEqual(rows[0]["kind"], "別")
        self.assertIn("G2 の段で流す", rows[0]["result"])
        self.assertEqual(bad, 0)
        self.assertEqual(layer_audit.elsewhere_gates({"elsewhere": "G4・G5"}), ["G4", "G5"])
        self.assertEqual(layer_audit.elsewhere_gates({"elsewhere": "G2 type check"}), ["G2"])
        self.assertEqual(layer_audit.elsewhere_gates({}), [])

    def test_K156_CI_012_layer_without_any_check_is_red(self) -> None:
        rows, bad = layer_audit.audit(self.cfg([{"file": "c.json"}]), True, runner=self.runner([]))
        self.assertEqual(bad, 1)
        self.assertEqual(rows[0]["kind"], "無")
        self.assertIn("検査が無い", rows[0]["result"])
        rows2, bad2 = layer_audit.audit(self.cfg([{"file": "d.json", "manual": "手で見る理由"}]), True, runner=self.runner([]))
        self.assertEqual(bad2, 0)

    def test_K156_CI_013_json_has_elsewhere(self) -> None:
        rows, _ = layer_audit.audit(self.cfg([{"file": "a.json", "check": "x", "elsewhere": "G2"}]), False, runner=self.runner([]))
        self.assertEqual(rows[0].get("elsewhere"), "G2")
        self.assertEqual(json.loads(json.dumps(rows, ensure_ascii=False))[0]["elsewhere"], "G2")


JOBS = {
    "static": {"steps": [{"name": "G2 type check", "run": "pnpm type-check"},
                         {"name": "G45 チケットの形", "run": "pnpm ci:tickets"},
                         {"name": "G54 決定のトレース", "run": "python3 scripts/ci/trace_gate.py --index && python3 scripts/ci/trace_gate.py"}]},
    "database": {"needs": ["static"], "if": "${{ !cancelled() && needs.static.outputs.database == 'true' }}",
                 "steps": [{"name": "G4 RLS 全テーブル有効 [CRITICAL]", "run": "pnpm ci:rls-enabled"}]},
    "spec": {"needs": ["static"], "if": "${{ !cancelled() }}", "steps": [{"name": "G46 部品", "run": "python3 scripts/ci/stack_gate.py --selftest && python3 scripts/ci/stack_gate.py"}]},
}
SCRIPTS = {"type-check": "tsc -b tsconfig.json", "ci:tickets": "python3 scripts/tickets/build_index.py --check", "ci:rls-enabled": "tsx packages/db/src/cli.ts rls-enabled"}
SCOPE = {"db": {"paths": ["packages/db/migrations/**", "packages/db/policies/**"]}, "jobs": {"web": {"paths": ["07_qa/test-specs/k/**"]}}}


class WiringTest(unittest.TestCase):
    """W5：印の指す段が本当にその命令を流している"""

    def test_K156_CI_014_elsewhere_covered_is_green(self) -> None:
        layers = [{"file": "apps/a/package.json", "check": "pnpm -s type-check", "elsewhere": "G2"},
                  {"file": "11_tickets/K-*.md", "check": "python3 scripts/tickets/build_index.py --check", "elsewhere": "G45"},
                  {"file": "01_hearing/x.md", "check": "python3 scripts/ci/trace_gate.py", "elsewhere": "G54"},
                  {"file": "scripts/ci/deprecated_baseline.json", "check": "python3 scripts/ci/stack_gate.py", "elsewhere": "G46 部品の確かめ"}]
        self.assertEqual(ci_wiring_gate.check_elsewhere(layers, JOBS, SCRIPTS, SCOPE), [])

    def test_K156_CI_015_missing_gate_or_command_is_red(self) -> None:
        r1 = ci_wiring_gate.check_elsewhere([{"file": "a", "check": "pnpm -s type-check", "elsewhere": "G99"}], JOBS, SCRIPTS, SCOPE)
        self.assertEqual(len(r1), 1)
        self.assertTrue(r1[0].startswith("W5"), r1)
        r2 = ci_wiring_gate.check_elsewhere([{"file": "a", "check": "python3 scripts/ci/other.py", "elsewhere": "G2"}], JOBS, SCRIPTS, SCOPE)
        self.assertEqual(len(r2), 1)
        self.assertTrue(r2[0].startswith("W5") and "other.py" in r2[0], r2)
        # && で分けた各部が要る：片方しか流していなければ赤
        r3 = ci_wiring_gate.check_elsewhere([{"file": "a", "check": "pnpm -s type-check && python3 scripts/ci/other.py", "elsewhere": "G2"}], JOBS, SCRIPTS, SCOPE)
        self.assertEqual(len(r3), 1)

    def test_K156_CI_016_scoped_job_needs_scope_coverage(self) -> None:
        layer = [{"file": "packages/db/policies/*.sql", "check": "pnpm -s ci:rls-enabled", "elsewhere": "G4"}]
        self.assertEqual(ci_wiring_gate.check_elsewhere(layer, JOBS, SCRIPTS, SCOPE), [])
        narrow = {"db": {"paths": ["packages/db/migrations/**"]}, "jobs": {"web": {"paths": []}}}
        r = ci_wiring_gate.check_elsewhere(layer, JOBS, SCRIPTS, narrow)
        self.assertEqual(len(r), 1)
        self.assertTrue(r[0].startswith("W5") and "db.paths" in r[0], r)

    def test_K156_CI_017_elsewhere_layer_does_not_count_as_wiring(self) -> None:
        extra = {"ci:kaname-x": "node scripts/ci/x.mjs"}
        with_mark = ci_wiring_gate.check(extra, layers=[{"file": "a", "check": "node scripts/ci/x.mjs", "elsewhere": "G99"}])
        self.assertTrue(any(f.startswith("W1") and "ci:kaname-x" in f for f in with_mark), with_mark)
        without = ci_wiring_gate.check(extra, layers=[{"file": "a", "check": "node scripts/ci/x.mjs"}])
        self.assertFalse(any(f.startswith("W1") and "ci:kaname-x" in f for f in without), without)

    def test_K156_CI_018_real_yaml_elsewhere_is_green(self) -> None:
        fails = [f for f in ci_wiring_gate.check() if f.startswith("W5")]
        self.assertEqual(fails, [])


LOCK = "\npackages:\n\n  a@1.0.0:\n    resolution: {integrity: x}\n\n  '@s/b@2.0.0':\n    resolution: {integrity: x}\n\nsnapshots:\n"
LOCK_OLD = "\npackages:\n\n  a@1.0.0:\n    resolution: {integrity: x}\n\n  c@0.1.0:\n    resolution: {integrity: x}\n\nsnapshots:\n"
NOW = "2026-02-05T00:00:00+00:00"


def record(lock: str, dates: dict[str, str], asked_on: str = "2026-01-20") -> dict:
    return {"_doc": "試し", "lockfile_sha256": stack_gate.lock_sha(lock), "asked_on": asked_on, "dates": dates}


class LockDatesTest(unittest.TestCase):
    """G46 の S6：lockfile が変わらなければ registry に聞かない"""

    def fetch(self, calls: list[list[str]], times: dict | None = None, err: bool = False):
        def f(names: list[str]) -> dict:
            calls.append(sorted(names))
            if err:
                return {n: {"_err": "網が無い"} for n in names}
            return {n: (times or {}).get(n, {}) for n in names}
        return f

    def test_K156_CI_019_same_sha_asks_nothing(self) -> None:
        calls: list[list[str]] = []
        rec = record(LOCK, {"a@1.0.0": "2025-12-01T00:00:00Z", "@s/b@2.0.0": "2026-01-25T00:00:00Z"})
        fails, out, asked = stack_gate.lock_age(LOCK, "x: 1\n", rec, self.fetch(calls), NOW)
        self.assertEqual(calls, [])
        self.assertEqual(asked, [])
        self.assertEqual(out, rec)
        self.assertEqual(len(fails), 1)
        self.assertIn("@s/b@2.0.0", fails[0])   # 1/25 に出て 2/5 では 21 日を過ぎていない（記録の出た日で判定）
        fails2, _, _ = stack_gate.lock_age(LOCK, 'minimumReleaseAgeExclude:\n  - "@s/b@2.0.0" # 2026-01-25 に出た\n', rec, self.fetch(calls), NOW)
        self.assertEqual(fails2, [])

    def test_K156_CI_020_judged_by_today_not_by_asked_on(self) -> None:
        calls: list[list[str]] = []
        # 記録を書いた 1/20 の時点では 1/10 に出た版は若かった。今日（2/5）は 21 日を過ぎているので緑
        rec = record(LOCK, {"a@1.0.0": "2026-01-10T00:00:00Z", "@s/b@2.0.0": "2025-06-01T00:00:00Z"}, asked_on="2026-01-20")
        fails, _, _ = stack_gate.lock_age(LOCK, "x: 1\n", rec, self.fetch(calls), NOW)
        self.assertEqual(fails, [])
        self.assertEqual(calls, [])

    def test_K156_CI_021_changed_sha_asks_only_missing_and_rewrites(self) -> None:
        calls: list[list[str]] = []
        rec = record(LOCK_OLD, {"a@1.0.0": "2025-12-01T00:00:00Z", "c@0.1.0": "2025-11-01T00:00:00Z"})
        fails, out, asked = stack_gate.lock_age(LOCK, "x: 1\n", rec, self.fetch(calls, {"@s/b": {"2.0.0": "2025-10-01T00:00:00Z"}}), NOW)
        self.assertEqual(calls, [["@s/b"]])
        self.assertEqual(asked, ["@s/b"])
        self.assertEqual(fails, [])
        self.assertEqual(out["dates"], {"a@1.0.0": "2025-12-01T00:00:00Z", "@s/b@2.0.0": "2025-10-01T00:00:00Z"})   # c は落ちる
        self.assertEqual(out["lockfile_sha256"], stack_gate.lock_sha(LOCK))
        self.assertEqual(out["asked_on"], "2026-02-05")

    def test_K156_CI_022_no_record_or_broken_or_unreachable_is_red(self) -> None:
        for rec in (None, {"x": 1}, {"lockfile_sha256": 5, "dates": []}):
            calls: list[list[str]] = []
            fails, out, asked = stack_gate.lock_age(LOCK, "x: 1\n", rec, self.fetch(calls, {"a": {"1.0.0": "2025-01-01T00:00:00Z"}, "@s/b": {"2.0.0": "2025-01-01T00:00:00Z"}}), NOW)
            self.assertEqual(calls, [["@s/b", "a"]], rec)
            self.assertEqual(fails, [])
            self.assertEqual(set(out["dates"]), {"a@1.0.0", "@s/b@2.0.0"})
        calls = []
        fails, _, _ = stack_gate.lock_age(LOCK, "x: 1\n", None, self.fetch(calls, err=True), NOW)
        self.assertEqual(len(fails), 2)
        self.assertTrue(all(f.startswith("S6") and "聞けない" in f for f in fails), fails)

    def test_K156_CI_038_stale_record_in_ci_is_red(self) -> None:
        times = {"@s/b": {"2.0.0": "2025-10-01T00:00:00Z"}}
        rec = record(LOCK_OLD, {"a@1.0.0": "2025-12-01T00:00:00Z", "c@0.1.0": "2025-11-01T00:00:00Z"})
        calls: list[list[str]] = []
        fails, out, asked = stack_gate.lock_age(LOCK, "x: 1\n", rec, self.fetch(calls, times), NOW, in_ci=True)
        s7 = [f for f in fails if f.startswith("S7")]
        self.assertEqual(len(s7), 1, fails)
        self.assertIn("lock_dates.json", s7[0])
        self.assertIn("stack_gate.py", s7[0])
        self.assertEqual(calls, [["@s/b"]])   # 赤でも判定はする（聞く）
        self.assertEqual(out["dates"]["@s/b@2.0.0"], "2025-10-01T00:00:00Z")
        fails_local, _, _ = stack_gate.lock_age(LOCK, "x: 1\n", rec, self.fetch([], times), NOW, in_ci=False)
        self.assertFalse([f for f in fails_local if f.startswith("S7")])
        same = record(LOCK, {"a@1.0.0": "2025-12-01T00:00:00Z", "@s/b@2.0.0": "2025-10-01T00:00:00Z"})
        fails_same, _, _ = stack_gate.lock_age(LOCK, "x: 1\n", same, self.fetch([], times), NOW, in_ci=True)
        self.assertFalse([f for f in fails_same if f.startswith("S7")])

    def test_K156_CI_040_partial_registry_error(self) -> None:
        lock3 = LOCK.replace("\nsnapshots:\n", "\n  c@3.0.0:\n    resolution: {integrity: x}\n\nsnapshots:\n")
        rec = record(LOCK_OLD, {"a@1.0.0": "2025-12-01T00:00:00Z"})
        calls: list[list[str]] = []
        def fetch(names: list[str]) -> dict:
            calls.append(sorted(names))
            return {"@s/b": {"2.0.0": "2025-10-01T00:00:00Z"}, "c": {"_err": "網が無い"}}
        fails, out, asked = stack_gate.lock_age(lock3, "x: 1\n", rec, fetch, NOW)
        self.assertEqual(calls, [["@s/b", "c"]])
        self.assertEqual(asked, ["@s/b", "c"])
        s6 = [f for f in fails if f.startswith("S6")]
        self.assertEqual(len(s6), 1, fails)
        self.assertIn("c", s6[0])
        self.assertEqual(out["dates"], {"a@1.0.0": "2025-12-01T00:00:00Z", "@s/b@2.0.0": "2025-10-01T00:00:00Z"})   # 聞けた分だけ
        fails_ci, _, _ = stack_gate.lock_age(lock3, "x: 1\n", rec, fetch, NOW, in_ci=True)
        self.assertTrue([f for f in fails_ci if f.startswith("S7")], fails_ci)

    def test_K156_CI_024_record_shape_and_place(self) -> None:
        _, out, _ = stack_gate.lock_age(LOCK, "x: 1\n", None, self.fetch([], {"a": {"1.0.0": "2025-01-01T00:00:00Z"}, "@s/b": {"2.0.0": "2025-01-01T00:00:00Z"}}), NOW)
        self.assertEqual(set(out), {"_doc", "lockfile_sha256", "asked_on", "dates"})
        self.assertEqual(os.path.relpath(stack_gate.LOCK_DATES, stack_gate.ROOT).replace(os.sep, "/"), "scripts/ci/lock_dates.json")
        self.assertRegex(stack_gate.lock_sha("abc"), r"^[0-9a-f]{64}$")


class WorkflowTest(unittest.TestCase):
    """作り手が出した workflow と設定（本物）"""

    def wf(self) -> dict:
        import yaml
        return yaml.safe_load((ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8"))["jobs"]

    def test_K156_CI_026_spec_needs_static_but_runs_when_static_is_red(self) -> None:
        spec = self.wf()["spec"]
        self.assertEqual(spec.get("needs"), ["static"])
        self.assertIn("!cancelled()", str(spec.get("if", "")))
        # 本線との分かれ目を自分で出す段（K-143）は残す
        self.assertEqual(len([s for s in spec["steps"] if "ci_scope.py" in s.get("run", "") and "--github-output" in s.get("run", "")]), 1)
        # この試験を流す段（無いと G53 が tests: の ci_lean_test.py を持ち主なしにする）
        g62 = [s for s in spec["steps"] if str(s.get("name", "")).startswith("G62 ")]
        self.assertEqual(len(g62), 1)
        self.assertIn("python3 scripts/ci/ci_lean_test.py", g62[0]["run"])

    def test_K156_CI_027_web_report_is_kept_as_artifact(self) -> None:
        web = self.wf()["web"]
        ups = [s for s in web["steps"] if str(s.get("uses", "")).startswith("actions/upload-artifact") and (s.get("with") or {}).get("name") == "playwright-report-web"]
        self.assertEqual(len(ups), 1)
        self.assertIn("!cancelled()", str(ups[0].get("if", "")))
        path = str(ups[0]["with"]["path"])
        self.assertIn("apps/web/playwright-report/", path)
        self.assertIn("apps/web/playwright-report-skeleton/", path)
        self.assertIn("apps/web/pw-reports/", path)

    def test_K156_CI_041_skeleton_report_does_not_overwrite_k_report(self) -> None:
        web = self.wf()["web"]
        g59 = [s for s in web["steps"] if str(s.get("name", "")).startswith("G59 ")]
        self.assertEqual(len(g59), 1)
        if "scripts/ci/web_run.py g59" in g59[0]["run"]:   # K-177：置き場は web_run.py が env で渡す
            import sys  # noqa: PLC0415
            sys.path.insert(0, str(ROOT / "scripts/ci"))
            import web_run  # noqa: PLC0415
            e59, e48 = web_run.env_for("g59", {}), web_run.env_for("g48", {})
            self.assertEqual(e59["PLAYWRIGHT_HTML_OUTPUT_DIR"], "playwright-report-skeleton")
            self.assertNotEqual(e59["PW_REPORT"], e48["PW_REPORT"], "G59 の報告が G48 の報告を上書きしない")
        else:
            self.assertIn("PLAYWRIGHT_HTML_OUTPUT_DIR=playwright-report-skeleton", g59[0]["run"])

    def test_K156_CI_037_squawk_step_knows_base(self) -> None:
        db = self.wf()["database"]
        sq = [s for s in db["steps"] if "run-squawk" in s.get("run", "")]
        self.assertEqual(len(sq), 1)
        self.assertIn("needs.static.outputs.base", sq[0]["env"].get("CI_BASE", ""))

    def test_K156_CI_039_hook_timeout_is_three_times_measured_max(self) -> None:
        text = (ROOT / "vitest.config.ts").read_text(encoding="utf-8")
        m = re.search(r"\bhookTimeout\s*:\s*([\d_]+)", text)
        self.assertIsNotNone(m)
        self.assertEqual(int(m.group(1).replace("_", "")), 11000)   # 全部のファイルの最大 3.6 秒 × 3 を切り上げ（D-133.2・2026-11-10 answer=5185823099d3）
        self.assertIn("× 3", text)

    def test_K156_CI_029_hook_timeout_in_one_place_with_measurement(self) -> None:
        text = (ROOT / "vitest.config.ts").read_text(encoding="utf-8")
        lines = text.splitlines()
        hits = [i for i, ln in enumerate(lines) if re.search(r"\bhookTimeout\s*:\s*\d", ln)]
        self.assertEqual(len(hits), 1, "hookTimeout は vitest.config.ts に 1 か所")
        around = "\n".join(lines[max(0, hits[0] - 3): hits[0] + 1])
        self.assertIn("実測", around)   # 値の根拠（CI の記録の最大 × 3）を同じ所に書く
        self.assertEqual(len(re.findall(r"hookTimeout", (ROOT / "apps/api/test/harness.ts").read_text(encoding="utf-8"))), 0)



class EntryPointTest(unittest.TestCase):
    """入口（コマンドとして流したとき）。CI の G27・G46・G47・G58 はこの入口を流す（実装の段のカバレッジで足りないと分かった行・K-156）"""

    def run_main(self, fn, argv: list[str], env: dict[str, str | None] | None = None) -> tuple[int, str]:
        import contextlib, io
        from unittest import mock
        out = io.StringIO()
        patched = {k: v for k, v in (env or {}).items() if v is not None}
        drop = [k for k, v in (env or {}).items() if v is None]
        with mock.patch.object(sys, "argv", argv), mock.patch.dict(os.environ, patched), contextlib.redirect_stdout(out):
            for k in drop:
                os.environ.pop(k, None)
            try:
                rc = fn()
            except SystemExit as e:
                rc = e.code
        return rc, out.getvalue()

    def fake_registry(self, calls: list[list[str]]):
        def f(names: list[str]) -> dict:
            calls.append(list(names))
            return {n: {v: "2025-01-01T00:00:00Z" for _, v in [(0, ver) for nm, ver in stack_gate.lock_packages(open(stack_gate.ROOT + "/pnpm-lock.yaml", encoding="utf-8").read()) if nm == n]} for n in names}
        return f

    def test_K156_CI_042_stack_gate_writes_record_locally_then_reads_it(self) -> None:
        from unittest import mock
        d = pathlib.Path(tempfile.mkdtemp(prefix="k156-"))
        try:
            rec_path = str(d / "lock_dates.json")
            calls: list[list[str]] = []
            with mock.patch.object(stack_gate, "LOCK_DATES", rec_path), mock.patch.object(stack_gate, "registry_times", self.fake_registry(calls)):
                rc, out = self.run_main(stack_gate.main, ["stack_gate.py"], {"CI": None})
                self.assertEqual(rc, 0, out)
                self.assertIn("を直した", out)
                rec = json.load(open(rec_path, encoding="utf-8"))
                lock = open(stack_gate.ROOT + "/pnpm-lock.yaml", encoding="utf-8").read()
                self.assertEqual(rec["lockfile_sha256"], stack_gate.lock_sha(lock))
                self.assertEqual(len(rec["dates"]), len(stack_gate.lock_packages(lock)))
                self.assertEqual(len(calls), 1)
                rc2, out2 = self.run_main(stack_gate.main, ["stack_gate.py"], {"CI": None})
                self.assertEqual(rc2, 0, out2)
                self.assertIn("から答えた", out2)
                self.assertEqual(len(calls), 1)   # 2 回目は聞かない
        finally:
            shutil.rmtree(d, ignore_errors=True)

    def test_K156_CI_043_stack_gate_in_ci_with_stale_record_is_red_and_keeps_record(self) -> None:
        from unittest import mock
        d = pathlib.Path(tempfile.mkdtemp(prefix="k156-"))
        try:
            rec_path = d / "lock_dates.json"
            stale = {"_doc": "試し", "lockfile_sha256": "0" * 64, "asked_on": "2026-01-01", "dates": {}}
            rec_path.write_text(json.dumps(stale), encoding="utf-8")
            with mock.patch.object(stack_gate, "LOCK_DATES", str(rec_path)), mock.patch.object(stack_gate, "registry_times", self.fake_registry([])):
                rc, out = self.run_main(stack_gate.main, ["stack_gate.py"], {"CI": "true"})
            self.assertEqual(rc, 1, out)
            self.assertIn("S7", out)
            self.assertEqual(json.loads(rec_path.read_text(encoding="utf-8")), stale)   # CI では書かない
            self.assertIsNone(stack_gate._load_record() if False else None)
            with mock.patch.object(stack_gate, "LOCK_DATES", str(d / "無い.json")):
                self.assertIsNone(stack_gate._load_record())
            (d / "壊れた.json").write_text("{", encoding="utf-8")
            with mock.patch.object(stack_gate, "LOCK_DATES", str(d / "壊れた.json")):
                self.assertIsNone(stack_gate._load_record())
        finally:
            shutil.rmtree(d, ignore_errors=True)

    def test_K156_CI_044_layer_audit_main_run_json_manual_and_warn(self) -> None:
        d = pathlib.Path(tempfile.mkdtemp(prefix="k156-"))
        cwd = os.getcwd()
        try:
            (d / "log.md").write_text("<!-- decision: D-002\n     status: confirmed -->\n", encoding="utf-8")
            (d / "old.md").write_text("D-001 を見た\n", encoding="utf-8")
            layers = [{"file": "a.json", "check": "python3 -c \"print('ok')\""},
                      {"file": "b.json", "check": "pnpm -s type-check", "elsewhere": "G2"},
                      {"file": "old.md", "manual": "手で見る"},
                      {"file": "c.md", "manual": "手で見る"}]
            cfg = {"decision_traceability": {"products": [], "sources": [{"file": "log.md"}]}, "layer_checks": layers}
            (d / "map.yaml").write_text(json.dumps(cfg, ensure_ascii=False), encoding="utf-8")
            os.chdir(d)
            rc, out = self.run_main(layer_audit.main, ["layer_audit.py", "--map", "map.yaml", "--run"])
            self.assertEqual(rc, 0, out)
            self.assertIn("OK（G2 の段で流す）", out)
            self.assertIn("warn 古いかもしれない（最新の参照 D-001 < 正本 D-002）", out)
            self.assertIn("流した命令 1", out)
            self.assertIn("PASS — G21", out)
            rc, out = self.run_main(layer_audit.main, ["layer_audit.py", "--map", "map.yaml", "--run", "--json"])
            j = json.loads(out)
            self.assertTrue(j["pass"])
            self.assertEqual(j["latest"], 2)
            self.assertIn("sec", [r for r in j["rows"] if r["file"] == "a.json"][0])
            rc, out = self.run_main(layer_audit.main, ["layer_audit.py", "--map", "map.yaml"])
            self.assertIn("（--run で実行）", out)
            cfg["layer_checks"].append({"file": "d.md", "manual": ""})
            cfg["layer_checks"].append({"file": "e.json", "check": "python3 -c \"import sys; print('★ だめ'); sys.exit(3)\""})
            (d / "map.yaml").write_text(json.dumps(cfg, ensure_ascii=False), encoding="utf-8")
            rc, out = self.run_main(layer_audit.main, ["layer_audit.py", "--map", "map.yaml", "--run"])
            self.assertEqual(rc, 2, out)
            self.assertIn("★ manual の理由が無い", out)
            self.assertIn("│ ★ だめ", out)
            self.assertIn("FAIL — G21 検査の無い層 2", out)
        finally:
            os.chdir(cwd)
            shutil.rmtree(d, ignore_errors=True)

    def test_K156_CI_045_wiring_main_and_plain_command_part(self) -> None:
        rc, out = self.run_main(ci_wiring_gate.main, ["ci_wiring_gate.py"])
        self.assertEqual(rc, 0, out)
        self.assertIn("PASS — 書いた検査は全部", out)
        rc, out = self.run_main(ci_wiring_gate.main, ["ci_wiring_gate.py", "--selftest"])
        self.assertEqual(rc, 0, out)
        jobs = {"static": {"steps": [{"name": "G9 何か", "run": "docker compose -f infra/docker-compose.dev.yml config -q"}]}}
        layer = [{"file": "infra/docker-compose.dev.yml", "check": "docker compose -f infra/docker-compose.dev.yml config -q", "elsewhere": "G9"}]
        self.assertEqual(ci_wiring_gate.check_elsewhere(layer, jobs, {}, {}), [])
        layer[0]["check"] = "docker compose -f other.yml config -q"
        self.assertEqual(len(ci_wiring_gate.check_elsewhere(layer, jobs, {}, {})), 1)


class TesterFindingsTest(unittest.TestCase):
    """テスター Q 回 1 の差し戻し（追加-1〜3）。どれも類で受ける（K-156）"""

    def fetch(self, calls: list[list[str]], times: dict | None = None):
        def f(names: list[str]) -> dict:
            calls.append(sorted(names))
            return {n: (times or {}).get(n, {}) for n in names}
        return f

    def test_K156_CI_048_stale_record_without_new_names(self) -> None:
        # 類：書き直す・赤にする条件は「記録が lockfile と合わない」で決める（途中の値＝聞いた名前の有無で決めない）
        rec = record(LOCK + "# 注釈\n", {"a@1.0.0": "2025-12-01T00:00:00Z", "@s/b@2.0.0": "2025-10-01T00:00:00Z", "gone@1.0.0": "2025-01-01T00:00:00Z"})
        calls: list[list[str]] = []
        fails, out, asked = stack_gate.lock_age(LOCK, "x: 1\n", rec, self.fetch(calls), NOW, in_ci=True)
        self.assertEqual(calls, [])
        self.assertEqual(asked, [])
        self.assertIsNot(out, rec)
        self.assertEqual(out["lockfile_sha256"], stack_gate.lock_sha(LOCK))
        self.assertNotIn("gone@1.0.0", out["dates"])     # 部品を消した行は落ちる
        self.assertTrue([f for f in fails if f.startswith("S7")], fails)
        fails_local, _, _ = stack_gate.lock_age(LOCK, "x: 1\n", rec, self.fetch([]), NOW, in_ci=False)
        self.assertFalse([f for f in fails_local if f.startswith("S7")])
        # 入口：手元では書き直し、CI では書かずに S7
        from unittest import mock
        d = pathlib.Path(tempfile.mkdtemp(prefix="k156-"))
        try:
            real = open(stack_gate.ROOT + "/pnpm-lock.yaml", encoding="utf-8").read()
            dates = {f"{n}@{v}": "2025-01-01T00:00:00Z" for n, v in stack_gate.lock_packages(real)}
            stale = {"_doc": "試し", "lockfile_sha256": "0" * 64, "asked_on": "2026-01-01", "dates": dates}
            path = d / "lock_dates.json"
            path.write_text(json.dumps(stale), encoding="utf-8")
            ep = EntryPointTest()
            with mock.patch.object(stack_gate, "LOCK_DATES", str(path)), mock.patch.object(stack_gate, "registry_times", self.fetch([])):
                rc, out_ci = ep.run_main(stack_gate.main, ["stack_gate.py"], {"CI": "true"})
                self.assertEqual(rc, 1, out_ci)
                self.assertIn("S7", out_ci)
                self.assertNotIn("から答えた", out_ci)
                self.assertEqual(json.loads(path.read_text(encoding="utf-8"))["lockfile_sha256"], "0" * 64)
                rc, out_local = ep.run_main(stack_gate.main, ["stack_gate.py"], {"CI": None})
                self.assertEqual(rc, 0, out_local)
                self.assertIn("を直した（0 件を registry に聞いた）", out_local)
                self.assertEqual(json.loads(path.read_text(encoding="utf-8"))["lockfile_sha256"], stack_gate.lock_sha(real))
        finally:
            shutil.rmtree(d, ignore_errors=True)

    def test_K156_CI_049_changed_rows_are_rechecked_against_registry(self) -> None:
        # 類：守りの検査が書き換えられる記録だけで判定しない。比べる元から足した・変えた行は registry で独立に確かめる（S8）
        base = record(LOCK, {"a@1.0.0": "2025-12-01T00:00:00Z", "@s/b@2.0.0": "2026-01-30T00:00:00Z"})
        tampered = record(LOCK, {"a@1.0.0": "2025-12-01T00:00:00Z", "@s/b@2.0.0": "2020-01-01T00:00:00Z"})
        reg = {"@s/b": {"2.0.0": "2026-01-30T00:00:00Z"}, "a": {"1.0.0": "2025-12-01T00:00:00Z"}}
        calls: list[list[str]] = []
        fails, names = stack_gate.verify_changed(tampered, base, self.fetch(calls, reg))
        self.assertEqual(calls, [["@s/b"]])                # 変えていない a は聞かない
        self.assertEqual(names, ["@s/b"])
        self.assertEqual(len(fails), 1)
        self.assertTrue(fails[0].startswith("S8") and "@s/b@2.0.0" in fails[0] and "2020-01-01" in fails[0], fails)
        self.assertEqual(stack_gate.verify_changed(base, base, self.fetch([], reg)), ([], []))   # 変えていなければ聞かない
        calls = []
        fails, names = stack_gate.verify_changed(base, None, self.fetch(calls, reg))   # 比べる元に記録が無い：全部の行
        self.assertEqual(calls, [["@s/b", "a"]])
        self.assertEqual(fails, [])
        fails, _ = stack_gate.verify_changed(tampered, base, lambda names: {n: {"_err": "網が無い"} for n in names})
        self.assertTrue(fails and fails[0].startswith("S8") and "聞き直せない" in fails[0])
        self.assertIsNone(stack_gate.base_record(""))
        self.assertIsNone(stack_gate.base_record("0" * 40))   # 無い版

    def test_K156_CI_050_g46_knows_base(self) -> None:
        import yaml
        spec = yaml.safe_load((ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8"))["jobs"]["spec"]
        g46 = [s for s in spec["steps"] if str(s.get("name", "")).startswith("G46 ")]
        self.assertEqual(len(g46), 1)
        self.assertIn('--base-ref "$CI_BASE"', g46[0]["run"])
        self.assertEqual(g46[0]["env"]["CI_BASE"].replace(" ", ""), "${{steps.scope.outputs.base}}")

    def test_K156_CI_051_uploaded_dirs_are_tracked_or_ignored(self) -> None:
        # 類：成果物の置き場を足したら、版に入れる物か無視の決まりに入れた物のどちらか（取り違えてコミットしない）
        import yaml
        wf = yaml.safe_load((ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8"))
        paths = sorted({p.strip().rstrip("/") for j in wf["jobs"].values() for s in (j.get("steps") or [])
                        if str(s.get("uses", "")).startswith("actions/upload-artifact") and "path" in (s.get("with") or {})   # まとめる段（merge）は path を持たない・K-172
                        for p in str(s["with"]["path"]).split("\n") if p.strip()})
        self.assertIn("apps/web/playwright-report-skeleton", paths)
        for rel in paths:
            tracked = bool(subprocess.run(["git", "-C", str(ROOT), "ls-files", "--", rel], capture_output=True, text=True).stdout.strip())
            ignored = subprocess.run(["git", "-C", str(ROOT), "check-ignore", "-q", rel + "/x"]).returncode == 0
            self.assertTrue(tracked or ignored, f"{rel}：版にも無視の決まりにも入っていない")
        eslint = (ROOT / "eslint.config.mjs").read_text(encoding="utf-8")
        self.assertIn('"**/playwright-report-skeleton/**"', eslint)


TICKET_ROWS = {"file": "11_tickets/tickets.json", "list": "tickets"}


def tickets_json(*rows: dict) -> str:
    return json.dumps({"tickets": list(rows)}, ensure_ascii=False) + "\n"


class WebTicketRowsTest(unittest.TestCase):
    """画面の組は、tickets.json の変わった行が画面を持つチケットのときだけ（D-133.5・決める人 2026-11-10 answer=a224738a2ce5）"""

    K1 = {"id": "K-1", "screens": [], "tests": ["scripts/ci/x_test.py"], "stage": "未着手"}
    K2 = {"id": "K-2", "screens": ["login"], "tests": [], "stage": "未着手"}
    K3 = {"id": "K-3", "screens": [], "tests": ["apps/web/tests/x.spec.ts"], "stage": "未着手"}

    def setUp(self) -> None:
        self.r = k107.Repo()
        self.rules = copy.deepcopy(k107.RULES)
        self.rules["jobs"]["web"]["ticket_rows"] = dict(TICKET_ROWS)
        self.r.commit("K-0 chore: 一覧", **{"11_tickets__tickets.json": tickets_json(self.K1, self.K2, self.K3)})
        self.r.base = k107.git(self.r.dir, "rev-parse", "HEAD")

    def tearDown(self) -> None:
        self.r.close()

    def plan(self) -> dict:
        return ci_scope.plan(str(self.r.dir), self.r.base, "HEAD", "auto", rules=self.rules, tickets_dir=str(self.r.dir / "11_tickets"),
                             list_tests=lambda files: {f: [] for f in files}, db_tests=lambda: [])

    def change(self, *rows: dict) -> dict:
        self.r.commit("K-1 docs: 一覧", **{"11_tickets__tickets.json": tickets_json(*rows), "11_tickets__K-1.md": k107.ticket("K-1", [])})
        return self.plan()

    def test_K156_CI_052_non_screen_ticket_row_does_not_run_web(self) -> None:
        p = self.change({**self.K1, "stage": "作業中"}, self.K2, self.K3)
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertFalse(p["jobs"]["web"])
        self.assertEqual(p["web_ticket_rows"], [])

    def test_K156_CI_053_screen_ticket_row_runs_web(self) -> None:
        p = self.change(self.K1, {**self.K2, "stage": "作業中"}, self.K3)
        self.assertTrue(p["jobs"]["web"])
        self.assertEqual(p["web_ticket_rows"], ["K-2"])
        p = self.change(self.K1, self.K2, {**self.K3, "stage": "作業中"})   # apps/web の試験を持つチケットの行だけ（K-2 は比べる元のまま）
        self.assertTrue(p["jobs"]["web"])
        self.assertEqual(p["web_ticket_rows"], ["K-3"])

    def test_K156_CI_054_added_removed_and_unreadable(self) -> None:
        p = self.change(self.K1, self.K2, self.K3, {"id": "K-4", "screens": ["today"], "tests": []})   # 足した画面のチケット
        self.assertEqual(p["web_ticket_rows"], ["K-4"])
        self.assertTrue(p["jobs"]["web"])
        p = self.change(self.K1, self.K2)   # 比べる元（K-1・K-2・K-3）から、画面の試験を持つ K-3 を消した
        self.assertEqual(p["web_ticket_rows"], ["K-3"])
        self.assertTrue(p["jobs"]["web"])
        self.r.commit("K-1 docs: 壊れた一覧", **{"11_tickets__tickets.json": "{ 壊れた\n", "11_tickets__K-1.md": k107.ticket("K-1", [])})
        self.r.base = k107.git(self.r.dir, "rev-parse", "HEAD~1")
        p = self.plan()
        self.assertTrue(p["jobs"]["web"])            # 読めないなら流す（安全な側）
        self.assertEqual(p["web_ticket_rows"], ["?"])

    def test_K156_CI_055_real_rules(self) -> None:
        real = ci_scope.load_rules(str(ROOT / "scripts/ci/ci_scope.json"))
        self.assertNotIn("11_tickets/tickets.json", real["jobs"]["web"]["paths"])
        self.assertEqual(real["jobs"]["web"]["ticket_rows"], TICKET_ROWS)
        bad = copy.deepcopy(k107.RULES)
        bad["jobs"]["web"]["ticket_rows"] = {"file": 1}
        d = pathlib.Path(tempfile.mkdtemp(prefix="k156-"))
        try:
            (d / "r.json").write_text(json.dumps(bad), encoding="utf-8")
            with self.assertRaises(ValueError):
                ci_scope.load_rules(str(d / "r.json"))
        finally:
            shutil.rmtree(d, ignore_errors=True)


class FullScopeBaseTest(k107.Base):
    def test_K156_CI_046_full_scope_without_base_does_not_break(self) -> None:
        self.r.commit("K-1 feat: mig", packages__a__migrations__0002_sql="select 2;\n", packages__a__src__index_ts=k107.MIG2,
                      **{"11_tickets__K-1.md": k107.ticket("K-1", ["a"], ["db"])})
        for base in ("", "zzz"):
            p = self.r.plan(scope="full", base=base)
            self.assertEqual(p["mode"], "full")
            self.assertEqual(p["base"], "")
            self.assertEqual(p["migration_files"], [])

    def test_K156_CI_047_run_squawk_command(self) -> None:
        import contextlib, io
        from unittest import mock
        for base, want in (("", "比べる元が無い"), ("2b53f5e30d59b3523fd2391ce434931bb07b7c8a", "変えた migration が無い（比べる元 2b53f5e30d）")):
            out = io.StringIO()
            with mock.patch.dict(os.environ, {"CI_MIGRATION_FILES": "[]", "CI_BASE": base}), contextlib.redirect_stdout(out):
                rc = ci_scope.main(["run-squawk"])
            self.assertEqual(rc, 0)
            self.assertIn(want, out.getvalue())


class DbRangeLayerTest(unittest.TestCase):
    """G27 の DB の層は DB を触った回だけ（決める人 2026-11-10 answer=d72d35c329ba・D-133.6）"""

    DB_CMD = "bash -c 'pnpm exec vitest run packages/db/test'"

    def cfg(self, layers: list[dict]) -> dict:
        return {"decision_traceability": {"products": [], "sources": [{"file": ""}]}, "layer_checks": layers}

    def runner(self, calls: list[str]):
        def run(cmd, **kw):
            calls.append(cmd)
            return subprocess.CompletedProcess(cmd, 0, "ok\n", "")
        return run

    def test_K156_CI_056_db_layer_runs_only_in_db_range(self) -> None:
        layers = [{"file": "packages/db/migrations/*.sql", "check": self.DB_CMD, "db": True},
                  {"file": "b.json", "check": "python3 scripts/ci/b.py"}]
        calls: list[str] = []
        rows, bad = layer_audit.audit(self.cfg(layers), True, runner=self.runner(calls), db_range=False)
        self.assertEqual(calls, ["python3 scripts/ci/b.py"])          # DB の層は流さない
        self.assertEqual(bad, 0)
        self.assertEqual(rows[1]["kind"], "範囲")
        self.assertIn("DB の範囲を触っていない", rows[1]["result"])
        self.assertNotIn("ran", rows[1])
        calls = []
        rows, bad = layer_audit.audit(self.cfg(layers), True, runner=self.runner(calls), db_range=True)
        self.assertEqual(calls, ["python3 scripts/ci/b.py", self.DB_CMD])   # 触った回（と全部の回）は今までどおり流す
        self.assertEqual(bad, 0)
        self.assertEqual(rows[1]["result"], "OK")
        calls = []
        layer_audit.audit(self.cfg(layers), True, runner=self.runner(calls))   # 既定は流す（安全な側）
        self.assertIn(self.DB_CMD, calls)
        rows, bad = layer_audit.audit(self.cfg([{"file": "c.sql", "check": self.DB_CMD, "db": "yes"}]), True,
                                      runner=self.runner([]), db_range=False)
        self.assertEqual(bad, 1)                                        # db は真偽だけ（形の誤りで流さないことにしない）
        self.assertEqual(rows[0]["kind"], "無")

    def test_K156_CI_057_main_db_range_flag(self) -> None:
        import contextlib, io
        from unittest import mock
        d = pathlib.Path(tempfile.mkdtemp(prefix="k156-"))
        cwd = os.getcwd()
        try:
            (d / "log.md").write_text("<!-- decision: D-001\n     status: confirmed -->\n", encoding="utf-8")
            cfg = self.cfg([{"file": "x.sql", "check": "python3 -c \"print('db-ran')\"", "db": True}])
            cfg["decision_traceability"]["sources"] = [{"file": "log.md"}]
            (d / "map.yaml").write_text(json.dumps(cfg, ensure_ascii=False), encoding="utf-8")
            os.chdir(d)

            def run(*extra: str) -> tuple[int, str]:
                out = io.StringIO()
                with mock.patch.object(sys, "argv", ["layer_audit.py", "--map", "map.yaml", "--run", *extra]), contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
                    try:
                        rc = layer_audit.main()
                    except SystemExit as e:
                        rc = e.code
                return rc, out.getvalue()

            rc, out = run("--db-range", "false")
            self.assertEqual(rc, 0, out)
            self.assertIn("DB の範囲を触っていない", out)
            self.assertIn("流した命令 0", out)
            for extra in (("--db-range", "true"), ("--db-range", ""), ()):
                rc, out = run(*extra)
                self.assertEqual(rc, 0, out)
                self.assertIn("流した命令 1", out, extra)
            rc, out = run("--db-range", "yes")
            self.assertEqual(rc, 2, out)
            self.assertIn("--db-range", out)
        finally:
            os.chdir(cwd)
            shutil.rmtree(d, ignore_errors=True)

    def test_K156_CI_059_real_db_layers_and_workflow(self) -> None:
        import yaml
        cfg = yaml.safe_load((ROOT / "spec-dependencies.yaml").read_text(encoding="utf-8"))
        uses_db = [l for l in cfg["layer_checks"] if not l.get("elsewhere")
                   and ("DATABASE_URL" in str(l.get("check", "")) or "packages/db/test" in str(l.get("check", "")))]
        self.assertGreaterEqual(len(uses_db), 2)                        # migrations と policies の 2 層（2026-11-10）
        self.assertEqual([l["file"] for l in uses_db if l.get("db") is not True], [])
        spec = yaml.safe_load((ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8"))["jobs"]["spec"]
        g27 = [s for s in spec["steps"] if str(s.get("name", "")).startswith("G27 ")]
        self.assertEqual(len(g27), 1)
        self.assertIn("steps.scope.outputs.db_range", str((g27[0].get("env") or {}).get("CI_DB_RANGE", "")))
        self.assertIn("--db-range", g27[0]["run"])
        self.assertIn("CI_DB_RANGE", g27[0]["run"])


class DbRangePlanTest(k107.Base):
    """範囲の答えの db_range（G27 が読む）"""

    def test_K156_CI_058_plan_db_range(self) -> None:
        self.r.commit("K-1 feat: x", apps__x__src__main_ts="export const x = 6;\n", **{"11_tickets__K-1.md": k107.ticket("K-1", ["x"])})
        p = self.r.plan()
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertIs(p["db_range"], False)
        self.assertEqual(ci_scope.outputs(p)["db_range"], "false")
        self.r.base = k107.git(self.r.dir, "rev-parse", "HEAD")
        self.r.commit("K-1 feat: mig", packages__a__migrations__0002_sql="select 2;\n", packages__a__src__index_ts=k107.MIG2,
                      **{"11_tickets__K-1.md": k107.ticket("K-1", ["a"], ["db"])})
        p = self.r.plan()
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertIs(p["db_range"], True)
        self.assertEqual(ci_scope.outputs(p)["db_range"], "true")
        p = self.r.plan(scope="full")                                    # 全部の回は真（全部流す）
        self.assertIs(p["db_range"], True)
        self.assertEqual(ci_scope.outputs(p)["db_range"], "true")


class DateOnlyTest(unittest.TestCase):
    """作り手が今日の日付を書くので、取り込みの前に作り直すと生成物が日付だけ変わる（テスター Q 回 2）。
    日付だけの違いは範囲に数えない（generated_gate.py と同じ伏せ方）"""

    FEAT = '{"generated_at": "2026-11-09", "items": [1, 2]}\n'

    def setUp(self) -> None:
        self.r = SpecRepo()
        self.r.commit("K-0 chore: 日付つきの生成物", **{"07_functional__features_json": self.FEAT})
        self.r.base = k107.git(self.r.dir, "rev-parse", "HEAD")
        self.rules = copy.deepcopy(SPEC_RULES)
        self.rules["db"]["paths"] = list(self.rules["db"]["paths"]) + ["07_functional/features.json"]

    def tearDown(self) -> None:
        self.r.close()

    def plan(self) -> dict:
        return ci_scope.plan(str(self.r.dir), self.r.base, "HEAD", "auto", rules=self.rules, tickets_dir=str(self.r.dir / "11_tickets"),
                             list_tests=lambda files: {f: [] for f in files}, db_tests=lambda: ["packages/a/test/rows.test.ts"])

    def test_K156_CI_060_date_only_generated_is_not_counted(self) -> None:
        self.r.commit("K-3 docs: 作り直し", **{"07_functional__features_json": self.FEAT.replace("2026-11-09", "2026-11-10T01:02:03Z")})
        p = self.plan()
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertEqual(p["date_only"], ["07_functional/features.json"])
        self.assertIs(p["db_range"], False)                     # DB の範囲の生成物でも、日付だけなら DB の範囲にしない
        self.assertEqual(p["jobs"], {"unit": False, "database": False, "web": False})
        self.assertEqual(p["spec_only"], [])
        self.assertTrue(any("日付だけ" in x and "07_functional/features.json" in x for x in p["reasons"]), p["reasons"])

    def test_K156_CI_061_real_change_besides_date_is_counted(self) -> None:
        self.r.commit("K-3 docs: 中身", **{"07_functional__features_json": self.FEAT.replace("2026-11-09", "2026-11-10").replace("[1, 2]", "[1, 2, 3]")})
        p = self.plan()
        self.assertEqual(p["date_only"], [])
        self.assertIs(p["db_range"], True)

    def test_K156_CI_062_non_generated_or_added_is_not_dropped(self) -> None:
        # 生成物でないファイルは日付だけでも外さない・足した生成物（M でない）も外さない
        self.r.commit("K-0 chore: 文書", **{"03_architecture__a_md": "決めた日 2026-11-09\n"})
        self.r.base = k107.git(self.r.dir, "rev-parse", "HEAD")
        self.r.commit("K-3 docs: 日付", **{"03_architecture__a_md": "決めた日 2026-11-10\n", "07_functional__new_json": '{"d": "2026-11-10"}\n'})
        p = self.plan()
        self.assertEqual(p["date_only"], [])
        self.assertIn("03_architecture/a.md", p["spec_only"])
        self.assertIn("07_functional/new.json", p["spec_only"])
        import generated_gate  # noqa: PLC0415
        self.assertEqual(ci_scope.DATE.pattern, generated_gate.DATE.pattern)   # 伏せ方は generated_gate と同じ（ずれたら赤）


if __name__ == "__main__":
    unittest.main(verbosity=2)
