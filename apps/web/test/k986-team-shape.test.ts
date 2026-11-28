// K-986「運営の人の画面」の単体の試験（画面の外の、決まった形だけ）：
//   口の答え（listOpsMembers・K-985 の 8 欄）→ 部品の値（features/F12/ops/team-shape.ts）と、変える・外すを押せない訳。
//   字は下絵（features/F12/ops/ops-sample.ts の TEAM・CAP_LABELS）が正。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-986.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { editState, subOf, teamRowView } from "../features/F12/ops/team-shape";
import { TEAM } from "../features/F12/ops/ops-sample";
import { CAPS, TEAM_A } from "../tests/k/ops-team-mock";

describe("K-986 運営の人の 1 行の字", () => {
  it("K986-UN-001 下絵の 3 人と同じ initial・name・role・caps の真偽", () => {
    expect(TEAM_A.map((r) => teamRowView(r))).toEqual(TEAM.map((p) => ({ ...p })));
  });

  it("K986-UN-002 役の字：9 つ全部は運営の管理者・inquiry ありはサポート・money だけはお金・パスキーが無い人の sub は「… ・ パスキーを付ける前」", () => {
    const base = TEAM_A[1]!;
    expect(teamRowView({ ...base, caps: [...CAPS] }).role).toBe("運営の管理者");
    expect(teamRowView({ ...base, caps: ["inquiry", "money"] }).role).toBe("サポート");
    expect(teamRowView({ ...base, caps: ["money"] }).role).toBe("お金");
    expect(teamRowView({ ...base, caps: ["notice", "stop"] }).role).toBe("止める");
    expect(subOf({ ...base, has_passkey: false })).toBe("サポート ・ パスキーを付ける前");
    expect(subOf(base)).toBe("サポート ・ パスキー");
  });
});

describe("K-986 変える・外すを押せない訳", () => {
  it("K986-UN-003 is_self は self・locked_caps に plan_decide は last と「値段を決める」・ops_people は「運営の人」・どちらも無ければ null", () => {
    const base = TEAM_A[1]!;
    expect(editState({ ...base, is_self: true, locked_caps: ["plan_decide"] })).toEqual({ locked: "self" });
    expect(editState({ ...base, locked_caps: ["plan_decide"] })).toEqual({ locked: "last", cap: "値段を決める" });
    expect(editState({ ...base, locked_caps: ["ops_people"] })).toEqual({ locked: "last", cap: "運営の人" });
    expect(editState(base)).toEqual({ locked: null });
  });
});
