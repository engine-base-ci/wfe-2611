#!/usr/bin/env python3
"""K-325 の試験：表をチケットごとのファイル（<名前>.d/K-xxx.*）に分けて足し合わせる。

  python3 scripts/ci/k325_registries_test.py      行 ID は K325-REG-NNN（チケット 11_tickets/K-325.md の表の行と 1 対 1）

断片は一時フォルダに作る（DB なし）。REG-015〜018 は本物のリポジトリの形を読む。
"""
from __future__ import annotations

import importlib.util
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ci"))

import registry_d  # noqa: E402
import build_registries  # noqa: E402

GENERATED = ["07_qa/test-specs/errors.json", "07_qa/test-plan/ears-elsewhere.json", "scripts/ci/ci_scope.json"]
KINDS = {"07_qa/test-specs/errors.json": ("errors", "07_qa/test-specs/errors.d"),
         "07_qa/test-plan/ears-elsewhere.json": ("ears", "07_qa/test-plan/ears-elsewhere.d"),
         "scripts/ci/ci_scope.json": ("ci_scope", "scripts/ci/ci_scope.d")}


class Tmp(unittest.TestCase):
    def setUp(self) -> None:
        self._t = tempfile.TemporaryDirectory()
        self.d = pathlib.Path(self._t.name)

    def tearDown(self) -> None:
        self._t.cleanup()

    def put(self, name: str, text: str) -> pathlib.Path:
        p = self.d / name
        p.write_text(text, encoding="utf-8")
        return p

    def put_json(self, name: str, obj: object) -> pathlib.Path:
        return self.put(name, json.dumps(obj, ensure_ascii=False))


