// K-710「メンバーをグループごとに（グループを押すとメンバーが出る）」の単体の試験（画面の外の、決まった形だけ）：
//   メンバーの口の答え → グループの行の値（札の色・マネージャーの行・初めに開く物・見出しの字・開き閉じ）（features/F9/members/shape.ts）。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-710.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import {
  groupKey,
  headSub,
  initialOpen,
  managerLine,
  peopleTotal,
  toggled,
  toneOf,
} from "../features/F9/members/shape";

type MemberIn = Parameters<typeof managerLine>[0][number];
const m = (
  name: string,
  groupRole: string | null,
  over: Partial<MemberIn & { self: boolean; primary: boolean }> = {},
) =>
  ({ id: name, name, group_role: groupRole, self: false, primary: true, ...over }) as MemberIn & {
    self: boolean;
    primary: boolean;
  };
type GroupIn = Parameters<typeof initialOpen>[0][number];
const g = (id: string, code: string | null, name: string, members: ReturnType<typeof m>[]): GroupIn =>
  ({ id, code, name, members }) as GroupIn;

describe("K710-UN", () => {
  it("K710-UN-001 toneOf・groupKey：札の色は作った順（口の並び）に teal・plum・amber を回す・札の字は code（無ければグループ名の頭 1 字）", () => {
    expect([0, 1, 2, 3, 4, 5].map(toneOf)).toEqual(["teal", "plum", "amber", "teal", "plum", "amber"]);
    expect(groupKey(g("a", "EG", "営業", []))).toBe("EG");
    expect(groupKey(g("b", null, "受託開発", []))).toBe("受");
    expect(groupKey(g("c", "", "経理", []))).toBe("経");
  });

  it("K710-UN-002 managerLine：そのグループで group_role が manager の人の名前を「・」でつなぐ・いなければ「マネージャー：なし」・兼ねる側の行でも group_role で決める", () => {
    expect(managerLine([m("高本", null), m("佐藤 花子", "manager")])).toBe("マネージャー：佐藤 花子");
    expect(managerLine([m("佐藤 花子", "manager"), m("田中 美咲", "manager", { primary: false })])).toBe(
      "マネージャー：佐藤 花子・田中 美咲",
    );
    expect(managerLine([m("高本", null)])).toBe("マネージャー：なし");
    expect(managerLine([])).toBe("マネージャー：なし");
  });

  it("K710-UN-003 initialOpen：自分（self）が主の所属（primary）で入っているグループだけ開く・兼ねる側（primary でない）は開かない・自分がどこにも主で入っていなければ最初のグループ・グループが 0 なら空", () => {
    const sales = g("s", "EG", "営業", [m("高本", null, { self: true })]);
    const dev = g("d", "JD", "受託開発", [m("高本", null, { self: true, primary: false })]);
    expect(initialOpen([dev, sales])).toEqual(["EG"]);
    expect(initialOpen([dev, g("k", "KR", "経理", [m("山口", "manager")])])).toEqual(["JD"]);
    expect(initialOpen([])).toEqual([]);
  });

  it("K710-UN-004 headSub・peopleTotal：見出しは「N つのグループ ・ M 人。グループを押すと、そのグループのメンバーが出ます」・人数は口の count から招待中を引く（重ねない人数・0 を下回らない）", () => {
    expect(headSub(3, 9)).toBe("3 つのグループ ・ 9 人。グループを押すと、そのグループのメンバーが出ます");
    expect(peopleTotal({ count: 6, invitations: [{}] })).toBe(5);
    expect(peopleTotal({ count: 5, invitations: [] })).toBe(5);
    expect(peopleTotal({ count: 0, invitations: [{}, {}] })).toBe(0);
  });

  it("K710-UN-005 toggled：開いていなければ足し・開いていれば外す・ほかのグループの開き閉じは変えず・元の配列を変えない", () => {
    const open = ["EG"] as const;
    expect(toggled(open, "JD")).toEqual(["EG", "JD"]);
    expect(toggled(["EG", "JD"], "EG")).toEqual(["JD"]);
    expect(toggled([], "EG")).toEqual(["EG"]);
    expect(open).toEqual(["EG"]);
  });
});
