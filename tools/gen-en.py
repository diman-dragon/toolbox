#!/usr/bin/env python3
"""Собирает src/i18n-en.ts из tools/en.txt (формат строки: «русский|English»)."""
import json,sys
rows=[l.rstrip('\n').split('|',1) for l in open('tools/en.txt',encoding='utf8') if '|' in l]
out="/** Английский словарь. Ключ — русский текст. Правится в tools/en.txt, собирается: python3 tools/gen-en.py */\nexport const EN: Record<string, string> = {\n"
for a,b in rows: out+=f"  {json.dumps(a,ensure_ascii=False)}: {json.dumps(b,ensure_ascii=False)},\n"
out+="};\n"
open('src/i18n-en.ts','w',encoding='utf8').write(out)
print(len(rows),'строк')
