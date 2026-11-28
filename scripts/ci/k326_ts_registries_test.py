#!/usr/bin/env python3
"""K-326 の試験：口の登録の一覧（apps/api/src/hooks/all.generated.ts）と閉じる道（packages/auth/src/disabled-paths.generated.ts）の作り手。

  python3 scripts/ci/k326_ts_registries_test.py      行 ID は K326-GEN-NNN（チケット 11_tickets/K-326.md の表の行と 1 対 1）

一時の根を作って作り手と fuzz_targets.py を流す（DB なし）。GEN-001・005 の後半・006 は本物のリポジトリを読む。
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ci"))
GEN = ROOT / "scripts" / "ci" / "gen_ts_registries.py"
FUZZ = ROOT / "scripts" / "ci" / "fuzz_targets.py"
OUTS = ["apps/api/src/hooks/all.generated.ts", "packages/auth/src/disabled-paths.generated.ts"]

REGISTRY = 'export function defineHooks(m) { return m; }\n'


def hook_file(name: str, fuzz: str = '"same"', register: bool = True) -> str:
    body = f'export function {name}Hooks(d) {{ return {{}}; }}\n'
    if register:
        body += (f'export const register = defineHooks({{ name: "{name}Hooks", '
                 f'make: (d) => {name}Hooks(d), fuzz: {fuzz} }});\n')
    return body


class Tree(unittest.TestCase):
    def setUp(self) -> None:
        self._t = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self._t.name)
        self.hooks = self.root / "apps/api/src/hooks"
        self.parts = self.root / "packages/auth/src/disabled-paths.d"
        self.hooks.mkdir(parents=True)
        self.parts.mkdir(parents=True)
        (self.hooks / "registry.ts").write_text(REGISTRY, encoding="utf-8")

    def tearDown(self) -> None:
        self._t.cleanup()

    def gen(self) -> subprocess.CompletedProcess[str]:
        return subprocess.run([sys.executable, str(GEN), "--root", str(self.root)], capture_output=True, text=True)

    def last(self, r: subprocess.CompletedProcess[str]) -> str:
        return (r.stdout + r.stderr).strip().splitlines()[-1]

    def test_K326_GEN_002_modules_in_file_name_order(self) -> None:
        (self.hooks / "b.ts").write_text(hook_file("b"), encoding="utf-8")
        (self.hooks / "a.ts").write_text(hook_file("a"), encoding="utf-8")
        (self.hooks / "two-step.ts").write_text(hook_file("twoStep"), encoding="utf-8")
        r = self.gen()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        out = (self.root / OUTS[0]).read_text(encoding="utf-8")
        self.assertLess(out.index('"./a.js"'), out.index('"./b.js"'))
        reg_lines = [line for line in out.splitlines() if "register as" in line]
        self.assertEqual(len(reg_lines), 3, reg_lines)
        self.assertFalse([line for line in reg_lines if "registry" in line], reg_lines)
        self.assertIn('import { register as twoStep } from "./two-step.js"', out)
        mods = out[out.index("HOOK_MODULES"):]
        self.assertRegex(mods, r"\[\s*a\s*,\s*b\s*,\s*twoStep\s*,?\s*\]")
        self.assertIn("手で直さない", out.splitlines()[0])

    def test_K326_GEN_003_hook_file_without_register_stops(self) -> None:
        (self.hooks / "a.ts").write_text(hook_file("a"), encoding="utf-8")
        (self.hooks / "c.ts").write_text(hook_file("c", register=False), encoding="utf-8")
        r = self.gen()
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("c.ts", self.last(r))
        self.assertFalse((self.root / OUTS[0]).exists())

    def test_K326_GEN_004_disabled_path_fragments(self) -> None:
        (self.hooks / "a.ts").write_text(hook_file("a"), encoding="utf-8")
        (self.parts / "K-1.ts").write_text('export const PATHS = ["/x"] as const;\n', encoding="utf-8")
        (self.parts / "K-2.ts").write_text('export const PATHS = ["/x"] as const;\n', encoding="utf-8")
        r = self.gen()
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        for word in ("K-1.ts", "K-2.ts", "/x"):
            self.assertIn(word, self.last(r))
        (self.parts / "K-2.ts").unlink()
        (self.parts / "extra.ts").write_text('export const PATHS = ["/y"] as const;\n', encoding="utf-8")
        r = self.gen()
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("extra.ts", self.last(r))

    def test_K326_GEN_005_fuzz_skip_needs_reason(self) -> None:
        (self.hooks / "a.ts").write_text(hook_file("a", fuzz='{ skip: "" }'), encoding="utf-8")
        r = subprocess.run([sys.executable, str(FUZZ), "--root", str(self.root)], capture_output=True, text=True)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("a.ts", r.stdout + r.stderr)
        r = subprocess.run([sys.executable, str(FUZZ)], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("PASS", r.stdout)


class More(Tree):
    def test_K326_GEN_007_disabled_path_fragment_is_imported(self) -> None:
        (self.hooks / "a.ts").write_text(hook_file("a"), encoding="utf-8")
        (self.parts / "K-12.ts").write_text('export const PATHS = ["/k326-probe"] as const;\n', encoding="utf-8")
        r = self.gen()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        out = (self.root / OUTS[1]).read_text(encoding="utf-8")
        self.assertIn('import { PATHS as k12 } from "./disabled-paths.d/K-12.js"', out)
        self.assertRegex(out, r"FRAGMENT_DISABLED_PATHS\s*=\s*\[\s*\.\.\.k12\s*,?\s*\]")

    def test_K326_GEN_008_shared_operation_needs_replaces(self) -> None:
        (self.hooks / "a.ts").write_text(hook_file("a"), encoding="utf-8")
        both = 'export function xHooks(p) {\n  return {\n    getK326: { ...h["getK326"] },\n  };\n}\n'
        (self.hooks / "x.ts").write_text(both + 'export const register = defineHooks({ name: "xHooks", make: (d) => xHooks(d), fuzz: "same" });\n', encoding="utf-8")
        (self.hooks / "y.ts").write_text(both.replace("xHooks", "yHooks") + 'export const register = defineHooks({ name: "yHooks", make: (d) => yHooks(d), fuzz: "same" });\n', encoding="utf-8")
        r = self.gen()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        r = subprocess.run([sys.executable, str(FUZZ), "--root", str(self.root)], capture_output=True, text=True)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("getK326", r.stdout)
        (self.hooks / "y.ts").write_text(both.replace("xHooks", "yHooks") + 'export const register = defineHooks({ name: "yHooks", make: (d) => yHooks(d), fuzz: "same", replaces: ["getK326"] });\n', encoding="utf-8")
        r = subprocess.run([sys.executable, str(FUZZ), "--root", str(self.root)], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)


class Repo(unittest.TestCase):
    def test_K326_GEN_001_generated_files_match(self) -> None:
        r = subprocess.run([sys.executable, str(GEN), "--check"], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_K326_GEN_006_registered(self) -> None:
        gen = json.loads((ROOT / "scripts/ci/generated.json").read_text(encoding="utf-8"))
        mine = [g for g in gen["generators"] if "gen_ts_registries.py" in g["run"]]
        self.assertEqual(len(mine), 1)
        self.assertEqual(sorted(mine[0]["outputs"]), sorted(OUTS))
        flow = yaml.safe_load((ROOT / "ticket-flow.yaml").read_text(encoding="utf-8"))
        for rel in OUTS:
            self.assertIn(rel, flow["changes_ignore"])
        import cut_check  # noqa: PLC0415
        self.assertTrue(cut_check._common("apps/api/src/hooks/all.generated.ts"))
        self.assertTrue(cut_check._common("packages/auth/src/disabled-paths.d/K-1.ts"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
