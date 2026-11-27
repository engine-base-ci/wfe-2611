"use client";
// 段 6 の下絵（room の束）：分身の部屋（ようす・やったこと・話す）とチケットの右のパネル「高本のAI」。本番と同じ部品（features/F5/room/*）を決めた値で並べる。
//   1 つの id ＝ 1 つの状態。どの状態も 代表に聞くこと の勧め（★）の形（11＝数 3 つ・12＝タブ 3 つ＋ナレッジへ・14＝話すの芯だけ）。
//   スマホ（375）：話す は 会話の一覧（talk-convs）と会話（それ以外の talk-）が別の画面。会話の画面は頭を畳み「‹」で一覧へ戻る（mchat）。
//   ticket は その状態を本物にする画面の葉：room-＝K-755／done-＝K-756／talk-＝K-762／tk-talk-＝K-764／create-talk-＝K-767（案のカードは K-777）
import type { ReactNode } from "react";
import { Band, Button } from "@/components/k";
import { DoneEmpty, DoneFailed, DoneLoading, RoomDone } from "@/features/F5/room/done";
import {
  PcClosed,
  PcNone,
  RoomFailed,
  RoomFirst,
  RoomLoading,
  RoomOverview,
  TalkEntry,
} from "@/features/F5/room/overview";
import { CreateTalk, EMPTY_VALUES, type CreateValues } from "@/features/F5/room/create-talk";
import { TalkBody, TalkNotice } from "@/features/F5/room/talk";
import { AiPanel, RunningBandTalk } from "@/features/F5/room/ticket-talk";
import type { Theme } from "@/lib/theme";
import type { MockGroup } from "../types";
import {
  CONVS,
  CT_APPLIED_ALL,
  CT_APPLIED_SOME,
  CT_EDITED,
  CT_ERROR,
  CT_PROPOSAL,
  CT_SELECT,
  CT_THINKING,
  CT_WRITING,
  EDITED,
  FILLED,
  FILLED_SOME,
  FROM_CREATE,
  SELF_TYPED,
  STARTERS,
  DONE_DAYS,
  DONE_STOPPED,
  DONE_SUMMARY,
  GROWTH,
  NEXT,
  NEXT_STOPPED,
  NOW,
  PANEL_PROGRESS,
  PANEL_TALK,
  PANEL_WORKING,
  TALK_LIST,
  TALK_PERMISSION,
  TALK_STOPPED,
  TALK_WORKING,
  TALK_WRITING,
} from "./room-data";
import { CreatePage, ME, RoomPage, TicketFrame } from "./room-pages";

// prettier-ignore

const NO_WAIT = { approvals: 0, stopped: 0 } as const;
const NO_CONV = [] as const;
const noop = (): ReactNode => null;

function talk(
  entries: Parameters<typeof TalkBody>[0]["entries"],
  composer: Parameters<typeof TalkBody>[0]["composer"],
  rest?: Partial<Parameters<typeof TalkBody>[0]>,
): ReactNode {
  return <TalkBody name={`${ME}のAI`} convs={CONVS} current="c1" entries={entries} composer={composer} {...rest} />;
}

type CtRest = Partial<Parameters<typeof CreateTalk>[0]>;
function ct(
  theme: Theme,
  values: CreateValues,
  entries: Parameters<typeof CreateTalk>[0]["entries"],
  composer: Parameters<typeof CreateTalk>[0]["composer"],
  rest: CtRest = {},
  ps: "PS0" | "PS2" = "PS2",
): ReactNode {
  return (
    <CreatePage theme={theme} ps={ps}>
      <CreateTalk values={values} name={`${ME}のAI`} entries={entries} composer={composer} {...rest} />
    </CreatePage>
  );
}

