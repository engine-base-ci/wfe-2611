"use client";
// 作る画面の本文の箱の中（K-225・キャンバス Create の本文の箱）。上に文書の道具の帯（K-226 の部品 DocTools・押せない）、
//   その下の文書（.k-create-doc）に、種別の区画ごとの見出し h2（名前・必須の印・ひな形の補足）と欄を並べる。
//   欄の読み上げの名前は区画の名前ちょうど（aria-labelledby で h2 の中の名前の span へ。印や補足を名前に入れない）。理由は欄のすぐ下（aria-describedby）
//   キャンバスに在って機能がまだの物（道具の帯・「＋ 見出しを足す」・テスト仕様の 2 つのボタン）は出すが押せない（D-145.8・D-145.9）
import { Fragment, useId } from "react";
import { DocTools } from "@/components/k";

export interface SectionDef {
  key: string;
  label: string;
  mode: string;
  hint: string | null;
}

export interface CreateSectionsProps {
  /** 種別の名前（帯の右の「種別「〈種別〉」のひな形」） */
  kindName: string;
  /** 種別の区画（種別のマスタ kind_sections の順） */
  sections: SectionDef[];
  values: Record<string, string>;
  /** 区画ごとの理由（鍵は区画の key） */
  errors: Record<string, string | undefined>;
  onChange: (key: string, value: string) => void;
}

/** 押せないボタン（Tab で止まらない・押しても何もしない） */
function OffButton({ className, children }: { className: string; children: string }) {
  return (
    <button
      type="button"
      className={className}
      aria-disabled="true"
      tabIndex={-1}
      title={`${children}（まだ使えません）`}
    >
      {children}
    </button>
  );
}

export function CreateSections({ kindName, sections, values, errors, onChange }: CreateSectionsProps) {
  const base = useId();
  return (
    <>
      <DocTools label="文書の道具" note={`種別「${kindName}」のひな形 ・ 「/」で部品`} />
      <div className="k-create-doc">
        {sections.map((s) => {
          const nameId = `${base}-${s.key}-name`;
          const errId = `${base}-${s.key}-err`;
          const err = errors[s.key];
          return (
            <Fragment key={s.key}>
              <h2>
                <span id={nameId}>{s.label}</span>
                {s.mode === "required" ? (
                  <>
                    {" "}
                    <b>必須</b>
                  </>
                ) : null}
                {s.hint ? (
                  <>
                    {" "}
                    <span>{s.hint}</span>
                  </>
                ) : null}
              </h2>
              <div className="k-field">
                <textarea
                  className="k-input"
                  name={`sections.${s.key}`}
                  aria-labelledby={nameId}
                  aria-required={s.mode === "required" || undefined}
                  aria-invalid={err ? true : undefined}
                  aria-describedby={err ? errId : undefined}
                  value={values[s.key] ?? ""}
                  onChange={(e) => onChange(s.key, e.target.value)}
                />
                {err ? (
                  <p className="k-err" id={errId}>
                    {err}
                  </p>
                ) : null}
              </div>
            </Fragment>
          );
        })}
        <section className="k-create-spec" aria-labelledby={`${base}-spec`}>
          <h3 id={`${base}-spec`}>テスト仕様</h3>
          <div className="k-create-spec-box">
            <div className="k-create-spec-acts">
              <OffButton className="k-create-spec-act">＋ 項目を足す</OffButton>
              <OffButton className="k-create-spec-act">抜けを点検する</OffButton>
            </div>
          </div>
        </section>
        <OffButton className="k-create-doc-add">
          ＋ 見出しを足す（相手・成果物・決定ログ・申し送り・自由欄 など）
        </OffButton>
      </div>
    </>
  );
}
