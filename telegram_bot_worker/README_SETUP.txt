# Telegram 봇으로 총파업 참가 인원 업데이트하기

이 패키지는 정적 GitHub Pages 사이트에서 `data/strike_count.json`을 읽어 메인 페이지의 **총파업 참가 인원**을 표시하고, Telegram 봇 명령으로 그 JSON 파일을 GitHub에 커밋해 업데이트하는 구조입니다.

## 동작 방식

1. 메인 페이지가 `/data/strike_count.json`을 읽습니다.
2. Telegram에서 관리자만 `/set 32000` 같은 명령을 보냅니다.
3. Cloudflare Worker가 Telegram webhook을 받아 GitHub API로 `data/strike_count.json`을 수정합니다.
4. GitHub Pages 배포가 끝나면 사이트 숫자가 갱신됩니다.

## Telegram 명령어

```text
/set 32000   참가 인원을 32,000명으로 설정
/add 500     현재 인원에 500명 추가
/now         현재 저장된 인원 확인
/help        도움말
```

## GitHub Pages 업로드

ZIP 루트의 파일 전체를 기존 GitHub Pages repo 루트에 덮어씌우세요.

중요 파일:

```text
CNAME
.nojekyll
index.html
data/strike_count.json
telegram_bot_worker/
```

`CNAME`은 반드시 repo 루트에 있어야 합니다.

## Cloudflare Worker 배포

### 1. Worker 폴더로 이동

```powershell
cd telegram_bot_worker
copy wrangler.toml.example wrangler.toml
```

`wrangler.toml`에서 아래 값을 실제 GitHub repo 기준으로 바꾸세요.

```text
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
TELEGRAM_ADMIN_IDS
```

`TELEGRAM_ADMIN_IDS`는 봇에게 `/start`를 보낸 사람의 숫자 ID입니다. 모르면 Telegram에서 `@userinfobot` 등으로 확인하세요.

### 2. 비밀값 등록

```powershell
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_SECRET_TOKEN
npx wrangler secret put GITHUB_TOKEN
```

- `TELEGRAM_BOT_TOKEN`: BotFather가 준 토큰
- `TELEGRAM_SECRET_TOKEN`: 아무 긴 문자열. 예: `make-long-random-secret-2026`
- `GITHUB_TOKEN`: GitHub fine-grained token. 해당 repo Contents Read/Write 권한 필요

### 3. Worker 배포

```powershell
npx wrangler deploy
```

배포 후 Worker URL이 나옵니다. 예:

```text
https://strike-count-bot.YOUR_ACCOUNT.workers.dev
```

### 4. Telegram webhook 연결

아래 명령에서 `<BOT_TOKEN>`, `<WORKER_URL>`, `<SECRET>`를 바꾸세요.

```powershell
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" ^
  -F "url=<WORKER_URL>" ^
  -F "secret_token=<SECRET>"
```

예:

```powershell
curl -X POST "https://api.telegram.org/bot123456:ABC/setWebhook" ^
  -F "url=https://strike-count-bot.example.workers.dev" ^
  -F "secret_token=make-long-random-secret-2026"
```

## 테스트

Telegram에서 봇에게:

```text
/set 32000
```

응답이 오면 1~3분 후 사이트에서 숫자가 바뀝니다.

브라우저에서 직접 확인:

```text
https://www.xn--5h5bv6v.com/data/strike_count.json
```

## 운영 주의

- `TELEGRAM_BOT_TOKEN`, `GITHUB_TOKEN`은 사이트 파일에 절대 올리지 마세요.
- Worker secret에만 넣으세요.
- `signature/` 폴더는 기존 파일 그대로 두었습니다.
