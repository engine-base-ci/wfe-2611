#!/usr/bin/env python3
"""K-644 の試験：口の試験（apps/api/test の *.test.ts）が kaname_auth の表に触るなら、その試験の準備（読み込む土台を含む）が migrateAuth を呼ぶ。

  python3 scripts/ci/k644_migrate_auth_test.py      全部の行（行 ID は K644-CI-NNN。11_tickets/K-644.md の行の表と 1 対 1）

由来：K-419 の試験（invite-create.test.ts）が migrateAuth を呼ばずに kaname_auth."user" へ直に入れていた。本線では組み分けで先に流れる別の試験が表を作るので緑だが、
migration を触った葉は DB の試験を全部流す範囲になり、組み分けが変わって `relation "kaname_auth.user" does not exist` で赤になる（K-433）。
読み方：*.test.ts ごとに、相対の import をたどった木（その試験と土台）を作る。コメントを除いて `kaname_auth` の字が出る木は、木のどこかに `migrateAuth(` の呼び出しが要る。
"""
from __future__ import annotations

import pathlib
import re
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
TEST_DIR = "apps/api/test"
LOCAL_IMPORT = re.compile(r"""(?:from|import)\s*\(?\s*["'](\.{1,2}/[^"']+)["']""")


def code_of(text: str) -> str:
    """コメントを除いた中身。字（' " `）の中の // や /* はコメントではないので、字を読み進めながら外す"""
    out: list[str] = []
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        two = text[i:i + 2]
        if two == "//":
            j = text.find("\n", i)
            i = n if j < 0 else j
        elif two == "/*":
            j = text.find("*/", i + 2)
            i = n if j < 0 else j + 2
        elif c in "'\"`":
            j = i + 1
            while j < n and text[j] != c:
                j += 2 if text[j] == "\\" else 1
            out.append(text[i:j + 1])
            i = j + 1
        else:
            out.append(c)
            i += 1
    return "".join(out)


def resolve(frm: pathlib.Path, spec: str) -> pathlib.Path | None:
    base = (frm.parent / spec).resolve()
    stem = re.sub(r"\.js$", "", str(base))
    for cand in (pathlib.Path(stem + ".ts"), pathlib.Path(stem + ".tsx"), pathlib.Path(stem) / "index.ts", base):
        if cand.is_file():
            return cand
    return None


def tree_of(entry: pathlib.Path, root: pathlib.Path) -> list[pathlib.Path]:
    """entry から相対の import をたどった木（root の下だけ）。自分も含む"""
    seen: dict[pathlib.Path, None] = {}
    stack = [entry.resolve()]
    while stack:
        p = stack.pop()
        if p in seen:
            continue
        seen[p] = None
        for spec in LOCAL_IMPORT.findall(code_of(p.read_text(encoding="utf-8"))):
            q = resolve(p, spec)
            if q is not None and root in q.parents:
                stack.append(q)
    return list(seen)


def unmigrated(test_root: pathlib.Path) -> list[str]:
    """kaname_auth に触る木で migrateAuth( の呼び出しが無い *.test.ts（test_root からの道）"""
    root = test_root.resolve()
    bad = []
    for t in sorted(root.rglob("*.test.ts")):
        codes = [code_of(p.read_text(encoding="utf-8")) for p in tree_of(t, root)]
        if any("kaname_auth" in c for c in codes) and not any(re.search(r"\bmigrateAuth\s*\(", c) for c in codes):
            bad.append(str(t.relative_to(root)))
    return bad


class MigrateAuthTest(unittest.TestCase):
    def test_K644_CI_001_every_test_touching_kaname_auth_migrates_it(self):
        """K644-CI-001 守り：本物の apps/api/test で、kaname_auth に触る試験（読み込む土台を含む）は全部 migrateAuth を呼ぶ。
        見た試験が 0 本の緑にしない（*.test.ts は 30 本以上・うち kaname_auth に触るものは 10 本以上）"""
        root = ROOT / TEST_DIR
        tests = sorted(root.rglob("*.test.ts"))
        touching = [t for t in tests if any("kaname_auth" in code_of(p.read_text(encoding="utf-8")) for p in tree_of(t, root.resolve()))]
        self.assertGreaterEqual(len(tests), 30)
        self.assertGreaterEqual(len(touching), 10)
        self.assertEqual(unmigrated(root), [], "migrateAuth を呼ばずに kaname_auth に触る試験（土台を含む）")

    def test_K644_CI_002_detects_the_old_shape_and_ignores_comments(self):
        """K644-CI-002 失敗：偽の木で、(a) migrateAuth を呼ばずに kaname_auth へ入れる試験・(b) 呼ばない土台を読み込む試験は赤、
        (c) 土台が呼ぶ・(d) 試験自身が呼ぶ・(e) コメントにだけ kaname_auth が出る試験は緑、(g) 字の中の // の後ろに本物の kaname_auth がある試験は赤。検査が何も見ていない緑にしない"""
        with tempfile.TemporaryDirectory() as d:
            r = pathlib.Path(d)
            ins = "await pool.query('insert into kaname_auth.\"user\" (id) values ($1)', [1]);\n"
            (r / "base_ok.ts").write_text('import { migrateAuth } from "@kaname/auth/migrate";\nexport const up = () => migrateAuth(process.env.X!);\nexport const q = "kaname_auth.user";\n')
            (r / "base_bad.ts").write_text('export const q = "kaname_auth.user";\n')
            (r / "a_old.test.ts").write_text(ins)
            (r / "b_base_bad.test.ts").write_text('import { q } from "./base_bad.js";\n' + ins.replace("pool", "q"))
            (r / "c_base_ok.test.ts").write_text('import { q } from "./base_ok.js";\n' + ins.replace("pool", "q"))
            (r / "d_self.test.ts").write_text('import { migrateAuth } from "@kaname/auth/migrate";\nawait migrateAuth("x");\n' + ins)
            (r / "e_comment.test.ts").write_text("// kaname_auth の表は別の試験が作る\n/* kaname_auth.user */\nconst a = 1;\n")
            (r / "f_url.test.ts").write_text('const u = "http://localhost/x"; // kaname_auth\n')
            (r / "g_url_then_sql.test.ts").write_text('const u = "http://x"; pool.query("select 1 from kaname_auth.session");\n')
            self.assertEqual(unmigrated(r), ["a_old.test.ts", "b_base_bad.test.ts", "g_url_then_sql.test.ts"])


if __name__ == "__main__":
    unittest.main()
