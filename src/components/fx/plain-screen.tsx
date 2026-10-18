/**
 * Demo screens (Live Network, hop pages, join, stage) must be instant: no intro panel and no custom cursor.
 * Rendered by those routes' own layouts, so nothing in the root layout needs to know the route.
 */
export function PlainScreen() {
  return <style>{".preloader,.cursor-ring{display:none!important}"}</style>;
}
