// ============================================================
// Admin endpoint — 기존 Supabase 리드를 Monday에 새 매핑 규칙으로 재생성
// 사용:
//   POST /api/admin/recreate-monday?token=XXX&date=2026-06-01
//   POST /api/admin/recreate-monday?token=XXX&lead_id=123
//
// 환경변수:
//   ADMIN_TOKEN — 무단 호출 방지용 시크릿
// ============================================================

import { createClient } from '@supabase/supabase-js';

const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID || '8598876525';
const MONDAY_GROUP_ID = process.env.MONDAY_GROUP_ID || 'topics';
const MONDAY_DEFAULT_ASSIGNEE_ID = process.env.MONDAY_DEFAULT_ASSIGNEE_ID || '46666227';

const MONDAY_COLUMNS = {
  name:        'text_mknczry2',
  job:         'text_mknc998t',
  email:       'email_mkncxg73',
  phone:       'text_mknczf57',
  budget:      'text_mknfaycw',
  industry:    'text_mkncb8w6',
  payment:     'dropdown_mkncsjs9',
  services:    'dropdown_mkncnd7y',
  issue:       'dropdown_mkncmm16',
  notes:       'text_mknqtgpg',
  status:      'status',
  person:      'person',
};

const MONDAY_OPTIONAL_COLUMNS = {
  utm:         { env: 'MONDAY_COLUMN_UTM',         titles: ['UTM', 'utm', 'UTM 파라미터'] },
  urls:        { env: 'MONDAY_COLUMN_URLS',        titles: ['광고 대상 URL', '광고 URL', 'URL', 'urls'] },
  source:      { env: 'MONDAY_COLUMN_SOURCE',      titles: ['유입 경로', 'Source', 'source', '레퍼러'] },
  serviceType: { env: 'MONDAY_COLUMN_SERVICETYPE', titles: ['서비스 유형', 'Service Type', '필요 서비스'] },
};

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
const MONDAY_STATUS_NEW_LEAD = '연락 필요';
const MONDAY_STATUS_REJECTED = '거절';

function budgetLabel(b) {
  const map = {
    'under': '월 1,000만 원 미만',
    '1k-5k': '월 1,000만 ~ 5,000만 원',
    '5k-1e': '월 5,000만 ~ 1억 원',
    'over1e': '월 1억 원 이상',
  };
  return map[b] || `${b} 만원`;
}

async function getMondayBoardColumns(token, boardId) {
  const query = `query GetCols($id:[ID!]) { boards(ids:$id) { columns { id title type } } }`;
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { 'Authorization': token, 'Content-Type': 'application/json', 'API-Version': '2024-01' },
    body: JSON.stringify({ query, variables: { id: [String(boardId)] } }),
  });
  const data = await res.json();
  return (data?.data?.boards?.[0]?.columns) || [];
}

async function resolveOptionalColumns(token, boardId) {
  const cols = await getMondayBoardColumns(token, boardId).catch(() => []);
  const resolved = {};
  for (const [key, cfg] of Object.entries(MONDAY_OPTIONAL_COLUMNS)) {
    const envVal = process.env[cfg.env];
    if (envVal) {
      const looksLikeId = /^([a-z]+_[a-z0-9]+|status|person|name)$/i.test(envVal);
      if (looksLikeId) { resolved[key] = envVal; continue; }
      const byEnvTitle = cols.find(c => c.title === envVal);
      if (byEnvTitle) { resolved[key] = byEnvTitle.id; continue; }
    }
    for (const t of cfg.titles) {
      const found = cols.find(c => c.title === t || c.title.toLowerCase() === t.toLowerCase());
      if (found) { resolved[key] = found.id; break; }
    }
  }
  return { resolved, allColumns: cols };
}

