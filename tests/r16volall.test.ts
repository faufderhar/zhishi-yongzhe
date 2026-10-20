// r16 第 8 步 (d) 较真家长：〔全部册别〕单独样式；全部时各册浅色「含在全部里」，单独选的册是黄色实心
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { VolChips } from '../src/ui/Parent';
const vols: [string, number][] = [['上册', 10], ['下册', 8]];
const h = (volumes: string[] | null) => renderToStaticMarkup(createElement(VolChips, { vols, volumes, onVol() {}, onAll() {} }));
const cls = (html: string, id: string) => html.match(new RegExp(`class="([^"]*)" data-testid="${id}"`))?.[1] ?? '';
describe('r16 8d 全部册别', () => {
  it('全部：〔全部册别〕实心 + ✓，各册 in-all（不是 on），有「含在全部里」，aria-pressed 仍为 true', () => {
    const x = h(null);
    expect(cls(x, 'vol-all')).toMatch(/vol-all-chip on/); expect(x).toContain('✓ 全部册别');
    for (const v of ['上册', '下册']) { expect(cls(x, 'vol-' + v)).toMatch(/\bin-all\b/); expect(cls(x, 'vol-' + v)).not.toMatch(/\bon\b/); }
    expect((x.match(/含在全部里/g) ?? []).length).toBe(2); expect(x).toContain('data-testid="volnote-all"');
    expect((x.match(/aria-pressed="true"/g) ?? []).length).toBe(3);
  });
  it('只选上册：〔全部册别〕虚线未选、上册 on、下册普通；没有「含在全部里」', () => {
    const x = h(['上册']);
    expect(cls(x, 'vol-all')).toBe('chip vol-all-chip '); expect(x).not.toContain('✓');
    expect(cls(x, 'vol-上册')).toBe('chip on'); expect(cls(x, 'vol-下册')).toBe('chip '); expect(x).not.toContain('含在全部里');
  });
  it('样式：虚线 vs 实心，in-all 浅色', () => {
    const css = readFileSync('src/app.css', 'utf8');
    expect(css).toMatch(/\.chip\.vol-all-chip\{border:2px dashed/); expect(css).toMatch(/\.chip\.vol-all-chip\.on\{border:2px solid/); expect(css).toMatch(/\.chip\.in-all\{background:#ffd54a33/);
  });
});
