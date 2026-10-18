"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** A QR code drawn as an inline SVG (no images). Black on white so phones scan it in either theme. */
export function Qr({ value, size = 360, label }: { value: string; size?: number; label?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0f0f0e", light: "#ffffff" } }).then((s) => alive && setSvg(s));
    return () => {
      alive = false;
    };
  }, [value]);
  return (
    <div
      role="img"
      aria-label={label ?? `QR code for ${value}`}
      className="overflow-hidden rounded-2xl bg-white p-3 [&>svg]:h-full [&>svg]:w-full"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
