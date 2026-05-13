# PRD — 약속잡기 (Product Requirements Document)

**문서 버전**: 2.0  
**작성일**: 2026-05-13  
**연관 BRD**: BRD.md  
**현재 버전**: v2.0.0 (GitHub tag)

---

## 1. 제품 개요

약속잡기는 소규모 모임의 일정 조율을 돕는 웹앱이다. 모임장이 약속을 생성하고 링크를 공유하면 참여자가 각자의 가능 날짜를 달력에 선택하고, 시스템이 전원 가능한 날짜를 자동으로 추천한다.

### 기술 스택

| 구분 | 내용 |
|---|---|
| 프론트엔드 | 단일 HTML 파일 (`index.html`), 바닐라 JS, CSS |
| 백엔드 | Vercel Serverless Functions (`api/`) |
| 데이터베이스 | Supabase PostgreSQL (`meetings` 테이블) |
| 배포 | Vercel (GitHub push 자동 배포) |
| AI | Gemini API (`api/gemini.js` 프록시) |

---

## 2. 화면 구성

### 2-1. 홈 화면 (`sHome`)

- **내 약속 목록**: `localStorage(yaksok_admin_v2)` 기반, 기기 내 생성한 약속 표시
- **새 약속 만들기 폼**:
  - 모임 이름 입력 (필수)
  - 조사 방식 선택: `날짜만` (기본) / `날짜+점심·저녁`
  - 만들기 버튼 → 서버 저장 성공 시 약속 화면 진입

### 2-2. 약속 화면 (`sMeeting`)

3컬럼 레이아웃 (960px 이하에서 1컬럼으로 전환):

| 컬럼 | 내용 |
|---|---|
| 좌 (250px) | 참여자 목록 + 이름 입력 + 참여자 추가 |
| 중 (1fr) | 월 달력 (참여자별 색상 도트 표시) |
| 우 (290px) | 추천 날짜 목록 |

**상단 바**:
- `← 뒤로` 버튼 (내 목록에서 진입 시 표시)
- 모임 이름 (클릭 시 인라인 편집 가능)
- `📌 내 목록에 추가` 버튼 (공유 링크로 접속한 사람에게만 표시)
- `공유` 버튼 (내 목록에 있는 사람에게 표시)

---

## 3. 기능 요구사항

### FR-01 약속 생성

- 모임 이름 입력 후 "만들기 →" 클릭
- 서버(`/api/meeting`)에 데이터 저장 완료 후 화면 전환 (실패 시 오류 토스트)
- 생성된 약속은 `localStorage(yaksok_admin_v2)`에 등록
- URL이 `#m/{id}` 로 변경되어 딥링크 공유 가능

### FR-02 참여자 추가

- 이름 입력 → "참여 →" 클릭
- 동일 이름 존재 시 해당 참여자 선택 상태로 전환 (중복 생성 안 함)
- 각 참여자에게 고유 색상 자동 배정
- 참여자 클릭 → 선택/해제 토글

### FR-03 일정 선택

**날짜만 모드** (`mode: "date"`):
- 달력에서 날짜 클릭 → 해당 날짜 전체 선택/해제
- `slots[ds] = { am: true, pm: true }` 로 저장

**날짜+점심·저녁 모드** (`mode: "slot"`):
- 날짜 셀에 `점심` / `저녁` 버튼 표시
- 개별 클릭으로 선택/해제
- `slots[ds] = { am: true/false, pm: true/false }` 로 저장

### FR-04 데이터 저장

- `saveMeetingData(id, data)` 호출 시:
  1. `localStorage('yaksok_data_{id}')` 즉시 저장
  2. `POST /api/meeting?id={id}` 백그라운드 저장 (Supabase upsert)
- 약속 진입 시: 로컬 캐시 있으면 즉시 표시, 없으면 서버에서 fetch

### FR-05 공유 링크

- "공유" 버튼 클릭 → `https://yaksoklist.vercel.app/#m/{id}` 클립보드 복사
- 수신자가 링크 접속 → 서버에서 데이터 fetch → 달력 표시
- 수신자도 참여자 추가·일정 선택·편집 가능 (인증 없음)
- 수신자에게 "📌 내 목록에 추가" 버튼 표시 → 클릭 시 `yaksok_admin_v2`에 등록

### FR-06 추천 날짜

- 오른쪽 패널에 날짜별 참여 가능 인원수 계산·표시
- 전원 참석 가능한 날짜는 별도 강조 표시
- 참여자 0명이면 패널 숨김

### FR-07 모임 이름 편집

