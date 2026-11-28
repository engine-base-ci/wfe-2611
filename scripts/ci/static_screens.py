#!/usr/bin/env python3
"""static_screens.py — 「API を呼ばない画面の台帳」（05_flow/screen_api.py の STATIC_SCREENS）の検査（K-53・テスターのレビュー HIGH）。
api_gate.py の A3（画面の必要 API の被覆）と fb_gate.py の FB3・FB8（画面の required_apis・マトリクスの未被覆）が使う。

画面は行為から出す（screen-derivation）ので、API を呼ばない画面（例：規約の文面のページ）もある。そういう画面を被覆するために
偽の API の対応を書かない（書くと「画面がその口を呼ぶ」という嘘が契約・試験・目録に広がる）。代わりに台帳に理由つきで載せ、
台帳にあって次を全部満たす画面だけを「被覆済み」と数える（双方向）：
  S1 理由（reason）が空でない（15 文字以上）・根拠の決定（source）が 1 つ以上
  S2 flow.json の画面にある
  S3 SCREEN_API（画面 → API の表）にも載っていない（どちらか一方）
  S4 台帳の code（画面のコードの入口）が全部あり、そこから辿れる apps/web のコード（相対と @/ の import）が API を呼ばない
     （@/lib/api の import・fetch(・"/api/" の字面・XMLHttpRequest・EventSource・WebSocket のどれも無い）
使い方: python3 static_screens.py [--root .]          … 台帳を検査して結果を出す（赤なら 2）
"""
import argparse, importlib.util, json, re, sys
from pathlib import Path

API_CALL = [
    (re.compile(r"""from\s+["']@/lib/api(?:/[^"']*)?["']|import\(\s*["']@/lib/api"""), "@/lib/api を読む"),
    (re.compile(r"\bfetch\s*\("), "fetch( を呼ぶ"),
    (re.compile(r"""["'`]/api/"""), '"/api/" の道を書く'),
    (re.compile(r"\b(XMLHttpRequest|EventSource|WebSocket)\b"), "通信の部品を使う"),
]
IMPORT = re.compile(r"""(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)""")
EXTS = ("", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx")


def load_ledger(root: Path):
    spec = importlib.util.spec_from_file_location("screen_api", root / "05_flow" / "screen_api.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return getattr(mod, "STATIC_SCREENS", {}), getattr(mod, "SCREEN_API", {})


def _strip_comments(src: str) -> str:
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    return re.sub(r"(^|[^:])//[^\n]*", r"\1", src)


def _resolve(web: Path, frm: Path, spec: str):
    if spec.startswith("@/"):
        base = web / spec[2:]
    elif spec.startswith("."):
        base = (frm.parent / spec).resolve()
    else:
        return None  # 部品（node_modules・@kaname/*）は辿らない。@kaname/* から API を呼ぶなら @/lib/api と同じく画面のコードに字面が出る
    for e in EXTS:
        p = Path(str(base) + e)
        if p.is_file():
            return p
    return None


def scan_code(root: Path, entries):
    """入口から辿れる apps/web のファイルで、API を呼んでいる所を [(ファイル, 理由)] で返す。無い入口は ('missing', 道)"""
    web = root / "apps" / "web"
    todo, seen, hits = [], set(), []
    for e in entries:
        p = root / e
        if p.is_dir():
            todo += [x for x in p.rglob("*") if x.suffix in (".ts", ".tsx", ".js", ".mjs") and x.is_file()]
        elif p.is_file():
            todo.append(p)
        else:
            hits.append(("missing", e))
    while todo:
        f = todo.pop().resolve()
        if f in seen:
            continue
        seen.add(f)
        src = _strip_comments(f.read_text(encoding="utf-8"))
        rel = str(f.relative_to(root.resolve()))
        for rx, why in API_CALL:
            if rx.search(src):
                hits.append((rel, why))
        for m in IMPORT.finditer(src):
            nxt = _resolve(web, f, next(g for g in m.groups() if g))
            if nxt and nxt.resolve() not in seen:
                todo.append(nxt)
    return hits


def check(root: Path, flow_screens=None, ledger=None, screen_api=None):
    """台帳の検査。返すのは (被覆済みと数える画面の集合, 赤の一覧 [(画面, 理由)])"""
    if ledger is None or screen_api is None:
        ledger, screen_api = load_ledger(root)
    if flow_screens is None:
        flow_screens = {s["id"] for s in json.load(open(root / "05_flow" / "flow.json", encoding="utf-8"))["screens"]}
    ok, fails = set(), []
    for sid, ent in sorted(ledger.items()):
        bad = []
        if len(str(ent.get("reason", "")).strip()) < 15:
            bad.append("S1 理由（reason）が空か短い")
        if not ent.get("source"):
            bad.append("S1 根拠の決定（source）が無い")
        if sid not in flow_screens:
            bad.append("S2 flow.json に無い画面")
        if sid in screen_api:
            bad.append("S3 SCREEN_API にも載っている（API を呼ぶのか呼ばないのか一方にする）")
        if not ent.get("code"):
            bad.append("S4 画面のコードの入口（code）が無い")
        for f, why in scan_code(root, ent.get("code", [])):
            bad.append(f"S4 入口が無い {why}" if f == "missing" else f"S4 {f} が {why}（API を呼ぶ画面は台帳に載せられない）")
        if bad:
            fails += [(sid, b) for b in bad]
        else:
            ok.add(sid)
    return ok, fails


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    a = ap.parse_args()
    root = Path(a.root)
    ok, fails = check(root)
    for sid, why in fails:
        print(f"  ★ [{sid}] {why}")
    print(f"API を呼ばない画面の台帳：被覆済み {sorted(ok)}" if not fails else f"FAIL — {len(fails)} 件")
    return 0 if not fails else 2


if __name__ == "__main__":
    sys.exit(main())
