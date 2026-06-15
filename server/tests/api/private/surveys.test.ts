import type { Role } from 'common/types/role';
import type { DtoId } from 'common/types/brandedId';
import type { SubmissionPayload } from 'common/types/survey';
import { brandedId } from 'common/validators/brandedId';
import { computeFirstAssessment } from 'domain/assessment/computeFirstAssessment';
import { computeSecondAssessment } from 'domain/assessment/computeSecondAssessment';
import { prismaClient } from 'service/prismaClient';
import { ulid } from 'ulid';
import { expect, test } from 'vitest';
import { createCognitoUser, createUserClient } from '../apiClient';

type User = { client: ReturnType<typeof createUserClient>; id: string };

const createUser = async (roles: Role[] = []): Promise<User> => {
  const tokens = await createCognitoUser();
  const client = createUserClient(tokens);
  const me = await client.private.me.get();

  if (roles.length > 0) await prismaClient.user.update({ where: { id: me.body.id }, data: { roles } });

  return { client, id: me.body.id };
};

const expectRejectedStatus = async (promise: Promise<unknown>, status: number): Promise<void> => {
  await promise.then(
    () => Promise.reject(new Error('リクエストは失敗するはずでした')),
    (e: Error) => {
      const parsed = JSON.parse(e.message) as { status: number };

      expect(parsed.status).toBe(status);
    },
  );
};

const newId = (): DtoId['survey'] => brandedId.survey.dto.parse(ulid());

// 配列先頭を取り出し（noUncheckedIndexedAccess 対策, テスト専用）。
const firstOf = <T>(arr: T[]): T => {
  const [head] = arr;

  if (head === undefined) throw new Error('expected non-empty array');

  return head;
};

const noForce = {
  houseWashedAway: false,
  groundScour: false,
  foundationWashout: false,
  fullCeilingInundation: false,
};

const firstBody = (id: DtoId['survey']): SubmissionPayload => ({
  survey: {
    id,
    surveyType: 'first',
    address: '東京都...',
    houseNumber: '1-1',
    structureType: 'wood',
    buildingName: 'B棟',
    floors: 2,
    victimName: '被災 太郎',
    victimContact: '090-1111-2222',
    victimAddress: '東京都被災',
    latitude: 35.6,
    longitude: 139.7,
  },
  firstSurvey: {
    externalForceFlags: noForce,
    tiltRatio: 0.1,
    inundationDepthCm: 50,
    floorApportionment: [
      { floor: 1, ratio: 60 },
      { floor: 2, ratio: 40 },
    ],
  },
  photos: [{ fileName: 'p.jpg', contentType: 'image/jpeg', part: null, step: null }],
});

const minimalFirstBody = (id: DtoId['survey']): SubmissionPayload => ({
  survey: { id, surveyType: 'first', address: 'a', houseNumber: '1', structureType: 'nonWood' },
  firstSurvey: { externalForceFlags: noForce },
});

const secondBody = (id: DtoId['survey'], parentSurveyId: DtoId['survey']): SubmissionPayload => ({
  survey: { id, surveyType: 'second', parentSurveyId, address: 'a', houseNumber: '1', structureType: 'wood' },
  secondSurvey: { partDamages: [{ part: 'roof', damageRatio: 30 }], floorApportionment: [{ floor: 1, ratio: 100 }] },
});

// 第1次を提出→承認→確定して確定済み第1次の ID を返す。
const confirmFirst = async (admin: User, surveyor: User): Promise<DtoId['survey']> => {
  const id = newId();

  await surveyor.client.private.surveys.submission.post({ body: firstBody(id) });
  await admin.client.private.surveys._surveyId(id).approve.post();
  await admin.client.private.surveys._surveyId(id).confirm.post();

  return id;
};

