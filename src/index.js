import { fail } from './util.js';
import { getContent, processPendingMedia } from './db.js';
import { serveCalendar } from './ics.js';
import { handlePublicApi, serveMedia, serveVideoPoster, serveBrochure } from './api-public.js';
import { handleHostApi } from './api-host.js';
import { trackable, trackView } from './track.js';
import { brochurePage, brochureErrorPage, hostPage } from './render/growth.js';
import { handleAdminApi } from './api-admin.js';
import { html } from './render/layout.js';
import { homePage, venuesPage, venuePage, casesPage, inquiryPage, myPage, guidePage, notFoundPage } from './render/pages.js';

let lastPending = 0;

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processPendingMedia(env, 12).catch((e) => console.error(e)));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : '/';
    try {
      if (p.startsWith('/api/admin')) return await handleAdminApi(request, env, ctx, url);
      if (p.startsWith('/api/host')) return await handleHostApi(request, env, ctx, url);
      if (p.startsWith('/api/')) return await handlePublicApi(request, env, ctx, url);

      const media = p.match(/^\/media\/(\d+)$/);
      if (media) return await serveMedia(request, env, ctx, media[1]);
      const poster = p.match(/^\/media\/dv\/([A-Za-z0-9_-]{20,80})$/);
      if (poster) return await serveVideoPoster(request, env, ctx, poster[1]);
      const cal = p.match(/^\/calendar\/([A-Za-z0-9_-]{16,80})\.ics$/);
      if (cal) return await serveCalendar(request, env, cal[1]);

      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });

      const content = await getContent(env);
      const origin = url.origin;
      // 아직 받지 못한 드라이브 사진을 가끔 이어서 받습니다(15분마다 도는 예약 작업과 별도로)
      if (content.dbReady && Date.now() - lastPending > 300000) {
        lastPending = Date.now();
        ctx.waitUntil(processPendingMedia(env, 4).catch(() => {}));
      }

      // 방문 집계(공개 페이지만, 하루 단위 숫자)
      if (content.dbReady && request.method === 'GET' && trackable(p)) ctx.waitUntil(trackView(env, request, p));

      const dl = p.match(/^\/brochure\/download\/([A-Z0-9-]{8,30})\/([A-Za-z0-9_-]{16,60})\/([a-z0-9-]+)$/);
      if (dl) {
        const r = await serveBrochure(request, env, ctx, dl[1], dl[2], dl[3]);
        if (r.res) return r.res;
        return html(brochureErrorPage(content, origin, r.error), 404, { 'cache-control': 'no-store' });
      }
      if (p === '/brochure') return html(brochurePage(content, origin, url.searchParams.get('venue') || ''));
      if (p === '/host') return html(hostPage(content, origin));

      if (p === '/') return html(homePage(content, origin));
      if (p === '/venues') return html(venuesPage(content, origin));
      const vm = p.match(/^\/venues\/([a-z0-9-]+)$/);
      if (vm) {
        const v = content.venues.find((x) => x.slug === vm[1]);
        if (v) return html(venuePage(content, origin, v));
      }
      if (p === '/cases') return html(casesPage(content, origin));
      if (p === '/inquiry') return html(inquiryPage(content, origin));
      if (p === '/my') return html(myPage(content, origin), 200, { 'cache-control': 'no-store' });
      if (p === '/guide') return html(guidePage(content, origin));

      if (p === '/robots.txt') {
        const site = (content.settings.site_url || origin).replace(/\/$/, '');
        return new Response(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /my\nDisallow: /host/center\nDisallow: /brochure/download\n\nSitemap: ${site}/sitemap.xml\n`, {
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      }
      if (p === '/sitemap.xml') {
        const site = (content.settings.site_url || origin).replace(/\/$/, '');
        const paths = ['/', '/venues', ...content.venues.map((v) => `/venues/${v.slug}`), '/cases', '/guide', '/brochure', '/inquiry', '/host'];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
          .map((x) => `  <url><loc>${site}${x}</loc></url>`)
          .join('\n')}\n</urlset>\n`;
        return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
      }

      // 정적 파일(관리자 화면 등)은 assets에서 찾고, 없으면 404 페이지
      if (env.ASSETS) {
        const res = await env.ASSETS.fetch(request);
        if (res.status !== 404) return res;
      }
      return html(notFoundPage(content, origin, p), 404);
    } catch (e) {
      console.error(e && e.stack ? e.stack : e);
      if (p.startsWith('/api/')) return fail(e && /요청|JSON/.test(e.message || '') ? 400 : 500, e && /요청/.test(e.message || '') ? e.message : '처리 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.');
      return new Response('일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
  },
};
