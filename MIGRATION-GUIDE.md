# 🚀 Vercel 배포 완전 가이드

> **목표**: 0에서 시작해서 Vercel + Supabase + Resend 스택으로 완전 배포
> **예상 소요 시간**: 1.5 ~ 2시간 (계정 생성 + 도메인 인증 포함)
> **사전 준비물**: 신용카드 (도메인용), 사업자 이메일 1개

---

## 📑 전체 단계 요약

| Phase | 작업 | 시간 |
|---|---|---|
| 1 | 사전 도구 설치 (Node.js, Git, VS Code, Vercel CLI) | 20m |
| 2 | Supabase 프로젝트 생성 + 스키마 SQL 실행 | 15m |
| 3 | Resend 계정 + 도메인 인증 + API Key | 15m |
| 4 | 도메인 구매 (Cloudflare 권장) | 10m |
| 5 | GitHub 레포 생성 + 코드 push | 10m |
| 6 | Vercel 프로젝트 import + 환경 변수 설정 | 15m |
| 7 | 도메인 연결 + DNS 설정 | 10m |
| 8 | 첫 배포 + 로컬 테스트 | 10m |
| 9 | GTM + 5개 픽셀 설치 | 1h |
| 10 | 실제 폼 제출 테스트 + 검증 | 30m |

---

# PHASE 1 — 사전 도구 설치

## 1-1. Node.js 설치 (필수)

### Windows
1. https://nodejs.org → **LTS** 버전 다운로드 (현재 v20)
2. 설치 → 모두 기본값
3. 확인:
   ```bash
   node --version    # v20.x.x 표시되면 OK
   npm --version     # 10.x.x
   ```

## 1-2. Git 설치 (필수)

### Windows
1. https://git-scm.com/download/win → 다운로드
2. 설치 → 모두 기본값
3. 확인:
   ```bash
   git --version
   ```

## 1-3. VS Code 설치 (권장)

https://code.visualstudio.com → 다운로드 설치

권장 확장:
- ESLint
- Prettier
- GitLens

## 1-4. Vercel CLI 설치

```bash
npm install -g vercel
vercel --version
```

## 1-5. GitHub 계정 + SSH 키 (코드 push용)

1. https://github.com → 가입
2. (선택) SSH 키 생성:
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   # Enter 3번
   # 생성된 공개키 복사:
   cat ~/.ssh/id_ed25519.pub
   ```
3. GitHub > Settings > SSH and GPG keys > New SSH key > 붙여넣기

✅ **체크포인트**: `node`, `npm`, `git`, `vercel` 4개 명령어 모두 작동

---

# PHASE 2 — Supabase 셋업

## 2-1. 계정 + 프로젝트 생성

1. https://supabase.com → `Start your project` → GitHub로 가입
2. `+ New Project`
3. **Organization**: `Personal` 또는 새로 생성
4. **Project Name**: `lead-landing` (또는 회사명)
5. **Database Password**: 강력한 비밀번호 생성 → **반드시 저장** (DB 직접 접속 시 필요)
6. **Region**: `Northeast Asia (Seoul)` 또는 `Tokyo`
7. **Pricing Plan**: `Free`
8. `Create new project` → 약 2분 대기

## 2-2. 스키마 SQL 실행

1. Supabase Dashboard 좌측 > `SQL Editor`
2. `+ New query`
3. 프로젝트 폴더의 `supabase-schema.sql` 전체 내용 복사 → 붙여넣기
4. `Run` 클릭
5. "Success. No rows returned" 메시지 확인

## 2-3. API Key 확보

1. 좌측 > `Settings` (톱니바퀴) > `API`
2. 다음 2가지 값 메모:
   - **Project URL**: `https://xxxxxxxxxxxx.supabase.co`
   - **service_role secret**: `eyJhbGc...` (⚠️ 절대 공개하지 말 것)

> ⚠️ `service_role` 키는 RLS 우회 가능한 마스터 권한. Vercel 환경 변수에만 저장하고 절대 코드에 하드코딩 금지.