async function createMondayItem(data, optionalIds) {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) throw new Error('MONDAY_API_TOKEN not set');

  const nameJob = String(data.name || '').split('/').map(s => s.trim());
  const personName = nameJob[0] || data.name || '';
  const personJob = nameJob[1] || '';

  const mappedServices = (Array.isArray(data.services) ? data.services : [])
    .map(s => MONDAY_SERVICES_MAP[s])
    .filter(Boolean);
  const mappedPayment = MONDAY_PAYMENT_MAP[data.payment] || data.payment || '';

  const extraInfo = [];
  if (data.service_type && !optionalIds.serviceType) extraInfo.push(`[서비스 유형]\n${data.service_type}`);
  if (Array.isArray(data.urls) && data.urls.length > 0 && !optionalIds.urls) {
    extraInfo.push(`[광고 대상 URL ${data.urls.length}개]\n${data.urls.map(u => '• ' + u).join('\n')}`);
  }
  if (data.source && data.source !== 'direct' && !optionalIds.source) extraInfo.push(`[유입 경로]\n${data.source}`);
  if (data.utm && !optionalIds.utm) extraInfo.push(`[UTM]\n${data.utm}`);
  const combinedNotes = [data.notes, ...extraInfo].filter(Boolean).join('\n\n---\n\n');

  const statusLabel = data.restricted ? MONDAY_STATUS_REJECTED : MONDAY_STATUS_NEW_LEAD;

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
  if (mappedPayment) columnValues[MONDAY_COLUMNS.payment] = { labels: [mappedPayment] };
  if (mappedServices.length > 0) columnValues[MONDAY_COLUMNS.services] = { labels: mappedServices };
  if (data.issue) columnValues[MONDAY_COLUMNS.issue] = { labels: [data.issue] };

  if (optionalIds.utm && data.utm) columnValues[optionalIds.utm] = String(data.utm).slice(0, 2000);
  if (optionalIds.urls && Array.isArray(data.urls) && data.urls.length > 0) {
    columnValues[optionalIds.urls] = data.urls.join(' | ').slice(0, 2000);
  }
  if (optionalIds.source && data.source && data.source !== 'direct') {
    columnValues[optionalIds.source] = String(data.source).slice(0, 500);
  }
  if (optionalIds.serviceType && data.service_type) {
    columnValues[optionalIds.serviceType] = String(data.service_type).slice(0, 200);
  }

  // 재생성임을 알 수 있게 회사명에 [재검수] 접두
  const itemName = `[재검수] ${data.company}`;

  const mutation = `
    mutation CreateItem($boardId: ID!, $groupId: String!, $itemName: String!, $columnValues: JSON!) {
      create_item(board_id: $boardId, group_id: $groupId, item_name: $itemName, column_values: $columnValues) { id }
    }
  `;
  const variables = {
    boardId: String(MONDAY_BOARD_ID),
    groupId: MONDAY_GROUP_ID,
    itemName,
    columnValues: JSON.stringify(columnValues),
  };

  const response = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { 'Authorization': token, 'Content-Type': 'application/json', 'API-Version': '2024-01' },
    body: JSON.stringify({ query: mutation, variables }),
  });
  const result = await response.json();
  if (result.errors) {
    throw new Error('Monday create_item failed: ' + JSON.stringify(result.errors));
  }
  return result.data?.create_item?.id;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 토큰 인증
  const token = req.query.token || req.body?.token;
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    // 리드 fetch 조건
    let query = sb.from('leads').select('*').order('submitted_at', { ascending: true });
    if (req.query.lead_id) {
      query = query.eq('id', req.query.lead_id);
    } else if (req.query.date) {
      // 한국시간 기준 해당 날짜 → UTC 변환 (KST = UTC+9, 그러므로 00:00 KST = 15:00 UTC 전날)
      const dateStr = req.query.date; // 예: '2026-06-01'
      const startUTC = new Date(`${dateStr}T00:00:00+09:00`).toISOString();
      const endUTC = new Date(`${dateStr}T23:59:59+09:00`).toISOString();
      query = query.gte('submitted_at', startUTC).lte('submitted_at', endUTC);
    } else {
      return res.status(400).json({ error: 'lead_id or date required' });
    }

    const { data: leads, error: dbErr } = await query;
    if (dbErr) {
      return res.status(500).json({ error: 'db error', detail: dbErr.message });
    }
    if (!leads || leads.length === 0) {
      return res.status(404).json({ error: 'no leads found', query: req.query });
    }

    // Monday 컬럼 resolve
    const { resolved: optionalIds, allColumns } = await resolveOptionalColumns(
      process.env.MONDAY_API_TOKEN, MONDAY_BOARD_ID
    );

    const results = [];
    for (const lead of leads) {
      try {
        const mondayId = await createMondayItem(lead, optionalIds);
        results.push({ lead_id: lead.id, company: lead.company, monday_item_id: mondayId, ok: true });
      } catch (e) {
        results.push({ lead_id: lead.id, company: lead.company, error: e.message, ok: false });
      }
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      optional_columns_resolved: optionalIds,
      available_columns: allColumns.map(c => ({ id: c.id, title: c.title, type: c.type })),
      results,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0, 5) });
  }
}
