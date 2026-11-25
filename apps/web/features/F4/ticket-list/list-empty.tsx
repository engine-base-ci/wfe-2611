// はじめて（0 件）の本文（K-251・キャンバス OnHome）。あいさつは名前だけ（会社の名前は出さない・D-145.4）と、点線の空の箱。
//   箱：＋ の札・「まだチケットはありません」・説明・書ける人だけ主「＋ チケットを作る」（作る面を開く）。
//   従「分身と話して作る」は、まだ使えないので出すが押せない（span・aria-disabled・グレー・D-145.2・D-145.9）。
//   おすすめ 3 つは HomeSuggest（K-453）：書ける人には押すと題名を入れて作る面を開く字・書けない人には押せない形
import { Button } from "@/components/k";
import { HomeSuggest } from "../home/home-empty";

export function ListEmpty({ name, canCreate, onCreate }: { name: string; canCreate: boolean; onCreate: () => void }) {
  return (
    <div className="k-list-first">
      {name ? <p className="k-list-greet">ようこそ、{name}さん</p> : null}
      <section className="k-state k-list-empty" data-state="empty" aria-labelledby="k-list-empty-title">
        <span className="k-list-empty-mark" aria-hidden="true">
          ＋
        </span>
        <h2 id="k-list-empty-title" className="k-state-title">
          まだチケットはありません
        </h2>
        <p className="k-list-empty-desc">
          チケットは仕事の 1 単位。担当・期限・完了の条件を書くと、分身があなたの代わりに進め、確かめてから承認を待つ
        </p>
        <div className="k-state-actions">
          {canCreate ? (
            <Button className="k-list-act" onClick={onCreate}>
              ＋ チケットを作る
            </Button>
          ) : null}
          <span
            className="k-btn k-list-act"
            data-variant="outlined"
            aria-disabled="true"
            title="分身と話して作る（準備中）"
          >
            分身と話して作る
          </span>
        </div>
        <HomeSuggest canCreate={canCreate} onCreate={onCreate} />
      </section>
    </div>
  );
}