function view(id: string, theme: Theme): ReactNode {
  switch (id) {
    case "create-talk-empty":
      return ct(theme, EMPTY_VALUES, [], {}, { starters: STARTERS });
    case "create-talk-thinking":
      return ct(theme, EMPTY_VALUES, CT_THINKING, { mode: "working" });
    case "create-talk-writing":
      return ct(theme, EMPTY_VALUES, CT_WRITING, { mode: "working" });
    case "create-talk-proposal":
      return ct(theme, EMPTY_VALUES, CT_PROPOSAL, { text: "" });
    case "create-talk-select":
      return ct(theme, EMPTY_VALUES, CT_SELECT, {});
    case "create-talk-applied-all":
      return ct(theme, FILLED, CT_APPLIED_ALL, {});
    case "create-talk-applied-some":
      return ct(theme, FILLED_SOME, CT_APPLIED_SOME, {});
    case "create-talk-edited":
      return ct(theme, EDITED, CT_EDITED, { text: "" });
    case "create-talk-error":
      return ct(
        theme,
        SELF_TYPED,
        CT_ERROR,
        { text: "セイコー様に 12 月分の作業報告書を年内に送りたい。形は 11 月と同じ" },
        {
          notice: (
            <TalkNotice tone="danger" title="答えを返せませんでした">
              もう一度送れます。左の欄に書いた物は消えていません
            </TalkNotice>
          ),
        },
      );
    case "create-talk-nopc":
      return ct(theme, SELF_TYPED, [], {}, { noPc: true, starters: STARTERS, notice: <PcNone /> }, "PS0");
    case "create-talk-mobile":
      return ct(theme, EMPTY_VALUES, CT_PROPOSAL, {}, { mview: "chat" });
    case "create-talk-mobile-form":
      return ct(theme, FILLED, CT_APPLIED_ALL, {}, { mview: "form", entry: true });
    case "tk-talk-from-create":
      return (
        <TicketFrame
          theme={theme}
          ps="PS2"
          no="EG-129"
          title={FILLED.title}
          body={FILLED.body}
          band={
            <Band
              tone="info"
              title="AI に任せられます"
              sub="作る時に話した内容と、確認項目 3 件を引き継ぎます"
              acts={<Button variant="primary">AI に任せる</Button>}
            />
          }
          panel={<AiPanel ticket="EG-129" entries={FROM_CREATE} composer={{}} />}
        />
      );
    case "talk-writing":
      return (
        <RoomPage theme={theme} ps="PS2" tab="talk" mchat>
          {talk(TALK_WRITING, { mode: "working" })}
        </RoomPage>
      );
    case "room-overview":
      return (
        <RoomPage theme={theme} ps="PS2" tab="now">
          <RoomOverview now={NOW} next={NEXT} waiting={{ approvals: 3, stopped: 1 }} growth={GROWTH} />
        </RoomPage>
      );
    case "room-idle":
      return (
        <RoomPage theme={theme} ps="PS2" tab="now">
          <RoomOverview now={null} next={[]} waiting={NO_WAIT} growth={GROWTH} />
        </RoomPage>
      );
    case "room-stopped":
      return (
        <RoomPage theme={theme} ps="PS2" tab="now">
          <RoomOverview now={null} next={NEXT_STOPPED} waiting={{ approvals: 0, stopped: 1 }} growth={GROWTH} />
        </RoomPage>
      );
    case "room-pc-none":
      return (
        <RoomPage theme={theme} ps="PS0" tab="now">
          <PcNone />
          <RoomFirst />
        </RoomPage>
      );
    case "room-pc-closed":
      return (
        <RoomPage theme={theme} ps="PS3" tab="now">
          <PcClosed />
          <RoomOverview now={null} next={NEXT} waiting={{ approvals: 3, stopped: 0 }} growth={GROWTH} asleep />
        </RoomPage>
      );
    case "room-loading":
      return (
        <RoomPage theme={theme} ps="PS2" tab="now">
          <RoomLoading />
        </RoomPage>
      );
    case "room-failed":
      return (
        <RoomPage theme={theme} ps="PS2" tab="now">
          <RoomFailed />
        </RoomPage>
      );
    case "room-mobile":
      return (
        <RoomPage theme={theme} ps="PS2" tab="now">
          <RoomOverview now={NOW} next={[]} waiting={{ approvals: 3, stopped: 0 }} growth={GROWTH} />
          <TalkEntry name={`${ME}のAI`} />
        </RoomPage>
      );
    case "done-list":
      return (
        <RoomPage theme={theme} ps="PS2" tab="done">
          <RoomDone days={DONE_DAYS} summary={DONE_SUMMARY} />
        </RoomPage>
      );
    case "done-filter-stopped":
      return (
        <RoomPage theme={theme} ps="PS2" tab="done">
          <RoomDone days={DONE_STOPPED} filter="stopped" summary={DONE_SUMMARY} more={null} />
        </RoomPage>
      );
    case "done-empty":
      return (
        <RoomPage theme={theme} ps="PS2" tab="done">
          <DoneEmpty />
        </RoomPage>
      );
    case "done-empty-filter":
      return (
        <RoomPage theme={theme} ps="PS2" tab="done">
          <DoneEmpty filter="stopped" />
        </RoomPage>
      );
    case "done-loading":
      return (
        <RoomPage theme={theme} ps="PS2" tab="done">
          <DoneLoading />
        </RoomPage>
      );
    case "done-failed":
      return (
        <RoomPage theme={theme} ps="PS2" tab="done">
          <DoneFailed />
        </RoomPage>
      );
    case "talk-convs":
      return (
        <RoomPage theme={theme} ps="PS2" tab="talk">
          {talk(TALK_LIST, {}, { mview: "list" })}
        </RoomPage>
      );
    case "talk-chat-mobile":
      return (
        <RoomPage theme={theme} ps="PS2" tab="talk" mchat>
          {talk(TALK_LIST, {})}
        </RoomPage>
      );
    case "talk-new":
      return (
        <RoomPage theme={theme} ps="PS2" tab="talk" mchat>
          {talk([], {}, { current: null })}
        </RoomPage>
      );
    case "talk-sending":
      return (
        <RoomPage theme={theme} ps="PS2" tab="talk" mchat>
          {talk(TALK_LIST, { text: "セイコー様の更新案の下書きを作って", mode: "sending" })}
        </RoomPage>
      );
    case "talk-working":
      return (
        <RoomPage theme={theme} ps="PS2" tab="talk" mchat>
          {talk(TALK_WORKING, { mode: "working" })}
        </RoomPage>
      );
    case "talk-stopped":
      return (
        <RoomPage theme={theme} ps="PS2" tab="talk" mchat>
          {talk(
            TALK_STOPPED,
            {},
            {
              notice: (
                <TalkNotice tone="info" title="止まりました">
                  止まった理由：あなたが止めました。続けるには、言葉を書いて送ってください
                </TalkNotice>
              ),
            },
          )}
        </RoomPage>
      );
    case "talk-stopped-pc":
      return (
        <RoomPage theme={theme} ps="PS3" tab="talk" mchat>
          {talk(
            TALK_WORKING.slice(0, -1),
            { mode: "no-pc", offPlaceholder: "PC を開くと話せます" },
            {
              notice: (
                <TalkNotice tone="danger" title="AI が止まりました">
                  止まった理由：PC が閉じました。高本の MacBook を開くと、続きから話せます。送った言葉は残っています
                </TalkNotice>
              ),
            },
          )}
        </RoomPage>
      );
    case "talk-permission":
      return (
        <RoomPage theme={theme} ps="PS2" tab="talk" mchat>
          {talk(TALK_PERMISSION, {})}
        </RoomPage>
      );
    case "talk-pc-none":
      return (
        <RoomPage theme={theme} ps="PS0" tab="talk" mchat>
          <TalkBody
            name={`${ME}のAI`}
            convs={NO_CONV}
            current={null}
            entries={[]}
            composer={{ mode: "no-pc" }}
            notice={<PcNone />}
          />
        </RoomPage>
      );
    case "tk-talk-panel":
      return (
        <TicketFrame
          theme={theme}
          ps="PS2"
          count={1}
          panel={<AiPanel ticket="EG-128" entries={PANEL_TALK} composer={{}} />}
        />
      );
    case "tk-talk-empty":
      return <TicketFrame theme={theme} ps="PS2" panel={<AiPanel ticket="EG-128" entries={[]} composer={{}} />} />;
    case "tk-talk-working":
      return (
        <TicketFrame
          theme={theme}
          ps="PS2"
          panel={<AiPanel ticket="EG-128" entries={PANEL_WORKING} composer={{ mode: "working" }} />}
        />
      );
    case "tk-talk-band-running":
      return (
        <TicketFrame
          theme={theme}
          ps="PS2"
          band={<RunningBandTalk name={ME} sub="開始 10:42 ・ 3 分" line="見積の金額を確かめています" />}
          panel={<AiPanel ticket="EG-128" entries={PANEL_PROGRESS} composer={{}} />}
        />
      );
    case "tk-talk-pc-none":
      return (
        <TicketFrame
          theme={theme}
          ps="PS0"
          band={
            <Band
              tone="wait"
              title="PC がまだつながっていません"
              sub="PC をつなぐと、AI に任せたり話したりできます"
              acts={<Button variant="outlined">PC をつなぐ</Button>}
            />
          }
          panel={<AiPanel ticket="EG-128" entries={[]} composer={{}} noPc />}
        />
      );
    default:
      return noop();
  }
}

const ROOM_HEADS = ["room-", "done-", "talk-", "tk-talk-", "create-talk-"] as const;

export const ROOM: MockGroup = {
  view: (id, theme) => (ROOM_HEADS.some((h) => id.startsWith(h)) ? view(id, theme) : null),
};
