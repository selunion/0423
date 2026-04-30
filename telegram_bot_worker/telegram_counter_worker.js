export default {
  async fetch(request, env) {
    if (request.method === 'GET') {
      return new Response('strike-count-bot: ok', { status: 200 });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const configuredSecret = (env.TELEGRAM_SECRET_TOKEN || '').trim();
    if (configuredSecret) {
      const incomingSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
      if (incomingSecret !== configuredSecret) {
        return new Response('Forbidden', { status: 403 });
      }
    }

    let update;
    try {
      update = await request.json();
    } catch (error) {
      return new Response('Bad Request', { status: 400 });
    }

    await handleTelegramUpdate(update, env);
    return new Response('OK', { status: 200 });
  }
};

async function handleTelegramUpdate(update, env) {
  const message = update.message || update.edited_message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const fromId = message.from && message.from.id;
  const text = message.text.trim();
  const adminIds = parseAdminIds(env.TELEGRAM_ADMIN_IDS);

  if (!adminIds.has(String(fromId))) {
    await sendMessage(env, chatId, '권한이 없습니다. 관리자 Telegram ID를 TELEGRAM_ADMIN_IDS에 등록하세요.');
    return;
  }

  const command = text.replace(/\s+/g, ' ');

  if (/^\/start\b|^\/help\b/.test(command)) {
    await sendMessage(env, chatId, helpText());
    return;
  }

  if (/^\/now\b/.test(command)) {
    const current = await readCountFile(env);
    const count = current && current.data && Number.isFinite(Number(current.data.count)) ? Number(current.data.count) : 0;
    const updatedText = current && current.data && current.data.updatedText ? current.data.updatedText : '업데이트 기록 없음';
    await sendMessage(env, chatId, `현재 총파업 참가 인원: ${formatNumber(count)}명\n${updatedText}`);
    return;
  }

  const setMatch = command.match(/^\/set\s+([0-9,]+)$/i);
  if (setMatch) {
    const count = parseCount(setMatch[1]);
    if (!Number.isFinite(count) || count < 0) {
      await sendMessage(env, chatId, '숫자를 다시 확인하세요. 예: /set 32000');
      return;
    }
    const result = await writeCount(env, count, message.from, `총파업 참가 인원 ${formatNumber(count)}명 업데이트`);
    await sendMessage(env, chatId, `반영 요청 완료: ${formatNumber(count)}명\n${result.updatedText}\nGitHub Pages 배포 후 사이트에 표시됩니다. 보통 1~3분 정도 걸릴 수 있습니다.`);
    return;
  }

  const addMatch = command.match(/^\/add\s+([0-9,]+)$/i);
  if (addMatch) {
    const addValue = parseCount(addMatch[1]);
    if (!Number.isFinite(addValue)) {
      await sendMessage(env, chatId, '숫자를 다시 확인하세요. 예: /add 500');
      return;
    }
    const current = await readCountFile(env);
    const before = current && current.data && Number.isFinite(Number(current.data.count)) ? Number(current.data.count) : 0;
    const next = before + addValue;
    const result = await writeCount(env, next, message.from, `총파업 참가 인원 ${formatNumber(next)}명 업데이트`);
    await sendMessage(env, chatId, `반영 요청 완료: ${formatNumber(before)}명 → ${formatNumber(next)}명\n${result.updatedText}`);
    return;
  }

  await sendMessage(env, chatId, '알 수 없는 명령입니다. /help 를 입력하세요.');
}

function helpText() {
  return [
    '총파업 참가 인원 업데이트 봇',
    '',
    '/set 32000  → 참가 인원을 32,000명으로 설정',
    '/add 500    → 현재 인원에 500명 추가',
    '/now        → 현재 저장된 인원 확인',
    '/help       → 도움말'
  ].join('\n');
}

function parseAdminIds(value) {
  return new Set(String(value || '').split(',').map(v => v.trim()).filter(Boolean));
}

function parseCount(value) {
  return Number(String(value || '').replace(/,/g, '').trim());
}

function formatNumber(value) {
  return Math.floor(Number(value) || 0).toLocaleString('ko-KR');
}

function getCountPath(env) {
  return (env.COUNT_FILE_PATH || 'data/strike_count.json').replace(/^\/+/, '');
}

function getBranch(env) {
  return env.GITHUB_BRANCH || 'main';
}

function githubHeaders(env) {
  return {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'strike-count-bot'
  };
}

async function readCountFile(env) {
  const path = encodeURIComponent(getCountPath(env)).replace(/%2F/g, '/');
  const branch = encodeURIComponent(getBranch(env));
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}?ref=${branch}`;
  const res = await fetch(url, { headers: githubHeaders(env) });
  if (res.status === 404) return { sha: null, data: null };
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub read failed: ${res.status} ${body}`);
  }
  const json = await res.json();
  const decoded = json.content ? fromBase64(json.content) : '{}';
  let data = {};
  try { data = JSON.parse(decoded); } catch (error) { data = {}; }
  return { sha: json.sha, data };
}

async function writeCount(env, count, from, commitMessage) {
  const current = await readCountFile(env);
  const now = new Date();
  const updatedText = formatKst(now) + ' 기준';
  const payload = {
    count: Math.floor(count),
    updatedAt: now.toISOString(),
    updatedText,
    source: 'telegram',
    updatedBy: {
      id: from && from.id ? from.id : null,
      username: from && from.username ? from.username : null,
      name: [from && from.first_name, from && from.last_name].filter(Boolean).join(' ')
    }
  };

  const path = encodeURIComponent(getCountPath(env)).replace(/%2F/g, '/');
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  const body = {
    message: commitMessage || `update strike count to ${count}`,
    content: toBase64(JSON.stringify(payload, null, 2)),
    branch: getBranch(env)
  };
  if (current.sha) body.sha = current.sha;

  const res = await fetch(url, {
    method: 'PUT',
    headers: githubHeaders(env),
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub write failed: ${res.status} ${text}`);
  }
  return payload;
}

function formatKst(date) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(String(b64 || '').replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function sendMessage(env, chatId, text) {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}
