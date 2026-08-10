// No route can server-render yet: both pages call createSocket() at
// component-init scope, and userStore reads localStorage at module scope.
// SSR is disabled app-wide until a route exists that can support it —
// Phase 5's club pages are the first candidate.
export const ssr = false;
export const prerender = false;
