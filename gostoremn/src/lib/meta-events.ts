// Meta App Events run only in the iOS and Android builds (meta-events.native.ts).
// The website keeps its own Meta Pixel.
type Line = { id: string; qty: number };
export const metaAvailable = false;
export function startMeta(): Promise<void> { return Promise.resolve(); }
export async function metaEnabled(): Promise<boolean> { return false; }
export async function setMetaEnabled(_allow: boolean): Promise<void> {}
export async function requestMetaTracking(): Promise<void> {}
export function metaViewedProduct(_id: string, _mnt: number | null): void {}
export function metaAddedToCart(_id: string, _qty: number, _mnt: number | null): void {}
export function metaInitiatedCheckout(_lines: Line[], _mnt: number): void {}
export async function metaOrderPlaced(_orderId: string): Promise<void> {}
export async function metaPurchased(_orderId: string, _mnt: number, _lines: Line[]): Promise<void> {}
