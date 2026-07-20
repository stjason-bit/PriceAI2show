import { assembleReport } from './report';
import {
  CodeReviewFinding,
  CodeReviewFindingStatus,
  CodeReviewReport,
  RepositoryProfile,
} from './types';

interface PersistedFinding {
  title: string;
  severity: string;
  category: string;
  confidence: string;
  status: string;
  filePath?: string | null;
  startLine?: number | null;
  endLine?: number | null;
  evidence: string;
  recommendation: string;
  suggestedFix?: string | null;
}

interface PersistedFile {
  included: boolean;
  path: string;
  ignoredReason?: string | null;
}

export interface HumanConfirmationSummary {
  open: number;
  needsReview: number;
  ignored: number;
  fixed: number;
  confirmed: number;
  total: number;
}

export interface LiveCodeReviewReport extends CodeReviewReport {
  profile: RepositoryProfile;
  humanConfirmation: HumanConfirmationSummary;
}

export function rebuildLiveReport({
  reportJson,
  fallbackExecutiveSummary,
  findings,
  files,
}: {
  reportJson: string;
  fallbackExecutiveSummary: string;
  findings: PersistedFinding[];
  files: PersistedFile[];
}): LiveCodeReviewReport {
  const stored = parseStoredReport(reportJson);
  const profile = normalizeProfile(stored.profile);
  const normalizedFindings = findings.map(normalizeFinding);
  const ignoredFiles = files
    .filter((file) => !file.included)
    .map((file) => ({
      path: file.path,
      reason: file.ignoredReason || 'ignored',
    }));
  const report = assembleReport({
    profile,
    findings: normalizedFindings,
    ignoredFiles,
    executiveSummary:
      String(stored.executiveSummary || '') || fallbackExecutiveSummary,
    optimizationSuggestions: normalizeStrings(stored.optimizationSuggestions),
    needsReview: normalizeStrings(stored.needsReview),
  });

  return {
    ...report,
    profile,
    humanConfirmation: summarizeHumanConfirmation(normalizedFindings),
  };
}

function parseStoredReport(value: string): Record<string, any> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeProfile(value: any): RepositoryProfile {
  return {
    stack: normalizeStrings(value?.stack),
    architectureSummary: String(value?.architectureSummary || ''),
    importantPaths: normalizeStrings(value?.importantPaths),
    riskAreas: normalizeStrings(value?.riskAreas),
    reviewPlan: normalizeStrings(value?.reviewPlan),
  };
}

function normalizeFinding(finding: PersistedFinding): CodeReviewFinding {
  return {
    title: finding.title,
    severity: finding.severity as CodeReviewFinding['severity'],
    category: finding.category as CodeReviewFinding['category'],
    confidence: finding.confidence as CodeReviewFinding['confidence'],
    status: normalizeStatus(finding.status),
    filePath: finding.filePath || undefined,
    startLine: finding.startLine || undefined,
    endLine: finding.endLine || undefined,
    evidence: finding.evidence,
    recommendation: finding.recommendation,
    suggestedFix: finding.suggestedFix || undefined,
  };
}

function normalizeStatus(value: string): CodeReviewFindingStatus {
  return Object.values(CodeReviewFindingStatus).includes(
    value as CodeReviewFindingStatus
  )
    ? (value as CodeReviewFindingStatus)
    : CodeReviewFindingStatus.Open;
}

function normalizeStrings(value: any): string[] {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string')
    : [];
}

function summarizeHumanConfirmation(
  findings: CodeReviewFinding[]
): HumanConfirmationSummary {
  const summary = {
    open: 0,
    needsReview: 0,
    ignored: 0,
    fixed: 0,
    confirmed: 0,
    total: findings.length,
  };

  for (const finding of findings) {
    if (finding.status === CodeReviewFindingStatus.Open) summary.open += 1;
    if (finding.status === CodeReviewFindingStatus.NeedsReview) {
      summary.needsReview += 1;
    }
    if (finding.status === CodeReviewFindingStatus.Ignored) summary.ignored += 1;
    if (finding.status === CodeReviewFindingStatus.Fixed) summary.fixed += 1;
  }
  summary.confirmed = summary.ignored + summary.fixed;

  return summary;
}
