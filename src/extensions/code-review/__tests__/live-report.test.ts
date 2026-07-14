import { describe, expect, it } from 'vitest';

import { rebuildLiveReport } from '../live-report';

describe('live report export', () => {
  it('recalculates risk and exports the latest human status', () => {
    const base = {
      executiveSummary: 'Review complete.',
      optimizationSuggestions: [],
      needsReview: [],
      profile: {
        stack: ['Next.js'],
        architectureSummary: 'App Router project',
        importantPaths: [],
        riskAreas: ['API routes'],
        reviewPlan: [],
      },
    };
    const finding = {
      title: 'Missing auth check',
      severity: 'high',
      category: 'security',
      confidence: 'high',
      filePath: 'src/api.ts',
      startLine: 1,
      evidence: 'No session check',
      recommendation: 'Require authentication',
    };

    const openReport = rebuildLiveReport({
      reportJson: JSON.stringify(base),
      fallbackExecutiveSummary: '',
      findings: [{ ...finding, status: 'open' }],
      files: [],
    });
    const fixedReport = rebuildLiveReport({
      reportJson: JSON.stringify(base),
      fallbackExecutiveSummary: '',
      findings: [{ ...finding, status: 'fixed' }],
      files: [],
    });

    expect(openReport.riskScore).toBeGreaterThan(0);
    expect(fixedReport.riskScore).toBe(0);
    expect(fixedReport.markdown).toContain('Status: fixed');
    expect(fixedReport.humanConfirmation.confirmed).toBe(1);
  });
});
