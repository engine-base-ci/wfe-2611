#!/usr/bin/env python3
"""K-440 の試験：ears-elsewhere の断片どうしが同じ口（op）の covers を足し合わせる（build_registries.py）。

  python3 scripts/ci/k440_registries_test.py      行 ID は K440-REG-NNN（チケット 11_tickets/K-440.md の表の行と 1 対 1）

断片は一時フォルダに作る（DB なし）。
"""
from __future__ import annotations

import json
import pathlib
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ci"))

import build_registries  # noqa: E402
import registry_d  # noqa: E402


class Tmp(unittest.TestCase):
    def setUp(self) -> None:
        self._t = tempfile.TemporaryDirectory()
        self.d = pathlib.Path(self._t.name)

    def tearDown(self) -> None:
        self._t.cleanup()

    def put_json(self, name: str, obj: object) -> None:
        (self.d / name).write_text(json.dumps(obj, ensure_ascii=False), encoding="utf-8")


class OpCovers(Tmp):
    def test_K440_REG_001_two_fragments_covers_add_up(self) -> None:
        self.put_json("_base.json", {"_doc": "d", "ops": {"opZ": {"file": "z"}}})
        self.put_json("K-1.json", {"ops": {"opA": {"file": "a.test.ts", "reason": "r", "covers": {"t_one": "ROW-1"}}}})
        self.put_json("K-2.json", {"ops": {"opA": {"covers": {"t_two": {"file": "b.test.ts", "mark": "ROW-2"}}}}})
        self.put_json("K-3.json", {"ops": {"opA": {"file": "a.test.ts", "covers": {"t_three": "ROW-3"}}}})
        a = build_registries.build("ears", self.d)["ops"]["opA"]
        self.assertEqual(a["file"], "a.test.ts")
        self.assertEqual(a["reason"], "r")
        self.assertEqual(a["covers"], {"t_one": "ROW-1", "t_two": {"file": "b.test.ts", "mark": "ROW-2"}, "t_three": "ROW-3"})
        self.assertEqual(build_registries.build("ears", self.d)["ops"]["opZ"], {"file": "z"})

    def test_K440_REG_002_other_keys_differ_or_same_cover_or_base_stops(self) -> None:
        self.put_json("_base.json", {"_doc": "d", "ops": {"opB": {"file": "base.ts"}}})
        self.put_json("K-1.json", {"ops": {"opA": {"file": "a.ts", "covers": {"t_one": "ROW-1"}}}})
        # covers 以外（file）が違う
        self.put_json("K-2.json", {"ops": {"opA": {"file": "other.ts", "covers": {"t_two": "ROW-2"}}}})
        with self.assertRaises(registry_d.RegistryConflict) as cm:
            build_registries.build("ears", self.d)
        for word in ("opA", "K-1.json", "K-2.json", "file"):
            self.assertIn(word, str(cm.exception))
        # 同じ covers の名前を 2 つが結ぶ
        self.put_json("K-2.json", {"ops": {"opA": {"covers": {"t_one": "ROW-9"}}}})
        with self.assertRaises(registry_d.RegistryConflict) as cm:
            build_registries.build("ears", self.d)
        for word in ("opA", "K-1.json", "K-2.json", "t_one"):
            self.assertIn(word, str(cm.exception))
        # 3 つ目の断片が、2 つ目の断片が足した covers を結ぶ：止める文には持ち主の K-2.json が出る（口を最初に書いた K-1.json でない）
        self.put_json("K-2.json", {"ops": {"opA": {"covers": {"t_two": "ROW-2"}}}})
        self.put_json("K-3.json", {"ops": {"opA": {"covers": {"t_two": "ROW-3"}}}})
        with self.assertRaises(registry_d.RegistryConflict) as cm:
            build_registries.build("ears", self.d)
        for word in ("opA", "K-2.json", "K-3.json", "t_two"):
            self.assertIn(word, str(cm.exception))
        self.assertNotIn("K-1.json", str(cm.exception))
        (self.d / "K-3.json").unlink()
        # _base.json の口は断片が足せない
        self.put_json("K-2.json", {"ops": {"opB": {"covers": {"t_x": "ROW-1"}}}})
        with self.assertRaises(registry_d.RegistryConflict) as cm:
            build_registries.build("ears", self.d)
        for word in ("opB", "_base.json", "K-2.json"):
            self.assertIn(word, str(cm.exception))


if __name__ == "__main__":
    unittest.main()
