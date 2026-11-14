#!/usr/bin/env python3
"""K-97 の試験：組み立てた Bridge の輪を、staging を指す統合テストの回と手元で使えるようにする。行 ID は K97-BB-NNN。
見るのは CI の定義・立ち上げの台本・Bridge の輪の読み込みの形。組み立てそのもの（tsc）は CI の回が流す"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "apps" / "bridge" / "src"
BUILD = r"pnpm (-s )?--filter @kaname/bridge (run )?build\b"
RUN = r"pnpm (-s )?e2e:staging\b"


def steps(name: str, job: str) -> list[dict]:
    return yaml.safe_load((ROOT / ".github/workflows" / name).read_text(encoding="utf-8"))["jobs"][job]["steps"]


def find(st: list[dict], pattern: str) -> list[int]:
    return [i for i, s in enumerate(st) if re.search(pattern, str(s.get("run", "")))]


def reach(start: str) -> set[str]:
    """start（src の中の名前）から、相対の import を辿って届く src のファイル"""
    seen, todo = set(), [start]
    while todo:
        name = todo.pop()
        if name in seen:
            continue
        seen.add(name)
        text = (SRC / name).read_text(encoding="utf-8")
        for m in re.finditer(r"""(?:from|import\(|import|require\()\s*["'](\.{1,2}/[^"']+)["']""", text):
            target = (SRC / name).parent / m.group(1)
            for cand in (target.with_suffix(".ts"), target / "index.ts"):
                if cand.is_file() and SRC in cand.parents:
                    todo.append(str(cand.relative_to(SRC)))
    return seen


class BridgeBuild(unittest.TestCase):
    def test_K97_BB_001_built_before_journeys(self) -> None:
        st = steps("staging-e2e.yml", "e2e")
        build, run, health = find(st, BUILD), find(st, RUN), find(st, r"scripts/ci/staging_health\.py")
        self.assertEqual(len(build), 1, "組み立ての段は 1 つ")
        self.assertLess(build[0], run[0], "統合テストの前に組み立てる")
        self.assertLess(build[0], health[0], "健康診断（秘密を持つ段）より前：staging や secrets がまだでも、Linux で組み立てが通るかが見える")
        self.assertNotIn("if", st[build[0]], "条件を付けて飛ばさない（統合テストが 0 本の回でも組み立てる）")
        self.assertNotIn("env", st[build[0]], "組み立ての段に環境の値（秘密）を渡さない")
        self.assertNotRegex(str(st[build[0]]["run"]), r"\btsc\b|electron-builder", "配布と同じ build の命令をそのまま使う（写しを書かない・包まない）")
        self.assertNotIn("continue-on-error", st[build[0]])

    def test_K97_BB_002_checked_without_electron(self) -> None:
        st = steps("staging-e2e.yml", "e2e")
        build, run = find(st, BUILD)[0], find(st, RUN)[0]
        check = [i for i in find(st, r"apps/bridge/dist/loop\.js") if build < i < run]
        self.assertTrue(check, "組み立ての後・統合テストの前に、できた物を確かめる")
        for i in check:
            for key in ("if", "continue-on-error", "shell", "env"):
                self.assertNotIn(key, st[i], f"確かめの段に {key} を付けない（飛ばす・落ちても進む・秘密を渡す）")
        lines = [x.strip() for i in check for x in str(st[i]["run"]).splitlines() if x.strip()]
        cmd = "\n".join(lines)
        for f in ("loop.js", "runner.js", "pairing.js"):
            self.assertRegex(cmd, rf"test -f apps/bridge/dist/{re.escape(f)}", f"{f} が在る")
        for line in lines:
            self.assertNotRegex(line, r";|\|\|", f"; や || でつなぐと、前の確かめの赤が消える：{line}")
        node = [x for x in lines if x.startswith("node -e")]
        self.assertEqual(len(node), 1, "窓（Electron）なしの node で輪を読む行が 1 つ")
        self.assertRegex(node[0], r"require\(.*apps/bridge/dist/loop\.js.*\)\.startLoop", "輪の入口 startLoop を読む")
        self.assertRegex(node[0], r"typeof .*!==\s*.function.", "関数であることを確かめる")
        self.assertIn("process.exit(1)", node[0], "違えば 0 以外で終わる（読んだだけで 0 にしない）")

    def test_K97_BB_003_same_command_in_dev_up(self) -> None:
        up = (ROOT / "scripts/dev/up.sh").read_text(encoding="utf-8")
        hit = [x for x in up.splitlines() if re.search(BUILD, x)]
        self.assertEqual(len(hit), 1, "手元の立ち上げでも同じ命令で組み立てる（1 行）")
        self.assertNotRegex(hit[0], r"\|\|\s*(true|:)|2>\s*/dev/null\s*$", "組み立ての失敗を黙って通さない")
        self.assertRegex(hit[0], r"^\S", "字下げなし＝ if の外（「画面がもう動いている」の回でも組み立てる）")
        self.assertRegex(hit[0], r"exit 1", "失敗したら立ち上げを止める")

    def test_K97_BB_004_loop_does_not_need_electron(self) -> None:
        # process.versions["electron"] を見るだけの行は当てない（node でも動く分かれ道）。当てるのは部品の import と require
        files = reach("loop.ts") | reach("pairing.ts")
        self.assertIn("runner.ts", files)
        self.assertGreaterEqual(len(files), 10, "輪から届くファイルを辿れている（辿れずに 0 件で緑、を防ぐ）")
        bad = [f for f in sorted(files)
               if re.search(r"""(?:from|import\(|import|require\()\s*["']electron(-updater)?["']""", (SRC / f).read_text(encoding="utf-8"))]
        self.assertEqual(bad, [], "輪（loop・pairing から届くファイル）が Electron の部品を import する：Linux の台の node で動かない")

    def test_K97_BB_005_ticket_ci_stays_light(self) -> None:
        text = (ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8")
        self.assertNotRegex(text, BUILD, "ふだんのチケットの CI では組み立てない（要る試験は staging の回と手元だけ）")

    def test_K97_BB_006_dist_not_committed(self) -> None:
        out = subprocess.run(["git", "-C", str(ROOT), "ls-files", "-z", "apps/bridge/dist"], capture_output=True).stdout
        self.assertEqual(out, b"", "組み立てた物をコミットしない")

    def test_K97_BB_007_build_is_the_release_build(self) -> None:
        pkg = json.loads((ROOT / "apps/bridge/package.json").read_text(encoding="utf-8"))
        self.assertIn("build", pkg["scripts"])
        rel = (ROOT / "apps/bridge/scripts/release.mjs").read_text(encoding="utf-8")
        self.assertRegex(rel, r"""run\("pnpm",\s*\["-s",\s*"build"\]\)""", "配布の台本が同じ build を流す（CI だけ別の作り方にならない）")


if __name__ == "__main__":
    unittest.main(verbosity=2)
