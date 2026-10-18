"use client";

import { useEffect, useRef } from "react";

export const LIVE_EVENT = "setu:live";

/** Runs `onChange` whenever the header's live channel reports a change to a table this screen shows. */
export function useLive(onChange: () => void) {
  const saved = useRef(onChange);
  useEffect(() => {
    saved.current = onChange;
  });
  useEffect(() => {
    const handler = () => saved.current();
    window.addEventListener(LIVE_EVENT, handler);
    return () => window.removeEventListener(LIVE_EVENT, handler);
  }, []);
}
