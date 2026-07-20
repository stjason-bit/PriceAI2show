import { describe, expect, it, vi } from 'vitest';

import { EvolinkCodeReviewProvider } from '../evolink';
import { buildFileReviewPrompt, buildRepositoryProfilePrompt } from '../prompts';

describe('prompts and evolink provider', () => {
  it('builds JSON-first review prompts', () => {
    const prompt = buildRepositoryProfilePrompt({
      fileTree: ['package.json', 'src/app/api/users/route.ts'],
      importantFiles: [{ path: 'package.json', content: '{}' }],
      mode: 'standard',
      userInstructions: 'Focus on auth.',
    });

    expect(prompt.system).toContain('professional code reviewer');
    expect(prompt.user).toContain('Return JSON only');
    expect(prompt.user).toContain('Focus on auth.');
  });

  it('includes file contents in file review prompt', () => {
    const prompt = buildFileReviewPrompt({
      repositorySummary: 'Next.js app',
      files: [
        {
          path: 'src/a.ts',
          content: 'export const a = 1;',
          language: 'typescript',
        },
      ],
      mode: 'security',
    });
    expect(prompt.user).toContain('src/a.ts');
    expect(prompt.user).toContain('export const a = 1;');
  });

  it('calls Evolink Messages API with configured auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '{"ok":true}' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    });

    const provider = new EvolinkCodeReviewProvider({
      apiKey: 'test-key',
      baseUrl: 'https://direct.evolink.ai',
      model: 'claude-sonnet-4-6',
      fetchFn: fetchMock,
    });

    const result = await provider.createMessage({
      system: 'sys',
      user: 'user',
      maxTokens: 1000,
    });

    expect(result.text).toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://direct.evolink.ai/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      })
    );
  });
});
