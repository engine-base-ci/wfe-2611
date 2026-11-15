#!/usr/bin/env python3
"""K-212 の試験：staging の口と画面の処理（Vercel の Function）を、DB と同じ場所（東京・hnd1）で動かす設定と、健康診断の 1 項目。行 ID は K212-FR-NNN。
staging そのものにはつながない：健康診断は K-200 の試験の作りものの口と画面（127.0.0.1）に当てる。設定は字を読むだけ。チケットの CI（G65）で流れる"""
from __future__ import annotations

import json
import pathlib
import re
import sys
import tempfile
import unittest

import yaml

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from k200_staging_health_test import ALL, Fake, clean, run  # noqa: E402 — 作りものの口と呼び方は K-200 の試験の物を使う（同じ形で 2 つ作らない）

ROOT = pathlib.Path(__file__).resolve().parents[2]
CONFIG = ROOT / "scripts" / "ci" / "staging_region.json"     # 処理の場所の決まり（1 か所）
API_VJ = ROOT / "apps" / "api" / "vercel.json"
WEB_VJ = ROOT / "apps" / "web" / "vercel.json"
STAGING_MD = ROOT / "infra" / "STAGING.md"
STACK = ROOT / "02_tech_stack" / "selected-stack.json"
GATE = ROOT / ".github" / "workflows" / "v3-gate.yml"
TOKYO = "hnd1"                       # Vercel の地域の一覧で ap-northeast-1（東京）。Supabase の DB と同じ場所
REQ_ID = "k212reqid-0123456789"      # 答えの頭の要求の番号の作りもの。出力に出してはいけない
REGION_CODE = re.compile(r"^[a-z]{3}[0-9]$")


