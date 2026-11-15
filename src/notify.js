// 새 문의·고객 메시지·견적 응답이 오면 설정에 등록된 알림 주소(슬랙·디스코드 등 웹훅)로 알려줍니다.
export function notify(env, ctx, settings, text) {
  const url = settings?.notify?.webhook;
  if (!url || !/^https:\/\//.test(url)) return;
  const job = fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, content: text }),
  }).catch(() => {});
  if (ctx?.waitUntil) ctx.waitUntil(job);
}
