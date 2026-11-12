#!/usr/bin/env python3
"""K-172 の試験：CI を ticket-flow の形にする（自分の Mac の台・DB は組の中で・重い検査もチケットの範囲だけ・JUnit の記録）。

  python3 scripts/ci/k172_ci_shape_test.py

行 ID は K172-CI-NNN（11_tickets/K-172.md の表と 1 対 1）。作り手（05_flow/build_testplan.py）が作った workflow と、
範囲の台本（scripts/ci/ci_scope.py）・JUnit の台本（scripts/ci/junit_unittest.py）を確かめる。
"""
from __future__ import annotations

import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import ci_scope  # noqa: E402

WF_TEXT = (ROOT / ".github" / "workflows" / "v3-gate.yml").read_text(encoding="utf-8")
WF = yaml.safe_load(WF_TEXT)
JOBS = WF["jobs"]
ON = WF.get("on", WF.get(True))   # YAML 1.1 は on を真偽に読むことがある
UNIT = [f"unit-{i}" for i in range(1, 7)]
DB_JOBS = ["database", "spec", "web"] + UNIT
JUNIT_JOBS = UNIT + ["spec", "web"]
RELEASE = yaml.safe_load((ROOT / ".github" / "workflows" / "release-gate.yml").read_text(encoding="utf-8"))["jobs"]
# 重い検査は組と名前の頭で特定する（G27 の番号は static にも別の段がある）
HEAVY = {"27": ("spec", "G27 層の棚卸し"), "36": ("database", "G36 "), "38": ("spec", "G38 "), "47": ("spec", "G47 "),
         "56": ("spec", "G56 "), "57": ("spec", "G57 "), "62": ("spec", "G62 ")}


def steps(job: str) -> list[dict]:
    return JOBS[job].get("steps", [])


def text(job: str) -> str:
    return yaml.safe_dump(JOBS[job], allow_unicode=True)


