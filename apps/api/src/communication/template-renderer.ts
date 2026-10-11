// NOT-050, NOT-061, NOT-012 — rendering of an `EmailTemplate`: conditions and lists evaluated, fields replaced and
// escaped, restricted Markdown converted to HTML, the single button inserted. Pure: no I/O.
//
// Syntax: {{object.field}} · {{#if object.field}} … {{else}} … {{/if}} · {{#each list}} … {{/each}} ·
// {{button "Label" target}} (target: a site path `/…`, an `https:`/`mailto:`/`tel:` address or a field, optionally
// followed by a path: `dossier.url/pieces`) · {{> block}} (blocks built by code; none is used by the lead templates).
// Markdown allowed: paragraphs, `##`/`###` titles, **bold**, *italic*, bullet and numbered lists, [text](address).
// Any HTML typed in a template is shown as text (TRV-065): every literal is escaped.

export type TemplateVars = Record<string, unknown>;

type Node =
  | { t: 'text'; v: string }
  | { t: 'var'; path: string }
  | { t: 'if'; path: string; then: Node[]; else: Node[] }
  | { t: 'each'; path: string; body: Node[] }
  | { t: 'button'; label: string; target: string }
  | { t: 'partial'; name: string };

export class TemplateSyntaxError extends Error {}

const TAG = /\{\{\s*([\s\S]*?)\s*\}\}/g;

export function parseTemplate(source: string): Node[] {
  const root: Node[] = [];
  const stack: { node: Extract<Node, { t: 'if' | 'each' }>; inElse: boolean }[] = [];
  const push = (n: Node) => {
    const top = stack[stack.length - 1];
    if (!top) root.push(n);
    else if (top.node.t === 'if') (top.inElse ? top.node.else : top.node.then).push(n);
    else top.node.body.push(n);
  };
  let last = 0;
  for (const m of source.matchAll(TAG)) {
    if (m.index! > last) push({ t: 'text', v: source.slice(last, m.index) });
    last = m.index! + m[0].length;
    const tag = m[1]!;
    let mm: RegExpMatchArray | null;
    if ((mm = tag.match(/^#if\s+([\w.]+)$/))) {
      const node: Node = { t: 'if', path: mm[1]!, then: [], else: [] };
      push(node);
      stack.push({ node, inElse: false });
    } else if ((mm = tag.match(/^#each\s+([\w.]+)$/))) {
      const node: Node = { t: 'each', path: mm[1]!, body: [] };
      push(node);
      stack.push({ node, inElse: false });
    } else if (tag === 'else') {
      const top = stack[stack.length - 1];
      if (!top || top.node.t !== 'if' || top.inElse) throw new TemplateSyntaxError('else outside if');
      top.inElse = true;
    } else if (tag === '/if' || tag === '/each') {
      const top = stack.pop();
      if (!top || `/${top.node.t}` !== tag) throw new TemplateSyntaxError(`unexpected ${tag}`);
    } else if ((mm = tag.match(/^button\s+"([^"]*)"\s+(\S+)$/))) {
      push({ t: 'button', label: mm[1]!, target: mm[2]! });
    } else if ((mm = tag.match(/^>\s*(\w+)$/))) {
      push({ t: 'partial', name: mm[1]! });
    } else if (/^[\w.]+$/.test(tag)) {
      push({ t: 'var', path: tag });
    } else {
      throw new TemplateSyntaxError(`unknown tag {{${tag}}}`);
    }
  }
  if (stack.length) throw new TemplateSyntaxError('unclosed block');
  if (last < source.length) push({ t: 'text', v: source.slice(last) });
  return root;
}

/** Field paths cited by a template (NOT-050 `variables`). */
export function citedFields(source: string): string[] {
  const out = new Set<string>();
  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.t === 'var') out.add(n.path);
      else if (n.t === 'if') {
        out.add(n.path);
        walk(n.then);
        walk(n.else);
      } else if (n.t === 'each') {
        out.add(n.path);
        walk(n.body);
      } else if (n.t === 'button' && !isLiteralTarget(n.target)) out.add(n.target.split('/')[0]!);
    }
  };
  walk(parseTemplate(source));
  return [...out].sort();
}

function lookup(vars: TemplateVars, path: string, scope?: unknown): unknown {
  const read = (obj: unknown) =>
    path.split('.').reduce<unknown>((acc, k) => (acc !== null && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), obj);
  if (scope !== undefined) {
    const v = path === 'this' ? scope : read(scope);
    if (v !== undefined) return v;
  }
  return read(vars);
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && v.length === 0);
}

