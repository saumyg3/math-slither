/** Build a detached element from an HTML string (first root node). */
export function el(html: string): HTMLElement {
  const tpl = document.createElement('div');
  tpl.innerHTML = html.trim();
  return tpl.firstElementChild as HTMLElement;
}

/** Restart a CSS animation class even if it is already applied. */
export function retrigger(target: HTMLElement, cls: string): void {
  target.classList.remove(cls);
  void target.offsetWidth; // force reflow so the animation restarts
  target.classList.add(cls);
}
