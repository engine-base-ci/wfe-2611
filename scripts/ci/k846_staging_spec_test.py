#!/usr/bin/env python3
"""K-846 の形の試験：段 11 の統合テスト（apps/e2e/staging/k846-f10.spec.ts）と道具（_lib/f10-steps.ts）の置き場・名前・行 ID・
逃げ道が無いこと・DB と環境の値を読まないこと・確かめのリンクと置き場の住所の印を記録に出さないこと・G65 から流れること・
段 11 の口の生成の試験が口の葉の行に結び終わっていること（結ばれていない it.todo が 0）。行 ID は K846-FM-NNN。
staging にはつながない（試験の本体が流れるのは、main から手で起こす staging-e2e.yml の回だけ）。チケットの CI（G65）で流れる。
形は K-418・K-922 の形の試験と同じ"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
STAGING = ROOT / "apps" / "e2e" / "staging"
LIB = STAGING / "_lib"
SPEC = STAGING / "k846-f10.spec.ts"
STEPS = LIB / "f10-steps.ts"
TICKETS = ROOT / "11_tickets"
TICKET = TICKETS / "K-846.md"
G65 = ROOT / "scripts" / "ci" / "g65.d" / "K-846.txt"
ROW = r"K846-STG-\d{2}"
WITH_TEST = ["K846-STG-01", "K846-STG-02", "K846-STG-03", "K846-STG-04"]  # 試験を持つ行
NO_TEST = ["K846-STG-05", "K846-STG-06", "K846-STG-07"]                    # staging では作らない行（理由つきで試験を持たない）
MAX_TEST_MS = 240_000                                                     # 設定の 1 本の上限（playwright.staging.config.ts の timeout）
# 段 11 の葉が apis: に挙げるが、生成の試験の結びの持ち主が前の段の葉の口（段 11 は答えに欄を足すだけ）
NOT_OURS = {
    "getWorkspaceMembers": "結びの持ち主は段 9 の K-419（ears-elsewhere.d/K-419.json）。K-808 は答えに欄を足すだけ",
    "listScopes": "結びの持ち主は段 5 の F4 の作る面の葉。K-804 は答えに鍵と並びを足すだけ",
}
SCREEN_NAMES = [
    "送り直す", "取り消す", "招待を取り消しますか", "招待を取り消す", "の役割を変える", "のほかの操作",
    "一時的に止める", "ワークスペースから外す", "本人確認して止める", "本人確認して戻す", "本人確認して外す",
    "全部の引き継ぎ先", "本人か確かめます", "確認のコード 1 けた目", "写真を選ぶ", "文字に戻す", "ロゴ", "変える",
    "メールを変える", "新しいメール", "本人確認して送る", "プロフィール", "メンバー",
]


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


def code(path: pathlib.Path) -> str:
    """注釈（// の行と行末の // …・/* … */）を除いた中身。注釈に書いた説明の字で赤にしない"""
    text = re.sub(r"/\*.*?\*/", "", read(path), flags=re.S)
    return "\n".join(re.sub(r"(^|\s)//.*$", "", ln) for ln in text.splitlines())


def titles() -> list[str]:
    return re.findall(r'^test\(\s*"([^"]+)"', read(SPEC), flags=re.M)


def body_of(name: str) -> str:
    return read(SPEC).split(f'test("{name}"', 1)[1].split("\ntest(", 1)[0]


def stage11_ops() -> list[str]:
    """段 11 の葉（親 K-70・K-800〜K-899。孫の K-848 以降も）の頭の欄 apis: から、口の名前を機械で引く（手で並べない）"""
    ops: set[str] = set()
    for p in sorted(TICKETS.glob("K-8[0-9][0-9].md")):
        head = read(p).split("\n---", 1)[0]
        if not re.search(r"^parent: K-70$", head, flags=re.M):
            continue
        m = re.search(r"^apis: \[(.*)\]$", head, flags=re.M)
        if m:
            ops |= {x.strip() for x in m.group(1).split(",") if x.strip()}
    return sorted(ops - set(NOT_OURS))


def generated_file(op: str) -> pathlib.Path | None:
    """口の名前 → 契約の道 → 生成の試験のファイル（08_api/endpoints.json と ears-test-mapping.json から引く）"""
    eps = json.loads(read(ROOT / "08_api" / "endpoints.json"))["endpoints"]
    ep = next((e for e in eps if e["implementation_path"].split("::")[1] == op), None)
    if ep is None:
        return None
    mapping = json.loads(read(ROOT / "07_qa" / "test-plan" / "ears-test-mapping.json"))["mappings"]
    hit = next((m for m in mapping if m["endpoint"] == f"{ep['method']} {ep['path']}"), None)
    return ROOT / hit["test_file"] if hit else None


