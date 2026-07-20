import { IgnoredArchiveFile } from './archive';
import { groupFilesForReview } from './indexer';
import {
  buildCrossFileReviewPrompt,
  buildFileReviewPrompt,
  buildReportSynthesisPrompt,
  buildRepositoryProfilePrompt,
} from './prompts';
import { assembleReport } from './report';
import { runRuleScan } from './rules';
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
  profile: RepositoryProfile;
  ruleFindingCount: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export type ReviewPipelineStage =
  | 'rules'
  | 'profiling'
  | 'reviewing'
  | 'cross_file'
  | 'synthesizing';

export async function runCodeReviewJob({
  files,
  ignoredFiles,
  mode,
  instructions,
  provider,
  onStage,
}: {
  files: ReviewableFile[];
  ignoredFiles: IgnoredArchiveFile[];
  mode: CodeReviewMode | `${CodeReviewMode}`;
  instructions?: string;
  provider: ReviewProvider;
  onStage?: (stage: ReviewPipelineStage) => void | Promise<void>;
}): Promise<RunCodeReviewJobResult> {
  const usage = { inputTokens: 0, outputTokens: 0 };
  await onStage?.('rules');
  const ruleFindings = runRuleScan(files);
  const importantFiles = files
    .filter((file) => isImportantForProfile(file.path))
    .slice(0, 12)
    .map((file) => ({ path: file.path, content: file.content }));

  await onStage?.('profiling');
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
  const profile = parseRepositoryProfile(
    await parseProviderJson(profileResponse.text, provider, usage, 'repository profile', {
      stack: [],
      architecture_summary: 'Repository profile could not be parsed.',
      important_paths: [],
      risk_areas: [],
      review_plan: [],
    })
  );

  await onStage?.('reviewing');
  const findings: CodeReviewFinding[] = [...ruleFindings];
  for (const group of groupFilesForReview(files)) {
    const prompt = buildFileReviewPrompt({
      repositorySummary: profile.architectureSummary,
      files: group.files.map((file) => ({
        path: file.path,
        content: file.content,
        language: file.language,
      })),
      mode,
      userInstructions: instructions,
    });
    const response = await provider.createMessage({
      ...prompt,
      maxTokens: 8192,
    });
    addUsage(usage, response.usage);
    findings.push(
      ...parseFileReviewFindings(
        await parseProviderJson(response.text, provider, usage, 'file review', {
          findings: [],
          file_summaries: [],
          needs_cross_file_review: [],
        })
      )
    );
  }

  await onStage?.('cross_file');
  const crossFilePrompt = buildCrossFileReviewPrompt({
    profile,
    findings,
    files: selectCrossFileContext(files, profile),
    mode,
    userInstructions: instructions,
  });
  const crossFileResponse = await provider.createMessage({
    ...crossFilePrompt,
    maxTokens: mode === CodeReviewMode.Deep ? 8192 : 4096,
  });
  addUsage(usage, crossFileResponse.usage);
  const crossFileResult = parseCrossFileReview(
    await parseProviderJson(
      crossFileResponse.text,
      provider,
      usage,
      'cross-file review',
      {
        findings: [],
        uncertain_items: [],
        false_positive_candidates: [],
      }
    )
  );
  findings.push(...crossFileResult.findings);

  await onStage?.('synthesizing');
  const synthesisPrompt = buildReportSynthesisPrompt({
    profile,
    findings,
    ignored: ignoredFiles.map((file) => `${file.path}: ${file.reason}`),
    needsReviewCandidates: crossFileResult.uncertainItems,
    mode,
  });
  const synthesisResponse = await provider.createMessage({
    ...synthesisPrompt,
    maxTokens: 4096,
  });
  addUsage(usage, synthesisResponse.usage);
  const synthesis = parseReportSynthesis(
    await parseProviderJson(
      synthesisResponse.text,
      provider,
      usage,
      'report synthesis',
      {
        executive_summary: '',
        optimization_suggestions: [],
        needs_review: [
          'The report synthesis response could not be parsed and needs manual review.',
        ],
      }
    )
  );

  return {
    ...assembleReport({
      profile,
      findings,
      ignoredFiles,
      executiveSummary: synthesis.executiveSummary,
      optimizationSuggestions: synthesis.optimizationSuggestions,
      needsReview: [
        ...new Set([
          ...crossFileResult.uncertainItems,
          ...synthesis.needsReview,
        ]),
      ],
    }),
    profile,
    ruleFindingCount: ruleFindings.length,
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

function parseRepositoryProfile(json: any): RepositoryProfile {
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

function parseFileReviewFindings(json: any): CodeReviewFinding[] {
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

function parseReportSynthesis(json: any): {
  executiveSummary: string;
  optimizationSuggestions: string[];
  needsReview: string[];
} {
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

function parseCrossFileReview(json: any): {
  findings: CodeReviewFinding[];
  uncertainItems: string[];
  falsePositiveCandidates: string[];
} {
  return {
    findings: parseFileReviewFindings(json),
    uncertainItems: normalizeStringArray(
      json.uncertain_items || json.uncertainItems
    ),
    falsePositiveCandidates: normalizeStringArray(
      json.false_positive_candidates || json.falsePositiveCandidates
    ),
  };
}

async function parseProviderJson(
  text: string,
  provider: ReviewProvider,
  usage: { inputTokens: number; outputTokens: number },
  label: string,
  fallback: any
): Promise<any> {
  try {
    return parseJsonObject(text);
  } catch (initialError) {
    try {
      const repair = await provider.createMessage({
        system:
          'You repair malformed model output. Preserve meaning and return one valid JSON object only.',
        user: `Repair this ${label} response as valid JSON. Return JSON only:\n\n${text}`,
        maxTokens: 4096,
      });
      addUsage(usage, repair.usage);
      return parseJsonObject(repair.text);
    } catch (repairError) {
      console.warn(`Could not parse ${label}; using fallback result.`, {
        initialError,
        repairError,
      });
      return fallback;
    }
  }
}

function parseJsonObject(text: string): any {
  const trimmed = text.trim();
  const withoutFence = stripMarkdownFence(trimmed);
  const candidate = extractJsonObjectCandidate(withoutFence);

  try {
    return JSON.parse(candidate);
  } catch {
    return JSON.parse(normalizeJsonLike(candidate));
  }
}

function stripMarkdownFence(text: string): string {
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] || text)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function extractJsonObjectCandidate(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

function normalizeJsonLike(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/,\s*([}\]])/g, '$1');
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
    'standards',
    'duplication',
    'risk',
    'performance',
    'architecture',
    'maintainability',
    'test',
    'dependency',
  ].includes(value)
    ? value
    : 'maintainability';
}

function selectCrossFileContext(
  files: ReviewableFile[],
  profile: RepositoryProfile
): { path: string; content: string; language: string }[] {
  const important = new Set(profile.importantPaths);
  const candidates = files.filter((file) => {
    const path = file.path.toLowerCase();
    return (
      important.has(file.path) ||
      path.includes('/api/') ||
      path.includes('auth') ||
      path.includes('permission') ||
      path.includes('payment') ||
      path.includes('schema') ||
      path.includes('model')
    );
  });

  let totalChars = 0;
  return candidates
    .filter((file) => {
      if (totalChars + file.content.length > 48_000) {
        return false;
      }
      totalChars += file.content.length;
      return true;
    })
    .map((file) => ({
      path: file.path,
      content: file.content,
      language: file.language,
    }));
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