class MergePy(Tmp):
    def test_K325_REG_001_dict_entries_from_two_fragments(self) -> None:
        self.put("K-1.py", 'PERMS = {"a": 1}\n')
        self.put("K-2.py", 'PERMS = {"b": 2}\n')
        target = {"PERMS": {"z": 0}}
        used = registry_d.merge_py(target, self.d, names=["PERMS"])
        self.assertEqual(target["PERMS"], {"z": 0, "a": 1, "b": 2})
        self.assertEqual([p.name for p in used], ["K-1.py", "K-2.py"])

    def test_K325_REG_002_same_key_in_two_fragments_stops(self) -> None:
        self.put("K-1.py", 'PERMS = {"key_a7": 1}\n')
        self.put("K-2.py", 'PERMS = {"key_a7": 2}\n')
        with self.assertRaises(registry_d.RegistryConflict) as cm:
            registry_d.merge_py({"PERMS": {}}, self.d, names=["PERMS"])
        msg = str(cm.exception)
        for word in ("K-1.py", "K-2.py", "PERMS", "key_a7"):
            self.assertIn(word, msg)

    def test_K325_REG_003_fragment_cannot_overwrite_base(self) -> None:
        self.put("K-1.py", 'PERMS = {"key_b3": 1}\n')
        target = {"PERMS": {"key_b3": 0}}
        with self.assertRaises(registry_d.RegistryConflict) as cm:
            registry_d.merge_py(target, self.d, names=["PERMS"])
        self.assertIn("key_b3", str(cm.exception))
        self.assertIn("K-1.py", str(cm.exception))
        self.assertEqual(target["PERMS"]["key_b3"], 0)

    def test_K325_REG_004_sets_union_and_lists_join_in_name_order(self) -> None:
        self.put("K-2.py", 'LIST_OPS = {"y"}\nROWS = [2]\n')
        self.put("K-1.py", 'LIST_OPS = {"x"}\nROWS = [1]\n')
        target = {"LIST_OPS": {"w"}, "ROWS": [0]}
        registry_d.merge_py(target, self.d, names=["LIST_OPS", "ROWS"])
        self.assertEqual(target["LIST_OPS"], {"w", "x", "y"})
        self.assertEqual(target["ROWS"], [0, 1, 2])

    def test_K325_REG_005_screen_rows_join(self) -> None:
        self.put("K-1.py", 'SCREEN_API = {"s": [("POST", "/b", "A2", "t", "opB", [])], '
                           '"s2": [("GET", "/c", "A3", "t", "opC", [])]}\n')
        target = {"SCREEN_API": {"s": [("GET", "/a", "A1", "t", "opA", [])]}}
        registry_d.merge_py(target, self.d, names=["SCREEN_API"], screen_lists=["SCREEN_API"])
        self.assertEqual([r[4] for r in target["SCREEN_API"]["s"]], ["opA", "opB"])
        self.assertEqual([r[4] for r in target["SCREEN_API"]["s2"]], ["opC"])

    def test_K325_REG_006_same_operation_on_another_screen_stops(self) -> None:
        self.put("K-1.py", 'SCREEN_API = {"other": [("GET", "/x", "A9", "t", "opA", [])]}\n')
        target = {"SCREEN_API": {"s": [("GET", "/a", "A1", "t", "opA", [])]}}
        with self.assertRaises(registry_d.RegistryConflict) as cm:
            registry_d.merge_py(target, self.d, names=["SCREEN_API"], screen_lists=["SCREEN_API"])
        self.assertIn("opA", str(cm.exception))
        self.assertIn("K-1.py", str(cm.exception))

    def test_K325_REG_007_unknown_name_stops(self) -> None:
        self.put("K-1.py", 'PERM = {"a": 1}\n')
        with self.assertRaises(registry_d.RegistryConflict) as cm:
            registry_d.merge_py({"PERMS": {}}, self.d, names=["PERMS"])
        self.assertIn("PERM", str(cm.exception))
        self.assertIn("K-1.py", str(cm.exception))

    def test_K325_REG_008_file_name_rule(self) -> None:
        self.put("K-1.json", "{}")
        self.put("README.md", "置き方")
        self.assertEqual(registry_d.fragments(self.d, ".py"), [])
        for bad in ("extra.py", "k-1.py"):
            p = self.put(bad, "X = 1\n")
            with self.assertRaises(registry_d.RegistryConflict) as cm:
                registry_d.fragments(self.d, ".py")
            self.assertIn(bad, str(cm.exception))
            p.unlink()

    def test_K325_REG_009_broken_fragment_names_file(self) -> None:
        self.put("K-1.py", "PERMS = {\n")
        with self.assertRaises(registry_d.RegistryConflict) as cm:
            registry_d.merge_py({"PERMS": {}}, self.d, names=["PERMS"])
        self.assertIn("K-1.py", str(cm.exception))


