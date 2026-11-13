import { createClient } from '@supabase/supabase-js';

const EXPERIMENT_KEY = 'partneragency_cta_copy_v1';
const VARIANTS = new Set(['a', 'b', 'c', 'd']);
const EVENT_TYPES = new Set(['exposure', 'click']);

function clean(value, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function isFirstPartyRequest(req) {
  const origin = clean(req.headers.origin || '', 300);
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname;
    return host === 'partneragency.net' || host === 'www.partneragency.net' || host.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }
  if (!isFirstPartyRequest(req)) return res.status(403).json({ ok: false });

  const body = req.body || {};
  const eventId = clean(body.event_id, 220);
  const eventType = clean(body.event_type, 24);
  const variantKey = clean(body.variant_key, 8);
  const visitorId = clean(body.visitor_id, 120);
  const sessionId = clean(body.session_id, 120);
  if (
    clean(body.experiment_key, 80) !== EXPERIMENT_KEY ||
    !eventId || !EVENT_TYPES.has(eventType) || !VARIANTS.has(variantKey) ||
    !visitorId || !sessionId
  ) {
    return res.status(400).json({ ok: false });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.from('cta_experiment_events').upsert({
    event_id: eventId,
    experiment_key: EXPERIMENT_KEY,
    event_type: eventType,
    variant_key: variantKey,
    visitor_id: visitorId,
    session_id: sessionId,
    location: clean(body.location, 80) || 'landing',
    page_path: clean(body.page_path, 240) || '/',
  }, { onConflict: 'event_id', ignoreDuplicates: true });

  if (error) {
    console.error('[CTA_EXPERIMENT] event insert failed:', error.message);
    return res.status(503).json({ ok: false });
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(202).json({ ok: true });
}
