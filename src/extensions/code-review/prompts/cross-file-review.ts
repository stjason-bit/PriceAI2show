import { CodeReviewFinding, RepositoryProfile } from '../types';
import { PromptMode, ReviewPrompt } from './types';

export function buildCrossFileReviewPrompt({
  profile,
  findings,
  mode,
}: {
  profile: RepositoryProfile;
  findings: CodeReviewFinding[];
  mode: PromptMode;
}): ReviewPrompt {
  return {
    system:
      'You are a professional code reviewer. Review cross-file risks, data flow, auth, payments, persistence, and false positives.',
    user: [
      'Review mode:',
      mode,
      '',
      'Return JSON only with this shape:',
      JSON.stringify(
        {
          findings: [],
          uncertain_items: ['string'],
          false_positive_candidates: ['string'],
        },
        null,
        2
      ),
      '',
      'Repository profile:',
      JSON.stringify(profile, null, 2),
      '',
      'Existing findings:',
      JSON.stringify(findings, null, 2),
    ].join('\n'),
  };
}
