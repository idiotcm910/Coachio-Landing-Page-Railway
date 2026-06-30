// Scopes raw CSS pasted by admins (inside <style> blocks of a landing section's
// custom HTML) so its selectors can only match elements INSIDE that section.
// Without this, global selectors such as `body`, `*`, `h1`, `a`, `:root` leak onto
// the React chrome (header / auth modal) rendered in the same document.
//
// Strategy (regex/brace-aware, intentionally lightweight — KISS):
//   - normal rule:          `.card {}`        -> `[scope] .card {}`
//   - page-global roots:    `html|body|:root` -> `[scope]` (declarations apply to the section root)
//   - universal:            `* {}`            -> `[scope] * {}`
//   - nested at-rules:      `@media|@supports|@container|@layer (...) { ... }`
//                           -> prelude kept, inner rules scoped recursively
//   - verbatim at-rules:    `@keyframes|@font-face|@import|@charset|...`
//                           -> kept untouched (names are global by spec, harmless here)

const NESTED_SELECTOR_AT_RULE = /^@(?:media|supports|container|layer|scope)\b/i;
const PAGE_ROOT_SELECTOR = /^(?:html|body|:root)$/i;
const LEADING_PAGE_ROOT_COMBINATOR = /^\s*(?:html|:root|body)\b\s+/i;

interface CssRule {
  prelude: string;
  /** Block body for `selector { ... }` / `@media { ... }`; null for statements like `@import ...;`. */
  body: string | null;
}

/** Splits a CSS string into top-level rules, honouring nested braces, strings, and comments. */
function parseCssRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  let prelude = '';
  let index = 0;

  while (index < css.length) {
    const char = css[index];

    // Preserve comments verbatim — a `}` inside `/* */` must not be treated as a rule boundary.
    if (char === '/' && css[index + 1] === '*') {
      const end = css.indexOf('*/', index + 2);
      const stop = end === -1 ? css.length : end + 2;
      prelude += css.slice(index, stop);
      index = stop;
      continue;
    }

    // Preserve quoted strings verbatim (e.g. content: "}").
    if (char === '"' || char === "'") {
      let cursor = index + 1;
      while (cursor < css.length && css[cursor] !== char) {
        if (css[cursor] === '\\') cursor += 1;
        cursor += 1;
      }
      prelude += css.slice(index, cursor + 1);
      index = cursor + 1;
      continue;
    }

    if (char === '{') {
      let depth = 1;
      let cursor = index + 1;
      let body = '';
      while (cursor < css.length && depth > 0) {
        const inner = css[cursor];

        // Skip comments so a `}` inside `/* */` is not treated as a closing brace.
        if (inner === '/' && css[cursor + 1] === '*') {
          const end = css.indexOf('*/', cursor + 2);
          const stop = end === -1 ? css.length : end + 2;
          body += css.slice(cursor, stop);
          cursor = stop;
          continue;
        }

        // Skip quoted strings so a `}` inside `content: "}"` is not treated as a closing brace.
        if (inner === '"' || inner === "'") {
          let strCursor = cursor + 1;
          while (strCursor < css.length && css[strCursor] !== inner) {
            if (css[strCursor] === '\\') strCursor += 1;
            strCursor += 1;
          }
          body += css.slice(cursor, strCursor + 1);
          cursor = strCursor + 1;
          continue;
        }

        if (inner === '{') depth += 1;
        else if (inner === '}') {
          depth -= 1;
          if (depth === 0) break;
        }
        body += inner;
        cursor += 1;
      }
      rules.push({ prelude: prelude.trim(), body });
      prelude = '';
      index = cursor + 1;
      continue;
    }

    if (char === ';' && prelude.trim().startsWith('@')) {
      rules.push({ prelude: prelude.trim(), body: null });
      prelude = '';
      index += 1;
      continue;
    }

    prelude += char;
    index += 1;
  }

  if (prelude.trim()) rules.push({ prelude: prelude.trim(), body: null });
  return rules;
}

function scopeSingleSelector(selector: string, scope: string): string {
  const trimmed = selector.trim();
  if (!trimmed) return '';
  // Already scoped (idempotent re-scoping is safe).
  if (trimmed === scope || trimmed.startsWith(`${scope} `) || trimmed.startsWith(`${scope}:`) || trimmed.startsWith(`${scope}>`)) {
    return trimmed;
  }
  // Page-global roots collapse onto the section root itself.
  if (PAGE_ROOT_SELECTOR.test(trimmed)) return scope;
  // `body .card` / `html .card` -> strip the global root, keep the rest under the scope.
  const withoutRoot = trimmed.replace(LEADING_PAGE_ROOT_COMBINATOR, '');
  return `${scope} ${withoutRoot}`;
}

function scopeSelectorList(selectorList: string, scope: string): string {
  return selectorList
    .split(',')
    .map((selector) => scopeSingleSelector(selector, scope))
    .filter(Boolean)
    .join(', ');
}

function renderRule(rule: CssRule, scope: string): string {
  if (rule.body === null) return `${rule.prelude};`;

  const { prelude, body } = rule;

  if (NESTED_SELECTOR_AT_RULE.test(prelude)) {
    return `${prelude} {\n${scopeCssBlock(body, scope)}\n}`;
  }

  // @keyframes, @font-face, @page, @import, @charset, @property, etc. — leave untouched.
  if (prelude.startsWith('@')) {
    return `${prelude} {${body}}`;
  }

  // Drop comments from the selector prelude — they carry no meaning and would otherwise
  // sit awkwardly between the scope prefix and the selector (`[scope] /* x */ .y`).
  const cleanedPrelude = prelude.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  if (!cleanedPrelude) return '';
  return `${scopeSelectorList(cleanedPrelude, scope)} {${body}}`;
}

function scopeCssBlock(css: string, scope: string): string {
  return parseCssRules(css)
    .map((rule) => renderRule(rule, scope))
    .filter(Boolean)
    .join('\n');
}

/** Prefixes every selector in `css` with `scope` so the rules cannot escape the section. */
export function scopeLandingCustomCss(scope: string, css: string): string {
  const trimmed = typeof css === 'string' ? css.trim() : '';
  if (!scope || !trimmed) return trimmed;
  return scopeCssBlock(trimmed, scope);
}

/** Rewrites the CSS inside every `<style>` tag of `html`, scoping it to `scope`. */
export function scopeLandingCustomStyleTags(html: string, scope: string): string {
  if (!scope || !html) return html;
  return html.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_match, openTag: string, css: string, closeTag: string) => `${openTag}${scopeLandingCustomCss(scope, css)}${closeTag}`,
  );
}
