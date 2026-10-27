# -*- coding: utf-8 -*-
"""companies.json 数据质量体检"""
import json, os, re, collections, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(ROOT, 'companies.json'), encoding='utf-8'))
cats = d['categories']
rows = [(c['id'], co) for c in cats for co in c['companies']]
n = len(rows)

fail = 0
def chk(cond, msg):
    global fail
    print(('  OK   ' if cond else '  FAIL ') + msg)
    if not cond:
        fail += 1

print('=== 总量 ===')
print('  分类数:', len(cats), '| 公司数:', n, '| meta.total:', d['meta'].get('total'))
chk(n == d['meta'].get('total'), 'meta.total 与实际条目数一致')
chk(len({co['ticker'] for _, co in rows}) == n, 'ticker 无重复')
chk(all(len(c['companies']) > 0 for c in cats), '无空分类')
chk(all(c['id'] in [x['id'] for x in cats] for c in cats), '分类 id 唯一')

print('\n=== 字段完整性 ===')
for k in ['ticker', 'name', 'exchange', 'website', 'intro']:
    miss = [co for _, co in rows if not co.get(k)]
    chk(len(miss) == 0 or k in ('website', 'intro'), '%s 缺失 %d 家' % (k, len(miss)))
    if miss and k in ('website', 'intro'):
        print('        样本:', [co['ticker'] for co in miss[:8]])

print('\n=== 链接可用性 ===')
bad = [co for _, co in rows if co.get('website') and not re.match(r'^https?://', co['website'])]
chk(not bad, 'website 均为 http(s) 链接（异常 %d）' % len(bad))
lt = collections.Counter(co.get('linkType', '?') for _, co in rows)
print('  linkType 分布:', dict(lt))
chk(lt.get('official', 0) / n > 0.8, '官方直链占比 > 80%%（实际 %.1f%%）' % (lt.get('official', 0) * 100.0 / n))

print('\n=== 内容质量 ===')
chk(len({co.get('intro') for _, co in rows}) > n * 0.7, '简介非模板化（不同文本 %d / %d）' % (len({co.get('intro') for _, co in rows}), n))
other = next((c for c in cats if c['id'] == 'other'), None)
if other:
    pct = len(other['companies']) * 100.0 / n
    chk(pct < 8, '「其他」占比 < 8%%（实际 %.1f%%，%d 家）' % (pct, len(other['companies'])))

print('\n=== 分类分布 ===')
for c in sorted(cats, key=lambda x: -len(x['companies'])):
    print('  %-14s %5d  %s' % (c['id'], len(c['companies']), c['name']))

print('\n结果:', '全部通过' if fail == 0 else '%d 项未通过' % fail)
sys.exit(1 if fail else 0)
