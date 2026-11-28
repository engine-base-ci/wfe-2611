#!/usr/bin/env python3
"""K-237 の試験：staging の速さを測る台本（scripts/ci/staging_perf.py）。行 ID は K237-ST-NNN（11_tickets/K-237.md の表と 1 対 1）。
staging そのものにはつながない：127.0.0.1 に作りものの口と画面を立て、道ごとに遅さと答えの番号を変えて当てる。
台本は台帳（--ledger で渡した作りもの）の staging の項目を、住所の名前（STAGING_BASE_URL・STAGING_API_BASE）の値に当てて、
決めた回数（--runs）測り、答えまでの時間の中央値を上限と比べる。住所の読み方と当て方は staging_health.py の read_addresses・fetch をそのまま使う。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）"""
from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "ci" / "staging_perf.py"
STAGING_WF = ROOT / ".github" / "workflows" / "staging-e2e.yml"
MARK = "k237-secret-path-7c1d"  # 住所の後ろに付けた作りものの秘密。出力に出てはいけない


class Fake:
    """作りものの口と画面。delay（秒）と status を道ごとに決める。来た要求（方法・道・頭）を覚える"""

    def __init__(self, delay: dict[str, float] | None = None, status: dict[str, int] | None = None,
                 timing: dict[str, str | None] | None = None):
        self.delay = delay or {}
        self.status = status or {}
        # 口の答えの Server-Timing（K-237・A-4）。口（/api/・/health）の GET は既定で付ける。None を渡した道は付けない
        self.timing = timing or {}
        self.seen: list[tuple[str, str, dict[str, str]]] = []
        fake = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):  # 試験の出力を汚さない
                pass

            def _answer(self) -> None:
                path = self.path.split("?")[0]
                for p in (MARK, f"/{MARK}"):
                    path = path.replace(p, "")
                path = path or "/"
                fake.seen.append((self.command, path, {k.lower(): v for k, v in self.headers.items()}))
                time.sleep(fake.delay.get(path, 0.0))
                body = b"ok"
                self.send_response(fake.status.get(path, 204 if self.command == "OPTIONS" else 200))
                st = fake.timing.get(path, TIMING if self.command == "GET" and (path.startswith("/api/") or path == "/health") else None)
                if st is not None:
                    self.send_header("server-timing", st)
                self.send_header("content-length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            do_GET = _answer
            do_OPTIONS = _answer

        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.url = f"http://127.0.0.1:{self.srv.server_address[1]}"
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def close(self) -> None:
        self.srv.shutdown()
        self.srv.server_close()


TIMING = 'db;dur=3.2, q;desc="statements";dur=2'
ENTRIES = [
    {"name": "ログインの画面", "base": "STAGING_BASE_URL", "method": "GET", "path": "/login", "max_ms": 150},
    {"name": "規約の今の版の口", "base": "STAGING_API_BASE", "method": "GET", "path": "/api/v1/auth/terms/current", "max_ms": 150},
    {"name": "口のプリフライト", "base": "STAGING_API_BASE", "method": "OPTIONS", "path": "/api/v1/scopes", "max_ms": 150},
]


class StagingPerf(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.fakes: list[Fake] = []

    def tearDown(self) -> None:
        for f in self.fakes:
            f.close()

    def fake(self, **kw) -> Fake:
        f = Fake(**kw)
        self.fakes.append(f)
        return f

    def ledger(self, entries: list[dict]) -> str:
        p = pathlib.Path(self.tmp.name) / "perf_budget.json"
        p.write_text(json.dumps({"api": [], "screens": [], "staging": entries}, ensure_ascii=False), encoding="utf-8")
        return str(p)

    def run_script(self, env: dict[str, str], entries: list[dict] = ENTRIES) -> subprocess.CompletedProcess:
        base = {k: v for k, v in os.environ.items() if not k.startswith("STAGING_")}
        return subprocess.run([sys.executable, str(SCRIPT), "--ledger", self.ledger(entries), "--runs", "3"],
                              env={**base, **env}, capture_output=True, text=True, encoding="utf-8", timeout=120)

    def test_K237_ST_001_within_budget(self) -> None:
        """K237-ST-001 全部が上限以内：終わりの値 0・項目ごとに名前と中央値（ms）と上限を 1 行ずつ出す"""
        f = self.fake()
        r = self.run_script({"STAGING_BASE_URL": f.url, "STAGING_API_BASE": f.url})
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        for e in ENTRIES:
            self.assertRegex(r.stdout, rf"{e['name']}.*?\d+ ?ms.*?{e['max_ms']}")

    def test_K237_ST_002_over_budget_is_red(self) -> None:
        """K237-ST-002 1 つが上限を超える（規約の口だけ 0.4 秒遅い・上限 150ms）：終わりの値 1・超えた項目の名前と中央値を出す"""
        f = self.fake(delay={"/api/v1/auth/terms/current": 0.4})
        r = self.run_script({"STAGING_BASE_URL": f.url, "STAGING_API_BASE": f.url})
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        line = next((ln for ln in (r.stdout + r.stderr).splitlines() if "規約の今の版の口" in ln), "")
        self.assertRegex(line, r"(4\d\d|[5-9]\d\d) ?ms")
        self.assertIn("超え", line)

    def test_K237_ST_003_missing_name_is_not_green(self) -> None:
        """K237-ST-003 住所の名前が無い（STAGING_API_BASE が無い）：終わりの値 2・「測っていない」と名前を出す・口には 1 本も送らない"""
        f = self.fake()
        r = self.run_script({"STAGING_BASE_URL": f.url})
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertIn("測っていない", r.stdout + r.stderr)
        self.assertIn("STAGING_API_BASE", r.stdout + r.stderr)
        self.assertNotIn("Traceback", r.stdout + r.stderr)
        self.assertFalse(any(p.startswith("/api/") for _, p, _ in f.seen), f.seen)

    def test_K237_ST_004_server_error_is_red(self) -> None:
        """K237-ST-004 答えが 503（速くても）：終わりの値 1・その項目に答えの番号 503 を出す"""
        f = self.fake(status={"/login": 503})
        r = self.run_script({"STAGING_BASE_URL": f.url, "STAGING_API_BASE": f.url})
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        line = next((ln for ln in (r.stdout + r.stderr).splitlines() if "ログインの画面" in ln), "")
        self.assertIn("503", line)

    def test_K237_ST_005_address_shape_and_secret(self) -> None:
        """K237-ST-005 住所の形が違う（後ろに道を付けた・その道は秘密の作りもの）：終わりの値 2・決まった文（住所の形を受け付けない）・
        口にも画面にも 1 本も送らない・出力に作りものも住所の全部も出ない・Traceback が無い"""
        f = self.fake()
        secret_url = f"{f.url}/{MARK}"
        r = self.run_script({"STAGING_BASE_URL": secret_url, "STAGING_API_BASE": f.url})
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 2, out)
        self.assertIn("住所の形を受け付けない", out)
        self.assertEqual(f.seen, [])
        self.assertNotIn(MARK, out)
        self.assertNotIn(f.url, out)
        self.assertNotIn("Traceback", out)

    def test_K237_ST_006_preflight_headers(self) -> None:
        """K237-ST-006 プリフライトの項目：方法 OPTIONS で、Origin に画面の住所・Access-Control-Request-Method に GET・
        Access-Control-Request-Headers に authorization を付けて送る"""
        api = self.fake()
        web = self.fake()
        r = self.run_script({"STAGING_BASE_URL": web.url, "STAGING_API_BASE": api.url})
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        pre = [h for m, p, h in api.seen if m == "OPTIONS" and p == "/api/v1/scopes"]
        self.assertEqual(len(pre), 3)
        for h in pre:
            self.assertEqual(h.get("origin"), web.url)
            self.assertEqual(h.get("access-control-request-method"), "GET")
            self.assertIn("authorization", h.get("access-control-request-headers", "").lower())

    def test_K237_ST_007_workflow_step(self) -> None:
        """K237-ST-007 staging の回（staging-e2e.yml・05_flow/build_testplan.py が書く）で、統合テスト（G15）の段より後に
        `python3 scripts/ci/staging_perf.py` を流す段があり、`if: ${{ !cancelled() }}`（統合テストが赤でも流れ、速さが赤でも統合テストは止めない）。
        その段の env は STAGING_BASE_URL と STAGING_API_BASE の 2 つだけ"""
        wf = yaml.safe_load(STAGING_WF.read_text(encoding="utf-8"))
        steps = [s for job in wf["jobs"].values() for s in job.get("steps", [])]
        runs = [str(s.get("run", "")) for s in steps]
        e2e = max(i for i, x in enumerate(runs) if "pnpm e2e:staging" in x)
        perf = next((i for i, x in enumerate(runs) if "python3 scripts/ci/staging_perf.py" in x), -1)
        self.assertGreater(perf, e2e)
        self.assertEqual(str(steps[perf].get("if", "")).replace(" ", ""), "${{!cancelled()}}")
        self.assertEqual(sorted((steps[perf].get("env") or {}).keys()), ["STAGING_API_BASE", "STAGING_BASE_URL"])

    def test_K237_ST_008_unexpected_status_is_red(self) -> None:
        """K237-ST-008 待っていない答えの番号（規約の口が 401・/login が 302）：速くても終わりの値 1・その項目の行に番号（GET は 200、OPTIONS は 200 か 204 だけを待つ）"""
        f = self.fake(status={"/api/v1/auth/terms/current": 401, "/login": 302})
        r = self.run_script({"STAGING_BASE_URL": f.url, "STAGING_API_BASE": f.url})
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 1, out)
        lines = out.splitlines()
        self.assertIn("401", next((ln for ln in lines if "規約の今の版の口" in ln), ""))
        self.assertIn("302", next((ln for ln in lines if "ログインの画面" in ln), ""))

    def test_K237_ST_009_unreachable_is_red(self) -> None:
        """K237-ST-009 届かない（閉じた番号に当てる）：終わりの値 1・項目の行に例外の名前・Traceback も住所の全部も出ない"""
        f = self.fake()
        closed = f.url
        f.close()
        self.fakes.remove(f)
        r = self.run_script({"STAGING_BASE_URL": closed, "STAGING_API_BASE": closed})
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 1, out)
        self.assertRegex(next((ln for ln in out.splitlines() if "ログインの画面" in ln), ""), r"[A-Za-z]+(Error|Exception|Refused)")
        self.assertNotIn("Traceback", out)
        self.assertNotIn(closed, out)

    def test_K237_ST_010_server_timing_is_read(self) -> None:
        """K237-ST-010 口の GET の答えの Server-Timing（db;dur・q;desc="statements";dur）を読み、その項目の行に DB の時間と文の数を出す
        （規約の口：db 3 ms・文 2）。画面（/login）とプリフライトには求めない"""
        f = self.fake()
        r = self.run_script({"STAGING_BASE_URL": f.url, "STAGING_API_BASE": f.url})
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 0, out)
        line = next((ln for ln in out.splitlines() if "規約の今の版の口" in ln), "")
        self.assertRegex(line, r"db 3(\.\d)? ?ms")
        self.assertRegex(line, r"文 2")

    def test_K237_ST_011_missing_server_timing_is_red(self) -> None:
        """K237-ST-011 口の GET の答えに Server-Timing が無い：速くても終わりの値 1・その項目の行に「Server-Timing が無い」"""
        f = self.fake(timing={"/api/v1/auth/terms/current": None})
        r = self.run_script({"STAGING_BASE_URL": f.url, "STAGING_API_BASE": f.url})
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 1, out)
        self.assertIn("Server-Timing が無い", next((ln for ln in out.splitlines() if "規約の今の版の口" in ln), ""))


if __name__ == "__main__":
    unittest.main()
