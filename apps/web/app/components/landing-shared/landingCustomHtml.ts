import { scopeLandingCustomStyleTags } from './landingCustomCssScope';

export interface LandingCustomScript {
  attributes: Record<string, string>;
  content: string;
}

export interface ParsedLandingCustomHtml {
  html: string;
  scripts: LandingCustomScript[];
}

export const LANDING_CUSTOM_HTML_IFRAME_HEIGHT_MESSAGE = 'course-landing-custom-html:height';
export const LANDING_CUSTOM_HTML_IFRAME_ERROR_MESSAGE = 'course-landing-custom-html:error';
/** Posted when a user clicks an in-iframe CTA that must reach the React app
 *  (e.g. open the checkout / auth modal that lives in the parent document). */
export const LANDING_CUSTOM_HTML_IFRAME_ACTION_MESSAGE = 'course-landing-custom-html:action';
/** Parent -> iframe: current auth state, so the iframe can hide `[data-landing-guest-only]`
 *  CTAs once the user is logged in. */
export const LANDING_CUSTOM_HTML_IFRAME_AUTH_MESSAGE = 'course-landing-custom-html:auth-state';
export const LANDING_CUSTOM_HTML_BEFORE_REPLAY_EVENT = 'coachio:landing-section-before-replay';
export const LANDING_CUSTOM_HTML_AFTER_REPLAY_EVENT = 'coachio:landing-section-after-replay';

export function buildLandingCustomHtmlReplayKey(sectionId: string, theme: string): string {
  return `${sectionId}:${theme}`;
}

function attributesToRecord(attributeText: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>`]+)))?/g;
  let match = pattern.exec(attributeText);
  while (match) {
    attributes[match[1]] = match[2] ?? match[3] ?? match[4] ?? '';
    match = pattern.exec(attributeText);
  }
  return attributes;
}

function extractScripts(html: string): { html: string; scripts: LandingCustomScript[] } {
  const scripts: LandingCustomScript[] = [];
  const nextHtml = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (_match, attributes: string, content: string) => {
    scripts.push({
      attributes: attributesToRecord(attributes || ''),
      content: (content || '').trim(),
    });
    return '';
  });
  return { html: nextHtml.trim(), scripts };
}

function getAttributeValue(tag: string, attributeName: string): string {
  const pattern = new RegExp(`${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i');
  const match = tag.match(pattern);
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
}

function shouldKeepHeadAsset(tag: string): boolean {
  if (!/^<link\b/i.test(tag)) return true;
  const rel = getAttributeValue(tag, 'rel').toLowerCase();
  return ['stylesheet', 'preconnect', 'dns-prefetch', 'preload', 'modulepreload'].includes(rel);
}

function extractInlineHeadAssets(html: string): string[] {
  const assets: string[] = [];
  const pattern = /<style\b[^>]*>[\s\S]*?<\/style>|<link\b[^>]*>|<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi;
  let match = pattern.exec(html);
  while (match) {
    if (shouldKeepHeadAsset(match[0])) {
      assets.push(match[0]);
    }
    match = pattern.exec(html);
  }
  return assets;
}

export function parseLandingCustomHtml(source: string): ParsedLandingCustomHtml {
  const raw = source.trim();
  if (!raw) return { html: '', scripts: [] };

  const { html: htmlWithoutScripts, scripts } = extractScripts(raw);
  const headMatch = htmlWithoutScripts.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = htmlWithoutScripts.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);

  if (!headMatch && !bodyMatch) {
    return { html: htmlWithoutScripts, scripts };
  }

  const headStyles = extractInlineHeadAssets(headMatch?.[1] || '').join('\n');
  const bodyHtml = (bodyMatch?.[1] || htmlWithoutScripts).trim();

  return {
    html: [headStyles, bodyHtml].filter(Boolean).join('\n'),
    scripts,
  };
}