class Shape(unittest.TestCase):
    def test_K172_CI_001_all_jobs_on_self_hosted_mac(self):
        for name, job in list(JOBS.items()) + [(f"release-gate/{k}", v) for k, v in RELEASE.items()]:
            with self.subTest(name):
                self.assertEqual(job["runs-on"], ["self-hosted", "macOS"])

    def test_K172_CI_002_db_in_job_free_port_waited_and_always_removed(self):
        self.assertIsNone(re.search(r"localhost:54\d\d", WF_TEXT), "DB の番号を直書きしない")
        for name in DB_JOBS:
            with self.subTest(name):
                job = JOBS[name]
                self.assertNotIn("services", job)
                self.assertNotIn("DATABASE_URL", job.get("env") or {}, "DATABASE_URL は GITHUB_ENV だけで渡す")
                start = [s for s in steps(name) if "docker run" in str(s.get("run", ""))]
                stop = [s for s in steps(name) if "docker rm -f" in str(s.get("run", ""))]
                self.assertEqual(len(start), 1, "DB を立てる段が 1 つ")
                run = start[0]["run"]
                self.assertIn("github.run_id", run + str(start[0].get("env", "")), "容れ物の名前に回の印")
                self.assertIn("github.job", run + str(start[0].get("env", "")), "容れ物の名前に組の印")
                self.assertIn("127.0.0.1::5432", run, "番号は空いているもの")
                self.assertIn("pg_isready", run, "立ち上がりを待つ")
                self.assertRegex(run, r"exit 1", "時間切れは赤")
                self.assertIn("GITHUB_ENV", run)
                self.assertEqual(len(stop), 1, "DB を消す段が 1 つ")
                self.assertEqual(stop[0].get("if"), "always()", "赤でも必ず消す")
                self.assertGreater(steps(name).index(stop[0]), steps(name).index(start[0]))

    def test_K172_CI_003_no_setup_python_no_pip_uses_venv(self):
        for name in JOBS:
            with self.subTest(name):
                t = text(name)
                self.assertNotIn("actions/setup-python", t)
                self.assertNotIn("pip install", t)
                if "python3" in t:
                    self.assertIn("ci_venv.sh", t, "Python の部品は台に置いた venv")
        venv = (HERE / "ci_venv.sh").read_text(encoding="utf-8")
        self.assertIn("GITHUB_PATH", venv)

    def test_K172_CI_004_dispatch_inputs_and_target_fallback(self):
        inputs = ON["workflow_dispatch"]["inputs"]
        self.assertEqual(set(inputs["scope"]["options"]), {"ticket", "full"})
        for k in ("ticket", "base", "target"):
            self.assertIn(k, inputs)
        for m in re.finditer(r"inputs\.target[^}]*", WF_TEXT):
            self.assertIn("default_branch", m.group(0), "target が空なら既定の枝")

    def test_K172_CI_005_junit_from_every_test_job_merged_even_when_red(self):
        for name in JUNIT_JOBS:
            with self.subTest(name):
                up = [s for s in steps(name) if "upload-artifact" in str(s.get("uses", ""))
                      and str((s.get("with") or {}).get("name", "")).startswith("junit-")]
                self.assertEqual(len(up), 1, "組ごとに junit-<組> を出す")
                self.assertIn("always()", str(up[0].get("if")))
                self.assertEqual(up[0]["with"].get("if-no-files-found"), "error", "記録が空なら赤")
        self.assertIn("junit", text("spec"))
        self.assertIn("junit_unittest.py", text("spec"))
        self.assertIn("PLAYWRIGHT_JUNIT_OUTPUT_NAME", text("web"))
        unit_cmd = " ".join(ci_scope.unit_argv(["a.test.ts"], 1, 6, []))
        self.assertIn("--reporter=junit", unit_cmd)
        self.assertIn("--outputFile.junit=", unit_cmd)
        merge = JOBS["junit"]
        self.assertTrue(set(JUNIT_JOBS) <= set(merge["needs"]), "まとめる組は JUnit を出す組を全部待つ")
        self.assertIn("always()", str(merge.get("if")))
        m = [s for s in merge["steps"] if "upload-artifact/merge" in str(s.get("uses", ""))]
        self.assertEqual((m[0]["with"]["name"], m[0]["with"]["pattern"]), ("junit", "junit-*"))

    def test_K172_CI_006_heavy_gates_only_when_relevant_on_ticket_scope(self):
        for g, (job, prefix) in HEAVY.items():
            with self.subTest(g):
                hits = [s for s in steps(job) if str(s.get("name", "")).startswith(prefix)]
                self.assertEqual(len(hits), 1, f"{job} の {prefix} が 1 つ")
                cond = str(hits[0].get("if", ""))
                self.assertIn("!cancelled()", cond, "前の段が赤でも流す")
                self.assertIn(".full == 'true'", cond, "scope=full では必ず流す")
                self.assertIn(f"',{g},'", cond, "scope=ticket では gates に入っているときだけ")
                src = re.search(r"(steps\.scope|needs\.static)\.outputs\.gates", cond)
                self.assertIsNotNone(src, "gates の出所")
                if src.group(1) == "steps.scope":
                    self.assertTrue(any(s.get("id") == "scope" for s in steps(job)), "同じ組に scope の段がある")
                else:
                    self.assertIn("gates", JOBS["static"]["outputs"], "static の出力に gates がある")


class JUnitRunner(unittest.TestCase):
    def run_junit(self, body: str, name="x_test.py"):
        d = pathlib.Path(tempfile.mkdtemp(prefix="k172-"))
        self.addCleanup(shutil.rmtree, d, True)
        t = d / name
        t.write_text(body, encoding="utf-8")
        out = d / "py.xml"
        r = subprocess.run([sys.executable, str(HERE / "junit_unittest.py"), "--out", str(out), str(t)], capture_output=True, text=True)
        cases = {tc.get("name"): [c.tag for c in tc] for tc in ET.parse(out).getroot().iter("testcase")}
        return r.returncode, cases

    def test_K172_CI_007_unittest_to_junit_with_row_ids(self):
        rc, cases = self.run_junit("import unittest\nclass T(unittest.TestCase):\n    def test_K9_CI_001_ok(self):\n        pass\n")
        self.assertEqual(rc, 0, "全部通れば 0")
        self.assertEqual([v for k, v in cases.items() if "K9_CI_001" in k], [[]])
        rc, cases = self.run_junit("import unittest\nclass T(unittest.TestCase):\n"
                                   "    def test_K9_CI_002_bad(self):\n        self.fail('落ちた')\n"
                                   "    def test_K9_CI_003_boom(self):\n        raise RuntimeError('x')\n"
                                   "    @unittest.skip('後で')\n    def test_K9_CI_004_skip(self):\n        pass\n")
        self.assertEqual(rc, 1, "落ちたら 1")
        tags = {k.split(".")[-1]: v for k, v in cases.items()}
        self.assertIn("failure", tags["test_K9_CI_002_bad"])
        self.assertIn("error", tags["test_K9_CI_003_boom"])
        self.assertIn("skipped", tags["test_K9_CI_004_skip"])
        rc, cases = self.run_junit("import no_such_module_k172\n")
        self.assertEqual(rc, 1, "読み込めないファイルは 1")
        self.assertTrue(any("error" in v for v in cases.values()))


