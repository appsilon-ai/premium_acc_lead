// ============================================================
// Vercel Serverless Function: POST /api/lead
// 역할:
//   1) 폼 데이터 검증
//   2) 제한업종 키워드 자동 분류
//   3) Marketing Studio를 주 작업판으로 저장
//   4) Supabase·Resend를 유실 방지 백업으로 유지
//   5) (선택) Meta Conversions API 서버사이드 전송
//
// 환경변수 (Vercel Dashboard > Settings > Environment Variables):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY
//   SALES_NOTIFY_EMAIL              ← 영업팀 알림 받을 이메일
//   FROM_EMAIL                       ← 발신 도메인 (예: noreply@official-ads.kr)
//   ALERT_NOTIFY_EMAIL       (선택)  ← DB 저장 실패 장애 알림 수신 주소(운영 담당), 쉼표로 복수 지정 가능
//                                       미설정 시 장애 알림 메일 미발송 (로그만).
//                                       영업팀(SALES_NOTIFY_EMAIL)으로는 폴백하지 않는다.
//   META_PIXEL_ID            (선택)
//   META_CAPI_ACCESS_TOKEN   (선택)
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import crypto from 'node:crypto';

// ── 제한 업종 키워드 (Wix Velo 로직 그대로 이전) ─────────────
const RESTRICTED_KEYWORDS = [
  // 도박·베팅
  'casino', 'bet', 'betting', 'gamble', 'gambling', 'poker', 'slot', 'lotto', 'lottery', '토토', '카지노',
  // 성인
  'adult', 'porn', 'xxx', 'sex', '19+', '성인', '야동',
  // 데이팅/조건만남
  'dating', 'tinder', 'sugardaddy', '조건만남', '소개팅앱',
  // 대부/사채/소액결제
  'loan', 'cashadvance', 'payday', '대부', '사채', '소액결제', '현금화',
  // 모조품
  'replica', 'counterfeit', '짝퉁',
  // 다단계
  'mlm', 'pyramid', '다단계', '네트워크마케팅',
  // 가상자산·코인 펌프
  'crypto-pump', 'pumpcoin', '코인리딩', '리딩방',
  // 의약품 직판
  'rx-online', 'pharma-direct',
];

