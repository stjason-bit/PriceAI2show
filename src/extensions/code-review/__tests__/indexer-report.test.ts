import { describe, expect, it } from 'vitest';

import { buildRepositoryProfile, groupFilesForReview } from '../indexer';
import { assembleReport } from '../report';
import { CodeReviewFindingStatus, ReviewableFile } from '../types';

const files: ReviewableFile[] = [
  {
    path: 'package.json',
    content: '{"dependencies":{"next":"16.0.7"}}',
    language: 'json',
    sizeBytes: 40,
    lineCount: 1,
    hash: 'a',
    included: true,
  },
  {
    path: 'src/app/api/users/route.ts',
    content:
      'export async function POST() { return Response.json({ ok: true }); }',
    language: 'typescript',
    sizeBytes: 80,
    lineCount: 1,
    hash: 'b',
    included: true,
  },
];

describe('repository indexing and reports', () => {
  it('detects stack and risk areas from repository files', () => {
    const profile = buildRepositoryProfile(files);
    expect(profile.stack).toContain('Next.js');
    expect(profile.importantPaths).toContain('package.json');
    expect(profile.riskAreas).toContain('API routes');
  });

  it('groups files into review chunks', () => {
    const groups = groupFilesForReview(files);
    expect(groups).toHaveLength(1);
    expect(groups[0].files.map((file) => file.path)).toContain(
      'src/app/api/users/route.ts'
    );
  });

  it('deduplicates and sorts report findings', () => {
    const report = assembleReport({
      profile: buildRepositoryProfile(files),
      findings: [
        {
          title: 'Missing auth check',
          severity: 'high',
          category: 'security',
          confidence: 'high',
          status: CodeReviewFindingStatus.Open,
          filePath: 'src/app/api/users/route.ts',
          startLine: 1,
          evidence: 'POST route has no user check',
          recommendation: 'Require authentication before mutation',
        },
        {
          title: 'Missing auth check',
          severity: 'high',
          category: 'security',
          confidence: 'high',
          status: CodeReviewFindingStatus.Open,
          filePath: 'src/app/api/users/route.ts',
          startLine: 1,
          evidence: 'duplicate',
          recommendation: 'duplicate',
        },
      ],
      ignoredFiles: [
        { path: 'node_modules/react/index.js', reason: 'ignored_path' },
      ],
    });

    expect(report.findings).toHaveLength(1);
    expect(report.riskScore).toBeGreaterThan(70);
    expect(report.markdown).toContain('Missing auth check');
    expect(report.ignored).toContain(
      'node_modules/react/index.js: ignored_path'
    );
  });
});
