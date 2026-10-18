"use client";

import { useEffect, useState } from "react";

/** Live local time for the college (India). Renders after mount to avoid a server/client mismatch. */
export function LiveClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return <span suppressHydrationWarning>{time || "--:--:--"} IST</span>;
}
