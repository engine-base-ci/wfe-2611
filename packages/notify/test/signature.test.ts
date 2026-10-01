// メールの署名と返信先（D-096）。送り出す 1 か所で全部のメールに付くこと・載せないと決めたものが漏れないこと
import { describe, expect, it } from "vitest";
import { mailSignature, signedMail, withSignature, type Operator } from "../src/signature.js";
import type { MailLike } from "../src/resend.js";

const OP: Operator = {
  service: "Kaname",
  company: "株式会社ENGINE BASE",
  representative: "高本聖斗",
  email: "info@engine-base.com",
  phone: "090-1180-5989",
  address: "東京都どこか 1-2-3",
};

describe("署名の文面（D-096.2〜.4）", () => {
  it("サービス名・会社名・代表者名・お問い合わせを載せる", () => {
    const s = mailSignature(OP);
    expect(s).toContain("Kaname");
    expect(s).toContain("運営：株式会社ENGINE BASE（代表 高本聖斗）");
    expect(s).toContain("お問い合わせ：info@engine-base.com");
  });
  it("電話と住所は、渡されていても載せない（携帯を全利用者に配らない・住所はまだ持たない）", () => {
    const s = mailSignature(OP);
    expect(s).not.toContain("090");
    expect(s).not.toContain("東京都");
  });
  it("提供元の名前を製品名として使わない（D-092.5）", () => {
    expect(mailSignature(OP)).not.toMatch(/anthropic|claude/i);
  });
  it("署名は 1 回だけ（二重に付けない）", () => {
    const once = withSignature("本文", OP);
    expect(withSignature(once, OP)).toBe(once);
    expect(once.split("運営：").length - 1).toBe(1);
  });
});

describe("送り出す 1 か所で付ける（関門 C6）", () => {
  it("どのメールにも署名と返信先（info@）が付く。差出人は変えない", async () => {
    const got: Parameters<MailLike["send"]>[0][] = [];
    const inner: MailLike = { send: async (m) => (got.push(m), { error: null }) };
    const mail = signedMail(inner, OP, "info@engine-base.com");
    await mail.send({ from: "Kaname <noreply@engine-base.com>", to: "a@example.com", subject: "確認", text: "リンクを押してください" });
    await mail.send({ from: "Kaname <noreply@engine-base.com>", to: "b@example.com", subject: "再設定", text: "再設定のリンク" });
    expect(got).toHaveLength(2);
    for (const m of got) {
      expect(m.from).toBe("Kaname <noreply@engine-base.com>");
      expect(m.replyTo).toBe("info@engine-base.com");
      expect(m.text).toContain("運営：株式会社ENGINE BASE（代表 高本聖斗）");
      expect(m.text).not.toContain("090");
    }
    expect(got[0]!.text.startsWith("リンクを押してください")).toBe(true);
  });
  it("失敗はそのまま返す（署名を付けても黙って成功にしない・G-15）", async () => {
    const mail = signedMail({ send: async () => ({ error: { message: "boom" } }) }, OP, "info@engine-base.com");
    expect((await mail.send({ from: "f", to: "t", subject: "s", text: "x" })).error?.message).toBe("boom");
  });
});
