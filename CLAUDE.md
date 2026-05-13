# CLAUDE.md — 약속잡기 프로젝트

## 실행 방법

빌드 없음. `index.html`을 브라우저에서 직접 열면 동작한다.  
단, `/api/` 서버사이드 기능(Supabase 저장)은 **Vercel 환경**에서만 동작한다.

### 로컬 개발 (Vercel CLI 필요)

```bash
npm i -g vercel
vercel login          # 계정: kyl9164@ex.co.kr 과 연결된 Vercel 계정
vercel env pull       # .env.local 생성 (SUPABASE_SERVICE_KEY 등 주입)
vercel dev            # localhost:3000 에서 /api/ 포함 전체 동작
```

### 배포

GitHub push → Vercel 자동 배포  
배포 URL: **https://yaksoklist.vercel.app**  
GitHub: **https://github.com/kkang-web/yaksoklist**

---

## 아키텍처

단일 파일(`index.html`) + Vercel Serverless Functions(`api/`) 구조.  
프론트는 localStorage + 서버 API로 데이터를 이중 저장한다.

```
index.html (SPA, 화면 전환은 CSS display 토글)
  ├── sHome   — 약속 목록 + 새 약속 만들기
  └── sMeeting — 약속 내 참여자 / 달력 / 추천날짜

localStorage
  ├── yaksok_admin_v2      — 내 약속 목록 [{id, title, mode, createdAt}]
  └── yaksok_data_{id}    — 개별 약속 데이터 캐시

api/meeting.js  — Supabase meetings 테이블 CRUD 프록시 (서비스 키 사용)
api/gemini.js   — Gemini API 프록시 (GEMINI_API_KEY 환경변수)

Supabase (https://dhwlvszqenjgddwtkqjb.supabase.co)
  └── meetings 테이블: id(text PK), data(jsonb), created_at
```

---

## 데이터 구조

### 약속 데이터 (`liveData`)

```js
{
  title: "MT 날짜 조율",
  mode: "date" | "slot",   // "date" = 날짜만, "slot" = 날짜+점심/저녁
  createdAt: 1234567890,
  participants: {
    "{pid}": {
      name: "홍길동",
      color: "#7C3AED",
      slots: {
        "2025-06-15": { am: true, pm: false }  // mode=slot
        // mode=date일 때도 am/pm 둘 다 true로 저장됨
      }
    }
  }
}
```

### 내 약속 목록 (`yaksok_admin_v2` localStorage)

```js
[{ id: "abc123", title: "모임명", mode: "date", createdAt: 1234567890 }]
```

---

## 핵심 함수

| 함수 | 역할 |
|---|---|
| `goHome()` | 홈 화면으로 전환, 약속 목록 렌더 |
| `goMeeting(id)` | 약속 화면 진입 (로컬캐시 우선, 없으면 서버 fetch) |
| `createMeeting()` | 새 약속 생성 (서버 저장 후 로컬 등록) |
| `saveMeetingData(id, data)` | localStorage 즉시 저장 + 서버 백그라운드 저장 |
| `apiGet(id)` | GET /api/meeting?id=xxx |
| `apiPost(id, data)` | POST /api/meeting?id=xxx |
| `updateAddMineBtn()` | 내 목록 여부에 따라 "내 목록에 추가" 버튼 토글 |
| `render()` | 참여자 목록 + 달력 + 추천날짜 전체 재렌더 |
| `toggleDate(ds)` | 날짜만 모드에서 날짜 선택/해제 |
| `toggleSlot(ds, period)` | 점심+저녁 모드에서 슬롯 선택/해제 |
| `renderBest()` | 추천 날짜(전원 가능한 날) 계산·렌더 |

---

## 화면 전환 방식

CSS `display: none` / `.on` 클래스 토글.  
URL hash로 딥링크 지원: `#m/{id}` → 해당 약속 화면 직접 진입.

```js
// Init
const hash = location.hash.slice(1);
if (hash.startsWith('m/')) goMeeting(hash.slice(2));
else goHome();
```

---

## 공유 링크 동작

1. 생성자: `https://yaksoklist.vercel.app/#m/{id}` 공유  
2. 수신자: 링크 접속 → `goMeeting(id)` → 서버에서 데이터 fetch  
3. 수신자가 "📌 내 목록에 추가" 클릭 → `yaksok_admin_v2`에 등록  
4. 이후 수신자도 동일하게 편집 가능 (인증 없음, 누구나 수정 가능)

---

## 환경변수 (Vercel에 설정됨)

| 변수명 | 용도 |
|---|---|
| `SUPABASE_SERVICE_KEY` | Supabase 서비스 롤 키 (api/meeting.js) |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_ANON_KEY` | 현재 미사용 |
| `GEMINI_API_KEY` | Gemini API 키 (api/gemini.js) |

로컬에서는 `vercel env pull` 로 `.env.local` 생성 후 `vercel dev` 실행.

---

## UI 규칙

- 배경: 흰색 (`#F3F4F6`)
- 주 색상: 퍼플 `#7C3AED`
- 반응형: 960px 브레이크포인트 (3컬럼 → 1컬럼)
- 로그인 없음. 인증 없음.

---

## Supabase DB

```sql
create table public.meetings (
  id text primary key,
  data jsonb not null,
  created_at timestamptz default now()
);
-- RLS: 공개 read/write (서비스 키로 우회)
```

`user_meetings` 테이블도 존재하나 현재 미사용 (로그인 기능 제거됨).

---

## 버전 히스토리

- `v1.0.0` — 크로스디바이스 공유 구현 (Supabase 저장)
- `v2.0.0` — 로그인 제거, 로컬캐시 우선 저장, 데이터 소실 버그 수정
