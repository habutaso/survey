import { surveyDispatch } from 'domain/survey/model/surveyDispatch';
import { surveyMethod } from 'domain/survey/model/surveyMethod';
import { ValidationError } from 'service/customAssert';
import { describe, expect, test } from 'vitest';
import { firstPayload, makeUser, secondPayload } from './surveyFixtures';

const actor = makeUser(['surveyor']);
const firstEntity = surveyMethod.createFromSubmission(actor, firstPayload('s-1'));
const secondEntity = surveyMethod.createFromSubmission(actor, secondPayload('s-2', 's-1'));

describe('surveyDispatch.assessmentInput', () => {
  test('first → { first }', () => {
    expect('first' in surveyDispatch.assessmentInput(firstEntity)).toBe(true);
  });

  test('second → { second } に structureType を合成（SecondAssessmentInput, U3b）', () => {
    const input = surveyDispatch.assessmentInput(secondEntity);
    expect('second' in input).toBe(true);
    if ('second' in input) {
      expect(input.second.structureType).toBe(secondEntity.structureType);
      expect(input.second.partDamages).toEqual(secondEntity.second?.partDamages);
      expect(input.second.floorApportionment).toEqual(secondEntity.second?.floorApportionment);
    }
  });

  test('両区分 null は ValidationError（INV-4 / fail closed）', () => {
    expect(() => surveyDispatch.assessmentInput({ ...firstEntity, first: null, second: null })).toThrow(
      ValidationError,
    );
  });
});

describe('surveyDispatch.requireParent', () => {
  test('first → null', () => {
    expect(surveyDispatch.requireParent(firstEntity)).toBeNull();
  });

  test('second → parentSurveyId', () => {
    expect(surveyDispatch.requireParent(secondEntity)).toBe('s-1');
  });

  test('second で親未指定は ValidationError', () => {
    expect(() => surveyDispatch.requireParent({ ...secondEntity, parentSurveyId: null })).toThrow(
      ValidationError,
    );
  });
});