✅ **체크포인트**: Table Editor에서 `leads` 테이블 확인 → 컬럼 19개 표시

---

# PHASE 3 — Resend 셋업 (이메일)

## 3-1. 계정 생성

1. https://resend.com → `Sign Up` (GitHub 또는 이메일)
2. 가입 직후 대시보드 진입

## 3-2. 도메인 추가 + 인증

1. 좌측 메뉴 > `Domains` > `Add Domain`
2. 본인 도메인 입력 (예: `official-ads.kr`)
3. **DNS 레코드 4개** 표시됨:
   - MX (메일 수신용, 1개)
   - TXT (SPF, 1개)
   - TXT (DKIM, 2개)
4. **Cloudflare** (또는 도메인 등록업체) DNS 설정에서 위 레코드 모두 추가
5. Resend Dashboard에서 `Verify DNS Records` 클릭 → 보통 5~10분 내 인증 완료

> 💡 도메인 인증 안 하면 `onboarding@resend.dev` 발신 주소로만 테스트 가능 (운영 불가)

## 3-3. API Key 발급

1. 좌측 > `API Keys` > `+ Create API Key`
2. **Name**: `vercel-production`
3. **Permission**: `Sending access` (또는 Full access)
4. `Add` → **표시되는 키 즉시 복사** (`re_xxxxx`)

✅ **체크포인트**: Domains 탭에 도메인이 `Verified` 상태로 표시됨

---

# PHASE 4 — 도메인 구매 (Cloudflare 권장)

## 4-1. Cloudflare에서 도메인 구매

1. https://dash.cloudflare.com → 가입
2. 좌측 > `Domain Registration` > `Register Domains`
3. 원하는 도메인 검색 (예: `official-ads.kr`)
4. 결제 (신용카드, $10~20/년)

### 이미 다른 곳에 도메인 있다면
1. Cloudflare > `+ Add a site` > 도메인 입력 → Free Plan
2. Cloudflare가 알려주는 Nameserver 2개를 도메인 등록업체에 입력
3. 24시간 내 DNS 관리 Cloudflare로 이전

## 4-2. Zone ID 확인 (자동화 시 필요)

1. Cloudflare > `Websites` > 본인 도메인 클릭
2. 우측 사이드바 `Overview` 섹션 하단에 **Zone ID** (32자) 메모

✅ **체크포인트**: 본인 도메인이 Cloudflare에서 관리 중

---

# PHASE 5 — GitHub 레포 생성 + 코드 push

## 5-1. GitHub에 새 레포 생성

1. https://github.com/new
2. **Repository name**: `lead-landing` (또는 회사명)
3. **Visibility**: `Private` 권장 (Public도 가능)
4. **Initialize this repository with**: 모두 체크 해제 (빈 레포로)
5. `Create repository`
6. 표시되는 URL 메모 (예: `https://github.com/yourname/lead-landing.git`)

## 5-2. 로컬에서 Git 초기화 + push

PowerShell 또는 Terminal:

```bash
# 프로젝트 폴더로 이동
cd "C:\Users\partn\Desktop\lead-landing-vercel"

# Git 초기화
git init
git add .
git commit -m "Initial commit: lead landing page"

# 본인 GitHub 정보 설정 (처음 1회)
git config user.name "Your Name"
git config user.email "your@email.com"

# GitHub 레포에 연결
git remote add origin https://github.com/yourname/lead-landing.git
git branch -M main
git push -u origin main
```

> ⚠️ 첫 push 시 GitHub 인증 필요 — Personal Access Token 입력 또는 GitHub CLI 사용

### Personal Access Token 발급 방법
1. GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic)
2. `Generate new token (classic)`
3. **Scopes**: `repo` 체크
4. 발급된 토큰을 비밀번호 자리에 입력

✅ **체크포인트**: GitHub 레포에서 모든 파일 확인됨

---

# PHASE 6 — Vercel 프로젝트 Import + 환경 변수

