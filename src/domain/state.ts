/** The persisted lifecycle of a user's in-flight exercise. */
export enum SessionState {
  Idle = 'idle',
  ChoosingTaskLanguage = 'choosing_task_language',
  ChoosingCategory = 'choosing_category',
  ChoosingTopic = 'choosing_topic',
  Generating = 'generating',
  AwaitingAnswer = 'awaiting_answer',
  Grading = 'grading',
  FeedbackShown = 'feedback_shown',
}

/** The minimal session shape needed to decide whether a text answer is valid. */
export interface SessionWithState {
  state: SessionState;
}

export function isSessionState(value: string): value is SessionState {
  return Object.values(SessionState).includes(value as SessionState);
}

export function canChooseTaskLanguage(session: SessionWithState): boolean {
  return session.state === SessionState.ChoosingTaskLanguage;
}

export function canChooseTopic(session: SessionWithState): boolean {
  return session.state === SessionState.ChoosingCategory;
}

export function canStartExercise(session: SessionWithState): boolean {
  return (
    session.state === SessionState.ChoosingTopic || session.state === SessionState.FeedbackShown
  );
}

export function canSubmitAnswer(session: SessionWithState): boolean {
  return session.state === SessionState.AwaitingAnswer;
}

export function canShowFeedback(session: SessionWithState): boolean {
  return session.state === SessionState.AwaitingAnswer;
}
