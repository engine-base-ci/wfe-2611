// 葉 K-378「共有の試験 ../k144-contract.test.ts に葉が足す分を、葉ごとのファイルから読む」自身の葉のファイル（置き方は README.md）。
//   つなぎの確かめ：本体が置き場を本当に読み、葉の準備（setup）を 1 回呼び、葉だけの試験（tests）を並べ、本体の手助けを渡していることを、
//   本体の回の中で確かめる（行 K378-KL-019・CI が判定する）。置き場が在るかぎり残す（消さない）。
//   入口の uuid の行と体は持たない：行は「作った口 × uuid の値」と 1 対 1（契約の形の検査 K144-SHAPE-017）で、この葉は口を作らない。
//   行と体のつなぎは K378-KL-017（字で見る）と、最初の葉の行（K-364 の K144-API-070 など）が見る。
//   土台（試験の土台のファイル）は値で読み込まない（型は _base.ts から。値で読み込むと、DB の住所の無い所で置き場が読めなくなる）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { describe, expect, it } from "vitest";
import type { K144Leaf } from "./_base.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
let setupCalls = 0;
let setupPool: unknown;

export const leaf: K144Leaf = {
  setup: (f) => {
    setupCalls += 1;
    setupPool = f.pool;
  },
  tests: (k) => {
    describe("K-378 置き場のつなぎ（本体が葉のファイルを読み、準備を呼び、葉だけの試験に手助けを渡す）", () => {
      it("K378-KL-019 本体の回の中：葉の準備はこの試験より前にちょうど 1 回呼ばれ、受け取った土台は試験が読む土台と同じ物。準備で入る値（書く人・担当の人・会社・PC の印）は試験の中で読め、手助け（契約の定義・DB の数・口を叩く・答えを読む・契約どおりか）が本物として動く", async () => {
        expect(setupCalls, "葉の準備（setup）が呼ばれた回数").toBe(1);
        expect(setupPool, "準備が受け取った土台は、試験が読む土台と同じ物").toBe(k.f.pool);
        expect(k.writer.id).toMatch(UUID);
        expect(k.writer.tenantId).toBe(k.T.tenantId);
        expect(k.mate.id).toMatch(UUID);
        expect(k.mate.id).not.toBe(k.writer.id);
        expect(k.pcToken().length, "書く人の PC の印").toBeGreaterThan(0);
        expect(k.def("getTicket").operationId).toBe("getTicket");
        expect(await k.count("select count(*) as n from members where id = $1", [k.writer.id])).toBe(1);
        const r = await k.hit("getTicket", "path", "id", "not-a-uuid");
        expect(r.status).toBe(422);
        const j = await k.json(r);
        expect(k.fields(j)).toContain("id");
        expect(k.uuidReason(j, "id")).toBe("uuid");
        await k.conforms("getTicket", r);
      });
    });
  },
};
