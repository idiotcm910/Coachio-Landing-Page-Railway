import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildLandingCustomHtmlReplayKey,
  buildExecutableInlineScriptContent,
  buildLandingCustomHtmlInlineRender,
  buildLandingCustomHtmlFrameDocument,
  installDomReadyReplay,
  parseLandingCustomHtml,
  replayDomReadyListener,
  shouldReplayDomReady,
} from './landingCustomHtml';

describe('landing custom html helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('extracts head styles, body html, and scripts from a full document', () => {
    const parsed = parseLandingCustomHtml(`<!doctype html>
      <html>
        <head>
          <style>.card { color: red; }</style>
          <script src="https://example.com/a.js" defer></script>
        </head>
        <body>
          <section id="custom">Hello</section>
          <script>window.__customRan = true;</script>
        </body>
      </html>`);

    expect(parsed.html).toContain('<style>.card { color: red; }</style>');
    expect(parsed.html).toContain('<section id="custom">Hello</section>');
    expect(parsed.html).not.toContain('<script');
    expect(parsed.scripts).toHaveLength(2);
    expect(parsed.scripts[0]).toMatchObject({
      attributes: { src: 'https://example.com/a.js', defer: '' },
      content: '',
    });
    expect(parsed.scripts[1].content).toContain('window.__customRan = true');
  });

  it('extracts scripts from html fragments without requiring a body tag', () => {
    const parsed = parseLandingCustomHtml('<div>Fragment</div><script type="module">console.log("ok")</script>');

    expect(parsed.html).toBe('<div>Fragment</div>');
    expect(parsed.scripts).toEqual([
      {
        attributes: { type: 'module' },
        content: 'console.log("ok")',
      },
    ]);
  });

  it('includes the active page theme in the landing custom HTML replay key', () => {
    expect(buildLandingCustomHtmlReplayKey('section-1', 'dark')).toBe('section-1:dark');
    expect(buildLandingCustomHtmlReplayKey('section-1', 'light')).toBe('section-1:light');
  });

  it('replays DOMContentLoaded listeners when the document is already ready', () => {
    const calls: string[] = [];

    expect(shouldReplayDomReady('loading')).toBe(false);
    expect(shouldReplayDomReady('interactive')).toBe(true);
    expect(shouldReplayDomReady('complete')).toBe(true);

    replayDomReadyListener(() => calls.push('function-listener'));
    replayDomReadyListener({
      handleEvent: () => calls.push('object-listener'),
    });

    expect(calls).toEqual(['function-listener', 'object-listener']);
  });

  it('keeps DOMContentLoaded replay active for delayed custom scripts', () => {
    const calls: string[] = [];
    const listeners: string[] = [];
    const fakeDocument = {
      readyState: 'complete' as DocumentReadyState,
      addEventListener: (type: string) => {
        listeners.push(type);
      },
    } as Document;

    const restore = installDomReadyReplay(fakeDocument, (callback) => {
      callback();
      return 0;
    });

    fakeDocument.addEventListener('DOMContentLoaded', () => calls.push('late-ready'));
    fakeDocument.addEventListener('click', () => calls.push('click'));
    restore();

    expect(calls).toEqual(['late-ready']);
    expect(listeners).toEqual(['click']);
  });

  it('marks dynamically inserted external scripts as ordered', async () => {
    const appendedScripts: Array<{ async: boolean; src: string; textContent: string | null }> = [];
    const fakeDocument = {
      readyState: 'complete',
      addEventListener: () => undefined,
      createElement: () => {
        const attributes: Record<string, string> = {};
        return {
          async: true,
          textContent: null,
          setAttribute: (name: string, value: string) => {
            attributes[name] = value;
          },
          get src() {
            return attributes.src || '';
          },
          addEventListener: () => undefined,
          remove: () => undefined,
        };
      },
    } as unknown as Document;
    const fakeContainer = {
      appendChild: (script: HTMLScriptElement) => {
        appendedScripts.push({
          async: script.async,
          src: script.src,
          textContent: script.textContent,
        });
        return script;
      },
    } as HTMLElement;
    vi.stubGlobal('document', fakeDocument);
    vi.stubGlobal('window', { setTimeout: (callback: () => void) => callback() });

    const { runLandingCustomScripts } = await import('./landingCustomHtml');
    runLandingCustomScripts(fakeContainer, [
      { attributes: { src: 'https://cdn.example.com/lib.js' }, content: '' },
      { attributes: {}, content: 'window.afterLib = true;' },
    ]);

    expect(appendedScripts).toEqual([
      { async: false, src: 'https://cdn.example.com/lib.js', textContent: null },
      { async: false, src: '', textContent: 'window.afterLib = true;' },
    ]);
  });

  it('wraps DOMContentLoaded inline scripts so their callbacks run after hydration', () => {
    const script = buildExecutableInlineScriptContent('document.addEventListener("DOMContentLoaded", function() { window.ready = true; });');

    expect(script).toContain('__coachioReadyListeners');
    expect(script).toContain('requestAnimationFrame');
    expect(script).toContain('window.setTimeout');
    expect(script).toContain('window.ready = true');
  });

  it('runs inline DOMContentLoaded selectors inside the custom section scope', () => {
    const outsideCardClasses = new Set<string>();
    const insideCardClasses = new Set<string>();
    const outsideTextClasses = new Set<string>();
    const insideTextClasses = new Set<string>();
    const outsideCard = { classList: { add: (value: string) => outsideCardClasses.add(value) } };
    const insideCard = { classList: { add: (value: string) => insideCardClasses.add(value) } };
    const outsideText = { classList: { add: (value: string) => outsideTextClasses.add(value) } };
    const insideText = { classList: { add: (value: string) => insideTextClasses.add(value) } };
    const scopeRoot = {
      querySelector: (selector: string) => (selector === '.reveal-text' ? insideText : null),
      querySelectorAll: (selector: string) => (selector === '.vct-card' ? [insideCard] : []),
    };
    const fakeDocument = {
      addEventListener: () => undefined,
      querySelector: (selector: string) => {
        if (selector === '[data-course-landing-script-scope="section-1"]') return scopeRoot;
        if (selector === '.reveal-text') return outsideText;
        return null;
      },
      querySelectorAll: (selector: string) => (selector === '.vct-card' ? [outsideCard, insideCard] : []),
    };
    const fakeWindow = {
      requestAnimationFrame: (callback: () => void) => {
        callback();
        return 0;
      },
      setTimeout: (callback: () => void) => {
        callback();
        return 0;
      },
    };
    class FakeIntersectionObserver {
      constructor(private callback: (entries: Array<{ isIntersecting: boolean; target: typeof insideCard }>) => void) {}
      observe(target: typeof insideCard) {
        this.callback([{ isIntersecting: true, target }]);
      }
      unobserve() {
        return undefined;
      }
    }
    // The script reads observers off `window` (so they can be retained past the IIFE).
    (fakeWindow as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeIntersectionObserver;
    vi.stubGlobal('Event', class {
      constructor(public type: string) {}
    });
    const script = buildExecutableInlineScriptContent(
      `
document.addEventListener("DOMContentLoaded", function() {
    const cardObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                cardObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    const cards = document.querySelectorAll('.vct-card');
    cards.forEach(card => {
        cardObserver.observe(card);
    });

    const textObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                textObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    const targetText = document.querySelector('.reveal-text');
    if (targetText) {
        textObserver.observe(targetText);
    }
});`,
      '[data-course-landing-script-scope="section-1"]',
    );

    new Function('window', 'document', 'IntersectionObserver', script)(fakeWindow, fakeDocument, FakeIntersectionObserver);

    expect(insideCardClasses.has('fade-in')).toBe(true);
    expect(insideTextClasses.has('active')).toBe(true);
    expect(outsideCardClasses.has('fade-in')).toBe(false);
    expect(outsideTextClasses.has('active')).toBe(false);
  });

  it('keeps full custom documents intact and injects frame helpers before body closes', () => {
    const frameDocument = buildLandingCustomHtmlFrameDocument(
      '<!doctype html><html><head><title>x</title><meta http-equiv="Content-Security-Policy" content="script-src none"></head><body><section>Admin</section><script>document.addEventListener("DOMContentLoaded", function() { window.ready = true; })</script></body></html>',
      'section-1',
      { baseHref: 'https://learn.example.com/' },
    );

    expect(frameDocument).toContain('<base href="https://learn.example.com/" target="_parent" />');
    expect(frameDocument).toContain('<section>Admin</section>');
    expect(frameDocument).toContain('document.addEventListener("DOMContentLoaded"');
    expect(frameDocument).toContain('course-landing-custom-html:height');
    expect(frameDocument).not.toContain('Content-Security-Policy');
    expect(frameDocument.indexOf('course-landing-custom-html:height')).toBeLessThan(frameDocument.indexOf('</body>'));
  });

  it('wraps html fragments into a frame document', () => {
    const frameDocument = buildLandingCustomHtmlFrameDocument('<section>Fragment</section>', 'section-2');

    expect(frameDocument).toContain('<!doctype html>');
    expect(frameDocument).toContain('<base target="_parent" />');
    expect(frameDocument).toContain('<body style="margin:0;">');
    expect(frameDocument).toContain('<section>Fragment</section>');
  });

  it('normalizes full custom documents into SEO inline html and runnable scripts', () => {
    const inlineRender = buildLandingCustomHtmlInlineRender(`<!doctype html>
      <html lang="vi">
        <head>
          <title>Custom ignored title</title>
          <meta name="description" content="Custom ignored description">
          <link rel="stylesheet" href="https://cdn.example.com/custom.css">
          <style>.landing-card { color: orange; }</style>
          <script src="https://cdn.example.com/head.js"></script>
        </head>
        <body class="custom-body">
          <section class="landing-card"><h2>SEO visible copy</h2></section>
          <script>window.inlineCustomRan = true;</script>
        </body>
      </html>`);

    expect(inlineRender.html).toContain('<link rel="stylesheet" href="https://cdn.example.com/custom.css">');
    expect(inlineRender.html).toContain('<style>.landing-card { color: orange; }</style>');
    expect(inlineRender.html).toContain('<section class="landing-card"><h2>SEO visible copy</h2></section>');
    expect(inlineRender.html).not.toContain('<!doctype');
    expect(inlineRender.html).not.toContain('<html');
    expect(inlineRender.html).not.toContain('<head');
    expect(inlineRender.html).not.toContain('<body');
    expect(inlineRender.html).not.toContain('<script');
    expect(inlineRender.html).not.toContain('<title>');
    expect(inlineRender.html).not.toContain('Custom ignored description');
    expect(inlineRender.scripts).toHaveLength(2);
    expect(inlineRender.scripts[0]).toMatchObject({
      attributes: { src: 'https://cdn.example.com/head.js' },
      content: '',
    });
    expect(inlineRender.scripts[1].content).toContain('window.inlineCustomRan = true');
  });

  it('scopes <style> blocks to the section when a scope selector is given', () => {
    const inlineRender = buildLandingCustomHtmlInlineRender(
      `<head><style>body { margin: 0; } .hero h1 { color: orange; }</style></head>
       <body><div class="hero"><h1>Title</h1></div></body>`,
      '[data-landing-section-id="s1"]',
    );

    expect(inlineRender.html).toContain('[data-landing-section-id="s1"] { margin: 0; }');
    expect(inlineRender.html).toContain('[data-landing-section-id="s1"] .hero h1 { color: orange; }');
    expect(inlineRender.html).not.toContain('body { margin: 0; }');
    expect(inlineRender.html).toContain('<div class="hero"><h1>Title</h1></div>');
  });

  it('leaves <style> blocks untouched when no scope selector is given', () => {
    const inlineRender = buildLandingCustomHtmlInlineRender('<style>body { margin: 0; }</style><div>x</div>');
    expect(inlineRender.html).toContain('<style>body { margin: 0; }</style>');
  });

  it('keeps public inline rendering independent from editor iframe preview helpers', () => {
    const inlineRender = buildLandingCustomHtmlInlineRender(`<!doctype html>
      <html>
        <head>
          <style>.public-card { color: red; }</style>
          <script src="https://cdn.example.com/public.js"></script>
        </head>
        <body>
          <section class="public-card">Public copy</section>
          <script>window.publicInlineRan = true;</script>
        </body>
      </html>`);

    expect(inlineRender.html).toContain('<style>.public-card { color: red; }</style>');
    expect(inlineRender.html).toContain('<section class="public-card">Public copy</section>');
    expect(inlineRender.html).not.toContain('<script');
    expect(inlineRender.scripts).toHaveLength(2);
    expect(inlineRender.scripts[0]).toMatchObject({
      attributes: { src: 'https://cdn.example.com/public.js' },
      content: '',
    });
    expect(inlineRender.scripts[1].content).toContain('window.publicInlineRan = true');
  });
});
