"use client";

import { useEffect } from "react";

/**
 * Full-screen intro on the first visit of a session: the wordmark rises and a counter
 * runs to 100%, then the panel lifts away. It is pure CSS, so it also ends on its own
 * if scripts fail. Later page loads in the same tab skip it.
 */
export function Preloader() {
  useEffect(() => {
    try {
      sessionStorage.setItem("setu-intro", "1");
    } catch {
      // storage can be blocked; the intro simply shows again next time
    }
  }, []);

  return (
    <div className="preloader" aria-hidden="true">
      <p className="preloader-word">
        <span className="block">SETU</span>
      </p>
      <div className="preloader-meta">
        <span className="preloader-count" />
        <span className="hidden sm:inline">Their yesterday is your tomorrow</span>
        <span>सेतु</span>
      </div>
    </div>
  );
}
