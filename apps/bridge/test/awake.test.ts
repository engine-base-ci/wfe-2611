// 仕事の間だけ PC を寝かせない（D-124.1・CHT-42-001）。powerSaveBlocker は偽物
import { describe, expect, it } from "vitest";
import { createAwake } from "../src/awake";

const fake = () => {
  const calls: string[] = [];
  let n = 0;
  return {
    calls,
    saver: {
      start: (t: string) => {
        calls.push(`start:${t}`);
        n += 1;
        return n;
      },
      stop: (id: number) => void calls.push(`stop:${id}`),
    },
  };
};

describe("createAwake", () => {
  it("CHT-42-001 working が入ったら 1 回だけ頼み、空になったら 1 回だけ解く。同じ状態が続いても呼び直さない", () => {
    const f = fake();
    const awake = createAwake(f.saver);
    awake(null); // 待っているだけ：頼まない
    awake("j-1");
    awake("j-1"); // 同じ仕事が続いている：頼み直さない
    awake("j-2"); // 次の仕事に移っても、立てたままにする（間が無い）
    awake(null);
    awake(null); // もう解けている：解き直さない
    expect(f.calls).toEqual(["start:prevent-app-suspension", "stop:1"]);
  });
  it("CHT-42-001 頼めなくても落ちない。次に空になっても解こうとしない（持っていない）", () => {
    const awake = createAwake({
      start: () => {
        throw new Error("no power api");
      },
      stop: () => {
        throw new Error("never");
      },
    });
    expect(() => {
      awake("j-1");
      awake(null);
    }).not.toThrow();
  });
});
