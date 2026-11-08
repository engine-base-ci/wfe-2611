#!/usr/bin/env python3
"""K-144 の試験：契約（08_api/openapi.yaml と、その元 05_flow/screen_api.py）が口の実際の振る舞いを書いているか。

  python3 scripts/ci/contract_shape_test.py      全部の行（行 ID は K144-SHAPE-NNN。チケット 11_tickets/K-144.md の表の行と 1 対 1）

  作り手を回した後の生成物（08_api/openapi.yaml・packages/contracts/src/schemas.ts・08_api/types.ts）を読んで確かめる。
  口の振る舞いそのもの（本物の DB で叩いた答えが契約の形に合うか）は apps/api/test/features/contract/k144-contract.test.ts が見る。
  決まり（D-129.42・2026-11-08 決める人）：
    ・入力の形は、契約で知らない項目を許さない（additionalProperties: false）。入口は前から strict（z.strictObject）
    ・uuid の欄は、契約に正式な uuid の形（format: uuid）を書き、入口で厳しく確かめる（422）。中で 500 になる道を残さない
    ・口が返す状態コード・答えの中身の形（null を含む）は、全部契約に書く（K-62 の契約の fuzz が赤にしないため）
"""
from __future__ import annotations

import importlib.util
import json
import pathlib
import re
import sys
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "05_flow"))


