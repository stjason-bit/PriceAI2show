import {
  CodeReviewFinding,
  CodeReviewFindingStatus,
  ReviewableFile,
} from './types';

const MAX_FINDINGS_PER_RULE = 20;
const DUPLICATE_WINDOW_LINES = 6;
const MIN_DUPLICATE_CHARS = 160;

interface RuleDefinition {
  id: string;
  pattern: RegExp;
  title: string;
  category: CodeReviewFinding['category'];
  severity: CodeReviewFinding['severity'];
  confidence: CodeReviewFinding['confidence'];
  status?: CodeReviewFindingStatus;
  evidence: string;
  recommendation: string;
}

const contentRules: RuleDefinition[] = [
  {
    id: 'SEC-001',
    pattern: /\[REDACTED_SECRET\]/g,
    title: 'Source file contains a credential-like value',
    category: 'security',
    severity: 'high',
    confidence: 'high',
    status: CodeReviewFindingStatus.NeedsReview,
    evidence: 'A value matching a secret pattern was redacted before analysis.',
    recommendation:
      'Confirm that the credential is not committed, rotate it if it was exposed, and load secrets from a managed environment.',
  },
  {
    id: 'RISK-001',
    pattern: /\b(?:eval|Function)\s*\(/g,
    title: 'Dynamic code execution requires review',
    category: 'risk',
    severity: 'high',
    confidence: 'high',
    status: CodeReviewFindingStatus.NeedsReview,
    evidence: 'The code uses eval() or the Function constructor.',
    recommendation:
      'Replace dynamic execution with explicit parsing or a constrained dispatcher. If unavoidable, document and strictly validate every input.',
  },
  {
    id: 'SEC-002',
    pattern: /dangerouslySetInnerHTML\s*=/g,
    title: 'Raw HTML rendering may introduce injection risk',
    category: 'security',
    severity: 'medium',
    confidence: 'high',
    status: CodeReviewFindingStatus.NeedsReview,
    evidence: 'The component renders HTML through dangerouslySetInnerHTML.',
    recommendation:
      'Sanitize untrusted HTML with an allowlist-based sanitizer and document the trusted data boundary.',
  },
  {
    id: 'RISK-002',
    pattern: /catch\s*(?:\([^)]*\))?\s*\{\s*\}/g,
    title: 'Empty catch block hides failures',
    category: 'risk',
    severity: 'medium',
    confidence: 'high',
    evidence: 'An exception is swallowed without logging, recovery, or propagation.',
    recommendation:
      'Handle the failure explicitly or rethrow it with context so production errors remain observable.',
  },
  {
    id: 'STD-001',
    pattern: /(?:@ts-ignore|eslint-disable(?:-next-line)?)/g,
    title: 'Static-analysis suppression needs justification',
    category: 'standards',
    severity: 'low',
    confidence: 'high',
    evidence: 'The source suppresses a TypeScript or ESLint diagnostic.',
    recommendation:
      'Remove the suppression by fixing the underlying issue, or add a narrow rule-specific suppression with a reason.',
  },
  {
    id: 'STD-002',
    pattern: /\b(?:TODO|FIXME|HACK)\b/g,
    title: 'Unresolved implementation marker remains in source',
    category: 'standards',
    severity: 'info',
    confidence: 'high',
    evidence: 'The file contains a TODO, FIXME, or HACK marker.',
    recommendation:
      'Link the marker to a tracked issue with an owner, or resolve it before the production release.',
  },
];

export function runRuleScan(files: ReviewableFile[]): CodeReviewFinding[] {
  return [
    ...scanContentRules(files),
    ...scanDuplicateBlocks(files),
  ];
}

function scanContentRules(files: ReviewableFile[]): CodeReviewFinding[] {
  const findings: CodeReviewFinding[] = [];

  for (const rule of contentRules) {
    let ruleFindings = 0;

    for (const file of files) {
      if (!file.included || ruleFindings >= MAX_FINDINGS_PER_RULE) {
        continue;
      }

      const match = firstMatch(rule.pattern, file.content);
      if (!match) {
        continue;
      }

      findings.push({
        title: rule.title,
        severity: rule.severity,
        category: rule.category,
        confidence: rule.confidence,
        status: rule.status || CodeReviewFindingStatus.Open,
        filePath: file.path,
        startLine: lineNumberAt(file.content, match.index),
        evidence: `${rule.id}: ${rule.evidence}`,
        recommendation: rule.recommendation,
      });
      ruleFindings += 1;
    }
  }

  return findings;
}

function scanDuplicateBlocks(files: ReviewableFile[]): CodeReviewFinding[] {
  const windows = new Map<
    string,
    { filePath: string; startLine: number; preview: string }[]
  >();

  for (const file of files) {
    if (!file.included || !isSourceFile(file.language)) {
      continue;
    }

    const lines = file.content.split('\n');
    for (let index = 0; index <= lines.length - DUPLICATE_WINDOW_LINES; index += 1) {
      const block = lines.slice(index, index + DUPLICATE_WINDOW_LINES);
      const normalized = block
        .map(normalizeCodeLine)
        .filter(Boolean)
        .join('\n');

      if (normalized.length < MIN_DUPLICATE_CHARS) {
        continue;
      }

      const occurrences = windows.get(normalized) || [];
      if (!occurrences.some((item) => item.filePath === file.path)) {
        occurrences.push({
          filePath: file.path,
          startLine: index + 1,
          preview: block.join('\n').trim().slice(0, 240),
        });
        windows.set(normalized, occurrences);
      }
    }
  }

  const findings: CodeReviewFinding[] = [];
  const reportedPairs = new Set<string>();

  for (const occurrences of windows.values()) {
    if (occurrences.length < 2 || findings.length >= MAX_FINDINGS_PER_RULE) {
      continue;
    }

    const [first, second] = occurrences;
    const pair = [first.filePath, second.filePath].sort().join('|');
    if (reportedPairs.has(pair)) {
      continue;
    }
    reportedPairs.add(pair);

    findings.push({
      title: 'Repeated logic appears in multiple files',
      severity: 'medium',
      category: 'duplication',
      confidence: 'high',
      status: CodeReviewFindingStatus.Open,
      filePath: first.filePath,
      startLine: first.startLine,
      evidence: `DUP-001: A matching code block also appears at ${second.filePath}:${second.startLine}.\n${first.preview}`,
      recommendation:
        'Extract the shared behavior behind a well-named function or module, then add tests around the single implementation.',
    });
  }

  return findings;
}

function firstMatch(pattern: RegExp, content: string): RegExpExecArray | null {
  pattern.lastIndex = 0;
  return pattern.exec(content);
}

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function normalizeCodeLine(line: string): string {
  const normalized = line.trim().replace(/\s+/g, ' ');
  if (
    !normalized ||
    normalized.startsWith('//') ||
    normalized.startsWith('/*') ||
    normalized.startsWith('*') ||
    normalized === '{' ||
    normalized === '}'
  ) {
    return '';
  }
  return normalized;
}

function isSourceFile(language: string): boolean {
  return [
    'typescript',
    'javascript',
    'python',
    'go',
    'rust',
    'java',
    'php',
    'ruby',
  ].includes(language);
}
