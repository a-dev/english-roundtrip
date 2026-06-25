import { expect, test } from 'bun:test';

import { formatGrading } from './format';

test('formatGrading renders safe rich feedback for an incorrect translation', () => {
  expect(
    formatGrading({
      verdict: 'needs_work',
      correctedTranslation: 'I <have> already & read it.',
      issues: [
        {
          fragment: 'I already read',
          category: 'tense',
          explanation: 'Нужен <i>present perfect</i> & маркер.',
        },
      ],
      alternative: "I've already read it.",
      encouragement: 'Хорошее начало!',
    }),
  ).toBe(
    [
      '❌ <b>Needs work</b>',
      '',
      '<b>Corrected translation</b>',
      'I &lt;have&gt; already &amp; read it.',
      '',
      '<b>What to improve</b>',
      '• <b>[tense]</b> <code>I already read</code> — Нужен &lt;i&gt;present perfect&lt;/i&gt; &amp; маркер.',
      '',
      '<b>Natural alternative</b>',
      "I've already read it.",
      '',
      'Хорошее начало!',
    ].join('\n'),
  );
});

test('formatGrading renders correct and almost verdicts without an issues section', () => {
  expect(
    formatGrading({
      verdict: 'correct',
      correctedTranslation: 'I have finished.',
      issues: [],
      encouragement: 'Отлично!',
    }),
  ).toBe(
    [
      '✅ <b>Correct</b>',
      '',
      '<b>Corrected translation</b>',
      'I have finished.',
      '',
      'Отлично!',
    ].join('\n'),
  );

  expect(
    formatGrading({
      verdict: 'almost',
      correctedTranslation: 'She is cooking.',
      issues: [],
      encouragement: 'Nearly there!',
    }),
  ).toContain('⚠️ <b>Almost there</b>');
});