test('第1次提出（surveyor）成功・詳細に PII・判定実値（computeFirstAssessment）・監査 survey.submit + pii.change（US-201/207/402）', async () => {
  const surveyor = await createUser(['surveyor']);
  const id = newId();

  const res = await surveyor.client.private.surveys.submission.post({ body: firstBody(id) });

  // U3a: calcFirst は本実装にバインド済み。提出結果が computeFirstAssessment と一致（呼出点不変の配線検証）。
  const expectedFirst = computeFirstAssessment({
    externalForceFlags: noForce,
    tiltRatio: 0.1,
    inundationDepthCm: 50,
    floorApportionment: [
      { floor: 1, ratio: 60 },
      { floor: 2, ratio: 40 },
    ],
  });

  expect(res.status).toBe(200);
  expect(res.body.status).toBe('submitted');
  expect(res.body.damageLevel).toBe(expectedFirst.damageLevel);
  expect(res.body.damageRatio).toBe(expectedFirst.damageRatio);
  expect(res.body.victimName).toBe('被災 太郎');
  expect(res.body.first?.tiltRatio).toBe(0.1);

  const actions = await prismaClient.auditLog.findMany({ where: { targetId: id } });

  expect(actions.map((a) => a.action).sort()).toEqual(['pii.change', 'survey.submit']);
  // INV-5: 監査に PII 実値が出ない。
  expect(JSON.stringify(actions)).not.toContain('被災 太郎');
});

test('第1次提出: 外力・流失等フラグ true は全壊確定（damageRatio=100 / totalCollapse, FR-20/BR-25/US-402）', async () => {
  const surveyor = await createUser(['surveyor']);
  const id = newId();

  const body = firstBody(id);
  const res = await surveyor.client.private.surveys.submission.post({
    body: {
      ...body,
      firstSurvey: {
        externalForceFlags: { ...noForce, houseWashedAway: true },
        tiltRatio: 0.1,
        inundationDepthCm: 50,
      },
    },
  });

  expect(res.status).toBe(200);
  expect(res.body.damageRatio).toBe(100);
  expect(res.body.damageLevel).toBe('totalCollapse');
});

test('viewer は PII マスク・surveyor は PII 取得（BR-13 / INV-5）', async () => {
  const surveyor = await createUser(['surveyor']);
  const viewer = await createUser(['viewer']);
  const id = newId();

  await surveyor.client.private.surveys.submission.post({ body: firstBody(id) });

  const asViewer = await viewer.client.private.surveys._surveyId(id).get();
  const asSurveyor = await surveyor.client.private.surveys._surveyId(id).get();

  expect(asViewer.body.victimName).toBeNull();
  expect(asViewer.body.victimContact).toBeNull();
  expect(asSurveyor.body.victimName).toBe('被災 太郎');
});

test('最小ペイロード（PII/写真なし）も受理（null 系・写真なし経路）', async () => {
  const surveyor = await createUser(['surveyor']);
  const id = newId();

  const res = await surveyor.client.private.surveys.submission.post({ body: minimalFirstBody(id) });

  expect(res.status).toBe(200);
  expect(res.body.victimName).toBeNull();
  expect(res.body.first?.floorApportionment).toBeNull();
});

test('一覧（U5）: viewer は全件・PII 除外＋総件数（SurveyListResult, Q-U5-5=B）', async () => {
  const surveyor = await createUser(['surveyor']);
  const viewer = await createUser(['viewer']);

  await surveyor.client.private.surveys.submission.post({ body: firstBody(newId()) });

  const res = await viewer.client.private.surveys.get({ query: {} });

  expect(res.body.total).toBe(1);
  expect(res.body.items.length).toBe(1);
  expect(res.body.page).toBe(1);
  expect('victimName' in firstOf(res.body.items)).toBe(false);
});

test('承認→確定フロー（admin）・確定は冪等 no-op（US-503/504 / PBT-04）', async () => {
  const admin = await createUser(['admin']);
  const surveyor = await createUser(['surveyor']);
  const id = newId();

  await surveyor.client.private.surveys.submission.post({ body: firstBody(id) });

  expect((await admin.client.private.surveys._surveyId(id).approve.post()).body.status).toBe('approved');
  expect((await admin.client.private.surveys._surveyId(id).confirm.post()).body.status).toBe('confirmed');
  // 冪等: 既 confirmed の再確定は no-op 成功。
  expect((await admin.client.private.surveys._surveyId(id).confirm.post()).body.status).toBe('confirmed');

  const actions = await prismaClient.auditLog.findMany({ where: { targetId: id } });

  expect(actions.map((a) => a.action)).toContain('survey.approve');
  expect(actions.map((a) => a.action)).toContain('survey.confirm');
});

