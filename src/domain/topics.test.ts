import { expect, test } from 'bun:test';

import { TOPICS, getTopicsByCategory } from './topics';

test('topic catalog contains a complete, valid grammar and vocabulary curriculum', () => {
  const grammarTopics = getTopicsByCategory('grammar');
  const vocabularyTopics = getTopicsByCategory('vocab');

  expect(grammarTopics).toHaveLength(30);
  expect(vocabularyTopics).toHaveLength(20);
  expect(TOPICS).toHaveLength(50);
  expect(new Set(TOPICS.map((topic) => topic.id)).size).toBe(TOPICS.length);

  expect(TOPICS.map(({ id, category, label }) => ({ id, category, label }))).toEqual([
    { id: 'present-tenses', category: 'grammar', label: 'Present tenses' },
    { id: 'present-perfect', category: 'grammar', label: 'Perfect tenses' },
    { id: 'past-tenses', category: 'grammar', label: 'Past tenses' },
    { id: 'articles', category: 'grammar', label: 'Articles (a/an/the/∅)' },
    {
      id: 'determiners-and-quantifiers',
      category: 'grammar',
      label: 'Determiners and quantifiers',
    },
    { id: 'prepositions', category: 'grammar', label: 'Prepositions and prepositional phrases' },
    { id: 'future-forms', category: 'grammar', label: 'Future forms' },
    { id: 'modal-verbs', category: 'grammar', label: 'Modal verbs' },
    { id: 'passive-voice', category: 'grammar', label: 'Passive voice' },
    { id: 'reported-speech', category: 'grammar', label: 'Reported speech' },
    { id: 'question-forms', category: 'grammar', label: 'Question forms' },
    { id: 'gerunds-infinitives', category: 'grammar', label: 'Gerunds and infinitives' },
    { id: 'causative-structures', category: 'grammar', label: 'Causative structures' },
    { id: 'clauses', category: 'grammar', label: 'Relative clauses' },
    { id: 'conditionals', category: 'grammar', label: 'Conditionals' },
    { id: 'wish-if-only', category: 'grammar', label: 'Wish / if only' },
    { id: 'comparison-structures', category: 'grammar', label: 'Comparison structures' },
    {
      id: 'linking-words-and-discourse-markers',
      category: 'grammar',
      label: 'Linking words and discourse markers',
    },
    {
      id: 'complex-sentence-structures',
      category: 'grammar',
      label: 'Complex sentence structures',
    },
    { id: 'narrative-tenses', category: 'grammar', label: 'Narrative tenses' },
    {
      id: 'cleft-and-emphatic-structures',
      category: 'grammar',
      label: 'Cleft and emphatic structures',
    },
    { id: 'inversion', category: 'grammar', label: 'Inversion' },
    { id: 'nominalisation', category: 'grammar', label: 'Nominalisation' },
    { id: 'word-formation', category: 'grammar', label: 'Word formation' },
    { id: 'phrasal-verbs', category: 'grammar', label: 'Phrasal verbs' },
    { id: 'collocations-and-idioms', category: 'grammar', label: 'Collocations and idioms' },
    { id: 'formal-vs-informal-style', category: 'grammar', label: 'Formal vs informal style' },
    { id: 'subjunctive', category: 'grammar', label: 'Subjunctive' },
    { id: 'ellipsis', category: 'grammar', label: 'Ellipsis' },
    { id: 'absolute-phrases', category: 'grammar', label: 'Absolute phrases' },
    {
      id: 'personal-information-and-identity',
      category: 'vocab',
      label: 'Personal information and identity',
    },
    { id: 'family-and-relationships', category: 'vocab', label: 'Family and relationships' },
    { id: 'home-and-daily-routines', category: 'vocab', label: 'Home and daily routines' },
    { id: 'food-and-drink', category: 'vocab', label: 'Food and drink' },
    { id: 'shopping-and-money', category: 'vocab', label: 'Shopping and money' },
    { id: 'travel-and-transport', category: 'vocab', label: 'Travel and transport' },
    { id: 'health-and-the-body', category: 'vocab', label: 'Health and the body' },
    { id: 'time-dates-and-schedules', category: 'vocab', label: 'Time, dates, and schedules' },
    { id: 'work-and-jobs', category: 'vocab', label: 'Work and jobs' },
    { id: 'education-and-learning', category: 'vocab', label: 'Education and learning' },
    {
      id: 'technology-and-communication',
      category: 'vocab',
      label: 'Technology and communication',
    },
    {
      id: 'social-interaction-and-feelings',
      category: 'vocab',
      label: 'Social interaction and feelings',
    },
    { id: 'meetings-and-discussion', category: 'vocab', label: 'Meetings and discussion' },
    {
      id: 'email-and-professional-communication',
      category: 'vocab',
      label: 'Email and professional communication',
    },
    { id: 'projects-and-planning', category: 'vocab', label: 'Projects and planning' },
    { id: 'teamwork-and-collaboration', category: 'vocab', label: 'Teamwork and collaboration' },
    { id: 'presentations-and-speaking', category: 'vocab', label: 'Presentations and speaking' },
    {
      id: 'negotiation-and-problem-solving',
      category: 'vocab',
      label: 'Negotiation and problem-solving',
    },
    { id: 'finance-basics', category: 'vocab', label: 'Finance basics' },
    {
      id: 'sales-customers-and-service',
      category: 'vocab',
      label: 'Sales, customers, and service',
    },
  ]);

  for (const topic of TOPICS) {
    expect(['grammar', 'vocab']).toContain(topic.category);
    expect(topic.id.trim()).not.toBe('');
    expect(topic.label.trim()).not.toBe('');
    expect(topic.generationHint.trim()).not.toBe('');
  }
});