export function buildLandingCustomHtmlInlineRender(
  source: string,
  scopeSelector?: string,
): ParsedLandingCustomHtml {
  const parsed = parseLandingCustomHtml(source);
  if (!scopeSelector) return parsed;
  // Scope every <style> block so admin-pasted global CSS (body, *, h1, :root, ...)
  // cannot leak onto the React chrome (header / auth modal) rendered in the same document.
  return { ...parsed, html: scopeLandingCustomStyleTags(parsed.html, scopeSelector) };
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function removeCspMetaTags(value: string): string {
  return value.replace(/<meta\b(?=[^>]*http-equiv\s*=\s*["']?content-security-policy["']?)[^>]*>/gi, '');
}

function buildBaseTag(baseHref?: string): string {
  const safeBaseHref = baseHref?.trim();
  if (!safeBaseHref) return '<base target="_parent" />';
  return `<base href="${escapeHtmlAttribute(safeBaseHref)}" target="_parent" />`;
}

function injectBaseTag(source: string, baseHref?: string): string {
  if (/<base\b/i.test(source)) return source;
  const baseTag = buildBaseTag(baseHref);

  if (/<head\b[^>]*>/i.test(source)) {
    return source.replace(/<head\b[^>]*>/i, (match) => `${match}${baseTag}`);
  }

  if (/<html\b[^>]*>/i.test(source)) {
    return source.replace(/<html\b[^>]*>/i, (match) => `${match}<head>${baseTag}</head>`);
  }

  return source;
}

function buildIframeRuntimeScript(frameId: string): string {
  const messageType = JSON.stringify(LANDING_CUSTOM_HTML_IFRAME_HEIGHT_MESSAGE);
  const errorMessageType = JSON.stringify(LANDING_CUSTOM_HTML_IFRAME_ERROR_MESSAGE);
  const actionMessageType = JSON.stringify(LANDING_CUSTOM_HTML_IFRAME_ACTION_MESSAGE);
  const authMessageType = JSON.stringify(LANDING_CUSTOM_HTML_IFRAME_AUTH_MESSAGE);
  const serializedFrameId = JSON.stringify(frameId);

  return `<script>
(function () {
  var frameId = ${serializedFrameId};
  var messageType = ${messageType};
  var errorMessageType = ${errorMessageType};
  var actionMessageType = ${actionMessageType};
  var authMessageType = ${authMessageType};
  var lastHeight = 0;
  var isAuthenticated = false;

  // Action bridge: in-iframe CTAs can't call React directly (isolated realm), so
  // forward them to the parent. [data-workshop-checkout-trigger] -> 'checkout';
  // [data-landing-action="auth|login|register|scroll"] -> that action (+ optional payload).
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    var trigger = target.closest('[data-workshop-checkout-trigger],[data-landing-action]');
    if (!trigger) return;
    event.preventDefault();
    var action = trigger.getAttribute('data-landing-action') || 'checkout';
    var payload = trigger.getAttribute('data-landing-payload');
    parent.postMessage({ type: actionMessageType, frameId: frameId, action: action, payload: payload || null }, '*');
  }, true);

  // Auth-aware visibility: hide [data-landing-guest-only] elements once logged in.
  // The parent posts the auth state (see LandingSectionFrame); default is guest (shown).
  function applyAuthVisibility() {
    var guestOnly = document.querySelectorAll('[data-landing-guest-only]');
    for (var i = 0; i < guestOnly.length; i += 1) {
      guestOnly[i].style.display = isAuthenticated ? 'none' : '';
    }
  }
  window.addEventListener('message', function (event) {
    var data = event.data || {};
    if (data.type !== authMessageType) return;
    isAuthenticated = !!data.authenticated;
    applyAuthVisibility();
    // The parent posts auth-state once its message listener is ready (iframe onLoad).
    // On SSR pages the iframe's initial height posts can fire before React hydrates and
    // attaches the listener, so they're lost and the lastHeight guard then suppresses
    // re-posts — leaving the frame stuck at its 60vh fallback. Reset lastHeight here so
    // this auth ping always forces a fresh height post the now-ready parent will receive.
    lastHeight = 0;
    postHeight();
  });
  document.addEventListener('DOMContentLoaded', applyAuthVisibility);

  function getHeight() {
    var body = document.body;
    if (!body) {
      var doc = document.documentElement;
      return doc ? doc.scrollHeight : 0;
    }
    // body.scrollHeight is the right metric here:
    //   - It RESPECTS overflow:hidden, so clipped decorative/absolute elements
    //     (e.g. blurred glow blobs positioned bottom:-10% inside an overflow-hidden
    //     hero wrapper) do NOT inflate the height — no trailing white band.
    //   - It is NOT floored to the iframe viewport like documentElement.scrollHeight,
    //     so SHORT sections (a footer) aren't stuck at the fallback height.
    // The earlier "hero gets cut" was a measurement-TIMING issue on SSR (iframe loaded
    // before the parent listener mounted), now fixed by rendering the landing client-side.
    return Math.max(body.scrollHeight, body.offsetHeight);
  }

  function postHeight() {
    var height = getHeight();
    if (!height || height === lastHeight) return;
    lastHeight = height;
    parent.postMessage({ type: messageType, frameId: frameId, height: height }, '*');
  }

  function postError(message, source, line, column) {
    parent.postMessage({
      type: errorMessageType,
      frameId: frameId,
      message: String(message || 'Custom landing section script error'),
      source: source ? String(source) : '',
      line: line || 0,
      column: column || 0
    }, '*');
  }

  window.addEventListener('load', postHeight);
  window.addEventListener('error', function (event) {
    postError(event.message, event.filename, event.lineno, event.colno);
  });
  window.addEventListener('unhandledrejection', function (event) {
    postError(event.reason && event.reason.message ? event.reason.message : event.reason);
  });
  document.addEventListener('DOMContentLoaded', postHeight);

  if ('ResizeObserver' in window) {
    var resizeTarget = document.body || document.documentElement;
    if (resizeTarget) {
      new ResizeObserver(postHeight).observe(resizeTarget);
    }
  }

  // Web fonts reflow the (often large) hero headings AFTER load — re-measure once
  // fonts settle so the final height isn't taken with fallback-font metrics.
  try {
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(postHeight);
    }
  } catch (e) { /* no-op */ }

  // Re-measure when any image finishes loading (covers <img> added after first paint).
  var imgs = document.getElementsByTagName('img');
  for (var ii = 0; ii < imgs.length; ii++) {
    if (!imgs[ii].complete) imgs[ii].addEventListener('load', postHeight);
  }

  [0, 100, 300, 700, 1500, 2500].forEach(function (delay) {
    window.setTimeout(postHeight, delay);
  });
})();
</script>`;
}

export function buildLandingCustomHtmlFrameDocument(
  source: string,
  frameId: string,
  options: { baseHref?: string } = {},
): string {
  const raw = removeCspMetaTags(source.trim());
  const runtimeScript = buildIframeRuntimeScript(frameId);

  if (!raw) {
    return `<!doctype html><html><head>${buildBaseTag(options.baseHref)}</head><body style="margin:0;">${runtimeScript}</body></html>`;
  }

  if (/<\/body>/i.test(raw)) {
    return injectBaseTag(raw, options.baseHref).replace(/<\/body>/i, `${runtimeScript}</body>`);
  }

  if (/<\/html>/i.test(raw)) {
    return injectBaseTag(raw, options.baseHref).replace(/<\/html>/i, `${runtimeScript}</html>`);
  }

  return `<!doctype html><html><head>${buildBaseTag(options.baseHref)}</head><body style="margin:0;">${raw}${runtimeScript}</body></html>`;
}

export const buildLandingCustomHtmlIframeSrcDoc = buildLandingCustomHtmlFrameDocument;

export function shouldReplayDomReady(readyState: DocumentReadyState): boolean {
  return readyState !== 'loading';
}

export function replayDomReadyListener(listener: EventListenerOrEventListenerObject): void {
  const event = new Event('DOMContentLoaded');
  const target = typeof document === 'undefined' ? globalThis : document;

  if (typeof listener === 'function') {
    listener.call(target, event);
    return;
  }

  listener.handleEvent(event);
}

const DOM_READY_REPLAY_FLAG = '__coachioLandingDomReadyReplay';
const LANDING_CUSTOM_SCRIPT_SCOPE_ATTRIBUTE = 'data-course-landing-script-scope';
let landingCustomScriptScopeCounter = 0;

type ReplayPatchedDocument = Document & {
  [DOM_READY_REPLAY_FLAG]?: {
    originalAddEventListener: Document['addEventListener'];
  };
};

export function installDomReadyReplay(
  documentRef: Document = document,
  schedule: (callback: () => void) => unknown = (callback) => window.setTimeout(callback, 0),
): () => void {
  const patchedDocument = documentRef as ReplayPatchedDocument;
  if (patchedDocument[DOM_READY_REPLAY_FLAG]) {
    return () => undefined;
  }

  const originalAddEventListener = documentRef.addEventListener;
  const patchedAddEventListener: Document['addEventListener'] = (type, listener, options) => {
    if (type === 'DOMContentLoaded' && shouldReplayDomReady(documentRef.readyState) && listener) {
      schedule(() => replayDomReadyListener(listener));
      return;
    }

    originalAddEventListener.call(documentRef, type, listener, options);
  };

  patchedDocument[DOM_READY_REPLAY_FLAG] = { originalAddEventListener };
  patchedDocument.addEventListener = patchedAddEventListener;

  return () => {
    const state = patchedDocument[DOM_READY_REPLAY_FLAG];
    if (!state) return;
    patchedDocument.addEventListener = state.originalAddEventListener;
    delete patchedDocument[DOM_READY_REPLAY_FLAG];
  };
}

function escapeCssAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function getLandingCustomScriptScopeSelector(container: HTMLElement): string | undefined {
  const customSectionRoot =
    typeof container.closest === 'function'
      ? (container.closest('[data-course-landing-custom-section]') as HTMLElement | null)
      : null;
  const scopeRoot = customSectionRoot || container;

  if (typeof scopeRoot.getAttribute !== 'function' || typeof scopeRoot.setAttribute !== 'function') {
    return undefined;
  }

  let scopeId = scopeRoot.getAttribute(LANDING_CUSTOM_SCRIPT_SCOPE_ATTRIBUTE);
  if (!scopeId) {
    landingCustomScriptScopeCounter += 1;
    scopeId = `course-landing-custom-${landingCustomScriptScopeCounter}`;
    scopeRoot.setAttribute(LANDING_CUSTOM_SCRIPT_SCOPE_ATTRIBUTE, scopeId);
  }

  return `[${LANDING_CUSTOM_SCRIPT_SCOPE_ATTRIBUTE}="${escapeCssAttributeValue(scopeId)}"]`;
}

function shouldScopeInlineScript(attributes: Record<string, string>): boolean {
  const type = attributes.type?.trim().toLowerCase();
  return !type || ['application/javascript', 'application/ecmascript', 'text/javascript', 'text/ecmascript'].includes(type);
}

export function buildExecutableInlineScriptContent(content: string, scopeSelector?: string): string {
  const replaysDomReady = /DOMContentLoaded/.test(content);
  if (!scopeSelector && !replaysDomReady) return content;
  const serializedScopeSelector = JSON.stringify(scopeSelector || '');

  return `(function () {
  var __coachioSourceDocument = document;
  var __coachioScopeRoot = ${scopeSelector ? `__coachioSourceDocument.querySelector(${serializedScopeSelector}) || __coachioSourceDocument` : '__coachioSourceDocument'};
  var __coachioScopedDocument = __coachioSourceDocument;
  if (${scopeSelector ? 'true' : 'false'}) {
    __coachioScopedDocument = Object.create(__coachioSourceDocument);
    __coachioScopedDocument.querySelector = function (selector) {
      return __coachioScopeRoot.querySelector(selector);
    };
    __coachioScopedDocument.querySelectorAll = function (selector) {
      return __coachioScopeRoot.querySelectorAll(selector);
    };
    __coachioScopedDocument.getElementById = function (id) {
      var nodes = __coachioScopeRoot.querySelectorAll('[id]');
      for (var index = 0; index < nodes.length; index += 1) {
        if (nodes[index].id === String(id)) return nodes[index];
      }
      return null;
    };
    __coachioScopedDocument.getElementsByClassName = function (className) {
      return __coachioScopeRoot.getElementsByClassName(className);
    };
    __coachioScopedDocument.getElementsByTagName = function (tagName) {
      return __coachioScopeRoot.getElementsByTagName(tagName);
    };
  }
  var __coachioOriginalAddEventListener = __coachioScopedDocument.addEventListener;
  var __coachioReadyListeners = [];
  __coachioScopedDocument.addEventListener = function (type, listener, options) {
    if (type === 'DOMContentLoaded' && listener) {
      __coachioReadyListeners.push(listener);
      return;
    }
    return __coachioSourceDocument.addEventListener.call(__coachioSourceDocument, type, listener, options);
  };
  // Retain observers on window so scroll-triggered callbacks fire after IIFE exits.
  // Without this, var-scoped observers inside user scripts become GC-eligible and stop firing.
  var __coachioRetain = window.__coachioRetainedObservers || (window.__coachioRetainedObservers = []);
  function __coachioWrapObserver(Native) {
    if (typeof Native !== 'function') return Native;
    function Wrapped(cb, opts) {
      var instance = new Native(cb, opts);
      __coachioRetain.push(instance);
      return instance;
    }
    Wrapped.prototype = Native.prototype;
    return Wrapped;
  }
  var __coachioIO = __coachioWrapObserver(window.IntersectionObserver);
  var __coachioMO = __coachioWrapObserver(window.MutationObserver);
  var __coachioRO = __coachioWrapObserver(window.ResizeObserver);
  try {
    (function (document, IntersectionObserver, MutationObserver, ResizeObserver) {
${content}
    }).call(window, __coachioScopedDocument, __coachioIO, __coachioMO, __coachioRO);
  } finally {
    if (__coachioScopedDocument === __coachioSourceDocument) {
      __coachioSourceDocument.addEventListener = __coachioOriginalAddEventListener;
    }
  }
  var __coachioRunReadyListeners = function () {
    __coachioReadyListeners.forEach(function (listener) {
      var event = new Event('DOMContentLoaded');
      if (typeof listener === 'function') {
        listener.call(__coachioScopedDocument, event);
        return;
      }
      listener.handleEvent(event);
    });
  };
  if (__coachioReadyListeners.length) {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(function () { window.setTimeout(__coachioRunReadyListeners, 0); });
    } else {
      window.setTimeout(__coachioRunReadyListeners, 0);
    }
  }
})();`;
}

function appendScriptWithDomReadyReplay(
  container: HTMLElement,
  scriptDefinition: LandingCustomScript,
  scopeSelector?: string,
): HTMLScriptElement {
  const script = document.createElement('script');
  script.async = false;
  Object.entries(scriptDefinition.attributes).forEach(([name, value]) => {
    script.setAttribute(name, value);
  });

  installDomReadyReplay();

  if (!scriptDefinition.content) {
    script.addEventListener('load', () => {
      if (shouldReplayDomReady(document.readyState)) {
        document.dispatchEvent(new Event('DOMContentLoaded'));
      }
    });
  }

  if (scriptDefinition.content) {
    script.textContent = buildExecutableInlineScriptContent(
      scriptDefinition.content,
      scopeSelector && shouldScopeInlineScript(scriptDefinition.attributes) ? scopeSelector : undefined,
    );
  }

  (document.body || container).appendChild(script);

  return script;
}

export function runLandingCustomScripts(
  container: HTMLElement,
  scripts: LandingCustomScript[],
): HTMLScriptElement[] {
  const scopeSelector = getLandingCustomScriptScopeSelector(container);
  return scripts.map((scriptDefinition) => appendScriptWithDomReadyReplay(container, scriptDefinition, scopeSelector));
}
