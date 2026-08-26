// ============================================================
// Supabase 유지용 핑 (Vercel Cron 전용)
//
// 무료 플랜 Supabase 프로젝트는 7일간 API 요청이 없으면 자동 정지되고,
// 정지되면 <ref>.supabase.co 의 DNS 레코드까지 내려가 ENOTFOUND 가 난다.
// (2026-08-25 장애 원인. 리드 문의가 매일 들어오지 않으면 언제든 재발한다.)
//
// 하루 한 번 가장 싼 쿼리를 날려 "활동 중" 상태를 유지한다.
// 실패하면 조용히 넘기지 않고 운영 담당에게 알린다 — 리드를 잃고 나서
// 알게 되는 대신, 다음 날 아침 메일로 먼저 알게 하는 것이 목적이다.
//
// 환경변수:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (api/lead.js 와 공용)
//   ALERT_NOTIFY_EMAIL   ← 실패 알림 수신 주소 (미설정 시 메일 없이 로그만)
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

// 핑 실패 = DB 다운. 리드가 유실되기 전에 알린다.
async function notifyFailure(err) {
  const recipients = (process.env.ALERT_NOTIFY_EMAIL || '')
    .split(',')
    .map(a => a.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    console.warn('[KEEPALIVE] ALERT_NOTIFY_EMAIL 미설정 — 실패 알림을 보낼 수 없습니다.');
    return false;
  }

  const fromEmail = process.env.FROM_EMAIL || 'noreply@example.com';
  const detail = [err?.message, err?.code, err?.details].filter(Boolean).join('\n') || 'unknown';

  try {
    await resend.emails.send({
      from: `OFFICIAL ADS ALERT <${fromEmail}>`,
      to: recipients,
      subject: `🚨 [점검] Supabase 응답 없음 — 리드 저장이 중단될 수 있습니다`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:24px">
          <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px;border-radius:6px">
            <h2 style="margin:0 0 8px;font-size:17px;color:#991b1b">일일 점검에서 Supabase 응답이 없습니다</h2>
            <p style="margin:0;font-size:13px;color:#7f1d1d">
              아직 리드가 유실된 것은 아닙니다. 다만 이 상태로 두면 DB 저장이 실패하기 시작합니다.
              <b>Supabase 대시보드에서 프로젝트 상태를 확인해 주세요.</b> 정지 상태라면 Restore 하면 됩니다.
            </p>
          </div>
          <p style="margin:20px 0 6px;font-size:13px;color:#6b7280">에러</p>
          <pre style="background:#1f2937;color:#f9fafb;padding:12px;border-radius:6px;font-size:12px;white-space:pre-wrap;word-break:break-all">${detail}</pre>
          <p style="margin:20px 0 0;font-size:12px;color:#9ca3af">
            리드 접수는 계속 동작합니다 — DB가 죽어도 Monday·Marketing Studio·메일로 저장됩니다.
          </p>
        </div>
      `,
    });
    return true;
  } catch (mailErr) {
    console.error('[KEEPALIVE] 실패 알림 메일 발송 실패:', mailErr);
    return false;
  }
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
    return res.status(200).json({ ok: true, leads: count, ms });

  } catch (err) {
    const ms = Date.now() - startedAt;
    console.error('[KEEPALIVE] Supabase 응답 없음:', JSON.stringify({
      message: err?.message, code: err?.code, details: err?.details, ms,
    }));

    const alerted = await notifyFailure(err);

    // 500을 반환해야 Vercel Cron 실행 기록에 실패로 남는다.
    return res.status(500).json({ ok: false, alerted, ms, message: err?.message });
  }
}
