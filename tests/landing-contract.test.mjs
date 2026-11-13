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

test('deadline strip stays date-driven while the approved Q4 recruitment label is current', () => {
  assert.match(html, /id="deadline-strip" data-deadline=""/);
  assert.match(html, /const raw = \(strip\.dataset\.deadline/);
  assert.doesNotMatch(html, /2026 Q1|26년 2분기 마감/);
  assert.equal((html.match(/2026년 4분기 마지막 모집/g) || []).length, 2);
  assert.doesNotMatch(html, /신규 고객사 무료 진단 접수 중/);
});

test('Meta benefits and supported-media marquee keep the visual contract', () => {
  assert.equal((html.match(/class="meta-benefit-card"/g) || []).length, 6);
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    assert.match(html, new RegExp(`class="meta-benefit-num">${number}<`));
  }
  assert.match(html, /class="meta-benefit-num">02<[\s\S]*?보너스 크레딧 <mark>2~8% 가능<\/mark>/);
  assert.doesNotMatch(html, /보너스 크레딧 <mark>약 6% 가능<\/mark>/);
  assert.equal((html.match(/class="hero-media-cell"/g) || []).length, 16);
  assert.equal((html.match(/class="hero-media-loop"/g) || []).length, 2);
  assert.equal((html.match(/class="hero-media-lockup"/g) || []).length, 4);
  assert.equal((html.match(/<span>YouTube<\/span>/g) || []).length, 2);
  assert.equal((html.match(/<span>LinkedIn Ads<\/span>/g) || []).length, 2);
  assert.match(html, /\.hero-media-cell\[data-brand="meta"\] img\{[^}]*filter:grayscale\(1\) brightness\(0\) invert\(1\)/);
  assert.match(html, /\.hero-media-cell\[data-brand="tiktok"\] img\{[^}]*filter:grayscale\(1\) brightness\(0\) invert\(1\)/);
  assert.match(html, /\.hero-media-cell\[data-brand="toss"\] img\{[^}]*filter:grayscale\(1\) brightness\(0\) invert\(1\)/);
  assert.match(html, /META INVOICE AD-ACCOUNT/);
  assert.doesNotMatch(html, /META PARTNER ACCOUNT|기존 캠페인과 데이터는 그대로 두고/);
  assert.match(html, /--font-sans:'Pretendard'/);
  assert.doesNotMatch(html, /font-family:'Courier New'|font-family:Georgia/);
  assert.match(html, /class="pill"[^>]*>[\s\S]*?2026년 4분기 마지막 모집<\/span>\s*<div class="hero-media-marquee"/);
  assert.ok(html.indexOf('class="hero-media-marquee"') < html.indexOf('class="hero-mega"'), 'media marquee must render directly below the recruitment label');
  assert.doesNotMatch(html, /\.hero-media-marquee\{[^}]*border:/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.hero-media-track\{animation:none\}/);
  assert.doesNotMatch(html, /🌎|🇰🇷|💳|🎁|🛡️|⚠|🚫|🏆|🏢|⚡|📋|🏷️|📧|📱|💰|🎯|🛒|📌|⚙️|💸|⭐|📊|🌐|💬|📉|🤔|💵|💴|🦛/u);
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
