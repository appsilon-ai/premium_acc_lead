import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../lp/meta/index.html', import.meta.url), 'utf8');

test('Meta landing keeps one clear proposition and one semantic H1', () => {
  assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.match(html, /Meta 광고비,[\s\S]*카드 결제로 10~15% 새고 있습니다/);
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

test('Meta landing uses one-step section navigation', () => {
  assert.equal((html.match(/class="snap-section/g) || []).length, 7);
  assert.match(html, /scroll-snap-type:y mandatory/);
  assert.match(html, /scroll-snap-stop:always/);
  assert.match(html, /activeIndex\+direction/);
  assert.match(html, /wheelLock=true/);
});

test('Meta landing keeps a visual credit-card receipt example', () => {
  assert.match(html, /data-receipt-example/);
  assert.match(html, /신용카드 청구내역/);
  assert.match(html, /3792-20\*\*-\*\*\*\*-\*\*021/);
  assert.match(html, /최종 청구 금액/);
});

test('Meta landing renders the complete media list with image assets', () => {
  const mediaSection = html.match(/<section class="snap-section" id="media"[\s\S]*?<\/section>/)?.[0] || '';
  assert.equal((mediaSection.match(/class="media-logo"/g) || []).length, 20);
  assert.equal((mediaSection.match(/<img /g) || []).length, 20);
  assert.equal((mediaSection.match(/class="media-benefit"/g) || []).length, 20);
  assert.match(mediaSection, /보너스 약 6%/);
  assert.match(mediaSection, /보너스 약 5%/);
  assert.match(mediaSection, /보너스 4~7%/);
  assert.match(mediaSection, /보너스 <b>약 14%/);
  assert.match(mediaSection, /할인 <b>최대 14%/);
  assert.doesNotMatch(mediaSection, /Meta Badged Marketing Partner/);
  assert.doesNotMatch(mediaSection, /appsilon\.png|APPSILON|앱실론코퍼레이션/);
  assert.doesNotMatch(html, /id="operator"/);
  assert.doesNotMatch(mediaSection, /text-logo/);
  const normalizedAssets = ['meta', 'google', 'tiktok', 'naver', 'kakao', 'toss-ads', 'x', 'linkedin', 'pinterest', 'snapchat', 'youtube', 'line', 'amazon', 'reddit', 'apple', 'yahoo', 'kt-townboard', 'focus-media', 'unity-ads', 'mediameet'];
  for (const asset of normalizedAssets) {
    assert.ok(mediaSection.includes(`../../logos/media-cutout-v1/${asset}.png`), `missing normalized asset ${asset}`);
  }
  assert.doesNotMatch(mediaSection, /class="(?:compact|tall)"|line\.jpg/);
  assert.match(html, /\.media-logo-grid\{[^}]*grid-template-columns:repeat\(4,1fr\)/);
  assert.match(html, /@media\(max-width:640px\)\{[\s\S]*?\.media-logo-grid\{grid-template-columns:repeat\(3,1fr\)/);
  assert.match(html, /\.media-logo img\{[^}]*width:auto[^}]*height:26px[^}]*background:transparent[^}]*mix-blend-mode:normal/);
  assert.match(html, /media-logo:has\(img\[alt="KT TOWNBOARD"\]\)\{grid-column:span 2\}/);
});

test('Normalized media cutouts are valid transparent PNG files', async () => {
  const assets = ['meta', 'google', 'tiktok', 'naver', 'kakao', 'toss-ads', 'x', 'linkedin', 'pinterest', 'snapchat', 'youtube', 'line', 'amazon', 'reddit', 'apple', 'yahoo', 'kt-townboard', 'focus-media', 'unity-ads', 'mediameet'];
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (const asset of assets) {
    const file = await readFile(new URL(`../logos/media-cutout-v1/${asset}.png`, import.meta.url));
    assert.deepEqual(file.subarray(0, 8), pngSignature, `invalid PNG signature for ${asset}`);
    assert.equal(file[25], 6, `missing RGBA color type for ${asset}`);
  }
});

test('Meta landing keeps section headlines compact on mobile', () => {
  assert.match(html, /@media \(max-width:640px\)\{\.snap-section h2\{font-size:25px\}\}/);
  assert.match(html, /@media \(max-width:360px\)\{\.snap-section h2\{font-size:22px\}\}/);
});