class Build(Tmp):
    def test_K325_REG_010_errors_join_after_base(self) -> None:
        self.put_json("_base.json", {"version": "3", "classes": [{"id": "VAL"}],
                                     "errors": [{"id": "E-VAL-001"}, {"id": "E-VAL-002"}], "meta": {"n": 1}})
        self.put_json("K-3.json", {"errors": [{"id": "E-VAL-003"}]})
        out = build_registries.build("errors", self.d)
        self.assertEqual([e["id"] for e in out["errors"]], ["E-VAL-001", "E-VAL-002", "E-VAL-003"])
        self.assertEqual(out["version"], "3")
        self.assertEqual(out["classes"], [{"id": "VAL"}])
        self.assertEqual(out["meta"], {"n": 1})

    def test_K325_REG_011_cli_stops_on_same_error_id(self) -> None:
        self.put_json("_base.json", {"version": "3", "classes": [], "errors": []})
        self.put_json("K-3.json", {"errors": [{"id": "E-INV-007"}]})
        self.put_json("K-4.json", {"errors": [{"id": "E-INV-007"}]})
        out = self.d / "errors.json"
        r = subprocess.run([sys.executable, str(ROOT / "scripts" / "ci" / "build_registries.py"),
                            "--only", "errors", "--dir", str(self.d), "--out", str(out)],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        last = (r.stdout + r.stderr).strip().splitlines()[-1]
        for word in ("K-3.json", "K-4.json", "E-INV-007"):
            self.assertIn(word, last)
        self.assertFalse(out.exists())

    def test_K325_REG_012_base_only_keys(self) -> None:
        self.put_json("_base.json", {"version": "3", "classes": [], "errors": []})
        self.put_json("K-3.json", {"version": "9"})
        with self.assertRaises(registry_d.RegistryConflict) as cm:
            build_registries.build("errors", self.d)
        self.assertIn("version", str(cm.exception))

    def test_K325_REG_013_ears_ops(self) -> None:
        self.put_json("_base.json", {"_doc": "d", "ops": {"opA": {"file": "a"}}})
        self.put_json("K-5.json", {"ops": {"opB": {"file": "b"}}})
        self.assertEqual(sorted(build_registries.build("ears", self.d)["ops"]), ["opA", "opB"])
        self.put_json("K-6.json", {"ops": {"opB": {"file": "c"}}})
        with self.assertRaises(registry_d.RegistryConflict) as cm:
            build_registries.build("ears", self.d)
        for word in ("opB", "K-5.json", "K-6.json"):
            self.assertIn(word, str(cm.exception))

    def test_K325_REG_014_ci_scope_links_and_reads(self) -> None:
        self.put_json("_base.json", {"_doc": "d", "data_links": [{"paths": ["p0"], "tests": ["t0"]}],
                                     "reads_ok": {"rk_a5": "x"}, "no_test_paths": []})
        self.put_json("K-7.json", {"data_links": [{"paths": ["p1"], "tests": ["t1"]}], "reads_ok": {"rk_b6": "y"}})
        out = build_registries.build("ci_scope", self.d)
        self.assertEqual([d["paths"] for d in out["data_links"]], [["p0"], ["p1"]])
        self.assertEqual(out["reads_ok"], {"rk_a5": "x", "rk_b6": "y"})
        self.put_json("K-8.json", {"reads_ok": {"rk_a5": "z"}})
        with self.assertRaises(registry_d.RegistryConflict) as cm:
            build_registries.build("ci_scope", self.d)
        self.assertIn("rk_a5", str(cm.exception))
        self.assertIn("K-8.json", str(cm.exception))


class More(Tmp):
    def test_K325_REG_019_errors_classes_from_fragment(self) -> None:
        self.put_json("_base.json", {"version": "3", "classes": [{"id": "VAL"}], "errors": []})
        self.put_json("K-3.json", {"classes": [{"id": "INVX"}], "errors": [{"id": "E-INVX-001"}]})
        out = build_registries.build("errors", self.d)
        self.assertEqual([c["id"] for c in out["classes"]], ["VAL", "INVX"])
        self.put_json("K-4.json", {"classes": [{"id": "INVX"}]})
        with self.assertRaises(registry_d.RegistryConflict) as cm:
            build_registries.build("errors", self.d)
        for word in ("INVX", "K-3.json", "K-4.json"):
            self.assertIn(word, str(cm.exception))

    def test_K325_REG_020_ci_scope_no_test_paths(self) -> None:
        self.put_json("_base.json", {"data_links": [], "reads_ok": {}, "no_test_paths": ["doc/a.md"]})
        self.put_json("K-7.json", {"no_test_paths": ["doc/b_k7.md"]})
        self.assertEqual(build_registries.build("ci_scope", self.d)["no_test_paths"], ["doc/a.md", "doc/b_k7.md"])
        self.put_json("K-8.json", {"no_test_paths": ["doc/b_k7.md"]})
        with self.assertRaises(registry_d.RegistryConflict) as cm:
            build_registries.build("ci_scope", self.d)
        self.assertIn("doc/b_k7.md", str(cm.exception))

    def test_K325_REG_021_missing_folder(self) -> None:
        gone = self.d / "nothing.d"
        target = {"PERMS": {"z": 0}}
        self.assertEqual(registry_d.merge_py(target, gone, names=["PERMS"]), [])
        self.assertEqual(target, {"PERMS": {"z": 0}})
        with self.assertRaises(registry_d.RegistryConflict) as cm:
            build_registries.build("errors", gone)
        self.assertIn("_base.json", str(cm.exception))

    def test_K325_REG_022_ci_scope_base_only_keys(self) -> None:
        self.put_json("_base.json", {"data_links": [], "reads_ok": {}, "no_test_paths": [], "gates": {"1": []}})
        self.put_json("K-9.json", {"gates": {"99": ["x"]}})
        with self.assertRaises(registry_d.RegistryConflict) as cm:
            build_registries.build("ci_scope", self.d)
        self.assertIn("gates", str(cm.exception))
        self.assertIn("K-9.json", str(cm.exception))

    def test_K325_REG_023_helpers_and_private_names(self) -> None:
        self.put("K-1.py", 'PERMS = {"k1_" + T: 1}\n_tmp = 2\n')
        target = {"PERMS": {}}
        registry_d.merge_py(target, self.d, helpers={"T": "tickets"})
        self.assertEqual(target, {"PERMS": {"k1_tickets": 1}})
        self.put("K-2.py", "UNKNOWN_K2 = {1}\n")
        with self.assertRaises(registry_d.RegistryConflict) as cm:
            registry_d.merge_py({"PERMS": {}}, self.d, helpers={"T": "tickets"})
        self.assertIn("UNKNOWN_K2", str(cm.exception))


class Repo(unittest.TestCase):
    def test_K325_REG_015_generated_files_match(self) -> None:
        r = subprocess.run([sys.executable, str(ROOT / "scripts" / "ci" / "build_registries.py"), "--check"],
                           cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        for rel, (kind, d) in KINDS.items():
            have = json.loads((ROOT / rel).read_text(encoding="utf-8"))
            self.assertEqual(have, build_registries.build(kind, ROOT / d), rel)

    def test_K325_REG_016_registered_as_generated(self) -> None:
        gen = json.loads((ROOT / "scripts" / "ci" / "generated.json").read_text(encoding="utf-8"))
        mine = [g for g in gen["generators"] if "build_registries.py" in g["run"]]
        self.assertEqual(len(mine), 1)
        self.assertEqual(sorted(mine[0]["outputs"]), sorted(GENERATED))
        flow_text = (ROOT / "ticket-flow.yaml").read_text(encoding="utf-8")
        flow = yaml.safe_load(flow_text)
        for rel in GENERATED:
            self.assertIn(rel, flow["changes_ignore"])
        hand = [line for line in flow_text.splitlines() if "手で持つ物" in line]
        self.assertFalse([line for line in hand if "ears-elsewhere.json" in line], hand)

    def test_K325_REG_017_real_readers_load_fragments(self) -> None:
        with tempfile.TemporaryDirectory() as t:
            root = pathlib.Path(t)
            (root / "05_flow" / "screen_api.d").mkdir(parents=True)
            (root / "scripts" / "ci").mkdir(parents=True)
            shutil.copy(ROOT / "05_flow" / "screen_api.py", root / "05_flow" / "screen_api.py")
            shutil.copy(ROOT / "scripts" / "ci" / "registry_d.py", root / "scripts" / "ci" / "registry_d.py")
            (root / "05_flow" / "screen_api.d" / "K-1.py").write_text(
                'PERMS = {"k325Probe": ("read", "試し", False)}\n'
                'LIST_OPS = {"k325Probe"}\n'
                'SCREEN_API = {"k325_screen": [("GET", "/k325-probe", "A1", T, "k325Probe", [])]}\n'
                "_scratch = 1\n", encoding="utf-8")
            spec = importlib.util.spec_from_file_location("screen_api_k325", root / "05_flow" / "screen_api.py")
            sa = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(sa)  # type: ignore[union-attr]
            self.assertEqual(sa.PERMS["k325Probe"], ("read", "試し", False))
            self.assertIn("k325Probe", sa.LIST_OPS)
            self.assertEqual(sa.SCREEN_API["k325_screen"][0][3], "tickets")
            self.assertIn("getMe", sa.TERMS_OPEN_OPS)
        import contract_shape_test as cs  # noqa: PLC0415
        self.assertEqual(set(cs.FRAGMENT_NAMES), {"REQUIRED_INPUTS", "NO_REQUIRED_INPUTS", "PATH_PATTERNS",
                                                 "VALUE_RANGES", "UNEXPRESSIBLE_422", "AGENT_ANSWERS"})
        src = (ROOT / "scripts" / "ci" / "contract_shape_test.py").read_text(encoding="utf-8")
        self.assertIn("merge_py(", src)
        self.assertIn("contract_shape.d", src)
        for frag in registry_d.fragments(ROOT / "scripts" / "ci" / "contract_shape.d", ".py"):
            ns: dict = {"CODE_SEP": cs.CODE_SEP, "CODE_CHAR": cs.CODE_CHAR}
            exec(compile(frag.read_text(encoding="utf-8"), str(frag), "exec"), ns)  # noqa: S102
            for name in cs.FRAGMENT_NAMES:
                for k, v in (ns.get(name) or {}).items():
                    self.assertEqual(getattr(cs, name)[k], v, f"{frag.name} {name}[{k}]")

    def test_K325_REG_018_scope_map_and_cut_check(self) -> None:
        import ci_scope  # noqa: PLC0415
        scope = json.loads((ROOT / "scripts" / "ci" / "ci_scope.json").read_text(encoding="utf-8"))
        links = [d for d in scope["data_links"] if "05_flow/screen_api.py" in d.get("paths", [])]
        self.assertTrue(links)
        for d in links:
            self.assertIn("05_flow/screen_api.d/**", d["paths"])
        rules = ci_scope.load_rules(str(ROOT / "scripts" / "ci" / "ci_scope.json"))
        for whole, part in (("05_flow/screen_api.py", "05_flow/screen_api.d/K-1.py"),
                            ("scripts/ci/contract_shape_test.py", "scripts/ci/contract_shape.d/K-1.py")):
            self.assertEqual(ci_scope.root_kind(part, rules, str(ROOT)), ci_scope.root_kind(whole, rules, str(ROOT)), part)
        import cut_check  # noqa: PLC0415
        for p in ("05_flow/screen_api.d/K-1.py", "scripts/ci/contract_shape.d/K-1.py",
                  "07_qa/test-specs/errors.d/K-1.json", "07_qa/test-plan/ears-elsewhere.d/K-1.json",
                  "scripts/ci/ci_scope.d/K-1.json"):
            self.assertTrue(cut_check._common(p), p)
        self.assertNotIn("05_flow/screen_api.d/", cut_check.COMMON_ENTRIES)


class NamedShape(Tmp):
    """K-990 が registry_d に足した「名前で指す」書き方（行は 11_tickets/K-990.md の K990-REG-001・002）"""

    def test_K990_REG_001_name_resolves_to_shape_in_same_table(self) -> None:
        self.put("K-1.py", 'RESPONSES = {"listA": ("Shape", {"id": "string", "n": "integer"})}\n')
        self.put("K-2.py", 'RESPONSES = {"decideA": "Shape"}\n')
        target = {"RESPONSES": {"base": ("Base", {"x": "string"})}}
        registry_d.merge_py(target, self.d, names=["RESPONSES"])
        self.assertEqual(target["RESPONSES"]["decideA"], ("Shape", {"id": "string", "n": "integer"}))
        self.assertIs(target["RESPONSES"]["decideA"], target["RESPONSES"]["listA"])
        self.assertEqual(target["RESPONSES"]["base"], ("Base", {"x": "string"}))

    def test_K990_REG_002_unknown_name_stops(self) -> None:
        self.put("K-1.py", 'RESPONSES = {"listA": ("Shape", {"id": "string"})}\n')
        self.put("K-2.py", 'RESPONSES = {"decideA": "Missing"}\n')
        with self.assertRaises(registry_d.RegistryConflict) as cm:
            registry_d.merge_py({"RESPONSES": {}}, self.d, names=["RESPONSES"])
        msg = str(cm.exception)
        for word in ("K-2.py", "RESPONSES", "decideA", "Missing"):
            self.assertIn(word, msg)


if __name__ == "__main__":
    unittest.main(verbosity=2)
