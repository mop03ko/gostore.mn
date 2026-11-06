# GOStore Google Tag Manager

Installed 2026-11-06: GTM-K4VZDWH3 on the shared storefront index.html.
Uses the current Google install snippet with an async gtm.js script high in
the head. dataLayer, gtag and the js timestamp initialize once, before loading
the container. The existing GA4 config G-WLC1E39628 still executes once and
its direct loader remains delayed until after load. Meta Pixel remains direct.

The public GTM response returned HTTP 200 during setup; its resource contained
no configured tags, no GA4 measurement IDs and no GOStore Meta Pixel ID.
The GTM account/workspace itself was not accessed or changed. If these direct
tags are moved into GTM later, remove the corresponding direct installation
in the same release to avoid duplicate events. Container installation alone
does not configure ecommerce or Conversions API events.

Official installation reference:
https://support.google.com/tagmanager/answer/14847097

Validation uses intercepted analytics requests so test visits do not send
production analytics. Check one shared js initialization, one GA4 config,
one GTM request and unchanged Meta PageView behavior, plus bundle freshness.

Deployed index.html with backup /gostore-backups/gtm-1793950611148.
Live homepage content matches the local file; GTM loads and initialization are singular.
