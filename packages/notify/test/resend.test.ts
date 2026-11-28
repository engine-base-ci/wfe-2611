import { describe, expect, it } from "vitest";
import { resendTransport } from "../src/resend.js";
import type { NotifyEvent } from "../src/index.js";

const ev: NotifyEvent = { kind: "approval.requested", payload: { title: "件名", body: "本文" }, dedupeKey: "k" };
describe("メールの送出（関門 C6 の中・Resend）", () => {
  it("email は送出先へ、それ以外は inbox へ", async () => {
    const sent: unknown[] = [];
    const inbox: string[] = [];
    const t = resendTransport(
      {
        send: async (m) => {
          sent.push(m);
          return { error: null };
        },
      },
      "no-reply@x",
      async (ch, m) => {
        inbox.push(`${ch}:${m}`);
      },
    );
    await t.send("email", "a@x", "m1", ev);
    await t.send("inapp", null, "m1", ev);
    expect(sent).toHaveLength(1);
    expect((sent[0] as { subject: string }).subject).toBe("件名");
    expect(inbox).toEqual(["inapp:m1"]);
  });
  it("鍵が無い・宛先が無い・先方の失敗は例外（黙って成功にしない・G-15）", async () => {
    const noKey = resendTransport(null, "f", async () => {});
    await expect(noKey.send("email", "a@x", "m", ev)).rejects.toThrow(/RESEND_API_KEY/);
    const fail = resendTransport({ send: async () => ({ error: { message: "boom" } }) }, "f", async () => {});
    await expect(fail.send("email", "a@x", "m", ev)).rejects.toThrow(/boom/);
    await expect(fail.send("email", null, "m", ev)).rejects.toThrow(/宛先/);
  });
});