test('INV-3 冪等再送: 同一 ULID は重複なし・確定後の再送は 403', async () => {
  const admin = await createUser(['admin']);
  const surveyor = await createUser(['surveyor']);
  const id = newId();

  await surveyor.client.private.surveys.submission.post({ body: firstBody(id) });
  await surveyor.client.private.surveys.submission.post({ body: firstBody(id) }); // 再送

  expect(await prismaClient.survey.count({ where: { id } })).toBe(1);

  await admin.client.private.surveys._surveyId(id).approve.post();
  await admin.client.private.surveys._surveyId(id).confirm.post();

  // 確定後の再送は拒否（BR-15c）。
  await expectRejectedStatus(
    surveyor.client.private.surveys.submission.post({ body: firstBody(id) }),
    403,
  );
});

test('認可: viewer 提出は 403・surveyor の承認/確定/正式判定は 403（BR-10/11）', async () => {
  const viewer = await createUser(['viewer']);
  const surveyor = await createUser(['surveyor']);
  const id = newId();

  await expectRejectedStatus(viewer.client.private.surveys.submission.post({ body: firstBody(id) }), 403);

  await surveyor.client.private.surveys.submission.post({ body: firstBody(id) });

  await expectRejectedStatus(surveyor.client.private.surveys._surveyId(id).approve.post(), 403);
  await expectRejectedStatus(surveyor.client.private.surveys._surveyId(id).confirm.post(), 403);
  await expectRejectedStatus(
    surveyor.client.private.surveys._surveyId(id).official.post({ body: { officialSurveyId: id } }),
    403,
  );
});

test('第2次提出（親確定済み）・結果併記・正式判定（admin, US-601/605/606）', async () => {
  const admin = await createUser(['admin']);
  const surveyor = await createUser(['surveyor']);
  const firstId = await confirmFirst(admin, surveyor);
  const secondId = newId();

  const second = await surveyor.client.private.surveys.submission.post({
    body: secondBody(secondId, firstId),
  });

  expect(second.status).toBe(200);
  expect(second.body.parentSurveyId).toBe(firstId);

  // 第2次判定が本実装 computeSecondAssessment に配線されていることを実値で検証（U3b / FR-23）。
  const expectedSecond = computeSecondAssessment({
    structureType: 'wood',
    partDamages: [{ part: 'roof', damageRatio: 30 }],
    floorApportionment: [{ floor: 1, ratio: 100 }],
  });
  expect(second.body.damageRatio).toBe(expectedSecond.damageRatio);
  expect(second.body.damageLevel).toBe(expectedSecond.damageLevel);

  await admin.client.private.surveys._surveyId(secondId).approve.post();
  await admin.client.private.surveys._surveyId(secondId).confirm.post();

  // 結果併記（US-605）。
  const results = await surveyor.client.private.surveys._surveyId(firstId).results.get();

  expect(results.body.first.id).toBe(firstId);
  expect(results.body.seconds.map((s) => s.id)).toEqual([secondId]);

  // 正式判定（第2次を採用）。
  const official = await admin.client.private.surveys._surveyId(firstId).official.post({
    body: { officialSurveyId: secondId },
  });

  expect(official.body.officialSurveyId).toBe(secondId);
  expect(official.body.officialChosenBy).toBe(admin.id);

  // 確定済み第1次の詳細取得で official*/日時が非 null（toDto populated 経路）。
  const detail = await admin.client.private.surveys._surveyId(firstId).get();

  expect(detail.body.confirmedAt).not.toBeNull();
  expect(detail.body.officialChosenAt).not.toBeNull();

  const official2 = await prismaClient.auditLog.findMany({ where: { action: 'survey.officialJudgment' } });

  expect(official2.length).toBe(1);
});

test('第2次の親が未確定なら 403・親不在なら 404（US-601 異常系 / BR-5）', async () => {
  const surveyor = await createUser(['surveyor']);
  const firstId = newId();

  await surveyor.client.private.surveys.submission.post({ body: firstBody(firstId) }); // submitted のまま

  await expectRejectedStatus(
    surveyor.client.private.surveys.submission.post({ body: secondBody(newId(), firstId) }),
    403,
  );

  await expectRejectedStatus(
    surveyor.client.private.surveys.submission.post({ body: secondBody(newId(), newId()) }),
    404,
  );
});

