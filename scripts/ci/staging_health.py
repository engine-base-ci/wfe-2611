#!/usr/bin/env python3
"""staging の健康診断（K-200）。読むだけ：公開の口への GET と OPTIONS だけを投げ、鍵は使わない・送らない。DB には入らない。

呼び方：python3 scripts/ci/staging_health.py [--need <名前>]... [--applied <ファイル>] [--timeout <秒>] [--region-config <ファイル>]
  住所は環境の値の名前で受ける（STAGING_BASE_URL＝画面・STAGING_API_BASE＝口）。値は出力に出さない（頭の 12 文字まで）。
  --applied は scripts/ci/staging_db_migrations.mjs の出力（DB に当たっている migration の名前の並びの JSON）。
  --region-config は処理の場所の決まり（既定は台本の隣の staging_region.json・K-212）。口の /health と画面の /login の答えの頭 x-vercel-id から
  処理の場所（Function の地域）を読み、決まりと違う・読めないときは赤。道は増やさない。
終わりの値：0＝全部通った／1＝赤がある／2＝名前が無い・住所の形が違う（口に当てていない）／3＝赤は無いが DB を見ていない／64＝使い方の誤り（引数）。
"""
from __future__ import annotations

import argparse
import http.client
import json
import os
import pathlib
import re
import socket
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = ROOT / "packages" / "db" / "migrations"
REGION_CONFIG = pathlib.Path(__file__).resolve().parent / "staging_region.json"   # 処理の場所の決まり（K-212）
REGION_CODE = re.compile(r"^[a-z]{3}[0-9]$")           # Vercel の地域の符号の形
NOT_FUNCTION = ("HIT", "STALE", "PRERENDER")           # x-vercel-cache がこれなら Function を通っていない答え（頭の場所を読まない）
SIDES = ("口", "画面")
URL_NAMES = ("STAGING_BASE_URL", "STAGING_API_BASE")   # 画面・口
LOOPBACK = ("127.0.0.1", "localhost")                  # 試験の作りものの口だけ http を許す
HEAD_CHARS = 12                                        # 出力に書いてよい住所の頭の長さ
MAX_BODY = 1_000_000                                   # 答えを読む上限（バイト）
MAX_SHOWN = 5                                          # ★ の行に並べる名前の上限
MAX_TEXT = 200                                         # 口の答えから写す文字の上限
GRACE_SECONDS = 1.0                                    # 確かめ 1 つの締め切り＝--timeout ＋ これ（ソケットの待ちが先に切れるように）
EXIT_OK, EXIT_RED, EXIT_STOP, EXIT_UNSEEN, EXIT_USAGE = 0, 1, 2, 3, 64

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
    """口の答え・渡されたファイルから写す文字：改行と制御文字を除き、1 行のまま短く切る（記録の行の偽造・CI の命令の形にさせない）"""
    text = " ".join(str(value).split())
    text = "".join(ch for ch in text if ch.isprintable()).replace("::", "：：")
    return text[:MAX_TEXT]


def read_region(path: str) -> str | None:
    """処理の場所の決まりを読む。無い・読めない・形が違うときは None"""
    try:
        value = json.loads(pathlib.Path(path).read_text(encoding="utf-8")).get("function_region")
    except (OSError, ValueError, AttributeError):
        return None
    return value if isinstance(value, str) and REGION_CODE.match(value) else None


def region_label(side: str) -> str:
    return f"処理の場所（{side}）"


def check_region(side: str, headers, want: str | None) -> list[Result]:
    """答えの頭 x-vercel-id（入口::…::処理の場所::要求の番号）の最後の 1 つ前を、決まりと比べる。want が None（決まりが読めない）なら何も出さない"""
    if want is None:
        return []
    label = region_label(side)
    cache = (headers.get("x-vercel-cache") or "").strip().upper() if headers is not None else ""
    if cache in NOT_FUNCTION:
        return [(False, f"{label}が読めない（Function を通っていない答え）")]
    raw = headers.get("x-vercel-id") if headers is not None else None
    parts = raw.strip().split("::") if raw else []
    if len(parts) < 3 or not all(REGION_CODE.match(x) for x in parts[:-1]):
        return [(False, f"{label}が読めない（x-vercel-id が無い・形が違う）")]
    got = parts[-2]
    if got != want:
        return [(False, f"{label}が {got}（決まりは {want}・DB と同じ場所）")]
    return [(True, f"{label}は {got}")]


def check_health(api: str, timeout: float, mine: list[str], want: str | None = None) -> list[Result]:
    """確かめ 1（/health）と、通ったときだけ確かめ 2（配った版の migration の一覧の最後）。答えの頭から口の処理の場所も見る"""
    status, body, headers = fetch(api + "/health", timeout)
    return [*_health_body(status, body, mine), *check_region("口", headers, want)]


def _health_body(status: int, body: bytes, mine: list[str]) -> list[Result]:
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


