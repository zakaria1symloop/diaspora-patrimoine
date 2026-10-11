'use client';
// CMS-020 — a rich-text content block shown in the back office (the charter, BO-003). The HTML is never injected as
// it is: it is parsed and rebuilt from an allow-list of tags (titles, paragraphs, lists, emphasis, links to http(s)),
// so that nothing else — script, style, event attribute — can reach the page (SEC-060).
import { createElement, useMemo, type ReactNode } from 'react';

const ALLOWED = new Set(['h2', 'h3', 'h4', 'p', 'ol', 'ul', 'li', 'strong', 'b', 'em', 'i', 'br', 'a', 'blockquote']);

function build(node: Node, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const children = Array.from(el.childNodes).map((c, i) => build(c, i));
  if (!ALLOWED.has(tag)) return tag === 'script' || tag === 'style' ? null : children;
  if (tag === 'br') return createElement('br', { key });
  if (tag === 'a') {
    const href = el.getAttribute('href') ?? '';
    if (!/^https?:\/\//i.test(href)) return children;
    return createElement('a', { key, href, target: '_blank', rel: 'noopener noreferrer' }, children);
  }
  return createElement(tag, { key }, children);
}

export function RichText({ html, className }: { html: string; className?: string }) {
  const content = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return Array.from(doc.body.childNodes).map((n, i) => build(n, i));
  }, [html]);
  return <div className={className}>{content}</div>;
}
