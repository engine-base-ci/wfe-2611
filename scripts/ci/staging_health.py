#!/usr/bin/env python3
"""staging の健康診断（K-200）。読むだけ：公開の口への GET と OPTIONS だけを投げ、鍵は使わない・送らない。DB には入らない。

呼び方：python3 scripts/ci/staging_health.py [--need <名前>]... [--applied <ファイル>] [--timeout <秒>]
  住所は環境の値の名前で受ける（STAGING_BASE_URL＝画面・STAGING_API_BASE＝口）。値は出力に出さない（頭の 12 文字まで）。
  --applied は scripts/ci/staging_db_migrations.mjs の出力（DB に当たっている migration の名前の並びの JSON）。
終わりの値：0＝全部通った／1＝赤がある／2＝名前が無い・https でない（口に当てていない）／3＝赤は無いが DB を見ていない。
"""
from __future__ import annotations

import argparse
import http.client
import json
import os
import pathlib
import socket
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = ROOT / "packages" / "db" / "migrations"
URL_NAMES = ("STAGING_BASE_URL", "STAGING_API_BASE")   # 画面・口
LOOPBACK = ("127.0.0.1", "localhost")                  # 試験の作りものの口だけ http を許す
HEAD_CHARS = 12                                        # 出力に書いてよい住所の頭の長さ
MAX_BODY = 1_000_000                                   # 答えを読む上限（バイト）
MAX_SHOWN = 5                                          # ★ の行に並べる名前の上限
MAX_TEXT = 200                                         # 口の答えから写す文字の上限
EXIT_OK, EXIT_RED, EXIT_STOP, EXIT_UNSEEN = 0, 1, 2, 3

Result = tuple[bool, str]


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """行き先の付け替えを追わない（追うと、別の住所へ飛ばされた先の 200 で緑になる）"""

    def redirect_request(self, *args, **kwargs):
        return None


_OPENER = urllib.request.build_opener(_NoRedirect)


def fetch(url: str, timeout: float, method: str = "GET", headers: dict[str, str] | None = None):
    """1 回だけ当てる（当て直さない）。状態・中身・頭を返す。4xx・5xx・3xx も例外にしない"""
    req = urllib.request.Request(url, method=method, headers=headers or {})
    try:
        with _OPENER.open(req, timeout=timeout) as res:
            return res.status, res.read(MAX_BODY), res.headers
    except urllib.error.HTTPError as err:
        return err.code, err.read(MAX_BODY), err.headers


def local_migrations() -> list[str]:
    return sorted(p.name for p in MIGRATIONS_DIR.glob("*.sql"))


def _short(value: object) -> str:
    return str(value)[:MAX_TEXT]


def check_health(api: str, timeout: float, mine: list[str]) -> list[Result]:
    """確かめ 1（/health）と、通ったときだけ確かめ 2（配った版の migration の一覧の最後）"""
    status, body, _ = fetch(api + "/health", timeout)
    try:
        data = json.loads(body)
    except ValueError:
        data = None
    data = data if isinstance(data, dict) else {}
    if status != 200:
        reason = data.get("reason")
        names = "・".join(_short(r) for r in reason if isinstance(r, str)) if isinstance(reason, list) else ""
        return [(False, f"/health が {status}：{_short(data.get('code', ''))} {names}".rstrip())]
    mig = data.get("migrations")
    mig = mig if isinstance(mig, dict) else {}
    expected = mig.get("expected")
    listed = isinstance(expected, list) and bool(expected) and all(isinstance(x, str) for x in expected)
    if not (data.get("ok") is True and data.get("version") and listed and mig.get("order") == "ok"):
        return [(False, "/health は 200 だが中身が違う")]
    return [(True, f"/health 200・版 {_short(data['version'])}"), compare_deployed(_short(expected[-1]), mine)]


def compare_deployed(last: str, mine: list[str]) -> Result:
    if last == mine[-1]:
        return True, f"配った版の migration の一覧は手元と同じ（最後は {last}）"
    detail = f"配った版の最後の migration は {last}・手元は {mine[-1]}"
    if last in mine:
        return False, f"配りが遅れている：{detail}"
    return False, f"staging の方が新しい（手元の枝が古い）：{detail}"


