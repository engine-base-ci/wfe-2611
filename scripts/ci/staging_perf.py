#!/usr/bin/env python3
"""staging の速さ（K-237）。読むだけ：台帳（scripts/ci/perf_budget.json）の staging の項目（ログインの要らない道の GET と OPTIONS）を
決めた回数ずつ当て、答えまでの時間の中央値を上限と比べる。鍵は使わない・送らない。DB には入らない。

呼び方：python3 scripts/ci/staging_perf.py [--ledger <ファイル>] [--runs <回数>] [--timeout <秒>]
  住所は環境の値の名前で受ける（STAGING_BASE_URL＝画面・STAGING_API_BASE＝口）。読み方と当て方は staging_health.py の
  read_addresses・fetch をそのまま使う（同じ物を 2 つ作らない）。住所は出力に出さない。付け替え（3xx）は追わない。
  口（STAGING_API_BASE）の GET は、答えの Server-Timing（db;dur・q;desc="statements";dur）も読む。無ければ赤。
終わりの値：0＝全部上限の中／1＝赤がある（遅い・待っていない番号・届かない・Server-Timing が無い）／2＝住所の名前が無い・形が違う（測っていない）／64＝使い方の誤り。
"""
from __future__ import annotations

import argparse
import http.client
import json
import pathlib
import re
import socket
import statistics
import sys
import time
import urllib.error
import urllib.parse

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from staging_health import fetch, read_addresses  # noqa: E402 — 同じ置き場の台本を読む

LEDGER = pathlib.Path(__file__).resolve().parent / "perf_budget.json"
EXIT_OK, EXIT_RED, EXIT_STOP, EXIT_USAGE = 0, 1, 2, 64
WANT = {"GET": (200,), "OPTIONS": (200, 204)}   # 待つ答えの番号
DB_DUR = re.compile(r"(?:^|,)\s*db;dur=(\d+(?:\.\d+)?)")
Q_DUR = re.compile(r'(?:^|,)\s*q;desc="statements";dur=(\d+)')


class _Parser(argparse.ArgumentParser):
    """使い方の誤りを、住所が無い（2）と分ける"""

    def error(self, message: str):
        self.print_usage(sys.stderr)
        print("★ 使い方が違う（引数）", file=sys.stderr)
        sys.exit(EXIT_USAGE)


def _reason(err: BaseException) -> str:
    """届かないときの例外の名前だけ（中身に住所が入りうるので出さない）。URLError は中の理由の名前を出す"""
    if isinstance(err, urllib.error.URLError) and isinstance(err.reason, BaseException):
        return type(err.reason).__name__
    return type(err).__name__


def _timing(headers) -> tuple[float, int] | None:
    raw = headers.get("server-timing") if headers is not None else None
    db, q = DB_DUR.search(raw or ""), Q_DUR.search(raw or "")
    return (float(db.group(1)), int(q.group(1))) if db and q else None


def measure(item: dict, web: str, api: str, runs: int, timeout: float) -> tuple[bool, str]:
    """1 項目を runs 回当てて、1 行の結果を返す"""
    name, method = item["name"], item["method"]
    base = web if item["base"] == "STAGING_BASE_URL" else api
    headers = None
    if method == "OPTIONS":
        parts = urllib.parse.urlsplit(web)
        headers = {"origin": f"{parts.scheme}://{parts.netloc}", "access-control-request-method": "GET",
                   "access-control-request-headers": "authorization"}
    read_timing = item["base"] == "STAGING_API_BASE" and method == "GET"
    took: list[float] = []
    timings: list[tuple[float, int]] = []
    for _ in range(runs):
        t0 = time.perf_counter()
        try:
            status, _, got = fetch(base + item["path"], timeout, method, headers)
        except (urllib.error.URLError, OSError, http.client.HTTPException, socket.timeout) as err:
            return False, f"{name}：答え {_reason(err)}"
        took.append((time.perf_counter() - t0) * 1000)
        if status not in WANT[method]:
            return False, f"{name}：答え {status}"
        if read_timing:
            t = _timing(got)
            if t is None:
                return False, f"{name}：Server-Timing が無い"
            timings.append(t)
    median = round(statistics.median(took))
    line = f"{name}：中央値 {median} ms（上限 {item['max_ms']} ms）"
    if timings:
        line += f"・db {statistics.median(t[0] for t in timings):.1f} ms・文 {timings[-1][1]}"
    over = median > item["max_ms"]
    return not over, line + ("・超えた" if over else "")


def main() -> int:
    ap = _Parser(description="staging の速さ（読むだけ）")
    ap.add_argument("--ledger", default=str(LEDGER), metavar="ファイル", help="速さの台帳（JSON の staging）")
    ap.add_argument("--runs", type=int, default=5, metavar="回数")
    ap.add_argument("--timeout", type=float, default=10.0, metavar="秒")
    args = ap.parse_args()
    if not 0 < args.runs <= 50 or not 0 < args.timeout <= 300:
        ap.error("runs・timeout")
    try:
        items = json.loads(pathlib.Path(args.ledger).read_text(encoding="utf-8"))["staging"]
    except (OSError, ValueError, KeyError, TypeError):
        print("★ 台帳を読めない（staging の項目）")
        return EXIT_RED
    addresses = read_addresses([])
    if addresses is None:
        print("★ 測っていない（STAGING_BASE_URL・STAGING_API_BASE の住所が要る）")
        return EXIT_STOP
    web, api = addresses
    results = [measure(item, web, api, args.runs, args.timeout) for item in items]
    for ok, message in results:
        print(("OK  " if ok else "★ ") + message)
    return EXIT_OK if results and all(ok for ok, _ in results) else EXIT_RED


if __name__ == "__main__":
    try:
        code = main()
    except Exception:  # noqa: BLE001 — 例外の写しに住所が入りうるので、中身は出さない
        print("★ 台本の中で失敗した（中身は出さない）")
        code = EXIT_RED
    sys.exit(code)