class ScopeScript(unittest.TestCase):
    """範囲の台本：作りものの git の写しで plan を流す"""

    def setUp(self):
        self.rules = json.loads((ROOT / "scripts" / "ci" / "ci_scope.json").read_text(encoding="utf-8"))
        self.d = pathlib.Path(tempfile.mkdtemp(prefix="k172-repo-"))
        self.addCleanup(shutil.rmtree, self.d, True)
        env = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.invalid",
               "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.invalid"}
        self.g = lambda *a: subprocess.run(["git", "-C", str(self.d), *a], check=True, capture_output=True, text=True, env=env).stdout.strip()
        self.g("init", "-q", "-b", "main")
        (self.d / "README.md").write_text("x\n")
        self.g("add", "-A"); self.g("commit", "-qm", "K-0 chore: 土台")
        self.base = self.g("rev-parse", "HEAD")

    def commit(self, msg: str, files: dict) -> None:
        for k, v in files.items():
            p = self.d / k
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(v)
        self.g("add", "-A"); self.g("commit", "-qm", msg)

    def plan(self, scope="ticket", ticket=""):
        return ci_scope.plan(str(self.d), self.base, "HEAD", scope, self.rules, str(self.d / "11_tickets"),
                             lambda files: {f: [] for f in files}, lambda: [], ticket=ticket)

    def test_K172_CI_008_gates_for_changed_files(self):
        self.assertEqual(sorted(self.rules["gates"]), sorted(HEAVY), "重い検査は全部、関係するファイルを持つ")
        self.assertIn("57", ci_scope.gates_for(["scripts/ci/ci_scope.py"], self.rules, full=False))
        self.assertNotIn("57", ci_scope.gates_for(["apps/web/app/page.tsx"], self.rules, full=False))
        self.assertEqual(set(ci_scope.gates_for([], self.rules, full=True)), set(HEAVY))
        self.assertEqual(ci_scope.gates_for(["README.md"], self.rules, full=False), [])
        self.commit("K-9 chore: 範囲", {"scripts/ci/ci_scope.py": "# x\n", "11_tickets/K-9.md": "---\nid: K-9\naffects: []\nci_wide: []\ntests: []\n---\n"})
        out = ci_scope.outputs(self.plan())
        self.assertIn(",57,", out["gates"])

    def test_K172_CI_009_scope_ticket_like_auto_and_unknown_stops(self):
        self.commit("K-9 docs: 文", {"README.md": "y\n", "11_tickets/K-9.md": "---\nid: K-9\naffects: []\nci_wide: []\ntests: []\n---\n"})
        self.assertEqual(self.plan("ticket")["mode"], "scoped")
        p = self.plan("x")
        self.assertEqual(p["mode"], "scoped")
        self.assertTrue(any("全部には倒さず止める" in e for e in p["errors"]), p["errors"])

    def test_K172_CI_010_ticket_input_must_match_commits(self):
        self.commit("K-9 docs: 文", {"README.md": "y\n", "11_tickets/K-9.md": "---\nid: K-9\naffects: []\nci_wide: []\ntests: []\n---\n"})
        self.assertEqual(self.plan(ticket="K-9")["errors"], [])
        p = self.plan(ticket="K-8")
        self.assertTrue(any("K-8" in e and "全部には倒さず止める" in e for e in p["errors"]), p["errors"])

    def test_K172_CI_011_ticket_python_tests_are_output(self):
        self.commit("K-9 test: 試験", {"scripts/ci/k9_test.py": "import unittest\n",
                                       "11_tickets/K-9.md": "---\nid: K-9\naffects: []\nci_wide: []\ntests: [scripts/ci/k9_test.py]\n---\n"})
        out = ci_scope.outputs(self.plan(ticket="K-9"))
        self.assertIn("scripts/ci/k9_test.py", json.loads(out["py_tests"]))
        scope = [s for s in steps("spec") if s.get("id") == "scope"]
        self.assertEqual(len(scope), 1)
        self.assertIn("ci_scope.py", scope[0]["run"])
        run = [s for s in steps("spec") if "py_tests" in str(s.get("env", ""))]
        self.assertEqual(len(run), 1, "py_tests を読む段は 1 つ")
        self.assertIn("steps.scope.outputs.py_tests", str(run[0]["env"]))
        self.assertIn("scripts/ci/junit_unittest.py", run[0]["run"])
        self.assertIn("CI_PY_TESTS", run[0]["run"], "読んだ py_tests を junit_unittest.py に渡す")
        self.assertIn("!cancelled()", str(run[0].get("if")))