def check_cors(web: str, api: str, timeout: float) -> list[Result]:
    """確かめ 3：画面の出どころからの事前の問い合わせを、口が許すか"""
    parts = urllib.parse.urlsplit(web)
    origin = f"{parts.scheme}://{parts.netloc}"
    status, _, headers = fetch(api + "/api/auth/ok", timeout, "OPTIONS",
                               {"origin": origin, "access-control-request-method": "GET"})
    ok = status in (200, 204) and headers.get("access-control-allow-origin") == origin
    return [(ok, "CORS（画面の住所からの事前の問い合わせ）" + ("" if ok else f"・状態 {status}"))]


def check_login(web: str, timeout: float) -> list[Result]:
    """確かめ 4：画面の /login"""
    status, _, _ = fetch(web + "/login", timeout)
    return [(status == 200, f"画面の /login が {status}")]


def check_applied(path: str, mine: list[str]) -> list[Result]:
    """確かめ 5：DB に当たっている migration（読む台本の出力）を、手元の一覧と比べる"""
    try:
        got = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        got = None
    if not (isinstance(got, list) and got and all(isinstance(x, str) for x in got)):
        return [(False, "DB に当たっている migration の一覧を読めない")]
    lack = [m for m in mine if m not in got]
    extra = [_short(g) for g in got if g not in mine]
    out: list[Result] = []
    if lack:
        out.append((False, "DB に当たっていない migration：" + "・".join(lack[:MAX_SHOWN])))
    if extra:
        out.append((False, "手元に無い migration が DB に当たっている：" + "・".join(extra[:MAX_SHOWN])))
    return out or [(True, f"DB に当たっている migration は手元と同じ（{len(mine)} 本）")]


def guarded(label: str, check) -> list[Result]:
    """届かない・答えない口を、その確かめの赤にして次へ進む（待ち続けない・例外の中身は出さない）"""
    slow = (False, f"時間切れ（答えが返らない）：{label}")
    dead = (False, f"届かない：{label}")
    try:
        return check()
    except (socket.timeout, TimeoutError):
        return [slow]
    except urllib.error.URLError as err:
        return [slow if isinstance(err.reason, (socket.timeout, TimeoutError)) else dead]
    except (OSError, http.client.HTTPException):
        return [dead]


def read_addresses(need: list[str]) -> tuple[str, str] | None:
    """住所 2 つを環境から読む。足りない・https でないときは理由を出して None（口に当てる前に止める）"""
    missing = [n for n in (*URL_NAMES, *need) if not os.environ.get(n, "").strip()]   # --need は在るかだけ。読まない・出さない
    if missing:
        print("★ 環境の値が無い：" + "・".join(missing))
        return None
    web, api = (os.environ[n].strip().rstrip("/") for n in URL_NAMES)
    for url in (web, api):
        parts = urllib.parse.urlsplit(url)
        if not parts.hostname or not (parts.scheme == "https" or (parts.scheme == "http" and parts.hostname in LOOPBACK)):
            print("★ 住所は https だけ（手元の 127.0.0.1 を除く）")
            return None
    return web, api


def main() -> int:
    ap = argparse.ArgumentParser(description="staging の健康診断（読むだけ）")
    ap.add_argument("--need", action="append", default=[], metavar="名前", help="在ることだけを確かめる環境の値の名前")
    ap.add_argument("--applied", metavar="ファイル", help="DB に当たっている migration の名前の並び（JSON）")
    ap.add_argument("--timeout", type=float, default=20.0, metavar="秒")
    args = ap.parse_args()
    addresses = read_addresses(args.need)
    if addresses is None:
        return EXIT_STOP
    web, api = addresses
    print(f"画面 {web[:HEAD_CHARS]}… ／ 口 {api[:HEAD_CHARS]}…")
    mine = local_migrations()
    if not mine:
        print("★ 手元の migration の一覧が空（packages/db/migrations）")
        return EXIT_RED
    results = [
        *guarded("/health", lambda: check_health(api, args.timeout, mine)),
        *guarded("CORS", lambda: check_cors(web, api, args.timeout)),
        *guarded("画面の /login", lambda: check_login(web, args.timeout)),
        *(check_applied(args.applied, mine) if args.applied else []),
    ]
    for ok, message in results:
        print(("OK  " if ok else "★ ") + message)
    if not args.applied:
        print("★ 見ていない：DB に当たっている migration（--applied が無い）")
    if not all(ok for ok, _ in results):
        return EXIT_RED
    return EXIT_OK if args.applied else EXIT_UNSEEN


if __name__ == "__main__":
    try:
        code = main()
    except Exception:  # noqa: BLE001 — 例外の写しに住所が入りうるので、中身は出さない
        print("★ 台本の中で失敗した（中身は出さない）")
        code = EXIT_RED
    sys.exit(code)
