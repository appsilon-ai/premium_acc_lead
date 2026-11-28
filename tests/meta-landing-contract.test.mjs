import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../lp/meta/index.html', import.meta.url), 'utf8');

test('Meta landing keeps one clear proposition and one semantic H1', () => {
  assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.equal((html.match(/class="hero-line"/g) || []).length, 2);
  assert.match(html, /class="hero-rate">5% <i>\+<\/i> 3%/);
  assert.match(html, /해외 결제 수수료는 줄이고[\s\S]*보너스 크레딧은 더 받으세요/);
  assert.doesNotMatch(html, /logo-lockup appsilon/);
  assert.doesNotMatch(html, /내 지원금 확인|내 돈 찾으러 가기/);
});

test('Meta landing reuses verified first-party operator and media assets', () => {
  for (const asset of ['../../logos/appsilon.png', '../../logos/meta.svg', '../../logos/google.svg', '../../logos/media-cutout-v1/tiktok.png']) {
    assert.ok(html.includes(asset), `missing asset ${asset}`);
  }
  for (const copy of ['앱실론코퍼레이션(주)', '810-81-01685']) {
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
  assert.match(html, /rel="icon"[^>]+sizes="16x16"[^>]+favicon-16\.png/);
  assert.match(html, /rel="icon"[^>]+sizes="32x32"[^>]+favicon-32\.png/);
  assert.match(html, /rel="apple-touch-icon"[^>]+apple-touch-icon\.png/);
});

test('Meta landing publishes complete Open Graph, Twitter, and app-icon metadata', async () => {
  assert.match(html, /property="og:type" content="website"/);
  assert.match(html, /property="og:locale" content="ko_KR"/);
  assert.match(html, /property="og:site_name" content="APPSILON OFFICIAL ADS"/);
  assert.match(html, /property="og:title" content="공식대행사 계정으로 광고비 절감 \+ 매체별 보너스 \| APPSILON"/);
  assert.match(html, /property="og:description" content="Toss Ads 월 최대 17%, NAVER·Kakao 최대 15%, 당근 최대 12%, TikTok 최대 9%의 적용 가능 혜택을 무료로 진단하세요\."/);
  assert.match(html, /property="og:image" content="https:\/\/partneragency\.net\/lp\/meta\/assets\/social\/og-2027-second-close\.jpg\?v=20261128"/);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /property="og:image:height" content="630"/);
  assert.match(html, /property="og:image:alt" content="2027 매체비 절감과 보너스프로그램 2차 마감 안내"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /name="twitter:image" content="https:\/\/partneragency\.net\/lp\/meta\/assets\/social\/og-2027-second-close\.jpg\?v=20261128"/);
  assert.match(html, /rel="manifest" href="\/lp\/meta\/assets\/site\.webmanifest"/);

  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (const asset of ['favicon-16', 'favicon-32', 'favicon-192', 'favicon-512', 'apple-touch-icon']) {
    const file = await readFile(new URL(`../lp/meta/assets/${asset}.png`, import.meta.url));
    assert.deepEqual(file.subarray(0, 8), pngSignature, `invalid favicon PNG ${asset}`);
    assert.ok(file.length > 500, `unexpectedly small favicon PNG ${asset}`);
  }

  for (const asset of ['og-global-spend', 'og-invoice-transition', 'og-media-hub']) {
    const file = await readFile(new URL(`../lp/meta/assets/social/${asset}.jpg`, import.meta.url));
    assert.deepEqual(file.subarray(0, 2), Buffer.from([0xff, 0xd8]), `invalid OG JPEG ${asset}`);
    assert.ok(file.length > 80_000, `unexpectedly small OG JPEG ${asset}`);
  }

  const campaign = await readFile(new URL('../lp/meta/assets/social/og-2027-second-close.jpg', import.meta.url));
  assert.deepEqual(campaign.subarray(0, 2), Buffer.from([0xff, 0xd8]), 'invalid campaign JPEG');
  assert.ok(campaign.length > 100_000, 'unexpectedly small campaign JPEG');
});

