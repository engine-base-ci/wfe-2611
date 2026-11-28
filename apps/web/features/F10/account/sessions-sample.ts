// 「入っている端末」「最近の安全の記録」の見本（K-842 の口 listMySessions の答えの形・K-836）。
//   下絵 /dev/mock/f1 の sec-*（K-318）と、その下絵と比べる画面の試験（k318-security.spec.ts）が同じ見本を使う（PM の決め 2026-11-28：本物の一覧の形が正）。
//   今の端末は「いま」・記録は過去の日付なので、見本の字は今日の日付で変わらない
import type { SessionsAnswer } from "./sessions-shape";

export const SESSIONS_SAMPLE: SessionsAnswer = {
  sessions: [
    {
      id: "0193c5a0-0000-7000-8000-0000000a8420",
      kind: "web",
      name: "Chrome（Mac）",
      place: "東京",
      issued_at: "2026-11-01T00:00:00Z",
      last_seen_at: "2026-11-01T00:00:00Z",
      current: true,
    },
  ],
  events: [
    {
      id: "0193c5a0-0000-7000-8000-0000000a8421",
      kind: "passkey_added",
      occurred_at: "2026-11-01T00:30:00Z",
      device: null,
      place: null,
    },
  ],
};
