#!/usr/bin/env python3
"""K-923 の試験：段 12（K-71・F11）の入れ物 K-71 を「子の葉が全部取り込まれたら完了」の形にしたことと、K-71 が引き継いだ生成の試験 32 本が
各葉の持ち物（tests:）になったか（または口を契約から外して作り手が消したか）を、機械で照らす。行 ID は K923-CL-NNN。
DB も staging もつながない（11_tickets と apps/api/test/generated の名前だけを読む）。チケットの CI（G65）で流れる"""
from __future__ import annotations

import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
TICKETS = ROOT / "11_tickets"
GENERATED = ROOT / "apps" / "api" / "test" / "generated"
PARENT = TICKETS / "K-71.md"
# K-71 が引き継いだ生成の試験（段 12 の切る段の始めの K-71.md の tests: の 32 本・2026-11-23）
ORIGINAL = [
    "delete_client_contacts_id", "get_client_requests", "get_client_requests_id", "get_clients_id", "get_clients_id_activity",
    "get_clients_id_portal_preview", "get_clients_link_candidates", "get_portal", "get_portal_acceptances_id", "get_portal_notices",
    "get_portal_requests_id", "get_portal_tickets_id", "get_rules", "patch_client_contacts_id", "patch_client_requests_id",
    "patch_clients_id", "patch_clients_id_share", "patch_tickets_id_client_share", "post_acceptances_id_remind",
    "post_client_contacts_id_invitation", "post_client_requests_id_accept", "post_client_requests_id_decline",
    "post_client_requests_id_reply", "post_clients", "post_clients_id_contacts", "post_portal_acceptances_id_answer",
    "post_portal_attachments", "post_portal_requests", "post_portal_requests_id_messages", "post_portal_requests_questions",
    "post_rules", "post_tickets_id_acceptances",
]
# 口を契約から外す葉（K-924・K-926・段 10 の K-711）が持つ：作り手が消すので、残っていれば外し忘れ
RETIRED = [
    "delete_client_contacts_id", "get_clients_id", "get_clients_id_activity", "get_clients_id_portal_preview", "get_clients_link_candidates",
    "get_portal_acceptances_id", "patch_client_contacts_id", "patch_clients_id", "patch_clients_id_share", "patch_tickets_id_client_share",
    "post_acceptances_id_remind", "post_client_contacts_id_invitation", "post_clients", "post_clients_id_contacts",
    "post_portal_acceptances_id_answer", "post_tickets_id_acceptances", "get_rules", "post_rules",
]
KEPT = [n for n in ORIGINAL if n not in RETIRED]   # 残る 14 本：どれかの葉の tests: に在る


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


def head(path: pathlib.Path) -> str:
    m = re.match(r"---\n(.*?)\n---\n", read(path), flags=re.S)
    return m.group(1) if m else ""


def field(path: pathlib.Path, key: str) -> str:
    m = re.search(rf"^{key}:[ \t]*(.*)$", head(path), flags=re.M)
    return m.group(1).strip() if m else ""


def listed(path: pathlib.Path, key: str) -> list[str]:
    v = field(path, key)
    return [x.strip() for x in v.strip("[]").split(",") if x.strip()] if v.startswith("[") else []


def children() -> list[pathlib.Path]:
    return sorted(p for p in TICKETS.glob("K-*.md") if field(p, "parent") == "K-71")


