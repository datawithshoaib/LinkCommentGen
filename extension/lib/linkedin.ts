/**
 * Everything that touches LinkedIn's DOM lives here. LinkedIn ships markup
 * changes often, so each lookup uses a list of selectors (newest first) plus a
 * generic fallback.
 */
import type { PostContext } from "./types";

export const PANEL_TAG = "linkcomment-panel";

const POST_CONTAINER_SELECTORS = [
  "[data-urn^='urn:li:activity']",
  "[data-id^='urn:li:activity']",
  "[data-urn^='urn:li:ugcPost']",
  "[data-id^='urn:li:ugcPost']",
  ".feed-shared-update-v2",
  "[data-view-name='feed-full-update']",
  ".fie-impression-container",
  "[role='article']",
  "article",
];

const POST_TEXT_SELECTORS = [
  ".update-components-update-v2__commentary",
  ".feed-shared-update-v2__description",
  ".update-components-text",
  ".feed-shared-inline-show-more-text",
  ".feed-shared-text",
  "[data-view-name='feed-commentary']",
  "[data-test-id='main-feed-activity-card__commentary']",
  ".attributed-text-segment-list__content",
];

const AUTHOR_NAME_SELECTORS = [
  ".update-components-actor__title span[aria-hidden='true']",
  ".update-components-actor__name span[aria-hidden='true']",
  ".update-components-actor__single-line-truncate span[aria-hidden='true']",
  ".update-components-actor__title",
  ".update-components-actor__name",
  ".feed-shared-actor__name",
  "[data-view-name='feed-actor-name']",
];

const AUTHOR_HEADLINE_SELECTORS = [
  ".update-components-actor__description span[aria-hidden='true']",
  ".update-components-actor__description",
  ".feed-shared-actor__description",
];

const MEDIA_TITLE_SELECTORS = [
  ".update-components-article__title",
  ".update-components-document__title",
  ".document-s-container__title",
  ".feed-shared-article__title",
  ".update-components-event__title",
  ".update-components-poll__question",
];

/** Regions inside a post container that are NOT the post itself. */
const COMMENTS_REGION = [
  ".comments-comments-list",
  ".comments-comment-list",
  ".comments-comment-box",
  ".comments-comment-item",
  ".comments-comment-entity",
  ".feed-shared-update-v2__comments-container",
  ".social-details-social-activity",
  ".feed-shared-social-action-bar",
  "[class*='comments-comment']",
  PANEL_TAG,
].join(",");

const REPLY_SCOPE = [
  ".comments-comment-item",
  ".comments-comment-entity",
  "article.comments-comment-entity",
  ".comments-reply-item",
  "[class*='replies-list']",
].join(",");

const NOT_A_COMMENT_BOX = [
  ".msg-form",
  "[class*='msg-form']",
  ".share-box",
  ".share-creation-state",
  ".share-box-v2__modal",
  "[data-test-modal-id*='share']",
].join(",");

const COMMENT_BOX_ANCESTOR = [
  ".comments-comment-box",
  ".comments-comment-texteditor",
  ".comments-comment-box-comment__text-editor",
  "[class*='comments-comment-box']",
  "[class*='comment-texteditor']",
  "[data-view-name*='comment']",
].join(",");

function text(el: Element | null | undefined): string {
  if (!el) return "";
  return ((el as HTMLElement).innerText ?? el.textContent ?? "").trim();
}

function firstText(root: ParentNode, selectors: string[]): string {
  for (const sel of selectors) {
    for (const el of root.querySelectorAll(sel)) {
      if (el.closest(COMMENTS_REGION)) continue;
      const t = text(el).split("\n")[0]?.trim();
      if (t) return t;
    }
  }
  return "";
}