## 6-1. Vercel에 GitHub 연동

1. https://vercel.com → `Sign Up` → **GitHub로 가입**
2. 가입 직후 `+ Add New Project` 또는 `Import Project`
3. GitHub 레포 목록에서 방금 만든 `lead-landing` 선택 > `Import`

## 6-2. 프로젝트 설정

자동으로 감지되는 기본값:
- **Framework Preset**: Other (또는 None)
- **Build Command**: (비워둠 — 정적 사이트)
- **Output Directory**: `./` (루트)
- **Install Command**: `npm install`

## 6-3. 환경 변수 설정 (중요!)

`Environment Variables` 섹션에서 다음 키 추가:

| Key | Value | 출처 |
|---|---|---|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | Phase 2-3 |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` | Phase 2-3 |
| `RESEND_API_KEY` | `re_xxxxx` | Phase 3-3 |
| `FROM_EMAIL` | `noreply@your-domain.com` | Phase 3 인증 도메인 |
| `SALES_NOTIFY_EMAIL` | `sales@your-company.com` | 영업팀 이메일 |
| `META_PIXEL_ID` | (선택) `1234567890123456` | Meta Business Suite |
| `META_CAPI_ACCESS_TOKEN` | (선택) `EAAxxxx...` | Meta System User Token |

각 변수마다 `Environment` = **Production, Preview, Development** 모두 체크.

## 6-4. 첫 배포

`Deploy` 클릭 → 1~2분 후 자동 배포 완료
- 임시 URL 발급됨: `https://lead-landing-xxxx.vercel.app`

✅ **체크포인트**: 임시 URL 접속 시 랜딩페이지 정상 표시

---

# PHASE 7 — 본인 도메인 연결

## 7-1. Vercel에 도메인 추가

1. Vercel Dashboard > 프로젝트 > `Settings` > `Domains`
2. 도메인 입력 (예: `official-ads.kr`) > `Add`
3. 표시되는 DNS 설정 정보 메모:
   - **A 레코드**: `76.76.21.21` (또는 비슷한 IP)
   - 또는 **CNAME**: `cname.vercel-dns.com`

## 7-2. Cloudflare DNS 설정

1. Cloudflare Dashboard > 본인 도메인 > `DNS` > `Records`
2. `+ Add record`:
   - **Type**: `A`
   - **Name**: `@` (또는 도메인 루트)
   - **IPv4 address**: `76.76.21.21` (Vercel이 알려준 값)
   - **Proxy status**: 🟠 **Proxied** (Cloudflare 보호) 또는 ⚫ **DNS only** (Vercel 권장)
   - `Save`
3. www 서브도메인용 추가 (선택):
   - Type: `CNAME`
   - Name: `www`
   - Target: `cname.vercel-dns.com`

## 7-3. 인증 대기

- DNS 전파: 5분 ~ 24시간 (보통 5분 내)
- Vercel Dashboard > Domains 에서 **`Valid Configuration`** ✅ 표시되면 완료

✅ **체크포인트**: `https://your-domain.com` 접속 시 사이트 표시 + 자물쇠 (HTTPS) 표시

---

# PHASE 8 — 로컬 테스트 + 최종 확인

## 8-1. 로컬 환경 변수 설정

```bash
cd "C:\Users\partn\Desktop\lead-landing-vercel"

# .env.example을 복사
cp .env.example .env.local

# .env.local 파일 열어서 실제 값으로 교체
# (Phase 6의 환경 변수와 동일)
```

> 💡 또는 Vercel에서 다운로드:
> ```bash
> vercel link    # 처음 1회 — 프로젝트 연결
> vercel env pull .env.local
> ```

## 8-2. 로컬 서버 실행

```bash
npm install
npm run dev
```

- 브라우저에서 http://localhost:3000 자동 열림
- 폼 작성 후 제출 → Supabase Table Editor에서 신규 row 확인

## 8-3. Smoke Test 체크리스트

