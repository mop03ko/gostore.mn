# Fishing category

Added 2026-11-06. Public destination: /?category=fishing#catalog.

Fishing is a separate department, moved out of the Outdoor child list. It has
eight subcategories: rods, reels, line, hooks, lures, floats, tackle boxes and
landing nets. Homepage sidebar and catalog category navigation link to it.
The homepage Fishing tab shows eight provider products plus subcategory links
and a full catalog link; the full catalog retains existing pagination/filtering.

Supplier searches map English/Mongolian labels to precise Chinese keywords.
The parent department participates in the existing mixed homepage feed.
The shared generated Expo category data is synchronized, but installed native
apps require a future build/update to receive that bundled data.

Validation: isolated native catalog fixtures, fishing UI flow at desktop and
320/390px, shared category generation, bundle freshness, Expo lint/typecheck.
The base-home layout test excludes the independently rendered 11.11 banner
when comparing JavaScript/no-JavaScript reserved sizes.

Deployed with backup /gostore-backups/fishing-category-1793978641430.
Live supplier search returned 12 fishing products with prices; the homepage
tab rendered 8 cards and 8 subcategory links at 390px without overflow.
No live orders or payments were created.