// ── Marketing Studio 적재 ────────────────────────────────────
// 주 작업판 인입 웹훅(POST /api/leads/ingest, Bearer 인증)으로 리드 JSON 전송.
async function sendToMarketingStudio(data) {
  const url = process.env.MARKETING_STUDIO_LEAD_URL; // 예: https://studio.appsilon.kr/api/leads/ingest
  if (!url) {
    throw new Error('MARKETING_STUDIO_LEAD_URL not set');
  }
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.MARKETING_STUDIO_LEAD_TOKEN) {
    headers.Authorization = `Bearer ${process.env.MARKETING_STUDIO_LEAD_TOKEN}`;
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`marketing studio ingest failed ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json().catch(() => ({}));
  if (j.ok !== true || !j.id) {
    throw new Error('marketing studio ingest returned no lead id');
  }
  console.log('Marketing studio lead saved:', j.id);
  return j;
}

// Supabase + Resend 클라이언트 초기화 (cold start 비용 절감 위해 함수 외부에서 생성)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
const resend = new Resend(process.env.RESEND_API_KEY);

// CORS 헤더 — 모든 도메인 허용. 보안 강화 시 origin 화이트리스트로 제한 가능.
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// SHA-256 해시 (Meta CAPI용 사용자 정보 익명화)
function sha256(str) {
  return crypto.createHash('sha256').update(String(str || '').toLowerCase().trim()).digest('hex');
}

// 예산 라벨 매핑 (이메일 본문용)
function budgetLabel(b) {
  const map = {
    'under': '월 1,000만 원 미만',
    '1k-5k': '월 1,000만 ~ 5,000만 원',
    '5k-1e': '월 5,000만 ~ 1억 원',
    'over1e': '월 1억 원 이상',
  };
  return map[b] || `${b} 만원`;
}

// 정상 리드 알림 메일 HTML
function buildSalesAlertEmail(data, isHighPriority) {
  const priorityBadge = isHighPriority
    ? '<span style="background:#dc2626;color:#fff;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.04em">⚡ HIGH PRIORITY</span>'
    : '<span style="background:#3b82f6;color:#fff;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700">STANDARD</span>';
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Pretendard',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#1652a5,#0d2c5e);color:#fff;padding:24px">
        <div style="font-size:13px;opacity:.8;letter-spacing:.1em;text-transform:uppercase">신규 광고주 리드</div>
        <h1 style="margin:8px 0 0;font-size:22px;font-weight:800">${data.company}</h1>
        <div style="margin-top:10px">${priorityBadge}</div>
      </div>
      <div style="padding:24px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px 0;color:#6b7280;width:120px">회사명</td><td style="padding:8px 0;font-weight:800;color:#1652a5;font-size:15px">${data.company}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">담당자</td><td style="padding:8px 0;font-weight:600">${data.name}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">연락처</td><td style="padding:8px 0;font-weight:600">${data.phone}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">이메일</td><td style="padding:8px 0;font-weight:600"><a href="mailto:${data.email}" style="color:#1652a5">${data.email}</a></td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">광고비</td><td style="padding:8px 0;font-weight:800;color:#1652a5">${budgetLabel(data.budget)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">업종</td><td style="padding:8px 0">${data.industry || '-'}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">필요한 서비스 유형</td><td style="padding:8px 0">${Array.isArray(data.service_type) && data.service_type.length > 0 ? data.service_type.map(s => `<span style="display:inline-block;background:#eef3ff;color:#1652a5;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;margin:2px 4px 2px 0">${s}</span>`).join('') : (data.service_type || '-')}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">희망 매체</td><td style="padding:8px 0">${Array.isArray(data.services) && data.services.length > 0 ? data.services.map(s => `<span style="display:inline-block;background:#eef3ff;color:#1652a5;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;margin:2px 4px 2px 0">${s}</span>`).join('') : '-'}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">결제 방식</td><td style="padding:8px 0">${Array.isArray(data.payment) && data.payment.length > 0 ? data.payment.map(p => `<span style="display:inline-block;background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;margin:2px 4px 2px 0">${p}</span>`).join('') : (data.payment || '-')}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">애로사항</td><td style="padding:8px 0">${data.issue || '-'}</td></tr>
        </table>
        <div style="margin-top:16px;padding:14px;background:#f3f4f6;border-radius:8px">
          <div style="font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:700">광고 대상 URL (${(data.urls || []).length}개)</div>
          <div style="font-size:13px;line-height:1.6">${(data.urls || []).map(u => `<div>• <a href="${u}" style="color:#1652a5;text-decoration:none" target="_blank">${u}</a></div>`).join('') || '-'}</div>
        </div>
        ${data.notes ? `<div style="margin-top:16px;padding:14px;background:#fff5f5;border-left:3px solid #f59e0b;border-radius:6px"><div style="font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:700">자유 메모</div><div style="font-size:13px;line-height:1.6;white-space:pre-wrap">${data.notes}</div></div>` : ''}
        <div style="margin-top:20px;padding:14px;background:#eef2ff;border-radius:8px;font-size:12px;color:#374151">
          <b>유입 경로</b>: ${data.source || 'direct'}<br>
          <b>UTM</b>: ${data.utm || '(none)'}<br>
          <b>제출 시각</b>: ${new Date(data.submitted_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
        </div>
        <div style="margin-top:24px;text-align:center">
          <div style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#1652a5,#0d2c5e);color:#fff;border-radius:10px;font-weight:700;font-size:14px">
            ⏰ 24시간 내 1차 컨택 필수
          </div>
        </div>
      </div>
    </div>
  `;
}

