'use client';

import { useNetworkStatus } from 'features/localFirst';

export const NetworkBanner = () => {
  const { online } = useNetworkStatus();
  if (online) return null;

  return (
    <div style={{ background: '#b71c1c', color: '#fff', padding: 8, textAlign: 'center' }}>
      オフライン: 入力はローカルに保存され、オンライン復帰後に自動同期されます。
    </div>
  );
};
