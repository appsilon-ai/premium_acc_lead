# 🚀 Lead Landing Page — Vercel Stack

> Vercel + Supabase + Resend 기반 리드 광고 랜딩페이지

## 📁 프로젝트 구조

```
lead-landing-vercel/
├── index.html             ← 메인 랜딩페이지 (단일 파일)
├── api/
│   └── lead.js            ← Serverless Function (폼 처리 + DB + 이메일)
├── logos/                 ← 매체·카드 브랜드 SVG 로고
├── package.json           ← npm dependencies
├── vercel.json            ← Vercel 배포 설정
├── supabase-schema.sql    ← Supabase DB 스키마
├── .env.example           ← 환경 변수 예시
├── .gitignore
├── README.md              ← 이 문서
└── MIGRATION-GUIDE.md     ← Wix → Vercel 마이그레이션 단계별 가이드
```

## ⚡ Quick Start

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env.local
# .env.local 파일 열어서 실제 값 입력

# 3. 로컬 테스트
npm run dev
# → http://localhost:3000 에서 테스트

# 4. 배포
npm run deploy
```

## 🧱 기술 스택

| 컴포넌트 | 서비스 | 무료 한도 |
|---|---|---|
| 호스팅 + Serverless | Vercel Hobby | 100GB 대역폭/월 |
| 데이터베이스 | Supabase Free | 500MB Postgres |
| 이메일 발송 | Resend Free | 3,000 메일/월 |
| 도메인 + DNS | Cloudflare | 도메인 등록비만 |
| 트래킹 | GTM + 5개 매체 픽셀 | 무료 |

**예상 운영비**: 월 트래픽 50만까지 **$0**, 도메인비만 연 $10~20

## 📊 데이터 흐름

```
사용자 폼 제출
    ↓
[index.html → fetch POST /api/lead]
    ↓
[Vercel Serverless Function: api/lead.js]
    ↓
    ├─ 1. 검증 (이메일·전화)
    ├─ 2. URL → 제한업종 키워드 매칭
    ├─ 3. Supabase leads 테이블 INSERT
    ├─ 4. Resend 이메일 발송
    │     ├─ 정상: 영업팀에 알림
    │     └─ 제한: 광고주에게 자동 거절 회신
    └─ 5. (선택) Meta CAPI 서버사이드 전송
    ↓
응답 → 사용자에게 "신청 완료" UI 표시
    ↓
GTM dataLayer.push → 5개 픽셀 동시 발사
```

## 🛠️ 개발 명령어

```bash
npm run dev      # 로컬 개발 서버 (vercel dev)
npm run deploy   # 프로덕션 배포
vercel env pull  # 원격 환경변수를 .env.local로 다운로드
vercel logs      # 실시간 로그 보기
```

## 📚 자세한 가이드

→ **`MIGRATION-GUIDE.md`** 참고
