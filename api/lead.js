// ============================================================
// Vercel Serverless Function: POST /api/lead
// 역할:
//   1) 폼 데이터 검증
//   2) 제한업종 키워드 자동 분류
//   3) Supabase에 리드 저장
//   4) Resend로 영업팀 알림 / 광고주 자동 회신 메일 발송
//   5) (선택) Meta Conversions API 서버사이드 전송
//
// 환경변수 (Vercel Dashboard > Settings > Environment Variables):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY
//   SALES_NOTIFY_EMAIL              ← 영업팀 알림 받을 이메일
//   FROM_EMAIL                       ← 발신 도메인 (예: noreply@official-ads.kr)
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
          <tr><td style="padding:8px 0;color:#6b7280;width:120px">담당자</td><td style="padding:8px 0;font-weight:600">${data.name}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">연락처</td><td style="padding:8px 0;font-weight:600">${data.phone}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">이메일</td><td style="padding:8px 0;font-weight:600"><a href="mailto:${data.email}" style="color:#1652a5">${data.email}</a></td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">광고비</td><td style="padding:8px 0;font-weight:800;color:#1652a5">${budgetLabel(data.budget)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">업종</td><td style="padding:8px 0">${data.industry || '-'}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">희망 서비스</td><td style="padding:8px 0">${data.service_type || '-'}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">결제 방식</td><td style="padding:8px 0">${data.payment || '-'}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">애로사항</td><td style="padding:8px 0">${data.issue || '-'}</td></tr>
        </table>
        <div style="margin-top:16px;padding:14px;background:#f3f4f6;border-radius:8px">
          <div style="font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:700">광고 대상 URL</div>
          <div style="font-size:13px;line-height:1.6">${(data.urls || []).map(u => `<div>• ${u}</div>`).join('') || '-'}</div>
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

  try {
    const body = req.body || {};

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

    // 3) Supabase에 저장
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
      service_type:       (body.serviceType || '').slice(0, 100),
      payment:            (body.payment || '').slice(0, 100),
      services:           Array.isArray(body.services) ? body.services : [],
      issue:              (body.issue || '').slice(0, 200),
      notes:              (body.notes || '').slice(0, 2000),
      source:             (body.source || 'direct').slice(0, 500),
      utm:                (body.utm || '').slice(0, 500),
      submitted_at:       new Date(body.submittedAt || Date.now()).toISOString(),
    };

    const { data: inserted, error: dbError } = await supabase
      .from('leads')
      .insert(insertPayload)
      .select()
      .single();

    if (dbError) {
      console.error('Supabase insert failed:', dbError);
      return res.status(500).json({
        error: 'database error',
        debug: { message: dbError.message, code: dbError.code, hint: dbError.hint, details: dbError.details }
      });
    }

    // 4) 이메일 발송 (제한업종 여부에 따라 분기)
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
      } else {
        // 정상 리드 → 고객 + 영업팀 동시 발송 (병렬 처리로 속도 개선)
        await Promise.allSettled([
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
      }
    } catch (mailErr) {
      console.error('Email send failed:', mailErr);
      // 메일 실패해도 DB 저장은 유지 — 응답은 성공으로
    }

    // 5) (선택) Meta Conversions API 서버사이드 전송 — 정상 리드만
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

    return res.status(200).json({
      success: true,
      id: inserted.id,
      restricted: isRestricted,
    });

  } catch (err) {
    console.error('Lead submission failed:', err);
    return res.status(500).json({
      error: 'internal server error',
      debug: { message: err.message, name: err.name, stack: err.stack?.split('\n').slice(0, 5).join(' | ') }
    });
  }
}
