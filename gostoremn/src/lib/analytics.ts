// Android remains off until its own Firebase client config is supplied. Web uses
// the website's existing Analytics integration, never the native SDK.
export const analyticsAvailable = false;
export async function analyticsEnabled(): Promise<boolean> { return false; }
export async function setAnalyticsEnabled(_enabled: boolean): Promise<void> {}
export async function trackScreen(_screen: string | null): Promise<void> {}
