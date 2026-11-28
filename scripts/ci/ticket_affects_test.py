#!/usr/bin/env python3
"""K-107 の試験：チケットの形の検査 K8（scripts/tickets/build_index.py）。これから切るチケットは影響の範囲（affects）が要る。

  python3 scripts/ci/ticket_affects_test.py      全部の行（行 ID は K107-K8-NNN。チケット 11_tickets/K-107.md の行と 1 対 1）
  python3 scripts/tickets/build_index.py --selftest  検査自身の自己試験（K8 を足すときに作る。下の K8-007 がその形を見る）

  build_index.check() に作りもののチケット（parse() と同じ形の dict）を渡し、[K8] の赤だけを見る。
  K8 の決まり（K-107 の決定 3）：
    ・K-107 より後の番号（K-108〜）で、子の無いチケット（split: これから のまとまりを除く）は affects が要る
    ・affects の値はワークスペースのパッケージの名前（apps/*・packages/* の package.json の name）。[] は「パッケージに触らない」
    ・ci_wide の値は db・shared・ci・lockfile のどれか
    ・K-107 までのチケット（仕組みの前）は affects が無くても赤にしない
"""
from __future__ import annotations

import pathlib
import subprocess
import sys
import unittest

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "tickets"))
import build_index  # noqa: E402

SECTIONS = {"目的": "試し", "完了の条件": "試し", "実施事項": "試し", "テスト仕様と確認の結果": "試し"}


def t(tid: str, **kw) -> dict:
    base = {"id": tid, "title": "試し", "kind": "タスク", "stage": "未着手", "parent": "", "assignee": "作る",
            "decisions": [], "depends_on": [], "split": "", "sections": dict(SECTIONS), "file": f"11_tickets/{tid}.md"}
    return {**base, **kw}


def k8(ts: list[dict]) -> list[str]:
    return [m for m in build_index.check(ts) if m.startswith("[K8]")]


class K8Test(unittest.TestCase):
    def test_K107_K8_001_new_ticket_without_affects_is_red(self) -> None:
        got = k8([t("K-108")])
        self.assertEqual(len(got), 1, got)
        self.assertIn("K-108", got[0])
        self.assertIn("affects", got[0])

    def test_K107_K8_002_old_ticket_without_affects_is_ok(self) -> None:
        self.assertEqual(k8([t("K-106"), t("K-107")]), [])

    def test_K107_K8_003_parent_and_unsplit_need_no_affects(self) -> None:
        ts = [t("K-108"), t("K-109", parent="K-108", affects=["@kaname/web"]), t("K-110", split="これから")]
        self.assertEqual(k8(ts), [])   # 子のある K-108・まだ切っていない K-110 は要らない

    def test_K107_K8_004_empty_affects_is_ok(self) -> None:
        self.assertEqual(k8([t("K-108", affects=[])]), [])   # 文書だけのチケット

    def test_K107_K8_005_unknown_package_is_red(self) -> None:
        got = k8([t("K-108", affects=["@kaname/web", "@kaname/nai"])])
        self.assertEqual(len(got), 1, got)
        self.assertIn("@kaname/nai", got[0])

    def test_K107_K8_006_ci_wide_values(self) -> None:
        self.assertEqual(k8([t("K-108", affects=["@kaname/db"], ci_wide=["db", "shared", "ci", "lockfile"])]), [])
        got = k8([t("K-108", affects=["@kaname/db"], ci_wide=["migration"])])
        self.assertEqual(len(got), 1, got)
        self.assertIn("migration", got[0])
        # 古いチケットでも、書いたなら値は見る
        self.assertEqual(len(k8([t("K-50", ci_wide=["zenbu"])])), 1)

    def test_K107_K8_008_number_boundary(self) -> None:
        # 番号は数で比べる（文字で比べると K-10 と K-107・K-1070 と K-108 を取り違える）
        self.assertEqual(k8([t("K-10"), t("K-99"), t("K-107")]), [])
        got = k8([t("K-1070"), t("K-108")])
        self.assertEqual(sorted(m.split()[1] for m in got), ["K-1070", "K-108"], got)

    def test_K107_K8_007_selftest_exists_and_green(self) -> None:
        src = (ROOT / "scripts/tickets/build_index.py").read_text(encoding="utf-8")
        self.assertIn("K8", src.split('"""')[1])   # docstring に K8 の決まりが書いてある
        r = subprocess.run([sys.executable, "scripts/tickets/build_index.py", "--selftest"], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("K8", r.stdout)   # 自己試験が K8 の赤を起こしている


if __name__ == "__main__":
    unittest.main(verbosity=2)
