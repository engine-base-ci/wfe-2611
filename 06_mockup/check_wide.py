# -*- coding: utf-8 -*-
"""横に広い要素が「自分の中でスクロールする箱」に入っているかの静的検査。
 本文が横スクロールする事故（lessons-learned G-05）を数値検査の前段で潰す。"""
import re,os,sys
bad=[]
for d in sys.argv[1:] or ['v1']:
    for f in sorted(os.listdir(d)):
        if not f.startswith(f'{os.path.basename(d.rstrip("/"))}-'): continue   # 治具（_runner 等）は対象外
        if not f.endswith('.html') or f.endswith('-index.html'): continue
        h=open(os.path.join(d,f)).read()
        body=h[h.index('<body>'):]; body=re.sub(r'<script>.*?</script>','',body,flags=re.S); body=re.sub(r'<style>.*?</style>','',body,flags=re.S)
        # <table> が t-wrap の中にあるか
        for m in re.finditer(r'<table', body):
            before=body[:m.start()]
            opens=before.count('<div class="t-wrap"')+before.count('class="t-wrap"')
            # 直近500文字以内に t-wrap が開いているか（簡易）
            if 't-wrap' not in before[-700:]:
                bad.append((f,'table が t-wrap の外',before[-90:].replace('\n',' ')[-70:]))
        # min-width 指定が t-wrap の外にないか
        for m in re.finditer(r'min-width:\s*(\d+)px', body):
            if int(m.group(1))<=340: continue
            before=body[:m.start()]
            if 't-wrap' not in before[-700:] and 'overflow-x' not in before[-300:]:
                bad.append((f,f'min-width:{m.group(1)}px が箱の外',before[-90:].replace('\n',' ')[-70:]))
if bad:
    print(f'要確認 {len(bad)} 件'); [print(f'  {f}  {w}\n      …{ctx}') for f,w,ctx in bad]; sys.exit(1)
print('横に広い要素はすべてスクロールする箱の中にあります')
