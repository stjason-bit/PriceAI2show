# Code Review Feature Design

Date: 2026-07-13

## Goal

Build the first version of a project code review feature for this ShipAny-based SaaS. Users upload a project source archive, the system analyzes the repository without executing user code, and produces a professional code review report with findings, optimization suggestions, items that need human verification, and ignored or low-value issues.

The first version focuses on full-repository review from a `.zip` upload. GitHub PR review, quality gates, and team policy enforcement are future product directions. V1 only reserves compatible fields and status concepts; it does not implement those workflows.

## Product Scope

### In Scope

- Upload a `.zip` project archive.
- Validate archive size, file count, and extracted file size before review.
- Extract source files into a server-controlled workspace or object storage area.
- Ignore generated, dependency, binary, build, and large files by default.
- Detect the project language, framework, package manager, important config files, and likely entry points.
- Run a multi-stage AI review using Evolink.
- Generate a report with structured findings and an executive summary.
- Track finding status: `open`, `needs_review`, `ignored`, and `fixed`.
- Store the review job, project snapshot metadata, files index, model usage, and final report.
- Allow report export as Markdown and JSON in the first version.

### Out of Scope for V1

- Executing uploaded code, tests, package installs, or build commands.
- GitHub App integration and PR comments.
- Automatic code modification or pull request creation.
- Organization-level custom policy engine.
- Hard blocking quality gates.
- Deep dependency vulnerability database integration.

## Reference Product Patterns

Leading code review products share several patterns that should inform this design:

- CodeRabbit-style configuration: repository-level instructions, path-specific instructions, file filters, review profiles, and noise control.
- Qodo-style review depth: multiple review perspectives, stronger focus on correctness and test gaps, and lower-noise output.
- GitHub Copilot-style workflow: review comments are actionable and scoped to exact files or changes where the uploaded source provides enough evidence.
- SonarQube-style quality management: issues need severity, category, status, and a quality signal that remains compatible with future gate implementations.

For this product, V1 borrows the structure but keeps the surface simple: a few clear review modes and a professional report, not a large configuration console.

## User Flow

1. User opens the code review page.
2. User uploads a `.zip` project archive.
3. User selects review mode:
   - `Standard`: balanced cost and depth, default.
   - `Deep`: more cross-file reasoning and second-pass review for critical areas.
   - `Security Focus`: security, auth, payment, data exposure, and permission review.
4. User adjusts optional filters if needed:
   - Include tests.
   - Include docs.
   - Include lock files.
   - Ignore paths.
   - Add project-specific instructions.
5. System creates a review job and starts analysis.
6. User sees processing states: uploaded, indexing, reviewing, synthesizing, completed, failed.
7. User opens the final report.
8. User can change finding status, ignore issues, export report, or start a new review.

## Architecture

### Main Modules

- `CodeReviewUpload`: validates and accepts the zip archive.
- `ArchiveExtractor`: safely extracts the archive and prevents path traversal.
- `RepositoryIndexer`: builds a file manifest, detects stack, computes size and language stats, and picks relevant files.
- `ReviewPlanner`: groups files into chunks and chooses the review stages.
- `EvolinkCodeReviewProvider`: calls Evolink Claude Messages API.
- `PromptRegistry`: stores versioned prompts for repository profiling, file review, cross-file review, report synthesis, and ignored-issue classification.
- `ReportAssembler`: deduplicates findings, normalizes severity, sorts by risk, and builds the final report.
- `ReviewRepository`: persists jobs, files, findings, usage, and report output.

### Suggested Placement

- API routes under `src/app/api/code-reviews`.
- Domain logic under `src/extensions/code-review`.
- Shared model/database functions under `src/shared/models/code_review*`.
- UI page under the authenticated app area used by the product dashboard.

The existing chat API is OpenRouter-specific and conversation-oriented. This feature will not reuse it directly. It will use a dedicated Evolink provider so model routing, usage tracking, retries, and structured review output stay isolated.

## Data Model

### `code_review_jobs`

- `id`
- `user_id`
- `status`: `created`, `uploaded`, `indexing`, `reviewing`, `synthesizing`, `completed`, `failed`
- `mode`: `standard`, `deep`, `security`
- `archive_name`
- `archive_size`
- `file_count`
- `included_file_count`
- `ignored_file_count`
- `detected_stack`
- `model`
- `input_tokens`
- `output_tokens`
- `cost_estimate`
- `error_message`
- `created_at`
- `updated_at`
- `completed_at`

### `code_review_files`

- `id`
- `job_id`
- `path`
- `language`
- `size_bytes`
- `line_count`
- `hash`
- `included`
- `ignored_reason`
- `summary`

### `code_review_findings`

- `id`
- `job_id`
- `file_id`
- `title`
- `severity`: `critical`, `high`, `medium`, `low`, `info`
- `category`: `bug`, `security`, `performance`, `architecture`, `maintainability`, `test`, `dependency`
- `confidence`: `high`, `medium`, `low`
- `status`: `open`, `needs_review`, `ignored`, `fixed`
- `file_path`
- `start_line`
- `end_line`
- `evidence`
- `recommendation`
- `suggested_fix`
- `created_at`
- `updated_at`

### `code_review_reports`

- `id`
- `job_id`
- `summary_markdown`
- `report_json`
- `executive_summary`
- `risk_score`
- `created_at`

## File Filtering

Default ignored paths and patterns:

- `.git/**`
- `node_modules/**`
- `.next/**`
- `dist/**`
- `build/**`
- `coverage/**`
- `.turbo/**`
- `.cache/**`
- `vendor/**`
- large lock files by default, unless the user enables dependency review
- binary files, images, videos, fonts, and archives inside the archive
- files above the configured single-file size limit

