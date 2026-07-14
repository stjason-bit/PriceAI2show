import { CodeReviewFinding, RepositoryProfile } from '../types';
import { PromptMode, ReviewPrompt } from './types';

export function buildCrossFileReviewPrompt({
  profile,
  findings,
  files,
  mode,
  userInstructions,
}: {
  profile: RepositoryProfile;
  findings: CodeReviewFinding[];
  files: { path: string; content: string; language: string }[];
  mode: PromptMode;
  userInstructions?: string;
}): ReviewPrompt {
  return {
    system:
      'You are a professional code reviewer. Review cross-file risks, data flow, auth, payments, persistence, and false positives.',
    user: [
      'Review mode:',
      mode,
      '',
      userInstructions ? `Project-specific instructions:\n${userInstructions}` : '',
      '',
      'Return JSON only with this shape:',
      JSON.stringify(
        {
          findings: [
            {
              title: 'string',
              severity: 'critical|high|medium|low|info',
              category:
                'bug|security|standards|duplication|risk|performance|architecture|maintainability|test|dependency',
              confidence: 'high|medium|low',
              file_path: 'string',
              start_line: 1,
              end_line: 1,
              evidence: 'string',
              recommendation: 'string',
              suggested_fix: 'string',
            },
          ],
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
      '',
      'Critical cross-file context:',
      files
        .map(
          (file) =>
            `--- ${file.path} (${file.language}) ---\n${file.content}`
        )
        .join('\n\n'),
    ]
      .filter(Boolean)
      .join('\n'),
  };
}
