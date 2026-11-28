// K-60「チケットを作る」：本当のログアウトの道と、ログイン切れの道で、この PC の下書きの写しが消える（共有の PC で次の人に見せない・H1）。
//   チケットの画面の外枠にはログアウトのボタンが無いので、画面から呼ばれるログアウトの関数（lib/auth の signOut）と、
//   口が 401 を返したときの道（lib/api/client の notifyUnauthorized）を直に呼ぶ。行 ID は 07_qa/test-specs/k/create-ticket.md と K-60.md の表。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth/client", () => ({
  authClient: { signOut: vi.fn(async () => ({ data: { success: true } })), useSession: vi.fn() },
  refreshSession: vi.fn(),
}));

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
  keys(): string[] {
    return [...this.m.keys()];
  }
}
let local: MemoryStorage;
let session: MemoryStorage;
const WS = "aaaaaaaa-0000-4000-8000-000000000001";
const A = "11111111-0000-4000-8000-000000000001";

/** A が書きかけを残した状態（鍵の形は実装に任せ、kaname.ticket-draft で始まる鍵を全部見る） */
const seed = () => {
  local.setItem("kaname.token", "tok-a");
  local.setItem(`kaname.ticket-draft:${WS}`, JSON.stringify({ id: "d1", body: { title: "A の書きかけ" } }));
  local.setItem(`kaname.ticket-draft:${WS}:${A}`, JSON.stringify({ id: "d1", body: { title: "A の書きかけ" } }));
  session.setItem(`kaname.ticket-draft-id:${WS}`, "d1");
  session.setItem(`kaname.ticket-draft-id:${WS}:${A}`, "d1");
  local.setItem("kaname.theme", "dark"); // 下書きでないものは消さない
};
const drafts = () => [...local.keys(), ...session.keys()].filter((k) => k.startsWith("kaname.ticket-draft"));

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

describe("K-60 ログアウトとログイン切れで、この PC の下書きの写しを消す", () => {
  it("K60-UI-036 ログアウト（lib/auth の signOut）：kaname.ticket-draft で始まる写しとタブの下書きの id が全部消える。ほかの設定は残る", async () => {
    seed();
    const { signOut } = await import("../lib/auth/session");
    await signOut();
    expect(drafts()).toEqual([]);
    expect(local.getItem("kaname.token")).toBeNull();
    expect(local.getItem("kaname.theme")).toBe("dark");
  });

  it("K60-UI-037 ログイン切れ（口が 401・notifyUnauthorized）：写しとタブの下書きの id が全部消える", async () => {
    seed();
    const { notifyUnauthorized } = await import("../lib/api/client");
    notifyUnauthorized();
    expect(drafts()).toEqual([]);
    expect(local.getItem("kaname.token")).toBeNull();
    expect(local.getItem("kaname.theme")).toBe("dark");
  });
});
