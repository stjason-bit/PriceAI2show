import { generateId } from 'ai';

import { extractZipProject } from '@/extensions/code-review/archive';
import { EvolinkCodeReviewProvider } from '@/extensions/code-review/evolink';
import { runCodeReviewJob } from '@/extensions/code-review/runner';
import {
  CodeReviewFindingStatus,
  CodeReviewJobStatus,
  CodeReviewMode,
} from '@/extensions/code-review/types';
import { respData, respErr } from '@/shared/lib/resp';
import {
  createCodeReviewFiles,
  createCodeReviewFindings,
  createCodeReviewJob,
  createCodeReviewReport,
  getCodeReviewJobs,
  getCodeReviewJobsCount,
  NewCodeReviewFile,
  NewCodeReviewFinding,
  updateCodeReviewJob,
} from '@/shared/models/code_review';
import { getUserInfo } from '@/shared/models/user';

export async function GET(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') || 1);
    const limit = Number(url.searchParams.get('pageSize') || 20);

    const [jobs, total] = await Promise.all([
      getCodeReviewJobs({ userId: user.id, page, limit }),
      getCodeReviewJobsCount({ userId: user.id }),
    ]);

    return respData({ jobs, total, page, limit });
  } catch (e: any) {
    console.log('get code reviews failed:', e);
    return respErr(`get code reviews failed: ${e.message}`);
  }
}

export async function POST(req: Request) {
  const currentTime = new Date();
  let jobId = '';

  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const mode = normalizeMode(String(formData.get('mode') || 'standard'));
    const instructions = String(formData.get('instructions') || '');

    if (!(file instanceof File)) {
      return respErr('file is required');
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      return respErr('only zip archive is supported');
    }

    const model =
      process.env.EVOLINK_CODE_REVIEW_MODEL || 'claude-sonnet-4-6';
    const provider = new EvolinkCodeReviewProvider({
      apiKey: process.env.EVOLINK_API_KEY || '',
      baseUrl: process.env.EVOLINK_BASE_URL || 'https://direct.evolink.ai',
      model,
    });

    jobId = generateId().toLowerCase();
    const job = await createCodeReviewJob({
      id: jobId,
      userId: user.id,
      status: CodeReviewJobStatus.Created,
      mode,
      archiveName: file.name,
      archiveSize: file.size,
      model,
      createdAt: currentTime,
      updatedAt: currentTime,
    });

    await updateCodeReviewJob(job.id, {
      status: CodeReviewJobStatus.Indexing,
      updatedAt: new Date(),
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const project = await extractZipProject(buffer, file.name);
    const reviewFiles: NewCodeReviewFile[] = project.files.map((item) => ({
      id: generateId().toLowerCase(),
      jobId: job.id,
      path: item.path,
      language: item.language,
      sizeBytes: item.sizeBytes,
      lineCount: item.lineCount,
      hash: item.hash,
      included: true,
      createdAt: new Date(),
    }));
    const ignoredFiles: NewCodeReviewFile[] = project.ignoredFiles.map(
      (item) => ({
        id: generateId().toLowerCase(),
        jobId: job.id,
        path: item.path,
        language: 'text',
        sizeBytes: item.sizeBytes || 0,
        lineCount: 0,
        hash: '',
        included: false,
        ignoredReason: item.reason,
        createdAt: new Date(),
      })
    );
    const savedFiles = await createCodeReviewFiles([
      ...reviewFiles,
      ...ignoredFiles,
    ]);
    const fileIdByPath = new Map(
      savedFiles.map((savedFile) => [savedFile.path, savedFile.id])
    );

    await updateCodeReviewJob(job.id, {
      status: CodeReviewJobStatus.Reviewing,
      fileCount: project.files.length + project.ignoredFiles.length,
      includedFileCount: project.files.length,
      ignoredFileCount: project.ignoredFiles.length,
      updatedAt: new Date(),
    });

    const report = await runCodeReviewJob({
      files: project.files,
      ignoredFiles: project.ignoredFiles,
      mode,
      instructions,
      provider,
    });

    const findings: NewCodeReviewFinding[] = report.findings.map((finding) => ({
      id: generateId().toLowerCase(),
      jobId: job.id,
      fileId: finding.filePath ? fileIdByPath.get(finding.filePath) : undefined,
      title: finding.title,
      severity: finding.severity,
      category: finding.category,
      confidence: finding.confidence,
      status: finding.status || CodeReviewFindingStatus.Open,
      filePath: finding.filePath,
      startLine: finding.startLine,
      endLine: finding.endLine,
      evidence: finding.evidence,
      recommendation: finding.recommendation,
      suggestedFix: finding.suggestedFix,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await createCodeReviewFindings(findings);
    await createCodeReviewReport({
      id: generateId().toLowerCase(),
      jobId: job.id,
      summaryMarkdown: report.markdown,
      reportJson: JSON.stringify(report),
      executiveSummary: report.executiveSummary,
      riskScore: report.riskScore,
      createdAt: new Date(),
    });

    const completedJob = await updateCodeReviewJob(job.id, {
      status: CodeReviewJobStatus.Completed,
      detectedStack: JSON.stringify(report.findings.map((item) => item.category)),
      inputTokens: report.usage.inputTokens,
      outputTokens: report.usage.outputTokens,
      completedAt: new Date(),
      updatedAt: new Date(),
    });

    return respData({ job: completedJob, report });
  } catch (e: any) {
    console.log('create code review failed:', e);
    if (jobId) {
      await updateCodeReviewJob(jobId, {
        status: CodeReviewJobStatus.Failed,
        errorMessage: e.message,
        updatedAt: new Date(),
      });
    }
    return respErr(`create code review failed: ${e.message}`);
  }
}

function normalizeMode(value: string): CodeReviewMode {
  if (value === CodeReviewMode.Deep) {
    return CodeReviewMode.Deep;
  }
  if (value === CodeReviewMode.Security) {
    return CodeReviewMode.Security;
  }

  return CodeReviewMode.Standard;
}