The indexer records ignored files and reasons so the report includes an "Ignored" section. This makes the review more trustworthy because users can see what was not inspected.

## Review Pipeline

### Stage 1: Repository Profile

Input:

- File tree.
- Important config files.
- Package/dependency manifests.
- README or docs if present.

Output:

- Detected stack.
- Architecture summary.
- Critical modules.
- Review plan.
- Risk areas.

### Stage 2: File and Module Review

Input:

- Grouped source files.
- Repository profile.
- User instructions.

Output:

- Structured findings.
- File summaries.
- Unclear areas that require cross-file review.

### Stage 3: Cross-File Review

Input:

- Repository profile.
- Critical files.
- Findings from Stage 2.
- Auth, payment, data, routing, and persistence paths when detected.

Output:

- Cross-module findings.
- Architecture and data-flow issues.
- False-positive candidates.

### Stage 4: Report Synthesis

Input:

- All findings.
- File summaries.
- Ignored file list.
- Usage metadata.

Output:

- Executive summary.
- Prioritized findings.
- Optimization suggestions.
- Needs-review list.
- Ignored/low-confidence section.
- JSON report and Markdown report.

## Prompt Design

Prompts are versioned under `src/extensions/code-review/prompts`. Each prompt must require JSON output first, then the report assembler renders Markdown from normalized data.

### Repository Profile Prompt

Purpose:

- Understand the uploaded repository without making findings too early.
- Identify the stack, architecture, important modules, and risk areas.

Required output:

- `stack`
- `architecture_summary`
- `important_paths`
- `risk_areas`
- `review_plan`

### File Review Prompt

Purpose:

- Review a bounded group of files.
- Find concrete, actionable issues only.
- Avoid style-only noise unless it affects maintainability or correctness.

Required output:

- `findings`
- `file_summaries`
- `needs_cross_file_review`

### Cross-File Review Prompt

Purpose:

- Review behavior that requires multiple files: auth, permissions, payments, database writes, background jobs, API routes, state management, and data validation.

Required output:

- `findings`
- `uncertain_items`
- `false_positive_candidates`

### Report Synthesis Prompt

Purpose:

- Deduplicate issues.
- Normalize severity and confidence.
- Produce a professional report that is useful to a CTO or senior engineer.

Required output:

- `executive_summary`
- `risk_score`
- `prioritized_findings`
- `optimization_suggestions`
- `needs_review`
- `ignored`

### Ignore Classifier Prompt

Purpose:

- Reduce noise from duplicate, speculative, style-only, or low-evidence issues.

Required output:

- `kept_findings`
- `ignored_findings`
- `ignore_reason`

## Model Strategy

Default model:

- `claude-sonnet-4-6`

Environment variables:

- `EVOLINK_API_KEY`
- `EVOLINK_BASE_URL`
- `EVOLINK_CODE_REVIEW_MODEL`

Request settings:

- `temperature`: `0.1` to keep reviews stable.
- `max_tokens`: high enough for structured JSON per stage.
- Prefer `https://direct.evolink.ai` for long text tasks.

Routing:

- Standard mode: Sonnet only.
- Deep mode: Sonnet for all chunks in V1, with more cross-file review stages than Standard mode.
- Security mode: Sonnet with security-focused prompts in V1. Opus escalation is out of scope for V1.

## Security

- Never execute uploaded code.
- Never install dependencies from uploaded code.
- Prevent zip path traversal with normalized paths.
- Reject symlinks or treat them as plain metadata.
- Enforce archive size, extracted size, file count, and single-file size limits.
- Store uploaded archives outside the public directory.
- Do not expose raw file contents to other users.
- Do not include secrets found in uploaded code in public previews or logs.
- Redact common secret patterns before model calls, including API keys, private keys, tokens, database URLs, and webhook secrets.

## Error Handling

- Invalid archive: fail fast with a user-facing error.
- Too many files or too large: fail with clear limit messaging.
- No reviewable files: complete with a report explaining what was ignored.
- Evolink rate limit: retry with backoff and preserve job state.
- Model JSON parse failure: run a repair pass once, then fail with diagnostics.
- Partial failure: preserve completed stage outputs and show a partial report only if synthesis succeeds.

## UI Design

The UI should feel like a SaaS workbench, not a marketing page.

Main views:

- Upload and configuration panel.
- Job progress view.
- Report overview.
- Findings table with filters.
- Finding detail drawer.
- Ignored files and ignored findings section.
- Export actions.

Finding filters:

- Severity.
- Category.
- Status.
- Confidence.
- File path.

Report sections:

- Executive summary.
- Risk score.
- Top issues.
- Security findings.
- Architecture and maintainability findings.
- Performance findings.
- Test gaps.
- Needs human review.
- Ignored findings and ignored files.

## Testing Strategy

Unit tests:

- Archive path normalization.
- Ignore pattern matching.
- File type detection.
- Prompt output schema validation.
- Report assembler deduplication and sorting.

Integration tests:

- Upload a small fixture zip.
- Generate repository index.
- Mock Evolink responses.
- Complete a review job.
- Persist findings and report.

Manual checks:

- Upload invalid zip.
- Upload archive with `../` paths.
- Upload archive with only ignored files.
- Simulate Evolink API failure.
- Verify `.env` secrets are not exposed to the client.

## Acceptance Criteria

- A signed-in user can upload a zip project and start a review.
- The system indexes the repository without executing any code.
- The system calls Evolink with the configured model.
- The final report contains structured sections for issues, recommendations, needs review, and ignored items.
- Findings can be filtered and status can be changed.
- The report can be exported as Markdown and JSON.
- Invalid or unsafe uploads are rejected safely.
- Secrets and uploaded source files are not publicly exposed.
