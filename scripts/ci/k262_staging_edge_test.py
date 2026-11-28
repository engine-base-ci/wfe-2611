#!/usr/bin/env python3
"""K-262 の試験：同じ住所にまとめる前の staging の確かめの台本（scripts/ci/staging_edge_check.py）。行 ID は K262-ST-NNN
（11_tickets/K-262.md の表と 1 対 1）。staging そのものにはつながない：127.0.0.1 に作りものの口（直の道）と画面（中継の道）を立てる。
台本は、口の確かめの口 GET /api/edge/echo を、直の道（STAGING_API_BASE）と画面を通した中継の道（STAGING_BASE_URL）で呼び、
返った IP と国が同じか、秘密を付けずに偽った頭（x-kaname-client-country: US・x-kaname-client-ip）を直に送っても無視されるかを見る。
住所の読み方と当て方は staging_health.py の read_addresses・fetch をそのまま使う。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）"""
from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "ci" / "staging_edge_check.py"


class Fake:
    """作りものの確かめの口。answer(headers) が返す {ip, country} を決める。status で答えの番号を決める。来た要求を覚える"""

    def __init__(self, answer, status: int = 200, raw: bytes | None = None, extra: dict[str, str] | None = None):
        self.seen: list[tuple[str, str, dict[str, str]]] = []
        fake = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):  # 試験の出力を汚さない
                pass

            def do_GET(self) -> None:
                h = {k.lower(): v for k, v in self.headers.items()}
                fake.seen.append((self.command, self.path, h))
                body = raw if raw is not None else (json.dumps(answer(h)).encode() if status == 200 else b'{"code":"NOT_FOUND"}')
                self.send_response(status)
                self.send_header("content-type", "application/json")
                for k, v in (extra or {}).items():
                    self.send_header(k, v)
                self.send_header("content-length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.url = f"http://127.0.0.1:{self.srv.server_address[1]}"
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def close(self) -> None:
        self.srv.shutdown()
        self.srv.server_close()


REAL = {"ip": "203.0.113.5", "country": "JP"}


def honest(_h: dict[str, str]) -> dict[str, str]:
    """正しく入れた口：だれが何を付けても本当の値を返す"""
    return dict(REAL)


def trusting(h: dict[str, str]) -> dict[str, str]:
    """誤った口：偽った頭をそのまま信じる"""
    return {"ip": h.get("x-kaname-client-ip", REAL["ip"]), "country": h.get("x-kaname-client-country", REAL["country"])}


class StagingEdge(unittest.TestCase):
    def setUp(self) -> None:
        self.fakes: list[Fake] = []

    def tearDown(self) -> None:
        for f in self.fakes:
            f.close()

    def fake(self, answer=honest, status: int = 200, raw: bytes | None = None, extra: dict[str, str] | None = None) -> Fake:
        f = Fake(answer, status, raw, extra)
        self.fakes.append(f)
        return f

    def run_script(self, env: dict[str, str]) -> subprocess.CompletedProcess:
        base = {k: v for k, v in os.environ.items() if not k.startswith("STAGING_")}
        return subprocess.run([sys.executable, str(SCRIPT)], env={**base, **env}, capture_output=True, text=True,
                              encoding="utf-8", timeout=60)

    def test_K262_ST_001_same_ip_and_country_is_green(self) -> None:
        """K262-ST-001 直の道と中継の道で IP・国が同じ・偽った頭はどちらの道でも無視される：終わりの値 0・「同じ」「無視」の行。
        直の道と中継の道に /api/edge/echo を 2 回ずつ（ふつう・秘密を付けずに国 US と IP の偽った頭つき）"""
        api, web = self.fake(), self.fake()
        r = self.run_script({"STAGING_API_BASE": api.url, "STAGING_BASE_URL": web.url})
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 0, out)
        self.assertIn("同じ", out)
        self.assertIn("無視", out)
        for f in (api, web):
            self.assertEqual([p for _, p, _ in f.seen], ["/api/edge/echo", "/api/edge/echo"])
            forged = [h for _, _, h in f.seen if "x-kaname-client-country" in h]
            self.assertEqual(len(forged), 1)
            self.assertEqual(forged[0]["x-kaname-client-country"], "US")
            self.assertIn("x-kaname-client-ip", forged[0])
            self.assertNotIn("x-kaname-edge-secret", forged[0])

    def test_K262_ST_002_country_differs_is_red(self) -> None:
        """K262-ST-002 中継の道の国が違う（中継の国 US が届いた）：終わりの値 1・「国」と 2 つの値（JP・US）を出す"""
        api = self.fake()
        web = self.fake(lambda _h: {"ip": "76.76.21.9", "country": "US"})
        r = self.run_script({"STAGING_API_BASE": api.url, "STAGING_BASE_URL": web.url})
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 1, out)
        line = next((ln for ln in out.splitlines() if "国" in ln and "US" in ln), "")
        self.assertIn("JP", line)

    def test_K262_ST_003_forged_header_trusted_is_red(self) -> None:
        """K262-ST-003 偽った頭（秘密なし）を信じた：直の道の口が信じた・中継の道（画面の入口が上書きしていない）が信じた、のどちらも終わりの値 1・「偽った頭」を出す"""
        for api_answer, web_answer in ((trusting, honest), (honest, trusting)):
            api, web = self.fake(api_answer), self.fake(web_answer)
            r = self.run_script({"STAGING_API_BASE": api.url, "STAGING_BASE_URL": web.url})
            out = r.stdout + r.stderr
            self.assertEqual(r.returncode, 1, out)
            self.assertIn("偽った頭", out)

    def test_K262_ST_004_missing_address_sends_nothing(self) -> None:
        """K262-ST-004 住所の名前が無い（STAGING_BASE_URL が無い）：終わりの値 2・「確かめていない」と名前を出す・口に 1 本も送らない・Traceback が無い"""
        api = self.fake()
        r = self.run_script({"STAGING_API_BASE": api.url})
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 2, out)
        self.assertIn("確かめていない", out)
        self.assertIn("STAGING_BASE_URL", out)
        self.assertEqual(api.seen, [])
        self.assertNotIn("Traceback", out)

    def test_K262_ST_005_echo_closed_is_red(self) -> None:
        """K262-ST-005 確かめの口が閉じている（404・KANAME_EDGE_ECHO が無い）：終わりの値 1・「確かめの口が閉じている」を出す（緑にしない）"""
        api, web = self.fake(status=404), self.fake(status=404)
        r = self.run_script({"STAGING_API_BASE": api.url, "STAGING_BASE_URL": web.url})
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 1, out)
        self.assertIn("確かめの口が閉じている", out)


    def test_K262_ST_006_unreadable_ip_or_country_is_red(self) -> None:
        """K262-ST-006 直と中継が両方とも IP と国を読めない（null）：同じでも緑にしない。終わりの値 1・「読めない」を出す"""
        nothing = lambda _h: {"ip": None, "country": None}  # noqa: E731
        api, web = self.fake(nothing), self.fake(nothing)
        r = self.run_script({"STAGING_API_BASE": api.url, "STAGING_BASE_URL": web.url})
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 1, out)
        self.assertIn("読めない", out)

    def test_K262_ST_007_bad_answers_and_leak_are_red(self) -> None:
        """K262-ST-007 待っていない答え（中継が 401・中継が JSON でない）と、中継の答えの頭に秘密や x-middleware- が出る：
        どれも終わりの値 1・Traceback を出さない・頭の値（秘密）を出力に出さない"""
        cases = [
            dict(status=401),
            dict(raw=b"<html>not json</html>"),
            dict(extra={"x-middleware-request-x-kaname-edge-secret": "k262-leak-7f3a"}),
            dict(extra={"x-kaname-edge-secret": "k262-leak-7f3a"}),
        ]
        for kw in cases:
            api, web = self.fake(), self.fake(**kw)
            r = self.run_script({"STAGING_API_BASE": api.url, "STAGING_BASE_URL": web.url})
            out = r.stdout + r.stderr
            self.assertEqual(r.returncode, 1, (kw, out))
            self.assertNotIn("Traceback", out)
            self.assertNotIn("k262-leak-7f3a", out)


if __name__ == "__main__":
    unittest.main()