test('Meta landing applies the 2027 second-close campaign as a responsive CTA banner', () => {
  const banner = html.match(/<section class="campaign-banner-section"[\s\S]*?<\/section>/)?.[0] || '';
  assert.match(banner, /id="campaign-2027-second-close"/);
  assert.match(banner, /id="cta-campaign-banner" data-cta-position="middle" href="#apply"/);
  assert.match(banner, /src="\/lp\/meta\/assets\/social\/og-2027-second-close\.jpg"/);
  assert.match(banner, /width="1200" height="630" loading="lazy" decoding="async"/);
  assert.match(banner, /2027 매체비 절감 및 보너스프로그램 2차 마감/);
  assert.match(html, /\.campaign-banner-link img\{[^}]*aspect-ratio:1200\/630/);
  assert.match(html, /@media\(max-width:640px\)\{\.campaign-banner-section/);
  assert.match(html, /@media\(prefers-reduced-motion:reduce\)\{\.campaign-banner-link/);
});

test('Social previews use flat editorial source art instead of generated 3D backgrounds', async () => {
  const sources = ['og-global-spend', 'og-invoice-transition', 'og-media-hub'];
  for (const asset of sources) {
    const svg = await readFile(new URL(`../lp/meta/assets/social/source/${asset}.svg`, import.meta.url), 'utf8');
    assert.match(svg, /<svg\b[^>]*width="1200"[^>]*height="630"/);
    assert.doesNotMatch(svg, /\.webp|linearGradient|radialGradient|filter=|feDropShadow/i, `${asset} contains generated or glossy effects`);
    assert.match(svg, /appsilon-(?:symbol|white-wordmark-v1)\.png/);
    assert.ok((svg.match(/media-cutout-v1\//g) || []).length >= 3, `${asset} needs at least three prominent media logos`);
    assert.doesNotMatch(svg, /font-size="(?:1[0-9]|2[0-1])"/, `${asset} contains copy too small for a shared-card thumbnail`);
    assert.ok((svg.match(/<text\b/g) || []).length <= 4, `${asset} contains too many text elements for a shared-card thumbnail`);
  }
  const mediaSource = await readFile(new URL('../lp/meta/assets/social/source/og-media-hub.svg', import.meta.url), 'utf8');
  for (const asset of ['meta.png', 'google.png', 'tiktok.png']) {
    assert.ok(mediaSource.includes(`media-cutout-v1/${asset}`), `missing first-party media logo ${asset}`);
  }
  assert.match(mediaSource, /media-cutout-v1\/danggeun\.png/, 'missing supplied Danggeun logo');

  const primarySource = await readFile(new URL('../lp/meta/assets/social/source/og-global-spend.svg', import.meta.url), 'utf8');
  for (const asset of ['meta.png', 'google.png', 'naver.png', 'kakao.png', 'tiktok.png', 'toss-ads.png', 'danggeun.png']) {
    assert.ok(primarySource.includes(`media-cutout-v1/${asset}`), `primary OG missing media logo ${asset}`);
  }
  assert.ok((primarySource.match(/media-cutout-v1\//g) || []).length >= 16, 'primary OG needs a tiled multi-media field');
  assert.doesNotMatch(primarySource, /<rect[^>]+fill="#ffffff"/, 'primary OG media logos must float without white card backgrounds');
  assert.match(primarySource, /공식대행사 계정/);
  assert.match(primarySource, /광고비 절감 \+ 매체별 보너스/);
  assert.match(primarySource, /Toss Ads 월 최대/);
  assert.match(primarySource, />17%<\/tspan>/);
  assert.match(primarySource, /NAVER·Kakao 15% · 당근 12% · TikTok 9%/);
  assert.doesNotMatch(primarySource, /월 최대 17% 할인/);
});

test('Partner invoice payment stability lists prepaid and conditional postpaid options', () => {
  assert.match(html, /결제 안정성<\/span><div class="bad">한도 초과·결제 거절 위험<\/div><div class="good">충전식<br>조건부 후불<\/div>/);
});

test('Meta landing uses natural scrolling, calm reveal motion, and a right-edge vertical progress line', () => {
  assert.equal((html.match(/class="snap-section/g) || []).length, 8);
  assert.match(html, /class="page-progress"/);
  assert.match(html, /\.page-progress\{position:fixed;[^}]*inset:0 0 0 auto;[^}]*width:3px;[^}]*height:100dvh/);
  assert.match(html, /\.page-progress>span\{[^}]*transform:scaleY\(0\);[^}]*transform-origin:top/);
  assert.match(html, /pageProgress\.style\.transform=`scaleY\(\$\{progress\}\)`/);
  assert.doesNotMatch(html, /pageProgress\.style\.width/);
  assert.match(html, /scroll-snap-type:none/);
  assert.match(html, /revealObserver/);
  assert.match(html, /updatePageProgress/);
  assert.doesNotMatch(html, /class="section-rail"/);
  assert.doesNotMatch(html, /addEventListener\('wheel'/);
  assert.doesNotMatch(html, /wheelLock=true/);
});

test('Meta landing uses the reference-aligned pitch and a working savings calculator', () => {
  assert.match(html, /class="hero-savings-card"/);
  const heroSection = html.match(/<header class="snap-section hero"[\s\S]*?<\/header>/)?.[0] || '';
  assert.match(heroSection, /class="hero-media-marquee media-marquee"/);
  assert.equal((heroSection.match(/class="media-marquee-loop"/g) || []).length, 2);
  assert.equal((heroSection.match(/class="media-marquee-cell"/g) || []).length, 16);
  for (const asset of ['meta.svg', 'google.svg', 'tiktok.svg', 'naver.png', 'kakao.svg', 'toss-user-cutout-v1.png', 'youtube.svg', 'linkedin.svg']) {
    assert.ok(heroSection.includes(`../../logos/${asset}`), `missing hero marquee asset ${asset}`);
  }
  assert.doesNotMatch(heroSection, /hero-media-strip/);
  assert.match(html, /해외매체 광고비 절감/);
  assert.match(html, /파트너 계정 혜택/);
  assert.match(html, /id="budget-range"[^>]*min="10000000"[^>]*max="500000000"/);
  assert.match(html, /해외 결제 수수료 절감 \(연\)/);
  assert.match(html, /보너스 크레딧 추가 \(연\)/);
  assert.match(html, /class="hero-card-cta" href="#apply"/);
  assert.match(html, /\.hero-grid\{grid-template-columns:minmax\(0,1\.02fr\) minmax\(420px,\.82fr\)/);
  assert.match(html, /\.hero-savings-card\{[^}]*border-radius:25px[^}]*background:#fff/);
  assert.doesNotMatch(html, /<video/);
  assert.doesNotMatch(html, /operations-hero-v1\.(?:mp4|jpg)/);
  assert.doesNotMatch(html, /hero-video-frame|visual-rate-card|cardFloat|visualGlow/);
  assert.match(html, /class="payment-flow"/);
  assert.equal((html.match(/class="flow-node"/g) || []).length, 3);
  for (const asset of ['payment-card-live1-v1.png', 'payment-invoice-live1-v1.png', 'payment-operations-live1-v1.png']) {
    assert.ok(html.includes(`/lp/meta/assets/${asset}`), `missing payment-flow cutout ${asset}`);
  }
  assert.match(html, /@keyframes flowMove/);
  for (const cta of ['cta-hero-calculator', 'cta-hero-structure', 'cta-sticky-diagnosis']) {
    assert.match(html, new RegExp(`id="${cta}"`));
  }
  assert.equal((html.match(/data-cta-position=/g) || []).length, 4);
  assert.match(heroSection, /class="hero-appsilon-logo" src="\.\.\/\.\.\/logos\/appsilon-white-wordmark-v1\.png" alt="APPSILON"/);
  assert.doesNotMatch(heroSection, /Meta 공식 파트너 광고계정 무료 진단|class="eyebrow"/);
  for (const label of ['3,000만 원', '5,000만 원', '1억 원', '3억 원']) assert.ok(heroSection.includes(label), `missing quick budget label ${label}`);
  assert.match(html, /\.hero-calculator-tabs span\{font-size:14px\}/);
});

test('Meta landing keeps a visual credit-card receipt example', () => {
  assert.match(html, /data-receipt-example/);
  assert.match(html, /Meta, Google 해외매체 광고비 결제내역/);
  assert.match(html, /해외매체 광고비 카드결제 = <em>돈 새는 구멍<\/em>/);
  assert.match(html, /최종 청구 금액/);
  assert.match(html, /해외 광고비 카드 이용 명세/);
  assert.doesNotMatch(html, /MONTHLY CARD STATEMENT/);
  assert.doesNotMatch(html, /청구 기준일/);
  assert.doesNotMatch(html, /이용기간 2026\.11\.01/);
  assert.doesNotMatch(html, /카드 번호|3792-20/);
  for (const network of ['visa.svg', 'mastercard.svg', 'unionpay.svg', 'amex.svg']) {
    assert.ok(html.includes(`../../logos/${network}`), `missing card network ${network}`);
  }
  assert.match(html, /\.receipt-stage \.receipt\{[^}]*-webkit-mask:radial-gradient/);
  assert.match(html, /파트너 계정 대비 월 추가 비용/);
  assert.match(html, /월 ₩5,693,800/);
  assert.match(html, /연간 ₩68,325,600/);
  assert.match(html, /\.receipt-network-logos img,\.receipt-network-logos img\[alt="American Express"\]\{[^}]*height:20px[^}]*background:transparent[^}]*mix-blend-mode:normal/);
  assert.equal((html.match(/data-countup="/g) || []).length, 5);
  assert.match(html, /환전 수수료 약 1\.75%/);
  assert.match(html, /data-countup="1750000" data-prefix="\+₩"/);
  assert.match(html, /data-countup="105693800" data-prefix="₩"/);
  assert.match(html, /function animateCountup\(element\)/);
  assert.match(html, /element\.classList\.add\('is-counting'\)/);
  assert.match(html, /const duration=1600/);
  assert.match(html, /index\*420/);
  assert.match(html, /if\(reducedMotion\)\{renderCountupValue\(element,target\)/);
  assert.match(html, /\.receipt-network-logos\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(html, /\.js \.receipt-row \[data-countup\]\.is-counting\{opacity:1;transform:none\}/);
  assert.match(html, /\.js \.receipt-row \[data-countup\]\{opacity:0;transform:translateY\(16px\)/);
  assert.match(html, /\.receipt-row\.total\{padding:14px 16px\}/);
});

test('Meta landing renders the complete media list with image assets', () => {
  const mediaSection = html.match(/<section class="snap-section" id="media"[\s\S]*?<\/section>/)?.[0] || '';
  assert.equal((mediaSection.match(/class="media-logo(?: has-wordmark)?"/g) || []).length, 21);
  assert.equal((mediaSection.match(/class="media-benefit"/g) || []).length, 21);
  assert.match(mediaSection, /보너스 4~7%/);
  assert.match(mediaSection, /보너스 <b>최대 15%/);
  assert.match(mediaSection, /할인 <b>최대 14%/);
  for (const latestRate of [
    '절감 <b>5%</b> · 보너스 <b>3%</b>',
    '절감 <b>5%</b> · 보너스 <b>2%</b>',
    '절감 <b>5%</b> · 리워드 <b>최대 9%</b>',
    '리베이트 <b>월 최대 17%</b>',
    '보너스 <b>최대 12%</b>'
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
  const normalizedAssets = ['meta', 'google', 'tiktok', 'naver', 'kakao', 'danggeun', 'x', 'pinterest', 'youtube', 'line', 'amazon', 'yahoo', 'kt-townboard', 'focus-media', 'unity-ads', 'mediameet'];
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
  assert.equal((benefitSection.match(/class="media-connection-card"/g) || []).length, 21);
  assert.equal((benefitSection.match(/class="media-request-button"/g) || []).length, 21);
  assert.equal((benefitSection.match(/>선택<\/button>/g) || []).length, 21);
  assert.equal((benefitSection.match(/class="channel-benefit-card"/g) || []).length, 0);
  assert.equal((benefitSection.match(/class="media-logo(?: has-wordmark)?"/g) || []).length, 0);
  for (const copy of ['주요 매체 대행사 인보이스 계정 혜택', '인보이스 계정 발급', '인보이스로 변경 가능', '간단 승인으로 이용 가능', '신규계정 발급', '연결 가능']) {
    assert.ok(benefitSection.includes(copy), `missing benefit copy ${copy}`);
  }
  for (const duplicatedCopy of ['Meta 인보이스', 'Google Ads 인보이스', 'TikTok 인보이스', 'NAVER 간단', 'Kakao 간단', 'Toss Ads 간단', 'X(구 Twitter) 신규', 'LinkedIn 신규', 'Unity Ads 연결']) {
    assert.ok(!benefitSection.includes(duplicatedCopy), `duplicated media name remains: ${duplicatedCopy}`);
  }
  assert.doesNotMatch(benefitSection, /APPSILON 취급 광고 매체/);
  assert.doesNotMatch(benefitSection, /취급 매체 전체는 로고 슬라이더로/);
  assert.doesNotMatch(benefitSection, /channel-points|공식 파트너 계정 기반 운영|월 단위 세금계산서 정산/);
  assert.match(html, /#media,#case\{display:none\}/);
  assert.match(html, /\.media-marquee-shell\.media-marquee-transparent\{[^}]*width:100vw[^}]*background:transparent[^}]*box-shadow:none/);
  assert.match(html, /\.media-connection-card\{[^}]*grid-template-columns:124px minmax\(0,1fr\) 116px/);
  assert.match(html, /\.media-connection-logo img\{[^}]*height:28px[^}]*background:transparent[^}]*mix-blend-mode:normal/);
  assert.match(html, /\.media-connection-copy span\{font-size:13px;font-weight:400/);
  assert.match(html, /\.media-unified \.media-connection-copy span\{white-space:normal;text-overflow:clip\}/);
  assert.match(html, /\.media-request-button\{[^}]*background:linear-gradient\(180deg,#1f6ed0 0%,#1459b4 100%\)[^}]*box-shadow:0 4px 0 #0b3f8e/);
  assert.match(html, /\.media-request-button:hover,\.media-request-button:focus-visible\{[^}]*background:linear-gradient\(180deg,#195fb8 0%,#0d468f 100%\)[^}]*color:#fff/);
  assert.match(html, /button\.textContent=added\?'선택됨':'선택'/);
  assert.match(html, /\.media-unified \.section-head\{margin-bottom:8px\}/);
  assert.match(html, /@media\(max-width:760px\)[\s\S]*?\.media-connection-card\{[^}]*grid-template-columns:78px minmax\(0,1fr\) 88px/);
  assert.doesNotMatch(benefitSection, /ANONYMIZED CASE|₩500,800,030|5\.96%/);
  for (const latestRate of [
    '리워드 최대 9%',
    '매체 보너스 최대 15%',
    '매체 리베이트 월 최대 17%',
    '매체 보너스 최대 12%'
  ]) assert.ok(benefitSection.includes(latestRate), `missing current catalog rate ${latestRate}`);
  for (const staleRate of ['리워드 8%', '매체 보너스 약 14%', '매체 리베이트 최대 15%', '적용 조건 상담 후 안내']) {
    assert.ok(!benefitSection.includes(staleRate), `stale catalog rate remains: ${staleRate}`);
  }
});

test('Meta landing keeps detailed TikTok savings and reward math consistent', () => {
  const caseSection = html.match(/<section class="snap-section section-soft" id="case"[\s\S]*?<\/section>/)?.[0] || '';
  assert.match(caseSection, /<small>매체 리워드<\/small><strong>최대 9%<\/strong>/);
  assert.match(caseSection, /<span>합산 예상 혜택<\/span><strong>최대 14%<\/strong>/);
  assert.doesNotMatch(caseSection, /<small>매체 리워드<\/small><strong>8%<\/strong>|최대 13%/);
});

test('Meta landing groups the media catalog into swipeable mobile tabs', () => {
  for (const tab of ['popular', 'overseas', 'domestic']) {
    assert.match(html, new RegExp(`data-media-tab="${tab}"`));
  }
  for (const media of ['Meta', 'Google Ads', 'TikTok', 'NAVER', 'Kakao', 'Toss Ads', '당근', 'X (구 Twitter)']) {
    const escaped = media.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(html, new RegExp(`data-popular="1"[\\s\\S]*?data-media="${escaped}"`));
  }
  assert.match(html, /const pageSize=mobile\?5:visibleCards\.length/);
  assert.match(html, /catalogViewport\.addEventListener\('touchstart'/);
  assert.match(html, /catalogViewport\.addEventListener\('touchend'/);
  assert.match(html, /class="media-catalog-arrow media-catalog-prev"/);
  assert.match(html, /class="media-catalog-arrow media-catalog-next"/);
  assert.match(html, /@media\(max-width:760px\)[\s\S]*?\.media-catalog-page\{[^}]*grid-template-rows:repeat\(5,auto\)/);
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

test('Meta landing removes the top navigation and closes with the APPSILON logo', () => {
  assert.doesNotMatch(html, /<nav\b|cta-header-diagnosis/);
  assert.match(html, /:root\{--nav-h:0px/);
  assert.match(html, /class="footer-corporation-logo" src="\.\.\/\.\.\/logos\/appsilon\.png"/);
  assert.match(html, /body\{padding-bottom:0\}/);
  assert.doesNotMatch(html, /통신판매신고번호 2021-서울강남-04074/);
  assert.match(html, /id="contact-mail-title">문의 메일 보내기/);
  for (const [subject, label] of [
    ['계정%20문의', '계정 문의'],
    ['비즈니스%20제휴', '비즈니스 제휴'],
    ['광고%20의뢰', '광고 의뢰'],
    ['기타%20문의', '기타 문의'],
  ]) {
    assert.match(html, new RegExp(`href="mailto:arin@appsilon\\.kr\\?subject=APPSILON%20${subject}">${label}</a>`));
  }
  assert.equal((html.match(/mailto:arin@appsilon\.kr\?subject=/g) || []).length, 4);
  assert.match(html, /\.contact-mail-options\{display:grid;grid-template-columns:repeat\(2,minmax\(128px,1fr\)\)/);
  assert.match(html, /문의 유형을 선택하면 메일 제목이 자동으로 입력됩니다\./);
});

test('Meta landing enlarges section labels and tightens the label-to-heading gap', () => {
  assert.match(html, /\.snap-section:not\(\.hero\)::before\{[^}]*top:22px[^}]*color:#0d2c5e[^}]*font-size:14px[^}]*line-height:1\.2/);
  assert.match(html, /\.apply::before\{color:#dbeafe!important\}/);
  assert.match(html, /\.receipt-stage::before\{color:#dbeafe!important\}/);
  assert.match(html, /\.snap-section h2\{margin:5px 0 13px/);
  assert.match(html, /@media\(max-width:640px\)[\s\S]*?\.snap-section:not\(\.hero\)::before\{top:15px;left:14px;font-size:12px\}/);
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
  assert.match(html, /\.hero-savings-total>strong\{color:#0a9b63!important;font-size:25px/);
  assert.match(html, /\.hero-savings-total>strong span\{color:inherit;font-size:inherit;font-weight:inherit;line-height:inherit;letter-spacing:inherit\}/);
  assert.match(html, /<strong>\+₩ <span id="annual-result">48,000,000<\/span><\/strong>/);
  assert.match(html, /class="bonus-good">\+₩3,000,000/);
  assert.match(html, /\.hero-partner-note \.bonus-good\{color:#0a9b63\}/);
  assert.match(html, /aria-label="예시 금액이며 실제 혜택을 보장하지 않습니다">예시</);
  assert.match(html, /aria-label="예상치이며 실제 혜택을 보장하지 않습니다">예상치</);
  assert.doesNotMatch(html, /월 ₩100,000,000 집행을 가정한 카드 명세 예시/);
  assert.doesNotMatch(html, /시뮬레이션 예시이며 수수료 절감액은 보수적 5% 기준/);
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
  const heroLogo = await readFile(new URL('../logos/appsilon-white-wordmark-v1.png', import.meta.url));
  assert.deepEqual(heroLogo.subarray(0, 8), pngSignature, 'invalid APPSILON hero logo PNG');
  assert.equal(heroLogo[25], 6, 'APPSILON hero logo must retain RGBA transparency');
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
