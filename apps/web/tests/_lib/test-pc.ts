// 試験の PC（K-58）：本物の Bridge（apps/bridge/src）の決まりをそのまま使って、PC の受け口を試験の中に立てる。
//   使う本物：接続コードの引き取り（pairing.ts の claimCode・Kaname に名乗る印 BRIDGE_UA）・この PC の中だけの口（local.ts の startLocalServer・
//   出どころの許可と 1 分 5 回の守りもそのまま）・約束の版（loop.ts の BRIDGE_PROTOCOL）。組み立て（apps/bridge/dist・K-97）は要らない：
//   Playwright が apps/bridge/src の TS をそのまま読む（apps/bridge は CommonJS なので createRequire で読む。agent-bridge.ts と同じ読み方）。
//   生きている知らせは、Bridge の輪（loop.ts の startLoop）の知らせと同じ形（頭 x-bridge-session・user-agent・本文 { health, protocol }）を 1 回ずつ送る。
//   輪そのものは使わない：輪は 60 秒ごとに知らせ、仕事の口（F5・K-61 で移す）も叩くので、75 秒の境目を DB の時刻で作れず、F5 の口の変更でこの試験が揺れる。
//   探したもの：apps/web/tests/_lib の fake-bridge.ts・local-bridge.ts（この PC の口を演じるが、引き取りは試験が渡す関数＝本物の Bridge の道を通らない）・
//   agent-bridge.ts（輪を回すが、組み立てた dist が要る・K-97）・api.ts の claimBridge（口を直に叩くだけで、Bridge の名乗りも口も通らない）。どれも Bridge の道そのものではない。
//   PC ごとに別の IP（x-forwarded-for）にする：引き取りの回数の制限が IP ごと 1 分 5 回（D-089）。制限そのものは K-57 の単体の試験が持つ
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import type { Server } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { API, admin, sha256 } from "./api";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
/** 画面の出どころ（この PC の口が許す相手）。CI の web の組は 127.0.0.1:3124 */
const WEB_ORIGIN = new URL(process.env["BASE_URL"] ?? "http://127.0.0.1:3124").origin;

type ClaimReply = { ok: true; token: string } | { ok: false; message: string };
interface Pairing {
  BRIDGE_UA: string;
  claimCode: (
    apiBase: string,
    code: string,
    pc: { label: string; machineId: string },
    fetchImpl?: typeof fetch,
  ) => Promise<ClaimReply>;
}
interface Local {
  LOCAL_PORT: number;
  startLocalServer: (d: {
    version: string;
    deviceLabel: () => string;
    connected: () => boolean;
    claim: (
      code: string,
      allowSwitch?: boolean,
    ) => Promise<{ ok: true } | { ok: false; message: string; reason?: "other_account" }>;
    check: () => Promise<{ name: string; ok: boolean; detail: string }[]>;
    installClaude: () => Promise<{ ok: boolean; message: string }>;
    loginStart: () => Promise<{ ok: boolean; url?: string; message: string }>;
    loginCode: (code: string) => Promise<{ ok: boolean; message: string }>;
    loginCancel: () => void;
  }) => Server;
}

/** 本物の Bridge の部品を読む（この PC の口が許す出どころは、読む前に決める・local.ts が読み込むときに 1 回だけ読む） */
function bridge(): { pairing: Pairing; local: Local; protocol: number; version: string } {
  process.env["KANAME_WEB_ORIGINS"] = WEB_ORIGIN;
  const from = createRequire(join(ROOT, "apps/bridge/src/main.ts"));
  return {
    pairing: from("./pairing.ts") as Pairing,
    local: from("./local.ts") as Local,
    protocol: (from("./loop.ts") as { BRIDGE_PROTOCOL: number }).BRIDGE_PROTOCOL,
    version: (from("../package.json") as { version: string }).version,
  };
}

export interface TestPc {
  label: string;
  /** この PC の印（machine_id・D-128.174）。本物の Bridge は初めに 1 回作って置き場に残す（loadMachineId）。試験の PC は PC ごとに 1 つ */
  machineId: string;
  /** Kaname が返した PC の印（"kpc_…"）。つながる前は空 */
  token: () => string | null;
  /** Bridge の窓にコードを入れる（main.ts の claim と同じく pairing.ts の claimCode で引き取る） */
  enterCode: (code: string) => Promise<ClaimReply>;
  /** 生きている知らせを 1 回送る（輪の知らせと同じ形）。返すのは口の答えの番号 */
  beat: () => Promise<number>;
  /** この PC の中だけの口（127.0.0.1:38617）を開く＝Bridge が入って動いている PC。画面はボタン 1 つでつなぐ（D-089 の ②） */
  openLocal: () => Promise<void>;
  /** PC を閉じる（この PC の口を閉じ、知らせも止める） */
  close: () => Promise<void>;
  /** この PC の行（sessions の id）。DB には印のハッシュだけがある */
  deviceId: () => Promise<string>;
}

let seq = 0;
export function testPc(label: string): TestPc {
  const b = bridge();
  const ip = `10.58.${(++seq % 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
  const machineId = randomUUID();
  let token: string | null = null;
  let server: Server | null = null;
  const fromThisPc: typeof fetch = (url, init) =>
    fetch(url, { ...init, headers: { ...(init?.headers as Record<string, string>), "x-forwarded-for": ip } });
  const enterCode = async (code: string): Promise<ClaimReply> => {
    const r = await b.pairing.claimCode(API, code, { label, machineId }, fromThisPc);
    if (r.ok) token = r.token;
    return r;
  };
  const notHere = async () => ({ ok: false, message: "試験の PC ではしない" });
  return {
    label,
    machineId,
    token: () => token,
    enterCode,
    beat: async () => {
      if (!token) throw new Error("まだつながっていない PC は知らせない");
      const r = await fromThisPc(`${API}/api/v1/bridge/heartbeat`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-bridge-session": token, "user-agent": b.pairing.BRIDGE_UA },
        body: JSON.stringify({ health: [], protocol: b.protocol }),
      });
      return r.status;
    },
    openLocal: async () => {
      if (server) return;
      const s = b.local.startLocalServer({
        version: b.version,
        deviceLabel: () => label,
        connected: () => token !== null,
        claim: async (code) => {
          const r = await enterCode(code);
          return r.ok ? { ok: true } : { ok: false, message: r.message };
        },
        check: async () => [],
        installClaude: notHere,
        loginStart: notHere,
        loginCode: notHere,
        loginCancel: () => undefined,
      });
      // 口が開くのを待つ（開けなければ止める：この PC で本物の Bridge が動いていると、画面がそちらにつながってしまう）
      await new Promise<void>((ok, ng) => {
        if (s.listening) return ok();
        s.once("listening", () => ok());
        s.once("error", (e) => ng(new Error(`この PC の口（${b.local.LOCAL_PORT}）を開けません：${e.message}`)));
      });
      server = s;
    },
    close: async () => {
      const s = server;
      server = null;
      if (s) await new Promise<void>((ok) => s.close(() => ok()));
    },
    deviceId: async () => {
      if (!token) throw new Error("まだつながっていない");
      const r = await admin<{ id: string }>("select id from sessions where device_token_hash = $1", [sha256(token)]);
      if (!r[0]) throw new Error("PC の行が無い");
      return r[0].id;
    },
  };
}
