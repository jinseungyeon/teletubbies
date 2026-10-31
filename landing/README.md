# Senspace B2B landing

`Senspace B2B.dc.html`의 공개 홈페이지를 React로 구현했습니다. 헤더, 히어로, 서비스 소개, 네 가지 기능 소개, 도입 과정, 문의, 야간 오피스 푸터를 포함합니다. 제공된 이미지와 캐릭터 렌더러를 재사용했습니다.

## 실행

Node.js 24에서 검증했습니다. **이 폴더에서** 실행합니다.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

## 개별 배포

`be`, `fe`, `landing`은 별도 앱입니다. 저장소 전체를 하나의 앱으로 빌드하지 않습니다.

| 설정 | 값 |
| --- | --- |
| 서비스 루트 / Root directory | `landing` |
| 설치 명령 | `npm ci` |
| 빌드 명령 | `npm run build` |
| 정적 파일 출력 | `dist` |

React와 Vite 의존성, 잠금 파일, 빌드 설정은 이 폴더에만 있습니다. `be`/`fe` 소스를 import하지 않습니다. `/` 및 하위 경로에 정적 호스팅할 수 있습니다. 별도 클라이언트 라우터가 없으므로 SPA fallback은 필요하지 않습니다.

### 배포 환경 변수

`.env.example`을 참고하여 **빌드 전에** 배포 서비스에 설정합니다. Vite 변수는 공개되는 클라이언트 설정입니다. 비밀 키를 넣지 마세요.

- `VITE_APP_URL`: 별도 배포한 `fe`의 로그인 페이지 전체 주소. 미설정 시 조직 로그인 안내 창을 표시합니다.
- `VITE_CONTACT_ENDPOINT`: 문의를 받을 서버의 전체 주소. `POST multipart/form-data`를 받도록 연결하고 랜딩 도메인을 CORS에서 허용해야 합니다. 필드: `company`, `name`, `email`, `size`, `msg`, 선택 파일 `attachment`. 2xx 응답에서만 접수 완료를 표시합니다. 서버에서도 입력 및 파일 검증이 필요합니다.

현재 저장소에서 문의 접수 API는 확인되지 않아 임의의 API 경로를 가정하지 않았습니다. `VITE_CONTACT_ENDPOINT`가 비어 있으면 입력값으로 메일 초안을 작성합니다. 사용자가 메일 앱에서 직접 보내야 하며 첨부 자료도 메일에 직접 넣어야 합니다. 사이트는 이 경우 접수 완료라고 표시하지 않습니다.

최대 첨부 크기는 10MB입니다. 온라인 글꼴(Pretendard, Galmuri)은 jsDelivr에서 불러오며 시스템 글꼴 fallback이 있습니다. 지도와 알림 화면은 기능을 설명하는 예시입니다. 실제 오피스와 인증 기능은 `fe`에서 제공합니다.

## 작업 이력과 복원

각 섹션은 `landing-website` 브랜치에서 별도로 커밋했습니다.

```sh
git log --oneline -- landing
```

특정 시점의 작업을 보존하며 확인하려면 해당 커밋에서 새 브랜치를 만듭니다.

```sh
git switch -c landing-checkpoint <commit-hash>
```

작업을 되돌리는 기록을 남기려면 `git revert <commit-hash>`를 사용하세요. 후속 섹션이 먼저 추가된 컴포넌트를 참조하면 충돌을 해결해야 할 수 있습니다. `main`에 푸시하거나 병합하지 않았습니다.
