// K-145：タブの下書きの id（sessionStorage）の確かめを、契約の isUuid（z.uuid()・版と variant の桁まで）にそろえる（D-129.42）。
//   合わない id が置いてあれば新しく作る。画面の部品を node で動かす写しの Storage は apps/web/test/k60-draft-signout.test.ts と同じ形。
//   行 ID は 11_tickets/K-145.md の表。テストはチケットのセッションが書き、実装より先にコミットする（D-128.125）
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isUuid } from "@kaname/contracts";

class MemoryStorage {
  private m = new Map<string, string>();
  get length(): number {
    return this.m.size;
  }
  key(i: number): string | null {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v));
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  clear(): void {
    this.m.clear();
  }
}
let session: MemoryStorage;
let local: MemoryStorage;
const owner = { workspace: "aaaaaaaa-0000-4000-8000-000000000001", member: "11111111-0000-4000-8000-000000000001" };
const TAB_KEY = `kaname.ticket-draft-id:${owner.workspace}:${owner.member}`;

beforeEach(() => {
  local = new MemoryStorage();
  session = new MemoryStorage();
  vi.stubGlobal("window", { localStorage: local, sessionStorage: session, location: { href: "http://localhost/" } });
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("sessionStorage", session);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("K-145 タブの下書きの id", () => {
  it("K145-UI-001 置いてある id が 36 個のハイフン・版の桁 0・形違いなら、新しい正式な uuid に置き換えて保存する。正しい v4 はそのまま返す（2 回目も同じ）", async () => {
    const { tabDraftId } = await import("../features/F4/create-ticket/draft");
    for (const bad of ["------------------------------------", "3fa85f64-5717-0562-b3fc-2c963f66afa6", "not-a-uuid"]) {
      session.setItem(TAB_KEY, bad);
      const id = tabDraftId(owner);
      expect(id, bad).not.toBe(bad);
      expect(isUuid(id), bad).toBe(true);
      expect(session.getItem(TAB_KEY), bad).toBe(id);
      expect(tabDraftId(owner), "2 回目も同じ").toBe(id);
    }
    const good = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    session.setItem(TAB_KEY, good);
    expect(tabDraftId(owner)).toBe(good);
    expect(session.getItem(TAB_KEY)).toBe(good);
  });
});
