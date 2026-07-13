import { IgnoredArchiveFile } from './archive';
import { groupFilesForReview } from './indexer';
import {
  buildFileReviewPrompt,
  buildReportSynthesisPrompt,
  buildRepositoryProfilePrompt,
} from './prompts';
import { assembleReport } from './report';
import {
  CodeReviewFinding,
  CodeReviewFindingStatus,
  CodeReviewMode,
  CodeReviewReport,
  RepositoryProfile,
  ReviewableFile,
} from './types';

interface ReviewProvider {
  createMessage(input: {
    system: string;
    user: string;
    maxTokens: number;
  }): Promise<{
    text: string;
    usage: {
      inputTokens: number;
      outputTokens: number;
    };
  }>;
}

export interface RunCodeReviewJobResult extends CodeReviewReport {
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export async function runCodeReviewJob({
  files,
  ignoredFiles,
  mode,
  instructions,
  provider,
}: {
  files: ReviewableFile[];
  ignoredFiles: IgnoredArchiveFile[];
  mode: CodeReviewMode | `${CodeReviewMode}`;
  instructions?: string;
  provider: ReviewProvider;
}): Promise<RunCodeReviewJobResult> {
  const usage = { inputTokens: 0, outputTokens: 0 };
  const importantFiles = files
    .filter((file) => isImportantForProfile(file.path))
    .slice(0, 12)
    .map((file) => ({ path: file.path, content: file.content }));

  const profilePrompt = buildRepositoryProfilePrompt({
    fileTree: files.map((file) => file.path),
    importantFiles,
    mode,
    userInstructions: instructions,
  });
  const profileResponse = await provider.createMessage({
    ...profilePrompt,
    maxTokens: 4096,
  });
  addUsage(usage, profileResponse.usage);
  const profile = parseRepositoryProfile(profileResponse.text);

  const findings: CodeReviewFinding[] = [];
  for (const group of groupFilesForReview(files)) {
    const prompt = buildFileReviewPrompt({
      repositorySummary: profile.architectureSummary,
      files: group.files.map((file) => ({
        path: file.path,
        content: file.content,
        language: file.language,
      })),
      mode,
    });
    const response = await provider.createMessage({
      ...prompt,
      maxTokens: 8192,
    });
    addUsage(usage, response.usage);
    findings.push(...parseFileReviewFindings(response.text));
  }

  const synthesisPrompt = buildReportSynthesisPrompt({
    profile,
    findings,
    ignored: ignoredFiles.map((file) => `${file.path}: ${file.reason}`),
    mode,
  });
  const synthesisResponse = await provider.createMessage({
    ...synthesisPrompt,
    maxTokens: 4096,
  });
  addUsage(usage, synthesisResponse.usage);
  const synthesis = parseReportSynthesis(synthesisResponse.text);

  return {
    ...assembleReport({
      profile,
      findings,
      ignoredFiles,
      executiveSummary: synthesis.executiveSummary,
      optimizationSuggestions: synthesis.optimizationSuggestions,
      needsReview: synthesis.needsReview,
    }),
    usage,
  };
}

function addUsage(
  total: { inputTokens: number; outputTokens: number },
  next: { inputTokens: number; outputTokens: number }
) {
  total.inputTokens += next.inputTokens;
  total.outputTokens += next.outputTokens;
}

function parseRepositoryProfile(text: string): RepositoryProfile {
  const json = parseJsonObject(text);

  return {
    stack: normalizeStringArray(json.stack),
    architectureSummary: String(
      json.architecture_summary || json.architectureSummary || ''
    ),
    importantPaths: normalizeStringArray(
      json.important_paths || json.importantPaths
    ),
    riskAreas: normalizeStringArray(json.risk_areas || json.riskAreas),
    reviewPlan: normalizeStringArray(json.review_plan || json.reviewPlan),
  };
}

function parseFileReviewFindings(text: string): CodeReviewFinding[] {
  const json = parseJsonObject(text);
  const findings = Array.isArray(json.findings) ? json.findings : [];

  return findings.map((finding: any) => ({
    title: String(finding.title || 'Untitled finding'),
    severity: normalizeSeverity(finding.severity),
    category: normalizeCategory(finding.category),
    confidence: normalizeConfidence(finding.confidence),
    status: CodeReviewFindingStatus.Open,
    filePath: finding.file_path || finding.filePath,
    startLine: toOptionalNumber(finding.start_line || finding.startLine),
    endLine: toOptionalNumber(finding.end_line || finding.endLine),
    evidence: String(finding.evidence || ''),
    recommendation: String(finding.recommendation || ''),
    suggestedFix: finding.suggested_fix || finding.suggestedFix,
  }));
}

function parseReportSynthesis(text: string): {
  executiveSummary: string;
  optimizationSuggestions: string[];
  needsReview: string[];
} {
  const json = parseJsonObject(text);

  return {
    executiveSummary: String(
      json.executive_summary || json.executiveSummary || ''
    ),
    optimizationSuggestions: normalizeStringArray(
      json.optimization_suggestions || json.optimizationSuggestions
    ),
    needsReview: normalizeStringArray(json.needs_review || json.needsReview),
  };
}

function parseJsonObject(text: string): any {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  return JSON.parse(withoutFence);
}

function normalizeStringArray(value: any): string[] {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string')
    : [];
}

function normalizeSeverity(value: any): CodeReviewFinding['severity'] {
  return ['critical', 'high', 'medium', 'low', 'info'].includes(value)
    ? value
    : 'medium';
}

function normalizeCategory(value: any): CodeReviewFinding['category'] {
  return [
    'bug',
    'security',
    'performance',
    'architecture',
    'maintainability',
    'test',
    'dependency',
  ].includes(value)
    ? value
    : 'maintainability';
}

function normalizeConfidence(value: any): CodeReviewFinding['confidence'] {
  return ['high', 'medium', 'low'].includes(value) ? value : 'medium';
}

function toOptionalNumber(value: any): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function isImportantForProfile(path: string): boolean {
  return (
    path === 'package.json' ||
    path.toLowerCase().includes('readme') ||
    path.endsWith('tsconfig.json') ||
    path.includes('schema') ||
    path.includes('config')
  );
}