function isLiteralTarget(target: string): boolean {
  return target.startsWith('/') || /^(https?:|mailto:|tel:)/.test(target);
}

// Private-use markers keep values and the button out of the Markdown pass.
const V0 = '';
const V1 = '';
const BUTTON = '';
/** {{> block}} — a block built by code (a list of properties…), inserted as its own paragraph. */
const P0 = '';
const P1 = '';

interface Evaluation {
  /** Literal template text with value markers. */
  text: string;
  values: string[];
  button: { label: string; href: string } | null;
  missing: string[];
}

function evaluate(nodes: Node[], vars: TemplateVars, siteUrl: string): Evaluation {
  const ev: Evaluation = { text: '', values: [], button: null, missing: [] };
  const resolveTarget = (target: string, scope: unknown, inBlock: boolean): string | null => {
    if (isLiteralTarget(target)) return target;
    const [field, ...rest] = target.split('/');
    const v = lookup(vars, field!, scope);
    if (isEmpty(v)) {
      if (!inBlock) ev.missing.push(field!);
      return null;
    }
    return String(v) + (rest.length ? `/${rest.join('/')}` : '');
  };
  const walk = (list: Node[], scope: unknown, inBlock: boolean) => {
    for (const n of list) {
      switch (n.t) {
        case 'text':
          ev.text += n.v;
          break;
        case 'var': {
          const v = lookup(vars, n.path, scope);
          if (v === false) break;
          if (isEmpty(v)) {
            if (!inBlock) ev.missing.push(n.path);
            break;
          }
          let s = String(v);
          // NOT-050: a field that opens a sentence gets a capital first letter.
          if (/(^|[.!?]\s+|\n\s*)$/.test(ev.text)) s = s.charAt(0).toUpperCase() + s.slice(1);
          ev.text += `${V0}${ev.values.length}${V1}`;
          ev.values.push(s);
          break;
        }
        case 'if':
          walk(isEmpty(lookup(vars, n.path, scope)) ? n.else : n.then, scope, true);
          break;
        case 'each': {
          const items = lookup(vars, n.path, scope);
          if (Array.isArray(items)) for (const item of items) walk(n.body, item, true);
          break;
        }
        case 'button': {
          const href = resolveTarget(n.target, scope, inBlock);
          if (href && !ev.button) {
            ev.button = { label: n.label, href: absolute(href, siteUrl) ?? href };
            ev.text += BUTTON;
          }
          break;
        }
        case 'partial':
          // Blocks are built by the code of the modules that use them (`options.partials`); unknown → nothing.
          ev.text += `

${P0}${n.name}${P1}

`;
          break;
      }
    }
  };
  walk(nodes, undefined, false);
  return ev;
}

