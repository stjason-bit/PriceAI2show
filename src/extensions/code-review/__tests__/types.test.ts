import { describe, expect, it } from 'vitest';

import { CODE_REVIEW_LIMITS } from '../limits';
import {
  CodeReviewFindingStatus,
  CodeReviewJobStatus,
  CodeReviewMode,
} from '../types';

describe('code review domain types', () => {
  it('defines stable V1 modes and statuses', () => {
    expect(CodeReviewMode.Standard).toBe('standard');
    expect(CodeReviewMode.Deep).toBe('deep');
    expect(CodeReviewMode.Security).toBe('security');
    expect(CodeReviewJobStatus.Created).toBe('created');
    expect(CodeReviewJobStatus.Completed).toBe('completed');
    expect(CodeReviewFindingStatus.NeedsReview).toBe('needs_review');
  });

  it('keeps upload limits bounded for V1', () => {
    expect(CODE_REVIEW_LIMITS.maxArchiveBytes).toBe(25 * 1024 * 1024);
    expect(CODE_REVIEW_LIMITS.maxFiles).toBe(1200);
    expect(CODE_REVIEW_LIMITS.maxSingleFileBytes).toBe(256 * 1024);
  });
});
