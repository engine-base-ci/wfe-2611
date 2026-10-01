"use client";
// AI が使うブラウザを、いまの端末について選ぶ（D-120.1）。Kaname が正本で、次の仕事から効く（Bridge の窓でも同じ値を変えられる）。
// PC の設定の部品（会話の部品ではない）。見た目はモック（06_mockup/_browser.py）の class（chat.css の .kc .bpick）
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import "@/components/ai/chat.css";
import { agentSetBrowser, AuthExtError, type AgentBrowser } from "@/lib/auth/ext";

const OPTIONS: { value: AgentBrowser; label: string; desc: string }[] = [
  { value: "chrome", label: "自分の Chrome（Claude in Chrome）", desc: "いつもの Chrome とそのログインの状態をそのまま使います。拡張機能「Claude in Chrome」が要ります" },
  { value: "dedicated", label: "Bridge 専用のブラウザ", desc: "いつもの Chrome とは別のログインの状態で動きます。Chrome を閉じていても使えます" },
  { value: "off", label: "使わない", desc: "AI はブラウザを開きません" },
];

export function BrowserPick({ value, disabled }: { value: AgentBrowser; disabled?: boolean }) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const choose = async (b: AgentBrowser) => {
    if (b === value || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await agentSetBrowser(b);
      await qc.invalidateQueries({ queryKey: ["bridge-state"] });
      setMsg("変えました。次の仕事から使います");
    } catch (e) {
      setMsg(e instanceof AuthExtError ? e.message : "変えられませんでした");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="kc">
      <div className="bpick" role="radiogroup" aria-label="AI が使うブラウザ" data-browser-pick>
        {OPTIONS.map((o) => (
          <label key={o.value}>
            <input
              type="radio"
              name="agent-browser"
              value={o.value}
              checked={value === o.value}
              disabled={disabled || busy}
              onChange={() => void choose(o.value)}
            />
            <span>
              <b>{o.label}</b>
              <span className="muted">{o.desc}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="muted" role="status" data-browser-pick-msg>
        {msg}
      </p>
    </div>
  );
}

