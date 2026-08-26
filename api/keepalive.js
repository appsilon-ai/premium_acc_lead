// ============================================================
// Supabase 유지용 핑 (Vercel Cron 전용)
//
// 무료 플랜 Supabase 프로젝트는 7일간 API 요청이 없으면 자동 정지되고,
// 정지되면 <ref>.supabase.co 의 DNS 레코드까지 내려가 ENOTFOUND 가 난다.
// (2026-08-25 장애 원인. 리드 문의가 매일 들어오지 않으면 언제든 재발한다.)
//
// 하루 한 번 가장 싼 쿼리를 날려 "활동 중" 상태를 유지하고,
// 성공·실패 여부를 매일 운영 담당에게 메일로 보고한다.
// 성공 메일은 하트비트 역할도 한다 — 메일이 "오지 않는 것" 자체가
// 크론이 돌지 않았다는 신호다.
//
// 환경변수:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (api/lead.js 와 공용)
//   ALERT_NOTIFY_EMAIL   ← 점검 결과 수신 주소 (미설정 시 메일 없이 로그만)
//   FROM_EMAIL, RESEND_API_KEY
//   CRON_SECRET  (선택) ← 설정 시 Vercel Cron 호출만 허용
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
const resend = new Resend(process.env.RESEND_API_KEY);

const MAIL_STYLE = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:24px";
const ROW = 'padding:6px 0;color:#6b7280;width:120px';

// 점검 결과 수신자 — 쉼표로 여러 명 지정 가능
function alertRecipients() {
  return (process.env.ALERT_NOTIFY_EMAIL || '')
    .split(',')
    .map(a => a.trim())
    .filter(Boolean);
}

// 대상 프로젝트 호스트 (메일에 어느 DB를 점검했는지 남긴다)
function supabaseHost() {
  try {
    return new URL(process.env.SUPABASE_URL).host;
  } catch {
    return '(SUPABASE_URL 미설정)';
  }
}

function nowKST() {
  return new Date().toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
}

async function send({ subject, html }) {
  const to = alertRecipients();
  if (to.length === 0) {
    console.warn('[KEEPALIVE] ALERT_NOTIFY_EMAIL 미설정 — 점검 메일을 보낼 수 없습니다.');
    return false;
  }
  try {
    await resend.emails.send({
      from: `OFFICIAL ADS ALERT <${process.env.FROM_EMAIL || 'noreply@example.com'}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (mailErr) {
    console.error('[KEEPALIVE] 점검 메일 발송 실패:', mailErr);
    return false;
  }
}

// 정상 — 쿼리 결과를 그대로 담아 보낸다.
function notifySuccess({ count, ms }) {
  return send({
    subject: `✅ [점검] Supabase 정상 — 리드 ${count}건`,
    html: `
      <div style="${MAIL_STYLE}">
        <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:16px;border-radius:6px">
          <h2 style="margin:0 0 8px;font-size:17px;color:#166534">Supabase 정상 응답</h2>
          <p style="margin:0;font-size:13px;color:#15803d">
            일일 점검 쿼리가 성공했습니다. 프로젝트가 활동 상태로 유지됩니다.
          </p>
        </div>
        <table style="width:100%;margin-top:20px;font-size:14px;border-collapse:collapse">
          <tr><td style="${ROW}">쿼리</td><td style="padding:6px 0"><code>select count(id) from leads</code></td></tr>
          <tr><td style="${ROW}">리드 총건수</td><td style="padding:6px 0"><b>${count}건</b></td></tr>
          <tr><td style="${ROW}">응답 시간</td><td style="padding:6px 0">${ms}ms</td></tr>
          <tr><td style="${ROW}">점검 시각</td><td style="padding:6px 0">${nowKST()}</td></tr>
          <tr><td style="${ROW}">대상</td><td style="padding:6px 0">${supabaseHost()}</td></tr>
        </table>
        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.7">
          이 메일은 매일 09:00(KST)에 발송됩니다.
          <b>메일이 오지 않는 것 자체가 이상 신호</b>입니다 — 크론이 실행되지 않았을 수 있으니
          Vercel 대시보드의 Cron Jobs를 확인해 주세요.
        </p>
      </div>
    `,
  });
}

// 실패 — 리드가 유실되기 전에 알린다.
function notifyFailure(err, ms) {
  const detail = [err?.message, err?.code, err?.details].filter(Boolean).join('\n') || 'unknown';
  return send({
    subject: `🚨 [점검] Supabase 응답 없음 — 리드 저장이 중단될 수 있습니다`,
    html: `
      <div style="${MAIL_STYLE}">
        <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px;border-radius:6px">
          <h2 style="margin:0 0 8px;font-size:17px;color:#991b1b">일일 점검에서 Supabase 응답이 없습니다</h2>
          <p style="margin:0;font-size:13px;color:#7f1d1d">
            아직 리드가 유실된 것은 아닙니다. 다만 이 상태로 두면 DB 저장이 실패하기 시작합니다.
            <b>Supabase 대시보드에서 프로젝트 상태를 확인해 주세요.</b> 정지 상태라면 Restore 하면 됩니다.
          </p>
        </div>
        <table style="width:100%;margin-top:20px;font-size:14px;border-collapse:collapse">
          <tr><td style="${ROW}">점검 시각</td><td style="padding:6px 0">${nowKST()}</td></tr>
          <tr><td style="${ROW}">소요</td><td style="padding:6px 0">${ms}ms</td></tr>
          <tr><td style="${ROW}">대상</td><td style="padding:6px 0">${supabaseHost()}</td></tr>
        </table>
        <p style="margin:20px 0 6px;font-size:13px;color:#6b7280">에러</p>
        <pre style="background:#1f2937;color:#f9fafb;padding:12px;border-radius:6px;font-size:12px;white-space:pre-wrap;word-break:break-all">${detail}</pre>
        <p style="margin:20px 0 0;font-size:12px;color:#9ca3af">
          리드 접수는 계속 동작합니다 — DB가 죽어도 Monday·Marketing Studio·메일로 저장됩니다.
        </p>
      </div>
    `,
  });
}

export default async function handler(req, res) {
  // CRON_SECRET이 설정돼 있으면 Vercel Cron 호출만 허용한다.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const startedAt = Date.now();

  try {
    // 가장 싼 쿼리 — head:true 로 행은 받지 않고 카운트만 가져온다.
    const { count, error } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true });

    if (error) throw error;

    const ms = Date.now() - startedAt;
    console.log(`[KEEPALIVE] ok — leads=${count} (${ms}ms)`);

    const mailed = await notifySuccess({ count, ms });
    return res.status(200).json({ ok: true, leads: count, ms, mailed });

  } catch (err) {
    const ms = Date.now() - startedAt;
    console.error('[KEEPALIVE] Supabase 응답 없음:', JSON.stringify({
      message: err?.message, code: err?.code, details: err?.details, ms,
    }));

    const mailed = await notifyFailure(err, ms);

    // 500을 반환해야 Vercel Cron 실행 기록에 실패로 남는다.
    return res.status(500).json({ ok: false, mailed, ms, message: err?.message });
  }
}
