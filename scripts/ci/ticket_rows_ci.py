#!/usr/bin/env python3
"""ticket_rows_ci.py（K-146・D-129.52 の ②）— 着手前のチケットだけに、チケットの形の検査（ticket_rows_gate の K13・K14）を当てる。

  K13 曖昧な期待結果（「片付ける」「適切に扱う」だけで、起きる結果が無い行）
  K14 別のチケットに回した機能を前提にしているのに、このチケットの間の振る舞いが無い行

当てるのは 11_tickets/K-*.md のうち、頭の stage が「未着手」のものだけ（直下だけ・_old は見ない）。
作業中・確認中・保留・完了のチケットは当てない（取り込み済みを赤にしない）。

  python3 scripts/ci/ticket_rows_ci.py [--dir 11_tickets]
  終わり方：0＝PASS（当てた枚数を出す）／1＝赤の行がある（ファイル:行 を出す）
"""
import argparse, pathlib, re, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ticket_rows_gate  # noqa: E402

PENDING = "未着手"
STAGE = re.compile(r"^stage:\s*(\S+)\s*$", re.M)


def stage_of(text: str) -> str | None:
    """頭（最初の --- と次の --- の間）の stage。頭が無ければ None"""
    if not text.startswith("---"):
        return None
    head = text.split("\n---", 1)[0]
    m = STAGE.search(head)
    return m.group(1) if m else None


def targets(tickets_dir: pathlib.Path) -> list[pathlib.Path]:
    """着手前（stage: 未着手）のチケットの .md を名前の順に返す"""
    out = []
    for p in sorted(pathlib.Path(tickets_dir).glob("K-*.md")):
        if stage_of(p.read_text(encoding="utf-8")) == PENDING:
            out.append(p)
    return out


def check(tickets_dir: pathlib.Path) -> tuple[list[pathlib.Path], list[tuple[str, str]]]:
    files = targets(tickets_dir)
    fails = []
    for p in files:
        text = p.read_text(encoding="utf-8")
        fails += ticket_rows_gate.check_text(text, ticket_rows_gate.prefix_of(p, text), str(p))
    return files, fails


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--dir", default="11_tickets")
    a = ap.parse_args()
    d = pathlib.Path(a.dir)
    if not d.is_dir():
        print(f"FAIL — チケットの置き場 {d} が無い")
        return 1
    files, fails = check(d)
    if fails:
        print(f"FAIL — 着手前のチケット {len(files)} 枚のうち、決まっていない行 {len(fails)} 件（切る時点で決める・決める人に聞くことは聞く）")
        for g, m in fails:
            print(f"  [{g}] {m}")
        return 1
    print(f"PASS — 着手前のチケット {len(files)} 枚に K13・K14 を当てた（赤 0）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
