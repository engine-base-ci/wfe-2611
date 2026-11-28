// K-1015「運営のお知らせを書く・書き直す・出す画面」の単体の試験（画面の外の、決まった形だけ）：
//   書く欄の値 → 口の体（features/F12/ops2/notice-form.ts の noticeBody・editBody）と、1 件 → 欄の値（formOf・lockedOf）、出す確かめの字（publishBullets）。
//   時刻は日本時間（欄は YYYY-MM-DDTHH:mm・口は +09:00 の形）。字は下絵（views-notices.tsx の NoticeNewPage・NoticePublishConfirm）が正。
//   行 ID は 11_tickets/K-1015.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import {
  editBody,
  emptyForm,
  formOf,
  fromLocal,
  lockedOf,
  noticeBody,
  publishBullets,
  toLocal,
} from "../features/F12/ops2/notice-form";
import { maintOf } from "../tests/k/ops-notices-mock";

describe("K-1015 欄 → 体", () => {
  it("K1015-UN-001 作るの体：空白を落とす・題か本文が空なら null・全部は並びを付けない・プランは audience_plans・ワークスペースは audience_workspace_ids・メンテでない種類は時間と影響を付けない・すぐなら publish_at を付けない", () => {
    const f = { ...emptyForm(), title: "  題 ", body: " 本文 " };
    expect(noticeBody(f)).toEqual({
      kind: "release",
      title: "題",
      body: "本文",
      audience_mode: "all",
      placements: ["list"],
    });
    expect(noticeBody({ ...f, title: "  " })).toBeNull();
    expect(noticeBody({ ...f, audience: "plans", plans: ["team"] })).toMatchObject({
      audience_mode: "plans",
      audience_plans: ["team"],
    });
    expect(noticeBody({ ...f, audience: "workspaces", workspaces: ["w1", "w2"] })).toMatchObject({
      audience_mode: "workspaces",
      audience_workspace_ids: ["w1", "w2"],
    });
    expect(noticeBody({ ...f, audience: "plans", plans: [] })).toBeNull();
    const rel = noticeBody({ ...f, from: "2026-11-10T02:00", to: "2026-11-10T03:00", impact: "画面" })!;
    expect(["maintenance_from", "maintenance_to", "impact"].some((k) => k in rel)).toBe(false);
    const m = noticeBody({
      ...f,
      kind: "maintenance",
      from: "2026-11-10T02:00",
      to: "2026-11-10T03:00",
      impact: " 画面 ",
      band: true,
      when: "date",
      at: "2026-11-03T10:00",
    })!;
    expect(m).toMatchObject({
      placements: ["band", "list"],
      maintenance_from: "2026-11-10T02:00:00+09:00",
      maintenance_to: "2026-11-10T03:00:00+09:00",
      impact: "画面",
      publish_at: "2026-11-03T10:00:00+09:00",
    });
    expect(noticeBody({ ...f, list: false, band: false })).toBeNull();
  });

  it("K1015-UN-002 直すの体：1 件の値と比べて変えた欄だけ。出した後は 種類・誰に・出す場所・出す日時 を体に入れない（変えても）", () => {
    const d = maintOf();
    const f = formOf(d);
    expect(editBody(d, { ...f, title: "新しい題" })).toEqual({ title: "新しい題" });
    expect(editBody(d, f)).toEqual({});
    const pub = maintOf({ state: "published", published_at: "2026-11-03T01:00:00Z" });
    expect(editBody(pub, { ...formOf(pub), kind: "release", band: false, body: "延びました" })).toEqual({
      body: "延びました",
    });
  });
});

describe("K-1015 1 件 → 欄・確かめ", () => {
  it("K1015-UN-003 1 件の値を欄に入れる：日本時間の YYYY-MM-DDTHH:mm・帯と一覧・誰に。出した後（published・resolved）・予定は 種類・誰に・出す場所・いつ を閉じる（下書きは閉じない）", () => {
    const f = formOf(maintOf());
    expect([f.kind, f.from, f.to, f.band, f.list, f.audience, f.when]).toEqual([
      "maintenance",
      "2026-11-10T02:00",
      "2026-11-10T03:00",
      true,
      true,
      "all",
      "date",
    ]);
    expect(lockedOf(maintOf())).toBe(false);
    expect(lockedOf(maintOf({ state: "published" }))).toBe(true);
    expect(lockedOf(maintOf({ state: "resolved" }))).toBe(true);
    expect(lockedOf(maintOf({ state: "scheduled" }))).toBe(false);
    expect([toLocal("2026-11-09T17:00:00Z"), fromLocal("2026-11-10T02:00")]).toEqual([
      "2026-11-10T02:00",
      "2026-11-10T02:00:00+09:00",
    ]);
  });

  it("K1015-UN-004 出す確かめの字：一覧に出すなら「<N> か所・延べ <M> 人の「困ったとき・お知らせ」に出る」・帯なら「画面の上の帯にも出る（閉じられる）」・メンテなら「メンテの間は、メンテナンス中の画面になる」と「メンテなので、<N> か所の管理者にメールも届く（使えなくなるため）」・リリースはメールの行なし", () => {
    expect(publishBullets(maintOf())).toEqual([
      "48 か所・延べ 312 人の「困ったとき・お知らせ」に出る",
      "画面の上の帯にも出る（閉じられる）",
      "メンテの間は、メンテナンス中の画面になる",
      "メンテなので、48 か所の管理者にメールも届く（使えなくなるため）",
    ]);
    expect(publishBullets(maintOf({ kind: "release", placements: ["list"], maintenance: null }))).toEqual([
      "48 か所・延べ 312 人の「困ったとき・お知らせ」に出る",
    ]);
  });
});