- 상단 바 모임 이름 옆 ✏️ 클릭 → 인라인 input으로 전환
- Enter 또는 blur 시 저장 (`saveMeetingData` 호출)

### FR-08 약속 삭제 (내 목록)

- 홈 화면 목록의 ✕ 버튼 → confirm 다이얼로그
- 확인 시: `yaksok_admin_v2`에서 제거 + `yaksok_data_{id}` localStorage 삭제
- 서버 데이터는 삭제하지 않음 (공유받은 다른 사람 데이터 보존)

---

## 4. 데이터 구조

### 4-1. Supabase `meetings` 테이블

```sql
id        TEXT PRIMARY KEY    -- genId() 생성 6자리 랜덤 문자열
data      JSONB NOT NULL      -- 약속 전체 데이터
created_at TIMESTAMPTZ        -- 자동 생성
```

### 4-2. `data` JSONB 구조

```jsonc
{
  "title": "MT 날짜 조율",
  "mode": "date",           // "date" | "slot"
  "createdAt": 1715000000000,
  "participants": {
    "{pid}": {
      "name": "홍길동",
      "color": "#7C3AED",
      "slots": {
        "2026-06-15": { "am": true, "pm": false }
      }
    }
  }
}
```

### 4-3. localStorage

| 키 | 값 | 설명 |
|---|---|---|
| `yaksok_admin_v2` | `JSON Array` | 내가 만든/추가한 약속 목록 |
| `yaksok_data_{id}` | `JSON Object` | 개별 약속 데이터 캐시 |

---

## 5. API 명세

### GET `/api/meeting?id={id}`

| 항목 | 내용 |
|---|---|
| 응답 (성공) | `200` + 약속 data JSON |
| 응답 (없음) | `200` + `null` |
| 응답 (id 누락) | `400` + `{ error: "id required" }` |

### POST `/api/meeting?id={id}`

| 항목 | 내용 |
|---|---|
| Body | 약속 data JSON |
| 동작 | Supabase upsert (id 충돌 시 data 덮어쓰기) |
| 응답 (성공) | `200` + `{ ok: true }` |

### POST `/api/gemini`

| 항목 | 내용 |
|---|---|
| Body | `{ model: "gemini-2.0-flash", contents: [...] }` |
| 동작 | Gemini API 프록시 (GEMINI_API_KEY 환경변수 사용) |
| 응답 | Gemini API 응답 그대로 반환 |

---

## 6. 비기능 요구사항

| 항목 | 요구사항 |
|---|---|
| 반응형 | 960px 브레이크포인트 (3컬럼 ↔ 1컬럼) |
| 오프라인 | 로컬 캐시 있을 경우 오프라인에서도 열람 가능 |
| 보안 | Supabase 서비스 키는 서버사이드(`api/`)에서만 사용, 클라이언트 노출 없음 |
| 성능 | 첫 로드 시 서버 fetch 없이 로컬 캐시로 즉시 렌더 |

---

## 7. UI/UX 규칙

- **배경색**: `#F3F4F6` (밝은 회색)
- **주 색상**: 퍼플 `#7C3AED` / hover `#6D28D9`
- **상태 피드백**: 하단 토스트 메시지 (2초 자동 사라짐)
- **로딩 표시**: 약속 생성 버튼 텍스트 "만드는 중..." 변경 + disabled
- **폰트**: `-apple-system`, `Apple SD Gothic Neo`, `Malgun Gothic`

---

## 8. 환경변수

| 변수명 | 위치 | 설명 |
|---|---|---|
| `SUPABASE_SERVICE_KEY` | Vercel 환경변수 | Supabase 서비스 롤 키 (api/meeting.js) |
| `SUPABASE_URL` | Vercel 환경변수 | Supabase 프로젝트 URL |
| `GEMINI_API_KEY` | Vercel 환경변수 | Gemini API 키 (api/gemini.js) |

로컬 개발: `vercel env pull` → `.env.local` 자동 생성

---

## 9. 버전 히스토리

| 버전 | 주요 변경 |
|---|---|
| v1.0.0 | 크로스디바이스 공유 구현 (Supabase 저장, 공유 링크) |
| v2.0.0 | 로그인 시스템 제거, localStorage 우선 저장, 데이터 소실 버그 수정 |

---

## 10. 향후 고려 기능 (Backlog)

- 실시간 동기화 (WebSocket 또는 Supabase Realtime)
- 카카오 공유하기 버튼
- 약속 만료일 설정 (일정 기간 후 자동 삭제)
- Gemini AI 활용 일정 추천 문구 생성
