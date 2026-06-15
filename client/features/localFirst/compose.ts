import axios from 'axios';
import { apiClient } from 'utils/apiClient';
import { amplifySessionKeyProvider } from './crypto/sessionKeyProvider';
import { createNetworkStatus, type NetworkStatusDeps } from './service/networkStatus';
import { createSyncService } from './service/syncService';
import { createLocalDraftStore } from './store/localDraftStore';

// 既定依存の配線（ブラウザ navigator/window・Cognito・aspida・S3 presigned PUT）。
// 本モジュールは副作用境界の組成のみ。coverage 対象外（テストは各ポートをスタブ注入）。

const store = createLocalDraftStore({ keyProvider: amplifySessionKeyProvider });

const browserNetworkDeps: NetworkStatusDeps = {
  getOnline: () => navigator.onLine,
  addListener: (event, handler) => window.addEventListener(event, handler),
  removeListener: (event, handler) => window.removeEventListener(event, handler),
};

const syncService = createSyncService({
  store,
  submit: (payload) => apiClient.private.surveys.submission.$post({ body: payload }),
  putObject: async (url, blob, contentType) => {
    await axios.put(url, blob, { headers: { 'Content-Type': contentType } });
  },
  confirm: async (surveyId, photoIds) => {
    await apiClient.private.surveys._surveyId(surveyId).photos.confirm.$post({
      body: { photoIds },
    });
  },
  now: Date.now,
  genId: () => crypto.randomUUID(),
});

export const localFirst = {
  store,
  syncService,
  networkStatus: createNetworkStatus(browserNetworkDeps),
};
