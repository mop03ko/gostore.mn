# gostore.mn App Store listing

App Store Connect record: `6828991827`; bundle ID: `mn.gostore.app`. The listing uses `en-US` because App Store Connect does not offer a Mongolian localization; the description is primarily Mongolian with an English summary. The app interface is Mongolian and catalog titles are English.

## Saved configuration

- Listing copy: `gostoremn/store/app-store.json`.
- Primary/secondary categories: Shopping / Lifestyle.
- Distribution: free download, Mongolia (`MNG`) only; new territories disabled.
- Release: manual. Preparing the listing does not submit it for public App Review or release it.
- Version: `1.0.0`, production iOS build `4`. Icon comes from the opaque 1024×1024 GOStore PNG embedded in that build.
- Review contact: Arvis Trans, `shop@gostore.mn`, `+97686079077` (owner confirmed the existing contact name).
- A dedicated, ordinary customer review account is configured in Apple's review fields. Its password stays in ignored local storage and App Store Connect; never copy it into this repository. No purchases or payments were made while preparing the listing.
- Privacy: `gostoremn/store/privacy-declaration.json` records the declared data categories and code-based rationale; the live privacy policy is `https://gostore.mn/mobile-privacy.html`.
- Age rating: `gostoremn/store/age-rating.json` records the owner-authorized Taobao policy basis and a 13+ minimum override. This does not introduce an age-verification feature or a new catalog filtering system.

## Native screenshots

`scripts/capture-store-screenshots.cjs` runs in a custom EAS simulator build only when `GOSTORE_CAPTURE_SCREENSHOTS=1`. It boots a Pro Max simulator, installs the compiled app, and runs the Maestro flow to capture home/categories/product/options with public live catalog data. The flow handles iOS deep-link confirmation and asserts each destination is visible. It never creates an account, cart checkout, order or payment. Inspect every image before upload; products may become unavailable or images may load slowly.

From `gostoremn/`, build fresh screenshots with:

```powershell
npx eas-cli@latest build --platform ios --profile screenshots
```

The `screenshots-capture` profile can reuse the specific simulator archive recorded in `GOSTORE_SIMULATOR_ARCHIVE_URL`. This archive reflects the app as built on 2026-10-31; update that URL to a newly verified simulator archive after app changes, or use the fresh `screenshots` profile. `.eas/build/capture-existing-ios.yml` uses absolute step outputs for artifact paths because this project is in a repository subdirectory.

Capture output is excluded from Git. Download the build artifact to `output/app-store/`, inspect native UI and pixel dimensions, then upload only complete, representative screens. Keep bank QR codes, personal customer details and real orders out of listing images.

On 2026-10-31, four visually inspected native screenshots (home, categories, product details and variant selection) were uploaded at 1320 × 2868 pixels to the iPhone screenshot set. The capture flow passed on an iPhone 18 Pro Max simulator. Apple processing must finish before the version can be added to an App Review draft; uploading images alone does not submit the app.