def _load_screen_api():
    spec = importlib.util.spec_from_file_location("screen_api_k144", ROOT / "05_flow" / "screen_api.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


SA = _load_screen_api()
OA = yaml.safe_load((ROOT / "08_api" / "openapi.yaml").read_text(encoding="utf-8"))
SCHEMAS = OA["components"]["schemas"]
DBC = json.loads((ROOT / "08_api" / "db-columns.json").read_text(encoding="utf-8"))["tables"]
EPS = json.loads((ROOT / "08_api" / "endpoints.json").read_text(encoding="utf-8"))["endpoints"]
ZOD = (ROOT / "packages" / "contracts" / "src" / "schemas.ts").read_text(encoding="utf-8")
TYPES = (ROOT / "08_api" / "types.ts").read_text(encoding="utf-8")

# INPUTS・RESPONSES の欄の型の名前として作り手（05_flow/build_api.py の _ftype）が表せるもの。後ろの ? は null を許す（any には付けない）
VOCAB = {"string", "integer", "number", "boolean", "object", "array", "uuid", "uuid[]"}

# K-57・K-60 の口（このチケットで契約を振る舞いにそろえる口）と、その振る舞いを書いたファイル
HOOK_FILES = [
    ROOT / "apps/api/src/features/F3/connect-pc/hooks.ts",
    ROOT / "apps/api/src/features/F4/create-ticket/hooks.ts",
]


def operation(op_id: str) -> tuple[str, str, dict]:
    for path, methods in OA["paths"].items():
        for method, op in methods.items():
            if isinstance(op, dict) and op.get("operationId") == op_id:
                return path, method, op
    raise AssertionError(f"契約に {op_id} が無い")


def ref_name(s: dict) -> str:
    return s["$ref"].rsplit("/", 1)[-1]


def prop(schema_name: str, field: str) -> dict:
    sc = SCHEMAS[schema_name]
    assert field in sc["properties"], f"{schema_name} に {field} が無い"
    return sc["properties"][field]


def table_of(op_id: str) -> str | None:
    """口の表（08_api/endpoints.json）。契約に無い口（RESPONSES にだけある名前）は None"""
    for e in EPS:
        oid = e.get("operation_id") or e["implementation_path"].split("::")[1]
        if oid == op_id:
            return e.get("table") or e["path"].split("/")[3]
    return None


def is_uuid(p: dict) -> bool:
    return p.get("type") == "string" and p.get("format") == "uuid"


def catalog_status() -> dict[str, int]:
    """エラーの正本（packages/errors）の ID → 状態コード（cls → STATUS_OF）"""
    idx = (ROOT / "packages/errors/src/index.ts").read_text(encoding="utf-8")
    block = re.search(r"STATUS_OF[^{]*\{([^}]*)\}", idx)
    assert block, "packages/errors/src/index.ts に STATUS_OF が無い"
    status_of = {k: int(v) for k, v in re.findall(r"(\w+):\s*(\d{3})", block.group(1))}
    cat = (ROOT / "packages/errors/src/catalog.ts").read_text(encoding="utf-8")
    out: dict[str, int] = {}
    for code, cls in re.findall(r'"(E-[A-Z]+-\d{3})":\s*\{\s*"id":\s*"E-[A-Z]+-\d{3}",\s*"cls":\s*"(\w+)"', cat):
        out[code] = status_of[cls]
    assert out, "エラーの正本が読めない"
    return out


def hook_blocks(src: str) -> dict[str, str]:
    """hooks のファイルを口（operationId）ごとの中身に分ける（`    opName: {` の行から次の同じ深さの行まで）"""
    heads = list(re.finditer(r"^    (\w+): \{\s*$", src, re.M))
    out = {}
    for i, m in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(src)
        out[m.group(1)] = src[m.start():end]
    return out


def statuses_in(block: str, cat: dict[str, int]) -> set[int]:
    """口の中身が返しうる状態コード：数の literal（status: 404・fail(404, …)）・正本の ID（fromCatalog("E-…")）・invalid(…)＝422"""
    s = {int(x) for x in re.findall(r"status:\s*(\d{3})", block)}
    s |= {int(x) for x in re.findall(r"\bfail\(\s*(\d{3})", block)}
    for code in re.findall(r'fromCatalog\(\s*"(E-[A-Z]+-\d{3})"', block):
        assert code in cat, f"エラーの正本に {code} が無い"
        s.add(cat[code])
    if re.search(r"\binvalid\(", block):
        s.add(422)
    return s


class ContractShapeTest(unittest.TestCase):
    # ---- 作り手が書ける形（R1 #3）
    def test_K144_SHAPE_001_input_and_answer_types_are_in_the_generator_vocabulary(self) -> None:
        """INPUTS・RESPONSES の欄の型の名前は、作り手が契約に書ける名前だけ（uuid・uuid[] を足した）。知らない名前を黙って string にしない"""
        bad = []
        for table in ("INPUTS", "RESPONSES"):
            for op_id, (_name, props) in getattr(SA, table).items():
                for k, v in props.items():
                    if v == "any" and table == "INPUTS":
                        continue
                    base = v[:-1] if v.endswith("?") else v
                    if base not in VOCAB:
                        bad.append(f"{table}.{op_id}.{k}={v}")
        self.assertEqual(bad, [], "作り手が表せない型の名前")

    # ---- 入力の知らない項目（R1 #4）
    def test_K144_SHAPE_002_every_request_body_rejects_unknown_fields(self) -> None:
        """要求の体の形は、全部 additionalProperties: false（入口の z.strictObject と同じ）。表の行の入力（*Input）と INPUTS の形の両方"""
        names = {ref_name(op["requestBody"]["content"]["application/json"]["schema"])
                 for methods in OA["paths"].values() for op in methods.values()
                 if isinstance(op, dict) and "requestBody" in op}
        names |= {n for n, _ in SA.INPUTS.values()}
        self.assertIn("PairingCodeInput", names)
        missing = sorted(n for n in names if SCHEMAS[n].get("additionalProperties") is not False)
        self.assertEqual(missing, [], "知らない項目を許している入力の形")

    def test_K144_SHAPE_003_pairing_code_input_is_empty_and_closed(self) -> None:
        """fuzz の赤 ③：createPairingCode の体は空の形で、知らない項目を許さない"""
        sc = SCHEMAS[ref_name(operation("createPairingCode")[2]["requestBody"]["content"]["application/json"]["schema"])]
        self.assertEqual(sc["properties"], {})
        self.assertIs(sc.get("additionalProperties"), False)

    # ---- uuid の欄（R1 #5・D-129.42）
    def test_K144_SHAPE_004_every_id_field_of_hand_written_inputs_is_uuid(self) -> None:
        """INPUTS の欄で名前が *_id のものは uuid、*_ids のものは uuid の並び（機械の決まり。口の中の正規表現に頼らない）"""
        bad = []
        for _op, (name, props) in SA.INPUTS.items():
            for k in props:
                p = SCHEMAS[name]["properties"][k]
                if k.endswith("_id") and not is_uuid(p):
                    bad.append(f"{name}.{k}")
                if k.endswith("_ids") and not (p.get("type") == "array" and is_uuid(p.get("items") or {})):
                    bad.append(f"{name}.{k}")
        self.assertEqual(bad, [], "uuid の形を契約に書いていない id の欄")

    def test_K144_SHAPE_005_known_uuid_fields_and_nullability(self) -> None:
        """口が uuid として確かめている欄（全文検索で洗い出したもの）は全部 format: uuid。送らなくてよい印の machine_id だけ null を許す"""
        want = {
            ("BridgeClaimInput", "machine_id"): True,
            ("TicketCreateInput", "scope_id"): False,
            ("TicketCreateInput", "kind_id"): False,
            ("TicketCreateInput", "assignee_member_id"): False,
            ("TicketCreateInput", "parent_ticket_id"): False,
            ("TicketCreateInput", "draft_id"): False,
            ("TicketCreateInput", "source_draft_id"): False,
            ("TicketDraftInput", "draft_id"): False,
            ("TermsConsentInput", "terms_version_id"): False,
            ("TermsConsentInput", "privacy_version_id"): False,
        }
        for (name, field), nullable in want.items():
            p = prop(name, field)
            self.assertTrue(is_uuid(p), f"{name}.{field} が format: uuid でない: {p}")
            self.assertEqual(bool(p.get("nullable")), nullable, f"{name}.{field} の null")
        items = prop("TicketCreateInput", "notify_member_ids").get("items") or {}
        self.assertTrue(is_uuid(items), f"TicketCreateInput.notify_member_ids の中身が uuid でない: {items}")

    def test_K144_SHAPE_006_generated_zod_checks_uuid_at_the_entrance(self) -> None:
        """作り手（scripts/ci/contract.mjs）が、入口の形（packages/contracts/src/schemas.ts）を z.uuid() にしている。並びの中身も"""
        def body(name: str) -> str:
            m = re.search(rf"export const {name} = z\.strictObject\(\{{(.*?)\n\}}\);", ZOD, re.S)
            self.assertIsNotNone(m, f"schemas.ts に {name} が無い")
            return m.group(1)  # type: ignore[union-attr]
        self.assertRegex(body("TicketDraftInput"), r"\n  draft_id: z\.uuid\(\)\.optional\(\),")
        self.assertRegex(body("BridgeClaimInput"), r"\n  machine_id: z\.uuid\(\)\.nullable\(\)\.optional\(\),")
        self.assertRegex(body("TicketCreateInput"), r"\n  notify_member_ids: z\.array\(z\.uuid\(\)\)\.optional\(\),")
        self.assertRegex(body("TermsConsentInput"), r"\n  terms_version_id: z\.uuid\(\)\.optional\(\),")

    # ---- 契約に無い応答（R1 #6）
    def test_K144_SHAPE_007_release_file_answers_are_all_in_the_contract(self) -> None:
        """fuzz の赤 ①：配布物の受け取りは 200（JSON の期限つき URL か、ファイルそのもの）・404（NOT_FOUND と E-CONN-014）・422・503（E-PAGE-007）"""
        _p, _m, op = operation("downloadBridgeRelease")
        r = op["responses"]
        ok = r["200"]["content"]
        self.assertEqual(ref_name(ok["application/json"]["schema"]["properties"]["data"]), "BridgeReleaseLink")
        self.assertEqual(ok.get("application/octet-stream", {}).get("schema"), {"type": "string", "format": "binary"})
        for code in ("404", "422", "503"):
            self.assertIn(code, r, f"downloadBridgeRelease に {code} が無い")
        self.assertIn("NOT_FOUND", r["404"]["description"])
        self.assertIn("E-CONN-014", r["404"]["description"])
        self.assertIn("E-PAGE-007", r["503"]["description"])

    def test_K144_SHAPE_008_latest_release_answers_and_query(self) -> None:
        """新しい版を見る口は 503（E-PAGE-007）を返し、問い合わせ os・arch を受ける（口は値が違えば更新を返さないだけ。必須ではない）"""
        _p, _m, op = operation("getLatestBridgeRelease")
        self.assertIn("503", op["responses"])
        self.assertIn("E-PAGE-007", op["responses"]["503"]["description"])
        q = {x["name"]: x for x in op.get("parameters", []) if x["in"] == "query"}
        for n in ("os", "arch"):
            self.assertIn(n, q, f"getLatestBridgeRelease に問い合わせ {n} が無い")
            self.assertFalse(q[n].get("required", False))
            self.assertEqual(q[n]["schema"].get("type"), "string")

    def test_K144_SHAPE_009_create_ticket_declares_parent_not_found(self) -> None:
        """チケットを作る口は、親が無い・見えないとき 404（E-PAGE-001）を返す。契約にも 404 がある"""
        r = operation("createTicket")[2]["responses"]
        self.assertIn("404", r)
        self.assertIn("E-PAGE-001", r["404"]["description"])

    def test_K144_SHAPE_010_every_status_a_hook_returns_is_in_the_contract(self) -> None:
        """K-57・K-60 の口の振る舞い（hooks）が返しうる状態コードは、全部その口の契約の responses にある（機械で拾う）"""
        cat = catalog_status()
        missing = []
        for f in HOOK_FILES:
            for op_id, block in hook_blocks(f.read_text(encoding="utf-8")).items():
                declared = {int(k) for k in operation(op_id)[2]["responses"]}
                for s in sorted(statuses_in(block, cat) - declared):
                    missing.append(f"{op_id} {s}（{f.relative_to(ROOT)}）")
        self.assertEqual(missing, [], "口が返すのに契約に無い状態コード")

    def test_K144_SHAPE_011_raw_answers_declare_a_non_json_content(self) -> None:
        """JSON でなくファイルそのものを返す口（hooks の raw:）は、200 に JSON 以外の中身の形を書いている"""
        bad = []
        for f in HOOK_FILES:
            for op_id, block in hook_blocks(f.read_text(encoding="utf-8")).items():
                if re.search(r"\braw:", block) or "give(" in block:
                    ok = operation(op_id)[2]["responses"]["200"].get("content", {})
                    if not any(k != "application/json" for k in ok):
                        bad.append(op_id)
        self.assertEqual(bad, [], "ファイルを返すのに 200 が JSON だけ")

    # ---- 答えの null（R1 #7）
    def test_K144_SHAPE_012_answers_that_return_null_are_nullable(self) -> None:
        """口が null を返す欄（読んで洗い出したもの）は nullable。PC の引き取りは名前（device_label）も返す"""
        want = [
            ("TicketKindChoice", "color"),       # fuzz の赤 ②（ticket_kinds.color は null 可）
            ("BridgeRelease", "update"),         # その OS・CPU の更新が無いと null
            ("BridgeHeartbeat", "browser"),      # 口は ?? null で返す
            ("BridgeDevice", "device_label"),    # sessions.device_label は null 可
            ("BridgeDevice", "last_seen_at"),    # 最初の知らせの前（waiting）は null
            ("BridgeDevice", "version"),         # sessions.bridge_version は null 可
            ("BridgeDevice", "revoke_reason"),   # 生きている PC は null
            ("TicketDetail", "kind"),            # 種別の行が読めないと null
            ("TicketDetail", "stage"),           # 段の行が読めないと null
            ("TicketDetail", "assignee"),        # 担当者がいない（tickets.assignee_member_id は null 可）と null
            ("TicketDraft", "body"),             # 捨てた・使い終わった下書きは body: null（app.ticket_draft_save）
            ("TicketDraft", "saved_at"),         # 同上 saved_at: null
        ]
        for name, field in want:
            self.assertTrue(prop(name, field).get("nullable"), f"{name}.{field} が nullable でない")
        self.assertEqual(prop("BridgeClaim", "device_label").get("type"), "string")

    def test_K144_SHAPE_013_answer_fields_match_nullable_db_columns(self) -> None:
        """答えの形（RESPONSES）の欄が、その口の表の null を許す列と同じ名前なら、契約も null を許す。
        口が null を返さないと言い切れる欄だけ、screen_api.py の NOT_NULL_ANSWERS に理由（15 文字以上）を書いて外す（機械の洗い出し）"""
        exc = getattr(SA, "NOT_NULL_ANSWERS", {})
        bad = []
        for op_id, (_name, props) in SA.RESPONSES.items():
            t = table_of(op_id)
            cols = DBC.get(t, {}) if t else {}
            for k, v in props.items():
                if k in cols and cols[k].get("nullable") and not v.endswith("?") and f"{op_id}.{k}" not in exc:
                    bad.append(f"{op_id}.{k}（{t}.{k} は null 可）")
        self.assertEqual(bad, [], "DB は null を許すのに、答えの形が null を許さない")
        for key, reason in exc.items():
            op_id, _, field = key.partition(".")
            self.assertIn(op_id, SA.RESPONSES, f"NOT_NULL_ANSWERS の {key} の口が無い")
            self.assertIn(field, SA.RESPONSES[op_id][1], f"NOT_NULL_ANSWERS の {key} の欄が無い")
            self.assertGreaterEqual(len(reason), 15, f"NOT_NULL_ANSWERS の {key} の理由が短い")

    def test_K144_SHAPE_014_types_follow_the_contract(self) -> None:
        """画面とサーバーの型（08_api/types.ts）も契約に合う：色は null がある・下書きの id は文字"""
        self.assertRegex(TYPES, r"export type TicketKindChoice = \{[^}]*\bcolor\?: string \| null;")
        self.assertRegex(TYPES, r"export type TicketDraftInput = \{[^}]*\bdraft_id\?: string;")


if __name__ == "__main__":
    unittest.main(verbosity=2)
