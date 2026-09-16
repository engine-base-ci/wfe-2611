// 自分のAI ⇄ 画面の配線は AG-UI 規格（D-057.1）。Bridge の出力を AG-UI のイベント列に変える層はここ（T-I-01 が Bridge 側とつなぐ）。
// 段階 1 の経路は Bridge だけ（D-055）。Bridge が無い・止まっている時点では adapter が「話せない理由」を返す（黙って空を返さない：G-15）
import { HttpAgent } from "@ag-ui/client";

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}
export interface ChatContext {
  screenId: string | null;
  selectedId?: string | null;
}
export interface ChatAdapter {
  /** 1 往復。文脈（いま見ている画面・選んでいる 1 件）を添える */
  send: (input: { text: string; history: ChatTurn[]; context: ChatContext }, signal?: AbortSignal) => Promise<string>;
}

/** AG-UI の HTTP agent（Bridge の口）。text の delta を集めて 1 つの返事にする */
export function agUiAdapter(url: string, headers: () => Record<string, string> = () => ({})): ChatAdapter {
  return {
    send: async ({ text, history, context }, signal) => {
      const agent = new HttpAgent({
        url,
        headers: headers(),
        initialMessages: [
          ...history.map((h, i) => ({ id: `h${i}`, role: h.role, content: h.text })),
          { id: crypto.randomUUID(), role: "user" as const, content: text },
        ],
        initialState: context,
      });
      let out = "";
      await new Promise<void>((resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("aborted")));
        agent
          .runAgent(
            { runId: crypto.randomUUID() },
            {
              onTextMessageContentEvent: ({ event }) => {
                out += event.delta;
              },
              onRunFinishedEvent: () => resolve(),
              onRunErrorEvent: ({ event }) => reject(new Error(event.message)),
            },
          )
          .catch(reject);
      });
      return out;
    },
  };
}
/** 話せない時点（PC が無い・止まっている）の adapter */
export const unavailableAdapter = (reason: string): ChatAdapter => ({ send: async () => reason });