### 페이지 로드 검증
- [ ] 메인 페이지 정상 표시
- [ ] 로고 모두 정상 로드 (`/logos/*.svg` 200 OK)
- [ ] 모바일 뷰 (DevTools 375px) 정상

### 폼 제출 사이클
- [ ] Step 1 모든 필드 입력 → "다음" 작동
- [ ] Step 2 모든 필드 입력 → "제출" 작동
- [ ] 성공 메시지 표시
- [ ] Supabase Dashboard > Table Editor > leads → 신규 row 1개 확인
- [ ] 모든 필드값 정상 저장

### 이메일 검증
- [ ] `SALES_NOTIFY_EMAIL` 받은편지함에 알림 메일 5분 내 도착
- [ ] 메일 본문에 회사·이름·연락처·예산 등 정상 표시
- [ ] HTML 디자인 깨지지 않음

### 제한업종 자동 분류
- [ ] URL에 `https://test-casino.com` 입력 후 제출
- [ ] Supabase에 `restricted: true`, `lead_priority: REJECTED` 저장
- [ ] 광고주(폼 입력 이메일)에게 자동 거절 회신 메일 도착

✅ **체크포인트**: 위 8개 항목 모두 통과

---

# PHASE 9 — GTM + 5개 픽셀 설치

> 이 단계는 기존 `리드광고 랜딩페이지 v1/DEPLOYMENT-GUIDE.md`의 Phase 5~7 가이드와 동일.
> 단, Wix Custom Code 대신 **index.html `<head>`에 GTM 코드 직접 삽입**.

## 9-1. GTM 컨테이너 코드 추가

`index.html` 파일을 VS Code에서 열고, `<head>` 안에 GTM Script 1 삽입:

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','GTM-XXXXXXX');</script>
  <!-- End Google Tag Manager -->

  <meta charset="UTF-8" />
  <!-- 기존 head 내용 ... -->
</head>
<body>
  <!-- Google Tag Manager (noscript) -->
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXXX"
  height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
  <!-- End Google Tag Manager (noscript) -->

  <!-- 기존 body 내용 ... -->
```

## 9-2. 코드 변경사항 commit + push (자동 배포)

```bash
git add index.html
git commit -m "Add GTM container"
git push
```

→ Vercel이 자동으로 1~2분 내 재배포

## 9-3. GTM 안에서 5개 픽셀 등록

기존 가이드 `DEPLOYMENT-GUIDE.md` Phase 6, 7 그대로 진행:
- Meta Pixel
- GA4
- TikTok Pixel
- NAVER WCS
- Kakao Pixel

✅ **체크포인트**: Chrome 확장 (Meta Pixel Helper 등)에서 모든 픽셀 작동 확인

---

# PHASE 10 — 실제 검증

## 10-1. 광고매체 콘솔에서 이벤트 확인

- **GA4 DebugView**: 실시간 이벤트 흐름
- **Meta Events Manager > Test Events**: PageView + Lead 도착
- **TikTok Events Manager**: Pageview + SubmitForm
- **NAVER 프리미엄 로그분석**: 전환 보고서
- **Kakao 모먼트**: 픽셀 데이터

## 10-2. Vercel Logs 모니터링

```bash
vercel logs --follow
```

또는 Vercel Dashboard > 프로젝트 > `Logs` 탭에서 실시간 확인

---

## 🔧 일상 유지보수 워크플로

### 코드 수정 → 라이브 반영
```bash
# 1. 코드 수정 (VS Code에서)
# 2. 변경사항 확인
git status
git diff

# 3. 커밋 + 푸시
git add .
git commit -m "Update hero copy"
git push