/** NOT-061 — a path becomes a full site address; only https (or the site itself), mailto and tel are kept. */
function absolute(href: string, siteUrl: string): string | null {
  if (href.startsWith('/')) return siteUrl.replace(/\/$/, '') + href;
  if (/^(https:|mailto:|tel:)/.test(href)) return href;
  if (href.startsWith(siteUrl)) return href; // local site served over http
  return null;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface Rendered {
  html: string;
  text: string;
}

export interface RenderedBlock {
  html: string;
  text: string;
}

function markdown(
  ev: Evaluation,
  siteUrl: string,
  buttonHtml: (label: string, href: string) => string,
  partials: Record<string, RenderedBlock> = {},
): Rendered {
  const valueOf = (i: string) => ev.values[Number(i)] ?? '';
  const raw = (s: string) => s.replace(new RegExp(`${V0}(\\d+)${V1}`, 'g'), (_, i: string) => valueOf(i));
  const inlineHtml = (s: string): string => {
    let out = escapeHtml(s);
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, target: string) => {
      const href = absolute(raw(target).replace(/&amp;/g, '&'), siteUrl);
      return href ? `<a href="${escapeHtml(href)}">${label}</a>` : label;
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    return out.replace(new RegExp(`${V0}(\\d+)${V1}`, 'g'), (_, i: string) => escapeHtml(valueOf(i)));
  };
  const inlineText = (s: string): string =>
    raw(
      s
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, target: string) => `${label} (${absolute(raw(target), siteUrl) ?? raw(target)})`)
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1$2'),
    );

  const html: string[] = [];
  const text: string[] = [];
  for (const block of ev.text.split(/\n\s*\n/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    // An omitted block leaves no double space behind.
    const lines = trimmed.split('\n').map((l) => l.trim().replace(/ {2,}/g, ' '));
    const partial = trimmed.startsWith(P0) && trimmed.endsWith(P1) ? trimmed.slice(1, -1) : null;
    if (partial !== null) {
      const block = partials[partial];
      if (block) {
        html.push(block.html);
        text.push(block.text);
      }
      continue;
    }
    if (trimmed === BUTTON && ev.button) {
      html.push(buttonHtml(ev.button.label, ev.button.href));
      text.push(`${ev.button.label} : ${ev.button.href}`);
      continue;
    }
    const heading = trimmed.match(/^(#{2,3})\s+(.*)$/s);
    if (heading && lines.length === 1) {
      const level = heading[1]!.length;
      html.push(`<h${level}>${inlineHtml(heading[2]!)}</h${level}>`);
      text.push(inlineText(heading[2]!));
      continue;
    }
    if (lines.every((l) => /^[-*]\s+/.test(l))) {
      html.push(`<ul>${lines.map((l) => `<li>${inlineHtml(l.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`);
      text.push(lines.map((l) => `- ${inlineText(l.replace(/^[-*]\s+/, ''))}`).join('\n'));
      continue;
    }
    if (lines.every((l) => /^\d+\.\s+/.test(l))) {
      html.push(`<ol>${lines.map((l) => `<li>${inlineHtml(l.replace(/^\d+\.\s+/, ''))}</li>`).join('')}</ol>`);
      text.push(lines.map((l) => inlineText(l)).join('\n'));
      continue;
    }
    // A button inside a paragraph is moved after it.
    const hasButton = trimmed.includes(BUTTON) && ev.button;
    const para = lines.map((l) => l.replace(BUTTON, '')).filter(Boolean);
    if (para.length) {
      html.push(`<p>${para.map(inlineHtml).join('<br>')}</p>`);
      text.push(para.map(inlineText).join('\n'));
    }
    if (hasButton) {
      html.push(buttonHtml(ev.button!.label, ev.button!.href));
      text.push(`${ev.button!.label} : ${ev.button!.href}`);
    }
  }
  return { html: html.join('\n'), text: text.join('\n\n') };
}

export interface RenderInput {
  subject: string;
  preheader?: string | null;
  body: string;
}

export interface RenderOutput {
  subject: string;
  preheader: string | null;
  html: string;
  text: string;
  /** NOT-012 — required fields (cited outside any block) without a value: the e-mail must not leave. */
  missing: string[];
}

export function defaultButtonHtml(label: string, href: string): string {
  return (
    `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0"><tr><td style="border-radius:6px;background:#1f4d3a">` +
    `<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;color:#ffffff;text-decoration:none;font-weight:600">${escapeHtml(label)}</a>` +
    `</td></tr></table>`
  );
}

/** Renders subject, preheader and body with the given variables (values already formatted, NOT-051). */
export function renderTemplate(
  tpl: RenderInput,
  vars: TemplateVars,
  options: { siteUrl: string; buttonHtml?: (label: string, href: string) => string; partials?: Record<string, RenderedBlock> },
): RenderOutput {
  const flat = (src: string) => {
    const ev = evaluate(parseTemplate(src), vars, options.siteUrl);
    return { value: ev.text.replace(new RegExp(`${V0}(\\d+)${V1}`, 'g'), (_, i: string) => ev.values[Number(i)] ?? '').replace(/\s+/g, ' ').trim(), missing: ev.missing };
  };
  const subject = flat(tpl.subject);
  const preheader = tpl.preheader ? flat(tpl.preheader) : null;
  const bodyEv = evaluate(parseTemplate(tpl.body), vars, options.siteUrl);
  const body = markdown(bodyEv, options.siteUrl, options.buttonHtml ?? defaultButtonHtml, options.partials);
  return {
    subject: subject.value,
    preheader: preheader?.value ?? null,
    html: body.html,
    text: body.text,
    missing: [...new Set([...subject.missing, ...(preheader?.missing ?? []), ...bodyEv.missing])],
  };
}

/** NOT-002 — values of the secret fields replaced before the e-mail is stored. */
export function redactVars(vars: TemplateVars, secretPaths: readonly string[], placeholder: (path: string) => string): TemplateVars {
  const copy = structuredClone(vars) as Record<string, unknown>;
  for (const path of secretPaths) {
    const keys = path.split('.');
    let obj: Record<string, unknown> | undefined = copy;
    for (const k of keys.slice(0, -1)) {
      const next: unknown = obj?.[k];
      obj = next !== null && typeof next === 'object' ? (next as Record<string, unknown>) : undefined;
    }
    const lastKey = keys[keys.length - 1]!;
    if (obj && obj[lastKey] !== undefined && obj[lastKey] !== null && obj[lastKey] !== '') obj[lastKey] = placeholder(path);
  }
  return copy;
}
