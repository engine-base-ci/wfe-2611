// K-693「グループを選んで共有と写して直す」の単体の試験（画面の外の、決まった形だけ）：
//   小窓の行の組み立て・マネージャーの字・選びの差分・送る体・ボタンの字・外すときの注意・お知らせの字・帯の字（share-shape.ts）。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-693.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import {
  copyFromText,
  managerText,
  removeNote,
  shareBody,
  shareDiff,
  shareDoneText,
  shareRows,
  shareSubmitLabel,
  sharedWriter,
} from "../features/F9/knowledge/share-shape";

type G = Parameters<typeof shareRows>[0][number];
const g = (
  id: string,
  name: string,
  manager: string,
  state: G["state"],
  checked = state === "shared" || state === "waiting",
): G => ({
  group_id: id,
  name,
  manager_name: manager,
  checked,
  state,
});
const GROUPS: G[] = [
  g("d", "受託開発", "田中 美咲", null),
  g("k", "経理", "山口 恵", "waiting"),
  g("l", "法務", "木下 浩", "shared"),
  g("h", "人事", "", null),
  g("x", "広報", "中村 一郎", "declined", false),
];

describe("K693-UN", () => {
  it("K693-UN-001 managerText・shareRows：マネージャーの名前に「さん」（複数は「・」でつなぐ・いなければ「まだいません」）・状態の字（共有している・承認待ち・断られた）・選べない行（マネージャーがいず共有も頼みも無い）・チェックは渡した選びで決まる", () => {
    expect(managerText("田中 美咲")).toBe("田中 美咲さん");
    expect(managerText("田中 美咲・山口 恵")).toBe("田中 美咲さん・山口 恵さん");
    expect(managerText("")).toBe("まだいません");
    const rows = shareRows(GROUPS, new Set(["k", "l", "d"]));
    expect(rows.map((r) => [r.code, r.manager, r.checked, r.state, r.locked])).toEqual([
      ["d", "田中 美咲さん", true, undefined, false],
      ["k", "山口 恵さん", true, "承認待ち", false],
      ["l", "木下 浩さん", true, "共有している", false],
      ["h", "まだいません", false, undefined, true],
      ["x", "中村 一郎さん", false, "断られた", false],
    ]);
    expect(rows.map((r) => r.name)).toEqual(["受託開発", "経理", "法務", "人事", "広報"]);
  });

  it("K693-UN-002 shareDiff・shareBody・shareSubmitLabel・removeNote・shareDoneText：足す／外すは開いたときの状態との差・体は page_id とチェックが付いた全部（グループの並び順・冪等の鍵は口の側）・ボタンの字は足す数（足さず外すだけなら「共有を変える」・変えていなければ「共有を頼む」）・外す注意・お知らせの字", () => {
    expect(shareDiff(GROUPS, new Set(["k", "l"]))).toEqual({ added: [], removed: [] });
    expect(shareDiff(GROUPS, new Set(["d", "x", "k"]))).toEqual({ added: ["d", "x"], removed: ["l"] });
    expect(shareDiff(GROUPS, new Set())).toEqual({ added: [], removed: ["k", "l"] });
    expect(shareBody("p1", GROUPS, new Set(["x", "d", "l"]))).toEqual({ page_id: "p1", group_ids: ["d", "l", "x"] });
    expect(shareBody("p1", GROUPS, new Set())).toEqual({ page_id: "p1", group_ids: [] });
    expect(shareSubmitLabel(1, 0)).toBe("1 つのグループに共有を頼む");
    expect(shareSubmitLabel(3, 2)).toBe("3 つのグループに共有を頼む");
    expect(shareSubmitLabel(0, 1)).toBe("共有を変える");
    expect(shareSubmitLabel(0, 0)).toBe("共有を頼む");
    expect(removeNote([])).toBeNull();
    expect(removeNote(["法務", "経理"])).toBe("外すと、法務・経理への共有をやめます（承認待ちの頼みは取り下げます）。");
    const after = GROUPS.map((x) => {
      if (x.group_id === "d") return { ...x, checked: true, state: "waiting" as const };
      if (x.group_id === "x") return { ...x, checked: true, state: "shared" as const };
      if (x.group_id === "l") return { ...x, checked: false, state: null };
      if (x.group_id === "k") return { ...x, checked: false, state: null };
      return x;
    });
    expect(shareDoneText(GROUPS, after)).toBe(
      "共有しました（広報）。共有を頼みました（受託開発）。共有をやめました（法務）。頼みを取り下げました（経理）。",
    );
    expect(shareDoneText(GROUPS, GROUPS)).toBe("");
  });

  it("K693-UN-003 sharedWriter・copyFromText：共有された側の帯の「直せる人」（<グループ>のマネージャー（A さん・B さん）・いなければ括弧なし）・写しの帯の元の字（棚 › フォルダ › … の「題名」・元が消えたら null）", () => {
    expect(sharedWriter("営業", ["佐藤 花子"])).toBe("営業のマネージャー（佐藤 花子さん）");
    expect(sharedWriter("営業", ["佐藤 花子", "鈴木 一郎"])).toBe("営業のマネージャー（佐藤 花子さん・鈴木 一郎さん）");
    expect(sharedWriter("営業", [])).toBe("営業のマネージャー");
    expect(
      copyFromText({
        page_id: "p",
        title: "請求書の送り方",
        shelf_name: "会社",
        folders: ["経理"],
        must: true,
        gone: false,
      }),
    ).toBe("会社 › 経理 の「請求書の送り方」");
    expect(
      copyFromText({ page_id: "p", title: "見積書", shelf_name: "営業", folders: [], must: false, gone: false }),
    ).toBe("営業 の「見積書」");
    expect(copyFromText({ page_id: null, title: "", shelf_name: "", folders: [], must: false, gone: true })).toBeNull();
  });
});
