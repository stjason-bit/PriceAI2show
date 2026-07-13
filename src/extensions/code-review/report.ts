import {
  CodeReviewFinding,
  CodeReviewFindingStatus,
  CodeReviewReport,
  CodeReviewSeverity,
  RepositoryProfile,
} from './types';

interface IgnoredFile {
  path: string;
  reason: string;
}

export function assembleReport({
  profile,
  findings,
  ignoredFiles,
  executiveSummary,
  optimizationSuggestions = [],
  needsReview = [],
}: {
  profile: RepositoryProfile;
  findings: CodeReviewFinding[];
  ignoredFiles: IgnoredFile[];
  executiveSummary?: string;
  optimizationSuggestions?: string[];
  needsReview?: string[];
}): CodeReviewReport {
  const uniqueFindings = dedupeFindings(findings).sort(compareFindings);
  const ignored = ignoredFiles.map((file) => `${file.path}: ${file.reason}`);
  const summary =
    executiveSummary ||
    buildExecutiveSummary(profile, uniqueFindings, ignored.length);

  const report: CodeReviewReport = {
    executiveSummary: summary,
    riskScore: calculateRiskScore(uniqueFindings),
    findings: uniqueFindings,
    optimizationSuggestions,
    needsReview,
    ignored,
    markdown: '',
  };

  report.markdown = renderMarkdown(report, profile);

  return report;
}

function dedupeFindings(findings: CodeReviewFinding[]): CodeReviewFinding[] {
  const seen = new Set<string>();
  const result: CodeReviewFinding[] = [];

  for (const finding of findings) {
    const key = [
      finding.title.trim().toLowerCase(),
      finding.filePath || '',
      finding.startLine || '',
    ].join('|');

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({
      ...finding,
      status: finding.status || CodeReviewFindingStatus.Open,
    });
  }

  return result;
}

function compareFindings(a: CodeReviewFinding, b: CodeReviewFinding): number {
  const severityDiff =
    severityRank(a.severity) - severityRank(b.severity);
  if (severityDiff !== 0) {
    return severityDiff;
  }

  return a.title.localeCompare(b.title);
}

function calculateRiskScore(findings: CodeReviewFinding[]): number {
  const score = findings.reduce(
    (sum, finding) => sum + severityWeight(finding.severity),
    findings.length > 0 ? 50 : 0
  );

  return Math.min(100, score);
}

function buildExecutiveSummary(
  profile: RepositoryProfile,
  findings: CodeReviewFinding[],
  ignoredCount: number
): string {
  const stack = profile.stack.length ? profile.stack.join(', ') : 'Unknown stack';
  return `${stack} project reviewed with ${findings.length} finding(s) and ${ignoredCount} ignored file(s).`;
}

function renderMarkdown(
  report: CodeReviewReport,
  profile: RepositoryProfile
): string {
  const lines = [
    '# Code Review Report',
    '',
    '## Executive Summary',
    '',
    report.executiveSummary,
    '',
    `Risk score: ${report.riskScore}`,
    '',
    '## Repository Profile',
    '',
    `Stack: ${profile.stack.length ? profile.stack.join(', ') : 'Unknown'}`,
    `Risk areas: ${
      profile.riskAreas.length ? profile.riskAreas.join(', ') : 'None detected'
    }`,
    '',
    '## Findings',
    '',
  ];

  if (report.findings.length === 0) {
    lines.push('No findings detected.', '');
  } else {
    for (const finding of report.findings) {
      lines.push(
        `### [${finding.severity.toUpperCase()}] ${finding.title}`,
        '',
        `Category: ${finding.category}`,
        `Confidence: ${finding.confidence}`,
        finding.filePath
          ? `Location: ${finding.filePath}${
              finding.startLine ? `:${finding.startLine}` : ''
            }`
          : 'Location: Repository-wide',
        '',
        `Evidence: ${finding.evidence}`,
        '',
        `Recommendation: ${finding.recommendation}`,
        ''
      );
    }
  }

  lines.push('## Ignored', '');
  if (report.ignored.length === 0) {
    lines.push('No ignored files recorded.', '');
  } else {
    lines.push(...report.ignored.map((item) => `- ${item}`), '');
  }

  return lines.join('\n');
}

function severityRank(severity: CodeReviewSeverity): number {
  const ranks: Record<CodeReviewSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };

  return ranks[severity];
}

function severityWeight(severity: CodeReviewSeverity): number {
  const weights: Record<CodeReviewSeverity, number> = {
    critical: 40,
    high: 25,
    medium: 12,
    low: 5,
    info: 1,
  };

  return weights[severity];
}
