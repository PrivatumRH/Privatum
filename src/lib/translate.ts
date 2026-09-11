import { ZH_DICTIONARY } from "./zh-dictionary";

export type Lang = "en" | "zh";

export const STORAGE_KEY = "privatum.lang";

/**
 * Runtime translation layer.
 *
 * The landing page copy lives inline in the JSX, so instead of threading a
 * translation call through several thousand lines of markup we swap the text of
 * the rendered DOM. Originals are kept in a WeakMap so switching back to English
 * is lossless, and a MutationObserver re-applies the swap whenever React
 * re-renders a subtree (tab switches, carousels, FAQ toggles).
 */

/** Tags whose text is never user-facing copy. */
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE", "SVG", "PATH"]);

/** Containers that hold verbatim content (code samples, opt-outs). */
const SKIP_SELECTOR = ".code-lines, [data-no-translate]";

/** Attributes carrying visible copy. */
const TEXT_ATTRS = ["placeholder", "title", "aria-label", "alt", "data-soon"] as const;

const originalText = new WeakMap<Text, string>();
const originalAttrs = new WeakMap<Element, Record<string, string | null>>();

let observer: MutationObserver | null = null;
let scheduled = false;

export function normalizeKey(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function lookup(value: string): string | undefined {
  return ZH_DICTIONARY[normalizeKey(value)];
}

function isSkipped(node: Node): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  if (SKIP_TAGS.has(parent.tagName.toUpperCase())) return true;
  if (parent.closest(SKIP_SELECTOR)) return true;
  // Anything inside an <svg> subtree (tagName casing differs for SVG elements).
  if (parent.closest("svg")) return true;
  return false;
}

/** Re-applies the original leading/trailing whitespace so inline layout holds. */
function withPadding(original: string, replacement: string): string {
  const lead = /^\s*/.exec(original)?.[0] ?? "";
  const trail = /\s*$/.exec(original)?.[0] ?? "";
  return lead + replacement + trail;
}

function walkTextNodes(root: Node, visit: (node: Text) => void) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      return isSkipped(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  let current = walker.nextNode();
  while (current) {
    visit(current as Text);
    current = walker.nextNode();
  }
}

function walkElements(root: Element, visit: (el: Element) => void) {
  visit(root);
  root.querySelectorAll("*").forEach((el) => {
    if (SKIP_TAGS.has(el.tagName.toUpperCase())) return;
    if (el.closest(SKIP_SELECTOR)) return;
    visit(el);
  });
}

function translateInto(root: Element) {
  walkTextNodes(root, (node) => {
    const source = originalText.get(node) ?? node.nodeValue ?? "";
    const zh = lookup(source);
    if (!zh) return;
    if (!originalText.has(node)) originalText.set(node, source);
    const next = withPadding(source, zh);
    if (node.nodeValue !== next) node.nodeValue = next;
  });

  walkElements(root, (el) => {
    for (const attr of TEXT_ATTRS) {
      const stored = originalAttrs.get(el)?.[attr];
      const source = stored !== undefined && stored !== null ? stored : el.getAttribute(attr);
      if (!source) continue;
      const zh = lookup(source);
      if (!zh) continue;
      const cache = originalAttrs.get(el) ?? {};
      if (cache[attr] === undefined) {
        cache[attr] = source;
        originalAttrs.set(el, cache);
      }
      if (el.getAttribute(attr) !== zh) el.setAttribute(attr, zh);
    }
  });
}

function restoreFrom(root: Element) {
  walkTextNodes(root, (node) => {
    const original = originalText.get(node);
    if (original !== undefined && node.nodeValue !== original) node.nodeValue = original;
  });

  walkElements(root, (el) => {
    const cache = originalAttrs.get(el);
    if (!cache) return;
    for (const [attr, original] of Object.entries(cache)) {
      if (original === null) el.removeAttribute(attr);
      else if (el.getAttribute(attr) !== original) el.setAttribute(attr, original);
    }
  });
}

/** Runs `fn` without the observer re-firing on our own mutations. */
function withoutObserver(fn: () => void) {
  observer?.disconnect();
  try {
    fn();
  } finally {
    if (observer) {
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }
}

function scheduleRetranslate() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    withoutObserver(() => translateInto(document.body));
  });
}

/**
 * Applies (or removes) the Chinese layer across the document and keeps it
 * applied through React re-renders. Safe to call repeatedly.
 */
export function applyLanguage(lang: Lang) {
  if (typeof document === "undefined") return;

  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.documentElement.dataset["lang"] = lang;

  if (lang === "zh") {
    if (!observer) {
      observer = new MutationObserver(scheduleRetranslate);
    }
    withoutObserver(() => translateInto(document.body));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return;
  }

  observer?.disconnect();
  observer = null;
  restoreFrom(document.body);
}

export function readStoredLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "zh" || stored === "en") return stored;
  } catch {
    /* storage unavailable (private mode, blocked cookies) */
  }
  // Fall back to the browser's preferred language on a first visit.
  const nav = window.navigator?.languages?.[0] || window.navigator?.language || "";
  return /^zh\b/i.test(nav) ? "zh" : "en";
}

export function storeLang(lang: Lang) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage unavailable */
  }
}
