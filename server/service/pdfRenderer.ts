import {
  DAMAGE_LEVEL_DISPLAY,
  STRUCTURE_TYPE_DISPLAY,
  SURVEY_STATUS_DISPLAY,
  SURVEY_TYPE_DISPLAY,
} from 'common/constants';
import type { SurveyPdfModel } from 'common/types/export';
import type { SurveyDetailDto } from 'common/types/survey';
import { PDF_FONT_PATH } from 'service/envValues';
import PDFDocument from 'pdfkit';

// 同梱日本語フォント（U5 / Q-U5-11=A）。パス解決は envValues（PDF_FONT_PATH）に委譲。

const display = <T extends string>(map: Partial<Record<T, string>>, value: string | null): string =>
  value === null ? '—' : (map[value as T] ?? value);

const isoOrDash = (ms: number | null): string => (ms === null ? '—' : new Date(ms).toISOString());

const numOrDash = (n: number | null): string => (n === null ? '—' : String(n));

const strOrDash = (s: string | null): string => (s === null || s === '' ? '—' : s);

// 1 調査分のセクションを描画（家屋識別・被災者・区分・入力・損害割合・被害度区分・実施者/日時, BR-U5-13）。
const renderSurveySection = (doc: PDFKit.PDFDocument, survey: SurveyDetailDto, title: string): void => {
  doc.moveDown(0.5).fontSize(14).text(title);
  doc.fontSize(10);

  const line = (label: string, value: string): void => {
    doc.text(`${label}: ${value}`);
  };

  line('調査区分', display(SURVEY_TYPE_DISPLAY, survey.surveyType));
  line('状態', display(SURVEY_STATUS_DISPLAY, survey.status));
  line('所在地', strOrDash(survey.address));
  line('家屋番号', strOrDash(survey.houseNumber));
  line('建物名称', strOrDash(survey.buildingName));
  line('構造種別', display(STRUCTURE_TYPE_DISPLAY, survey.structureType));
  line('階数', numOrDash(survey.floors));
  line('被災者氏名', strOrDash(survey.victimName));
  line('被災者連絡先', strOrDash(survey.victimContact));
  line('被災者住所', strOrDash(survey.victimAddress));
  line('損害割合(%)', numOrDash(survey.damageRatio));
  line('被害度区分', display(DAMAGE_LEVEL_DISPLAY, survey.damageLevel));

  if (survey.first !== null) {
    const f = survey.first;

    line('傾斜率', numOrDash(f.tiltRatio));
    line('浸水深(cm)', numOrDash(f.inundationDepthCm));
    line(
      '外力・流失等',
      Object.entries(f.externalForceFlags)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(', ') || 'なし',
    );
  }

  if (survey.second !== null) {
    line('部位損傷率', survey.second.partDamages.map((p) => `${p.part}:${p.damageRatio}%`).join(', '));
  }

  line('実施者', strOrDash(survey.createdBy));
  line('作成日時', isoOrDash(survey.createdTime));
  line('提出日時', isoOrDash(survey.submittedAt));
  line('承認日時', isoOrDash(survey.approvedAt));
  line('確定日時', isoOrDash(survey.confirmedAt));
};

export const pdfRenderer = {
  // 家屋単位 PDF（第1次＋第2次群, Q-U5-10=B）。決定的入出力・副作用は内部に隔離（service 層）。
  renderSurveyPdf: (model: SurveyPdfModel): Promise<Buffer> =>
    new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: '住家被害認定調査票' } });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('jp', PDF_FONT_PATH);
      doc.font('jp');

      doc.fontSize(18).text('住家被害認定調査票', { align: 'center' });
      doc.fontSize(9).text('（内閣府 災害に係る住家の被害認定基準運用指針 様式を参考）', { align: 'center' });

      renderSurveySection(doc, model.first, '第1次調査');
      model.seconds.forEach((second, i) => renderSurveySection(doc, second, `第2次調査 (${i + 1})`));

      doc.end();
    }),
};
