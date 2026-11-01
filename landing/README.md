# Senspace Landing

Next.js App Router 기반 B2B 서비스 소개 페이지입니다.

## 실행

Node.js 24를 사용합니다. `landing` 폴더에서 실행하세요.

```sh
npm ci
npm run dev
```

## 빌드 및 테스트

```sh
npm test
npm run build
npm start
```

## 배포

| 설정 | 값 |
| --- | --- |
| 루트 디렉터리 | `landing` |
| 프레임워크 | Next.js |
| 설치 명령 | `npm ci` |
| 빌드 명령 | `npm run build` |
| 출력 디렉터리 | Next.js 기본값 (`.next`) |

`be`, `fe`와 별도로 배포합니다.

## 환경 변수

`.env.example`을 참고하여 빌드 전에 설정합니다.

- `NEXT_PUBLIC_APP_URL`: `fe` 로그인 페이지 주소. 미설정 시 로그인 안내를 표시합니다.
- `NEXT_PUBLIC_CONTACT_ENDPOINT`: 문의 접수 API 주소. 미설정 시 메일 초안을 작성하며, 사용자가 메일 앱에서 직접 전송해야 합니다. 첨부 파일도 메일에 직접 넣어야 합니다.

문의 API는 `POST multipart/form-data`로 `company`, `name`, `email`, `size`, `msg`, 선택 파일 `attachment`를 받습니다. 2xx 응답을 접수 성공으로 처리합니다. 서버에서 랜딩 도메인의 CORS 접근을 허용하고 입력 및 파일을 검증해야 합니다. 첨부 파일은 최대 10MB입니다.

환경 변수는 클라이언트에 공개되므로 비밀 키를 넣지 않습니다.
