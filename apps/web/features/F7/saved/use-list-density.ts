"use client";
// 一覧の 1 行の高さ（ふつう／詰める・K-478）。このブラウザ（localStorage）に覚え、<html data-list-density="tight"> で効かせる
//   （詰めた高さは saved.css の 1 つの規則・前からのトークンの calc）。読めない・書けないときは「ふつう」のまま動く（エラーは出さない）
import { useCallback, useLayoutEffect, useState } from "react";

export type Density = "normal" | "tight";
export const DENSITY_STORAGE = "kaname.f7.list-density";
const ATTR = "data-list-density";

function readDensity(): Density {
  try {
    return window.localStorage.getItem(DENSITY_STORAGE) === "tight" ? "tight" : "normal";
  } catch {
    return "normal";
  }
}

function writeDensity(d: Density): void {
  try {
    window.localStorage.setItem(DENSITY_STORAGE, d);
  } catch {
    // 覚えられない（個人用の窓など）ときは、この画面の間だけ効く
  }
}

export function useListDensity(): { density: Density; setDensity: (d: Density) => void } {
  const [density, setState] = useState<Density>("normal");
  // 最初の描画の前に覚えた値を読む（再読み込みでも詰めた高さのまま描く）
  useLayoutEffect(() => {
    setState(readDensity());
  }, []);
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (density === "tight") root.setAttribute(ATTR, "tight");
    else root.removeAttribute(ATTR);
    return () => root.removeAttribute(ATTR);
  }, [density]);
  const setDensity = useCallback((d: Density) => {
    setState(d);
    writeDensity(d);
  }, []);
  return { density, setDensity };
}
