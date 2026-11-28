"use client";
// 運営のパスキーを付ける画面の入れ物（K-1003・/ops/setup#token=…）：#の後の印を読み、アドレスの欄から消す（履歴を置き換える）。
//   開いただけでは口を呼ばない。名前を持ち、押したら useOpsSetup() に渡す（口の字はここに書かない・K941-MK-003）。
//   部品 OpsSetup は書き換えず、props で渡すだけ
import { useEffect, useRef, useState, type ReactNode } from "react";
import { OpsSetup } from "./ops-setup";
import { useOpsSetup } from "./use-ops-setup";

/** 印は 32 バイトの base64url（43 字・K-945） */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;
const NAME_MAX = 40;
const NAME_EMPTY = "名前を書いてください";
const LOGIN_HREF = "/ops/login";

/** #token=… を読み、印を消したアドレスに置き換える。形が違えば null */
function takeToken(): string | null {
  const url = new URL(window.location.href);
  const raw = new URLSearchParams(url.hash.replace(/^#/, "")).get("token");
  if (url.hash !== "") window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  return raw !== null && TOKEN_SHAPE.test(raw) ? raw : null;
}

export function OpsSetupScreen(): ReactNode {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const setup = useOpsSetup();

  // 印を読むのは 1 回だけ：開発の形（reactStrictMode）では効き目が 2 回走り、2 回目は #が消えていて「使えない」になる。
  //   ref は 2 回目でも残るので、読んだ印を置き場に入れずに 1 回目の値を使い続けられる
  const tokenRead = useRef(false);
  useEffect(() => {
    if (tokenRead.current) return;
    tokenRead.current = true;
    setToken(takeToken());
  }, []);

  const onSubmit = () => {
    if (setup.busy || !token) return;
    const trimmed = name.trim();
    if (trimmed === "") {
      setNameError(NAME_EMPTY);
      return;
    }
    setNameError(null);
    void setup.submit(token, trimmed);
  };

  const mode = token === null ? "invalid" : setup.mode;
  const alert = nameError ? null : setup.alert; // 名前の字は欄の誤りの 1 か所だけ（部品が role alert で出す）
  return (
    <OpsSetup
      mode={mode}
      name={name}
      onNameChange={(v) => setName(v.slice(0, NAME_MAX))}
      onSubmit={onSubmit}
      busy={setup.busy}
      loginHref={LOGIN_HREF}
      {...(nameError ? { nameError } : {})}
      {...(alert ? { alert } : {})}
    />
  );
}
