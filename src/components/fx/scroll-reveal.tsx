"use client";

import { useEffect } from "react";

/**
 * Elements with the `reveal` class fade up the first time they scroll into view,
 * including ones that appear later (for example after data loads).
 */
export function ScrollReveal() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("js-reveal");

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );

    const seen = new WeakSet<Element>();
    const watch = (node: ParentNode) => {
      node.querySelectorAll(".reveal:not(.is-in)").forEach((el) => {
        if (!seen.has(el)) {
          seen.add(el);
          io.observe(el);
        }
      });
    };
    watch(document);

    const mo = new MutationObserver(() => watch(document));
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      root.classList.remove("js-reveal");
    };
  }, []);

  return null;
}
