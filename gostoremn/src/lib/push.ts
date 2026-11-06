// Web preview does not register native push devices or request browser notifications.
export const pushAvailable = false;
export async function pushOptedIn() { return false; }
export async function disablePush() {}
export async function enablePush(_requestPermission = true, _stillCurrent: () => boolean = () => true) {}
export function watchPush(_open: () => void) { return () => {}; }
export function watchPushToken(_refresh: () => void) { return () => {}; }
