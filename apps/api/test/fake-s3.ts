// 試験の偽の S3（path-style・GET だけ）。期限つき URL（SigV4 の query の署名）を、AWS の仕様のとおりに自分で計算し直して確かめる
//   （AWS SDK の署名の部品は使わない＝署名した側と別の作りで確かめる）。署名が合わない・期限を過ぎた・形が違うは 403。
//   目録（kaname-bridge.json）だけは署名なしで読める（公開の読み・置き場の頭の下）。
//   仕様：https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
import { createHash, createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_S3 = {
  accessKeyId: "K57TESTACCESSKEY",
  secretAccessKey: "k57-test-secret-only-for-tests",
  region: "ap-northeast-1",
};
export interface FakeS3 {
  endpoint: string;
  /** bucket/key → 中身。public が true なら署名なしで読める */
  objects: Map<string, { body: Buffer; public?: boolean }>;
  /** 偽の S3 の時計（期限切れを、眠らずに確かめる） */
  now: () => number;
  setNow: (f: () => number) => void;
  /** 断った理由（試験で、何で断ったかを見る） */
  denied: string[];
  close: () => Promise<void>;
}

const enc = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const hmac = (k: Buffer | string, s: string) => createHmac("sha256", k).update(s).digest();
const amzTime = (v: string) => {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(v);
  return m ? Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!) : NaN;
};

/** 期限つき URL を確かめる。合えば null、合わなければ断る理由 */
function verify(method: string, host: string, rawPath: string, q: URLSearchParams, now: number): string | null {
  if (q.get("X-Amz-Algorithm") !== "AWS4-HMAC-SHA256") return "署名の形が違う";
  const cred = (q.get("X-Amz-Credential") ?? "").split("/");
  const [ak, date, region, service, term] = cred;
  if (cred.length !== 5 || ak !== FAKE_S3.accessKeyId || service !== "s3" || term !== "aws4_request") return "鍵が違う";
  const at = amzTime(q.get("X-Amz-Date") ?? "");
  const ttl = Number(q.get("X-Amz-Expires"));
  if (!Number.isFinite(at) || !Number.isInteger(ttl) || ttl < 1 || ttl > 604800) return "期限の形が違う";
  if (now > at + ttl * 1000) return "期限切れ";
  const signedHeaders = q.get("X-Amz-SignedHeaders") ?? "";
  if (signedHeaders !== "host") return "署名した頭が違う";
  const query = [...q.entries()]
    .filter(([k]) => k !== "X-Amz-Signature")
    .map(([k, v]) => [enc(k), enc(v)] as const)
    .sort(([a, x], [b, y]) => (a < b ? -1 : a > b ? 1 : x < y ? -1 : x > y ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const canonical = [method, rawPath, query, `host:${host}\n`, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const scope = `${date}/${region}/s3/aws4_request`;
  const toSign = [
    "AWS4-HMAC-SHA256",
    q.get("X-Amz-Date"),
    scope,
    createHash("sha256").update(canonical).digest("hex"),
  ].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${FAKE_S3.secretAccessKey}`, date!), region!), "s3"), "aws4_request");
  const want = createHmac("sha256", key).update(toSign).digest("hex");
  return want === q.get("X-Amz-Signature") ? null : "署名が合わない";
}

export async function startFakeS3(): Promise<FakeS3> {
  const objects = new Map<string, { body: Buffer; public?: boolean }>();
  let now = () => Date.now();
  const denied: string[] = [];
  const server: Server = createServer((req, res) => {
    const raw = req.url ?? "/";
    const qi = raw.indexOf("?");
    const rawPath = qi < 0 ? raw : raw.slice(0, qi);
    const q = new URLSearchParams(qi < 0 ? "" : raw.slice(qi + 1));
    const key = rawPath.slice(1).split("/").map(decodeURIComponent).join("/");
    const o = objects.get(key);
    if (req.method !== "GET") return void res.writeHead(405).end();
    if (!(o?.public && !q.has("X-Amz-Signature"))) {
      const why = verify("GET", req.headers.host ?? "", rawPath, q, now());
      if (why) {
        denied.push(why);
        return void res
          .writeHead(403, { "content-type": "application/xml" })
          .end(`<Error><Code>AccessDenied</Code><Message>${why}</Message></Error>`);
      }
    }
    if (!o) return void res.writeHead(404).end();
    res.writeHead(200, { "content-type": "application/octet-stream", "content-length": o.body.length }).end(o.body);
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", () => ok()));
  return {
    endpoint: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    objects,
    now: () => now(),
    setNow: (f) => (now = f),
    denied,
    close: () => new Promise<void>((ok) => server.close(() => ok())),
  };
}
