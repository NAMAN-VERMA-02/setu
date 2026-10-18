# Design direction

Three reference moods guide the UI; each applies to a different surface.

1. **Immersive portal ("Planet Jumping")** — landing / match reveal. Full-viewport cinematic scene, canvas "window" that tilts with the pointer and expands on click, preloader with a thin 0–100% counter, custom cursor (dot + ring, "Enter" label), blur-and-rise entrances. Used for the route-map travel between matches.
2. **Editorial archive ("ATRIUM MTL")** — core app pages. Warm off-white paper (#f5f4ef), ink #0f0f0e, accents red #ef5d44 / yellow #fcdd71 / blue #9fd5f7, floating white header card with 22px radius, oversized uppercase Archivo headlines, vertically marquee-ing rounded tile mosaic, grain overlay, staggered expo-out entrance.
3. **Engraved footer ("meridian")** — site footer. Pale sage #ebeee7, ink #2b3a30, Fraunces + Inter, looping engraved illustration blended with `mix-blend-mode: multiply`, dot-separated nav with draw-in underlines.

Rules: respect `prefers-reduced-motion`, no horizontal scroll, mobile-first, no external JS libraries for animation.
