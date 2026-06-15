import { useEffect, useState } from 'react';
import { localFirst } from '../compose';

export const useNetworkStatus = (): { online: boolean } => {
  const [online, setOnline] = useState(() => localFirst.networkStatus.online());

  useEffect(() => localFirst.networkStatus.subscribe(setOnline), []);

  return { online };
};