def check_login(web: str, timeout: float, want: str | None = None) -> list[Result]:
    """確かめ 4：画面の /login。答えの頭から画面の処理の場所も見る"""
    status, _, headers = fetch(web + "/login", timeout)
    return [(status == 200, f"画面の /login が {status}"), *check_region("画面", headers, want)]


def region_gaps(results: list[Result], want: str | None) -> list[Result]:
    """決まりが読めない・答えが返らず場所を見られなかった側を赤で足す（黙って抜かさない）"""
    if want is None:
        return [(False, "処理の場所の決まりを読めない（scripts/ci/staging_region.json の function_region）")]
    return [(False, f"{region_label(side)}が読めない（答えが返らない）") for side in SIDES
            if not any(region_label(side) in message for _, message in results)]


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


def _attempt(label: str, check) -> list[Result]:
    """届かない・答えない口を、その確かめの赤にする（例外の中身は出さない）"""
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
    except Exception:  # noqa: BLE001 — 例外の写しに住所が入りうるので、中身は出さない
        return [(False, f"台本の中で失敗した（中身は出さない）：{label}")]


def guarded(label: str, check, deadline: float) -> list[Result]:
    """確かめ 1 つに全体の締め切りを置く：少しずつ返し続ける口・名前の解決の待ちでも、deadline 秒で打ち切って次へ進む"""
    box: list[list[Result]] = []
    worker = threading.Thread(target=lambda: box.append(_attempt(label, check)), daemon=True)
    worker.start()
    worker.join(deadline)
    return box[0] if box else [(False, f"時間切れ（答えが返らない）：{label}")]


def read_addresses(need: list[str]) -> tuple[str, str] | None:
    """住所 2 つを環境から読む。足りない・https でないときは理由を出して None（口に当てる前に止める）"""
    missing = [n for n in (*URL_NAMES, *need) if not os.environ.get(n, "").strip()]   # --need は在るかだけ。読まない・出さない
    if missing:
        print("★ 環境の値が無い：" + "・".join(missing))
        return None
    web, api = (os.environ[n].strip().rstrip("/") for n in URL_NAMES)
    for url in (web, api):
        problem = address_problem(url)
        if problem:
            print("★ " + problem)   # 決まった文だけ。住所は出さない
            return None
    return web, api


def address_problem(url: str) -> str | None:
    """住所は出どころ（https://名前[:番号]）だけ。違えば決まった文を返す"""
    shape = "住所の形を受け付けない（https の出どころだけ。利用者の名前・合言葉・道・問いを付けない）"
    try:
        parts = urllib.parse.urlsplit(url)
        _ = parts.port   # 番号が数でなければ ValueError
    except ValueError:
        return shape
    if not parts.hostname or not (parts.scheme == "https" or (parts.scheme == "http" and parts.hostname in LOOPBACK)):
        return "住所は https だけ（手元の 127.0.0.1 を除く）"
    if parts.username is not None or parts.password is not None or parts.path or parts.query or parts.fragment or "?" in url or "#" in url:
        return shape
    return None


class _Parser(argparse.ArgumentParser):
    """使い方の誤りを、名前が無い（2）と分ける"""

    def error(self, message: str):
        self.print_usage(sys.stderr)
        print("★ 使い方が違う（引数）", file=sys.stderr)
        sys.exit(EXIT_USAGE)


def main() -> int:
    ap = _Parser(description="staging の健康診断（読むだけ）")
    ap.add_argument("--need", action="append", default=[], metavar="名前", help="在ることだけを確かめる環境の値の名前")
    ap.add_argument("--applied", metavar="ファイル", help="DB に当たっている migration の名前の並び（JSON）")
    ap.add_argument("--timeout", type=float, default=20.0, metavar="秒")
    ap.add_argument("--region-config", default=str(REGION_CONFIG), metavar="ファイル", help="処理の場所の決まり（JSON の function_region）")
    args = ap.parse_args()
    if not 0 < args.timeout <= 300:
        ap.error("timeout")
    addresses = read_addresses(args.need)
    if addresses is None:
        return EXIT_STOP
    web, api = addresses
    print(f"画面 {web[:HEAD_CHARS]}… ／ 口 {api[:HEAD_CHARS]}…")
    mine = local_migrations()
    deadline = args.timeout + GRACE_SECONDS
    if not mine:
        print("★ 手元の migration の一覧が空（packages/db/migrations）")
        return EXIT_RED
    want = read_region(args.region_config)
    results = [
        *guarded("/health", lambda: check_health(api, args.timeout, mine, want), deadline),
        *guarded("CORS", lambda: check_cors(web, api, args.timeout), deadline),
        *guarded("画面の /login", lambda: check_login(web, args.timeout, want), deadline),
        *(check_applied(args.applied, mine) if args.applied else []),
    ]
    results += region_gaps(results, want)
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
    sys.exit(code)   # 締め切りで見切った確かめの糸（daemon）は待たずに終わる
