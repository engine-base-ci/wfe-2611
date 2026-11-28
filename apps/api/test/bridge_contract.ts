// 試験の道具：前の道すじ（/api/auth-ext/bridge/take・progress・finish・control・tool）で書いた試験を、契約の口に向け直す（K-62）。
//   K-62 で前の道すじ 5 本を消した。前の道すじを呼んでいた試験（会話・ログインの試し・残った仕事の片付け など）の期待の意味は変えず、
//   呼び先だけを契約の口（/api/v1/bridge/jobs/…）に替える。答えは前の形（data が仕事そのもの・blocked）に読み替えて返す。
//   ・成功の 201（契約の create の口）は前と同じ「通った」なので 200 に読み替える。それ以外の状態（401・403・404・409・422・429）はそのまま返す
//   ・PC の印は頭 x-bridge-session（"kpc_…"・K-57）。道具の口は契約では PC の印と道具の鍵の両方が要るので、
//     取ったときに覚えた「道具の鍵 → 仕事・PC の印」から足す（前の道すじは道具の鍵だけだった）
//   振る舞いの試験そのものは apps/api/test/features/F5/delegate*.test.ts（K-62）が持つ。
type Requester = { request: (url: string, init?: RequestInit) => Response | Promise<Response> };

const OLD = new Set(["/bridge/take", "/bridge/progress", "/bridge/finish", "/bridge/control", "/bridge/tool"]);

/** 前の道すじの 5 本か（ほかの道すじ /bridge/partial・steers・ask などは、まだ前の道すじのまま） */
export const isMovedBridgePath = (path: string): boolean => OLD.has(path.replace(/^\/api\/auth-ext/, ""));

export interface OldBridge {
  /** 前の道すじの path（/bridge/take など。/api/auth-ext 付きでもよい）・前の体・前の頭で呼び、前の形の答えを返す */
  call: (path: string, body: unknown, headers?: Record<string, string>) => Promise<Response>;
}

export function oldBridge(app: Requester): OldBridge {
  /** 道具の鍵 → 取った仕事と PC の印（契約の道具の口に足す） */
  const tools = new Map<string, { jobId: string; device: string }>();
  const send = async (method: string, path: string, headers: Record<string, string>, body?: unknown) =>
    app.request(`http://localhost/api/v1${path}`, {
      method,
      headers: { "content-type": "application/json", ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  /** 答えを前の形にする（data を差し替える・201 を 200 に） */
  const reply = async (r: Response, map?: (data: unknown, raw: Record<string, unknown>) => Record<string, unknown>) => {
    const text = await r.text();
    const raw = (text ? JSON.parse(text) : {}) as Record<string, unknown>;
    const ok = r.status >= 200 && r.status < 300;
    const out = ok && map ? map(raw["data"], raw) : raw;
    return new Response(JSON.stringify(out), {
      status: r.status === 201 ? 200 : r.status,
      headers: { "content-type": "application/json" },
    });
  };
  const call: OldBridge["call"] = async (path0, body0, headers = {}) => {
    const path = path0.replace(/^\/api\/auth-ext/, "");
    const body = { ...((body0 ?? {}) as Record<string, unknown>) };
    const device = headers["x-bridge-session"] ?? "";
    const dev = device ? { "x-bridge-session": device } : {};
    const jobId = typeof body["job_id"] === "string" ? (body["job_id"] as string) : "";
    delete body["job_id"];
    if (path === "/bridge/take") {
      const r = await send("POST", "/bridge/jobs/take", { ...headers }, body);
      return reply(r, (d) => {
        const v = (d ?? {}) as {
          job?: Record<string, unknown> | null;
          forbidden_domains?: unknown;
          next_ms?: number;
          outdated?: boolean;
        };
        const job = v.job ?? null;
        if (job && typeof job["tool_token"] === "string")
          tools.set(job["tool_token"] as string, { jobId: String(job["job_id"]), device });
        return {
          data: job ? { ...job, blocked: v.forbidden_domains ?? [] } : null,
          next_ms: v.next_ms ?? 0,
          ...(v.outdated ? { outdated: true } : {}),
        };
      });
    }
    if (path === "/bridge/progress")
      return reply(await send("POST", `/bridge/jobs/${jobId || "x"}/progress`, dev, body));
    if (path === "/bridge/finish") return reply(await send("POST", `/bridge/jobs/${jobId || "x"}/finish`, dev, body));
    if (path === "/bridge/control")
      return reply(await send("GET", `/bridge/jobs/${jobId || "x"}/control`, dev), (d) => ({
        // 前の形の steer（区切りの一言）は、契約の steers をそのまま移す（決め打ちしない）
        data: (({ steers, ...rest }) => ({ ...rest, steer: steers ?? [] }))(
          (d ?? {}) as Record<string, unknown> & { steers?: unknown },
        ),
      }));
    // 道具：前は道具の鍵だけ。契約は PC の印も要る（取ったときに覚えたものを足す）。名前は道すじに入る
    const token = headers["x-kaname-tool-token"] ?? "";
    const known = tools.get(token);
    const name = typeof body["name"] === "string" && body["name"] ? (body["name"] as string) : "_";
    return reply(
      await send(
        "POST",
        `/bridge/jobs/${known?.jobId ?? "00000000-0000-4000-8000-000000000000"}/tools/${encodeURIComponent(name)}`,
        { ...(known ? { "x-bridge-session": known.device } : dev), ...(token ? { "x-kaname-tool-token": token } : {}) },
        { input: body["input"] && typeof body["input"] === "object" ? body["input"] : {} },
      ),
      (d) => ({ data: ((d ?? {}) as { result?: unknown }).result ?? null }),
    );
  };
  return { call };
}
