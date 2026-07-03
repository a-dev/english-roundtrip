/** A curated prompt focus users can choose before starting an exercise. */
export interface Topic {
  id: string;
  category: TopicCategory;
  label: string;
  generationHint: string;
}

export type TopicCategory = 'grammar' | 'vocab';

export const TOPICS: readonly Topic[] = [
  {
    id: 'present-tenses',
    category: 'grammar',
    label: 'Present tenses',
    generationHint: 'Contrast a routine or habit with an action happening now.',
  },
  {
    id: 'present-perfect',
    category: 'grammar',
    label: 'Perfect tenses',
    generationHint:
      'Target one perfect tense and make its connection to another time clear; vary present, past, and future perfect by level.',
  },
  {
    id: 'past-tenses',
    category: 'grammar',
    label: 'Past tenses',
    generationHint:
      'Contrast a completed past event with an action in progress in a clear past-time context.',
  },
  {
    id: 'articles',
    category: 'grammar',
    label: 'Articles (a/an/the/∅)',
    generationHint:
      'Require a/an, the, or zero article; make countability and first or later mention clear.',
  },
  {
    id: 'determiners-and-quantifiers',
    category: 'grammar',
    label: 'Determiners and quantifiers',
    generationHint:
      'Require a natural determiner or quantifier, including choice and totality forms such as both, either, neither, neither ... nor, either ... or, all, the whole, each, every, some, any, much, many, few, or several; make number, countability, specificity, and scope clear.',
  },
  {
    id: 'prepositions',
    category: 'grammar',
    label: 'Prepositions and prepositional phrases',
    generationHint:
      'Target a natural preposition or fixed prepositional phrase for time, place, movement, or a dependent adjective or verb.',
  },
  {
    id: 'future-forms',
    category: 'grammar',
    label: 'Future forms',
    generationHint:
      'Require a natural future form such as will, be going to, present continuous, or future continuous; make the context distinguish the choice.',
  },
  {
    id: 'modal-verbs',
    category: 'grammar',
    label: 'Modal verbs',
    generationHint:
      'Target one modal verb for ability, permission, obligation, advice, possibility, or deduction, with enough context to identify its meaning.',
  },
  {
    id: 'passive-voice',
    category: 'grammar',
    label: 'Passive voice',
    generationHint:
      'Require a natural passive construction and make the receiver of the action more important than the agent; vary the tense by level.',
  },
  {
    id: 'reported-speech',
    category: 'grammar',
    label: 'Reported speech',
    generationHint:
      'Require natural reported speech; vary backshift, say/tell, questions, and commands by level.',
  },
  {
    id: 'question-forms',
    category: 'grammar',
    label: 'Question forms',
    generationHint:
      'Target a clear question form, such as auxiliary inversion, a wh-question, an indirect question, or a question tag, appropriate for the level.',
  },
  {
    id: 'gerunds-infinitives',
    category: 'grammar',
    label: 'Gerunds and infinitives',
    generationHint:
      'Target verb plus -ing or to-infinitive; reserve meaning-changing verbs for B2–C1.',
  },
  {
    id: 'causative-structures',
    category: 'grammar',
    label: 'Causative structures',
    generationHint:
      'Target a causative pattern such as make someone do something, have someone do something, get someone to do something, let someone do something, or have/get something done; make who causes the action and who performs it clear.',
  },
  {
    id: 'clauses',
    category: 'grammar',
    label: 'Relative clauses',
    generationHint:
      'Target one defining or non-defining relative clause; vary the relative pronoun, omission, or preposition placement by level.',
  },
  {
    id: 'conditionals',
    category: 'grammar',
    label: 'Conditionals',
    generationHint:
      'Use one conditional suitable for the level; reserve mixed conditionals for C1.',
  },
  {
    id: 'wish-if-only',
    category: 'grammar',
    label: 'Wish / if only',
    generationHint:
      'Require wish or if only to express a present regret, past regret, or desired change; make the intended time reference clear.',
  },
  {
    id: 'comparison-structures',
    category: 'grammar',
    label: 'Comparison structures',
    generationHint:
      'Target a natural comparative, superlative, equality, or degree structure; make the two things or quantities being compared explicit.',
  },
  {
    id: 'linking-words-and-discourse-markers',
    category: 'grammar',
    label: 'Linking words and discourse markers',
    generationHint:
      'Require a connector that shows addition, contrast, cause, result, sequence, or concession; use natural punctuation and register.',
  },
  {
    id: 'complex-sentence-structures',
    category: 'grammar',
    label: 'Complex sentence structures',
    generationHint:
      "Target one clear multi-clause structure with a natural subordinating conjunction; keep the sentence appropriate for the learner's level.",
  },
  {
    id: 'narrative-tenses',
    category: 'grammar',
    label: 'Narrative tenses',
    generationHint:
      'Use a past narrative context that requires a deliberate choice among past simple, past continuous, past perfect, or used to/would.',
  },
  {
    id: 'cleft-and-emphatic-structures',
    category: 'grammar',
    label: 'Cleft and emphatic structures',
    generationHint:
      'Target a natural cleft or emphatic structure, such as it was, what ... was, or do/does/did for emphasis; reserve complex forms for C1.',
  },
  {
    id: 'inversion',
    category: 'grammar',
    label: 'Inversion',
    generationHint:
      'Target a natural inversion in a question, negative adverbial, conditional, or place expression; reserve formal inversions for advanced levels.',
  },
  {
    id: 'nominalisation',
    category: 'grammar',
    label: 'Nominalisation',
    generationHint:
      'Require a verb or adjective to be expressed as a noun phrase in a clear academic, professional, or formal context.',
  },
  {
    id: 'word-formation',
    category: 'grammar',
    label: 'Word formation',
    generationHint:
      'Target a needed change of word class or form using a common prefix, suffix, participle, or compound; make the intended form unambiguous.',
  },
  {
    id: 'phrasal-verbs',
    category: 'grammar',
    label: 'Phrasal verbs',
    generationHint:
      'Require one common phrasal verb in a realistic context; make its intended meaning clear and vary separable forms only when suitable for the level.',
  },
  {
    id: 'collocations-and-idioms',
    category: 'grammar',
    label: 'Collocations and idioms',
    generationHint:
      'Target one natural collocation or a transparent, level-appropriate idiom in a context that makes its intended meaning clear.',
  },
  {
    id: 'formal-vs-informal-style',
    category: 'grammar',
    label: 'Formal vs informal style',
    generationHint:
      'Use a clear situational context that requires an appropriate formal or informal wording choice, such as an email, request, or conversation.',
  },
  {
    id: 'subjunctive',
    category: 'grammar',
    label: 'Subjunctive',
    generationHint:
      'Target a natural subjunctive or irrealis pattern, such as suggest that, it is essential that, or were; reserve rare forms for C1.',
  },
  {
    id: 'ellipsis',
    category: 'grammar',
    label: 'Ellipsis',
    generationHint:
      'Require a natural omission of repeated words in a coordinated, comparative, auxiliary, or conversational structure while preserving a clear meaning.',
  },
  {
    id: 'absolute-phrases',
    category: 'grammar',
    label: 'Absolute phrases',
    generationHint:
      'Target an absolute phrase that adds time, cause, condition, or accompanying circumstance; use this advanced structure only at B2–C1.',
  },
  {
    id: 'personal-information-and-identity',
    category: 'vocab',
    label: 'Personal information and identity',
    generationHint:
      "Use everyday facts about a person's name, background, interests, role, or contact details in a clear, natural context.",
  },
  {
    id: 'family-and-relationships',
    category: 'vocab',
    label: 'Family and relationships',
    generationHint:
      'Use a neutral, everyday situation involving family members, friends, colleagues, or relationships; avoid sensitive personal details.',
  },
  {
    id: 'home-and-daily-routines',
    category: 'vocab',
    label: 'Home and daily routines',
    generationHint:
      'Use daily life at home, such as chores, schedules, household tasks, habits, or family routines.',
  },
  {
    id: 'food-and-drink',
    category: 'vocab',
    label: 'Food and drink',
    generationHint:
      'Use an everyday food situation: ordering, cooking, ingredients, shopping, or preferences.',
  },
  {
    id: 'shopping-and-money',
    category: 'vocab',
    label: 'Shopping and money',
    generationHint:
      'Use a practical shopping, price, payment, refund, budget, or comparison situation without financial advice.',
  },
  {
    id: 'travel-and-transport',
    category: 'vocab',
    label: 'Travel and transport',
    generationHint:
      'Use a practical travel situation involving transport, tickets, directions, accommodation, or an itinerary.',
  },
  {
    id: 'health-and-the-body',
    category: 'vocab',
    label: 'Health and the body',
    generationHint:
      'Use neutral well-being, fitness, body parts, minor symptoms, or a routine appointment; never give medical advice.',
  },
  {
    id: 'time-dates-and-schedules',
    category: 'vocab',
    label: 'Time, dates, and schedules',
    generationHint:
      'Use clear time, date, duration, deadline, appointment, or scheduling vocabulary in an everyday or professional situation.',
  },
  {
    id: 'work-and-jobs',
    category: 'vocab',
    label: 'Work and jobs',
    generationHint:
      'Use a realistic workplace, job-search, responsibility, shift, or career-development situation.',
  },
  {
    id: 'education-and-learning',
    category: 'vocab',
    label: 'Education and learning',
    generationHint:
      'Use a natural situation involving classes, study, assignments, skills, training, or progress.',
  },
  {
    id: 'technology-and-communication',
    category: 'vocab',
    label: 'Technology and communication',
    generationHint:
      'Use a common device, app, online task, message, call, or basic troubleshooting situation.',
  },
  {
    id: 'social-interaction-and-feelings',
    category: 'vocab',
    label: 'Social interaction and feelings',
    generationHint:
      'Use a safe, everyday social interaction that expresses a feeling, opinion, invitation, response, or interpersonal need.',
  },
  {
    id: 'meetings-and-discussion',
    category: 'vocab',
    label: 'Meetings and discussion',
    generationHint:
      'Use a realistic meeting or discussion involving an agenda, opinion, question, action item, or decision.',
  },
  {
    id: 'email-and-professional-communication',
    category: 'vocab',
    label: 'Email and professional communication',
    generationHint:
      'Use a concise professional message involving a request, update, follow-up, clarification, or polite response.',
  },
  {
    id: 'projects-and-planning',
    category: 'vocab',
    label: 'Projects and planning',
    generationHint:
      'Use a project context involving goals, milestones, priorities, dependencies, timelines, risks, or next steps.',
  },
  {
    id: 'teamwork-and-collaboration',
    category: 'vocab',
    label: 'Teamwork and collaboration',
    generationHint:
      'Use a collaborative work situation involving responsibilities, coordination, feedback, support, or shared ownership.',
  },
  {
    id: 'presentations-and-speaking',
    category: 'vocab',
    label: 'Presentations and speaking',
    generationHint:
      'Use a presentation or public-speaking situation involving an audience, structure, key point, question, or delivery.',
  },
  {
    id: 'negotiation-and-problem-solving',
    category: 'vocab',
    label: 'Negotiation and problem-solving',
    generationHint:
      'Use a professional situation involving a constraint, trade-off, proposal, compromise, issue, or practical solution.',
  },
  {
    id: 'finance-basics',
    category: 'vocab',
    label: 'Finance basics',
    generationHint:
      'Use basic business-finance vocabulary such as costs, revenue, invoices, profit, or a budget; never give financial advice.',
  },
  {
    id: 'sales-customers-and-service',
    category: 'vocab',
    label: 'Sales, customers, and service',
    generationHint:
      'Use a customer-facing business situation involving a product, order, enquiry, issue, solution, or service follow-up.',
  },
];

export function getTopic(id: string): Topic | undefined {
  return TOPICS.find((topic) => topic.id === id);
}

export function getTopicsByCategory(category: TopicCategory): readonly Topic[] {
  return TOPICS.filter((topic) => topic.category === category);
}