export function cleanPostText(raw: string): string {
  return raw
    .replace(/\bhashtag\s*#/gi, "#")
    .replace(/(?:…|\.\.\.)\s*(?:see more|more)\s*$/gim, "")
    .replace(/^\s*(see translation|show translation|… ?more|see more|see less)\s*$/gim, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Comment editor detection
// ---------------------------------------------------------------------------
function hintText(el: HTMLElement): string {
  const parts: string[] = [];
  let node: HTMLElement | null = el;
  for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
    for (const attr of ["aria-label", "aria-placeholder", "data-placeholder", "placeholder"]) {
      const v = node.getAttribute(attr);
      if (v) parts.push(v);
    }
  }
  return parts.join(" ");
}

export function isCommentEditor(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.getAttribute("contenteditable") !== "true") return false;
  // Only the editing root, not nested editable children.
  if (el.parentElement?.closest("[contenteditable='true']")) return false;
  if (el.closest(NOT_A_COMMENT_BOX) || el.closest(REPLY_SCOPE)) return false;
  if (el.closest(COMMENT_BOX_ANCESTOR)) return true;
  return /comment/i.test(hintText(el));
}

export function findPostContainer(editor: HTMLElement): HTMLElement | null {
  for (const sel of POST_CONTAINER_SELECTORS) {
    const c = editor.closest<HTMLElement>(sel);
    // The container must hold more than just the comment box.
    if (c && text(c).length > 40) return c;
  }
  return null;
}

/** Where to mount the panel: directly below the comment box. */
export function findPanelAnchor(editor: HTMLElement): HTMLElement {
  const box =
    editor.closest<HTMLElement>(".comments-comment-box, [class*='comments-comment-box']:not([class*='__'])") ??
    editor.closest<HTMLElement>("form");
  if (box) return box;
  let node: HTMLElement = editor;
  for (let i = 0; i < 3 && node.parentElement; i++) node = node.parentElement;
  return node;
}

export function postKey(container: HTMLElement | null, post: PostContext): string {
  const urn =
    container?.getAttribute("data-urn") ||
    container?.getAttribute("data-id") ||
    container?.querySelector("[data-urn^='urn:li:']")?.getAttribute("data-urn");
  if (urn) return urn;
  let h = 0;
  for (const ch of post.post_text) h = (Math.imul(31, h) + ch.charCodeAt(0)) | 0;
  return `text:${h}`;
}

// ---------------------------------------------------------------------------
// Post extraction
// ---------------------------------------------------------------------------
function expandSeeMore(container: HTMLElement) {
  const btn = container.querySelector<HTMLElement>(
    "button.feed-shared-inline-show-more-text__see-more-less-toggle[aria-expanded='false'], " +
      "button[class*='see-more'][aria-expanded='false']",
  );
  if (btn && !btn.closest(COMMENTS_REGION)) btn.click();
}

function extractPostText(container: HTMLElement): string {
  const found: HTMLElement[] = [];
  for (const sel of POST_TEXT_SELECTORS) {
    for (const el of container.querySelectorAll<HTMLElement>(sel)) {
      if (el.closest(COMMENTS_REGION)) continue;
      if (found.some((f) => f.contains(el) || el.contains(f))) continue;
      if (text(el)) found.push(el);
    }
  }
  if (found.length) {
    return cleanPostText(found.map(text).join("\n\n"));
  }

  // Fallback: the container's text minus comments, actions and our own UI.
  const clone = container.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(`${COMMENTS_REGION}, button, [contenteditable], script, style, .visually-hidden`)
    .forEach((n) => n.remove());
  return cleanPostText((clone.textContent ?? "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n"));
}

function extractMedia(container: HTMLElement): string {
  const bits = new Set<string>();
  for (const t of MEDIA_TITLE_SELECTORS.map((s) => firstText(container, [s])).filter(Boolean)) bits.add(t);
  for (const img of container.querySelectorAll<HTMLImageElement>("img[alt]")) {
    if (img.closest(COMMENTS_REGION) || img.closest("[class*='actor']")) continue;
    const alt = img.alt.trim();
    if (alt.length < 8 || /profile|logo|photo of|view .*'s|company/i.test(alt)) continue;
    bits.add(`Image: ${alt}`);
  }
  if (container.querySelector("video, [class*='linkedin-video']")) bits.add("Contains a video");
  return [...bits].slice(0, 4).join("; ");
}

export function extractPost(container: HTMLElement | null, editor: HTMLElement): PostContext {
  const root = container ?? editor.ownerDocument.body;
  if (container) expandSeeMore(container);
  const post_text = container ? extractPostText(container) : "";
  return {
    post_text: post_text.slice(0, 11_000),
    author_name: firstText(root, AUTHOR_NAME_SELECTORS) || undefined,
    author_headline: firstText(root, AUTHOR_HEADLINE_SELECTORS) || undefined,
    media_description: (container && extractMedia(container)) || undefined,
  };
}

// ---------------------------------------------------------------------------
// Writing into the editor
// ---------------------------------------------------------------------------
function placeCaretAtEnd(el: HTMLElement) {
  const sel = el.ownerDocument.getSelection();
  if (!sel) return;
  const range = el.ownerDocument.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Replace the editor's content with `value` in a way LinkedIn's editor (Quill /
 * ProseMirror) notices, so the Post button enables and mentions keep working.
 */
export function insertIntoEditor(editor: HTMLElement, value: string) {
  const doc = editor.ownerDocument;
  editor.focus();
  const sel = doc.getSelection();
  if (sel) {
    const range = doc.createRange();
    range.selectNodeContents(editor);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  let ok = false;
  try {
    ok = doc.execCommand("insertText", false, value);
  } catch {
    ok = false;
  }

  const normalise = (s: string) => s.replace(/\s+/g, " ").trim();
  if (!ok || !normalise(editor.innerText).includes(normalise(value).slice(0, 40))) {
    editor.innerHTML = "";
    for (const line of value.split("\n")) {
      const p = doc.createElement("p");
      if (line) p.textContent = line;
      else p.appendChild(doc.createElement("br"));
      editor.appendChild(p);
    }
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  }
  placeCaretAtEnd(editor);
}

export function pageIsDark(): boolean {
  const html = document.documentElement;
  if (/\btheme--dark\b|\bdark\b/.test(html.className) || /theme--dark/.test(document.body?.className ?? "")) return true;
  const bg = getComputedStyle(document.body ?? html).backgroundColor;
  const m = bg.match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return false;
  const [r, g, b, a = "1"] = m;
  if (Number(a) === 0) return false;
  return 0.2126 * Number(r) + 0.7152 * Number(g) + 0.0722 * Number(b) < 100;
}