test('正式判定: 対象外 ID は 400（BR-17）', async () => {
  const admin = await createUser(['admin']);
  const surveyor = await createUser(['surveyor']);
  const firstId = await confirmFirst(admin, surveyor);

  await expectRejectedStatus(
    admin.client.private.surveys._surveyId(firstId).official.post({ body: { officialSurveyId: newId() } }),
    400,
  );
});

test('入力検証: 区分排他違反・不正 structureType・階按分合計不正・第2次の親 ID 欠落は 400（US-801）', async () => {
  const surveyor = await createUser(['surveyor']);
  const base = firstBody(newId());

  // 第1次に第2次入力を混在（BR-3/21）。
  await expectRejectedStatus(
    surveyor.client.private.surveys.submission.post({
      body: { ...base, secondSurvey: { partDamages: [{ part: 'roof', damageRatio: 10 }] } },
    }),
    400,
  );

  // 不正 structureType。
  await expectRejectedStatus(
    surveyor.client.private.surveys.submission.post({
      body: { ...base, survey: { ...base.survey, structureType: 'steel' as 'wood' } },
    }),
    400,
  );

  // 階按分合計≠100。
  await expectRejectedStatus(
    surveyor.client.private.surveys.submission.post({
      body: { ...base, firstSurvey: { externalForceFlags: noForce, floorApportionment: [{ floor: 1, ratio: 50 }] } },
    }),
    400,
  );

  // 第2次で親 ID 欠落。
  await expectRejectedStatus(
    surveyor.client.private.surveys.submission.post({
      body: {
        survey: { id: newId(), surveyType: 'second', address: 'a', houseNumber: '1', structureType: 'wood' },
        secondSurvey: { partDamages: [{ part: 'roof', damageRatio: 10 }] },
      },
    }),
    400,
  );
});

test('存在しない調査への操作は 404（get/approve/confirm/official/results）', async () => {
  const admin = await createUser(['admin']);
  const id = newId();

  await expectRejectedStatus(admin.client.private.surveys._surveyId(id).get(), 404);
  await expectRejectedStatus(admin.client.private.surveys._surveyId(id).approve.post(), 404);
  await expectRejectedStatus(admin.client.private.surveys._surveyId(id).confirm.post(), 404);
  await expectRejectedStatus(
    admin.client.private.surveys._surveyId(id).official.post({ body: { officialSurveyId: id } }),
    404,
  );
  await expectRejectedStatus(admin.client.private.surveys._surveyId(id).results.get(), 404);
});

test('写真: 提出で PUT チケット発行→confirm→閲覧 URL 一覧（uploaded のみ, US-304/305 / INV-P3）', async () => {
  const surveyor = await createUser(['surveyor']);
  const id = newId();

  const res = await surveyor.client.private.surveys.submission.post({ body: firstBody(id) });

  expect(res.body.photoUploadTickets.length).toBe(1);
  const ticket = firstOf(res.body.photoUploadTickets);

  expect(ticket.putUrl).toContain('http');

  // confirm 前は pending のため閲覧一覧に出ない（INV-P3 / BR-P9）。
  const before = await surveyor.client.private.surveys._surveyId(id).photos.get();

  expect(before.body).toEqual([]);

  // アップロード確認（pending→uploaded）。
  const confirmed = await surveyor.client.private.surveys
    ._surveyId(id)
    .photos.confirm.post({ body: { photoIds: [ticket.photoId] } });

  expect(confirmed.body.length).toBe(1);
  expect(firstOf(confirmed.body).status).toBe('uploaded');
  expect(firstOf(confirmed.body).uploadedAt).not.toBeNull();

  // confirm 後は presigned GET URL 付きで閲覧一覧に出る。
  const after = await surveyor.client.private.surveys._surveyId(id).photos.get();

  expect(after.body.length).toBe(1);
  expect(firstOf(after.body).photoId).toBe(ticket.photoId);
  expect(firstOf(after.body).getUrl).toContain('http');

  // 冪等: 再 confirm は no-op 成功（BR-P8）。
  const again = await surveyor.client.private.surveys
    ._surveyId(id)
    .photos.confirm.post({ body: { photoIds: [ticket.photoId] } });

  expect(firstOf(again.body).status).toBe('uploaded');

  // 監査記録（BR-P14）。
  const audit = await prismaClient.auditLog.findMany({ where: { action: 'photo.uploadConfirmed' } });

  expect(audit.length).toBe(2);
});

