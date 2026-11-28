# -*- coding: utf-8 -*-
"""href集合 ⇔ 実在ファイル集合 の機械照合（lessons-learned G-04）。
 「ナビが404」を目視ではなく数値で潰す。"""
import re, os, sys, collections

def check(dirs):
    ng=collections.defaultdict(list); total=0
    for d in dirs:
        files=set(os.listdir(d))
        for f in sorted(files):
            if not f.endswith('.html'): continue
            html=open(os.path.join(d,f)).read()
            for href in re.findall(r'href="([^"]+)"', html):
                if href.startswith(('http','#','mailto:')): continue
                total+=1
                target=os.path.normpath(os.path.join(d, href))
                if not os.path.exists(target):
                    ng[f].append(href)
    return total, ng

dirs=[a for a in sys.argv[1:]] or ['v1']
total, ng = check(dirs)
print(f'検査した内部リンク: {total} 本')
if ng:
    print(f'\n404 になるリンク: {sum(len(v) for v in ng.values())} 本')
    for f,hs in sorted(ng.items()):
        print(f'  {f}')
        for h in sorted(set(hs)): print(f'      → {h}')
    sys.exit(1)
print('404: 0 本  ── すべて実在ファイルを指しています')
