// 「PC と使った量」の本文の下の 2 つ：前の画面への文と、本文の知らせ（K-349 で connect-pc.tsx からそのまま移した）。
//   K-367 が前の画面への文と LEGACY を消す（知らせの <p> は本文の箱の最後の子のまま）

/** 前の画面（D-128.150・D-128.164）。K-89・K-90・K-91 が新しい画面へ移し終えたら消す */
const LEGACY = "/setup/bridge/legacy";

export function PcFoot({ note }: { note: string | null }) {
  return (
    <>
      {/* 前の画面への導線（D-128.164）：Claude Code を入れてログインする・AI が使うブラウザを選ぶ・端末を外すは、
          それぞれのチケット（K-89・K-90・K-91）が新しい画面へ移すまで前の画面にある */}
      <p className="k-pc-legacy">
        Claude Code を入れてログインする・AI が使うブラウザを選ぶ・PC を外すは、
        <a className="k-link" href={LEGACY} data-act="legacy">
          前の設定の画面
        </a>
        で行えます。
      </p>
      {note ? (
        <p role="status" className="k-pc-note">
          {note}
        </p>
      ) : null}
    </>
  );
}
