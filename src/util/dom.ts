/** Typed DOM lookups that fail loudly instead of returning `null`. */

type ElementClass<T extends Element> = abstract new (...args: never[]) => T;

/** Returns the element with `id`, optionally verified against a constructor such as `HTMLCanvasElement`. */
export function byId(id: string): HTMLElement;
export function byId<T extends HTMLElement>(id: string, type: ElementClass<T>): T;
export function byId<T extends HTMLElement>(id: string, type?: ElementClass<T>): HTMLElement {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Required element #${id} is missing from the page.`);
  }
  if (type && !(el instanceof type)) {
    throw new Error(`Element #${id} is not a ${type.name}.`);
  }
  return el;
}

/** Like {@link byId} for elements that may legitimately be absent from the markup. */
export function maybeById(id: string): HTMLElement | null;
export function maybeById<T extends HTMLElement>(id: string, type: ElementClass<T>): T | null;
export function maybeById<T extends HTMLElement>(
  id: string,
  type?: ElementClass<T>,
): HTMLElement | null {
  const el = document.getElementById(id);
  if (!el) return null;
  if (type && !(el instanceof type)) {
    throw new Error(`Element #${id} is not a ${type.name}.`);
  }
  return el;
}

/** Returns the 2D rendering context of `canvas`, throwing when the browser refuses to create one. */
export function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas rendering is not available in this browser.');
  }
  return ctx;
}

/** `closest()` for event targets, which are not always elements (the window, the document, text nodes). */
export function closestFrom<T extends Element = Element>(
  target: EventTarget | null,
  selector: string,
): T | null {
  return target instanceof Element ? target.closest<T>(selector) : null;
}

/** Wires `handler` to the click of the element `id`; silently skipped when the markup has no such element. */
export function onClick(
  id: string,
  handler: (button: HTMLElement) => void,
  { stopPropagation = false }: { stopPropagation?: boolean } = {},
): void {
  const button = maybeById(id);
  if (!button) return;
  button.addEventListener('click', (e) => {
    if (stopPropagation) e.stopPropagation();
    handler(button);
  });
}
