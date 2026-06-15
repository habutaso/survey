// ネットワーク状態監視（Q7=A）。ブラウザ依存（navigator/window）は compose で注入し、
// 本モジュールは注入された deps のみに依存（テスト容易・100% カバレッジ対象）。
export type NetworkEvent = 'online' | 'offline';

export type NetworkStatusDeps = {
  getOnline: () => boolean;
  addListener: (event: NetworkEvent, handler: () => void) => void;
  removeListener: (event: NetworkEvent, handler: () => void) => void;
};

export type NetworkStatus = {
  online: () => boolean;
  subscribe: (handler: (online: boolean) => void) => () => void;
};

export const createNetworkStatus = (deps: NetworkStatusDeps): NetworkStatus => ({
  online: () => deps.getOnline(),
  subscribe: (handler) => {
    const onOnline = (): void => handler(true);
    const onOffline = (): void => handler(false);
    deps.addListener('online', onOnline);
    deps.addListener('offline', onOffline);
    return () => {
      deps.removeListener('online', onOnline);
      deps.removeListener('offline', onOffline);
    };
  },
});
