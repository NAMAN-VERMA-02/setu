"use client";

import { useEffect, useRef } from "react";

const INTERACTIVE = "a,button,[role='button'],input,select,textarea,summary,label,[data-magnetic]";

/**
 * A soft ring that trails the pointer and swells over anything clickable, plus a small
 * magnetic pull on elements marked data-magnetic. Fine pointers only; the real cursor
 * is never hidden, and nothing runs for reduced motion.
 */
export function CursorFx() {
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ring.current;
    if (!el) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || calm) return;

    let x = 0;
    let y = 0;
    let tx = 0;
    let ty = 0;
    let frame = 0;
    let magnet: HTMLElement | null = null;

    const loop = () => {
      x += (tx - x) * 0.2;
      y += (ty - y) * 0.2;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    const release = () => {
      if (magnet) magnet.style.transform = "";
      magnet = null;
    };

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      el.setAttribute("data-on", "");

      const target = e.target as Element | null;
      if (target?.closest(INTERACTIVE)) el.setAttribute("data-hover", "");
      else el.removeAttribute("data-hover");

      const m = target?.closest<HTMLElement>("[data-magnetic]") ?? null;
      if (m !== magnet) release();
      if (m) {
        magnet = m;
        const r = m.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.28;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.28;
        m.style.transform = `translate(${dx}px, ${dy}px)`;
      }
    };

    const onLeave = () => {
      el.removeAttribute("data-on");
      release();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      release();
    };
  }, []);

  return <div ref={ring} className="cursor-ring" aria-hidden="true" />;
}
