import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const leadApi = await readFile(new URL('../api/lead.js', import.meta.url), 'utf8');

test('media comparison cards keep the expected ordered contract', () => {
  const ids = [...html.matchAll(/<div class="media-detail(?: featured)?" id="([^"]+)">/g)].map((match) => match[1]);
  assert.deepEqual(ids, ['m-meta', 'm-google', 'm-tiktok', 'm-pinterest', 'm-global', 'm-naver', 'm-toss', 'm-kakao', 'm-domestic']);
  assert.equal((html.match(/class="m-price-compare"/g) || []).length, 9);
  assert.equal((html.match(/class="m-price-row is-partner"/g) || []).length, 9);
});

test('trust footer exposes verified operator and working policy destinations', () => {
  for (const copy of ['앱실론코퍼레이션(주)', '810-81-01685', '2021-서울강남-04074', '평일 09:00–18:00']) {
    assert.ok(html.includes(copy), `missing verified footer copy: ${copy}`);
  }
  assert.doesNotMatch(html, /href="#">(?:개인정보처리방침|이용약관)/);
  assert.match(html, /id="service-guide"/);
});

test('urgency is date-driven and stale quarter claims are absent', () => {
  assert.match(html, /id="deadline-strip" data-deadline=""/);
  assert.match(html, /const raw = \(strip\.dataset\.deadline/);
  assert.doesNotMatch(html, /2026 Q1|26년 2분기 마감/);
});

test('Meta benefits and supported-media marquee keep the visual contract', () => {
  assert.equal((html.match(/class="meta-benefit-card"/g) || []).length, 6);
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    assert.match(html, new RegExp(`class="meta-benefit-num">${number}<`));
  }
  assert.equal((html.match(/class="hero-media-cell"/g) || []).length, 16);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.hero-media-track\{animation:none\}/);
});

test('CTA experiment exposes all four copies and counts lead only after backend success', () => {
  for (const copy of ['무료 진단 신청', '지금 혜택 확인', '혜택 비교하기', '내 지원금 확인']) {
    assert.ok(html.includes(copy), `missing CTA variant: ${copy}`);
  }
  assert.match(html, /partneragency_cta_copy_v1/);
  assert.match(html, /sendCtaExperimentEvent\('exposure'/);
  assert.match(html, /sendCtaExperimentEvent\('click'/);
  assert.match(html, /ctaLeadEventId:/);
  assert.ok(leadApi.indexOf("event_type: 'lead'") > leadApi.indexOf('const savedAnywhere'));
});
