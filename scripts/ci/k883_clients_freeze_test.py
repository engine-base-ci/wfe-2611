#!/usr/bin/env python3
"""K-883 の試験：取引先の表（clients・client_contacts・client_groups）と検収の表（acceptances）を目録で凍結に移す（消さない・コードが使い始めたら flow_db_gate の FD3 で赤）。

  python3 scripts/ci/k883_clients_freeze_test.py      行 ID は K883-DB-NNN（チケット 11_tickets/K-883.md の表の行と 1 対 1）

見ること：目録（03_architecture/db-catalog.json）の区分と理由・凍結の範囲（取引先を持たない D-155.35・検収を作らない D-155.44 の 4 つの表。
client_requests は依頼で使うので骨格のまま）・使い始めたら赤になること（本物の検査の道具 check_catalog に、
わざと使うコードを渡す）・今のコードは使っていないこと（K-924・K-926 が契約の取引先・検収の行の守りを外した後であること）・表は消さないこと（migration は変えない）・文書（ER 図・目録の写し）。
テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "ci"))
import flow_db_gate as G  # noqa: E402

CATALOG = ROOT / "03_architecture" / "db-catalog.json"
CATALOG_JSON = ROOT / "03_architecture" / "catalog.json"
CATALOG_MD = ROOT / "03_architecture" / "catalog.md"
ER = ROOT / "03_architecture" / "ER図.md"
MIGRATION_0074 = ROOT / "packages" / "db" / "migrations" / "0074_clients.sql"
FROZEN_NOW = ("clients", "client_contacts", "client_groups", "acceptances")
FROZEN_TOTAL = 72  # 今まで 60 ＋ この葉の 4 つ ＋ 段10 が凍結した 10（checks・imports・kind_sections・knowledge_links・learning_candidates・memories・policies・skill_test_runs・skill_versions・skills・K-722 ほか）－ 本体の関数が使うので凍結から外した 2（plan_versions・distribution_versions・PM の決め 2026-11-28）


def tables() -> dict[str, dict]:
    return json.loads(CATALOG.read_text(encoding="utf-8"))["tables"]


class ClientsFreeze(unittest.TestCase):
    def test_K883_DB_001_four_tables_frozen_with_reason(self) -> None:
        """目録で clients・client_contacts・client_groups・acceptances が frozen・理由に D-155.35（取引先を持たない）か D-155.44（検収を作らない）と「使わない」を書く"""
        t = tables()
        for name in FROZEN_NOW:
            self.assertEqual(t[name]["class"], "frozen", name)
            why = t[name]["why"]
            self.assertIn("D-155.44" if name == "acceptances" else "D-155.35", why, name)
            self.assertIn("使わない", why, name)

    def test_K883_DB_002_range_of_the_freeze(self) -> None:
        """凍結の範囲：client_requests は依頼（ゲストのグループの依頼）で使うので skeleton のまま。ゲストのグループの表（K-876）は凍結にしない"""
        t = tables()
        self.assertEqual(t["client_requests"]["class"], "skeleton")
        for name in ("guest_groups", "guest_group_members"):
            if name in t:  # K-876 が入った後の木では目録に在る
                self.assertNotEqual(t[name]["class"], "frozen", name)

    def test_K883_DB_003_using_them_turns_red(self) -> None:
        """使い始めたら赤：本物の check_catalog に、4 つの表を使うコードを渡すと FD3 が表ごとに 1 件ずつ出る（client_requests などほかの表は出ない）"""
        cat = json.loads(CATALOG.read_text(encoding="utf-8"))
        refs = {
            "clients": {"apps/api/src/x.ts"},
            "client_contacts": {"apps/api/src/y.ts"},
            "client_groups": {"apps/api/src/w.ts"},
            "acceptances": {"apps/api/src/v.ts"},
            "client_requests": {"apps/api/src/z.ts"},
        }
        fails = G.check_catalog(cat, G.migration_tables(str(ROOT)), refs, set())
        fd3 = [f for f in fails if f.startswith("FD3")]
        self.assertEqual(len(fd3), 4, fd3)
        for name in FROZEN_NOW:
            self.assertTrue(any(f"{name}" in f for f in fd3), (name, fd3))
        self.assertEqual([f for f in fails if not f.startswith("FD3")], [], fails)

    def test_K883_DB_004_code_does_not_use_them_now(self) -> None:
        """今のコード（apps・packages の src・生成物の契約 registry.ts を含む）は 4 つの表を使っていない（K-924・K-926 が取引先・検収の口と行の守りを外した後）。flow_db_gate.py 本体が 0 で終わる"""
        refs = G.src_refs(str(ROOT))
        for name in FROZEN_NOW:
            self.assertNotIn(name, refs, f"{name} を使うコード：{sorted(refs.get(name, []))}")
        r = subprocess.run([sys.executable, "scripts/ci/flow_db_gate.py"], cwd=ROOT, capture_output=True, text=True, timeout=120)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertNotIn("FD3", r.stdout)

    def test_K883_DB_005_tables_are_kept(self) -> None:
        """消さない：migration で 4 つの表は作られたまま（drop が無い）・0074 は作る文を持ったまま"""
        made = G.migration_tables(str(ROOT))
        for name in FROZEN_NOW:
            self.assertIn(name, made, name)
        sql = MIGRATION_0074.read_text(encoding="utf-8")
        self.assertIn("create table if not exists clients (", sql)
        self.assertIn("create table if not exists client_contacts (", sql)
        self.assertNotRegex(sql.lower(), r"drop table")

    def test_K883_DB_006_er_notes(self) -> None:
        """ER 図：clients・client_contacts・client_groups・acceptances の行に「凍結（K-883」の字と決定（D-155.35 か D-155.44）・client_requests の行には付けない"""
        lines = ER.read_text(encoding="utf-8").splitlines()
        row = {n: next(l for l in lines if l.startswith(f"| **`{n}`**")) for n in (*FROZEN_NOW, "client_requests")}
        for name in FROZEN_NOW:
            self.assertIn("凍結（K-883", row[name], name)
            self.assertIn("D-155.44" if name == "acceptances" else "D-155.35", row[name], name)
        self.assertNotIn("凍結（K-883", row["client_requests"])

    def test_K883_DB_007_generated_catalog_follows(self) -> None:
        """目録の写し（catalog.json・catalog.md）：4 つの表が frozen・凍結の表の数が 64・名前の並びに 4 つが入る"""
        db = {d["table"]: d for d in json.loads(CATALOG_JSON.read_text(encoding="utf-8"))["db"]}
        for name in FROZEN_NOW:
            self.assertEqual(db[name]["class"], "frozen", name)
        self.assertEqual(db["client_requests"]["class"], "skeleton")
        md = CATALOG_MD.read_text(encoding="utf-8")
        m = re.search(r"^凍結の表（(\d+)）：(.*)$", md, re.M)
        self.assertIsNotNone(m, "catalog.md に凍結の表の行が無い")
        self.assertEqual(int(m.group(1)), FROZEN_TOTAL)
        for name in FROZEN_NOW:
            self.assertIn(f"`{name}`", m.group(2), name)
        self.assertEqual(sum(1 for d in db.values() if d["class"] == "frozen"), FROZEN_TOTAL)

    def test_K883_DB_008_counts_agree(self) -> None:
        """数が合う：目録の frozen の数＝64＝catalog.json の frozen の数。区分は 3 つの外に出ない"""
        t = tables()
        self.assertEqual(sum(1 for v in t.values() if v["class"] == "frozen"), FROZEN_TOTAL)
        self.assertTrue(all(v["class"] in G.CLASSES and v.get("why") for v in t.values()))


if __name__ == "__main__":
    unittest.main()
