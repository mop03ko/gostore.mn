export type PushConfig = { enabled: boolean; platforms?: string[] };
export function pushConfigured(config: PushConfig, platform: string): boolean {
  return config.enabled && (!config.platforms || config.platforms.includes(platform));
}
