import { CODE_REVIEW_LIMITS } from './limits';
import { RepositoryProfile, ReviewableFile } from './types';

export interface ReviewFileGroup {
  id: string;
  files: ReviewableFile[];
  totalChars: number;
}

export function buildRepositoryProfile(
  files: ReviewableFile[]
): RepositoryProfile {
  const paths = files.map((file) => file.path);
  const packageJson = files.find((file) => file.path === 'package.json');
  const stack = new Set<string>();
  const riskAreas = new Set<string>();
  const importantPaths = new Set<string>();

  if (packageJson) {
    importantPaths.add('package.json');
    if (packageJson.content.includes('"next"')) {
      stack.add('Next.js');
    }
    if (packageJson.content.includes('"react"')) {
      stack.add('React');
    }
  }

  for (const path of paths) {
    if (isImportantPath(path)) {
      importantPaths.add(path);
    }
    if (path.includes('/api/') || path.endsWith('/route.ts')) {
      riskAreas.add('API routes');
    }
    if (path.includes('auth') || path.includes('session')) {
      riskAreas.add('Authentication');
    }
    if (path.includes('payment') || path.includes('checkout')) {
      riskAreas.add('Payments');
    }
    if (path.includes('db') || path.includes('schema')) {
      riskAreas.add('Database');
    }
  }

  return {
    stack: [...stack],
    architectureSummary: summarizeArchitecture(paths),
    importantPaths: [...importantPaths],
    riskAreas: [...riskAreas],
    reviewPlan: buildReviewPlan([...riskAreas]),
  };
}

export function groupFilesForReview(files: ReviewableFile[]): ReviewFileGroup[] {
  const reviewable = files
    .filter((file) => file.included)
    .slice(0, CODE_REVIEW_LIMITS.maxReviewFiles);
  const groups: ReviewFileGroup[] = [];
  let current: ReviewableFile[] = [];
  let totalChars = 0;

  for (const file of reviewable) {
    const nextSize = file.content.length;
    if (
      current.length > 0 &&
      totalChars + nextSize > CODE_REVIEW_LIMITS.maxPromptCharsPerChunk
    ) {
      groups.push({
        id: `group-${groups.length + 1}`,
        files: current,
        totalChars,
      });
      current = [];
      totalChars = 0;
    }

    current.push(file);
    totalChars += nextSize;
  }

  if (current.length > 0) {
    groups.push({
      id: `group-${groups.length + 1}`,
      files: current,
      totalChars,
    });
  }

  return groups;
}

function isImportantPath(path: string): boolean {
  return (
    path === 'package.json' ||
    path === 'README.md' ||
    path.endsWith('next.config.mjs') ||
    path.endsWith('next.config.ts') ||
    path.endsWith('tsconfig.json') ||
    path.includes('/schema.')
  );
}

function summarizeArchitecture(paths: string[]): string {
  if (paths.some((path) => path.startsWith('src/app/'))) {
    return 'Next.js App Router project with source code under src/app.';
  }

  if (paths.some((path) => path.startsWith('src/'))) {
    return 'Source-based application with code under src.';
  }

  return 'Repository structure detected from uploaded files.';
}

function buildReviewPlan(riskAreas: string[]): string[] {
  const plan = ['Review project configuration and source entry points.'];

  if (riskAreas.includes('API routes')) {
    plan.push('Review API routes for authentication and input validation.');
  }
  if (riskAreas.includes('Authentication')) {
    plan.push('Review authentication and session handling.');
  }
  if (riskAreas.includes('Payments')) {
    plan.push('Review payment and checkout flow safety.');
  }
  if (riskAreas.includes('Database')) {
    plan.push('Review database schema and persistence boundaries.');
  }

  return plan;
}
