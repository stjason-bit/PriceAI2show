import { PromptMode, ReviewPrompt } from './types';

export function buildFileReviewPrompt({
  repositorySummary,
  files,
  mode,
}: {
  repositorySummary: string;
  files: { path: string; content: string; language: string }[];
  mode: PromptMode;
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
      'Return JSON only with this shape:',
      JSON.stringify(
        {
          findings: [
            {
              title: 'string',
              severity: 'critical|high|medium|low|info',
              category:
                'bug|security|performance|architecture|maintainability|test|dependency',
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
    ].join('\n'),
  };
}