def load(path: pathlib.Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


class FunctionRegion(unittest.TestCase):
    def setUp(self) -> None:
        self.fakes: list[Fake] = []
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def tearDown(self) -> None:
        for f in self.fakes:
            f.close()

    def fake(self, **cfg) -> Fake:
        f = Fake(**cfg)
        self.fakes.append(f)
        return f

    def two(self, api: Fake, web: Fake) -> dict[str, str]:
        return {"STAGING_API_BASE": api.url, "STAGING_BASE_URL": web.url}

    def applied(self) -> list[str]:
        f = pathlib.Path(self.tmp.name) / "applied.json"
        f.write_text(json.dumps(ALL), encoding="utf-8")
        return ["--applied", str(f)]

    def vid(self, region: str) -> str:
        return f"hnd1::{region}::{REQ_ID}"

    # ── 設定（字を読む）──────────────────────────────────────────

    def test_K212_FR_001_config_and_api_vercel_json(self) -> None:
        cfg = load(CONFIG)
        self.assertEqual(cfg, {"function_region": TOKYO}, "決まりは処理の場所 1 つだけ（東京）")
        api = load(API_VJ)
        self.assertEqual(api.get("regions"), [cfg["function_region"]], "口の処理の場所が決まりと同じ 1 つ（Hobby は 1 か所だけ）")
        self.assertNotIn("functionFailoverRegions", api, "予備の場所の指定は Enterprise だけ（入れると配りが止まる）")
        self.assertNotIn("functions", api, "関数ごとの場所の上書きを置かない（全部を決まりの場所に）")
        # 今の組み立ての決まりは変えない（場所の 1 行を足すだけ）
        self.assertIsNone(api.get("framework"))
        self.assertEqual(api.get("installCommand"), "cd ../.. && pnpm install --frozen-lockfile")
        self.assertEqual(api.get("buildCommand"), "cd ../.. && pnpm db:migrate && pnpm provision:bucket && node apps/api/build-vercel.mjs")

    def test_K212_FR_002_web_vercel_json(self) -> None:
        self.assertTrue(WEB_VJ.is_file(), "画面のプロジェクトの Root（apps/web）に vercel.json が在る")
        web = load(WEB_VJ)
        self.assertEqual(web.get("regions"), [load(CONFIG)["function_region"]], "画面の処理の場所が決まりと同じ 1 つ")
        self.assertEqual(sorted(web), ["$schema", "regions"],
                         "場所のほかを書かない（組み立て・入れ方・framework は Next.js の見つけ方のまま）")

    def test_K212_FR_008_docs_and_stack(self) -> None:
        doc = STAGING_MD.read_text(encoding="utf-8")
        lines = [ln for ln in doc.splitlines() if TOKYO in ln]
        self.assertTrue(lines, "STAGING.md に処理の場所（hnd1）の行が在る")
        self.assertTrue(any("DB と同じ" in ln and "両方" in ln for ln in lines),
                        "その行に「DB と同じ場所に置く・変えるときは両方」が在る")
        self.assertIn("staging_region.json", doc, "決まりの置き場を書く（Vercel の画面で場所を変えない）")
        stage1 = next(s for s in load(STACK)["hosting"]["stages"] if s["id"] == "stage1")
        self.assertIn(load(CONFIG)["function_region"], str(stage1.get("function_region", "")),
                      "環境の正本（段階 1）に処理の場所の欄が在り、決まりと同じ")
        self.assertIn("東京", str(stage1.get("database", "")), "DB の場所（東京）は前のまま")

    def test_K212_FR_009_ci_runs_this(self) -> None:
        wf = yaml.safe_load(GATE.read_text(encoding="utf-8"))
        hits = [s for j in wf["jobs"].values() for s in j.get("steps", [])
                if "python3 scripts/ci/k212_function_region_test.py" in str(s.get("run", ""))]
        self.assertEqual(len(hits), 1, "この試験が CI の段 1 つで流れる（G65 の並び）")
        self.assertNotIn("continue-on-error", hits[0])
        self.assertNotIn("|| true", str(hits[0].get("run", "")))
        self.assertIn("python3 scripts/ci/k200_staging_health_test.py", str(hits[0].get("run", "")),
                      "作りものの頭を足した K-200 の試験も同じ回で流れる")

    # ── 健康診断の 1 項目（作りものの口と画面に当てる）──────────────

    def test_K212_FR_003_same_region_is_green(self) -> None:
        api, web = self.fake(vercel_id=self.vid(TOKYO)), self.fake(vercel_id=self.vid(TOKYO))
        r = run(self.two(api, web), *self.applied())
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertRegex(r.stdout, rf"OK[^\n]*処理の場所（口）[^\n]*{TOKYO}")
        self.assertRegex(r.stdout, rf"OK[^\n]*処理の場所（画面）[^\n]*{TOKYO}")
        self.assertNotIn("★", r.stdout)

    def test_K212_FR_004_other_region_is_red(self) -> None:
        for side, api_r, web_r in (("口", "iad1", TOKYO), ("画面", TOKYO, "iad1")):
            with self.subTest(side=side):
                api, web = self.fake(vercel_id=self.vid(api_r)), self.fake(vercel_id=self.vid(web_r))
                r = run(self.two(api, web), *self.applied())
                self.assertEqual(r.returncode, 1, "処理の場所が決まりと違えば赤")
                self.assertRegex(r.stdout, rf"★[^\n]*処理の場所（{side}）[^\n]*iad1[^\n]*{TOKYO}", "どちらが・今の場所・決まりの場所を出す")
                other = "画面" if side == "口" else "口"
                self.assertRegex(r.stdout, rf"OK[^\n]*処理の場所（{other}）", "もう片方は OK のまま出る")
                clean(self, r, api.url, web.url, REQ_ID)

    def test_K212_FR_005_header_missing_or_malformed_is_red(self) -> None:
        cases = {
            "頭が無い": None,
            "入口だけ（2 つ）": f"hnd1::{REQ_ID}",
            "空の場所": f"hnd1::::{REQ_ID}",
            "場所の形でない": f"hnd1::<script>::{REQ_ID}",
            "命令の形を混ぜた": f"hnd1::::error file=x::{REQ_ID}",
            "中ほどの場所の形が違う": f"HND-1::{TOKYO}::{REQ_ID}",
        }
        for label, value in cases.items():
            with self.subTest(label):
                api = self.fake(vercel_id=value)
                web = self.fake(vercel_id=self.vid(TOKYO))
                r = run(self.two(api, web), *self.applied())
                self.assertEqual(r.returncode, 1, "頭が無い・形が違うのに黙って緑にしない")
                self.assertRegex(r.stdout, r"★[^\n]*処理の場所（口）[^\n]*読めない")
                self.assertNotRegex(r.stdout, r"OK[^\n]*処理の場所（口）")
                out = r.stdout + r.stderr
                self.assertNotIn("<script>", out)
                self.assertNotRegex(out, r"(?m)^::", "CI の命令の形を出力に出さない")
                clean(self, r, api.url, web.url, REQ_ID)

    def test_K212_FR_006_config_unreadable_is_red(self) -> None:
        api, web = self.fake(vercel_id=self.vid(TOKYO)), self.fake(vercel_id=self.vid(TOKYO))
        bad = pathlib.Path(self.tmp.name)
        cases = {"無い": bad / "none.json", "JSON でない": bad / "broken.json", "場所が無い": bad / "empty.json",
                 "場所の形でない": bad / "shape.json"}
        (bad / "broken.json").write_text("{", encoding="utf-8")
        (bad / "empty.json").write_text("{}", encoding="utf-8")
        (bad / "shape.json").write_text(json.dumps({"function_region": "Tokyo"}), encoding="utf-8")
        for label, path in cases.items():
            with self.subTest(label):
                r = run(self.two(api, web), "--region-config", str(path), *self.applied())
                self.assertEqual(r.returncode, 1, "決まりが読めないのに、場所を見ずに緑にしない")
                self.assertRegex(r.stdout, r"★[^\n]*処理の場所の決まり")
                self.assertRegex(r.stdout, r"OK[^\n]*CORS", "ほかの確かめは止めずに流す")
                self.assertNotRegex(r.stdout, r"OK[^\n]*処理の場所（")
        good = bad / "good.json"
        good.write_text(json.dumps({"function_region": "iad1"}), encoding="utf-8")
        r = run(self.two(api, web), "--region-config", str(good), *self.applied())
        self.assertEqual(r.returncode, 1, "--region-config で渡した決まり（iad1）と比べる（台本に場所を書き込まない）")
        self.assertRegex(r.stdout, r"★[^\n]*処理の場所（口）[^\n]*hnd1[^\n]*iad1")

    def test_K212_FR_007_no_extra_requests(self) -> None:
        api, web = self.fake(vercel_id=self.vid(TOKYO)), self.fake(vercel_id=self.vid(TOKYO))
        r = run(self.two(api, web), *self.applied())
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        seen = api.seen + web.seen
        self.assertEqual(sorted({m for m, _, _ in seen}), ["GET", "OPTIONS"], "読むだけ")
        self.assertEqual(sorted({p for m, p, _ in api.seen if m == "GET"}), ["/health"], "口の場所は /health の答えの頭から読む（道を足さない）")
        self.assertEqual(sorted({p for m, p, _ in web.seen if m == "GET"}), ["/login"], "画面の場所は /login の答えの頭から読む")
        self.assertEqual(sum(1 for m, p, _ in api.seen if (m, p) == ("GET", "/health")), 1, "当て直さない（1 回だけ）")
        clean(self, r, api.url, web.url, REQ_ID)

    def test_K212_FR_010_unreachable_is_not_green(self) -> None:
        dead = self.fake()
        url = dead.url
        dead.close()
        self.fakes.remove(dead)
        web = self.fake(vercel_id=self.vid(TOKYO))
        r = run({"STAGING_API_BASE": url, "STAGING_BASE_URL": web.url}, "--timeout", "2", *self.applied())
        self.assertEqual(r.returncode, 1)
        self.assertNotRegex(r.stdout, r"OK[^\n]*処理の場所（口）", "答えが返らない口の場所を OK にしない")
        self.assertRegex(r.stdout, r"★[^\n]*処理の場所（口）", "見られなかったことを口の場所の行で出す")
        r = run(self.two(self.fake(vercel_id=self.vid(TOKYO), health_status=503,
                                   health_body=json.dumps({"code": "STARTUP_FAILED", "reason": []})), web), *self.applied())
        self.assertEqual(r.returncode, 1)
        self.assertRegex(r.stdout, rf"OK[^\n]*処理の場所（口）[^\n]*{TOKYO}",
                         "/health が 503 でも、答えの頭の場所は読む（落ちた口がどこで動いているかを出す）")

    def test_K212_FR_011_region_code_shape(self) -> None:
        self.assertRegex(TOKYO, REGION_CODE)
        self.assertRegex(load(CONFIG)["function_region"], REGION_CODE, "決まりは Vercel の地域の符号の形（英小文字 3 字＋数字 1 字）")


if __name__ == "__main__":
    unittest.main(verbosity=2)
