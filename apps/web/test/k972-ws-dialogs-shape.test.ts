// K-972「運営の 1 社の小窓（中を見る・止める・再開・お知らせを送る）」の単体の試験（画面の外の、決まった形だけ）：
//   小窓の値 → 口の体（K-1006・K-1004 の入力の形）と、1 社の答え → 帯の字（features/F12/ops/ws-dialogs-shape.ts）。
//   字は下絵（features/F12/ops/tenant-dialogs.tsx・tenant-frame.tsx）が正。日は日本の暦。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-972.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import {
  canStopNow,
  noticeBody,
  peekBandView,
  peekBody,
  peekReasons,
  stopBandView,
  stopBody,
  stopDefault,
  stopLabel,
  STOP_REASONS,
} from "../features/F12/ops/ws-dialogs-shape";
import { WS_INQUIRIES, wsOf } from "../tests/k/ops-ws-answers";

const NOW = new Date("2026-11-02T01:22:00Z"); // 日本の 11/02 10:22

describe("K-972 中を見る", () => {
  it("K972-UN-001 理由の選び肢と体：済みでない問い合わせ（題と人と日）・障害の調べ・請求の確認・ほか。問い合わせなら reason は「問い合わせ「<題>」」と inquiry_id、ほかは書いた字。見る時間は 30・60 だけ", () => {
    const opts = peekReasons(WS_INQUIRIES);
    expect(opts.map((o) => o.label)).toEqual([
      "問い合わせ「承認したのに動かない」（湊 さくら・11/02）",
      "障害の調べ",
      "請求の確認",
      "ほか（書く）",
    ]);
    expect(peekBody({ choice: opts[0]!.value, minutes: 60, other: "" }, WS_INQUIRIES)).toEqual({
      reason: "問い合わせ「承認したのに動かない」",
      minutes: 60,
      inquiry_id: WS_INQUIRIES[0]!.id,
    });
    expect(peekBody({ choice: "incident", minutes: 30, other: "" }, WS_INQUIRIES)).toEqual({
      reason: "障害の調べ",
      minutes: 30,
    });
    expect(peekBody({ choice: "other", minutes: 30, other: "  ログの確認  " }, WS_INQUIRIES)).toEqual({
      reason: "ログの確認",
      minutes: 30,
    });
    expect(peekBody({ choice: "other", minutes: 30, other: "   " }, WS_INQUIRIES)).toBeNull();
    expect(peekBody({ choice: "incident", minutes: 120, other: "" }, WS_INQUIRIES)).toBeNull();
  });

  it("K972-UN-002 見ている間の帯：題「<会社> の中を見ています（見るだけ）」・残りの分は切り上げ・期限を過ぎたら帯を出さない（null）", () => {
    const b = peekBandView(wsOf({ peek: { id: "p", expires_at: "2026-11-02T02:00:00Z", reason: null } }), NOW);
    expect(b).toEqual({ id: "p", title: "合同会社ミナト企画 の中を見ています（見るだけ）", rest: "残り 38 分" });
    expect(peekBandView(wsOf({ peek: { id: "p", expires_at: "2026-11-02T01:21:30Z", reason: null } }), NOW)).toBeNull();
    expect(peekBandView(wsOf(), NOW)).toBeNull();
  });
});

describe("K-972 止める", () => {
  it("K972-UN-003 理由と体：理由は reason_key の 4 つ（請求が払われない・規約に反する・危ない使い方をしている・管理者から頼まれた）。すぐは violation・danger だけ。日を決めるは stop_on・すぐは stop_on なし。note・admin_notice は空白を落とし、空なら付けない", () => {
    expect(STOP_REASONS.map((r) => [r.value, r.label])).toEqual([
      ["unpaid", "請求が払われない"],
      ["violation", "規約に反する"],
      ["danger", "危ない使い方をしている"],
      ["request", "管理者から頼まれた"],
    ]);
    expect(["unpaid", "violation", "danger", "request"].map(canStopNow)).toEqual([false, true, true, false]);
    expect(
      stopBody({
        reason: "unpaid",
        mode: "scheduled",
        stopOn: "2026-11-09",
        notice: " 確かめられていません ",
        note: "",
      }),
    ).toEqual({
      reason_key: "unpaid",
      mode: "scheduled",
      stop_on: "2026-11-09",
      admin_notice: "確かめられていません",
    });
    expect(stopBody({ reason: "violation", mode: "now", stopOn: "2026-11-09", notice: "", note: "12 条" })).toEqual({
      reason_key: "violation",
      mode: "now",
      note: "12 条",
    });
    expect(stopBody({ reason: "unpaid", mode: "now", stopOn: "", notice: "", note: "" })).toBeNull();
  });

  it("K972-UN-004 既定とボタンの字：既定は日を決める・7 日後（日本の暦）。ボタンは「11/09 に止める」・すぐは「すぐ止める」", () => {
    expect(stopDefault(NOW)).toEqual({
      reason: "unpaid",
      mode: "scheduled",
      stopOn: "2026-11-09",
      notice: "",
      note: "",
    });
    expect(stopLabel({ mode: "scheduled", stopOn: "2026-11-09" })).toBe("11/09 に止める");
    expect(stopLabel({ mode: "now", stopOn: "2026-11-09" })).toBe("すぐ止める");
  });

  it("K972-UN-005 止めている帯：理由の字・止めた日（MM/DD）。止める予定だけ（stopped_at が空で止める日が先）は帯を出さない。お知らせを送るの体は placements（帯 ['band']・一覧 ['list']・どちらも ['band','list']）", () => {
    const st = stopBandView(
      wsOf({
        state: "stopped",
        stop: { reason_key: "unpaid", stop_on: "2026-11-09", stopped_at: "2026-11-08T15:00:00Z", noticed_at: null },
      }),
    );
    expect(st).toEqual({ reason: "請求が払われない", since: "11/09" });
    expect(
      stopBandView(wsOf({ stop: { reason_key: "unpaid", stop_on: "2026-11-09", stopped_at: null, noticed_at: null } })),
    ).toBeNull();
    expect(
      ["band", "list", "both"].map((where) => noticeBody({ title: " 題 ", body: "本文", where })?.placements),
    ).toEqual([["band"], ["list"], ["band", "list"]]);
    expect(noticeBody({ title: "  ", body: "本文", where: "band" })).toBeNull();
  });
  it("K972-UN-006 お知らせを送るの体（誰に）：みんな（既定）は admins_only を付けない・管理者だけ × 一覧は admins_only true と ['list']・管理者だけ × 帯・どちらもは null（送らない・D-156.57）", () => {
    expect(noticeBody({ title: "題", body: "本文", where: "list" })).toEqual({
      title: "題",
      body: "本文",
      placements: ["list"],
    });
    expect(noticeBody({ title: "題", body: "本文", where: "list", to: "admins" })).toEqual({
      title: "題",
      body: "本文",
      placements: ["list"],
      admins_only: true,
    });
    expect(noticeBody({ title: "題", body: "本文", where: "band", to: "admins" })).toBeNull();
    expect(noticeBody({ title: "題", body: "本文", where: "both", to: "admins" })).toBeNull();
  });
});