test('写真: 所属外/不在 photoId の confirm は 404（BR-P10）', async () => {
  const surveyor = await createUser(['surveyor']);
  const id = newId();

  await surveyor.client.private.surveys.submission.post({ body: firstBody(id) });

  await expectRejectedStatus(
    surveyor.client.private.surveys
      ._surveyId(id)
      .photos.confirm.post({ body: { photoIds: [brandedId.photo.dto.parse(ulid())] } }),
    404,
  );
});

test('写真: 権限なしは confirm/list 403・viewer は閲覧可（BR-P2）', async () => {
  const noRole = await createUser([]);
  const surveyor = await createUser(['surveyor']);
  const viewer = await createUser(['viewer']);
  const id = newId();

  const res = await surveyor.client.private.surveys.submission.post({ body: firstBody(id) });
  const photoId = firstOf(res.body.photoUploadTickets).photoId;

  await surveyor.client.private.surveys
    ._surveyId(id)
    .photos.confirm.post({ body: { photoIds: [photoId] } });

  // 権限なしは confirm 403。
  await expectRejectedStatus(
    noRole.client.private.surveys._surveyId(id).photos.confirm.post({ body: { photoIds: [photoId] } }),
    403,
  );

  // 権限なしは閲覧 403。
  await expectRejectedStatus(noRole.client.private.surveys._surveyId(id).photos.get(), 403);

  // viewer は閲覧可。
  const v = await viewer.client.private.surveys._surveyId(id).photos.get();

  expect(v.body.length).toBe(1);
});

test('写真: 非画像 contentType の提出は 400（BR-P15）', async () => {
  const surveyor = await createUser(['surveyor']);

  await expectRejectedStatus(
    surveyor.client.private.surveys.submission.post({
      body: {
        ...firstBody(newId()),
        photos: [{ fileName: 'x.pdf', contentType: 'application/pdf', part: null, step: null }],
      },
    }),
    400,
  );
});


// ===== U5: 検索・一覧 / PDF / CSV =====

test('検索（U5）: status/surveyType/address 部分一致・ページング・total（US-703 / Q-U5-3/4）', async () => {
  const surveyor = await createUser(['surveyor']);
  const admin = await createUser(['admin']);

  // 2 件提出（firstBody=address 東京都/wood、minimal=address a/nonWood）。
  const id1 = newId();
  const id2 = newId();

  await surveyor.client.private.surveys.submission.post({ body: firstBody(id1) });
  await surveyor.client.private.surveys.submission.post({ body: minimalFirstBody(id2) });

  // address 部分一致（'東京' は id1 のみ）。
  const byAddr = await admin.client.private.surveys.get({ query: { address: '東京' } });

  expect(byAddr.body.total).toBe(1);
  expect(firstOf(byAddr.body.items).id).toBe(id1);

  // structureType=nonWood は id2 のみ。
  const byStruct = await admin.client.private.surveys.get({ query: { structureType: 'nonWood' } });

  expect(byStruct.body.total).toBe(1);
  expect(firstOf(byStruct.body.items).id).toBe(id2);

  // status=submitted は 2 件。ページング pageSize=1 で items は 1・total は 2。
  const paged = await admin.client.private.surveys.get({
    query: { status: 'submitted', page: 1, pageSize: 1 },
  });

  expect(paged.body.total).toBe(2);
  expect(paged.body.items.length).toBe(1);
  expect(paged.body.pageSize).toBe(1);

  // confirmedOnly=true（status=confirmed 相当, BR-U5-7）。確定済みは無いため 0 件。
  const confirmed = await admin.client.private.surveys.get({ query: { confirmedOnly: 'true' } });

  expect(confirmed.body.total).toBe(0);
});

test('検索（U5）: ロールスコープ surveyor は自分のみ・admin は全件（Q-U5-5=B / BR-U5-1）', async () => {
  const surveyorA = await createUser(['surveyor']);
  const surveyorB = await createUser(['surveyor']);
  const admin = await createUser(['admin']);

  await surveyorA.client.private.surveys.submission.post({ body: firstBody(newId()) });
  await surveyorB.client.private.surveys.submission.post({ body: firstBody(newId()) });

  // surveyorA は自分の 1 件のみ（createdBy 強制上書き）。
  const aList = await surveyorA.client.private.surveys.get({ query: {} });

  expect(aList.body.total).toBe(1);
  expect(firstOf(aList.body.items).createdBy).toBe(surveyorA.id);

  // 他者の createdBy を指定しても surveyor は自分に強制される。
  const aSpoof = await surveyorA.client.private.surveys.get({
    query: { createdBy: brandedId.user.dto.parse(surveyorB.id) },
  });

  expect(aSpoof.body.total).toBe(1);
  expect(firstOf(aSpoof.body.items).createdBy).toBe(surveyorA.id);

  // admin は全件。
  const adminList = await admin.client.private.surveys.get({ query: {} });

  expect(adminList.body.total).toBe(2);
});

