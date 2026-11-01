# Mixed home feed

Updated 2026-11-02.

The web and Expo home screens temporarily omit the official-store shelf. Web does
not call its directory API on home; direct store routes remain available for later
reuse. Expo's empty search now uses `__all__`, as the website does, instead of
`storage box`.

For TaoWorld, `__all__` now samples six departments per page from the existing
25-department mapping. Each contributes up to twenty native search results. Rows
are interleaved across departments, policy-filtered and deduplicated by product ID,
then capped to the requested 12/50-item display limit. This is a mixed discovery
sample, not an exhaustive export of the provider catalog. Each next page advances
six departments; after a complete department cycle, native page numbers advance.
The schedule is deterministic so refreshing the same cached page does not reshuffle
items or destabilize pagination. Explicit category/keyword searches stay scoped.

At most three provider calls run concurrently, with six cold reads per page.
Existing thirty-minute native search snapshots are shared with category searches.
Quota reservations are atomic per batch, successful responses survive another
request's failure, and locks are always released. Display-cache revalidation and
fresh purchase price/stock checks retain their existing behavior. Explicit price
sorting applies to the mixed sample; default ordering interleaves categories.

Native catalog fixtures cover six-category diversity, unique products, stable
warm-cache ordering and department rotation. Browser tests verify the hidden shelf
does not request directory data and that home uses `__all__`. Expo lint/typecheck
pass; installed apps need a separately published update to receive these UI changes.

Live read-only validation returned `feed=mixed_departments`, fifty unique products
and `more=true` on the first 50-item page, with bags, shoes, jewelry, beauty and
home products interleaved. Deployment preserves the previous server files in the
hosting backup directory.
