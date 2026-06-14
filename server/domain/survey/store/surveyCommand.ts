import { Prisma } from '@prisma/client';
import type { SurveyDetailDto } from 'common/types/survey';
import type { SurveyEntity } from '../model/surveyType';
import { surveyQuery } from './surveyQuery';

// Json 値の保存変換（null は Prisma.JsonNull, それ以外は InputJsonValue）。
const json = (value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);

const toDate = (epoch: number | null): Date | null => (epoch === null ? null : new Date(epoch));

export const surveyCommand = {
  // Survey 集約の保存（INSERT/UPDATE）。冪等な再 ingest・状態遷移・正式判定すべてに対応。
  // create は createdBy/createdAt を設定、update は createAt/createdBy を保持（上書きしない）。
  upsert: async (tx: Prisma.TransactionClient, e: SurveyEntity): Promise<SurveyDetailDto> => {
    const common = {
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
      assessmentBasis: json(e.assessmentBasis),
      officialSurveyId: e.officialSurveyId,
      officialChosenBy: e.officialChosenBy,
      officialChosenAt: toDate(e.officialChosenAt),
      submittedAt: toDate(e.submittedAt),
      approvedBy: e.approvedBy,
      approvedAt: toDate(e.approvedAt),
      confirmedBy: e.confirmedBy,
      confirmedAt: toDate(e.confirmedAt),
    };

    await tx.survey.upsert({
      where: { id: e.id },
      update: common,
      create: { id: e.id, createdBy: e.createdBy, createdAt: new Date(e.createdTime), ...common },
    });

    if (e.first !== null) {
      const data = {
        externalForceFlags: json(e.first.externalForceFlags),
        tiltRatio: e.first.tiltRatio,
        inundationDepthCm: e.first.inundationDepthCm,
        floorApportionment: json(e.first.floorApportionment),
      };

      await tx.firstSurvey.upsert({
        where: { surveyId: e.id },
        update: data,
        create: { surveyId: e.id, ...data },
      });
    }

    if (e.second !== null) {
      const data = {
        partDamages: json(e.second.partDamages),
        floorApportionment: json(e.second.floorApportionment),
      };

      await tx.secondSurvey.upsert({
        where: { surveyId: e.id },
        update: data,
        create: { surveyId: e.id, ...data },
      });
    }

    return await surveyQuery.findDetailById(tx, e.id);
  },
};