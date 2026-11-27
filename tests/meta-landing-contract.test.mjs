import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../lp/meta/index.html', import.meta.url), 'utf8');

test('Meta landing keeps one clear proposition and one semantic H1', () => {
  assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.equal((html.match(/class="hero-line"/g) || []).length, 3);
  assert.match(html, /Meta 광고비, 해외 결제[\s\S]*수수료 5%는 줄이고, 보너스[\s\S]*크레딧 3%는 더 받으세요/);
  assert.doesNotMatch(html, /logo-lockup appsilon/);
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
  assert.match(html, /services:mediaSelections\.length\?mediaSelections\.map\(item=>item\.media\):\['Meta'\]/);
  assert.match(html, /selectedMedia:mediaSelections/);
  assert.match(html, /희망 매체 및 월 사용금액\(만원\)/);
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
  assert.equal((html.match(/class="snap-section/g) || []).length, 8);
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
  assert.match(html, /절감한 해외 결제 수수료<\/small><strong>\+₩5,000,000<\/strong><em>절감률 5\.0%/);
  assert.match(html, /예상 보너스 크레딧<\/small><strong>\+₩3,000,000<\/strong><em>보너스율 3\.0%/);
  assert.match(html, /\.console-account-logo\{border:0;background:transparent\}/);
  assert.match(html, /\.console-kpi\.gain strong\{color:#18845b\}/);
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
  for (const asset of ['payment-card-live1-v1.png', 'payment-invoice-live1-v1.png', 'payment-operations-live1-v1.png']) {
    assert.ok(html.includes(`/lp/meta/assets/${asset}`), `missing payment-flow cutout ${asset}`);
  }
  assert.match(html, /@keyframes flowMove/);
  for (const cta of ['cta-header-diagnosis', 'cta-hero-calculator', 'cta-hero-structure', 'cta-sticky-diagnosis']) {
    assert.match(html, new RegExp(`id="${cta}"`));
  }
  assert.equal((html.match(/data-cta-position=/g) || []).length, 4);
});

test('Meta landing keeps a visual credit-card receipt example', () => {
  assert.match(html, /data-receipt-example/);
  assert.match(html, /Meta, Google 및 해외매체 광고비 결제내역/);
  assert.match(html, /3792-20\*\*-\*\*\*\*-\*\*021/);
  assert.match(html, /최종 청구 금액/);
  assert.match(html, /해외 광고비 카드 이용 명세/);
  assert.doesNotMatch(html, /MONTHLY CARD STATEMENT/);
  assert.doesNotMatch(html, /청구 기준일/);
  assert.match(html, /카드 번호/);
  for (const network of ['visa.svg', 'mastercard.svg', 'unionpay.svg', 'amex.svg']) {
    assert.ok(html.includes(`../../logos/${network}`), `missing card network ${network}`);
  }
  assert.match(html, /\.receipt::before,\.receipt::after\{content:none\}/);
  assert.match(html, /\.compact-calculator\{box-shadow:none/);
  assert.match(html, /\.receipt-network-logos img,\.receipt-network-logos img\[alt="American Express"\]\{[^}]*height:20px[^}]*background:transparent[^}]*mix-blend-mode:normal/);
  assert.equal((html.match(/data-countup="/g) || []).length, 5);
  assert.match(html, /data-countup="105443800" data-prefix="₩"/);
  assert.match(html, /function animateCountup\(element\)/);
  assert.match(html, /element\.classList\.add\('is-counting'\)/);
  assert.match(html, /index\*90/);
  assert.match(html, /if\(reducedMotion\)\{renderCountupValue\(element,target\)/);
  assert.match(html, /\.receipt-network-logos\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(html, /\.js \.receipt-row \[data-countup\]\.is-counting\{opacity:1;transform:none\}/);
  assert.match(html, /\.receipt-row\.total\{padding:14px 16px\}/);
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
  assert.ok(mediaSection.includes('../../logos/toss-user-cutout-v1.png'), 'missing user-supplied transparent Toss wordmark');
  assert.doesNotMatch(mediaSection, /class="(?:compact|tall)"|line\.jpg/);
  assert.match(html, /\.media-logo-grid\{[^}]*grid-template-columns:repeat\(4,1fr\)/);
  assert.match(html, /@media\(max-width:640px\)\{[\s\S]*?\.media-logo-grid\{grid-template-columns:repeat\(3,1fr\)/);
  assert.match(html, /\.media-logo>img\{[^}]*width:auto[^}]*height:26px[^}]*background:transparent[^}]*mix-blend-mode:normal/);
  assert.match(html, /img\[alt="Meta"\]\{--logo-h:21px\}/);
  assert.match(html, /img\[alt="NAVER"\]\{--logo-h:20px\}/);
  assert.match(html, /\.media-brand-lockup img\{width:26px;height:26px[^}]*background:transparent[^}]*mix-blend-mode:normal/);
  assert.match(html, /@media\(max-width:640px\)\{[\s\S]*?\.media-logo>img\{height:18px\}[\s\S]*?\.media-brand-lockup img\{width:18px;height:18px\}/);
  assert.match(html, /media-logo:has\(img\[alt="KT TOWNBOARD"\]\)\{grid-column:span 2\}/);
});

test('Meta landing reuses the homepage media marquee and exact first-party logo assets', () => {
  const mediaSection = html.match(/<section class="snap-section" id="media"[\s\S]*?<\/section>/)?.[0] || '';
  assert.equal((mediaSection.match(/class="media-marquee-loop"/g) || []).length, 2);
  assert.equal((mediaSection.match(/class="media-marquee-cell"/g) || []).length, 16);
  assert.equal((mediaSection.match(/class="media-marquee-lockup"/g) || []).length, 4);
  for (const asset of ['meta.svg', 'google.svg', 'tiktok.svg', 'naver.png', 'kakao.svg', 'toss-user-cutout-v1.png', 'youtube.svg', 'linkedin.svg']) {
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
  for (const illustration of ['benefit-continuity-live1-v1.png', 'benefit-data-live1-v1.png', 'benefit-invoice-live1-v1.png']) {
    assert.ok(html.includes(`/lp/meta/assets/${illustration}`), `missing production-safe benefit illustration path ${illustration}`);
  }
  assert.doesNotMatch(html, /광고계정과 결제 방식만 바꾸고/);
  assert.match(html, /\.benefit-icon\{[^}]*background:transparent[^}]*box-shadow:none/);
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

test('Meta landing uses one unified reference-style media connection card system', () => {
  const benefitSection = html.match(/<section class="snap-section section-soft media-unified" id="media-benefits"[\s\S]*?<\/section>/)?.[0] || '';
  assert.equal((benefitSection.match(/class="media-connection-card"/g) || []).length, 20);
  assert.equal((benefitSection.match(/class="media-request-button"/g) || []).length, 20);
  assert.equal((benefitSection.match(/>신청 리스트 추가<\/button>/g) || []).length, 20);
  assert.equal((benefitSection.match(/class="channel-benefit-card"/g) || []).length, 0);
  assert.equal((benefitSection.match(/class="media-logo(?: has-wordmark)?"/g) || []).length, 0);
  for (const copy of ['주요 매체 대행사 인보이스 계정 혜택', 'Google Ads 인보이스로 변경 가능', 'Meta 인보이스 계정 발급', 'TikTok 인보이스로 변경 가능', 'NAVER 간단 승인으로 이용가능', 'Kakao 간단 승인으로 이용가능', 'Toss Ads 간단 승인으로 이용 가능', 'X(구 Twitter) 신규계정 발급', 'LinkedIn 신규계정 발급', 'Unity Ads 연결 가능']) {
    assert.ok(benefitSection.includes(copy), `missing benefit copy ${copy}`);
  }
  assert.doesNotMatch(benefitSection, /APPSILON 취급 광고 매체/);
  assert.doesNotMatch(benefitSection, /취급 매체 전체는 로고 슬라이더로/);
  assert.doesNotMatch(benefitSection, /channel-points|공식 파트너 계정 기반 운영|월 단위 세금계산서 정산/);
  assert.match(html, /#media,#case\{display:none\}/);
  assert.match(html, /\.media-marquee-shell\.media-marquee-transparent\{[^}]*width:100vw[^}]*background:transparent[^}]*box-shadow:none/);
  assert.match(html, /\.media-connection-card\{[^}]*grid-template-columns:124px minmax\(0,1fr\) 116px/);
  assert.match(html, /\.media-connection-logo img\{[^}]*height:28px[^}]*background:transparent[^}]*mix-blend-mode:normal/);
  assert.match(html, /\.media-unified \.section-head\{margin-bottom:8px\}/);
  assert.match(html, /@media\(max-width:760px\)[\s\S]*?\.media-connection-card\{[^}]*grid-template-columns:78px minmax\(0,1fr\) 88px/);
  assert.doesNotMatch(benefitSection, /ANONYMIZED CASE|₩500,800,030|5\.96%/);
});

test('Meta landing persists requested media budgets and carries them into the lead', () => {
  assert.match(html, /id="media-request-dialog"/);
  assert.match(html, /name="monthlyBudget"[^>]*type="number"[^>]*min="1"/);
  assert.match(html, /id="media-selection-bar"[^>]*hidden/);
  assert.match(html, /sessionStorage\.setItem\(storageKey/);
  assert.match(html, /monthlyBudgetManwon/);
  assert.match(html, /window\.getMediaSelections=selectionArray/);
  assert.match(html, /window\.clearMediaSelections/);
  assert.match(html, /class="media-selection-submit" href="#apply"/);
});

test('Meta landing releases the top navigation and closes with the APPSILON logo', () => {
  assert.match(html, /\.nav\{position:relative;top:auto;background:#fff;backdrop-filter:none\}/);
  assert.match(html, /class="footer-corporation-logo" src="\.\.\/\.\.\/logos\/appsilon\.png"/);
  assert.match(html, /body\{padding-bottom:0\}/);
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
  const suppliedToss = await readFile(new URL('../logos/toss-user-cutout-v1.png', import.meta.url));
  assert.deepEqual(suppliedToss.subarray(0, 8), pngSignature, 'invalid user-supplied Toss PNG');
  assert.equal(suppliedToss[25], 6, 'user-supplied Toss logo must retain RGBA transparency');
});

test('BillyJo-style benefit cutouts are valid transparent PNG files', async () => {
  const assets = ['benefit-continuity-live1-v1', 'benefit-data-live1-v1', 'benefit-invoice-live1-v1', 'payment-card-live1-v1', 'payment-invoice-live1-v1', 'payment-operations-live1-v1'];
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (const asset of assets) {
    const file = await readFile(new URL(`../lp/meta/assets/${asset}.png`, import.meta.url));
    assert.deepEqual(file.subarray(0, 8), pngSignature, `invalid PNG signature for ${asset}`);
    assert.equal(file[25], 6, `missing RGBA color type for ${asset}`);
  }
});

test('Credit-card network logos are valid SVG files', async () => {
  for (const asset of ['mastercard', 'unionpay']) {
    const file = await readFile(new URL(`../logos/${asset}.svg`, import.meta.url), 'utf8');
    assert.match(file, /<svg\b/);
    assert.ok(file.length > 300, `unexpectedly small SVG for ${asset}`);
  }
});

test('Meta landing keeps section headlines compact on mobile', () => {
  assert.match(html, /h1\{font-size:clamp\(40px,3\.5vw,48px\)\}\.hero-line\{display:block;white-space:nowrap\}/);
  assert.match(html, /@media \(max-width:640px\)\{\.snap-section h2\{font-size:25px\}\}/);
  assert.match(html, /@media \(max-width:360px\)\{\.snap-section h2\{font-size:22px\}\}/);
});
