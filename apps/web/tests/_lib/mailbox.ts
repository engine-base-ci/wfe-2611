// 試験用の受け箱（K-54）：Resend の口（POST /emails）の代わりに、届いたメールを手元で受け取る。
//   API は本物の送出の道（関門 C6・packages/notify の resendMail → Resend の SDK）をそのまま通り、行き先だけがここになる：
//   API を RESEND_API_KEY（試験の値）と RESEND_BASE_URL=http://127.0.0.1:<QA_MAILBOX_PORT> で立てる（SDK が読む行き先・本番は空）。
//   本文（text）から確認のリンクを取り出して開く。画面に出たリンクや API のログ（_lib/api.ts の lastMailUrl）は使わない。
//   探したが無かった：目録（03_architecture/catalog.json）の共通の処理・apps/web/tests/_lib・apps/api/test/_pending.ts に受け箱は無い。
//   似たもの：lastMailUrl（api.ts）は API のログの「リンク」の行を読む。送ったメールそのもの（宛先・件名・本文・署名）ではなく、
//   送れなかった（送出先が無い）ときにも行が出るので、「メールが届いてリンクが開ける」ことの証拠にならない。/dev/mail の画面も同じログを読む
import { createServer, type IncomingMessage, type Server } from "node:http";

export interface Mail {
  to: string;
  from: string;
  subject: string;
  text: string;
  /** 受け取った順（1 から） */
  seq: number;
}

/** 受け箱の番号（API の RESEND_BASE_URL と同じにする） */
export const MAILBOX_PORT = Number(process.env["QA_MAILBOX_PORT"] ?? 3191);

const body = (req: IncomingMessage): Promise<string> =>
  new Promise((ok, ng) => {
    let s = "";
    req.setEncoding("utf8");
    req.on("data", (c: string) => (s += c));
    req.on("end", () => ok(s));
    req.on("error", ng);
  });
const first = (v: unknown): string => (Array.isArray(v) ? String(v[0] ?? "") : String(v ?? ""));

export class Mailbox {
  private server: Server | null = null;
  private readonly box: Mail[] = [];

  /** 受け箱を開く。番号が使われていたら止める（別の受け箱にメールが流れると、届かないのと区別できない） */
  async open(port = MAILBOX_PORT): Promise<void> {
    if (this.server) return;
    const s = createServer((req, res) => {
      void (async () => {
        if (req.method !== "POST" || !(req.url ?? "").startsWith("/emails")) {
          res.writeHead(404, { "content-type": "application/json" }).end('{"message":"not found"}');
          return;
        }
        const j = JSON.parse((await body(req)) || "{}") as Record<string, unknown>;
        const m: Mail = {
          to: first(j["to"]).toLowerCase(),
          from: first(j["from"]),
          subject: first(j["subject"]),
          text: first(j["text"]),
          seq: this.box.length + 1,
        };
        this.box.push(m);
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ id: `qa-mail-${m.seq}` }));
      })().catch((e: unknown) => {
        res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ message: String(e) }));
      });
    });
    await new Promise<void>((ok, ng) => {
      s.once("error", ng);
      s.listen(port, "127.0.0.1", () => ok());
    });
    this.server = s;
  }

  async close(): Promise<void> {
    const s = this.server;
    this.server = null;
    if (s) await new Promise<void>((ok) => s.close(() => ok()));
  }

  /** その宛先に届いたメール（届いた順）。件名で絞れる */
  mails(to: string, subject?: RegExp): Mail[] {
    const t = to.toLowerCase();
    return this.box.filter((m) => m.to === t && (!subject || subject.test(m.subject)));
  }

  /** その宛先に n 通目（1 から）が届くまで待つ。眠らずに短く見に行く。届かなければ理由つきで落とす */
  async waitFor(to: string, n = 1, subject = /確認/, timeoutMs = 15_000): Promise<Mail> {
    const end = Date.now() + timeoutMs;
    for (;;) {
      const got = this.mails(to, subject);
      if (got.length >= n) return got[n - 1]!;
      if (Date.now() > end)
        throw new Error(
          `受け箱に ${to} 宛ての ${n} 通目（件名 ${subject}）が届かない（届いたのは ${got.length} 通）。` +
            `API を RESEND_API_KEY と RESEND_BASE_URL=http://127.0.0.1:${MAILBOX_PORT} で立てているか確かめる`,
        );
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

/** 本文から、その道（/verify-email など）のリンクを 1 本取り出す。無い・2 本以上なら落とす（どれを押すか分からないメールにしない） */
export function linkIn(mail: Mail, path: string): string {
  const all = [...mail.text.matchAll(/https?:\/\/[^\s<>"）)]+/g)].map((m) => m[0]);
  const hits = all.filter((u) => new URL(u).pathname === path);
  if (hits.length !== 1)
    throw new Error(`本文に ${path} のリンクが ${hits.length} 本（${mail.subject}）:\n${mail.text}`);
  return hits[0]!;
}
