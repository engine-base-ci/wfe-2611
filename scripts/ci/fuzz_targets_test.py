#!/usr/bin/env python3
"""fuzz_targets.py（契約の fuzz・G36 の的に、本物のサーバーが差している hooks が全部入っているか）の試験（K-62・K-134 を戻した分）。
行 ID（K62-CI-…）は 11_tickets/K-62.md の表に結ぶ。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
K-326（2026-11-18）で、本物のサーバーと的が同じ一覧（apps/api/src/hooks/all.generated.ts）から差す形に替わったので、
比べる物を「server.ts と的の文字」から「hooks のファイルの register の fuzz」に替えた（行 ID と見たいこと＝的に入らない口を名指しで赤、は同じ）。

試験が決める形（scripts/ci/fuzz_targets.py）:
  check(root: Path, exempt: dict[str, str] | None = None) -> list[str]
    root/apps/api/src/hooks/*.ts（registry.ts と *.generated.ts を除く）で `export function <名前>Hooks(` を持つファイルを工場とし、
    各ファイルの `export const register = defineHooks({ … fuzz: … })` の fuzz を読んで、問題の一覧を返す（空なら緑）。
    ・register が無い工場は赤（本物のサーバーにも的にも差さらない）。工場の口の名前（`名前: { ...h["名前"] }`）も出す
    ・fuzz が { skip: "<理由>" } の工場は、理由があれば外してよい。理由が空なら赤
    ・exempt に {} を渡すと、skip も外してよい物と数えない（全部の工場が的に入ることを求める）
    ・作り手の一覧（all.generated.ts）に入っていない register・hooks のフォルダが無い は赤（黙って緑にしない）
  python3 scripts/ci/fuzz_targets.py [--root DIR] [--no-exempt]：問題があれば名指しして exit 1、無ければ PASS と数
使い方: python3 scripts/ci/fuzz_targets_test.py
"""
import re, subprocess, sys, tempfile, unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import contextlib, io  # noqa: E402
from fuzz_targets import check, main, modules  # noqa: E402


def hook(name: str, ops: list[str], fuzz: str = '"same"', register: bool = True) -> str:
    body = f"export function {name}Hooks(p) {{\n  return {{\n"
    body += "".join(f'    {op}: {{ ...h["{op}"] }},\n' for op in ops)
    body += "  };\n}\n"
    if register:
        body += f'export const register = defineHooks({{ name: "{name}Hooks", make: (d) => {name}Hooks(d), fuzz: {fuzz} }});\n'
    return body


HOOKS = {
    "agent.ts": hook("agent", ["sayToAgent"]),
    "tickets.ts": hook("ticket", ["createTicket", "getTicket"]),
    "delegate.ts": hook("delegate", ["delegateTicket", "takeBridgeJob"]),
}
ALL = """// 生成物・手で直さない（scripts/ci/gen_ts_registries.py）
import type { HookModule } from "./registry.js";
import { register as agent } from "./agent.js";
import { register as delegate } from "./delegate.js";
import { register as tickets } from "./tickets.js";
export const HOOK_MODULES: readonly HookModule[] = [agent, delegate, tickets];
"""


class FuzzTargetsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.write("apps/api/src/hooks/registry.ts", "export function defineHooks(m) { return m; }\n")
        self.write("apps/api/src/hooks/all.generated.ts", ALL)
        for name, src in HOOKS.items():
            self.write(f"apps/api/src/hooks/{name}", src)

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, rel, src):
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(src, encoding="utf-8")

    def test_K62_CI_001_real_repo_has_every_built_hook_in_the_fuzz_target(self):
        """K62-CI-001 本物の作業場所：どの工場も register を持ち、的から外すのは理由つきの skip だけ"""
        self.assertEqual(check(ROOT), [])
        for m in modules(ROOT):
            if m["skip"] is not None:
                self.assertTrue(m["skip"].strip(), f"{m['factory']} を外す理由が空")

    def test_K62_CI_002_missing_hook_is_red_and_names_its_operations(self):
        """K62-CI-002 delegateHooks を的から外している（skip）のに、外してよい物と数えない（exempt={}）：赤。工場の名前と口の名前を出す"""
        self.write("apps/api/src/hooks/delegate.ts", hook("delegate", ["delegateTicket", "takeBridgeJob"], fuzz='{ skip: "訳" }'))
        problems = check(self.root, exempt={})
        self.assertEqual(len(problems), 1, problems)
        self.assertIn("delegateHooks", problems[0])
        self.assertIn("delegateTicket", problems[0])
        self.assertIn("takeBridgeJob", problems[0])

    def test_K62_CI_003_new_factory_in_server_but_not_in_fuzz_is_red(self):
        """K62-CI-003 口の工場を作ったのに register が無い（本物のサーバーにも的にも差さらない）：赤"""
        self.write("apps/api/src/hooks/bridge.ts", hook("bridge", ["sendHeartbeat"], register=False))
        problems = check(self.root, exempt={})
        self.assertTrue(any("bridgeHooks" in p and "sendHeartbeat" in p for p in problems), problems)

    def test_K62_CI_004_exemption_needs_a_reason(self):
        """K62-CI-004 外す工場は理由が要る：理由が空なら赤、理由があれば緑"""
        self.write("apps/api/src/hooks/delegate.ts", hook("delegate", ["delegateTicket"], fuzz='{ skip: "  " }'))
        self.assertTrue(check(self.root))
        self.write("apps/api/src/hooks/delegate.ts", hook("delegate", ["delegateTicket"], fuzz='{ skip: "試験の理由（偽のセッションでは回せない）" }'))
        self.assertEqual(check(self.root), [])

    def test_K62_CI_005_stale_exemption_is_red(self):
        """K62-CI-005 作り手の一覧が古い（hooks のファイルの register が一覧に入っていない）：赤"""
        self.write("apps/api/src/hooks/bridge.ts", hook("bridge", ["sendHeartbeat"]))
        problems = check(self.root)
        self.assertTrue(any("bridge.ts" in p and "all.generated.ts" in p for p in problems), problems)

    def test_K62_CI_006_fuzz_target_has_k57_k60_k62_hooks(self):
        """K62-CI-006 fuzz の的に K-57（bridgeHooks）・K-60（ticketHooks）・K-62（delegateHooks）が入る（skip にしない）"""
        by = {m["factory"]: m for m in modules(ROOT)}
        for name in ("bridgeHooks", "ticketHooks", "delegateHooks"):
            self.assertIn(name, by, f"{name} の register が無い")
            self.assertIsNone(by[name]["skip"], f"{name} を的から外している")

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
        self.write("apps/api/src/hooks/tickets.ts", hook("ticket", ["createTicket"], register=False))
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
        """K62-CI-009 検査の本体（main）：赤なら 1 件ずつ「NG」と件数を出して 1、緑なら工場の数（的に差す・理由つきで外す）を出して 0"""
        self.write("apps/api/src/hooks/delegate.ts", hook("delegate", ["delegateTicket", "takeBridgeJob"], fuzz='{ skip: "訳" }'))
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = main(["--root", str(self.root), "--no-exempt"])
        self.assertEqual(code, 1)
        self.assertIn("[fuzz-targets] NG delegateHooks", out.getvalue())
        self.assertIn("delegateTicket・takeBridgeJob", out.getvalue())
        self.assertIn("FAIL — 1 件", out.getvalue())
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = main(["--root", str(self.root)])
        self.assertEqual(code, 0, out.getvalue())
        self.assertIn("PASS — 工場 3 個（的に差す 2・理由つきで外す 1）", out.getvalue())

    def test_K62_CI_010_unreadable_ops_still_names_the_factory(self):
        """K62-CI-010 hooks のフォルダが無い：赤にする（黙って緑にしない）"""
        import shutil
        shutil.rmtree(self.root / "apps/api/src/hooks")
        problems = check(self.root, exempt={})
        self.assertEqual(len(problems), 1, problems)
        self.assertIn("apps/api/src/hooks", problems[0])


if __name__ == "__main__":
    unittest.main(verbosity=2)
