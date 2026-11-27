"use client";
// 丸い選択・四角い選択の見本の中身（K-642）。状態を持つので client。部品は components/k の入口から読む
import { useState } from "react";
import { Checkbox, Radio, RadioGroup } from "@/components/k";

const WRAP =
  "長い字の四角：幅が狭いと 2 行より多く折り返す。印は 1 行目の字の真ん中にそろい、2 行目の高さには寄らない。折り返しても印は上の行に残る";

export function ChoiceDemo() {
  const [one, setOne] = useState(true);
  const [pick, setPick] = useState("a");
  return (
    <main className="k-root k-page" aria-labelledby="k642-title">
      <h1 id="k642-title">丸い選択・四角い選択（K-642）</h1>
      <section aria-labelledby="k642-box">
        <h2 id="k642-box">四角い選択</h2>
        <Checkbox checked={one} onChange={(e) => setOne(e.target.checked)}>
          一行の字
        </Checkbox>
        <Checkbox data-choice-demo="wrap">{WRAP}</Checkbox>
        <Checkbox size="sm">小さい字（小窓の中）</Checkbox>
        <Checkbox size="lg">大きい字</Checkbox>
        <Checkbox description="説明は 1 行目の下に小さく出る">説明の行が下に付く</Checkbox>
        <Checkbox disabled>押せない四角</Checkbox>
        <Checkbox aria-label="字の無い四角" />
      </section>
      <section aria-labelledby="k642-radio">
        <h2 id="k642-radio">丸い選択</h2>
        <RadioGroup legend="丸い選択の組" name="k642-demo" value={pick} onValueChange={setPick}>
          <Radio value="a">ひとつめ</Radio>
          <Radio value="b" description="説明つきの丸">
            ふたつめ
          </Radio>
          <Radio value="c" disabled>
            みっつめ
          </Radio>
        </RadioGroup>
      </section>
    </main>
  );
}
