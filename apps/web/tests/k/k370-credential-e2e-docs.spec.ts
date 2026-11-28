// K-370「預けたログイン情報の通しの画面の試験を、新しい画面と契約の口で書き直す」の試験のうち、CI の画面の組（e2e:k）が流す分。
//   実ブラウザは開かない・口も呼ばない。リポジトリのファイルを読むだけ（K-369 の k369-pc-row-mock.spec.ts の MK の行と同じ形）。
//   通しの 8 行（K370-E2E-001〜008）は apps/web/tests/screens/qa-b-login-check.spec.ts・qa-b-two-factor.spec.ts に在る。その 8 行は、Bridge を組み立てた後に
//   CI の画面の組の専用の段 G73（scripts/ci/web_run.py gate 73・K-379）が流す。このファイルは G48（e2e:k の一覧）が流す。
//   ここで見るのは 2 つ：通しの試験と共通の道具が止め・固定の待ち・前の道すじを持たず、前の 2 本が無いこと（K370-SRC-001）と、正本の行の書き替え（K370-DOC-001）。
//   探す字はそのまま書く（見る 3 つのファイルにこのファイルは入らない＝自分の字に当たらない。このファイル自身は読まない）。
//   名前の頭は 11_tickets/K-370.md の行 ID。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const SCREENS = join(ROOT, "apps/web/tests/screens");
const BRIDGE_MD = join(ROOT, "07_qa/test-specs/bridge.md");
const CLONE_CHAT_MD = join(ROOT, "07_qa/test-specs/screens/clone-chat.md");

test("K370-SRC-001 通しの試験（qa-b-login-check・qa-b-two-factor・共通の道具 credential-e2e）は止め（test.fixme・test.skip）も固定の待ち（waitForTimeout）も前の道すじ（/api/auth-ext/vault・/api/auth-ext/bridge/credentials）も持たず、前の 2 本（qa-b-credential-vault・qa-b-infisical）は無い", () => {
  const files = ["qa-b-login-check.spec.ts", "qa-b-two-factor.spec.ts", "credential-e2e.ts"];
  const words = [
    "test.fixme(",
    "test.skip(",
    "waitForTimeout(",
    "/api/auth-ext/vault",
    "/api/auth-ext/bridge/credentials",
  ];
  const bad = files.flatMap((f) => {
    const src = readFileSync(join(SCREENS, f), "utf8");
    return words.filter((w) => src.includes(w)).map((w) => `${f}：${w}`);
  });
  expect(bad, bad.join("\n")).toEqual([]);
  for (const gone of ["qa-b-credential-vault.spec.ts", "qa-b-infisical.spec.ts"])
    expect(statSync(join(SCREENS, gone), { throwIfNoEntry: false }), `${gone} が残っている`).toBeUndefined();
});

test("K370-DOC-001 正本の行：BRG-05-004〜006・BRG-14-001・002・005・008・CHT-38-001〜003・CHT-39-001〜004 のどれも「K-370」を置き換え先に持たない（K-356 が付けた止めを外した）。書き直した行は結果の欄が新しい試験のファイル、重なりで外した行は BLOCKED と置き換え先の行 ID を持つ", () => {
  const lines = [...readFileSync(BRIDGE_MD, "utf8").split("\n"), ...readFileSync(CLONE_CHAT_MD, "utf8").split("\n")];
  const rowOf = (id: string) => lines.find((l) => l.startsWith(`| ${id} |`)) ?? "";
  const kept = ["CHT-38-001", "CHT-38-002", "CHT-38-003", "CHT-39-001", "CHT-39-002", "CHT-39-003", "BRG-05-004"];
  const moved: Record<string, RegExp> = {
    "BRG-05-005": /BLOCKED[^|]*K354-BRG-004/,
    "BRG-05-006": /BLOCKED[^|]*K354-API-012/,
    "BRG-14-001": /人が確かめる|BLOCKED[^|]*K370-HC-001/,
    "BRG-14-002": /人が確かめる|BLOCKED[^|]*K370-HC-001/,
    "BRG-14-005": /BLOCKED[^|]*K372-UI-014/,
    "BRG-14-008": /BLOCKED[^|]*K372-UI-014/,
    "CHT-39-004": /BLOCKED[^|]*K357-UI-012/,
  };
  const bad: string[] = [];
  for (const id of [...kept, ...Object.keys(moved)]) {
    const r = rowOf(id);
    if (!r) bad.push(`${id}：行が無い`);
    else if (r.includes("K-370")) bad.push(`${id}：まだ K-370 を置き換え先に持つ`);
  }
  for (const id of kept) {
    const r = rowOf(id);
    if (r && !/screens\/qa-b-(login-check|two-factor)\.spec\.ts/.test(r))
      bad.push(`${id}：結果の欄が新しい試験のファイルを指さない`);
  }
  for (const [id, re] of Object.entries(moved)) {
    const r = rowOf(id);
    if (r && !re.test(r)) bad.push(`${id}：置き換え先 ${re} が無い`);
  }
  expect(bad, bad.join("\n")).toEqual([]);
});
