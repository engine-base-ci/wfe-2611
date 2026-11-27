// 分身の部屋「話す」の流れ（K-762）：streamConversation（K-759）を fetch で読む。合図は ready・change・down・end（reconnect／unauthenticated）。
//   1 ページに 1 本。トークンは見出しに付ける（URL に載せない）。会話の字は流れない（合図だけ）。
//   開いた直後の最初の ready では読み直さない（会話の読みは流れを開いた直後に始まる。同じ口を 1 画面で 2 回呼ばない）。
//   2 回目からの ready と change で onRefresh。同じ瞬間に来た change は 1 回にまとめる。
//   503（E-TALK-020）・down・切れた・読めない → onDown（画面は見に行く形に戻る）。end:reconnect はすぐつなぎ直す。end:unauthenticated → onSignedOut
import { ENDPOINTS } from "@kaname/contracts";
import { pathOf } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { openConversationStream } from "@/lib/conversation-stream";

export interface TalkStreamHandlers {
  /** 会話を読み直す（取りこぼしを拾う・変わった） */
  onRefresh: () => void;
  /** 流れが使えない（見に行く形へ） */
  onDown: () => void;
  /** 流れがつながった（見に行く形をやめる） */
  onLive: () => void;
  onSignedOut: () => void;
}

const STREAM = ENDPOINTS.find((e) => e.operationId === "streamConversation");

function streamPath(id: string): string {
  if (!STREAM) throw new Error("契約に無い口: streamConversation");
  return pathOf(STREAM.path, { id });
}

type Signal = "ready" | "change" | "down" | "end:reconnect" | "end:unauthenticated" | "other";

/** 合図の 1 かたまり（空行で区切られた event:／data: の行）を読む */
function signalOf(block: string): Signal {
  let event = "";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (event === "ready" || event === "change" || event === "down") return event;
  if (event !== "end") return "other";
  try {
    const reason = (JSON.parse(data || "{}") as { reason?: unknown }).reason;
    if (reason === "unauthenticated") return "end:unauthenticated";
  } catch {
    // 形の違う data は reconnect と同じに扱う（つなぎ直して ready で読み直す）
  }
  return "end:reconnect";
}

/** 会話 id の流れを開く。返り値は閉じる関数 */
export function openTalkStream(id: string, h: TalkStreamHandlers): () => void {
  let closed = false;
  let ctrl: AbortController | null = null;
  let readies = 0;
  let queued = false;
  const refresh = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!closed) h.onRefresh();
    });
  };

  const run = async (): Promise<void> => {
    ctrl = new AbortController();
    const headers: Record<string, string> = { accept: "text/event-stream" };
    const token = getToken();
    if (token) headers["authorization"] = `Bearer ${token}`;
    const res = await openConversationStream(streamPath(id), headers, ctrl.signal);
    if (res.status === 401) return h.onSignedOut();
    if (!res.ok || !res.body) return h.onDown();
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done || closed) break;
      buf += value.replace(/\r\n/g, "\n");
      let cut = buf.indexOf("\n\n");
      while (cut >= 0) {
        const s = signalOf(buf.slice(0, cut));
        buf = buf.slice(cut + 2);
        cut = buf.indexOf("\n\n");
        if (s === "ready") {
          h.onLive();
          if (readies++ > 0) refresh();
        } else if (s === "change") refresh();
        else if (s === "down") {
          void reader.cancel();
          return h.onDown();
        } else if (s === "end:unauthenticated") {
          void reader.cancel();
          return h.onSignedOut();
        } else if (s === "end:reconnect") {
          void reader.cancel();
          if (!closed) return run();
          return;
        }
      }
    }
    if (!closed) h.onDown(); // 合図なしで切れた
  };

  void run().catch(() => {
    if (!closed) h.onDown();
  });
  return () => {
    closed = true;
    ctrl?.abort();
  };
}
