#!/usr/bin/env python3
"""K-200 の試験：staging の健康診断の台本（scripts/ci/staging_health.py）・DB の migration を読む台本（staging_db_migrations.mjs）・手順書。行 ID は K200-SH-NNN。
staging そのものにはつながない：手元に立てた作りものの口と画面（127.0.0.1）に当てる。住所と鍵は環境の値の名前で渡す（値は試験の作りもの）"""
from __future__ import annotations

import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "ci" / "staging_health.py"
READER = ROOT / "scripts" / "ci" / "staging_db_migrations.mjs"   # staging の DB から、当たっている migration の名前を読むだけの台本
ALL = sorted(p.name for p in (ROOT / "packages" / "db" / "migrations").glob("*.sql"))
LAST = ALL[-1]
MARK = "k200-secret-marker-9f3a"          # 鍵の代わりの作りもの。出力に 1 文字も出てはいけない
NAMES = ("STAGING_BASE_URL", "STAGING_API_BASE")
REGION_CONFIG = ROOT / "scripts" / "ci" / "staging_region.json"   # 処理の場所の決まり（K-212）


def expected_region() -> str:
    """作りものの答えに載せる処理の場所。決まりのファイルがまだ無い枝では東京（hnd1）"""
    try:
        return str(json.loads(REGION_CONFIG.read_text(encoding="utf-8"))["function_region"])
    except (OSError, ValueError, KeyError, TypeError):
        return "hnd1"


