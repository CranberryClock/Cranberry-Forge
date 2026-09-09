import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";

const shellCommands = (highlighter) => {
  const grammar = bash(highlighter);
  grammar.keywords.built_in.push(
    "npm",
    "npx",
    "pnpm",
    "yarn",
    "node",
    "git",
    "python",
    "python3",
    "curl",
  );
  return grammar;
};

for (const [name, grammar] of Object.entries({
  javascript,
  typescript,
  json,
  bash: shellCommands,
  xml,
  css,
}))
  hljs.registerLanguage(name, grammar);

const aliases = {
  js: "javascript",
  jsx: "javascript",
  javascript: "javascript",
  ts: "typescript",
  tsx: "typescript",
  typescript: "typescript",
  json: "json",
  sh: "bash",
  shell: "bash",
  console: "bash",
  bash: "bash",
  html: "xml",
  svg: "xml",
  xml: "xml",
  css: "css",
  text: "plaintext",
  txt: "plaintext",
  plaintext: "plaintext",
};

function escapeCode(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Highlight escaped source text only; never interpret pasted code as HTML. */
export function highlightCode(source, language = "javascript") {
  const text = String(source);
  const selected = aliases[language] || "plaintext";
  return selected === "plaintext"
    ? escapeCode(text)
    : hljs.highlight(text, { language: selected, ignoreIllegals: true }).value;
}

export function inferLanguage(element) {
  const declared =
    element.dataset.language ||
    element.className.match(/\blang(?:uage)?-([\w-]+)/)?.[1] ||
    element.parentElement?.className.match(/\blang(?:uage)?-([\w-]+)/)?.[1];
  if (declared) return aliases[declared.toLowerCase()] || "plaintext";
  const text = element.textContent.trim();
  if (["json", "state-trace"].includes(element.id) || /^[\[{]/.test(text))
    return "json";
  if (/^(?:\$\s*)?(?:npm|npx|pnpm|yarn|git|cd|node|python|curl)\b/.test(text))
    return "bash";
  if (element.hasAttribute("data-product-command")) return "plaintext";
  if (/^\s*</.test(text)) return "xml";
  if (/\b(?:interface|type)\s+\w+\s*[={]/.test(text)) return "typescript";
  return "javascript";
}

/** Observe the display nodes, leaving the demos' state and copy handlers alone. */
export function enhanceLiveCode(document) {
  const window = document.defaultView;
  const nodes = new Set(document.querySelectorAll("[data-forge-syntax]"));
  const last = new WeakMap();
  let scheduled = false,
    stopped = false,
    frame = 0;
  let pending = new Set(nodes);
  const schedule = () => {
    if (!scheduled && pending.size && !stopped) {
      scheduled = true;
      // Coalesce updates within one browser frame; continuous traces stay live.
      frame = window.requestAnimationFrame(flush);
    }
  };
  function discover(root) {
    if (root.nodeType !== 1) return;
    const candidates = [];
    if (root.matches("pre, code[data-product-command]")) candidates.push(root);
    candidates.push(
      ...root.querySelectorAll("pre, code[data-product-command]"),
    );
    for (const block of candidates) {
      const node = block.matches("pre")
        ? block.querySelector(":scope > code") || block
        : block;
      if (
        nodes.has(node) ||
        node.closest(
          '[contenteditable="true"], [data-no-highlight], .nohighlight',
        )
      )
        continue;
      const language = inferLanguage(node);
      node.classList.add("hljs", `language-${language}`);
      node.dataset.language = language;
      node.setAttribute("data-forge-syntax", "");
      nodes.add(node);
      pending.add(node);
    }
  }
  const observer = new window.MutationObserver((records) => {
    for (const record of records) {
      const node =
        record.target.nodeType === 1
          ? record.target
          : record.target.parentElement;
      const target = node?.closest("[data-forge-syntax]");
      if (target) pending.add(target);
    }
    schedule();
  });
  // Guide dialogs insert new examples after startup. Only inspect added element
  // subtrees; changing metric text and WebGL frames do not trigger a page scan.
  const discovery = new window.MutationObserver((records) => {
    for (const record of records)
      for (const node of record.addedNodes) discover(node);
    schedule();
  });
  const observe = () =>
    nodes.forEach((node) =>
      observer.observe(node, {
        childList: true,
        characterData: true,
        subtree: true,
      }),
    );
  function flush() {
    if (stopped) return;
    frame = 0;
    scheduled = false;
    observer.disconnect();
    discovery.disconnect();
    for (const node of pending) {
      if (!node.isConnected) {
        nodes.delete(node);
        continue;
      }
      const source = node.textContent;
      const language = node.dataset.language || inferLanguage(node);
      const previous = last.get(node);
      const alreadyHighlighted =
        !source ||
        node.querySelector(
          ".hljs-keyword, .hljs-string, .hljs-number, .hljs-attr, .hljs-comment, .hljs-title, .hljs-built_in, .hljs-tag",
        );
      if (
        previous?.source === source &&
        previous.language === language &&
        alreadyHighlighted
      )
        continue;
      // Very large user-pasted reports remain readable without blocking a frame.
      if (source.length <= 100000)
        node.innerHTML = highlightCode(source, language);
      last.set(node, { source, language });
    }
    pending = new Set();
    for (const node of nodes) if (!node.isConnected) nodes.delete(node);
    observe();
    discovery.observe(document.body, { childList: true, subtree: true });
  }
  discover(document.body);
  flush();
  return () => {
    stopped = true;
    observer.disconnect();
    discovery.disconnect();
    if (frame) window.cancelAnimationFrame(frame);
    pending.clear();
  };
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading")
    document.addEventListener(
      "DOMContentLoaded",
      () => enhanceLiveCode(document),
      { once: true },
    );
  else enhanceLiveCode(document);
}
