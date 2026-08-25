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

// ── Monday.com 보드 매핑 ─────────────────────────────────────
// Board: appsiloncorp.monday.com/boards/8598876525 (Meta_Wix_LEAD_250220_Zapier)
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID || '8598876525';
const MONDAY_GROUP_ID = process.env.MONDAY_GROUP_ID || 'topics'; // "신규" 그룹

// 신규 리드 기본 담당자 (Arin Cheong / arin@appsilon.kr)
// 변경하려면 Vercel 환경변수 MONDAY_DEFAULT_ASSIGNEE_ID 설정
const MONDAY_DEFAULT_ASSIGNEE_ID = process.env.MONDAY_DEFAULT_ASSIGNEE_ID || '46666227';

// Monday 컬럼 ID 매핑 (고정)
const MONDAY_COLUMNS = {
  name:        'text_mknczry2',      // 이름
  job:         'text_mknc998t',      // 직책
  email:       'email_mkncxg73',     // 업무용 이메일
  phone:       'text_mknczf57',      // 휴대폰 번호
  budget:      'text_mknfaycw',      // 직전 3개월 평균 광고비
  industry:    'text_mkncb8w6',      // 업종
  payment:     'dropdown_mkncsjs9',  // 현재 광고비 결제 방식
  services:    'dropdown_mkncnd7y',  // 희망 서비스 (복수 선택)
  issue:       'dropdown_mkncmm16',  // 광고 진행 중 애로사항
  notes:       'text_mknqtgpg',      // 그 외 궁금/지원 내용
  status:      'status',             // 진행 사항
  person:      'person',             // 담당자 (people 타입)
};

// 동적 컬럼 매핑 — 보드에 있는 컬럼을 title로 찾아 자동 매핑
// env var: 컬럼 ID 직접 지정 / 미지정 시 title로 lookup
const MONDAY_OPTIONAL_COLUMNS = {
  utm:         { env: 'MONDAY_COLUMN_UTM',         titles: ['UTM', 'utm', 'UTM 파라미터'] },
  urls:        { env: 'MONDAY_COLUMN_URLS',        titles: ['광고 대상 URL', '광고 URL', 'URL', 'urls'] },
  source:      { env: 'MONDAY_COLUMN_SOURCE',      titles: ['유입 경로', 'Source', 'source', '레퍼러'] },
  serviceType: { env: 'MONDAY_COLUMN_SERVICETYPE', titles: ['필요한 서비스 유형', '서비스 유형', 'Service Type', '필요 서비스'] },
};

// 보드 컬럼 캐시 (warm function 인스턴스 내 재사용)
let _mondayColumnsCache = null;
let _resolvedOptionalIds = null;

async function getMondayBoardColumns(token, boardId) {
  if (_mondayColumnsCache) return _mondayColumnsCache;
  const query = `query GetCols($id:[ID!]) { boards(ids:$id) { columns { id title type } } }`;
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { 'Authorization': token, 'Content-Type': 'application/json', 'API-Version': '2024-01' },
    body: JSON.stringify({ query, variables: { id: [String(boardId)] } }),
  });
  const data = await res.json();
  _mondayColumnsCache = (data?.data?.boards?.[0]?.columns) || [];
  return _mondayColumnsCache;
}

