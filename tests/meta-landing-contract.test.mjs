import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../lp/meta/index.html', import.meta.url), 'utf8');

test('Meta landing keeps one clear proposition and one semantic H1', () => {
  assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.match(html, /Meta 광고비,[\s\S]*해외 결제 수수료 5%는 줄이고, 보너스 크레딧 3%는 더 받으세요/);
  assert.doesNotMatch(html, /내 지원금 확인|내 돈 찾으러 가기/);
});

test('Meta landing reuses verified first-party operator and media assets', () => {
  for (const asset of ['../../logos/appsilon.png', '../../logos/meta.svg', '../../logos/google.svg', '../../logos/media-cutout-v1/tiktok.png']) {
    assert.ok(html.includes(asset), `missing asset ${asset}`);
  }
  for (const copy of ['앱실론코퍼레이션(주)', '810-81-01685', '2021-서울강남-04074']) {
    assert.ok(html.includes(copy), `missing operator proof ${copy}`);
  }
});

test('Meta landing preserves lead API and required payload contract', () => {
  assert.match(html, /fetch\('\/api\/lead'/);
  for (const field of ['company', 'name', 'email', 'phone', 'budget']) {
    assert.match(html, new RegExp(`name="${field}"`));
  }
  assert.match(html, /services:\['Meta'\]/);
  assert.match(html, /serviceType:\['계정 임대만'\]/);
});

test('Meta landing uses a one-question-at-a-time lead wizard', () => {
  const form = html.match(/<form class="lead-form"[\s\S]*?<\/form>/)?.[0] || '';
  const orderedSteps = [...form.matchAll(/data-form-step="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(orderedSteps, ['budget', 'industry', 'company', 'name', 'email', 'phone', 'consent']);
  assert.equal((form.match(/class="form-step"/g) || []).length, 7);
  assert.equal((form.match(/class="form-step"[^>]* hidden/g) || []).length, 6);
  assert.match(form, /role="progressbar"[\s\S]*aria-valuemax="7"/);
  assert.match(form, /class="wizard-back"/);
  assert.match(form, /class="wizard-next"/);
  assert.doesNotMatch(form, /class="form-grid"/);
  assert.match(html, /function setFormStep\(/);
  assert.match(html, /function validateFormStep\(/);
  assert.match(html, /form_step_complete/);
  assert.match(html, /event\.key==='Enter'/);
});

test('Meta landing has responsive and reduced-motion safeguards', () => {
  assert.match(html, /@media \(max-width:640px\)/);
  assert.match(html, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(html, /formRect\.top>innerHeight/);
  assert.match(html, /calculatorVisible/);
  assert.match(html, /overflow-x:hidden/);
  assert.match(html, /rel="icon"[^>]+logos\/appsilon\.png/);
});

test('Meta landing uses natural scrolling, calm reveal motion, and a top progress line', () => {
  assert.equal((html.match(/class="snap-section/g) || []).length, 7);
  assert.match(html, /class="page-progress"/);
  assert.match(html, /scroll-snap-type:none/);
  assert.match(html, /revealObserver/);
  assert.match(html, /updatePageProgress/);
  assert.doesNotMatch(html, /class="section-rail"/);
  assert.doesNotMatch(html, /addEventListener\('wheel'/);
  assert.doesNotMatch(html, /wheelLock=true/);
});

test('Meta landing uses an authentic code-native account console without synthetic hero media', () => {
  assert.match(html, /class="hero-console"/);
  assert.match(html, /파트너 계정 운영 현황/);
  assert.match(html, /Meta 광고계정/);
  assert.match(html, /이번 달 광고비/);
  assert.match(html, /절감한 해외 결제 수수료<\/small><strong>₩5,000,000<\/strong><em>절감률 5\.0%/);
  assert.match(html, /예상 보너스 크레딧<\/small><strong>₩3,000,000<\/strong><em>보너스율 3\.0%/);
  assert.match(html, /\.console-account-logo\{[^}]*width:86px[^}]*height:46px/);
  assert.match(html, /\.console-account-logo img\{width:68px;height:24px;object-fit:contain\}/);
  assert.match(html, /파트너 인보이스/);
  assert.match(html, /캠페인 · 픽셀 · 데이터/);
  assert.match(html, /class="console-chart"/);
  assert.match(html, /@keyframes chartDraw/);
  assert.match(html, /Google Ads 연결 가능/);
  assert.doesNotMatch(html, /<video/);
  assert.doesNotMatch(html, /operations-hero-v1\.(?:mp4|jpg)/);
  assert.doesNotMatch(html, /hero-video-frame|visual-rate-card|cardFloat|visualGlow/);
  assert.match(html, /class="payment-flow"/);
  assert.equal((html.match(/class="flow-node"/g) || []).length, 3);
  assert.match(html, /@keyframes flowMove/);
  for (const cta of ['cta-header-diagnosis', 'cta-hero-calculator', 'cta-hero-structure', 'cta-sticky-diagnosis']) {
    assert.match(html, new RegExp(`id="${cta}"`));
  }
  assert.equal((html.match(/data-cta-position=/g) || []).length, 4);
});

test('Meta landing keeps a visual credit-card receipt example', () => {
  assert.match(html, /data-receipt-example/);
  assert.match(html, /신용카드 청구내역/);
  assert.match(html, /3792-20\*\*-\*\*\*\*-\*\*021/);
  assert.match(html, /최종 청구 금액/);
  assert.match(html, /해외 광고비 카드 이용 명세/);
  for (const network of ['visa.svg', 'mastercard.svg', 'unionpay.svg', 'amex.svg']) {
    assert.ok(html.includes(`../../logos/${network}`), `missing card network ${network}`);
  }
  assert.match(html, /\.receipt::after\{[^}]*box-shadow/);
});

test('Meta landing renders the complete media list with image assets', () => {
  const mediaSection = html.match(/<section class="snap-section" id="media"[\s\S]*?<\/section>/)?.[0] || '';
  assert.equal((mediaSection.match(/class="media-logo(?: has-wordmark)?"/g) || []).length, 20);
  assert.equal((mediaSection.match(/class="media-benefit"/g) || []).length, 20);
  assert.match(mediaSection, /보너스 4~7%/);
  assert.match(mediaSection, /보너스 <b>약 14%/);
  assert.match(mediaSection, /할인 <b>최대 14%/);
  for (const latestRate of [
    '절감 <b>5%</b> · 보너스 <b>3%</b>',
    '절감 <b>5%</b> · 보너스 <b>2%</b>',
    '절감 <b>5%</b> · 리워드 <b>8%</b>',
    '리베이트 <b>최대 15%</b>'
  ]) assert.ok(mediaSection.includes(latestRate), `missing latest rate ${latestRate}`);
  for (const [wordmark, asset] of [
    ['LinkedIn Ads', 'linkedin.svg'],
    ['Snapchat Ads', 'snapchat.svg'],
    ['Reddit Ads', 'reddit.svg'],
    ['Apple Search Ads', 'apple.svg']
  ]) {
    assert.match(mediaSection, new RegExp(`aria-label="${wordmark}"`));
    assert.ok(mediaSection.includes(`../../logos/${asset}`), `missing original logo ${asset}`);
  }
  assert.doesNotMatch(mediaSection, /Meta Badged Marketing Partner/);
  assert.doesNotMatch(mediaSection, /appsilon\.png|앱실론코퍼레이션/);
  assert.doesNotMatch(html, /id="operator"/);
  assert.doesNotMatch(mediaSection, /text-logo/);
  const normalizedAssets = ['meta', 'google', 'tiktok', 'naver', 'kakao', 'x', 'pinterest', 'youtube', 'line', 'amazon', 'yahoo', 'kt-townboard', 'focus-media', 'unity-ads', 'mediameet'];
  for (const asset of normalizedAssets) {
    assert.ok(mediaSection.includes(`../../logos/media-cutout-v1/${asset}.png`), `missing normalized asset ${asset}`);
  }
  assert.ok(mediaSection.includes('../../logos/toss.png'), 'missing official Toss wordmark');
  assert.doesNotMatch(mediaSection, /class="(?:compact|tall)"|line\.jpg/);
  assert.match(html, /\.media-logo-grid\{[^}]*grid-template-columns:repeat\(4,1fr\)/);
  assert.match(html, /@media\(max-width:640px\)\{[\s\S]*?\.media-logo-grid\{grid-template-columns:repeat\(3,1fr\)/);
  assert.match(html, /\.media-logo>img\{[^}]*width:auto[^}]*height:26px[^}]*background:transparent[^}]*mix-blend-mode:normal/);
  assert.match(html, /\.media-brand-lockup img\{width:26px;height:26px[^}]*background:transparent[^}]*mix-blend-mode:normal/);
  assert.match(html, /@media\(max-width:640px\)\{[\s\S]*?\.media-logo>img\{height:18px\}[\s\S]*?\.media-brand-lockup img\{width:18px;height:18px\}/);
  assert.match(html, /media-logo:has\(img\[alt="KT TOWNBOARD"\]\)\{grid-column:span 2\}/);
});

test('Meta landing reuses the homepage media marquee and exact first-party logo assets', () => {
  const mediaSection = html.match(/<section class="snap-section" id="media"[\s\S]*?<\/section>/)?.[0] || '';
  assert.equal((mediaSection.match(/class="media-marquee-loop"/g) || []).length, 2);
  assert.equal((mediaSection.match(/class="media-marquee-cell"/g) || []).length, 16);
  assert.equal((mediaSection.match(/class="media-marquee-lockup"/g) || []).length, 4);
  for (const asset of ['meta.svg', 'google.svg', 'tiktok.svg', 'naver.png', 'kakao.svg', 'toss.png', 'youtube.svg', 'linkedin.svg']) {
    assert.ok(mediaSection.includes(`../../logos/${asset}`), `missing homepage marquee asset ${asset}`);
  }
  assert.match(html, /@keyframes mediaMarqueeSlide/);
  assert.match(html, /\.media-marquee-track\{[^}]*animation:mediaMarqueeSlide 24s linear infinite/);
  assert.match(html, /prefers-reduced-motion:reduce[\s\S]*?\.media-marquee-track\{animation:none\}/);
});

test('Meta landing preserves the requested decision content from the long-form reference', () => {
  for (const copy of [
    '제한·추가 심사 업종',
    '파트너 인보이스',
    '해외 결제·카드 수수료',
    '월 세금계산서',
    '매체별 적용 가능 혜택, 평일 기준 24시간 이내 확인',
    '기존 캠페인·데이터 유지 범위'
  ]) assert.ok(html.includes(copy), `missing reference content ${copy}`);
  assert.match(html, /\.benefit:nth-child\(1\)::before\{content:"01"\}/);
  assert.match(html, /\.benefit:nth-child\(3\)::before\{content:"03"\}/);
  for (const illustration of ['benefit-continuity', 'benefit-data', 'benefit-invoice']) {
    assert.ok(html.includes(`id="${illustration}"`), `missing benefit illustration ${illustration}`);
  }
  assert.equal((html.match(/class="benefit-copy"/g) || []).length, 3);
  assert.match(html, /\.js \.benefit\{[^}]*translate3d\(0,76px,0\)[^}]*scale\(\.96\)/);
  assert.match(html, /@keyframes benefitNumberPop/);
  assert.match(html, /\.js \.is-visible \.benefit:nth-child\(3\)\{transition-delay:\.64s\}/);
  assert.match(html, /prefers-reduced-motion:reduce[\s\S]*?\.js \.benefit,\.js \.is-visible \.benefit\{[^}]*opacity:1/);
});

test('Meta landing separates sections like slides without forced scroll interception', () => {
  assert.match(html, /main\{counter-reset:landing-section\}/);
  assert.match(html, /content:"0" counter\(landing-section\) "  \/  " attr\(data-section-label\)/);
  assert.match(html, /\.snap-section\.is-visible:not\(\.hero\)::after\{width:min\(28vw,420px\)\}/);
  assert.match(html, /#calculator,#case,#faq\{background:linear-gradient/);
  assert.doesNotMatch(html, /addEventListener\('wheel'/);
});

test('Meta landing presents source-backed Meta, Google, TikTok, and Unity benefit cards', () => {
  const benefitSection = html.match(/<section class="snap-section section-soft" id="case"[\s\S]*?<\/section>/)?.[0] || '';
  assert.equal((benefitSection.match(/class="channel-benefit-card"/g) || []).length, 4);
  for (const copy of ['주요 매체의 계정 혜택', '해외 결제 수수료 절감', '보너스 크레딧', '매체 리워드', '최대 13%', '최대 8%', '최대 7%', 'Unity Ads', '기존 캠페인·데이터 자산 유지']) {
    assert.ok(benefitSection.includes(copy), `missing benefit copy ${copy}`);
  }
  assert.doesNotMatch(benefitSection, /ANONYMIZED CASE|₩500,800,030|5\.96%/);
});

test('Meta landing uses Korean-only section headings and polished Korean labels', () => {
  assert.equal((html.match(/class="kicker"/g) || []).length, 0);
  for (const oldHeading of ['RECEIPT &amp; SAVINGS', 'MEDIA BENEFITS', 'PAYMENT STRUCTURE', 'ACCOUNT RENTAL BENEFITS', 'FREE DIAGNOSIS', '>FAQ<']) {
    assert.ok(!html.includes(oldHeading), `obsolete English section heading remains: ${oldHeading}`);
  }
  for (const copy of ['지원 매체', '자주 묻는 질문', '광고비 절감 가능액을 무료로 확인하세요.']) {
    assert.ok(html.includes(copy), `missing Korean label ${copy}`);
  }
});

test('Meta landing uses current Meta calculator rates and compact mobile content-height sections', () => {
  assert.match(html, /annualFee=Math\.round\(budget\*\.05\*12\)/);
  assert.match(html, /annualBonus=Math\.round\(budget\*\.03\*12\)/);
  assert.match(html, /renderCalculator\(range\.value\)/);
  assert.match(html, /html\{scroll-snap-type:none/);
  assert.match(html, /snap-section:not\(\.hero\):not\(\.apply\)\{min-height:auto/);
});

test('Normalized media cutouts are valid transparent PNG files', async () => {
  const assets = ['meta', 'google', 'tiktok', 'naver', 'kakao', 'x', 'linkedin', 'pinterest', 'snapchat', 'youtube', 'line', 'amazon', 'reddit', 'apple', 'yahoo', 'kt-townboard', 'focus-media', 'unity-ads', 'mediameet'];
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (const asset of assets) {
    const file = await readFile(new URL(`../logos/media-cutout-v1/${asset}.png`, import.meta.url));
    assert.deepEqual(file.subarray(0, 8), pngSignature, `invalid PNG signature for ${asset}`);
    assert.equal(file[25], 6, `missing RGBA color type for ${asset}`);
  }
  const toss = await readFile(new URL('../logos/toss.png', import.meta.url));
  assert.deepEqual(toss.subarray(0, 8), pngSignature, 'invalid official Toss PNG');
  assert.equal(toss[25], 6, 'official Toss logo must retain RGBA transparency');
});

test('Credit-card network logos are valid SVG files', async () => {
  for (const asset of ['mastercard', 'unionpay']) {
    const file = await readFile(new URL(`../logos/${asset}.svg`, import.meta.url), 'utf8');
    assert.match(file, /<svg\b/);
    assert.ok(file.length > 300, `unexpectedly small SVG for ${asset}`);
  }
});

test('Meta landing keeps section headlines compact on mobile', () => {
  assert.match(html, /@media \(max-width:640px\)\{\.snap-section h2\{font-size:25px\}\}/);
  assert.match(html, /@media \(max-width:360px\)\{\.snap-section h2\{font-size:22px\}\}/);
});
