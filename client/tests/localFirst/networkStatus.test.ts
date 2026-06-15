import { expect, test } from 'vitest';
import { createNetworkStatus, type NetworkEvent } from 'features/localFirst/service/networkStatus';

test('reports online state, notifies on online/offline, and cleans up listeners', () => {
  const handlers: Partial<Record<NetworkEvent, () => void>> = {};
  const removed: NetworkEvent[] = [];
  let online = true;
  const ns = createNetworkStatus({
    getOnline: () => online,
    addListener: (event, handler) => {
      handlers[event] = handler;
    },
    removeListener: (event) => {
      removed.push(event);
    },
  });

  expect(ns.online()).toBe(true);
  online = false;
  expect(ns.online()).toBe(false);

  const seen: boolean[] = [];
  const unsubscribe = ns.subscribe((o) => seen.push(o));
  handlers.online!();
  handlers.offline!();
  expect(seen).toStrictEqual([true, false]);

  unsubscribe();
  expect(removed).toStrictEqual(['online', 'offline']);
});