async function resolveOptionalColumns(token, boardId) {
  if (_resolvedOptionalIds) return _resolvedOptionalIds;
  const cols = await getMondayBoardColumns(token, boardId).catch(() => []);
  const resolved = {};
  for (const [key, cfg] of Object.entries(MONDAY_OPTIONAL_COLUMNS)) {
    // 1순위: 환경변수에 컬럼 ID 직접 설정
    const envVal = process.env[cfg.env];
    if (envVal) {
      // ID 패턴이면 그대로 사용 (type은 cols에서 lookup)
      const looksLikeId = /^([a-z]+_[a-z0-9]+|status|person|name)$/i.test(envVal);
      if (looksLikeId) {
        const colInfo = cols.find(c => c.id === envVal);
        resolved[key] = { id: envVal, type: colInfo?.type || 'text' };
        continue;
      }
      // env var에 title이 들어있으면 title로 lookup
      const byEnvTitle = cols.find(c => c.title === envVal);
      if (byEnvTitle) { resolved[key] = { id: byEnvTitle.id, type: byEnvTitle.type }; continue; }
    }
    // 2순위: 사전 정의된 title 목록으로 자동 매칭
    for (const t of cfg.titles) {
      const found = cols.find(c => c.title === t || c.title.toLowerCase() === t.toLowerCase());
      if (found) { resolved[key] = { id: found.id, type: found.type }; break; }
    }
  }
  _resolvedOptionalIds = resolved;
  console.log('[Monday] Optional columns resolved:', resolved);
  return resolved;
}

// 폼 값 → Monday dropdown 라벨 매핑
const MONDAY_SERVICES_MAP = {
  'Meta':                       '임대 - Meta (Facebook, IG)',
  'Google':                     '임대 - Google (Youtube)',
  'TikTok':                     '임대 - TikTok',
  'Kakao/NAVER':                '임대 - Kakao / NAVER',
  'Pinterest/Twitter':          '임대 - Pinterest / Twitter',
  '퍼포먼스 광고 대행':         '퍼포먼스 광고 대행',
  '글로벌 퍼포먼스 광고 대행':  '해외 퍼포먼스 광고 대행',
  '기타 제휴 문의':             '기타 제휴 문의',
};

const MONDAY_PAYMENT_MAP = {
  '카드 해외 결제':         '카드 해외 결제(수수료 4.8~7.8%)',
  '광고 대행사 협업 중':    '광고 대행사 협업 중',
  '대행사 계정 대대행':     '대행사 계정 대대행',
  '매체 직거래(Invoice)':   '매체 직거래(Invoice)',
};

// Monday Status 라벨 ID (status 컬럼)
//  5: "연락 필요", 9: "거절", 8: "미팅대기"
const MONDAY_STATUS_NEW_LEAD = '연락 필요';
const MONDAY_STATUS_REJECTED = '거절';