class WebCleanup(unittest.TestCase):
    def test_K172_CI_012_web_cleans_up_and_no_shared_tmp(self):
        self.assertNotIn("/tmp/", WF_TEXT, "回の間の物は $RUNNER_TEMP に置く")
        web = JOBS["web"]
        self.assertIn("group", web.get("concurrency") or {}, "web の組は同時に 1 つ")
        stop = [s for s in steps("web") if "kill" in str(s.get("run", ""))]
        self.assertEqual(len(stop), 1)
        self.assertEqual(stop[0].get("if"), "always()")


ALL_WF = {n: yaml.safe_load((ROOT / ".github" / "workflows" / n).read_text(encoding="utf-8")) for n in ("v3-gate.yml", "release-gate.yml")}


class TicketInput(unittest.TestCase):
    def test_K172_CI_013_every_step_using_ticket_input_has_it_in_env(self):
        seen = 0
        for wf, doc in ALL_WF.items():
            for job, j in doc["jobs"].items():
                for s in j.get("steps", []):
                    if "$CI_TICKET_INPUT" in str(s.get("run", "")):
                        seen += 1
                        env = {**(j.get("env") or {}), **(s.get("env") or {})}   # 組の env でも段の env でもよい
                        self.assertIn("CI_TICKET_INPUT", env, f"{wf} {job} {s.get('name')}")
                        self.assertIn("inputs.ticket", str(env["CI_TICKET_INPUT"]))
        self.assertGreaterEqual(seen, 2, "static の G0 と spec の分かれ目")


def fake_bin(d: pathlib.Path, name: str, body: str) -> None:
    f = d / name
    f.write_text("#!/usr/bin/env bash\n" + body)
    f.chmod(0o755)


def gone(pid: int, secs: float = 3.0) -> bool:
    import time
    t = time.time() + secs
    while time.time() < t:
        st = subprocess.run(["ps", "-o", "stat=", "-p", str(pid)], capture_output=True, text=True).stdout.strip()
        if not st or st.startswith("Z"):   # 居ない・引き取られる前のゾンビ
            return True
        time.sleep(0.1)
    return False


