import ReactDOM from "react-dom/client";
import cssText from "@/assets/content.css?inline";
import { CommentPanel } from "@/components/comment-panel";
import {
  PANEL_TAG,
  extractPost,
  findPanelAnchor,
  findPostContainer,
  insertIntoEditor,
  isCommentEditor,
  pageIsDark,
  postKey,
} from "@/lib/linkedin";
import { getSettings, settingsItem } from "@/lib/settings";

interface Mounted {
  host: HTMLElement;
  root: ReactDOM.Root;
}

export default defineContentScript({
  matches: ["https://www.linkedin.com/*", "https://linkedin.com/*"],
  runAt: "document_idle",
  main(ctx) {
    const mounted = new Map<HTMLElement, Mounted>();
    /** Editors whose panel the user closed; don't re-open until the box is recreated. */
    const dismissed = new WeakSet<HTMLElement>();
    let enabled = true;

    // Tailwind v4 relies on @property rules, which browsers ignore inside a
    // Shadow DOM. Register them once at document level (they only define
    // --tw-* custom properties, so LinkedIn's own styles are unaffected).
    const propertyRules = cssText.match(/@property[^{]+\{[^}]*\}/g);
    if (propertyRules && !document.getElementById("linkcomment-properties")) {
      const style = document.createElement("style");
      style.id = "linkcomment-properties";
      style.textContent = propertyRules.join("\n");
      document.head.appendChild(style);
    }

    function unmount(editor: HTMLElement) {
      const m = mounted.get(editor);
      if (!m) return;
      m.root.unmount();
      m.host.remove();
      mounted.delete(editor);
    }

    function mount(editor: HTMLElement) {
      if (mounted.has(editor) || dismissed.has(editor)) return;

      const host = document.createElement(PANEL_TAG);
      host.style.display = "block";
      // Keep LinkedIn's click handlers (e.g. "close comment box") from seeing our clicks.
      for (const evt of ["click", "mousedown", "keydown", "keyup", "keypress", "focusin"]) {
        host.addEventListener(evt, (e) => e.stopPropagation());
      }
      const shadow = host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = cssText;
      const container = document.createElement("div");
      shadow.append(style, container);

      findPanelAnchor(editor).insertAdjacentElement("afterend", host);

      const root = ReactDOM.createRoot(container);
      mounted.set(editor, { host, root });

      root.render(
        <CommentPanel
          dark={pageIsDark()}
          getPost={() => extractPost(findPostContainer(editor), editor)}
          getKey={(post) => postKey(findPostContainer(editor), post)}
          onInsert={(text) => insertIntoEditor(editor, text)}
          onDismiss={() => {
            dismissed.add(editor);
            unmount(editor);
          }}
        />,
      );
    }

    function scan() {
      for (const editor of [...mounted.keys()]) {
        if (!editor.isConnected || !enabled) unmount(editor);
      }
      if (!enabled) return;
      for (const el of document.querySelectorAll("[contenteditable='true']")) {
        if (isCommentEditor(el)) mount(el);
      }
    }

    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        scan();
      });
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("focusin", schedule, true);
    ctx.onInvalidated(() => {
      observer.disconnect();
      document.removeEventListener("focusin", schedule, true);
      for (const editor of [...mounted.keys()]) unmount(editor);
    });

    getSettings().then((s) => {
      enabled = s.enabled;
      scan();
    });
    const unwatch = settingsItem.watch((s) => {
      enabled = s?.enabled ?? true;
      schedule();
    });
    ctx.onInvalidated(unwatch);
  },
});
