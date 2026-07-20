export const CODE_REVIEW_LIMITS = {
  maxArchiveBytes: 25 * 1024 * 1024,
  maxExtractedBytes: 80 * 1024 * 1024,
  maxFiles: 1200,
  maxSingleFileBytes: 256 * 1024,
  maxReviewFiles: 240,
  maxPromptCharsPerChunk: 80_000,
} as const;