// 고객 확인 메일 HTML — 정상 리드 제출 시 광고주에게 발송
function buildCustomerConfirmationEmail(data) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Pretendard',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff">
      <div style="background:linear-gradient(135deg,#1652a5,#0d2c5e);color:#fff;padding:28px 24px;border-radius:12px 12px 0 0">
        <div style="font-size:12px;opacity:.85;letter-spacing:.1em;text-transform:uppercase">신청 접수 완료</div>
        <h1 style="margin:8px 0 0;font-size:24px;font-weight:800;letter-spacing:-.02em">무료 광고비 진단 신청이 정상 접수되었습니다 ✓</h1>
      </div>
      <div style="padding:28px 24px;background:#fff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px">
        <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 20px">
          안녕하세요, <b>${data.name}</b> 님.<br>
          <b>${data.company}</b> 광고비 진단 신청 감사합니다.
        </p>

        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:18px;margin:20px 0">
          <div style="font-size:13px;font-weight:700;color:#0369a1;margin-bottom:10px">📋 접수 내역</div>
          <table style="width:100%;font-size:13.5px;line-height:1.6;color:#1e3a8a">
            <tr><td style="padding:4px 0;color:#475569;width:90px">회사</td><td style="font-weight:600">${data.company}</td></tr>
            <tr><td style="padding:4px 0;color:#475569">담당자</td><td style="font-weight:600">${data.name}</td></tr>
            <tr><td style="padding:4px 0;color:#475569">월 광고비</td><td style="font-weight:600">${budgetLabel(data.budget)}</td></tr>
            ${data.industry ? `<tr><td style="padding:4px 0;color:#475569">업종</td><td style="font-weight:600">${data.industry}</td></tr>` : ''}
            ${data.service_type ? `<tr><td style="padding:4px 0;color:#475569">희망 서비스</td><td style="font-weight:600">${data.service_type}</td></tr>` : ''}
          </table>
        </div>

        <div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:18px;margin:20px 0">
          <div style="font-size:13px;font-weight:700;color:#a16207;margin-bottom:8px">⏰ 다음 안내</div>
          <p style="font-size:13.5px;line-height:1.7;color:#713f12;margin:0">
            <b>평일 24시간 이내</b> 전담 매니저가 입력하신 연락처(${data.phone})로 직접 연락드립니다.<br>
            진단 리포트는 사전 미팅(Zoom 또는 대면) 후 맞춤 작성하여 전달드립니다.
          </p>
        </div>

        <div style="margin-top:24px;padding-top:20px;border-top:1px dashed #e5e7eb">
          <div style="font-size:12px;color:#6b7280;line-height:1.6">
            <b>📌 진단 리포트 포함 항목</b><br>
            • 연간 절감 가능액 계산<br>
            • 매체별 최적 보너스 크레딧 설계<br>
            • 동일 업종 익명 사례 (ROAS·CAC 포함)<br>
            • 전담 매니저 1:1 사전 미팅
          </div>
        </div>

        <p style="margin-top:24px;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6">
          본 메일은 발신 전용입니다. 문의는 담당자 연락 후 회신 부탁드립니다.<br>
          진단은 무료이며, 결과 검토 후 진행 여부는 광고주가 결정합니다.
        </p>
      </div>
    </div>
  `;
}

// 제한업종 자동 회신 메일 HTML
function buildRestrictedReplyEmail(data) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Pretendard',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;padding:32px 24px;color:#111">
      <h2 style="margin:0 0 16px;font-size:20px">안녕하세요, ${data.name} 님</h2>
      <p style="font-size:14.5px;line-height:1.7;color:#374151">
        무료 광고비 진단을 신청해 주셔서 감사합니다.<br>
        신청 내용을 검토한 결과, 요청하신 광고 도메인은
        <b>당사 정책상 지원이 어려운 업종</b>에 해당됩니다.
      </p>
      <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:10px;padding:16px;margin:20px 0">
        <div style="font-size:12px;font-weight:700;color:#a13838;margin-bottom:8px;letter-spacing:.04em">🚫 지원 불가 업종</div>
        <div style="font-size:13px;color:#7f1d1d;line-height:1.6">
          도박/베팅 · 성인 · 데이팅 · 대부/사채/소액결제<br>
          모조품 · 다단계 · 가상자산 · 일부 의약품
        </div>
      </div>
      <p style="font-size:13.5px;line-height:1.7;color:#374151">
        불편을 드려 죄송합니다.<br>
        다른 사업 분야로 광고 진행하실 때 다시 연락 주시면 정성껏 도와드리겠습니다.
      </p>
      <p style="margin-top:24px;font-size:13px;color:#6b7280">감사합니다.</p>
    </div>
  `;
}

