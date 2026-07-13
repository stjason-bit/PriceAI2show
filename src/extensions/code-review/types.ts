export enum CodeReviewMode {
  Standard = 'standard',
  Deep = 'deep',
  Security = 'security',
}

export enum CodeReviewJobStatus {
  Created = 'created',
  Uploaded = 'uploaded',
  Indexing = 'indexing',
  Reviewing = 'reviewing',
  Synthesizing = 'synthesizing',
  Completed = 'completed',
  Failed = 'failed',
}

export enum CodeReviewFindingStatus {
  Open = 'open',
  NeedsReview = 'needs_review',
  Ignored = 'ignored',
  Fixed = 'fixed',
}

export type CodeReviewSeverity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'info';

export type CodeReviewCategory =
  | 'bug'
  | 'security'
  | 'performance'
  | 'architecture'
  | 'maintainability'
  | 'test'
  | 'dependency';

export type CodeReviewConfidence = 'high' | 'medium' | 'low';

export interface ReviewableFile {
  path: string;
  content: string;
  language: string;
  sizeBytes: number;
  lineCount: number;
  hash: string;
  included: boolean;
  ignoredReason?: string;
}

export interface RepositoryProfile {
  stack: string[];
  architectureSummary: string;
  importantPaths: string[];
  riskAreas: string[];
  reviewPlan: string[];
}

export interface CodeReviewFinding {
  title: string;
  severity: CodeReviewSeverity;
  category: CodeReviewCategory;
  confidence: CodeReviewConfidence;
  status: CodeReviewFindingStatus;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  evidence: string;
  recommendation: string;
  suggestedFix?: string;
}

export interface CodeReviewReport {
  executiveSummary: string;
  riskScore: number;
  findings: CodeReviewFinding[];
  optimizationSuggestions: string[];
  needsReview: string[];
  ignored: string[];
  markdown: string;
}
