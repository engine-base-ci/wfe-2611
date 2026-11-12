#!/usr/bin/env python3
"""Python の unittest の試験を流し、結果を JUnit XML に書く（K-172・標準の部品だけ）。

  python3 scripts/ci/junit_unittest.py --out junit/py.xml <試験のファイル>...

testcase の名前は「<ファイル> <クラス>.<試験の名前>」（行 ID は試験の名前に入れる：test_K172_CI_001_…）。
落ちた試験・エラーは failure／error、飛ばしたものは skipped。1 つでも落ちたら終わりの値は 1。
"""
from __future__ import annotations

import argparse
import importlib.util
import pathlib
import sys
import time
import traceback
import unittest
import xml.etree.ElementTree as ET


class Rec(unittest.TestResult):
    def __init__(self):
        super().__init__()
        self.cases: list[tuple[unittest.TestCase, str | None, str, float]] = []
        self._t = 0.0

    def startTest(self, test):
        super().startTest(test)
        self._t = time.time()

    def _add(self, test, kind, text=""):
        self.cases.append((test, kind, text, time.time() - self._t))

    def addSuccess(self, test):
        super().addSuccess(test); self._add(test, None)

    def addFailure(self, test, err):
        super().addFailure(test, err); self._add(test, "failure", "".join(traceback.format_exception(*err)))

    def addError(self, test, err):
        super().addError(test, err); self._add(test, "error", "".join(traceback.format_exception(*err)))

    def addSkip(self, test, reason):
        super().addSkip(test, reason); self._add(test, "skipped", reason)

    def addSubTest(self, test, sub, err):
        super().addSubTest(test, sub, err)
        if err is not None:
            kind = "failure" if issubclass(err[0], test.failureException) else "error"
            self._add(sub, kind, "".join(traceback.format_exception(*err)))


def load(path: pathlib.Path) -> unittest.TestSuite:
    sys.path.insert(0, str(path.parent))
    spec = importlib.util.spec_from_file_location(path.stem, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return unittest.defaultTestLoader.loadTestsFromModule(mod)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("files", nargs="*")   # 0 本なら空の記録を書く（チケットに Python の試験が無い回）
    a = ap.parse_args()
    suites = ET.Element("testsuites")
    bad = 0
    for f in a.files:
        p = pathlib.Path(f).resolve()
        rec = Rec()
        try:
            load(p).run(rec)
        except Exception:
            rec._add(unittest.FunctionTestCase(lambda: None, description=f"読み込み {p.name}"), "error", traceback.format_exc())
        s = ET.SubElement(suites, "testsuite", name=f, tests=str(len(rec.cases)))
        for test, kind, text, sec in rec.cases:
            tc = ET.SubElement(s, "testcase", classname=f, name=f"{f} {test.id()}", time=f"{sec:.3f}")
            if kind:
                ET.SubElement(tc, kind, message=text.strip().splitlines()[-1][:200] if text.strip() else kind).text = text
                bad += kind in ("failure", "error")
    out = pathlib.Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(suites).write(out, encoding="utf-8", xml_declaration=True)
    n = sum(len(list(s)) for s in suites)
    print(f"JUnit：{n} 本・落ちた {bad} 本 → {out}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
