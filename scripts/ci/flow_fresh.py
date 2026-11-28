"""flow.json は 05_flow/data.py から build_flow.py が作る生成物。直接直すと、次に作り直したときに黙って消える。
2026-09-27：flow.json を直接直した分が 47 か所（過去の回の 保留の申し込み・Bridge の配布物・パスワードの再設定 等を含む）あり、
data.py から作り直すと全部消える状態だった。data.py に写し戻し、この検査で「作り直しても同じ」を毎回確かめる。

使い方: python3 scripts/ci/flow_fresh.py        # 一致なら PASS、違えば違う場所を出して FAIL
"""
import json, os, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "05_flow")

def diff(a, b, path=""):
    if type(a) is not type(b): return [f"{path}: 型が違う"]
    if isinstance(a, dict):
        out = []
        for k in sorted(set(a) | set(b)):
            if k not in a: out.append(f"{path}.{k}: flow.json にだけある（直接足した）")
            elif k not in b: out.append(f"{path}.{k}: 生成にだけある")
            else: out += diff(a[k], b[k], f"{path}.{k}")
        return out
    if isinstance(a, list):
        if len(a) != len(b): return [f"{path}: 数が違う（flow.json {len(a)}／生成 {len(b)}）"]
        out = []
        for i, (x, y) in enumerate(zip(a, b)):
            key = (x.get("id") or x.get("name") or i) if isinstance(x, dict) else i
            out += diff(x, y, f"{path}[{key}]")
        return out
    return [] if a == b else [f"{path}: 値が違う"]

def main():
    with tempfile.TemporaryDirectory() as t:
        work = os.path.join(t, "05_flow")
        shutil.copytree(SRC, work, ignore=shutil.ignore_patterns("__pycache__", "*.html", "*.md"))
        r = subprocess.run([sys.executable, "build_flow.py"], cwd=work, capture_output=True, text=True)
        if r.returncode != 0:
            print("FAIL — build_flow.py が動かない\n" + r.stderr[-800:]); return 1
        gen = json.load(open(os.path.join(work, "flow.json"), encoding="utf-8"))
    cur = json.load(open(os.path.join(SRC, "flow.json"), encoding="utf-8"))
    d = diff(cur, gen)
    if d:
        print(f"FAIL — flow.json が data.py から作ったものと {len(d)} か所違う（flow.json を直接直さず、05_flow/data.py を直して build_flow.py を回す）")
        for x in d[:40]: print("  -", x)
        return 1
    print("PASS — flow.json は data.py から作り直しても同じ（直接の書き換えなし）")
    return 0

if __name__ == "__main__":
    sys.exit(main())
