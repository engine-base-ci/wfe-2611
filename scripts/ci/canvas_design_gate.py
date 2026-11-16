#!/usr/bin/env python3
"""キャンバスの値の検査（K-254・G71）：キャンバスの絵の色・書体・角丸・文字の大きさが、正本（DESIGN-kaname.md）の段に在るか。

  python3 scripts/ci/canvas_design_gate.py                    本物のキャンバス（04_design/canvas）を見る
  python3 scripts/ci/canvas_design_gate.py --canvas <置き場>   写しの置き場を見る（作り手を写しで流したとき）

中身は design_gate.py（D1 色・D2 書体・D3 角丸・D4 文字）をそのまま使う。違いは 3 つ：
  ・D1〜D4 が赤なら、どの絵がどの値で赤かを絵ごとに出す（design_gate は絵の名前を 3 つまでしか出さない）。
    絵の名前は台帳と同じ書き方（AiChat の形・.dc.html を付けない）
  ・D6（正本にあって絵に無い色・文字）は知らせとして出し、止めない（データの色の残りなど、絵に出ない色がある）
  ・D5（部品）は掛けない（キャンバスの絵は部品のクラスを持たない。部品とキャンバスの突き合わせは G70）
終わりの数：D1〜D4 が 0 件なら 0、1 件でもあれば 1。
"""
from __future__ import annotations

import argparse
import json
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
DESIGN = ROOT / "04_design" / "DESIGN-kaname.md"
CANVAS = ROOT / "04_design" / "canvas"
GATE = HERE / "design_gate.py"
STOP = ("D1_色_正本に無い", "D2_書体_正本に無い", "D3_角丸_段に無い", "D4_文字_段に無い")
NOTE = ("D6_未使用_色", "D6_未使用_文字")
SUFFIX = ".dc.html"


def gate(mocks: pathlib.Path, part: bool) -> dict:
    """design_gate.py を流して JSON を読む（置き場はフォルダのまま渡す：絶対の道のグロブは design_gate が読めない）"""
    cmd = [sys.executable, str(GATE), "--design", str(DESIGN), "--mocks", str(mocks), "--no-components", "--json"]
    r = subprocess.run(cmd + (["--part"] if part else []), capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        sys.exit(f"design_gate.py が読めない結果を返した（{r.returncode}）：{r.stdout[-400:]}{r.stderr[-400:]}")


def per_board(canvas: pathlib.Path) -> dict[str, dict[str, list[str]]]:
    """赤の絵ごとに、D1〜D4 のどの値が赤か（1 枚ずつ design_gate に掛ける。赤のときだけ流すので遅くてよい）"""
    out: dict[str, dict[str, list[str]]] = {}
    for f in sorted(canvas.glob("*" + SUFFIX)):
        res = gate(f, part=True)
        hit = {k: sorted(res.get(k) or {}) for k in STOP if res.get(k)}
        if hit:
            out[f.name.removesuffix(SUFFIX)] = hit
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--canvas", default=str(CANVAS), help="絵の置き場（既定は本物の 04_design/canvas）")
    a = ap.parse_args()
    canvas = pathlib.Path(a.canvas).resolve()
    if not canvas.is_dir() or not any(canvas.glob("*" + SUFFIX)):
        sys.exit(f"絵（*{SUFFIX}）が 1 枚も無い：{canvas}")

    whole = gate(canvas, part=False)
    print(f"キャンバス {whole.get('files')} 枚 / 正本 {DESIGN.name}（D5 は掛けない・D6 は知らせ）")
    red = 0
    for k in STOP:
        n = len(whole.get(k) or {})
        red += n
        print(f"  {k}: {n} 件" + (f"  {sorted(whole[k])[:8]}" if n else ""))
    for k in NOTE:
        v = whole.get(k) or []
        print(f"  {k}: {len(v)} 件（知らせ・止めない）" + (f"  {list(v)[:8]}" if v else ""))
    if red == 0:
        print("PASS")
        return 0
    print("赤の絵（絵：項目 値）：")
    for board, hit in per_board(canvas).items():
        print(f"  {board}：" + " ／ ".join(f"{k.split('_')[0]} {'・'.join(v)}" for k, v in hit.items()))
    print(f"不合格 {red} 件（直し方：絵は手で直さず、作り手 04_design/canvas_gen の tokensnap.py の表で正本の段に寄せる）")
    return 1


if __name__ == "__main__":
    sys.exit(main())
