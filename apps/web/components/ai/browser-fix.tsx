"use client";
// AI が使うブラウザ（D-119・D-120）。PC の画面（/setup/bridge）と会話の 1 行で同じ部品を使う（L-008：1 部品）。
//   選ぶ欄（BrowserPick）は PC の設定の部品なので components/bridge/browser-pick.tsx にある
//   BrowserFix  … Chrome とつながっていないときの一手：つなぎ方（公式の入口）・もう一度確かめる・専用のブラウザに切り替える
// 見た目はモック（06_mockup/_browser.py）の class（chat.css の .kc .bfix）。
import { useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Globe, Repeat } from "lucide-react";
import "./chat.css";
import { Button } from "@/components/ui";
import { agentBrowserCheck, agentSetBrowser, AuthExtError, bridgeState } from "@/lib/auth/ext";

/** 公式の入口（2026-09-30 に code.claude.com/docs/en/chrome で確かめた） */
export const CHROME_EXTENSION_URL = "https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn";
/** 自己診断の Chrome の行の名前（apps/bridge/src/browser.ts の browserCheck と同じ） */
export const CHROME_CHECK = "AI が Chrome を使える（Claude in Chrome）";
/** Bridge が会話に残す「ブラウザを使えなかった」の 1 行か（apps/bridge/src/loop.ts の BROWSER_OFF_NOTICE の書き出し） */
export const isBrowserOffNotice = (text: string): boolean =>
  text.startsWith("AI が Chrome を使えませんでした") || text.startsWith("AI が Bridge 専用のブラウザを開けませんでした");

/** 確かめる仕事の結果を待つ上限（Claude Code の起動と Chrome への接続で 10〜40 秒） */
const CHECK_WAIT_MS = 90_000;
const CHECK_POLL_MS = 2_000;

// 押した結果は部品の外に持つ。新しい会話で最初に送ると会話の部品が作り直されるので、中に持つと押した結果が消える（2026-09-30 実例）。
// 確かめる仕事の待ちも部品の外で続ける（画面を離れても、戻ったら結果が出ている）
let fixState: { checking: boolean; msg: string | null } = { checking: false, msg: null };
const fixSubs = new Set<() => void>();
const setFix = (p: Partial<typeof fixState>): void => {
  fixState = { ...fixState, ...p };
  for (const f of fixSubs) f();
};
const subscribeFix = (f: () => void) => {
  fixSubs.add(f);
  return () => void fixSubs.delete(f);
};
const useFix = () => useSyncExternalStore(subscribeFix, () => fixState, () => fixState);

export function BrowserFix({ open = false }: { open?: boolean }) {
  const qc = useQueryClient();
  const { checking, msg } = useFix();
  const setMsg = (m: string | null) => setFix({ msg: m });
  // もう一度確かめる：Bridge に小さな仕事を渡し、自己診断が新しくなるのを待って結果を言う
  const check = async () => {
    if (fixState.checking) return;
    setFix({ checking: true, msg: "確かめています（1 分ほどかかります）…" });
    try {
      const before = (await bridgeState()).health_at ?? null;
      await agentBrowserCheck();
      const until = Date.now() + CHECK_WAIT_MS;
      while (Date.now() < until) {
        await new Promise((r) => setTimeout(r, CHECK_POLL_MS));
        const st = await bridgeState();
        if ((st.health_at ?? null) === before) continue;
        const row = st.health?.find((h) => h.name === CHROME_CHECK);
        if (!row || /まだ使っていません/.test(row.detail ?? "")) continue;
        qc.setQueryData(["bridge-state"], st);
        setMsg(row.ok ? "つながりました。AI は Chrome を使えます" : "まだつながっていません。上の手順を見直してから、もう一度押してください");
        return;
      }
      setMsg("結果が返ってきませんでした。PC の Bridge が動いているか確かめてください");
    } catch (e) {
      setMsg(e instanceof AuthExtError ? e.message : "確かめられませんでした");
    } finally {
      setFix({ checking: false });
    }
  };
  const toDedicated = async () => {
    setMsg(null);
    try {
      await agentSetBrowser("dedicated");
      await qc.invalidateQueries({ queryKey: ["bridge-state"] });
      setMsg("Bridge 専用のブラウザに切り替えました。次の仕事から使います");
    } catch (e) {
      setMsg(e instanceof AuthExtError ? e.message : "切り替えられませんでした");
    }
  };
  return (
    <div className="bfix" data-browser-fix>
      <details open={open}>
        <summary>つなぎ方を見る</summary>
        <ol>
          <li>Chrome を開く（閉じていると AI は使えません）</li>
          <li>
            拡張機能「Claude in Chrome」を入れて有効にする：
            <a href={CHROME_EXTENSION_URL} target="_blank" rel="noreferrer" data-browser-install>
              Chrome ウェブストアで開く
            </a>
            。初めて入れたときは Chrome を一度開き直す
          </li>
          <li>拡張機能に、この PC の Claude Code と同じアカウントでログインする</li>
        </ol>
      </details>
      <div className="bact">
        <Button variant="outline" size="sm" icon={<Repeat />} onClick={() => void check()} disabled={checking} data-browser-check>
          {checking ? "確かめています…" : "もう一度確かめる"}
        </Button>
        <Button variant="ghost" size="sm" icon={<Globe />} onClick={() => void toDedicated()} data-browser-dedicated>
          Bridge 専用のブラウザに切り替える
        </Button>
      </div>
      <p className="muted" role="status" data-browser-fix-msg>
        {msg}
      </p>
    </div>
  );
}
