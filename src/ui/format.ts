import type { Grading, GradingVerdict } from '../ai/schemas';
import { COPY } from './copy';

const verdictLabels: Readonly<Record<GradingVerdict, string>> = {
  correct: COPY.verdict.correct,
  almost: COPY.verdict.almost,
  needs_work: COPY.verdict.needsWork,
};

/** Escape model-produced text before inserting it into Telegram HTML messages. */
export function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** Render structured AI feedback into Telegram's HTML parse mode. */
export function formatGrading(grading: Grading): string {
  const lines = [
    verdictLabels[grading.verdict],
    '',
    COPY.grading.correctedTranslation,
    escapeHtml(grading.correctedTranslation),
  ];

  if (grading.issues.length > 0) {
    lines.push('', COPY.grading.whatToImprove);
    lines.push(
      ...grading.issues.map(
        (issue) =>
          `• <b>[${issue.category}]</b> <code>${escapeHtml(issue.fragment)}</code> — ${escapeHtml(issue.explanation)}`,
      ),
    );
  }

  if (grading.alternative !== undefined) {
    lines.push('', COPY.grading.naturalAlternative, escapeHtml(grading.alternative));
  }

  lines.push('', escapeHtml(grading.encouragement));
  return lines.join('\n');
}