class F10StagingShape(unittest.TestCase):
    def test_K846_FM_001_place_and_imports(self) -> None:
        self.assertTrue(SPEC.is_file(), "統合テストの試験が置き場の直下に在る（設定の testMatch k<数>-… に当たる名前）")
        self.assertRegex(SPEC.relative_to(STAGING.parent).as_posix(), r"^staging/k\d+-[^/]+\.spec\.ts$")
        self.assertTrue(STEPS.is_file(), "段 11 の画面の 1 歩は _lib/f10-steps.ts に置く")
        for p in (SPEC, STEPS):
            for target in re.findall(r"""(?:from|import\(|require\()\s*["']([^"']+)["']""", read(p)):
                self.assertNotRegex(target, r"journeys|apps/web|\.\./\.\./web|packages/",
                                    f"{p.name}：前の通し・画面の試験の道具・製品の部品を読まない（{target}）")

    def test_K846_FM_002_row_ids(self) -> None:
        ids = [n.split(" ")[0] for n in titles()]
        self.assertEqual(ids, WITH_TEST, "試験の名前の頭は行 ID。01〜04 が 1 本ずつ、この順")
        self.assertEqual(len(re.findall(r"^test\(", read(SPEC), flags=re.M)), len(WITH_TEST), "名前を読めなかった試験が無い")
        self.assertNotRegex(read(SPEC), r"^\s*(test\.describe|describe)\(", "入れ子にしない（名前の頭が行 ID のまま記録に出る）")
        doc = read(TICKET)
        rows = re.findall(rf"^\| ({ROW}) \|", doc, flags=re.M)
        self.assertEqual(sorted(set(rows)), sorted(WITH_TEST + NO_TEST), "チケットの行の表と、試験を持つ行・持たない行が合う")
        skip = re.search(r"```judge-skip\n(.*?)```", doc, flags=re.S)
        self.assertIsNotNone(skip, "チケットに、チケットの CI で判定しない行の訳（judge-skip）が在る")
        skipped = re.findall(rf"^- ({ROW}): \S", skip.group(1), flags=re.M)
        self.assertEqual(sorted(skipped), sorted(WITH_TEST + NO_TEST), "staging の回で決める行は、どれも訳つきで judge-skip に在る")

    def test_K846_FM_003_no_way_around(self) -> None:
        banned = {
            r"\btest\.(skip|fixme|fail|only)\b|\bdescribe\.(skip|only|fixme)\b": "飛ばす・赤を見込む・1 本だけ流す",
            r"waitForTimeout\(": "固定の待ち",
            r"\.route\(|routeFromHAR|\.fulfill\(": "口の答えを網の手前で作る",
            r"\.catch\(\s*\(\s*\)\s*=>": "失敗の握りつぶし",
            r"x-forwarded-for": "送り元の付け替え",
        }
        for p in (SPEC, STEPS):
            for pattern, why in banned.items():
                self.assertNotRegex(code(p), pattern, f"{p.name}：{why}")
            self.assertNotRegex(code(p), r"(?<!test\.)\bsetTimeout\(", f"{p.name}：時間で待たない（test.setTimeout は別）")
        for name in titles():
            self.assertGreaterEqual(len(re.findall(r"\bexpect(?:\.poll)?\(", body_of(name))), 8,
                                    f"{name.split(' ')[0]}：確かめを持つ（空の試験で緑にしない）")

    def test_K846_FM_004_never_reads_db_or_env(self) -> None:
        for p in (SPEC, STEPS):
            text = code(p)
            self.assertNotRegex(text, r"""from\s+["']pg["']|\bDATABASE|\badmin\(|\bnew\s+Client\(|postgres(ql)?://""",
                                f"{p.name}：DB につながない（確かめは画面・口の読み直し・Resend の記録・置き場の住所だけ）")
            self.assertNotRegex(text, r"process\.env|\benv\[", f"{p.name}：環境の値を読まない（読むのは site.ts・resend.ts だけ）")

    def test_K846_FM_005_nothing_secret_in_records(self) -> None:
        for p in (SPEC, STEPS):
            text = code(p)
            self.assertNotRegex(text, r"\bconsole\.\w+\(|\.attach\(|\.screenshot\(|tracing\.", f"{p.name}：標準出力・写し・添え物を残さない")
            self.assertNotRegex(text, r"vercel\.app|supabase\.co|https://[a-z0-9.-]+\.[a-z]{2,}", f"{p.name}：住所を書かない")
            self.assertNotRegex(text, r"toHaveURL\(|waitForURL\(", f"{p.name}：住所そのものを比べない（道を比べる）")
            domains = set(re.findall(r"@([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b", text))
            self.assertEqual(domains, set(), f"{p.name}：宛先を書かない（宛先は steps.ts の person だけが作る）")
        self.assertIn("person(", code(SPEC), "人は steps.ts の person で作る（宛先は Resend の試験用・パスワードは伏せる形）")
        self.assertNotRegex(code(SPEC), r"password\s*:", "試験の中でパスワードを作らない")
        self.assertNotRegex(code(STEPS), r"return\s*\{[^}]*\burl\b", "置き場を読む道具は住所を返さない（落ちた文に出さない）")

    def test_K846_FM_006_links_are_hidden(self) -> None:
        # 作り物の印（本物の秘密ではない）。秘密の検査（gitleaks）に当たらないよう、短く分けて書いてつなぐ
        mark1 = "".join(("Zx9Yw8Vu", "7Ts6Rq5P", "o4Nm3Lk2", "Ji1Hg0Fe", "_k846"))
        mark2 = "".join(("Ab12Cd34", "Ef56Gh78", "Ij90_k846"))
        planted = ("K846-STG-04 メール: Error: page.goto: net::ERR_FAILED at "
                   "https://web.k846-shape.example.test/account/email-confirm?token=" + mark1 + "\n"
                   "K846-STG-03 顔: GET https://store.k846-shape.example.test/object/sign/avatars/a.png?token=" + mark2 + "\n")
        script = ("import('./apps/e2e/staging/_lib/scrub.mjs').then(async (m) => {"
                  " let s = ''; for await (const c of process.stdin) s += c; process.stdout.write(m.scrub(s, {})); })")
        out = subprocess.run(["node", "--input-type=module", "-e", script], input=planted, text=True,
                             capture_output=True, cwd=ROOT, check=True).stdout
        self.assertNotIn(mark1, out, "メールの確かめのリンクの印を伏せる")
        self.assertNotIn(mark2, out, "置き場の期限つきの住所の印を伏せる")
        self.assertEqual(out.count("token=［伏せた］"), 2)
        self.assertIn("K846-STG-04", out, "試験の名前（行 ID）は残す")

    def test_K846_FM_007_time_limits(self) -> None:
        for name in titles():
            limits = [int(x.replace("_", "")) for x in re.findall(r"test\.setTimeout\(([\d_]+)\)", body_of(name))]
            self.assertEqual(len(limits), 1, f"{name.split(' ')[0]}：上限を 1 つ持つ")
            self.assertLessEqual(limits[0], MAX_TEST_MS, f"{name.split(' ')[0]}：1 本の上限は設定の 4 分まで")

    def test_K846_FM_008_runs_in_g65(self) -> None:
        self.assertTrue(G65.is_file(), "G65 の置き場（g65.d/K-846.txt）に命令が在る")
        lines = [ln.strip() for ln in read(G65).splitlines() if ln.strip()]
        self.assertEqual(lines, ["python3 scripts/ci/k846_staging_spec_test.py"], "1 行 1 命令・この形の試験だけ")

    def test_K846_FM_009_generated_tests_bound(self) -> None:
        ops = stage11_ops()
        self.assertGreaterEqual(len(ops), 30, "段 11 の口を葉の apis: から引けている")
        bad: list[str] = []
        for op in ops:
            f = generated_file(op)
            if f is None or not f.is_file():
                bad.append(f"{op}：生成の試験が無い（作り手で作り直す）")
                continue
            lines = read(f).splitlines()
            for i, ln in enumerate(lines):
                if "it.todo(" in ln and not (i > 0 and lines[i - 1].lstrip().startswith("// 当てはまらない（")):
                    bad.append(f"{op}：{f.name} {i + 1} 行目の it.todo が、訳（当てはまらない）の無いまま残っている")
        self.assertEqual(bad, [], "段 11 の口の生成の試験は、どの名前も口の葉の行に結ぶか、訳つきで当てはまらないにする")

    def test_K846_FM_010_screen_names(self) -> None:
        text = code(STEPS)
        missing = [n for n in SCREEN_NAMES if f'"{n}"' not in text and f"`{n}" not in text and n not in text]
        self.assertEqual(missing, [], "道具に、決め手の画面の名前（K-809・K-818・K-821・K-822・K-831・K-839・K-840 の表とモックの字）が在る")
        self.assertIn('"本人か確かめます"', text, "本人確認の取り直しは今の部品の小窓（step-up.tsx・K-363 と同じ形）")
        self.assertRegex(text, r"waitForEvent\(\"filechooser\"\)", "写真とロゴは、ファイルを選ぶ窓から渡す（隠れた欄を直に触らない）")


if __name__ == "__main__":
    unittest.main(verbosity=2)
