#!/usr/bin/env python3
"""K-246 の試験：口（kaname-api）の関数の設定（.vc-config.json）に処理の場所を書く。行 ID は K246-FC-NNN。
口は Build Output API の形を組み立ての台本（apps/api/build-vercel.mjs）が自分で作るので、関数の場所は
関数の設定 .vc-config.json の regions で決まる（vercel.json の regions は、この形では効かなかった・配った後の頭が hnd1::iad1）。
台本を実際に流し（esbuild で 1 秒ほど）、出力を読む。staging にはつながない。チケットの CI（G65）で流れる"""
from __future__ import annotations

import json
import pathlib
import re
import shutil
import subprocess
import tempfile
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "apps" / "api" / "build-vercel.mjs"
OUT = ROOT / "apps" / "api" / ".vercel" / "output"
VC = OUT / "functions" / "api.func" / ".vc-config.json"
ROUTES = OUT / "config.json"
CONFIG = ROOT / "scripts" / "ci" / "staging_region.json"       # 処理の場所の決まり（1 か所・K-212）
API_VJ = ROOT / "apps" / "api" / "vercel.json"
STAGING_MD = ROOT / "infra" / "STAGING.md"
GATE = ROOT / ".github" / "workflows" / "v3-gate.yml"
REGION_CODE = re.compile(r"^[a-z]{3}[0-9]$")
# 前と同じでなければいけない欄（場所の 1 欄を足すだけ）
UNCHANGED = {"runtime": "nodejs22.x", "handler": "index.mjs", "launcherType": "Nodejs",
             "shouldAddHelpers": False, "maxDuration": 60}


def load(path: pathlib.Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def build(*args: str) -> subprocess.CompletedProcess[str]:
    node = shutil.which("node")
    if node is None:
        raise AssertionError("node が無い（組み立ての台本を流せない）")
    return subprocess.run([node, str(SCRIPT), *args], cwd=ROOT, capture_output=True, text=True, timeout=180)


_OUT_EXISTED = OUT.exists()


def tearDownModule() -> None:
    # 試験の前に出力が無かったなら消して終わる（.gitignore 済みだが、eslint は .vercel を外していないので、残すと手元の lint が赤になる）
    if not _OUT_EXISTED:
        shutil.rmtree(OUT.parent, ignore_errors=True)


class FunctionConfig(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def built(self, *args: str) -> dict:
        r = build(*args)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertTrue(VC.is_file(), "関数の設定 .vc-config.json ができる")
        return load(VC)

    def test_K246_FC_001_regions_from_config(self) -> None:
        want = load(CONFIG)["function_region"]
        vc = self.built()
        self.assertEqual(vc.get("regions"), [want], "関数の場所は決まりのファイルと同じ 1 つ（Hobby は 1 か所だけ）")

    def test_K246_FC_002_other_fields_unchanged(self) -> None:
        vc = self.built()
        self.assertEqual({k: vc.get(k) for k in UNCHANGED}, UNCHANGED, "runtime・handler・launcherType・helpers・maxDuration は前のまま")
        self.assertEqual(sorted(vc), sorted([*UNCHANGED, "regions"]), "足すのは regions だけ（memory・architecture などを増やさない）")

    def test_K246_FC_003_routes_unchanged(self) -> None:
        self.built()
        self.assertEqual(load(ROUTES), {"version": 3, "routes": [{"src": "/(.*)", "dest": "/api"}]},
                         "道の設定（全部の道を関数 1 本へ）は前のまま")

    def test_K246_FC_004_bad_config_stops_build(self) -> None:
        before = self.built()
        stamp = VC.stat().st_mtime_ns
        d = pathlib.Path(self.tmp.name)
        (d / "broken.json").write_text("{", encoding="utf-8")
        (d / "empty.json").write_text("{}", encoding="utf-8")
        (d / "shape.json").write_text(json.dumps({"function_region": "Tokyo"}), encoding="utf-8")
        (d / "list.json").write_text(json.dumps({"function_region": ["hnd1"]}), encoding="utf-8")
        cases = {"無い": d / "none.json", "JSON でない": d / "broken.json", "場所が無い": d / "empty.json",
                 "場所の形でない": d / "shape.json", "文字列でない": d / "list.json"}
        for label, path in cases.items():
            with self.subTest(label):
                r = build("--region-config", str(path))
                self.assertNotEqual(r.returncode, 0, "決まりが読めないのに、既定の場所（米国東部）で組み立てを終えない")
                self.assertIn("処理の場所の決まり", r.stdout + r.stderr, "何で止まったかを出す")
                self.assertEqual(VC.stat().st_mtime_ns, stamp, "決まりを読む前に前の出力を消さない・書かない")
                self.assertEqual(load(VC), before)

    def test_K246_FC_005_reads_given_config(self) -> None:
        other = pathlib.Path(self.tmp.name) / "kix.json"
        other.write_text(json.dumps({"function_region": "kix1"}), encoding="utf-8")
        try:
            vc = self.built("--region-config", str(other))
            self.assertEqual(vc.get("regions"), ["kix1"], "渡した決まりの場所がそのまま出る（台本は場所を持たず、決まりを読む）")
        finally:
            self.built()   # 出力を本物の決まりの版に戻す

    def test_K246_FC_006_no_region_literal_in_script(self) -> None:
        src = SCRIPT.read_text(encoding="utf-8")
        lits = [m for m in re.findall(r"""["'`]([a-z0-9]+)["'`]""", src) if REGION_CODE.match(m)]
        self.assertEqual(lits, [], "組み立ての台本に場所の符号（hnd1 など）を直に書かない（決まりのファイルだけが持つ）")
        self.assertNotIn(load(CONFIG)["function_region"], src)
        self.assertIn("staging_region.json", src, "既定の決まりの置き場を台本が知っている（1 か所から読む）")

    def test_K246_FC_007_no_contradiction_with_vercel_json_and_docs(self) -> None:
        want = load(CONFIG)["function_region"]
        api = load(API_VJ)
        if "regions" in api:
            self.assertEqual(api["regions"], [want], "残すなら、口の vercel.json の場所も決まりと同じ（食い違わせない）")
        vc = self.built()
        self.assertEqual(vc["regions"], [want])
        lines = [ln for ln in STAGING_MD.read_text(encoding="utf-8").splitlines() if ".vc-config.json" in ln]
        self.assertTrue(any("口" in ln and "build-vercel.mjs" in ln for ln in lines),
                        "手順書に、口の場所は関数の設定（build-vercel.mjs が書く .vc-config.json）が正、の行が在る")

    def test_K246_FC_008_ci_runs_this(self) -> None:
        wf = yaml.safe_load(GATE.read_text(encoding="utf-8"))
        hits = [s for j in wf["jobs"].values() for s in j.get("steps", [])
                if "python3 scripts/ci/k246_function_config_test.py" in str(s.get("run", ""))]
        self.assertEqual(len(hits), 1, "この試験が CI の段 1 つで流れる（G65 の並び）")
        run = str(hits[0].get("run", ""))
        self.assertNotIn("continue-on-error", hits[0])
        self.assertNotIn("|| true", run)
        self.assertIn("python3 scripts/ci/k212_function_region_test.py", run,
                      "前の健康診断の項目と場所の決まりの試験（K-212）も同じ回で流れたまま")


if __name__ == "__main__":
    unittest.main(verbosity=2)
