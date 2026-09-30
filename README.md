# Hotel PMS Web

[![CI](https://github.com/Achan-one/hotel-pms-web/actions/workflows/ci.yml/badge.svg)](https://github.com/Achan-one/hotel-pms-web/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-19-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6)
![Vite](https://img.shields.io/badge/Vite-8-646cff)

191실 호텔의 프론트 데스크 직원이 쓰는 **PMS 운영 화면**입니다. 룸 랙, 예약 관리, 일괄 자동 배정, 폴리오(회계 원장), 태그 관리, CSV 리포트를 한 화면 체계로 제공합니다.

> 백엔드: [hotel-pms-ai](https://github.com/Achan-one/hotel-pms-ai) (Spring Boot). 이 화면은 백엔드 없이는 동작하지 않습니다. 도메인 규칙과 API, 설계 배경은 백엔드 README에 있습니다.

<!--
  화면 캡처를 docs/images 에 넣고 아래 주석을 풀어 주세요. (권장: 룸 랙, 예약 그리드, 일괄 배정, 태그 객실 매트릭스)
  ![룸 랙](docs/images/room-rack.png)
-->

## 화면 구성

| 화면 | 설명 |
|---|---|
| **룸 매트릭스** | 층별 191실을 상태 색으로 보여 준다. 칸에 마우스를 올리면 객실 타입, 고객명, 투숙 기간, **보유 태그 이름**이 나온다. |
| **예약 그리드** | 첫 열이 **PMS 예약번호**이고, OTA 예약번호·예약ID 열이 함께 있다. 한 검색창에서 PMS 번호 / OTA 예약번호 / 예약ID 어느 것으로든 찾고, 성명·상태·채널·체크인·재실일로 좁힐 수 있다. 서버 페이징 응답을 마지막 페이지까지 이어 받는다. |
| **예약 상세** | 현장 정보 수정, 수동 배정·배정 취소·룸체인지, 태그 수정, 일자별 요금, 폴리오(이용 명세·수납) 등록. |
| **일괄 자동 배정 / 해제** | 체크인 일자를 골라 미배정 예약을 한 번에 배정하고, 배정 완료 예약을 한 번에 해제한다. **관리자에게만** 배정 점수 내역 CSV 내보내기가 보인다. |
| **태그 사전 관리** | 태그 사전(목록·편집·객실 매핑)과 **객실 매트릭스** 탭. 태그를 골라 그 태그를 모두 가진 방을 도면에서 강조한다. 새 태그 등록은 관리자만 가능. |
| **리포트 엑스포트** | 숙박자 리스트와 예약자 리스트는 **시작일~종료일** 기간으로, 같은 날짜를 넣으면 그날만 받는다. |
| **OTA 정산 / 직원 계정** | City Ledger 조회, 직원 계정 발급(관리자). |

### 동시에 여러 직원이 쓸 때

* **일괄 배정·해제가 도는 동안** 모든 직원 화면 위에 진행 배너가 뜨고, 예약 상세는 **읽기 전용(미리보기)** 으로 열린다. 진행 상태는 3초마다 확인하며(`hooks/useBatchStatus.ts`), 끝나면 룸 매트릭스를 다시 읽는다.
* 화면에서 막는 것과 별개로 **서버가 변경 요청을 `423`으로 거절**하므로, 화면을 우회해도 데이터는 바뀌지 않는다.
* 다른 직원이 같은 예약을 편집 중이면 예약 상세는 역시 읽기 전용이다. 동시에 수정해 충돌하면 서버가 `409`를 돌려주고 메시지가 화면에 표시된다.

### 권한별 화면

| 역할 | 볼 수 있는 것 |
|---|---|
| 관리자 (`ROLE_ADMIN`) | 전체 + 태그 등록, 직원 계정 발급, 배정 점수 내역 내보내기 |
| 정직원 (`ROLE_STAFF`) | 배정, 룸체인지, 일괄 배정·해제, 나이트 오딧, 태그 수정 |
| 아르바이트 (`ROLE_PART_TIME`) | 룸 랙, 예약 조회, 체크인·아웃, 폴리오 (내부 메모는 숨김) |

화면에서 버튼을 숨기는 것은 편의일 뿐이고, 실제 권한은 서버(JWT + 역할)가 검사한다.

## 기술 스택

React 19 · TypeScript · Vite · Tailwind CSS 4 · axios · lucide-react · oxlint

* 로그인 토큰은 탭마다 독립적으로 `sessionStorage`에 저장한다(탭 간 세션 격리). `401`을 받으면 세션을 정리하고 로그인 화면으로 돌아간다.
* API 호출은 `src/api/client.ts`(axios 인스턴스, 토큰 주입)와 `src/api/pmsService.ts`(엔드포인트별 함수)에 모여 있다.

## 실행 방법

요구 사항: Node.js 22 이상, 실행 중인 백엔드([hotel-pms-ai](https://github.com/Achan-one/hotel-pms-ai)).

```bash
npm ci
npm run dev        # http://localhost:5173
```

백엔드 주소는 `VITE_API_BASE_URL`로 바꿀 수 있고 기본값은 `http://localhost:8080`이다. `.env.local`에 적으면 된다.

```env
VITE_API_BASE_URL=http://localhost:8080
```

> 백엔드의 CORS 허용 목록은 `http://localhost:5173`, `http://localhost:3000`이다. 다른 주소에서 띄우면 백엔드 `SecurityConfig`도 맞춰야 한다.
> 개발자 콘솔(가상 예약 인입, 초기화) 화면은 백엔드를 `dev` 프로필로 띄웠을 때만 동작한다.

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (HMR) |
| `npm run lint` | oxlint. 오류가 있으면 실패하고, 경고만 있으면 통과한다. |
| `npm run build` | 타입 검사(`tsc -b`) 후 프로덕션 번들 |
| `npm run preview` | 빌드 결과 미리보기 |

푸시와 PR마다 GitHub Actions가 `npm ci` → `lint` → `build`를 실행한다.

## 폴더 구조

```
src
├─ api/           axios 클라이언트, 백엔드 엔드포인트 호출 함수와 DTO 타입
├─ components/    화면 컴포넌트
│  ├─ RoomMatrixGrid.tsx     191실 도면 뼈대 (룸 랙과 태그 객실 매트릭스가 공유)
│  ├─ RoomTagMatrixView.tsx  태그별 보유 객실 보기
│  ├─ ReservationGridView.tsx / ReservationDetailView.tsx
│  ├─ TagManagementView.tsx / ExportReportView.tsx / ...
│  └─ tagDisplay.ts          태그 코드 → 이름 변환, 툴팁 문구
├─ hooks/         useBatchStatus (일괄 작업 진행 상태 확인)
└─ types/         공용 타입
```

## 알려진 한계

* 자동화된 화면 테스트(컴포넌트/E2E)가 없다. 지금은 타입 검사, lint, 빌드, 백엔드 API 테스트로 보호한다.
* `App.tsx`가 크다(상태와 탭 렌더링이 한곳에 있음). 기능이 더 늘면 탭별로 분리하는 것이 좋다.
* 일괄 작업 진행 상태는 3초 주기 폴링이라 배너가 뜨기까지 최대 3초가 걸린다(그 사이의 변경 요청은 서버가 거절한다). 서버 푸시(SSE)로 바꿀 수 있다.
* 룸 매트릭스 툴팁은 브라우저 기본 `title` 툴팁이라 서식이 단순하다.
