import { CodeReviewMode } from '../types';

export type PromptMode = CodeReviewMode | `${CodeReviewMode}`;

export interface ReviewPrompt {
  system: string;
  user: string;
}