test('検索（U5）: 不正フィルタ値・ページング範囲外は 400（SECURITY-05 / BR-U5-17）', async () => {
  const admin = await createUser(['admin']);

  await expectRejectedStatus(
    admin.client.private.surveys.get({ query: { status: 'bogus' as never } }),
    400,
  );
  await expectRejectedStatus(
    admin.client.private.surveys.get({ query: { pageSize: 999 } }),
    400,
  );
  await expectRejectedStatus(
    admin.client.private.surveys.get({ query: { createdFrom: 100, createdTo: 50 } }),
    400,
  );
});

test('PDF（U5）: admin は家屋単位 PDF の presigned URL を取得（US-701 / Q-U5-6=C・Q-U5-10=B）', async () => {
  const admin = await createUser(['admin']);
  const surveyor = await createUser(['surveyor']);
  const firstId = await confirmFirst(admin, surveyor);

  // 第2次を提出（親確定済み）→ 家屋単位 PDF に併記される。
  const secondId = newId();

  await surveyor.client.private.surveys.submission.post({ body: secondBody(secondId, firstId) });

  const res = await admin.client.private.surveys._surveyId(firstId).pdf.get();

  expect(res.body.format).toBe('pdf');
  expect(res.body.url).toContain('http');
  expect(res.body.filename).toContain(firstId);

  // 監査記録（BR-U5-15）。
  const audit = await prismaClient.auditLog.findMany({ where: { action: 'export.pdf' } });

  expect(audit.length).toBe(1);
});

test('PDF（U5）: 権限・対象の異常系（surveyor/viewer 403・第2次ID/不存在 404）', async () => {
  const admin = await createUser(['admin']);
  const surveyor = await createUser(['surveyor']);
  const viewer = await createUser(['viewer']);
  const firstId = await confirmFirst(admin, surveyor);
  const secondId = newId();

  await surveyor.client.private.surveys.submission.post({ body: secondBody(secondId, firstId) });

  // admin 以外は 403。
  await expectRejectedStatus(surveyor.client.private.surveys._surveyId(firstId).pdf.get(), 403);
  await expectRejectedStatus(viewer.client.private.surveys._surveyId(firstId).pdf.get(), 403);

  // 第2次 ID は 404（第1次 ID 必須, BR-U5-11）。
  await expectRejectedStatus(admin.client.private.surveys._surveyId(secondId).pdf.get(), 404);

  // 不存在は 404。
  await expectRejectedStatus(admin.client.private.surveys._surveyId(newId()).pdf.get(), 404);
});

test('CSV（U5）: admin は presigned URL 取得・非 admin は 403・0 件も可（US-702 / Q-U5-7=A）', async () => {
  const admin = await createUser(['admin']);
  const surveyor = await createUser(['surveyor']);

  await surveyor.client.private.surveys.submission.post({ body: firstBody(newId()) });

  // admin: フィルタなしで全件 CSV。
  const res = await admin.client.private.surveys.export.csv.get({ query: {} });

  expect(res.body.format).toBe('csv');
  expect(res.body.url).toContain('http');

  // 非 admin（surveyor）は 403。
  await expectRejectedStatus(surveyor.client.private.surveys.export.csv.get({ query: {} }), 403);

  // 0 件（該当なしフィルタ）でも 200（ヘッダのみ CSV, BR-U5-12）。confirmedOnly=true で確定済みのみ。
  const empty = await admin.client.private.surveys.export.csv.get({
    query: { confirmedOnly: 'true' },
  });

  expect(empty.body.url).toContain('http');

  // 監査記録（export.csv 2 回）。
  const audit = await prismaClient.auditLog.findMany({ where: { action: 'export.csv' } });

  expect(audit.length).toBe(2);
});
