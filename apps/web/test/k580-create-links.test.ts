// K-580「作る面の ＋ つながりを足す」のうち、画面を使わない道具の単体試験：足した相手の並べ方・作る口に送る形・下書きの読み方。
//   行 ID は 11_tickets/K-580.md の行の表（K580-UN-001〜003）。画面の動きは apps/web/tests/k/k580-create-links.spec.ts（K580-UI-…）。
//   実装はまだ無いので、読み込みは試験の中（動的 import）で行う（まだ無い道具を import の時点で読んで準備を落とさない）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { describe, expect, it } from "vitest";

const MODEL = "../features/F4/links/create-links-model";
const SHAPE = "../features/F4/create-ticket/draft-shape";

type Kind = "related" | "derived_from";
interface Link {
  kind: Kind;
  id: string;
  number: string;
  title: string;
  stage?: { key: string; name: string };
}
type Model = {
  LINKS_MAX: number;
  addLink: (list: readonly Link[], link: Link) => Link[];
  removeLink: (list: readonly Link[], kind: Kind, id: string) => Link[];
  isLinked: (list: readonly Link[], kind: Kind, id: string) => boolean;
  toLinksPayload: (list: readonly Link[]) => { kind: Kind; other_ticket_id: string }[] | undefined;
};
type Shape = { readDraftBody: (raw: unknown) => Record<string, unknown> };
const load = async <T>(path: string): Promise<T> => (await import(/* @vite-ignore */ path)) as T;

const L = (kind: Kind, n: number): Link => ({
  kind,
  id: `6c000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  number: `EG-${String(n).padStart(3, "0")}`,
  title: `相手 ${n}`,
  stage: { key: "todo", name: "未着手" },
});

describe("K-580 作る面のつながり：足した相手の持ち方（画面を使わない）", () => {
  it("K580-UN-001 足す・外す・選べるか：派生元が関連より前に並び（それぞれ足した順）、同じ相手の同じ種類は足せず、同じ相手の別の種類は足せる。20 件を超えては足せない。渡した並びは変わらない", async () => {
    const m = await load<Model>(MODEL);
    expect(m.LINKS_MAX).toBe(20);
    const start: Link[] = [];
    const a = m.addLink(start, L("related", 1));
    const b = m.addLink(a, L("derived_from", 2));
    const c = m.addLink(b, L("related", 3));
    const d = m.addLink(c, L("derived_from", 4));
    expect(start).toEqual([]);
    expect(a).toHaveLength(1);
    expect(d.map((x) => [x.kind, x.id.slice(-1)])).toEqual([
      ["derived_from", "2"],
      ["derived_from", "4"],
      ["related", "1"],
      ["related", "3"],
    ]);
    expect(m.addLink(d, L("related", 1))).toEqual(d);
    expect(m.addLink(d, L("derived_from", 1))).toHaveLength(5);
    expect(m.isLinked(d, "related", L("related", 1).id)).toBe(true);
    expect(m.isLinked(d, "derived_from", L("related", 1).id)).toBe(false);
    const gone = m.removeLink(d, "related", L("related", 1).id);
    expect(gone.map((x) => x.id.slice(-1))).toEqual(["2", "4", "3"]);
    expect(d).toHaveLength(4);
    expect(m.removeLink(d, "derived_from", L("related", 1).id)).toEqual(d);
    let full: Link[] = [];
    for (let i = 1; i <= 25; i += 1) full = m.addLink(full, L(i % 2 === 0 ? "related" : "derived_from", i));
    expect(full).toHaveLength(20);
    expect(full.map((x) => x.id)).not.toContain(L("related", 21).id);
  });

  it("K580-UN-002 作る口に送る形：[{ kind, other_ticket_id }] の 2 つの鍵だけで、画面の並びのまま（派生元 → 関連）。1 件も無ければ undefined（体に links の鍵を付けない）", async () => {
    const m = await load<Model>(MODEL);
    expect(m.toLinksPayload([])).toBeUndefined();
    const list = [L("derived_from", 2), L("related", 1)];
    const p = m.toLinksPayload(list)!;
    expect(p).toEqual([
      { kind: "derived_from", other_ticket_id: L("derived_from", 2).id },
      { kind: "related", other_ticket_id: L("related", 1).id },
    ]);
    for (const x of p) expect(Object.keys(x).sort()).toEqual(["kind", "other_ticket_id"]);
    expect(JSON.stringify(p)).not.toContain("相手");
  });

  it("K580-UN-003 下書きの読み方：新しい形の links はそのまま読む。配列でない・種類が知らない・id か番号が文字でない行はその行だけ捨てる。20 件を超える分は先頭の 20 件だけ。links の無い古い下書きは links なしで、ほかの欄は残る", async () => {
    const s = await load<Shape>(SHAPE);
    const ok = L("related", 1);
    const read = (links: unknown) => s.readDraftBody({ title: "続き", links }) as { title?: string; links?: Link[] };
    expect(read([ok, L("derived_from", 2)]).links?.map((x) => x.id)).toEqual([ok.id, L("derived_from", 2).id]);
    expect(read("x").links ?? []).toEqual([]);
    expect(read({}).links ?? []).toEqual([]);
    const mixed = [{ ...ok, kind: "blocks" }, { ...ok, id: 5 }, { ...ok, number: null }, null, "x", ok];
    expect(read(mixed).links?.map((x) => x.id)).toEqual([ok.id]);
    const many = Array.from({ length: 30 }, (_v, i) => L(i % 2 === 0 ? "related" : "derived_from", i + 1));
    expect(read(many).links).toHaveLength(20);
    const old = s.readDraftBody({ title: "前の形", notify_member_ids: [] }) as { title?: string; links?: Link[] };
    expect(old.title).toBe("前の形");
    expect(old.links ?? []).toEqual([]);
  });
});
