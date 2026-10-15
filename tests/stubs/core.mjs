export const Capacitor = { isNativePlatform: () => false };
export const registerPlugin = () => new Proxy({}, { get: () => async () => ({}) });