class KillTree(unittest.TestCase):
    def test_K172_CI_014_kill_tree_stops_grandchildren_and_ports_checked(self):
        import time
        tmp = pathlib.Path(tempfile.mkdtemp())
        g = 0
        try:
            pidf = tmp / "p.pid"
            # 親 → 子 → 孫（pnpm → node → next-server の形）
            p = subprocess.Popen(["bash", "-c", "bash -c 'sleep 300 & echo $! > " + str(tmp / "g.pid") + "; wait' & wait"])
            pidf.write_text(str(p.pid))
            for _ in range(50):
                if (tmp / "g.pid").exists() and (tmp / "g.pid").read_text().strip():
                    break
                time.sleep(0.1)
            g = int((tmp / "g.pid").read_text())
            r = subprocess.run(["bash", str(HERE / "kill_tree.sh"), str(pidf)], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            p.wait(timeout=10)
            self.assertTrue(gone(g), "孫が残った")
        finally:
            if g:
                subprocess.run(["kill", "-9", str(g)], capture_output=True)
            shutil.rmtree(tmp, ignore_errors=True)

    def test_K172_CI_014_stop_step_uses_started_pid_files_and_is_red_when_port_left(self):
        web = steps("web")
        runs = "\n".join(str(st.get("run", "")) for st in web)   # 段の命令そのもの（YAML に書き直すと長い行が折れる）
        written = set(re.findall(r"echo \$! > \$RUNNER_TEMP/(\w+\.pid)", runs))
        self.assertEqual(written, {"api.pid", "web.pid"}, "起動の段が書く pid のファイル")
        stop = [s for s in web if "kill_tree.sh" in str(s.get("run", ""))]
        self.assertEqual(len(stop), 1)
        self.assertEqual(stop[0].get("if"), "always()")
        run = stop[0]["run"]
        self.assertEqual(set(re.findall(r"\$RUNNER_TEMP/(\w+\.pid)", run)), written, "止める段が同じ pid のファイルを渡す")
        # 段をそのまま動かす：lsof を偽物にし、番号が残っていれば赤・空いていれば緑
        for busy, want in (("3124", 1), ("", 0)):
            tmp = pathlib.Path(tempfile.mkdtemp())
            try:
                fake_bin(tmp, "lsof", f'[ "$2" = "tcp:{busy}" ] && {{ echo 999; exit 0; }}; exit 1\n' if busy else "exit 1\n")
                env = {**os.environ, "PATH": f"{tmp}:{os.environ['PATH']}", "RUNNER_TEMP": str(tmp)}
                r = subprocess.run(["bash", "-e", "-c", run], cwd=ROOT, env=env, capture_output=True, text=True)
                self.assertEqual(r.returncode, want, f"番号 {busy or 'なし'}：{r.stdout}{r.stderr}")
            finally:
                shutil.rmtree(tmp, ignore_errors=True)


class VenvLock(unittest.TestCase):
    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp())
        self.venv = self.tmp / "venv"
        self.lock = pathlib.Path(str(self.venv) + ".lock")
        self.req = self.tmp / "req.txt"

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def env(self, wait: str = "60") -> dict:
        return {**os.environ, "KANAME_CI_VENV": str(self.venv), "KANAME_CI_REQ": str(self.req),
                "KANAME_CI_LOCK_WAIT": wait, "GITHUB_PATH": str(self.tmp / "gp")}

    def sh(self, wait: str = "60", **kw):
        return subprocess.Popen(["bash", str(HERE / "ci_venv.sh")], env=self.env(wait), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, **kw)

    def test_K172_CI_015_concurrent_venv_setup_is_serialized(self):
        self.req.write_text("# 空（網に出ない）\n")
        ps = [self.sh() for _ in range(4)]
        for p in ps:
            o, e = p.communicate(timeout=300)
            self.assertEqual(p.returncode, 0, e)
        r = subprocess.run([str(self.venv / "bin" / "python3"), "-c", "print(1)"], capture_output=True, text=True)
        self.assertEqual(r.stdout.strip(), "1")
        self.assertFalse(self.lock.exists(), "ロックが残らない")

    def test_K172_CI_015_waits_for_lock_held_by_live_owner(self):
        self.req.write_text("# 空\n")
        self.lock.mkdir(parents=True)
        (self.lock / "pid").write_text(str(os.getpid()))   # 持ち主は生きている（この試験）
        p = self.sh(wait="2")
        o, e = p.communicate(timeout=60)
        self.assertNotEqual(p.returncode, 0, "生きた持ち主のロックは取らない（待ちの上限で赤）")
        self.assertFalse(self.venv.exists(), "ロックを取れないうちは venv に触らない")

    def test_K172_CI_015_rechecks_stamp_after_lock(self):
        import hashlib
        import time
        # 入れようとすれば網に出て落ちる一覧。先に入れた組の印があれば入れ直さない＝0 で終わる
        self.req.write_text("kaname-no-such-package-zzz==0.0.0\n")
        self.lock.mkdir(parents=True)
        (self.lock / "pid").write_text(str(os.getpid()))
        p = self.sh(wait="60")
        time.sleep(1.0)
        self.assertIsNone(p.poll(), "ロックを待っている")
        subprocess.run([sys.executable, "-m", "venv", str(self.venv)], check=True)
        (self.venv / ".requirements.sha").write_text(hashlib.sha256(self.req.read_bytes()).hexdigest() + "\n")
        shutil.rmtree(self.lock)
        o, e = p.communicate(timeout=60)
        self.assertEqual(p.returncode, 0, e)

    def test_K172_CI_015_takes_over_lock_of_dead_owner(self):
        self.req.write_text("# 空\n")
        dead = subprocess.Popen(["true"])
        dead.wait()
        self.lock.mkdir(parents=True)
        (self.lock / "pid").write_text(str(dead.pid))   # 台が落ちた組の残したロック
        p = self.sh(wait="20")
        o, e = p.communicate(timeout=120)
        self.assertEqual(p.returncode, 0, e)
        self.assertFalse(self.lock.exists())


