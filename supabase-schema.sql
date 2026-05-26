-- ============================================================
-- Supabase 스키마 — leads 테이블
-- 실행 방법: Supabase Dashboard > SQL Editor > New Query > 전체 붙여넣기 > RUN
-- ============================================================

-- 1. leads 테이블 생성
CREATE TABLE IF NOT EXISTS leads (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  -- 기본 정보
  name               text NOT NULL,
  company            text NOT NULL,
  email              text NOT NULL,
  phone              text NOT NULL,
  -- 광고비 정보
  budget             text NOT NULL,
  -- 광고 대상
  urls               text[] DEFAULT '{}',
  url                text,
  -- 자동 분류 결과
  restricted         boolean DEFAULT false,
  restricted_reasons jsonb DEFAULT '[]'::jsonb,
  lead_priority      text DEFAULT 'STANDARD',  -- REJECTED / HIGH / STANDARD
  -- 추가 정보
  industry           text,
  service_type       text,
  payment            text,
  services           text[] DEFAULT '{}',
  issue              text,
  notes              text,
  -- 트래킹
  source             text,
  utm                text,
  submitted_at       timestamptz NOT NULL DEFAULT now()
);

-- 2. 인덱스 (조회 성능)
CREATE INDEX IF NOT EXISTS idx_leads_email         ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_priority      ON leads(lead_priority);
CREATE INDEX IF NOT EXISTS idx_leads_restricted    ON leads(restricted);
CREATE INDEX IF NOT EXISTS idx_leads_submitted_at  ON leads(submitted_at DESC);

-- 3. Row Level Security (보안)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- 익명 사용자는 INSERT만 허용 (폼 제출용) — 단, Service Role Key 사용 시 RLS 우회됨
-- API 코드에서는 service_role 키 사용하므로 별도 정책 불필요
-- 그러나 정책 명시는 좋은 습관:
CREATE POLICY "Service role can do anything"
  ON leads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. (선택) 통계 View — 일별 리드 집계
CREATE OR REPLACE VIEW leads_daily_stats AS
SELECT
  DATE(submitted_at AT TIME ZONE 'Asia/Seoul') AS date,
  COUNT(*) AS total_leads,
  COUNT(*) FILTER (WHERE restricted = false) AS valid_leads,
  COUNT(*) FILTER (WHERE restricted = true) AS rejected_leads,
  COUNT(*) FILTER (WHERE lead_priority = 'HIGH') AS high_priority_leads,
  ARRAY_AGG(DISTINCT industry) FILTER (WHERE industry IS NOT NULL) AS industries
FROM leads
GROUP BY 1
ORDER BY 1 DESC;

-- 5. (선택) 자동 정리 — 12개월 이상 된 데이터 마스킹
-- Supabase Edge Function 또는 cron으로 별도 실행 권장
-- 여기서는 트리거 없이 함수만 정의:
CREATE OR REPLACE FUNCTION anonymize_old_leads()
RETURNS void AS $$
BEGIN
  UPDATE leads
  SET
    name = 'REDACTED',
    email = 'redacted@example.com',
    phone = '0000000000',
    notes = NULL,
    urls = '{}',
    url = NULL
  WHERE submitted_at < (now() - INTERVAL '12 months');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ✅ 검증 쿼리 (테이블 생성 후 실행하여 확인)
-- ============================================================

-- 테이블 존재 확인
-- SELECT * FROM leads LIMIT 5;

-- 인덱스 확인
-- SELECT indexname FROM pg_indexes WHERE tablename = 'leads';

-- 테스트 데이터 삽입
/*
INSERT INTO leads (name, company, email, phone, budget, urls, industry, service_type)
VALUES (
  '테스트사용자',
  '(주)테스트',
  'test@example.com',
  '01012345678',
  '5k-1e',
  ARRAY['https://example.com'],
  '이커머스',
  '계정 임대만'
);
*/
