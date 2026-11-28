#!/usr/bin/env python3
"""No Ticket, No Commit（D-128.147）：決まりを始めたコミットより後のコミットは、どれもメッセージにチケットの番号（K-数字）を持つ。
  python3 scripts/ci/ticket_commit_gate.py             START..HEAD のコミットを見る（START は決まりを始めた時点の先頭のコミット）
  python3 scripts/ci/ticket_commit_gate.py --selftest  番号の無いメッセージが赤になるか
"""
from __future__ import annotations
import re, subprocess, sys

START = "2fc247a62ee2c34dd400118e301514c00b922777"   # 2026-11-05：この時点の先頭のコミット。これより前は決まりを始める前なので見ない
TICKET = re.compile(r"\bK-\d+\b")
# 決める人の決定 F2（本線を人の手で直すときはフックを外して行う）で PM が手で入れた取り込み。番号を付け忘れた merge コミット。
#   本線は push 済みで書き換えないので、理由つきでここに載せる（理由の無い例外は足さない・2026-11-09）
EXEMPT = {
    "1fa39691": "2026-11-09 決める人「フックを外して入れる」で進め方の変更（K-103・D-132）を本線に入れた merge コミット（k103-process への本線の取り込み）。番号の付け忘れ",
    "07430fbeba": "統合の枝（int/m1128）の担当の合わせ・push 済みで書き換えられない・11-28 PM の決め（件名 merge int/m1128 で番号の付け忘れ。以後は int_put.sh が件名に K-<番号> の無いコミットを受けない）",
    "8a8d172705": "統合の枝（int/m1128）の担当の合わせ・push 済みで書き換えられない・11-28 PM の決め（件名 merge int/m1128 で番号の付け忘れ。以後は int_put.sh が件名に K-<番号> の無いコミットを受けない）",
    "56e2f69a55": "統合の枝（int/m1128）の担当の合わせ・push 済みで書き換えられない・11-28 PM の決め（件名 merge int/m1128 で番号の付け忘れ。以後は int_put.sh が件名に K-<番号> の無いコミットを受けない）",
}


def bad(messages: list[tuple[str, str]]) -> list[str]:
    return [f"{sha[:10]} {subj}" for sha, subj in messages if not TICKET.search(subj) and not any(sha.startswith(k) for k in EXEMPT)]


def main() -> int:
    if "--selftest" in sys.argv:
        ok = bad([("a" * 40, "K-51 feat: 登録する"), ("b" * 40, "chore: 番号なし")]) == ["bbbbbbbbbb chore: 番号なし"]
        print("selftest ok" if ok else "selftest NG")
        return 0 if ok else 1
    out = subprocess.run(["git", "log", "--format=%H%x09%s", f"{START}..HEAD"], capture_output=True, text=True)
    if out.returncode != 0:
        print(f"★ FAIL git log が読めない: {out.stderr.strip()[:200]}")
        return 1
    rows = [tuple(l.split("\t", 1)) for l in out.stdout.splitlines() if "\t" in l]
    b = bad(rows)
    for x in b:
        print(f"  ★ チケットの番号（K-数字）の無いコミット: {x}")
    print(f"コミット {len(rows)} 本・番号の無いもの {len(b)} 本")
    print("PASS — どのコミットにもチケットの番号がある" if not b else "FAIL — チケットの番号の無いコミットがある（No Ticket, No Commit）")
    return 0 if not b else 1


if __name__ == "__main__":
    sys.exit(main())
