#!/usr/bin/env python3
"""fuzz_targets.py（契約の fuzz・G36 の的に、本物のサーバーが差している hooks が全部入っているか）の試験（K-62・K-134 を戻した分）。
行 ID（K62-CI-…）は 11_tickets/K-62.md の表に結ぶ。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。

試験が決める形（scripts/ci/fuzz_targets.py）:
  check(root: Path, exempt: dict[str, str] | None = None) -> list[str]
    root/apps/api/src/server.ts の contract の hooks に広げた工場（`...<名前>Hooks(`）と、
    root/apps/api/test/fuzz/server.ts が差した工場（`<名前>Hooks(`）を比べ、問題の一覧を返す（空なら緑）。
    ・本物のサーバーにあって的に無い工場は赤。工場の口の名前（root/apps/api/src/hooks/*.ts の `名前: { ...h["名前"] }`）も出す
    ・exempt（工場の名前 → 理由）に載せた工場は外してよい。理由が空なら赤・本物のサーバーに無い工場を載せていたら赤（古い）
    exempt を渡さなければ、fuzz_targets.py の EXEMPT を使う
  python3 scripts/ci/fuzz_targets.py：問題があれば名指しして exit 1、無ければ PASS と数
使い方: python3 scripts/ci/fuzz_targets_test.py
"""
import re, subprocess, sys, tempfile, unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import contextlib, io  # noqa: E402
from fuzz_targets import EXEMPT, check, main  # noqa: E402

SERVER = """import { agentHooks } from "./hooks/agent.js";
import { ticketHooks } from "./hooks/tickets.js";
import { delegateHooks } from "./hooks/delegate.js";
export function boot() {
  return createApp({
    contract: {
      hooks: {
        ...agentHooks(appPool),
        ...ticketHooks(appPool),
        ...delegateHooks(appPool),
      },
    },
  });
}
"""
FUZZ = """import { agentHooks } from "../../src/hooks/agent.js";
import { ticketHooks } from "../../src/hooks/tickets.js";
import { delegateHooks } from "../../src/hooks/delegate.js";
Object.assign(h.hooks, agentHooks(h.pool), ticketHooks(h.pool), delegateHooks(h.pool));
"""
HOOKS = {
    "agent.ts": 'export function agentHooks(p) {\n  return {\n    sayToAgent: { ...h["sayToAgent"] },\n  };\n}\n',
    "tickets.ts": 'export function ticketHooks(p) {\n  return {\n    createTicket: { ...h["createTicket"] },\n    getTicket: { ...h["getTicket"] },\n  };\n}\n',
    "delegate.ts": 'export function delegateHooks(p) {\n  return {\n    delegateTicket: { ...h["delegateTicket"] },\n    takeBridgeJob: { ...h["takeBridgeJob"] },\n  };\n}\n',
}


class FuzzTargetsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.write("apps/api/src/server.ts", SERVER)
        self.write("apps/api/test/fuzz/server.ts", FUZZ)
        for name, src in HOOKS.items():
            self.write(f"apps/api/src/hooks/{name}", src)

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, rel, src):
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(src, encoding="utf-8")

    def test_K62_CI_001_real_repo_has_every_built_hook_in_the_fuzz_target(self):
        """K62-CI-001 本物の作業場所：本物のサーバーが差す hooks が全部 fuzz の的に入っている（外すのは理由つきの EXEMPT だけ）"""
        self.assertEqual(check(ROOT), [])
        for name, why in EXEMPT.items():
            self.assertTrue(why.strip(), f"{name} を外す理由が空")

    def test_K62_CI_002_missing_hook_is_red_and_names_its_operations(self):
        """K62-CI-002 的が delegateHooks を差していない：赤。工場の名前と口の名前（delegateTicket・takeBridgeJob）を出す"""
        self.write("apps/api/test/fuzz/server.ts", FUZZ.replace(", delegateHooks(h.pool)", ""))
        problems = check(self.root, exempt={})
        self.assertEqual(len(problems), 1, problems)
        self.assertIn("delegateHooks", problems[0])
        self.assertIn("delegateTicket", problems[0])
        self.assertIn("takeBridgeJob", problems[0])

    def test_K62_CI_003_new_factory_in_server_but_not_in_fuzz_is_red(self):
        """K62-CI-003 口を作って本物のサーバーにだけ足した（的に足し忘れ）：赤"""
        self.write("apps/api/src/hooks/bridge.ts", 'export function bridgeHooks(d) {\n  return {\n    sendHeartbeat: { ...h["sendHeartbeat"] },\n  };\n}\n')
        self.write("apps/api/src/server.ts", SERVER.replace("...delegateHooks(appPool),", "...delegateHooks(appPool),\n        ...bridgeHooks({ appPool }),"))
        problems = check(self.root, exempt={})
        self.assertTrue(any("bridgeHooks" in p and "sendHeartbeat" in p for p in problems), problems)

    def test_K62_CI_004_exemption_needs_a_reason(self):
        """K62-CI-004 外す工場は理由が要る：理由が空なら赤、理由があれば緑"""
        self.write("apps/api/test/fuzz/server.ts", FUZZ.replace(", delegateHooks(h.pool)", ""))
        self.assertTrue(check(self.root, exempt={"delegateHooks": "  "}))
        self.assertEqual(check(self.root, exempt={"delegateHooks": "試験の理由（偽のセッションでは回せない）"}), [])

    def test_K62_CI_005_stale_exemption_is_red(self):
        """K62-CI-005 本物のサーバーに無い工場を外す台帳に残している（古い）：赤"""
        problems = check(self.root, exempt={"goneHooks": "もう無い口の理由"})
        self.assertTrue(any("goneHooks" in p for p in problems), problems)

    def test_K62_CI_006_fuzz_target_has_k57_k60_k62_hooks(self):
        """K62-CI-006 fuzz の的に K-57（bridgeHooks）・K-60（ticketHooks）・K-62（delegateHooks）が差してある（外す台帳にも載せない）"""
        src = (ROOT / "apps/api/test/fuzz/server.ts").read_text(encoding="utf-8")
        for name in ("bridgeHooks", "ticketHooks", "delegateHooks"):
            self.assertRegex(src, rf"\b{name}\(", f"{name} が的に無い")
            self.assertNotIn(name, EXEMPT)

    def test_K62_CI_007_check_is_wired_into_ci(self):
        """K62-CI-007 検査が CI から回る：fuzz.sh が的を立てる前に fuzz_targets.py を流し、workflow がこの試験を流す"""
        sh = (ROOT / "scripts/ci/fuzz.sh").read_text(encoding="utf-8")
        i_check = sh.find("scripts/ci/fuzz_targets.py")
        i_server = sh.find("apps/api/test/fuzz/server.ts &")
        self.assertGreaterEqual(i_check, 0, "fuzz.sh が fuzz_targets.py を流していない")
        self.assertLess(i_check, i_server if i_server >= 0 else len(sh), "的を立てる前に流す")
        wf = (ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8")
        self.assertRegex(wf, r"python3 scripts/ci/fuzz_targets_test\.py")

    def test_K62_CI_008_cli_names_the_missing_and_exits_1(self):
        """K62-CI-008 コマンドで流すと、足りない工場を名指しして exit 1（緑なら PASS と数）"""
        self.write("apps/api/test/fuzz/server.ts", FUZZ.replace(", ticketHooks(h.pool)", ""))
        r = subprocess.run(
            [sys.executable, str(HERE / "fuzz_targets.py"), "--root", str(self.root), "--no-exempt"],
            capture_output=True, text=True,
        )
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("ticketHooks", r.stdout + r.stderr)
        ok = subprocess.run([sys.executable, str(HERE / "fuzz_targets.py"), "--root", str(ROOT)], capture_output=True, text=True)
        self.assertEqual(ok.returncode, 0, ok.stdout + ok.stderr)
        self.assertTrue(re.search(r"PASS", ok.stdout), ok.stdout)

    def test_K62_CI_009_main_prints_ng_lines_and_counts(self):
        """K62-CI-009 検査の本体（main）：赤なら 1 件ずつ「NG」と件数を出して 1、緑なら工場の数（的に差した・理由つきで外す）を出して 0"""
        self.write("apps/api/test/fuzz/server.ts", FUZZ.replace(", delegateHooks(h.pool)", ""))
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = main(["--root", str(self.root), "--no-exempt"])
        self.assertEqual(code, 1)
        self.assertIn("[fuzz-targets] NG delegateHooks", out.getvalue())
        self.assertIn("delegateTicket・takeBridgeJob", out.getvalue())
        self.assertIn("FAIL — 1 件", out.getvalue())
        self.write("apps/api/test/fuzz/server.ts", FUZZ)
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = main(["--root", str(self.root), "--no-exempt"])
        self.assertEqual(code, 0, out.getvalue())
        self.assertIn("PASS — 本物のサーバーの工場 3 個（的に差した 3・理由つきで外す 0）", out.getvalue())

    def test_K62_CI_010_unreadable_ops_still_names_the_factory(self):
        """K62-CI-010 口の名前を読めない（apps/api/src/hooks が無い）ときも、足りない工場の名前で赤にする（黙って緑にしない）"""
        import shutil
        shutil.rmtree(self.root / "apps/api/src/hooks")
        self.write("apps/api/test/fuzz/server.ts", FUZZ.replace(", ticketHooks(h.pool)", ""))
        problems = check(self.root, exempt={})
        self.assertEqual(len(problems), 1, problems)
        self.assertIn("ticketHooks", problems[0])
        self.assertIn("口の名前を読めなかった", problems[0])


if __name__ == "__main__":
    unittest.main(verbosity=2)
