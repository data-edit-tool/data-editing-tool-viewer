# Data Editing Tool Web Viewer

로컬 폴더로 가져온 라벨링/미디어 데이터를 확인하는 Electron 기반 viewer입니다. Vite + React로 화면을 빌드하고, Electron Builder로 데스크톱 앱을 패키징합니다.

## 요구 사항

- Node.js 18 이상 권장
- npm
- Windows 설치 파일을 만들 경우 Windows 환경에서 패키징하는 것을 권장합니다.
- macOS 또는 Linux에서 Windows 패키징을 실행하면 Electron Builder가 Wine 같은 추가 도구를 요구할 수 있습니다.

## 프로젝트 설치

저장소를 받은 뒤 프로젝트 루트에서 의존성을 설치합니다.

```bash
npm install
```

## 개발 실행

브라우저에서 Vite 개발 서버만 실행하려면 다음 명령을 사용합니다.

```bash
npm run dev
```

Electron 앱으로 개발 실행하려면 다음 명령을 사용합니다.

```bash
npm run electron:dev
```

`electron:dev`는 Vite 개발 서버를 `127.0.0.1:3000`에서 띄운 뒤 Electron 앱을 실행합니다.

## 프로덕션 빌드

배포용 정적 파일을 만들려면 다음 명령을 실행합니다.

```bash
npm run build-production
```

빌드 결과는 `dist/` 폴더에 생성됩니다.

빌드된 앱을 Electron으로 미리 확인하려면 다음 명령을 실행합니다.

```bash
npm run electron:preview
```

`electron:preview`는 `build-production`을 먼저 실행한 뒤 빌드된 `dist/` 파일을 Electron에서 엽니다.

## Windows용 패키징

64비트 Windows 설치 파일(NSIS installer)을 만들려면 다음 명령을 실행합니다.

```bash
npm run package:win
```

이 명령은 내부적으로 다음 작업을 순서대로 실행합니다.

1. `npm run build-production`
2. `electron-builder --win nsis --x64`

패키징 결과는 `release/` 폴더에 생성됩니다. 설치 파일은 `.exe` 확장자로 생성되며, 빌드 설정의 `productName`은 `Labeling tool`입니다.

## Windows 패키징 옵션

필요에 따라 아래 스크립트를 사용할 수 있습니다.

```bash
npm run package:win        # 64비트 Windows NSIS 설치 파일
npm run package:win:ia32   # 32비트 Windows NSIS 설치 파일
npm run package:win:all    # 64비트 + 32비트 Windows NSIS 설치 파일
npm run package:win:portable # 64비트 Windows portable 실행 파일
npm run package:win:dir    # 설치 파일 없이 win-unpacked 폴더만 생성
```

설치 파일 생성 전 앱 동작만 빠르게 확인하려면 `package:win:dir`로 unpacked 앱을 먼저 확인하는 방식이 유용합니다.

## macOS 패키징

macOS용 패키징은 다음 명령을 사용합니다.

```bash
npm run package:mac
```

빌드 결과는 `release/` 폴더에 생성됩니다.

## 자주 쓰는 명령어

```bash
npm install              # 의존성 설치
npm run dev              # Vite 개발 서버 실행
npm run electron:dev     # Electron 개발 실행
npm run build-production # 프로덕션 빌드
npm run electron:preview # 빌드 결과 Electron 미리보기
npm run package:win      # Windows 64비트 설치 파일 생성
```

## 참고

- Windows 설치본을 다시 만들었다면 기존 설치본을 종료한 뒤 새 `.exe`를 설치해 확인합니다.
- 패키징 산출물은 `release/`에 누적될 수 있으므로, 이전 결과와 헷갈리면 `release/` 내용을 정리한 뒤 다시 패키징합니다.
- 앱 아이콘은 `build/icon.ico`를 사용합니다.
