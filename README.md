# NEON YARD — 브라우저 온라인 FPS

설치 없이 URL 접속 → 닉네임 입력 → PLAY. Three.js + Express + Socket.IO.

## 폴더 구조
```
neon-yard/
├─ server.js        서버: 접속/닉네임 검증, 이동 검증, 사격·피해·킬·리스폰(서버 판정), 속도·이벤트 제한
├─ data/map.json    맵 데이터 (서버 레이캐스트와 클라이언트 렌더/충돌이 공유)
├─ public/
│  ├─ index.html    홈페이지, HUD, 오버레이
│  ├─ style.css     네온 스타일
│  └─ main.js       렌더링, 입력, 이동/충돌, 네트워크, 효과, 사운드
├─ render.yaml      Render 배포 설정
└─ package.json
```

## Windows에서 실행
1. https://nodejs.org 에서 **LTS(18 이상)** 설치
2. ZIP 압축 해제 → 폴더에서 주소창에 `cmd` 입력 → 엔터
3. `npm install` → `npm start`
4. 브라우저(Chrome/Edge)에서 http://localhost:3000
5. 탭 두 개를 열어 서로 다른 닉네임으로 접속하면 서로 보입니다.
6. 같은 와이파이의 다른 PC: `ipconfig`의 IPv4 주소로 `http://192.168.x.x:3000` (Windows 방화벽에서 Node.js 허용 필요)

환경 변수: `PORT`(기본 3000), `MAX_PLAYERS`(기본 16), `MAX_PER_IP`(기본 4)

## 인터넷 배포 (Render, 무료)
1. GitHub 계정 생성 → 새 저장소 만들기 → 이 폴더를 업로드(또는 `git push`). `node_modules`는 올리지 않습니다(.gitignore 처리됨).
2. https://render.com 가입 → **New + → Web Service** → GitHub 저장소 선택
3. Build Command `npm install`, Start Command `npm start` (render.yaml이 있으면 자동 입력), Plan **Free**
4. Deploy 완료 후 상단에 표시되는 `https://이름.onrender.com` 이 공개 URL입니다. HTTPS와 WebSocket은 Render가 자동 처리합니다.
5. 이 URL을 친구에게 공유하면 됩니다.

Railway도 동일: New Project → Deploy from GitHub → Settings → Networking → Generate Domain.

**무료 플랜 제약(Render):** 15분 무접속 시 절전 → 첫 접속에 약 30~60초 지연, 월 무료 시간 제한, 단일 소형 인스턴스라 동시 접속 약 10~16명 권장. 서버는 메모리 상태이므로 재시작 시 킬/데스 기록이 초기화됩니다. 인스턴스를 2개 이상으로 늘리면 방이 분리되므로 늘리지 마세요.

## 테스트 절차 (직접 수행)
1. `npm start` → "listening on :3000" 출력
2. 홈페이지 접속 → 서버 "연결됨", 접속자 수 표시 확인
3. 탭 2개로 접속 → 서로 모델/닉네임 표시
4. 이동·시점·점프·달리기가 상대 화면에 반영되는지 확인
5. 사격 → 4발(몸) 또는 2발(헤드샷)로 사망, 3초 후 리스폰, Tab 킬보드 K/D 갱신
6. 탭 닫기 → 상대 화면에서 퇴장 처리, 재접속 가능
7. 서버 종료 → "연결 끊김" 화면 → 서버 재시작 후 [다시 접속]
8. 배포 URL에서 다른 PC/모바일 데이터로 접속해 위 과정 반복

## 보안/안정성
닉네임 검증·중복 방지, 서버 보관 체력·탄약·연사 간격, 서버 레이캐스트 판정(벽 차폐 포함), 이동 속도 검증(초과 시 위치 되돌림), 이동 패킷 초당 60회·전체 이벤트 초당 120회 제한, IP당 접속 제한, 최대 인원 제한, 패킷 크기 제한.

## 미구현 / 추가 작업 필요
- 지연 보상(lag compensation) 없음 — 핑이 높으면 맞추기 어려울 수 있음
- 이동은 클라이언트 예측 + 서버 속도 검증 방식(벽 통과/비행 핵을 완전히 막지는 못함)
- 모바일/게임패드, 방(룸) 분리, 무기 종류, 영구 랭킹(DB), 음성 에셋(현재 합성음) 미구현
- 다른 플레이어 모델은 단순 블록형
