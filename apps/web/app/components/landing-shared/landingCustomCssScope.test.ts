import { describe, expect, it } from 'vitest';
import { scopeLandingCustomCss, scopeLandingCustomStyleTags } from './landingCustomCssScope';

const SCOPE = '[data-landing-section-id="abc"]';

describe('scopeLandingCustomCss', () => {
  it('prefixes plain selectors with the scope', () => {
    expect(scopeLandingCustomCss(SCOPE, '.card { color: red; }')).toBe(`${SCOPE} .card { color: red; }`);
  });

  it('scopes every selector in a comma list', () => {
    const out = scopeLandingCustomCss(SCOPE, 'h1, h2, .title { margin: 0; }');
    expect(out).toBe(`${SCOPE} h1, ${SCOPE} h2, ${SCOPE} .title { margin: 0; }`);
  });

  it('collapses page-global roots onto the section root so they cannot leak', () => {
    expect(scopeLandingCustomCss(SCOPE, 'body { background: black; }')).toBe(`${SCOPE} { background: black; }`);
    expect(scopeLandingCustomCss(SCOPE, 'html { font-size: 10px; }')).toBe(`${SCOPE} { font-size: 10px; }`);
    expect(scopeLandingCustomCss(SCOPE, ':root { --brand: #f60; }')).toBe(`${SCOPE} { --brand: #f60; }`);
  });

  it('keeps a universal reset inside the section', () => {
    expect(scopeLandingCustomCss(SCOPE, '* { box-sizing: border-box; }')).toBe(`${SCOPE} * { box-sizing: border-box; }`);
  });

  it('strips a leading global root from descendant selectors', () => {
    expect(scopeLandingCustomCss(SCOPE, 'body .card { color: red; }')).toBe(`${SCOPE} .card { color: red; }`);
  });

  it('scopes rules nested inside @media without touching the prelude', () => {
    const out = scopeLandingCustomCss(SCOPE, '@media (max-width: 600px) { .card { padding: 4px; } body { margin: 0; } }');
    expect(out).toContain('@media (max-width: 600px) {');
    expect(out).toContain(`${SCOPE} .card { padding: 4px; }`);
    expect(out).toContain(`${SCOPE} { margin: 0; }`);
  });

  it('leaves @keyframes and @font-face untouched', () => {
    const keyframes = '@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }';
    expect(scopeLandingCustomCss(SCOPE, keyframes)).toContain('@keyframes spin {');
    expect(scopeLandingCustomCss(SCOPE, keyframes)).not.toContain(`${SCOPE} from`);

    const fontFace = "@font-face { font-family: 'X'; src: url(x.woff2); }";
    expect(scopeLandingCustomCss(SCOPE, fontFace)).toContain('@font-face {');
  });

  it('keeps @import statements intact', () => {
    expect(scopeLandingCustomCss(SCOPE, "@import url('https://x.com/a.css');")).toBe("@import url('https://x.com/a.css');");
  });

  it('does not break braces inside strings or comments', () => {
    const css = '.x::before { content: "}"; } /* a } b */ .y { color: red; }';
    const out = scopeLandingCustomCss(SCOPE, css);
    expect(out).toContain(`${SCOPE} .x::before { content: "}"; }`);
    expect(out).toContain(`${SCOPE} .y { color: red; }`);
  });

  it('is idempotent for already-scoped selectors', () => {
    const once = scopeLandingCustomCss(SCOPE, '.card { color: red; }');
    expect(scopeLandingCustomCss(SCOPE, once)).toBe(once);
  });
});

describe('scopeLandingCustomStyleTags', () => {
  it('rewrites the CSS inside <style> tags but leaves markup untouched', () => {
    const html = '<style>body { margin: 0; } .card { color: red; }</style><section class="card">Hi</section>';
    const out = scopeLandingCustomStyleTags(html, SCOPE);
    expect(out).toContain(`${SCOPE} { margin: 0; }`);
    expect(out).toContain(`${SCOPE} .card { color: red; }`);
    expect(out).toContain('<section class="card">Hi</section>');
  });

  it('returns the html unchanged when no scope is provided', () => {
    const html = '<style>body { margin: 0; }</style>';
    expect(scopeLandingCustomStyleTags(html, '')).toBe(html);
  });
});
