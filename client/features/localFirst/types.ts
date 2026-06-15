import type { DtoId } from 'common/types/brandedId';
import type { PhotoUploadTicket } from 'common/types/photo';
import type {
  ExternalForceFlags,
  FloorRatio,
  PartDamage,
  StructureType,
} from 'common/types/survey';

// ローカル ID（クライアント採番。survey は UUID をブランド型へキャストして利用）。
export type LocalDraftId = string;
export type LocalPhotoId = string;
export type SyncJobId = string;

export type LocalSurveyType = 'first' | 'second';

// 下書きの同期状態（FR-19）。
export type DraftSyncState = 'editing' | 'queued' | 'syncing' | 'synced' | 'failed';

// 提出ペイロードの素材（下書き中は部分入力を許容）。
export type DraftInput = {
  survey: Partial<{
    address: string;
    houseNumber: string;
    structureType: StructureType;
    buildingName: string;
    floors: number;
    victimName: string;
    victimContact: string;
    victimAddress: string;
    latitude: number;
    longitude: number;
    parentSurveyId: DtoId['survey'];
  }>;
  firstSurvey?: Partial<{
    externalForceFlags: ExternalForceFlags;
    tiltRatio: number;
    inundationDepthCm: number;
    floorApportionment: FloorRatio[];
  }>;
  secondSurvey?: Partial<{
    partDamages: PartDamage[];
    floorApportionment: FloorRatio[];
  }>;
};

// ウィザード再開用の進捗（U6f は不透明に保持・復元、解釈は U6u）。
export type DraftProgress = {
  currentStep: string;
  completedSteps: string[];
  updatedAt: number;
};

// 再開可能な調査下書き（メモリ内の平文表現）。
export type LocalDraft = {
  id: LocalDraftId;
  surveyType: LocalSurveyType;
  input: DraftInput;
  progress: DraftProgress;
  photoIds: LocalPhotoId[];
  syncState: DraftSyncState;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
};

// 一覧用（PII 非含有・鍵 locked でも返せる）。
export type LocalDraftSummary = {
  id: LocalDraftId;
  surveyType: LocalSurveyType;
  syncState: DraftSyncState;
  updatedAt: number;
};

export type LocalPhotoStatus = 'local' | 'uploading' | 'uploaded' | 'confirmed';

// 提出前にローカル保持する撮影画像（メモリ内は Blob）。
export type LocalPhoto = {
  id: LocalPhotoId;
  draftId: LocalDraftId;
  fileName: string;
  contentType: string;
  part: string | null;
  step: string | null;
  blob: Blob;
  status: LocalPhotoStatus;
  serverPhotoId: DtoId['photo'] | null;
  createdAt: number;
};

// 提出時一括同期の再開ポイント。
export type SyncStage = 'submission' | 'photos-put' | 'confirm' | 'done';

// 永続化される提出キュー要素（PII 非保持・draftId 参照のみ）。
export type SyncJob = {
  id: SyncJobId;
  draftId: LocalDraftId;
  surveyId: DtoId['survey'];
  stage: SyncStage;
  attempts: number;
  nextAttemptAt: number;
  uploadTickets: PhotoUploadTicket[];
  confirmedPhotoIds: DtoId['photo'][];
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
};
