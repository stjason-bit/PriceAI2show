import { CodeReviewFinding, RepositoryProfile } from '../types';
import { PromptMode, ReviewPrompt } from './types';

export function buildReportSynthesisPrompt({
  profile,
  findings,
  ignored,
  needsReviewCandidates,
  mode,
}: {
  profile: RepositoryProfile;
  findings: CodeReviewFinding[];
  ignored: string[];
  needsReviewCandidates?: string[];
  mode: PromptMode;
}): ReviewPrompt {
  return {
    system:
      'You are a professional code review report writer. Deduplicate, prioritize, and explain risk for senior engineering readers.',
    user: [
      'Review mode:',
      mode,
      '',
      'Return JSON only with this shape:',
      JSON.stringify(
        {
          executive_summary: 'string',
          optimization_suggestions: ['string'],
          needs_review: ['string'],
          ignored: ['string'],
        },
        null,
        2
      ),
      '',
      'Repository profile:',
      JSON.stringify(profile, null, 2),
      '',
      'Findings:',
      JSON.stringify(findings, null, 2),
      '',
      'Ignored files:',
      ignored.join('\n'),
      '',
      'Items requiring human confirmation:',
      (needsReviewCandidates || []).join('\n'),
    ].join('\n'),
  };
}
