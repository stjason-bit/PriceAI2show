import { describe, expect, it, vi } from 'vitest';

import { runCodeReviewJob } from '../runner';

describe('code review runner', () => {
  it('runs a minimal review with mocked provider', async () => {
    const provider = {
      createMessage: vi
        .fn()
        .mockResolvedValueOnce({
          text: JSON.stringify({
            stack: ['Next.js'],
            architecture_summary: 'Small app',
            important_paths: ['package.json'],
            risk_areas: ['API routes'],
            review_plan: ['Review API routes'],
          }),
          usage: { inputTokens: 10, outputTokens: 10 },
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            findings: [
              {
                title: 'Missing auth check',
                severity: 'high',
                category: 'security',
                confidence: 'high',
                file_path: 'src/app/api/users/route.ts',
                start_line: 1,
                evidence: 'No auth call',
                recommendation: 'Check user session',
              },
            ],
            file_summaries: [],
            needs_cross_file_review: [],
          }),
          usage: { inputTokens: 20, outputTokens: 20 },
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            executive_summary: 'One high risk issue.',
            optimization_suggestions: [],
            needs_review: [],
            ignored: [],
          }),
          usage: { inputTokens: 10, outputTokens: 10 },
        }),
    };

    const report = await runCodeReviewJob({
      files: [
        {
          path: 'src/app/api/users/route.ts',
          content: 'export async function POST() {}',
          language: 'typescript',
          sizeBytes: 30,
          lineCount: 1,
          hash: 'a',
          included: true,
        },
      ],
      ignoredFiles: [],
      mode: 'standard',
      instructions: '',
      provider,
    });

    expect(report.findings[0].title).toBe('Missing auth check');
    expect(report.markdown).toContain('One high risk issue.');
  });
});
