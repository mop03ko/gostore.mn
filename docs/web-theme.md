# Storefront appearance

The header's moon/sun button toggles Dark Mode on desktop and mobile. Its
`aria-pressed` state reports whether dark mode is enabled; Enter/Space work as
for any native button. The touch target is at least 44px.

The first visit follows `prefers-color-scheme`. An explicit light/dark choice is
saved under `localStorage['gostore-theme']` and takes precedence over later
system changes. Other tabs follow storage events. If storage is unavailable,
the button still works for the current page. Removing the key restores system
following. No account or server setting is involved.

The small head bootstrap applies the initial appearance before stylesheet paint.
`theme.js` updates the button, browser theme color, system changes and other tabs.
The stylesheet sources use `--theme-*` tokens with their previous light colors
as fallbacks. Only `theme.css` defines the dark palette. Existing dark marketing
sections and photo/logo colors are preserved; there is no page/image inversion.
Translucent color tokens retain their alpha. The white footer wordmark stays on
its original dark background.

Run `node scripts/bundle.cjs` after edits. Production serves the versioned
`app.css`, `app.js` and `index.html`; standalone source assets need not be deployed.

Validation: `node tests/web-theme.cjs` against an isolated offline PHP fixture
on localhost (default port 8091, override with `TEST_BASE`). It covers manual
switching, reload persistence, system following, keyboard operation, tab sync,
blocked storage, 320/390/1440px widths, and Home/Product/Cart/Account/Help routes.
Screenshots in ignored `output/web-theme/` are test previews, not store images.
