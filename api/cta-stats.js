import { createClient } from '@supabase/supabase-js';

const EXPERIMENT_KEY = 'partneragency_cta_copy_v1';
const ALLOWED_DAYS = new Set([7, 14, 30, 90]);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false });
  }
  const requested = Number.parseInt(String(req.query.days || '7'), 10);
  const days = ALLOWED_DAYS.has(requested) ? requested : 7;
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.rpc('cta_experiment_stats', {
    p_days: days,
    p_experiment_key: EXPERIMENT_KEY,
  });
  if (error) {
    console.error('[CTA_EXPERIMENT] stats query failed:', error.message);
    return res.status(503).json({ ok: false, error: 'stats unavailable' });
  }
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return res.status(200).json({
    ok: true,
    experimentKey: EXPERIMENT_KEY,
    days,
    generatedAt: new Date().toISOString(),
    rows: data || [],
  });
}
