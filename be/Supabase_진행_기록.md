# Supabase 진행 기록

사용자가 Supabase Dashboard/SQL Editor에서 실행하고 대화로 확인한 결과다. 에이전트가 원격 DB에 직접 연결해 확인한 기록은 아니다.

## 완료

- 001 전체 설치 후 public 업무 테이블 7개와 private 테이블 2개 확인.
- `office-maps` 버킷 존재 및 SQL 조회 결과 public=false 확인.
- 원본 지도: `fe/정보관_1층.png`, 4938×2868px. 전체 의자 76개를 등록하기로 결정.
- 확인용 지도를 사용자가 브라우저에서 열고 좌석 번호·배치를 확인 완료.
- 회사명 Inthon 확정 후 002 실행. seats_created=76 확인.
- 회사 ID: `ff484ad2-375d-416e-86fa-95e01f2b1323`.
- 층 ID: `73625af3-9da5-41cb-a315-adb080355697`. floor_number=1.
- 지도 경로: `ff484ad2-375d-416e-86fa-95e01f2b1323/73625af3-9da5-41cb-a315-adb080355697/v1/map.png`.
- 원본과 SHA-256이 동일한 `be/storage_upload/map.png` 복사본 준비 및 사용자 업로드 완료.
- floors·seats·storage.objects 연결 조회 결과: floor_number=1, seat_count=76, image_uploaded=true.

가입 코드 원문은 이 기록에 저장하지 않는다. 002 결과의 원문을 사용자가 별도 보관한다.

## 다음 단계

1. Auth 이메일 로그인·이메일 확인 설정 확인.
2. 실제 계정 가입·로그인 및 사용자 세션으로 RPC 호출 확인.
3. 회사 가입 → 좌석 선택 → 출근 → 메시지·감각 입력 → 퇴근의 전체 흐름 확인.
4. 다른 직원·다른 회사 권한과 실제 지도 다운로드 검증.

SQL Editor의 운영자 조회로 지도 파일 경로 존재는 확인했지만, 실제 직원 세션의 지도 접근 권한과 signed URL 발급은 아직 검증하지 않았다. 001·002는 다시 실행하지 않는다.
