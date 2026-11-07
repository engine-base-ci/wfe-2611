// つないでいる PC を見続ける（K-57）。listMyDevices を 5 秒ごとに読み、画面に渡す。止めると読み続けない
import { call, type CallErr } from "@/lib/api/call";

export interface Device {
  id: string;
  device_label: string | null;
  /** waiting＝記録はあるがまだ知らせが無い／live＝生きている／asleep＝最後の知らせから 75 秒より前 */
  state: "waiting" | "live" | "asleep";
  last_seen_at: string | null;
  version: string | null;
}
export const POLL_MS = 5_000;

export function pollDevices(onData: (d: Device[]) => void, onError: (r: CallErr) => void, every = POLL_MS): () => void {
  let alive = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const look = async () => {
    const r = await call("listMyDevices", { screenId: "bridge-setup" });
    if (!alive) return;
    if (r.ok) onData(r.data as unknown as Device[]);
    else if (r.kind === "unauthenticated" || r.kind === "forbidden") {
      onError(r);
      return; // 入り直す・権限が無いときは読み続けない
    }
    timer = setTimeout(() => void look(), every);
  };
  void look();
  return () => {
    alive = false;
    if (timer) clearTimeout(timer);
  };
}
