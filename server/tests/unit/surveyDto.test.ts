import type { Survey } from '@prisma/client';
import { surveyMethod } from 'domain/survey/model/surveyMethod';
import type { SurveyEntity } from 'domain/survey/model/surveyType';
import { toSurveyDetailDto, toSurveyDto } from 'domain/survey/store/toSurveyDto';
import type { SurveyRow } from 'domain/survey/store/toSurveyDto';
import { describe, expect, test } from 'vitest';
import { firstPayload, makeFirstRow, makeRow, makeSecondRow, makeUser } from './surveyFixtures';

describe('toSurveyDto / toSurveyDetailDto', () => {
  test('最小行（null 多数）: PII 除外 vs 含む', () => {
    const row = makeRow();
    const dto = toSurveyDto(row);
    const detail = toSurveyDetailDto(row);

    expect(dto.parentSurveyId).toBeNull();
    expect(dto.officialChosenAt).toBeNull();
    expect(dto.officialChosenBy).toBeNull();
    expect(dto.submittedAt).toBeNull();
    expect(dto.first).toBeNull();
    expect(dto.second).toBeNull();
    expect('victimName' in dto).toBe(false);
    expect(detail.victimName).toBeNull();
  });

  test('全項目 populated（first 従属・日時・official）', () => {
    const row = makeRow(
      {
        parentSurveyId: 'p-1',
        status: 'confirmed',
        victimName: '太郎',
        latitude: 35,
        longitude: 139,
        floors: 2,
        buildingName: 'B',
        damageRatio: 50,
        damageLevel: 'half',
        assessmentBasis: { stub: true } as unknown as Survey['assessmentBasis'],
        officialSurveyId: 'o-1',
        officialChosenBy: 'admin-1',
        officialChosenAt: new Date(1000),
        submittedAt: new Date(2000),
        approvedBy: 'admin-1',
        approvedAt: new Date(3000),
        confirmedBy: 'admin-1',
        confirmedAt: new Date(4000),
      },
      makeFirstRow({ tiltRatio: 0.1, inundationDepthCm: 50, floorApportionment: [{ floor: 1, ratio: 100 }] }),
    );
    const detail = toSurveyDetailDto(row);

    expect(detail.parentSurveyId).toBe('p-1');
    expect(detail.officialChosenAt).toBe(1000);
    expect(detail.officialChosenBy).toBe('admin-1');
    expect(detail.approvedAt).toBe(3000);
    expect(detail.confirmedAt).toBe(4000);
    expect(detail.victimName).toBe('太郎');
    expect(detail.first?.tiltRatio).toBe(0.1);
    expect(detail.assessmentBasis).toEqual({ stub: true });
  });

  test('second 従属データ', () => {
    const row = makeRow({ surveyType: 'second', parentSurveyId: 'p-1' }, null, makeSecondRow());
    const dto = toSurveyDto(row);

    expect(dto.second?.partDamages).toEqual([{ part: 'roof', damageRatio: 10 }]);
    expect(dto.second?.floorApportionment).toBeNull();
  });
});

// INV-2: SubmissionPayload → Entity → (永続化行) → Dto の往復で意味的同一（PBT-02）。
describe('INV-2 ペイロード往復', () => {
  const toDate = (ms: number | null): Date | null => (ms === null ? null : new Date(ms));

  const rowFromEntity = (e: SurveyEntity): SurveyRow =>
    makeRow(
      {
        id: e.id,
        surveyType: e.surveyType,
        parentSurveyId: e.parentSurveyId,
        status: e.status,
        address: e.address,
        houseNumber: e.houseNumber,
        structureType: e.structureType,
        buildingName: e.buildingName,
        floors: e.floors,
        victimName: e.victimName,
        victimContact: e.victimContact,
        victimAddress: e.victimAddress,
        latitude: e.latitude,
        longitude: e.longitude,
        damageRatio: e.damageRatio,
        damageLevel: e.damageLevel,
        assessmentBasis: e.assessmentBasis as unknown as Survey['assessmentBasis'],
        officialSurveyId: e.officialSurveyId,
        officialChosenBy: e.officialChosenBy,
        officialChosenAt: toDate(e.officialChosenAt),
        createdBy: e.createdBy,
        createdAt: new Date(e.createdTime),
        submittedAt: toDate(e.submittedAt),
      },
      e.first === null
        ? null
        : makeFirstRow({
            externalForceFlags: e.first.externalForceFlags,
            tiltRatio: e.first.tiltRatio,
            inundationDepthCm: e.first.inundationDepthCm,
            floorApportionment: e.first.floorApportionment,
          }),
    );

  test('first ペイロードの往復同一性', () => {
    const entity = surveyMethod.createFromSubmission(makeUser(['surveyor']), firstPayload('s-1'));
    const detail = toSurveyDetailDto(rowFromEntity(entity));

    expect(detail).toEqual(entity);
  });
});
