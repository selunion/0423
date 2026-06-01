파업.com 운영 종료 패키지

업로드 방식
1. 이 ZIP 압축을 풉니다.
2. GitHub 저장소 루트에 전체 파일을 덮어씁니다.
3. 기존 기능 페이지가 남지 않게 하려면 아래 폴더/파일은 삭제하거나, 이 패키지의 폐쇄 페이지로 덮어씁니다.

이 패키지에 포함된 폐쇄 처리 경로
- /
- /404.html
- /directive2/
- /union_leader_message/
- /video_archive/
- /strike_plan/
- /press_release/
- /signature/
- /signature/guide.html
- /map/
- /bus/

Git 명령 예시
git add .
git commit -m "close strike site after agreement approval"
git push origin main

텔레그램 봇 중지 권장
운영 종료 후 /set 명령이 더 이상 필요 없다면 Telegram webhook 또는 Cloudflare Worker를 중지하세요.
- Telegram webhook 삭제: curl.exe "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"
- Cloudflare Worker 비활성화 또는 삭제: Cloudflare Dashboard > Workers & Pages > strike-count-bot

Cloudflare 캐시
배포 후 Cloudflare에서 Purge Everything을 한 번 실행하면 이전 화면 잔상이 줄어듭니다.
