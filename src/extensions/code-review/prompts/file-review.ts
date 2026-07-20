import { PromptMode, ReviewPrompt } from './types';

export function buildFileReviewPrompt({
  repositorySummary,
  files,
  mode,
  userInstructions,
}: {
  repositorySummary: string;
  files: { path: string; content: string; language: string }[];
  mode: PromptMode;
  userInstructions?: string;
}): ReviewPrompt {
  return {
    system:
      'You are a professional code reviewer. Find concrete, actionable issues with evidence. Avoid low-value style noise.',
    user: [
      'Review mode:',
      mode,
      '',
      'Repository summary:',
      repositorySummary,
      '',
      userInstructions ? `Project-specific instructions:\n${userInstructions}` : '',
      '',
      'Cover correctness, security, maintainability standards, repeated logic, and operational risk. Classify every concrete issue into the closest supported category.',
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
          file_summaries: [{ path: 'string', summary: 'string' }],
          needs_cross_file_review: ['string'],
        },
        null,
        2
      ),
      '',
      'Files:',
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