// Monday.com 아이템 생성 함수
async function createMondayItem(data) {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) {
    console.warn('MONDAY_API_TOKEN not set, skipping Monday integration');
    return null;
  }

  // 이름 / 직책 분리 (폼: "홍길동 / 마케팅 팀장")
  const nameJob = String(data.name || '').split('/').map(s => s.trim());
  const personName = nameJob[0] || data.name || '';
  const personJob = nameJob[1] || '';

  // 희망 서비스 매핑 (체크박스 복수 → Monday 라벨 복수)
  const mappedServices = (Array.isArray(data.services) ? data.services : [])
    .map(s => MONDAY_SERVICES_MAP[s])
    .filter(Boolean);

  // 결제 방식 — 배열/문자열 모두 허용 → 복수 라벨로 변환
  const paymentArr = Array.isArray(data.payment) ? data.payment : (data.payment ? [data.payment] : []);
  const mappedPayments = paymentArr.map(p => MONDAY_PAYMENT_MAP[p] || p).filter(Boolean);

  // 필요한 서비스 유형 — 배열/문자열 모두 허용
  const serviceTypeArr = Array.isArray(data.service_type) ? data.service_type
                       : Array.isArray(data.serviceType)  ? data.serviceType
                       : data.service_type ? [data.service_type]
                       : data.serviceType  ? [data.serviceType]
                       : [];

  // 선택 컬럼 ID 동적 resolve (보드에서 title로 자동 매칭, 컬럼 타입도 함께 반환)
  const optionalCols = await resolveOptionalColumns(token, MONDAY_BOARD_ID).catch(() => ({}));

  // notes 통합 — 전용 컬럼 있는 항목은 제외 (중복 방지)
  // ⭐ data.issue (광고 진행 중 애로사항) → notes 컬럼으로 라우팅 (별도 dropdown 사용 안 함)
  const extraInfo = [];
  if (serviceTypeArr.length > 0 && !optionalCols.serviceType) {
    extraInfo.push(`[필요한 서비스 유형]\n${serviceTypeArr.map(s => '• ' + s).join('\n')}`);
  }
  if (Array.isArray(data.urls) && data.urls.length > 0 && !optionalCols.urls) {
    extraInfo.push(`[광고 대상 URL ${data.urls.length}개]\n${data.urls.map(u => '• ' + u).join('\n')}`);
  }
  if (data.source && data.source !== 'direct' && !optionalCols.source) extraInfo.push(`[유입 경로]\n${data.source}`);
  if (data.utm && !optionalCols.utm) extraInfo.push(`[UTM]\n${data.utm}`);
  if (data.issue) extraInfo.push(`[광고 진행 중 애로사항]\n${data.issue}`);
  const combinedNotes = [data.notes, ...extraInfo].filter(Boolean).join('\n\n---\n\n');

  // Status 자동 분류
  const statusLabel = data.restricted ? MONDAY_STATUS_REJECTED : MONDAY_STATUS_NEW_LEAD;

  // Column values 구성
  const columnValues = {
    [MONDAY_COLUMNS.name]:     personName,
    [MONDAY_COLUMNS.job]:      personJob,
    [MONDAY_COLUMNS.email]:    { email: data.email, text: data.email },
    [MONDAY_COLUMNS.phone]:    data.phone,
    [MONDAY_COLUMNS.budget]:   budgetLabel(data.budget),
    [MONDAY_COLUMNS.industry]: data.industry || '',
    [MONDAY_COLUMNS.notes]:    combinedNotes,
    [MONDAY_COLUMNS.status]:   { label: statusLabel },
    [MONDAY_COLUMNS.person]:   {
      personsAndTeams: [{ id: Number(MONDAY_DEFAULT_ASSIGNEE_ID), kind: 'person' }]
    },
  };
  if (mappedPayments.length > 0) {
    // payment 컬럼이 dropdown 타입이라 복수 라벨 지원
    columnValues[MONDAY_COLUMNS.payment] = { labels: mappedPayments };
  }
  if (mappedServices.length > 0) {
    columnValues[MONDAY_COLUMNS.services] = { labels: mappedServices };
  }
  // ⛔ data.issue를 별도 dropdown 컬럼에 보내지 않음 (notes에 통합되어 라우팅됨)

  // ── 동적으로 resolve된 선택 컬럼 매핑 (column id + type 모두 사용) ──
  function setOptionalColumn(colInfo, value, isMulti) {
    if (!colInfo || value == null || value === '' || (Array.isArray(value) && value.length === 0)) return;
    const id = colInfo.id;
    const type = colInfo.type;
    if (isMulti && Array.isArray(value)) {
      if (type === 'dropdown') {
        columnValues[id] = { labels: value };
      } else {
        columnValues[id] = value.join(', ').slice(0, 2000);
      }
    } else {
      columnValues[id] = String(value).slice(0, 2000);
    }
  }
  setOptionalColumn(optionalCols.utm,         data.utm,                                          false);
  setOptionalColumn(optionalCols.urls,        Array.isArray(data.urls) ? data.urls.join(' | ') : data.urls, false);
  setOptionalColumn(optionalCols.source,      (data.source && data.source !== 'direct') ? data.source : null, false);
  setOptionalColumn(optionalCols.serviceType, serviceTypeArr,                                    true);

  const mutation = `
    mutation CreateItem($boardId: ID!, $groupId: String!, $itemName: String!, $columnValues: JSON!) {
      create_item(
        board_id: $boardId,
        group_id: $groupId,
        item_name: $itemName,
        column_values: $columnValues
      ) {
        id
      }
    }
  `;

  const variables = {
    boardId: String(MONDAY_BOARD_ID),
    groupId: MONDAY_GROUP_ID,
    itemName: data.company,
    columnValues: JSON.stringify(columnValues),
  };

  const response = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json',
      'API-Version': '2024-01',
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  const result = await response.json();
  if (result.errors) {
    console.error('Monday API errors:', JSON.stringify(result.errors));
    throw new Error('Monday create_item failed: ' + result.errors[0]?.message);
  }
  if (!result.data || !result.data.create_item) {
    console.error('Monday unexpected response:', JSON.stringify(result));
    throw new Error('Monday create_item returned no data');
  }

  console.log('Monday item created:', result.data.create_item.id);
  return result.data.create_item.id;
}

