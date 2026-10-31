# Inthon FE 연동 안내

FE는 별도 팀원이 개발 중이며 Supabase를 직접 호출한다. DB와 지도 초기 데이터 준비가 끝났으므로 FE 연동을 시작할 수 있다.

> 검토1·검토2 화면 추가 대조 결과, 캐릭터 저장/AI 생성·현재 조명·팀 데이터는 아직 지원하지 않는다. 기존 근태·좌석·메시지·감각 계약의 연동은 가능하며, 사진 전체의 지원 여부와 결정 사항은 [화면 기능 대조 검토](./화면_기능_대조_검토.md)를 참조한다.

## 1. 현재 준비 상태

- 사용자 확인 기준 001 설치 완료: public 업무 테이블 7개, private 테이블 2개.
- Inthon 회사·1층·좌석 76개 생성 완료. 좌석 번호·배치 사용자 확인 완료.
- office-maps 비공개 버킷 및 지도 파일 업로드 완료. DB map_path와 Storage 객체 경로 일치 확인.
- 실제 사용자 세션의 Auth/Data API/RLS/지도 signed URL 통합 검증은 아직 진행 전이다.
- 001·002는 이미 적용했으므로 FE 담당자는 다시 실행하지 않는다.

## 2. 실제 연결 정보

Next.js FE의 `.env.local`에 아래 값을 설정한다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://wabyrfyvfuxtgmxaozin.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_WTj6oTOdWnCvo8aEYAKkqg_tNr9Jf5R
```

| 항목 | 실제 값 |
|---|---|
| Inthon 가입 코드 | `B1BE87F3DCE56DA709215B47` |

가입 코드는 003을 실행해 재발급한 뒤 사용자가 전달한 값이다. 가입 화면에서 입력하고 `join_company`의 `p_code`로 전달한다. `company_id`나 `floor_id`와는 다른 값이다. 만료 시각은 003 실행 결과의 `expires_at`을 따른다(발급 후 30일). 코드를 교체하면 이 문서도 갱신한다.

service_role/secret key는 FE에 사용하지 않는다. 비밀번호·사용자 access token을 이 문서에 기록하지 않는다. FE가 다른 프레임워크를 사용하면 환경 변수 이름을 해당 프레임워크 규칙에 맞춘다.

## 3. 등록 데이터

| 항목 | 값 |
|---|---|
| 회사명 | Inthon |
| company_id | ff484ad2-375d-416e-86fa-95e01f2b1323 |
| floor_id | 73625af3-9da5-41cb-a315-adb080355697 |
| 층 | 1 |
| 지도 크기 | 4938 × 2868px |
| 좌석 수 | 76 |
| 버킷 | office-maps (비공개) |
| map_path | ff484ad2-375d-416e-86fa-95e01f2b1323/73625af3-9da5-41cb-a315-adb080355697/v1/map.png |

위 ID는 초기 연동 참고값이다. 실제 로그인 후 회사 컨텍스트와 employee_id는 get_my_membership 응답에서 가져온다. floors/seats도 API로 조회한다. 실제 좌석 UUID는 DB 조회 결과를 사용하고 좌석명을 ID처럼 사용하지 않는다.

## 4. 연동 순서

1. Supabase 클라이언트 설정 및 회원가입·로그인. Confirm email 설정은 프로젝트 담당자와 확인한다.
2. `get_my_membership()` 호출. null이면 회사 가입 화면으로 이동한다.
3. `join_company` 호출 후 소속을 다시 조회한다. SDK error뿐 아니라 `data.error_code`도 검사한다.
4. 회사·층·좌석 조회. 지도는 `storage.from('office-maps').createSignedUrl(map_path,300)`으로 읽는다.
5. `choose_seat`으로 좌석 선택. 중복 오류를 표시하고 목록을 재조회한다.
6. `get_sensory_cards`로 카드·미니맵을 연결한다. 커서 페이지를 모두 조회한다.
7. 상태·메시지·감각 RPC와 이름·직책·민감도·설명 수정을 연결한다.
8. 다른 회사 접근 차단, 퇴근 초기화, 좌석 충돌, 재연결 동작을 BE와 함께 검증한다.

## 5. 꼭 맞출 계약

- 한 계정은 한 회사에만 가입한다. 로그인과 출퇴근은 별도다.
- 퇴근 시 현재 감각 6개와 메시지는 초기화하고 좌석·평소 민감도·설명은 유지한다.
- 퇴근 중 메시지·현재 감각 입력은 차단한다.
- 좌석·상태·메시지·현재 감각은 RPC만 수정한다. 직원 테이블에 `select('*')`를 사용하지 않는다.
- 카드 조회의 민감도와 현재 감각을 혼용하지 않는다. 감각 null은 미입력이며 0/3으로 바꾸지 않는다.
- 지도 좌표는 원본 이미지 전체 기준 0~1 비율이다. 이미지 종횡비·contain 여백을 반영한다.
- 좌석 점유 조회는 퇴근자를 포함한다. 퇴근한 직원 자리도 다른 직원이 선택할 수 없다.
- 변경 성공 후 재조회하며 활성 화면 5초 polling을 기본안으로 한다. 별도 Realtime 등록은 하지 않았다.
- 일반 UPDATE는 `.select('허용 컬럼').single()`로 변경 결과를 확인한다. 0행을 저장 성공으로 표시하지 않는다.

## 6. 상세 문서

- [API 명세서](./API_명세서.md): 요청·응답·오류·SDK 예시.
- [DB 스키마 명세서](./DB_스키마_명세서.md): 컬럼·관계·권한·기본안.
- [좌석 확인용 지도](./seat_map_preview.html): 저장소에서 브라우저로 열어 확인.
- [Supabase 진행 기록](./Supabase_진행_기록.md): 사용자 확인 적용 상태와 미검증 범위.
- [설계 검토 결과](./설계_검토_결과.md): 로컬 SQL 검증과 실제 서비스 검증 범위 구분.
