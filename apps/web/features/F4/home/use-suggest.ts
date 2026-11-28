"use client";
// おすすめを押したあとの移り先（K-453・D-150.18）。作る面を `/tickets?new=1&title=<字>` で開き直す。
//   router.push は使わない：一覧と作る面は同じ道（/tickets）で、TicketsPage は初めの値でしか作る面を開かないので、
//   問い合わせだけが変わる push では作る面が開かず、題名の受け取り（K-442 の CreateSeed）も効かない。
//   読み直せば ?new=1 で作る面が開き、URL の title が題名に入る（書きかけの題名が在れば書きかけを守るのは K-442 の受け取り）
import { useCallback } from "react";

export const SUGGEST_CREATE_PATH = "/tickets?new=1&title=";

export function useSuggestCreate(): (title: string) => void {
  return useCallback((title: string) => {
    window.location.assign(SUGGEST_CREATE_PATH + encodeURIComponent(title));
  }, []);
}
