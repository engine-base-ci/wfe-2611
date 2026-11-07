// Bridge の手元の口（道具の中継・K-62・決める人の答え 3・2026-11-07）。
//   道具のサーバー（kaname-tools.ts の MCP_SERVER_SOURCE・Claude Code の子で動く）は道具の鍵だけを持ち、この口（127.0.0.1）へ送る。
//   Bridge は、鍵が今の仕事の鍵と同じで、道具が今の仕事の種類の道具のときだけ、PC の印を足して契約の口へ回す。
//   AI に長く効く PC の印を渡さない。鍵なし 401・それ以外（鍵違い・仕事が無い・今の仕事に無い道具）は 403 で回さない
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { timingSafeEqual } from "node:crypto";
import { BRIDGE_UA } from "./pairing";

export interface RelayJob {
  jobId: string;
  toolToken: string;
  /** 今の仕事で使える道具の名前（チケットは ticket_read だけ・会話は会話の道具） */
  tools: string[];
}
export interface RelayDeps {
  apiBase: string;
  deviceToken: () => string | null;
  current: () => RelayJob | null;
}
export interface ToolRelay {
  url: string;
  address: () => AddressInfo;
  close: () => Promise<void>;
}

/** 受ける体の上限（成果物のファイル 20 MB ＋少し） */
const BODY_MAX = 21 * 1024 * 1024;
const TOOL_PATH = /^\/tools\/([a-z_]{1,40})$/;
/** 成果物を渡す道（道具のサーバーの artifact_put が送る）。中身は道具の鍵だけで受ける前の道すじへ回す */
const ARTIFACT_PATH = "/api/auth-ext/bridge/artifact";
const UPSTREAM_TIMEOUT_MS = 60_000;

const same = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const reply = (res: ServerResponse, status: number, body: unknown): void => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
const readBody = (req: IncomingMessage): Promise<Buffer | null> =>
  new Promise((resolve) => {
    const parts: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > BODY_MAX) {
        resolve(null);
        req.destroy();
        return;
      }
      parts.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(parts)));
    req.on("error", () => resolve(null));
  });

export async function startToolRelay(d: RelayDeps): Promise<ToolRelay> {
  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const path = (req.url ?? "").split("?")[0] ?? "";
    const tool = TOOL_PATH.exec(path);
    if (req.method !== "POST" || (!tool && path !== ARTIFACT_PATH))
      return reply(res, 404, { error: "not_found", code: "NOT_FOUND" });
    const key = String(req.headers["x-kaname-tool-token"] ?? "");
    if (!key)
      return reply(res, 401, { error: "unauthenticated", code: "UNAUTHENTICATED", message: "道具の鍵がありません" });
    const cur = d.current();
    const name = tool ? tool[1]! : "artifact_put";
    const pc = d.deviceToken();
    if (!cur || !pc || !same(key, cur.toolToken) || !cur.tools.includes(name))
      return reply(res, 403, { error: "forbidden", code: "FORBIDDEN", message: "この仕事ではその道具を使えません" });
    const body = await readBody(req);
    if (!body) return reply(res, 413, { error: "too_large", code: "VALIDATION_ERROR" });
    let upstream: string;
    let headers: Record<string, string>;
    let send: Blob | string;
    if (tool) {
      let input: unknown;
      try {
        const j = JSON.parse(body.toString("utf8") || "{}") as { input?: unknown };
        input = j.input && typeof j.input === "object" ? j.input : {};
      } catch {
        return reply(res, 422, { error: "validation_failed", code: "VALIDATION_ERROR" });
      }
      upstream = `${d.apiBase}/api/v1/bridge/jobs/${encodeURIComponent(cur.jobId)}/tools/${name}`;
      headers = { "content-type": "application/json", "x-bridge-session": pc, "x-kaname-tool-token": key };
      send = JSON.stringify({ input });
    } else {
      upstream = `${d.apiBase}${ARTIFACT_PATH}`;
      headers = { "content-type": "application/octet-stream", "x-kaname-tool-token": key };
      for (const h of ["x-artifact-name", "x-artifact-title"]) {
        const v = req.headers[h];
        if (typeof v === "string") headers[h] = v;
      }
      send = new Blob([new Uint8Array(body)]);
    }
    try {
      const r = await fetch(upstream, {
        method: "POST",
        headers: { ...headers, "user-agent": BRIDGE_UA },
        body: send,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      const text = await r.text();
      res.writeHead(r.status, { "content-type": r.headers.get("content-type") ?? "application/json" });
      res.end(text);
    } catch {
      reply(res, 502, { error: "external_failed", code: "EXTERNAL_FAILED", message: "Kaname に届きませんでした" });
    }
  };
  const server = createServer((req, res) => {
    handle(req, res).catch(() => reply(res, 500, { error: "internal", code: "INTERNAL" }));
  });
  // 手元の口は 127.0.0.1 だけ（ほかの PC・同じ網の機械から呼べない）
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = () => server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address().port}`,
    address,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
