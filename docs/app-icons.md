# GOStore staff app icons

The consumer GOStore icon and Android icon configuration remain unchanged.
Two new identities reuse the approved Go vector mark from assets/favicon.svg:

| Identity | Background | Symbol | Apps |
| --- | --- | --- | --- |
| Admin | #262261 purple | Shield and check | GOStore Admin iOS |
| Warehouse | #087F83 teal | Warehouse and parcel | UB Warehouse iOS and Erlian Warehouse Android |

The warehouse icons intentionally match across cities/platforms.

## Assets and regeneration

Editable SVG masters/layers are in assets/app-icons/.
Run node scripts/generate-app-icons.cjs from the repository root. It uses existing
Playwright tooling and Chrome; CHROME_PATH may override the Chrome executable.
Output defaults to output/app-icons/. The preview copies the unchanged consumer
icon for comparison only; the generator does not redesign or install that icon.

Copy admin.png to staff-ios/assets/admin.png. Copy warehouse.png to both
staff-ios/assets/warehouse.png and warehouse-android/res/drawable/app_icon.png.
Copy warehouse-adaptive.png and warehouse-monochrome.png to
warehouse-android/res/drawable-nodpi/app_icon_foreground.png and
app_icon_monochrome.png, respectively. Keep SVG source files in sync.

Full staff icons are opaque 1024 x 1024 RGB PNGs with square corners.
Android adaptive/themed layers are transparent RGBA; artwork stays inside the
central 66/108 safe circle. Qualifier-specific XML selects adaptive icons on
Android 8+ and monochrome icons on Android 13+.

## Validation and release

Validated dimensions/color types, matching warehouse hashes, resolved Expo
configurations, adaptive safe areas and Android resource compilation.
Staff typecheck and navigation tests passed.

Installed launcher icons require new native builds. Expo OTA cannot replace
them. Build and distribute Admin iOS, UB Warehouse iOS and Erlian Android binaries
to update installed devices. Store submissions are a separate release step.