// ── 장애 알림 ────────────────────────────────────────────────
// 주 작업판 또는 백업 DB 저장이 실패했을 때 관리자가 "즉시" 인지할 수 있게 알린다.
// 방문자에게 500을 띄워 제보를 기다리는 대신, 운영 담당에게 직접 메일로 알린다.
// 본문에 리드 원본 JSON을 그대로 담아 메일함 자체가 최후의 백업이 되게 한다.
// 반환값: 알림 메일 발송에 성공했으면 true (= 리드가 메일함에는 남았다는 뜻)
// fatal: true = 예기치 못한 예외로 방문자에게 500을 반환한 경우 (리드가 유실됐을 수 있음)
async function sendDegradedAlert({ payload, storageError, failureLabel = '저장소', sinks, siteDomain, rawBody, fatal = false }) {
  const fromEmail = process.env.FROM_EMAIL || 'noreply@example.com';
  // 장애 알림 수신자 — 운영 담당만. ALERT_NOTIFY_EMAIL에 쉼표로 여러 명 지정 가능.
  // SALES_NOTIFY_EMAIL로 폴백하지 않는다: DB 장애는 영업팀 업무가 아니고,
  // 영업팀 리드 알림 메일은 장애 여부와 무관하게 평소 그대로 나간다.
  // 미설정이면 알림을 보낼 수 없고 로그로만 남는다.
  const alertRecipients = (process.env.ALERT_NOTIFY_EMAIL || '')
    .split(',')
    .map(a => a.trim())
    .filter(Boolean);

  if (alertRecipients.length === 0) {
    console.warn(`[${fatal ? 'LEAD_LOST' : 'LEAD_DEGRADED'}] ALERT_NOTIFY_EMAIL 미설정 — 장애 알림 메일을 보낼 수 없습니다.`);
    return false;
  }

  const okList  = Object.entries(sinks).filter(([, v]) => v).map(([k]) => k);
  const summary = okList.length ? okList.join(', ') : '없음 — 이 메일이 유일한 기록';
  // 복구용 원본 — 예외 경로에서는 검증 전 요청 body를 그대로 담는다.
  const raw     = JSON.stringify(rawBody ?? payload, null, 2);
  const errText = [
    storageError?.message,
    storageError?.code,
    storageError?.details,
    fatal ? storageError?.stack?.split('\n').slice(0, 6).join('\n') : null,
  ].filter(Boolean).join('\n');

  try {
    await resend.emails.send({
      from: `OFFICIAL ADS ALERT <${fromEmail}>`,
      to: alertRecipients,
      subject: fatal
        ? `🚨 [장애] ${siteDomain} — 리드 접수 처리 실패(500) - ${payload.company}`
        : `🚨 [장애] ${siteDomain} — 리드 ${failureLabel} 저장 실패 - ${payload.company} (${payload.name})`,
      // 예외 경로에서는 email이 비어 있을 수 있다 — 빈 값을 넘기면 Resend가 거절한다.
      ...(payload.email ? { replyTo: payload.email } : {}),
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:24px">
          <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px;border-radius:6px">
            <h2 style="margin:0 0 8px;font-size:17px;color:#991b1b">${fatal
              ? '처리 중 예외 발생 — 방문자에게 500이 표시되었습니다'
              : `${failureLabel} 저장 실패 — 리드는 백업 경로에 접수되었습니다`}</h2>
            <p style="margin:0;font-size:13px;color:#7f1d1d">${fatal
              ? '리드가 어디에도 저장되지 않았을 가능성이 높습니다. <b>아래 원본으로 직접 연락하세요.</b> 방문자가 재제출했을 수도 있으니 중복을 확인해 주세요.'
              : '방문자에게는 정상 접수 화면이 표시되었습니다. 아래 리드를 <b>주 작업판에 수동 반영하고 저장 경로를 점검해 주세요.</b>'}</p>
          </div>
          <table style="width:100%;margin-top:20px;font-size:14px;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#6b7280;width:110px">발생 도메인</td><td style="padding:6px 0"><b>${siteDomain}</b> <span style="color:#9ca3af">(Vercel)</span></td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">회사</td><td style="padding:6px 0"><b>${payload.company}</b></td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">담당자</td><td style="padding:6px 0">${payload.name}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">이메일</td><td style="padding:6px 0">${payload.email}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">연락처</td><td style="padding:6px 0">${payload.phone}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">우선순위</td><td style="padding:6px 0">${payload.lead_priority}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">저장 성공처</td><td style="padding:6px 0">${summary}</td></tr>
          </table>
          <p style="margin:20px 0 6px;font-size:13px;color:#6b7280">${fatal ? '예외' : `${failureLabel} 에러`}</p>
          <pre style="background:#1f2937;color:#f9fafb;padding:12px;border-radius:6px;font-size:12px;white-space:pre-wrap;word-break:break-all">${errText || 'unknown'}</pre>
          <p style="margin:20px 0 6px;font-size:13px;color:#6b7280">${fatal ? '요청 원본 (검증 전 raw body)' : '리드 원본 (복구용)'}</p>
          <pre style="background:#f3f4f6;padding:12px;border-radius:6px;font-size:12px;white-space:pre-wrap;word-break:break-all">${raw}</pre>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error(`[${fatal ? 'LEAD_LOST' : 'LEAD_DEGRADED'}] 장애 알림 메일 발송 실패:`, e);
    return false;
  }
}

// ── 메인 핸들러 ────────────────────────────────────────────
export default async function handler(req, res) {
  setCorsHeaders(res);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // body와 siteDomain은 try 밖에 둔다 — 예외로 500을 반환할 때 catch에서도
  // 리드 원본과 발생 도메인을 알림 메일에 담아야 하기 때문이다.
  const body = req.body || {};

  // 장애 알림 제목에 쓸 "요청이 들어온 도메인" — 어느 랜딩에서 터졌는지 즉시 구분한다.
  // Vercel은 커스텀 도메인을 x-forwarded-host로 넘긴다. 헤더가 없을 때만 기본값 사용.
  const siteDomain = (req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0].trim() || process.env.SITE_DOMAIN || 'partneragency.net';

  try {
    // 1) 필수 필드 검증
    const required = ['name', 'company', 'email', 'phone', 'budget'];
    for (const f of required) {
      if (!body[f] || typeof body[f] !== 'string' || body[f].trim().length === 0) {
        return res.status(400).json({ error: `missing field: ${f}` });
      }
    }
    if (!/^\S+@\S+\.\S+$/.test(body.email)) {
      return res.status(400).json({ error: 'invalid email' });
    }
    const phone = String(body.phone).replace(/\D/g, '');
    if (phone.length < 10) {
      return res.status(400).json({ error: 'invalid phone' });
    }

    // 2) URL 정규화 + 제한업종 자동 분류
    const rawUrls = Array.isArray(body.urls) && body.urls.length > 0
      ? body.urls
      : (body.url ? String(body.url).split(/\s*\|\s*/) : []);
    const urls = rawUrls.map(u => String(u).trim().toLowerCase()).filter(Boolean).slice(0, 5);

    const restrictedMatches = [];
    for (const u of urls) {
      for (const kw of RESTRICTED_KEYWORDS) {
        if (u.includes(kw.toLowerCase())) {
          restrictedMatches.push({ url: u, keyword: kw });
        }
      }
    }
    const isRestricted = restrictedMatches.length > 0;
    const isHighPriority = !isRestricted && Number(body.budget) >= 1000;
    const leadPriority = isRestricted ? 'REJECTED' : (isHighPriority ? 'HIGH' : 'STANDARD');
    const submissionKey = typeof body.submissionKey === 'string' && /^[a-zA-Z0-9:_-]{16,128}$/.test(body.submissionKey)
      ? body.submissionKey
      : crypto.randomUUID();

    // 3) 공통 저장 레코드 구성
    const insertPayload = {
      name:               body.name.trim().slice(0, 100),
      company:            body.company.trim().slice(0, 200),
      email:              body.email.trim().toLowerCase(),
      phone:              phone,
      budget:             body.budget,
      urls:               urls,
      url:                urls.join(' | '),
      restricted:         isRestricted,
      restricted_reasons: restrictedMatches,
      lead_priority:      leadPriority,
      industry:           (body.industry || '').slice(0, 100),
      // Q8/Q9 복수선택 → 배열을 ", "로 join해서 저장 (Supabase 컬럼이 text)
      service_type:       (Array.isArray(body.serviceType) ? body.serviceType.join(', ') : (body.serviceType || '')).slice(0, 500),
      payment:            (Array.isArray(body.payment)     ? body.payment.join(', ')     : (body.payment || '')).slice(0, 500),
      services:           Array.isArray(body.services) ? body.services : [],
      issue:              (body.issue || '').slice(0, 200),
      notes:              (body.notes || '').slice(0, 2000),
      source:             (body.source || 'direct').slice(0, 500),
      utm:                (body.utm || '').slice(0, 500),
      submitted_at:       new Date(body.submittedAt || Date.now()).toISOString(),
    };

    const sinks = { supabase: false, studio: false, email: false };
    let studioLeadId = null;
    let studioError = null;

    // 4) Marketing Studio 적재 — 주 작업판. 같은 키의 재전송이면 여기서 종료해
    // Supabase·이메일·CAPI까지 중복 실행되는 것을 막는다.
    try {
      const studioResult = await sendToMarketingStudio({
        ...insertPayload,
        submission_key: submissionKey,
        serviceType: Array.isArray(body.serviceType) ? body.serviceType : (body.serviceType ? [body.serviceType] : []),
        payment:     Array.isArray(body.payment)     ? body.payment     : (body.payment     ? [body.payment]     : []),
      });
      studioLeadId = studioResult.id ?? null;
      sinks.studio = true;
      if (studioResult.duplicate === true) {
        return res.status(200).json({
          success: true,
          id: studioLeadId,
          restricted: isRestricted,
          degraded: false,
          duplicate: true,
        });
      }
    } catch (msErr) {
      studioError = msErr;
      console.error('Marketing studio save failed:', msErr);
      // 주 작업판 실패 시에도 Supabase·이메일 백업은 끝까지 수행한다.
    }

    // 5) Supabase 백업 저장. Studio가 죽어도 여기서 중단하지 않는다.
    let inserted = null;
    let dbError  = null;
    try {
      const { data, error } = await supabase
        .from('leads')
        .insert(insertPayload)
        .select()
        .single();
      if (error) throw error;
      inserted = data;
    } catch (e) {
      dbError = e;
      // [LEAD_DEGRADED] 태그로 남긴다 — Vercel Log Drain / 알림 규칙을 이 문자열에 걸 수 있다.
      console.error('[LEAD_DEGRADED] Supabase insert failed:', JSON.stringify({
        message: e.message, code: e.code, hint: e.hint, details: e.details,
        company: insertPayload.company, email: insertPayload.email,
      }));
    }

    sinks.supabase = !!inserted;

    // 6) 이메일 발송 (제한업종 여부에 따라 분기)
    const fromEmail = process.env.FROM_EMAIL || 'noreply@example.com';
    const salesEmail = process.env.SALES_NOTIFY_EMAIL || 'sales@example.com';
    try {
      if (isRestricted) {
        // 제한업종 → 광고주에게만 자동 거절 회신 (영업팀 알림 X)
        await resend.emails.send({
          from: `OFFICIAL ADS <${fromEmail}>`,
          to: insertPayload.email,
          subject: `[안내] ${insertPayload.company} 님의 무료 진단 신청 검토 결과`,
          html: buildRestrictedReplyEmail(insertPayload),
        });
        sinks.email = true;
      } else {
        // 정상 리드 → 고객 + 영업팀 동시 발송 (병렬 처리로 속도 개선)
        const mailResults = await Promise.allSettled([
          // ① 광고주에게 접수 확인 메일
          resend.emails.send({
            from: `OFFICIAL ADS <${fromEmail}>`,
            to: insertPayload.email,
            subject: `[OFFICIAL ADS] ${insertPayload.company} 님 무료 진단 신청이 접수되었습니다`,
            html: buildCustomerConfirmationEmail(insertPayload),
          }),
          // ② 영업팀에게 신규 리드 알림
          resend.emails.send({
            from: `OFFICIAL ADS <${fromEmail}>`,
            to: salesEmail,
            subject: `🎯 신규 리드 - ${insertPayload.company} (${leadPriority})`,
            replyTo: insertPayload.email,
            html: buildSalesAlertEmail(insertPayload, isHighPriority),
          }),
        ]);
        // 개별 실패도 지금까지는 조용히 묻혔다 — 로그로 드러낸다.
        mailResults.forEach((r, i) => {
          if (r.status === 'rejected') {
            console.error(`Email send rejected [${i === 0 ? 'customer' : 'sales'}]:`, r.reason);
          }
        });
        sinks.email = mailResults.some(r => r.status === 'fulfilled');
      }
    } catch (mailErr) {
      console.error('Email send failed:', mailErr);
      // 메일 실패해도 DB 저장은 유지 — 응답은 성공으로
    }

    // 7) 주 작업판 또는 백업 DB 저장 실패 시 관리자 알림.
    //    다른 적재처 결과가 모두 확정된 뒤에 보내야 성공/실패 요약을 함께 담을 수 있다.
    let alerted = false;
    const storageError = studioError || dbError;
    if (storageError) {
      try {
        alerted = await sendDegradedAlert({
          payload: insertPayload,
          storageError,
          failureLabel: studioError ? 'Marketing Studio 주 작업판' : 'Supabase 백업 DB',
          sinks,
          siteDomain,
        });
      } catch (alertErr) {
        console.error('[LEAD_DEGRADED] 알림 발송 실패:', alertErr);
      }
    }

    // 8) (선택) Meta Conversions API 서버사이드 전송 — 정상 리드만
    if (!isRestricted && process.env.META_PIXEL_ID && process.env.META_CAPI_ACCESS_TOKEN) {
      try {
        const valueMap = { 'under1k': 10, '1k-5k': 50, '5k-1e': 200, 'over1e': 1000 };
        const leadValue = valueMap[body.budget] || 50;
        const userIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.headers['x-real-ip'] || '';
        const userAgent = req.headers['user-agent'] || '';

        await fetch(`https://graph.facebook.com/v18.0/${process.env.META_PIXEL_ID}/events?access_token=${process.env.META_CAPI_ACCESS_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: [{
              event_name: 'Lead',
              event_time: Math.floor(Date.now() / 1000),
              action_source: 'website',
              event_source_url: body.source || '',
              user_data: {
                em: [sha256(insertPayload.email)],
                ph: [sha256(phone)],
                client_ip_address: userIp,
                client_user_agent: userAgent,
              },
              custom_data: {
                value: leadValue,
                currency: 'KRW',
                content_category: body.budget,
                content_name: insertPayload.industry || 'unknown',
              },
            }],
          }),
        });
      } catch (capiErr) {
        console.error('Meta CAPI failed:', capiErr);
      }
    }

    // 9) 최종 응답 — 리드가 어딘가에는 남았는지로 판단한다.
    //    전부 실패했다면 조용히 성공을 반환하면 안 된다. 그 경우엔 기존처럼 500을 띄워
    //    방문자가 직접 연락할 수 있게 하는 것이 마지막 안전장치다.
    const savedAnywhere = sinks.supabase || sinks.studio || sinks.email || alerted;

    if (!savedAnywhere) {
      console.error('[LEAD_LOST] 모든 적재 경로 실패(알림 메일 포함) — 리드 유실:', JSON.stringify(insertPayload));
      return res.status(500).json({
        error: 'database error',
        debug: dbError
          ? { message: dbError.message, code: dbError.code, hint: dbError.hint, details: dbError.details }
          : undefined,
      });
    }

    // CTA 카피 실험의 Lead는 브라우저 클릭이 아니라 백엔드 접수 성공 시점에만 기록한다.
    if (
      body.ctaExperiment === 'partneragency_cta_copy_v1' &&
      ['a', 'b', 'c', 'd'].includes(body.ctaVariant) &&
      typeof body.ctaLeadEventId === 'string' && body.ctaLeadEventId.length <= 220 &&
      typeof body.ctaVisitorId === 'string' && body.ctaVisitorId.length <= 120 &&
      typeof body.ctaSessionId === 'string' && body.ctaSessionId.length <= 120
    ) {
      try {
        const { error: ctaError } = await supabase.from('cta_experiment_events').upsert({
          event_id: body.ctaLeadEventId,
          experiment_key: body.ctaExperiment,
          event_type: 'lead',
          variant_key: body.ctaVariant,
          visitor_id: body.ctaVisitorId,
          session_id: body.ctaSessionId,
          location: 'lead_form',
          page_path: '/',
          lead_id: inserted?.id ?? null,
        }, { onConflict: 'event_id', ignoreDuplicates: true });
        if (ctaError) console.error('[CTA_EXPERIMENT] lead insert failed:', ctaError.message);
      } catch (ctaError) {
        console.error('[CTA_EXPERIMENT] lead insert crashed:', ctaError);
      }
    }

    if (dbError) {
      console.warn('[LEAD_DEGRADED] DB 없이 접수 완료:', JSON.stringify({ ...sinks, alerted }));
    }

    return res.status(200).json({
      success: true,
      id: studioLeadId ?? inserted?.id ?? null,
      restricted: isRestricted,
      degraded: !sinks.studio || !inserted,
      duplicate: false,
    });

  } catch (err) {
    // 여기로 오면 방문자에게 500이 표시된다 = 리드가 어디에도 안 남았을 가능성이 크다.
    // 이 알림 메일이 유일한 기록이 될 수 있으므로 반드시 시도한다.
    console.error('[LEAD_LOST] Lead submission failed:', err);
    try {
      await sendDegradedAlert({
        payload: {
          company:       body.company || '(알 수 없음)',
          name:          body.name    || '(알 수 없음)',
          email:         body.email   || '',
          phone:         body.phone   || '',
          lead_priority: '(판정 전)',
        },
        rawBody: body,
        storageError: err,
        sinks: {},
        siteDomain,
        fatal: true,
      });
    } catch (alertErr) {
      console.error('[LEAD_LOST] 크래시 알림 메일 발송 실패:', alertErr);
    }
    return res.status(500).json({
      error: 'internal server error',
      debug: { message: err.message, name: err.name, stack: err.stack?.split('\n').slice(0, 5).join(' | ') }
    });
  }
}