class F11Close(unittest.TestCase):
    def test_K923_CL_001_parent_is_a_closed_container(self) -> None:
        self.assertEqual(field(PARENT, "tests"), "[]", "K-71 の tests: は空（各葉の持ち物になった）")
        self.assertEqual(field(PARENT, "apis"), "[]", "K-71 の apis: は空（各葉の apis: になった）")
        self.assertIn("ゲスト", field(PARENT, "title"), "題に「ゲスト」（K-870 が直した形のまま）")
        self.assertEqual(field(PARENT, "split"), "", "「これから」を残さない（切り終わった）")
        self.assertNotIn("まだ切っていない", field(PARENT, "title"), "題に「まだ切っていない」を残さない")

    def test_K923_CL_002_parent_text_is_the_new_core(self) -> None:
        text = read(PARENT)
        for word in ("検収", "取引先", "クライアントの場所", "確認してほしいもの"):
            self.assertNotIn(word, text, f"K-71 に「{word}」の字を残さない（芯：チケットはチケット・取引先を持たない・検収は作らない）")
        self.assertIn("子の葉が全部取り込まれたら完了", text, "完了の条件は「子の葉が全部取り込まれたら完了」の形")

    def test_K923_CL_003_each_kept_test_has_exactly_one_owner(self) -> None:
        owners: dict[str, list[str]] = {n: [] for n in KEPT}
        for p in children():
            for t in listed(p, "tests"):
                name = pathlib.PurePosixPath(t).name.removesuffix(".test.ts")
                if t.startswith("apps/api/test/generated/") and name in owners:
                    owners[name].append(p.stem)
        for name, who in owners.items():
            self.assertEqual(len(who), 1, f"{name}：持ち主の葉がちょうど 1 つ（今は {who}）")

    def test_K923_CL_004_retired_tests_are_gone(self) -> None:
        for name in RETIRED:
            self.assertFalse((GENERATED / f"{name}.test.ts").exists(), f"{name}：口を契約から外したので作り手が消している")
            for p in children():
                self.assertNotIn(f"apps/api/test/generated/{name}.test.ts", listed(p, "tests"), f"{p.stem} の tests: に、消えた {name} が残っている")

    def test_K923_CL_005_kept_tests_exist_and_have_no_open_todo(self) -> None:
        for name in KEPT:
            path = GENERATED / f"{name}.test.ts"
            self.assertTrue(path.is_file(), f"{name}：生成の試験が在る")
            todo = re.findall(r'it\.todo\("([^"]+)"\)', read(path))
            # 当てはまらない物は作り手が「当てはまらない」の注と一緒に置く（it.todo のまま・na）。それ以外の it.todo は結び忘れ
            open_todo = [t for t in todo if not re.search(rf"当てはまらない[^\n]*\n\s*it\.todo\(\"{re.escape(t)}\"\)", read(path))]
            self.assertEqual(open_todo, [], f"{name}：結ばれていない it.todo が残っている（葉の ears-elsewhere.d の covers で結ぶ）")

    def test_K923_CL_006_every_child_has_the_parent_fields(self) -> None:
        ids = [p.stem for p in children()]
        self.assertGreaterEqual(len(ids), 40, "K-71 の子の葉が 40 本以上（切り方 00 章の葉から消した葉を引き、K-930 を足した数）")
        for p in children():
            self.assertEqual(field(p, "milestone"), "F11", f"{p.stem}：milestone は F11")
            self.assertNotEqual(field(p, "assignee"), "", f"{p.stem}：担当が在る")
            self.assertNotRegex(field(p, "assignee"), r"セッション|TS|CS|Claude", f"{p.stem}：担当に AI のセッションの名前を書かない")

    def test_K923_CL_008_every_child_is_reached_from_this_leaf(self) -> None:
        """この葉（K-71.md を変える最後の葉）から depends_on をたどると、子の葉の全部に着く（たどれない葉があれば番号を出す）"""
        deps = {p.stem: listed(p, "depends_on") for p in TICKETS.glob("K-*.md")}
        seen: set[str] = set()
        todo = ["K-923"]
        while todo:
            k = todo.pop()
            for d in deps.get(k, []):
                if d not in seen:
                    seen.add(d)
                    todo.append(d)
        missing = [p.stem for p in children() if p.stem != "K-923" and p.stem not in seen]
        self.assertEqual(missing, [], f"K-923 からたどれない子の葉：{missing}（depends_on に足す）")

    def test_K923_CL_007_no_child_is_a_removed_leaf(self) -> None:
        removed = ["K-879", "K-880", "K-884", "K-885", "K-886", "K-887", "K-888", "K-889", "K-890", "K-891", "K-900", "K-901", "K-902",
                   "K-903", "K-904", "K-914", "K-915", "K-917", "K-919", "K-921"]   # 取引先・検収の葉（切り方 00 章の「消す葉」）
        for k in removed:
            self.assertFalse((TICKETS / f"{k}.md").exists(), f"{k}：消した葉の md が残っている（番号は使わない）")


if __name__ == "__main__":
    unittest.main(verbosity=2)
