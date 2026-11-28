import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const leadApi = await readFile(new URL('../api/lead.js', import.meta.url), 'utf8');
const gtmConfig = JSON.parse(await readFile(new URL('../gtm-import.json', import.meta.url), 'utf8'));

test('2027 second-close campaign is visible, shareable, and leads to the application form', () => {
  const assetPath = '/lp/meta/assets/social/og-2027-second-close.jpg';
  assert.match(html, /property="og:title" content="2027 매체비 절감 \+ 보너스프로그램 2차 마감"/);
  assert.equal((html.match(new RegExp(assetPath.replaceAll('/', '\\\/'), 'g')) || []).length, 4);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /property="og:image:height" content="630"/);
  assert.match(html, /id="campaign-2027-second-close"/);
  assert.match(html, /id="cta-campaign-banner"[^>]*href="#apply"[^>]*data-cta-experiment/);
  assert.match(html, /<img src="\/lp\/meta\/assets\/social\/og-2027-second-close\.jpg" width="1200" height="630"[^>]*alt="[^"]+"/);
  assert.match(html, /\.root-campaign-link img\{[^}]*aspect-ratio:40\/21/);
  assert.match(html, /@media \(max-width:700px\)[\s\S]*?\.root-campaign-copy\{/);
  assert.match(html, /@media \(prefers-reduced-motion:reduce\)[\s\S]*?\.root-campaign-link\{transition:none\}/);
});

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
  assert.match(html, /Meta, Google 등<br \/>해외매체 광고계정 혜택/);
  assert.match(html, /해외매체 광고비 카드결제 = <span class="loss-red">돈새는 구멍<\/span>/);
  assert.doesNotMatch(html, /해외매체 원화\(KRW\) 카드결제 = 돈먹는하마|해외매체 카드결제 = <span class="loss-red">돈 새는 구멍<\/span>/);
  assert.doesNotMatch(html, /Meta 광고비, 결제 방식만 바꿔도|해외 광고매체 월 광고비/);
  assert.match(html, /\.meta-benefits\{padding:46px 0 92px/);
  assert.match(html, /\.receipt h4\{[\s\S]*?font-size:17px/);
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

test('lead conversion uses one dataLayer event with Meta browser/server deduplication fields', async () => {
  const trackBody = html.match(/function track\(eventName, params\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.equal((trackBody.match(/dataLayer\.push/g) || []).length, 1);
  assert.doesNotMatch(trackBody, /window\.gtag|window\.fbq/);
  assert.match(html, /function metaBrowserIdentifiers\(\)/);
  assert.match(html, /return 'lead-' \+ Date\.now\(\)\.toString\(36\) \+ '-' \+ Math\.random\(\)\.toString\(36\)\.slice\(2, 12\)/);
  assert.match(html, /metaEventId: metaEventId/);
  assert.match(html, /fbp: metaIds\.fbp/);
  assert.match(html, /fbc: metaIds\.fbc/);
  assert.match(html, /event_id: data\.metaEventId/);
  assert.match(leadApi, /graph\.facebook\.com\/v24\.0/);
  assert.match(leadApi, /const eventId = `lead:\$\{submissionKey\}`/);
  assert.match(leadApi, /event_id: eventId/);
  assert.match(leadApi, /metaUserData\.fbp = fbp/);
  assert.match(leadApi, /metaUserData\.fbc = fbc/);
  assert.match(leadApi, /if \(!capiResponse\.ok \|\| Number\(capiResult\.events_received \|\| 0\) < 1\)/);
  const gtm = JSON.stringify(gtmConfig);
  assert.match(gtm, /DLV - event_id/);
  assert.match(gtm, /eventID: \{\{DLV - event_id\}\}/);
  assert.ok(leadApi.indexOf('const savedAnywhere') < leadApi.indexOf('graph.facebook.com/v24.0'), 'CAPI must run only after a lead is persisted');
  assert.match(leadApi, /\(!j\.id && j\.duplicate !== true\)/);
  assert.match(html, /try \{ return decodeURIComponent\(raw\); \} catch \(error\) \{ return raw; \}/);
});

test('GTM import uses unique entity IDs and resolves every user-variable reference', () => {
  const version = gtmConfig.containerVersion;
  for (const [kind, idKey] of [['tag', 'tagId'], ['trigger', 'triggerId'], ['variable', 'variableId']]) {
    const ids = version[kind].map((entity) => entity[idKey]);
    assert.equal(new Set(ids).size, ids.length, `${kind} IDs must be unique`);
  }

  const definedNames = new Set([
    ...version.variable.map((variable) => variable.name),
    ...version.builtInVariable.map((variable) => variable.name),
  ]);
  const tagSource = JSON.stringify(version.tag);
  for (const match of tagSource.matchAll(/\{\{([^}]+)\}\}/g)) {
    assert.ok(definedNames.has(match[1]), `undefined GTM variable reference: ${match[1]}`);
  }
});

test('lead submissions use Studio as the idempotent workboard without Monday writes', () => {
  assert.match(html, /form\.dataset\.submissionKey \|\| ctaId\(\)/);
  assert.match(html, /submissionKey: submissionKey/);
  assert.match(leadApi, /submission_key: submissionKey/);
  assert.match(leadApi, /const sinks = \{ supabase: false, studio: false, email: false \}/);
  assert.match(leadApi, /if \(studioResult\.duplicate === true\)/);
  assert.doesNotMatch(leadApi, /api\.monday\.com|MONDAY_API_TOKEN|createMondayItem/);
});
