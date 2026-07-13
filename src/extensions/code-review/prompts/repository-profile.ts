import { PromptMode, ReviewPrompt } from './types';

export function buildRepositoryProfilePrompt({
  fileTree,
  importantFiles,
  mode,
  userInstructions,
}: {
  fileTree: string[];
  importantFiles: { path: string; content: string }[];
  mode: PromptMode;
  userInstructions?: string;
}): ReviewPrompt {
  return {
    system:
      'You are a professional code reviewer. Build a precise repository profile before making findings.',
    user: [
      'Review mode:',
      mode,
      '',
      'Return JSON only with this shape:',
      JSON.stringify(
        {
          stack: ['string'],
          architecture_summary: 'string',
          important_paths: ['string'],
          risk_areas: ['string'],
          review_plan: ['string'],
        },
        null,
        2
      ),
      '',
      userInstructions ? `User instructions:\n${userInstructions}` : '',
      '',
      'File tree:',
      fileTree.join('\n'),
      '',
      'Important file excerpts:',
      importantFiles
        .map((file) => `--- ${file.path} ---\n${file.content}`)
        .join('\n\n'),
    ]
      .filter(Boolean)
      .join('\n'),
  };
}
