/** Optional DOM presentation; import separately from the data-only runtime. */
export function mountDialogue(
  container,
  conversation,
  { charactersPerSecond = 45, onEnd = () => {} } = {},
) {
  if (!container?.ownerDocument)
    throw new TypeError("container must be a DOM element");
  if (typeof onEnd !== "function")
    throw new TypeError("onEnd must be a function");
  if (
    !Number.isFinite(charactersPerSecond) ||
    charactersPerSecond < 0 ||
    charactersPerSecond > 500
  )
    throw new RangeError("charactersPerSecond must be in [0,500]");
  const doc = container.ownerDocument,
    win = doc.defaultView;
  let frame = 0,
    disposed = false,
    lastEnded = false,
    finishLine = () => {},
    unsubscribe = () => {};
  const root = doc.createElement("section");
  root.className = "chatter-box";
  root.setAttribute("aria-label", "Conversation");
  container.append(root);
  const style = doc.createElement("style");
  style.textContent = `.chatter-box{color:var(--chatter-text,#f5f0e6);font:inherit}.chatter-speaker{font-size:1rem;letter-spacing:.04em;margin:0 0 12px;color:var(--chatter-accent,#ffd398)}.chatter-line{font-size:1.1rem;line-height:1.65;min-height:5em;margin:0 0 20px;white-space:pre-wrap}.chatter-choices{display:grid;gap:9px}.chatter-choice,.chatter-skip{font:inherit;cursor:pointer;border:1px solid var(--chatter-border,#5c625e);border-radius:8px;text-align:left;padding:12px 15px;background:var(--chatter-button,#273638);color:inherit}.chatter-choice:enabled:hover{border-color:var(--chatter-accent,#ffd398);background:var(--chatter-hover,#354747)}.chatter-choice:focus-visible,.chatter-skip:focus-visible{outline:2px solid var(--chatter-accent,#ffd398);outline-offset:3px}.chatter-choice:disabled{opacity:.45;cursor:default}.chatter-skip{margin-bottom:12px;font-size:.875rem;padding:6px 10px}.chatter-a11y{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}`;
  root.append(style);
  function render() {
    if (disposed) return;
    win.cancelAnimationFrame?.(frame);
    const hadFocus = root.contains(doc.activeElement),
      view = conversation.view;
    [...root.children].filter((n) => n !== style).forEach((n) => n.remove());
    if (view.ended) {
      finishLine = () => {};
      const p = doc.createElement("p");
      p.textContent = "Conversation ended.";
      root.append(p);
      if (!lastEnded) {
        lastEnded = true;
        try {
          onEnd();
        } catch (error) {
          console.error("Chatter onEnd callback error", error);
        }
      }
      return;
    }
    const speaker = doc.createElement("h3");
    speaker.className = "chatter-speaker";
    speaker.textContent = view.speaker;
    root.append(speaker);
    const line = doc.createElement("p");
    line.className = "chatter-line";
    root.append(line);
    const choices = doc.createElement("div");
    choices.className = "chatter-choices";
    const action = (label, enabled, callback) => {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = "chatter-choice";
      b.textContent = label;
      b.disabled = !enabled;
      b.onclick = callback;
      choices.append(b);
      return b;
    };
    const buttons = view.choices.map((c) =>
      action(c.text, c.enabled, () => conversation.choose(c.id)),
    );
    if (view.canAdvance)
      buttons.push(action("Continue", true, () => conversation.advance()));
    const animate =
      charactersPerSecond > 0 &&
      !win.matchMedia?.("(prefers-reduced-motion: reduce)").matches &&
      typeof win.requestAnimationFrame === "function";
    if (animate) {
      line.setAttribute("aria-hidden", "true");
      const accessible = doc.createElement("p");
      accessible.className = "chatter-a11y";
      accessible.textContent = view.text;
      accessible.setAttribute("aria-live", "polite");
      root.append(accessible);
      const skip = doc.createElement("button");
      skip.type = "button";
      skip.className = "chatter-skip";
      skip.textContent = "Show full line";
      root.append(skip);
      const enabled = buttons.map((b) => !b.disabled);
      buttons.forEach((b) => (b.disabled = true));
      finishLine = () => {
        win.cancelAnimationFrame(frame);
        line.textContent = view.text;
        buttons.forEach((b, i) => (b.disabled = !enabled[i]));
        if (skip === doc.activeElement)
          buttons.find((b) => !b.disabled)?.focus({ preventScroll: true });
        skip.remove();
      };
      skip.onclick = finishLine;
      const letters = Array.from(view.text),
        start = win.performance.now();
      const tick = (now) => {
        const count = Math.floor(((now - start) / 1000) * charactersPerSecond);
        line.textContent = letters.slice(0, count).join("");
        if (count >= letters.length) finishLine();
        else frame = win.requestAnimationFrame(tick);
      };
      frame = win.requestAnimationFrame(tick);
    } else {
      line.textContent = view.text;
      finishLine = () => {};
    }
    root.append(choices);
    if (hadFocus)
      root
        .querySelector("button:not(:disabled)")
        ?.focus({ preventScroll: true });
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    finishLine = () => {};
    win?.cancelAnimationFrame?.(frame);
    try {
      unsubscribe();
    } finally {
      root.remove();
    }
  }
  try {
    unsubscribe = conversation.subscribe(render);
    render();
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    finishLine: () => finishLine(),
    dispose,
  };
}