# 4. Vercel 자동 배포 (1~2분)
# Vercel Dashboard에서 배포 진행 상황 확인
```

### A/B 테스트 변종 만들기
```bash
git checkout -b test-hero-v2
# 코드 수정
git add . && git commit -m "A/B test: hero v2"
git push -u origin test-hero-v2
# → Vercel이 자동으로 Preview URL 생성 (https://lead-landing-git-test-hero-v2-xxxx.vercel.app)
# → 이 URL을 광고 캠페인 B안에 사용
```

### 롤백
```bash
# Vercel Dashboard > Deployments > 이전 배포 > "Promote to Production"
# 또는 Git:
git revert HEAD
git push
```

### 환경 변수 변경
1. Vercel Dashboard > Settings > Environment Variables
2. 값 수정 후 `Save`
3. 자동 재배포 트리거 또는 수동 Re-deploy

---

## 📊 모니터링 대시보드

### Supabase
- Dashboard > Table Editor > leads (실시간 리드 확인)
- SQL Editor에서 통계 쿼리:
  ```sql
  SELECT * FROM leads_daily_stats LIMIT 30;
  ```

### Vercel
- Logs 탭 (실시간 에러 모니터링)
- Analytics (페이지 로드 시간, 트래픽)

### Resend
- Dashboard > Emails (발송 내역 + 오픈율)

### GA4 / Meta / TikTok / NAVER / Kakao
- 각 매체의 자체 대시보드

---

## 🐛 트러블슈팅

### "폼 제출 시 500 에러"
1. Vercel Logs 확인
2. 가장 흔한 원인:
   - 환경 변수 누락 (특히 `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`)
   - Resend 도메인 미인증 → `FROM_EMAIL` 발신 불가

### "Supabase에는 저장되는데 이메일이 안 와요"
1. Resend Dashboard > Emails 탭에서 발송 시도 확인
2. `Bounced` 표시되면 → `FROM_EMAIL` 도메인 인증 확인
3. 정상 발송이라면 스팸함 확인

### "도메인 연결 후 사이트가 안 떠요"
- DNS 전파 대기 (최대 24시간)
- `nslookup your-domain.com` 또는 `dig your-domain.com` 으로 확인
- Vercel Dashboard > Domains 상태 확인

### "GTM 이벤트가 안 잡혀요"
- DevTools Console에서 `dataLayer` 입력 → 배열 객체 반환되는지 확인
- GTM Preview Mode 사용
- 이전 가이드 (`DEPLOYMENT-GUIDE.md` 트러블슈팅) 참고

### "git push 시 인증 실패"
- Personal Access Token 발급 → 비밀번호 자리에 입력
- 또는 GitHub CLI 사용: `gh auth login`

---

## ✅ 최종 배포 체크리스트

```
[ ] Node.js, Git, Vercel CLI 설치 완료
[ ] Supabase 프로젝트 + leads 테이블 생성됨
[ ] Resend 계정 + 도메인 인증 완료
[ ] 도메인 구매 + Cloudflare 연결
[ ] GitHub 레포 생성 + 코드 push
[ ] Vercel Import + 환경 변수 7개 설정
[ ] 본인 도메인 Vercel 연결 + HTTPS 자물쇠 확인
[ ] 로컬 (npm run dev) 폼 제출 → DB 저장 → 이메일 도착 확인
[ ] 프로덕션 도메인에서 동일 사이클 확인
[ ] 제한업종 URL 테스트 → 자동 분류 + 거절 메일
[ ] GTM 컨테이너 설치 + 5개 픽셀 등록
[ ] Meta Pixel Helper 등으로 픽셀 작동 확인
[ ] PageSpeed Insights LCP < 2.5s
```

---

## 🎯 다음 단계

1. **실제 광고 캠페인 운영** (Meta, Google Ads 등)
2. **A/B 테스트 시작** (Git 브랜치 활용)
3. **CRM 연동** (Slack 알림, HubSpot 등)
4. **Meta Conversions API 활성화** (환경 변수 추가만)
5. **Supabase Functions** 로 추가 자동화 (정기 리포트, Slack 알림 등)

---

**🎉 배포 완료!**

문제 발생 시:
- Vercel Logs 먼저 확인
- 트러블슈팅 섹션 참고
- GitHub Issues 또는 작업자에게 질문
