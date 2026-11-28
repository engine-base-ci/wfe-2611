// K-1109「メールにファイルを付ける力」（関門 C6 の中・@kaname/notify の MailLike・resendMail・signedMail）。
//   テストの名前の頭の行 ID（K1109-UN-…）は 11_tickets/K-1109.md の表の行に 1 対 1 で結ぶ。
//   Resend の SDK は差し替える（本物の送出先へは送らない）。テストはチケットを作る人が書き、実装する人は変えない
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MailLike } from "../src/resend.js";

const sent: unknown[] = [];
vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (m: unknown) => {
        sent.push(m);
        return { error: null };
      },
    };
  },
}));

const { resendMail, MAIL_ATTACH_MAX } = await import("../src/resend.js");
const { signedMail, mailSignature } = await import("../src/signature.js");

const OP = {
  service: "Kaname",
  company: "株式会社ENGINE BASE",
  representative: "高本聖斗",
  email: "info@engine-base.com",
};
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // %PDF-1.7
const BASE = {
  from: "no-reply@kaname.test",
  to: "admin@example.test",
  subject: "【Kaname】2014 年 5 月分の請求書",
  text: "本文",
};

beforeEach(() => {
  sent.length = 0;
});

describe("K-1109 メールにファイルを付ける", () => {
  it("K1109-UN-001 resendMail は Resend の emails.send に attachments（名前・同じ bytes の Buffer・種類）を渡す", async () => {
    const r = await resendMail("re_test").send({
      ...BASE,
      attachments: [{ filename: "請求書_2014-05.pdf", content: PDF, contentType: "application/pdf" }],
    });
    expect(r.error).toBeNull();
    expect(sent).toHaveLength(1);
    const a = (sent[0] as { attachments: { filename: string; content: Buffer; contentType: string }[] }).attachments;
    expect(a.map((x) => [x.filename, x.contentType])).toEqual([["請求書_2014-05.pdf", "application/pdf"]]);
    expect(Buffer.isBuffer(a[0]!.content)).toBe(true);
    expect(a[0]!.content.equals(Buffer.from(PDF))).toBe(true);
  });

  it("K1109-UN-002 signedMail は attachments をそのまま渡し、本文の末尾に署名を 1 回だけ付け、返信先も付ける", async () => {
    const got: Parameters<MailLike["send"]>[0][] = [];
    const inner: MailLike = {
      send: async (m) => {
        got.push(m);
        return { error: null };
      },
    };
    const att = [{ filename: "請求書_2014-05.pdf", content: PDF, contentType: "application/pdf" }];
    await signedMail(inner, OP, "info@engine-base.com").send({ ...BASE, attachments: att });
    expect(got[0]!.attachments).toEqual(att);
    expect(got[0]!.text.split(mailSignature(OP)).length - 1).toBe(1);
    expect(got[0]!.replyTo).toBe("info@engine-base.com");
  });

  it("K1109-UN-003 大きすぎる：合計が 10MB を 1 バイト超える添付は「添付が大きすぎる」の例外で、Resend を呼ばない", async () => {
    expect(MAIL_ATTACH_MAX).toBe(10 * 1024 * 1024);
    const half = new Uint8Array(MAIL_ATTACH_MAX / 2);
    const big = [
      { filename: "a.pdf", content: half, contentType: "application/pdf" },
      { filename: "b.pdf", content: new Uint8Array(MAIL_ATTACH_MAX / 2 + 1), contentType: "application/pdf" },
    ];
    await expect(resendMail("re_test").send({ ...BASE, attachments: big })).rejects.toThrow("添付が大きすぎる");
    expect(sent).toHaveLength(0);
  });

  it("K1109-UN-004 付けない：attachments が無い・空の呼び方は、Resend に attachments の欄を渡さない（前と同じ引数）", async () => {
    await resendMail("re_test").send({ ...BASE });
    await resendMail("re_test").send({ ...BASE, attachments: [] });
    expect(sent).toHaveLength(2);
    for (const m of sent) expect(Object.keys(m as object).sort()).toEqual(["from", "subject", "text", "to"]);
  });
});
