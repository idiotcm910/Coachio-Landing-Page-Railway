import type { PublicFunnelLanding, PublicFunnelSection } from '@coachio/api-client';
import {
  buildLandingCustomHtmlFrameDocument,
  LANDING_CUSTOM_HTML_IFRAME_HEIGHT_MESSAGE,
  LANDING_CUSTOM_HTML_IFRAME_ACTION_MESSAGE,
  LANDING_CUSTOM_HTML_IFRAME_AUTH_MESSAGE,
} from '../landing-shared/landingCustomHtml';

/**
 * Xuất landing page funnel thành 1 file HTML độc lập (standalone).
 *
 * Mỗi section được nhúng trong 1 iframe `srcdoc` — y hệt cách trang live render
 * (xem `LandingSectionFrame`). Giữ iframe-per-section để CSS/script của section này
 * không đè lên section khác khi gộp chung một tài liệu. File xuất ra chạy được offline
 * (mở trực tiếp bằng trình duyệt), các nút CTA "checkout"/"scroll" vẫn hoạt động nhờ
 * một runtime nhỏ ở trang cha điều hướng tới checkout trên site gốc.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

/** Slug anchor giống `landing-section-<anchor||id>` mà trang live dùng cho scroll CTA. */
function sectionAnchorId(section: PublicFunnelSection): string {
  return `landing-section-${section.anchor || section.id}`;
}

/** Thẻ <head> SEO: title, meta description/keywords, OG, Twitter, canonical, favicon. */
function buildHeadMeta(landing: PublicFunnelLanding): string {
  const seo = landing.seo;
  const title = (seo.seo_title || landing.title || landing.product_name || '').trim();
  const tags: string[] = [
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(title)}</title>`,
  ];
  const meta = (name: string, content?: string | null) => {
    const value = content?.trim();
    if (value) tags.push(`<meta name="${name}" content="${escapeAttribute(value)}" />`);
  };
  const prop = (property: string, content?: string | null) => {
    const value = content?.trim();
    if (value) tags.push(`<meta property="${property}" content="${escapeAttribute(value)}" />`);
  };

  meta('description', seo.seo_description);
  meta('keywords', seo.seo_keywords);
  tags.push(`<meta name="robots" content="${seo.robots_index ? 'index' : 'noindex'},${seo.robots_follow ? 'follow' : 'nofollow'}" />`);
  if (seo.canonical_url?.trim()) tags.push(`<link rel="canonical" href="${escapeAttribute(seo.canonical_url.trim())}" />`);
  if (seo.favicon_url?.trim()) tags.push(`<link rel="icon" href="${escapeAttribute(seo.favicon_url.trim())}" />`);

  prop('og:type', seo.og_type || 'website');
  prop('og:title', seo.og_title || title);
  prop('og:description', seo.og_description || seo.seo_description);
  prop('og:image', seo.og_image_url);
  meta('twitter:card', seo.twitter_card || (seo.twitter_image_url ? 'summary_large_image' : 'summary'));
  meta('twitter:title', seo.twitter_title || seo.og_title || title);
  meta('twitter:description', seo.twitter_description || seo.og_description || seo.seo_description);
  meta('twitter:image', seo.twitter_image_url || seo.og_image_url);

  return tags.join('\n  ');
}

/** Runtime trang cha: tự chỉnh chiều cao iframe + xử lý CTA checkout/scroll standalone. */
function buildParentRuntime(checkoutUrl: string): string {
  return `<script>
(function () {
  var HEIGHT = ${JSON.stringify(LANDING_CUSTOM_HTML_IFRAME_HEIGHT_MESSAGE)};
  var ACTION = ${JSON.stringify(LANDING_CUSTOM_HTML_IFRAME_ACTION_MESSAGE)};
  var AUTH = ${JSON.stringify(LANDING_CUSTOM_HTML_IFRAME_AUTH_MESSAGE)};
  var CHECKOUT_URL = ${JSON.stringify(checkoutUrl)};

  function frameById(id) {
    var frames = document.querySelectorAll('iframe[data-frame-id]');
    for (var i = 0; i < frames.length; i += 1) {
      if (frames[i].getAttribute('data-frame-id') === id) return frames[i];
    }
    return null;
  }

  window.addEventListener('message', function (event) {
    var data = event.data || {};
    if (data.type === HEIGHT && data.frameId) {
      var frame = frameById(data.frameId);
      if (frame && data.height) frame.style.height = data.height + 'px';
      return;
    }
    if (data.type === ACTION) {
      if (data.action === 'checkout') {
        window.location.href = CHECKOUT_URL;
      } else if (data.action === 'scroll' && data.payload) {
        var el = document.getElementById('landing-section-' + data.payload);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  // Báo trạng thái khách (chưa đăng nhập) để các CTA [data-landing-guest-only] hiển thị.
  window.addEventListener('load', function () {
    var frames = document.querySelectorAll('iframe[data-frame-id]');
    for (var i = 0; i < frames.length; i += 1) {
      try { frames[i].contentWindow.postMessage({ type: AUTH, authenticated: false }, '*'); } catch (e) {}
    }
  });
})();
</script>`;
}

/** Build chuỗi HTML standalone hoàn chỉnh của landing page. */
export function buildFunnelLandingExportHtml(
  landing: PublicFunnelLanding,
  options: { origin: string },
): string {
  const origin = options.origin.replace(/\/+$/, '');
  const checkoutUrl = `${origin}/funnels/${landing.slug}/checkout`;
  const sections = [...landing.sections].sort((a, b) => a.sort_order - b.sort_order);

  const frames = sections
    .map((section) => {
      const frameDoc = buildLandingCustomHtmlFrameDocument(section.html, section.id, { baseHref: origin });
      return `<iframe class="landing-section" id="${escapeAttribute(sectionAnchorId(section))}" data-frame-id="${escapeAttribute(section.id)}" title="${escapeAttribute(section.name)}" loading="lazy" scrolling="no" srcdoc="${escapeAttribute(frameDoc)}"></iframe>`;
    })
    .join('\n  ');

  const lang = 'vi';
  return `<!doctype html>
<html lang="${lang}">
<head>
  ${buildHeadMeta(landing)}
  <style>
    html, body { margin: 0; padding: 0; }
    iframe.landing-section { display: block; width: 100%; border: 0; min-height: 60vh; }
  </style>
</head>
<body>
  ${frames}
  ${buildParentRuntime(checkoutUrl)}
</body>
</html>`;
}

/** Tạo tên file an toàn từ slug funnel. */
function buildFileName(slug: string): string {
  const safe = slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${safe || 'landing'}.html`;
}

/** Trigger tải file HTML xuống máy người dùng (browser-only). */
export function downloadFunnelLandingHtml(landing: PublicFunnelLanding, origin: string): void {
  const html = buildFunnelLandingExportHtml(landing, { origin });
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildFileName(landing.slug);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