class DbSweep(unittest.TestCase):
    def test_K172_CI_016_sweep_only_old_kaname_ci_containers(self):
        import importlib
        sweep = importlib.import_module("ci_db_sweep")
        now = 1_000_000_000.0
        h = 3600
        got = sweep.stale([("kaname-ci-1-1-unit-1", now - 7 * h), ("kaname-ci-2-1-web", now - 1 * h),
                           ("kaname-pg", now - 100 * h), ("kaname-ci-3-1-spec", now - 7 * h)],
                          now=now, hours=6, keep="kaname-ci-3-1-spec")
        self.assertEqual(got, ["kaname-ci-1-1-unit-1"])
        for job in DB_JOBS:
            start = [s for s in steps(job) if "docker run" in str(s.get("run", ""))]
            run = start[0]["run"]
            self.assertIn("ci_db_sweep.py", run, job)
            self.assertLess(run.index("ci_db_sweep.py"), run.index("docker run"), f"{job}：立てる前に消す")

    def test_K172_CI_016_cli_reads_docker_times_and_removes_only_old(self):
        import datetime as dt
        now = dt.datetime.now(dt.timezone.utc)
        iso = lambda d: (now - d).strftime("%Y-%m-%dT%H:%M:%S.123456789Z")
        tmp = pathlib.Path(tempfile.mkdtemp())
        try:
            log = tmp / "rm.log"
            fake_bin(tmp, "docker", f"""case "$1" in
  ps) printf 'a1\\na2\\na3\\n' ;;
  inspect) printf '/kaname-ci-9-1-unit-1 {iso(dt.timedelta(hours=7))}\\n/kaname-ci-8-1-web {iso(dt.timedelta(hours=1))}\\n/kaname-ci-7-1-spec {iso(dt.timedelta(hours=9))}\\n' ;;
  rm) echo "$@" >> "{log}" ;;
esac
""")
            env = {**os.environ, "PATH": f"{tmp}:/usr/bin:/bin"}
            r = subprocess.run([sys.executable, str(HERE / "ci_db_sweep.py"), "--keep", "kaname-ci-7-1-spec"], env=env, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertEqual(log.read_text().split(), ["rm", "-f", "kaname-ci-9-1-unit-1"], "7 時間前の物だけ（UTC で読む）")
            # docker が無い台・docker が落ちている台では消さずに 0（DB を立てる段で赤になる）
            for body in (None, "exit 1\n"):
                d = tmp / ("none" if body is None else "down")
                d.mkdir()
                if body is not None:
                    fake_bin(d, "docker", body)
                r = subprocess.run([sys.executable, str(HERE / "ci_db_sweep.py")], env={**os.environ, "PATH": f"{d}:/usr/bin:/bin"}, capture_output=True, text=True)
                self.assertEqual(r.returncode, 0, r.stderr)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

class PnpmPerRunner(unittest.TestCase):
    def test_K172_CI_017_pnpm_setup_dest_is_per_runner(self):
        seen = 0
        for wf, doc in ALL_WF.items():
            for job, j in doc["jobs"].items():
                for st in j.get("steps", []):
                    if str(st.get("uses", "")).startswith("pnpm/action-setup"):
                        seen += 1
                        dest = str((st.get("with") or {}).get("dest", ""))
                        self.assertIn("runner.tool_cache", dest, f"{wf} {job}：台で共有の ~/setup-pnpm を使うと、同時の組がぶつかる")
        self.assertGreater(seen, 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
