// K-779「試し打ちの片付け」のうち、段 10 の K-700 の引き金（仕事が done になったとき必ず守るの未チェックを「破られた」と数える）の試験。
//   行 ID は K779-API-NNN（11_tickets/K-779.md の表の行と 1 対 1）。土台は段 10 の K-700 が運ぶ F9/knowledge.guard-kit.ts と K-687 の knowledge.requests-kit.ts。
//   試し打ちは確認項目を変えない仕事なので、終わっても破られた数に数えず、やり取りにも「守れていなかった決まり」の行を書かない。作る段・承認の後の実行の仕事は前のまま数える。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。K-700 の md は直さない（この葉が引き金の関数を作り直す）。
import { describe, expect, it } from "vitest";
import { setupKnowledge } from "../F9/knowledge.harness.js";
import { audits } from "../F9/knowledge.requests-kit.js";
import { breachLines, breachRows, finishJob, scene } from "../F9/knowledge.guard-kit.js";

const h = setupKnowledge();

/** 試し打ちの phase にする（K-746 の migration が要る。無ければ check の違反の文を出さずに分かる文で落とす） */
const toDryRun = async (job: string): Promise<void> => {
  try {
    await h.admin.query("update action_runs set phase = 'dry_run' where bridge_job_id = $1", [job]);
  } catch {
    throw new Error("試し打ちの phase がまだ入っていない（K-746 の migration の前）");
  }
};

describe("K-779 試し打ちの仕事は破られた数に数えない", () => {
  it("K779-API-006 最新の実行が試し打ち（phase dry_run）の仕事が結果つきで終わっても、必ず守るの未チェックは数えず（行 0）、やり取りにも証跡にも「守れていなかった決まり」が出ない", async () => {
    await h.ready();
    const s = await scene(h, "k779-006");
    await toDryRun(s.job);
    await finishJob(h, s.job);
    expect(await breachRows(h, s.ticket)).toEqual([]);
    expect(await breachLines(h, s.ticket)).toEqual([]);
    expect(await audits(h, s.w, "knowledge.breach.record")).toEqual([]);
  });

  it("K779-API-007 作る段（make）・承認の後の実行（execute）の仕事は前のまま数える：同じ場面で phase が make なら未チェックの 3 行が数えられ、execute でも同じ。試し打ちだけが数えない", async () => {
    await h.ready();
    for (const phase of ["make", "execute"] as const) {
      const s = await scene(h, `k779-007-${phase}`);
      await h.admin.query("update action_runs set phase = $2 where bridge_job_id = $1", [s.job, phase]);
      await finishJob(h, s.job);
      expect(await breachRows(h, s.ticket)).toHaveLength(3);
      expect(await breachLines(h, s.ticket)).toHaveLength(3);
    }
  });
});