class Fake:
    """作りものの口（/health・/api/auth/ok の事前の問い合わせ）と画面（/login）。振る舞いは cfg で変える。
    答えの頭 x-vercel-id（入口::処理の場所::番号・K-212）は既定で決まりの場所。vercel_id=None で頭を付けない・vercel_ids で道ごとに替える。
    extra_headers で道ごとに頭を足す（例 {"/login": {"x-vercel-cache": "HIT"}}）"""

    def __init__(self, **cfg):
        self.cfg = {"health_status": 200, "health_body": None, "last": LAST, "allow": "same", "login": 200, "sleep": 0.0,
                    "vercel_id": f"hnd1::{expected_region()}::k200fake-1", "vercel_ids": {}, "extra_headers": {}, **cfg}
        self.seen: list[tuple[str, str, str]] = []   # 来た要求（方法・道・頭の全部）
        fake = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):  # 試験の出力を汚さない
                pass

            def _send(self, status: int, body: bytes = b"", headers: dict[str, str] | None = None) -> None:
                self.send_response(status)
                vid = fake.cfg["vercel_ids"].get(self.path.split("?")[0], fake.cfg["vercel_id"])
                if vid is not None:
                    self.send_header("x-vercel-id", vid)
                for k, v in fake.cfg["extra_headers"].get(self.path.split("?")[0], {}).items():
                    self.send_header(k, v)
                for k, v in (headers or {}).items():
                    self.send_header(k, v)
                self.send_header("content-length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def _note(self) -> None:
                fake.seen.append((self.command, self.path, str(self.headers)))

            def _other(self) -> None:
                self._note()
                self._send(405)

            do_POST = do_PUT = do_PATCH = do_DELETE = do_HEAD = _other

            def do_GET(self) -> None:
                self._note()
                c = fake.cfg
                if c["sleep"]:
                    time.sleep(c["sleep"])
                if self.path == "/health":
                    body = c["health_body"]
                    if body is None:
                        body = json.dumps({"ok": True, "version": "0.1.0",
                                           "migrations": {"expected": ["0001_foundation.sql", c["last"]], "order": "ok"}})
                    self._send(c["health_status"], body.encode("utf-8"), {"content-type": "application/json"})
                elif self.path == "/login":
                    extra = {"location": "/moved"} if c["login"] in (301, 302, 307) else {}
                    self._send(c["login"], b"<html></html>", {"content-type": "text/html", **extra})
                elif self.path == "/moved":
                    self._send(200, b"<html></html>", {"content-type": "text/html"})
                else:
                    self._send(404)

            def do_OPTIONS(self) -> None:
                self._note()
                c = fake.cfg
                if self.path != "/api/auth/ok" or c["allow"] is None:
                    self._send(404)
                    return
                allow = self.headers.get("origin", "") if c["allow"] == "same" else c["allow"]
                self._send(204, b"", {"access-control-allow-origin": allow})

        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.url = f"http://127.0.0.1:{self.srv.server_address[1]}"
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def close(self) -> None:
        self.srv.shutdown()
        self.srv.server_close()


def run(env: dict[str, str], *args: str) -> subprocess.CompletedProcess:
    base = {k: v for k, v in os.environ.items() if not k.startswith("STAGING_")}
    return subprocess.run([sys.executable, str(SCRIPT), *args], env={**base, **env}, capture_output=True, text=True,
                          encoding="utf-8", timeout=60)


def clean(case: unittest.TestCase, r: subprocess.CompletedProcess, *values: str) -> None:
    """どの終わり方でも、出力に住所・鍵・接続の文字列・例外の写しが出ない"""
    out = r.stdout + r.stderr
    for v in values:
        case.assertNotIn(v, out, "値がそのまま出力に出ている")
    case.assertNotIn("Traceback", out, "例外の写しを出して終わっている")
    case.assertNotRegex(out, r"postgres(ql)?://", "接続の文字列の形が出ている")


class StagingHealth(unittest.TestCase):
    def setUp(self) -> None:
        self.fakes: list[Fake] = []
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def applied(self, names: list[str] | None = None, raw: str | None = None) -> list[str]:
        """DB に当たっている migration の一覧のファイル（読む台本の出力と同じ形＝名前の並びの JSON）→ 台本に渡す引数"""
        f = pathlib.Path(self.tmp.name) / "applied.json"
        f.write_text(raw if raw is not None else json.dumps(ALL if names is None else names), encoding="utf-8")
        return ["--applied", str(f)]

    def tearDown(self) -> None:
        for f in self.fakes:
            f.close()

    def fake(self, **cfg) -> Fake:
        f = Fake(**cfg)
        self.fakes.append(f)
        return f

    def both(self, f: Fake) -> dict[str, str]:
        return {"STAGING_BASE_URL": f.url, "STAGING_API_BASE": f.url}

    def test_K200_SH_001_all_green(self) -> None:
        r = run(self.both(self.fake()), *self.applied())
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        for word in ("/health", "配った版の migration", "DB に当たっている migration", "CORS", "/login"):
            self.assertRegex(r.stdout, rf"OK[^\n]*{word}", f"{word} の行が OK で出る")
        self.assertNotIn("★", r.stdout)

    def test_K200_SH_002_startup_failed(self) -> None:
        body = json.dumps({"code": "STARTUP_FAILED", "message": "いまサービスを始められません", "reason": ["secrets:vault=error"]})
        r = run(self.both(self.fake(health_status=503, health_body=body)))
        self.assertEqual(r.returncode, 1)
        self.assertIn("STARTUP_FAILED", r.stdout)
        self.assertIn("secrets:vault=error", r.stdout, "落ちた確かめの名前を出す")

    def test_K200_SH_003_deploy_is_behind(self) -> None:
        r = run(self.both(self.fake(last="0001_foundation.sql")), *self.applied())
        self.assertEqual(r.returncode, 1)
        self.assertIn("配りが遅れている", r.stdout)
        self.assertIn(LAST, r.stdout, "手元の最後の migration の名前")
        self.assertIn("0001_foundation.sql", r.stdout, "staging の最後の migration の名前")
        r = run(self.both(self.fake(last="9999_not_here_yet.sql")), *self.applied())
        self.assertEqual(r.returncode, 1)
        self.assertIn("staging の方が新しい", r.stdout, "手元の枝が古いときに「配りが遅れている」と言わない")
        self.assertNotIn("配りが遅れている", r.stdout)

    def test_K200_SH_004_cors(self) -> None:
        for allow in ("https://someone-else.example", None):
            with self.subTest(allow=allow):
                r = run(self.both(self.fake(allow=allow)))
                self.assertEqual(r.returncode, 1)
                self.assertRegex(r.stdout, r"★[^\n]*CORS")

    def test_K200_SH_005_web_login_down(self) -> None:
        for status in (500, 302):   # 302：別の住所へ飛ばされた先が 200 でも、付け替えを追って緑にしない
            with self.subTest(status=status):
                f = self.fake(login=status)
                r = run(self.both(f), *self.applied())
                self.assertEqual(r.returncode, 1)
                self.assertRegex(r.stdout, rf"★[^\n]*/login[^\n]*{status}")
                self.assertNotIn("/moved", [path for _, path, _ in f.seen], "付け替えの先へ当てに行っている")

    def test_K200_SH_006_names_missing(self) -> None:
        f = self.fake()
        for name in NAMES:
            with self.subTest(missing=name):
                env = self.both(f)
                env[name] = ""
                r = run(env)
                self.assertEqual(r.returncode, 2)
                self.assertIn(name, r.stdout + r.stderr)
                self.assertNotRegex(r.stdout, r"(?m)^OK")
        r = run(self.both(f), "--need", "STAGING_RESEND_READ_KEY")
        self.assertEqual(r.returncode, 2, "--need の名前が無ければ、口に当てる前に止まる")
        self.assertIn("STAGING_RESEND_READ_KEY", r.stdout + r.stderr)
        self.assertNotRegex(r.stdout, r"(?m)^OK")
        r = run({**self.both(f), "STAGING_RESEND_READ_KEY": MARK}, "--need", "STAGING_RESEND_READ_KEY", *self.applied())
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_K200_SH_007_output_has_no_values(self) -> None:
        ok = self.fake()
        bad = self.fake(login=500, allow="https://someone-else.example")
        for f in (ok, bad):
            r = run({**self.both(f), "STAGING_RESEND_READ_KEY": MARK}, "--need", "STAGING_RESEND_READ_KEY", *self.applied())
            out = r.stdout + r.stderr
            clean(self, r, MARK, f.url)
            self.assertIn(f.url[:12], out, "どの住所に当てたかは頭の 12 文字で分かる")

    def test_K200_SH_008_unreachable_and_slow(self) -> None:
        dead = self.fake()
        url = dead.url
        dead.close()
        self.fakes.remove(dead)
        r = run({"STAGING_BASE_URL": url, "STAGING_API_BASE": url}, "--timeout", "2")
        self.assertEqual(r.returncode, 1)
        self.assertIn("届かない", r.stdout)
        clean(self, r, url)
        t0 = time.monotonic()
        slow = self.fake(sleep=5.0)
        r = run(self.both(slow), "--timeout", "1")
        self.assertEqual(r.returncode, 1)
        self.assertIn("時間切れ", r.stdout)
        clean(self, r, slow.url)
        self.assertLess(time.monotonic() - t0, 15, "答えない口を待ち続けない")

    def test_K200_SH_009_https_only_outside_loopback(self) -> None:
        r = run({"STAGING_BASE_URL": "http://staging.example.invalid", "STAGING_API_BASE": "http://staging.example.invalid"},
                "--timeout", "1")
        self.assertEqual(r.returncode, 2, "手元（127.0.0.1）のほかは https だけ。当てる前に止まる")
        self.assertIn("https", r.stdout + r.stderr)
        self.assertNotIn("届かない", r.stdout, "当てに行っていない")
        clean(self, r, "staging.example.invalid")

    def test_K200_SH_010_health_200_but_wrong(self) -> None:
        bodies = {
            "JSON でない": "<html>ok</html>",
            "ok が false": json.dumps({"ok": False, "version": "0.1.0", "migrations": {"expected": [LAST], "order": "ng"}}),
            "migrations が無い": json.dumps({"ok": True, "version": "0.1.0"}),
        }
        for label, body in bodies.items():
            with self.subTest(label):
                f = self.fake(health_body=body)
                r = run(self.both(f), *self.applied())
                self.assertEqual(r.returncode, 1, "200 でも中身が違えば緑にしない")
                self.assertRegex(r.stdout, r"★[^\n]*/health")
                clean(self, r, f.url)

    def test_K200_SH_011_trailing_slash(self) -> None:
        f = self.fake()
        r = run({"STAGING_BASE_URL": f.url + "/", "STAGING_API_BASE": f.url + "/"}, *self.applied())
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_K200_SH_012_docs(self) -> None:
        readme = (ROOT / "infra" / "provision" / "README.md").read_text(encoding="utf-8")
        self.assertNotIn("Railway", readme, "古い順序（Railway）が残っている")
        doc = (ROOT / "infra" / "STAGING.md").read_text(encoding="utf-8")
        self.assertIn("python3 scripts/ci/staging_health.py", doc, "S5 の確かめは台本の命令")
        for name in ("STAGING_BASE_URL", "STAGING_API_BASE", "STAGING_DATABASE_READ_URL", "STAGING_RESEND_READ_KEY"):
            self.assertIn(name, doc, f"CI の秘密の名前 {name}")
        self.assertIn("Only build production", doc, "作業中の版の配りを止める設定（D-140.4）")
        self.assertNotIn("GitHub のリモート", doc, "§0「いま無いもの」が 2026-09 のまま")
        self.assertNotIn("kaname.secrets", doc, "前の CI（act）の秘密のファイルの書き方")
        self.assertNotIn("STAGING_DATABASE_ADMIN_URL", doc, "CI に渡す DB の接続は管理者の物ではない（読むだけの役・K-204 で名前を替えた）")
        self.assertIn("kaname_ci_read", doc, "CI が DB を読む役の名前")
        self.assertIn("sslmode=verify-full", doc, "接続は TLS を確かめる指定つき")
        for name, text in (("infra/STAGING.md", doc), ("infra/provision/README.md", readme)):   # 手順書に値・住所を書かない（置き字 <ref> などは当てない）
            for label, pat in (("接続の文字列", r"postgres(?:ql)?://[^<\s`]"), ("Resend の鍵", r"\bre_[A-Za-z0-9]{8,}"),
                               ("JWT の形の鍵", r"\beyJ[A-Za-z0-9_-]{10,}"), ("staging の住所", r"(?<![\w.>-])[a-z0-9][a-z0-9-]*\.(?:vercel\.app|supabase\.co)\b")):
                self.assertEqual(re.findall(pat, text), [], f"{name} に {label} の形が書いてある")

    def test_K200_SH_013_reads_only_and_sends_no_key(self) -> None:
        f = self.fake()
        r = run({**self.both(f), "STAGING_RESEND_READ_KEY": MARK, "STAGING_DATABASE_READ_URL": f"postgres://u:{MARK}@127.0.0.1:1/x"},
                "--need", "STAGING_RESEND_READ_KEY", "--need", "STAGING_DATABASE_READ_URL", *self.applied())
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(sorted({m for m, _, _ in f.seen}), ["GET", "OPTIONS"], "読むだけ（GET と OPTIONS のほかを投げない）")
        self.assertEqual(sorted({path for _, path, _ in f.seen}), ["/api/auth/ok", "/health", "/login"], "当てる道はこの 3 つだけ")
        for method, path, headers in f.seen:
            self.assertNotIn(MARK, path + headers, f"{method} {path} に鍵の値を付けて送っている")
            self.assertNotRegex(headers.lower(), r"(?m)^(authorization|cookie|x-api-key):", "鍵を運ぶ頭を付けない")

    def test_K200_SH_014_db_applied(self) -> None:
        f = self.fake()
        r = run(self.both(f), *self.applied(ALL[:-1]))
        self.assertEqual(r.returncode, 1)
        self.assertRegex(r.stdout, rf"★[^\n]*DB に当たっていない migration[^\n]*{re.escape(LAST)}", "配った版は新しいが DB に当てていない、を赤にする")
        r = run(self.both(f), *self.applied(ALL + ["9999_only_in_db.sql"]))
        self.assertEqual(r.returncode, 1)
        self.assertRegex(r.stdout, r"★[^\n]*9999_only_in_db\.sql", "手元に無い migration が DB に当たっている")
        for label, raw in (("JSON でない", "not json"), ("並びでない", "{}"), ("空", "[]")):
            with self.subTest(label):
                r = run(self.both(f), *self.applied(raw=raw))
                self.assertEqual(r.returncode, 1, "読めない一覧・空の一覧を「同じ」と言わない")
                self.assertRegex(r.stdout, r"★[^\n]*DB")
        r = run(self.both(f), "--applied", str(pathlib.Path(self.tmp.name) / "none.json"))
        self.assertEqual(r.returncode, 1, "渡したファイルが無い")
        clean(self, r, f.url)

    def test_K200_SH_015_db_not_looked_is_not_green(self) -> None:
        f = self.fake()
        r = run(self.both(f))
        self.assertEqual(r.returncode, 3, "DB を見ていない回は、ほかが全部通っても 0 にしない（赤の 1 とも分ける）")
        self.assertRegex(r.stdout, r"★[^\n]*見ていない[^\n]*DB に当たっている migration")
        self.assertNotRegex(r.stdout, r"OK[^\n]*DB に当たっている migration")
        r = run(self.both(self.fake(login=500)))
        self.assertEqual(r.returncode, 1, "ほかに赤があれば 1（見ていない、より赤が先）")
        self.assertIn("見ていない", r.stdout, "赤の回でも、見ていない項目は必ず出す")

    def test_K200_SH_016_db_reader_is_read_only_and_silent(self) -> None:
        src = READER.read_text(encoding="utf-8")
        code = re.sub(r"//[^\n]*|/\*.*?\*/", "", src, flags=re.S)
        sql = re.findall(r"""query\(\s*["'`]([^"'`]+)["'`]""", code)
        self.assertEqual([s.strip().lower() for s in sql],
                         ["begin transaction read only", "select name from app.schema_migrations order by name", "rollback"],
                         "投げる文はこの 3 つだけ（読むだけの取引の中で 1 回読む）")
        self.assertNotRegex(code, r"(?i)\b(insert|update|delete|create|alter|drop|truncate|grant|copy)\b", "書く文の語が台本に在る")
        self.assertEqual(sorted(set(re.findall(r"process\.env(?:\.|\[\s*[\"'])([A-Z0-9_]+)", code))), ["STAGING_DATABASE_READ_URL"], "読む環境の値はこの 1 つ")
        base = {k: v for k, v in os.environ.items() if not k.startswith("STAGING_")}
        r = subprocess.run(["node", str(READER)], env=base, capture_output=True, text=True, encoding="utf-8", timeout=60)
        self.assertEqual(r.returncode, 2, "名前が無ければ、つなぐ前に止まる")
        self.assertIn("STAGING_DATABASE_READ_URL", r.stdout + r.stderr)
        self.assertEqual(r.stdout.strip(), "", "一覧（標準出力）には何も出さない")
        url = f"postgres://admin:{MARK}@127.0.0.1:1/postgres"   # 閉じた口。つながらない
        r = subprocess.run(["node", str(READER)], env={**base, "STAGING_DATABASE_READ_URL": url}, capture_output=True, text=True,
                           encoding="utf-8", timeout=60)
        self.assertEqual(r.returncode, 1)
        self.assertEqual(r.stdout.strip(), "", "つながらないときに、空の一覧を出して成功にしない")
        out = r.stdout + r.stderr
        for leak in (MARK, "127.0.0.1:1", "admin:"):
            self.assertNotIn(leak, out, "接続の文字列の一部が出ている")
        self.assertNotRegex(out, r"postgres(ql)?://|\n\s+at ", "接続の文字列・例外の写しを出さない")
        self.assertNotRegex(code, r"rejectUnauthorized\s*:\s*false|no-verify|sslmode=(disable|allow|prefer)|NODE_TLS_REJECT_UNAUTHORIZED",
                            "TLS の確かめを外す書き方")
        for label, far in (("指定なし", f"postgres://kaname_ci_read.ref:{MARK}@db.example.invalid:5432/postgres"),
                           ("確かめない指定", f"postgres://kaname_ci_read.ref:{MARK}@db.example.invalid:5432/postgres?sslmode=require")):
            with self.subTest(label):
                r = subprocess.run(["node", str(READER)], env={**base, "STAGING_DATABASE_READ_URL": far}, capture_output=True, text=True,
                                   encoding="utf-8", timeout=60)
                self.assertEqual(r.returncode, 2, "手元（127.0.0.1）のほかは sslmode=verify-full が無ければ、つなぐ前に止まる")
                self.assertIn("sslmode=verify-full", r.stderr)
                self.assertEqual(r.stdout.strip(), "")
                for leak in (MARK, "db.example.invalid", "kaname_ci_read.ref"):
                    self.assertNotIn(leak, r.stdout + r.stderr, "接続の文字列の一部が出ている")


if __name__ == "__main__":
    unittest.main(verbosity=2)