// ── Marketing Studio 적재 ────────────────────────────────────
// Monday(createMondayItem)와 **동일한 방식** — Supabase 저장 후 병렬 호출, 실패는 호출부에서 격리.
// marketing studio 의 인입 웹훅(POST /api/leads/ingest, Bearer 인증)으로 리드 JSON 전송.
async function sendToMarketingStudio(data) {
  const url = process.env.MARKETING_STUDIO_LEAD_URL; // 예: https://studio.appsilon.kr/api/leads/ingest
  if (!url) {
    console.warn('MARKETING_STUDIO_LEAD_URL not set, skipping marketing studio integration');
    return null;
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
  console.log('Marketing studio lead saved:', j.id);
  return j.id;
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
// Supabase 저장이 실패했을 때 관리자가 "즉시" 인지할 수 있게 알린다.
// 방문자에게 500을 띄워 제보를 기다리는 대신, 운영 담당에게 직접 메일로 알린다.
// 본문에 리드 원본 JSON을 그대로 담아 메일함 자체가 최후의 백업이 되게 한다.
// 반환값: 알림 메일 발송에 성공했으면 true (= 리드가 메일함에는 남았다는 뜻)
// fatal: true = 예기치 못한 예외로 방문자에게 500을 반환한 경우 (리드가 유실됐을 수 있음)
async function sendDegradedAlert({ payload, dbError, sinks, siteDomain, rawBody, fatal = false }) {
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
    dbError?.message,
    dbError?.code,
    dbError?.details,
    fatal ? dbError?.stack?.split('\n').slice(0, 6).join('\n') : null,
  ].filter(Boolean).join('\n');

  try {
    await resend.emails.send({
      from: `OFFICIAL ADS ALERT <${fromEmail}>`,
      to: alertRecipients,
      subject: fatal
        ? `🚨 [장애] ${siteDomain} — 리드 접수 처리 실패(500) - ${payload.company}`
        : `🚨 [장애] ${siteDomain} — 리드 DB 저장 실패 - ${payload.company} (${payload.name})`,
      // 예외 경로에서는 email이 비어 있을 수 있다 — 빈 값을 넘기면 Resend가 거절한다.
      ...(payload.email ? { replyTo: payload.email } : {}),
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:24px">
          <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px;border-radius:6px">
            <h2 style="margin:0 0 8px;font-size:17px;color:#991b1b">${fatal
              ? '처리 중 예외 발생 — 방문자에게 500이 표시되었습니다'
              : 'Supabase 저장 실패 — 리드는 접수되었습니다'}</h2>
            <p style="margin:0;font-size:13px;color:#7f1d1d">${fatal
              ? '리드가 어디에도 저장되지 않았을 가능성이 높습니다. <b>아래 원본으로 직접 연락하세요.</b> 방문자가 재제출했을 수도 있으니 중복을 확인해 주세요.'
              : '방문자에게는 정상 접수 화면이 표시되었습니다. 아래 리드를 <b>수동으로 DB에 옮겨주세요.</b>'}</p>
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
          <p style="margin:20px 0 6px;font-size:13px;color:#6b7280">${fatal ? '예외' : 'DB 에러'}</p>
          <pre style="background:#1f2937;color:#f9fafb;padding:12px;border-radius:6px;font-size:12px;white-space:pre-wrap;word-break:break-all">${errText || 'unknown'}</pre>
          <p style="margin:20px 0 6px;font-size:13px;color:#6b7280">${fatal ? '요청 원본 (검증 전 raw body)' : '리드 원본 (복구용 — 이 JSON을 leads 테이블에 그대로 insert)'}</p>
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

    // Supabase가 죽어도 여기서 중단하지 않는다 — Monday/Studio/메일로 리드를 살린다.
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

    // DB 저장 실패 시 insertPayload를 대체 레코드로 사용 (id만 없고 내용은 동일)
    const leadRecord = inserted || insertPayload;

    // 적재처별 성공 여부 — "하나라도" 성공해야 방문자에게 200을 준다.
    const sinks = { supabase: !!inserted, monday: false, studio: false, email: false };

    // 4) Monday.com 적재 (영업팀 작업판) — 이메일 발송과 병렬 처리 가능하지만,
    //    실패 시에도 DB 저장은 유지되어야 하므로 catch로 격리
    try {
      // Monday에는 배열 원본을 그대로 전달 (Supabase에는 join된 string으로 저장됨)
      const mondayData = {
        ...leadRecord,
        serviceType: Array.isArray(body.serviceType) ? body.serviceType : (body.serviceType ? [body.serviceType] : []),
        payment:     Array.isArray(body.payment)     ? body.payment     : (body.payment     ? [body.payment]     : []),
      };
      await createMondayItem(mondayData);
      sinks.monday = true;
    } catch (mondayErr) {
      console.error('Monday create_item failed:', mondayErr);
      // Monday 실패해도 응답은 success — 이메일은 별도로 발송
    }

    // 4.5) Marketing Studio 적재 (Monday와 동일 방식 — Supabase 저장 후 병렬, 실패 격리)
    try {
      await sendToMarketingStudio({
        ...leadRecord,
        serviceType: Array.isArray(body.serviceType) ? body.serviceType : (body.serviceType ? [body.serviceType] : []),
        payment:     Array.isArray(body.payment)     ? body.payment     : (body.payment     ? [body.payment]     : []),
      });
      sinks.studio = true;
    } catch (msErr) {
      console.error('Marketing studio save failed:', msErr);
      // marketing studio 실패해도 DB 저장·응답은 유지
    }

    // 5) 이메일 발송 (제한업종 여부에 따라 분기)
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

    // 6) DB 저장 실패 시 관리자 알림 — 방문자의 500 화면을 대체하는 "진짜" 알람.
    //    다른 적재처 결과가 모두 확정된 뒤에 보내야 성공/실패 요약을 함께 담을 수 있다.
    let alerted = false;
    if (dbError) {
      try {
        alerted = await sendDegradedAlert({ payload: insertPayload, dbError, sinks, siteDomain });
      } catch (alertErr) {
        console.error('[LEAD_DEGRADED] 알림 발송 실패:', alertErr);
      }
    }

    // 7) (선택) Meta Conversions API 서버사이드 전송 — 정상 리드만
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

    // 8) 최종 응답 — 리드가 어딘가에는 남았는지로 판단한다.
    //    전부 실패했다면 조용히 성공을 반환하면 안 된다. 그 경우엔 기존처럼 500을 띄워
    //    방문자가 직접 연락할 수 있게 하는 것이 마지막 안전장치다.
    const savedAnywhere = sinks.supabase || sinks.monday || sinks.studio || sinks.email || alerted;

    if (!savedAnywhere) {
      console.error('[LEAD_LOST] 모든 적재 경로 실패(알림 메일 포함) — 리드 유실:', JSON.stringify(insertPayload));
      return res.status(500).json({
        error: 'database error',
        debug: dbError
          ? { message: dbError.message, code: dbError.code, hint: dbError.hint, details: dbError.details }
          : undefined,
      });
    }

    if (dbError) {
      console.warn('[LEAD_DEGRADED] DB 없이 접수 완료:', JSON.stringify({ ...sinks, alerted }));
    }

    return res.status(200).json({
      success: true,
      id: inserted?.id ?? null,
      restricted: isRestricted,
      degraded: !inserted,
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
        dbError: err,
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
