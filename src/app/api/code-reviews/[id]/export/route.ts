import { respErr } from '@/shared/lib/resp';
import { rebuildLiveReport } from '@/extensions/code-review/live-report';
import {
  findCodeReviewJobById,
  findCodeReviewReportByJobId,
  getCodeReviewFiles,
  getCodeReviewFindings,
} from '@/shared/models/code_review';
import { getUserInfo } from '@/shared/models/user';

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const { id } = await context.params;
    const job = await findCodeReviewJobById(id);
    if (!job) {
      return respErr('code review not found');
    }
    if (job.userId !== user.id) {
      return respErr('no permission');
    }

    const [storedReport, files, findings] = await Promise.all([
      findCodeReviewReportByJobId(job.id),
      getCodeReviewFiles({ jobId: job.id }),
      getCodeReviewFindings({ jobId: job.id }),
    ]);
    if (!storedReport) {
      return respErr('report not found');
    }
    const report = rebuildLiveReport({
      reportJson: storedReport.reportJson,
      fallbackExecutiveSummary: storedReport.executiveSummary,
      findings,
      files,
    });

    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'markdown';

    if (format === 'json') {
      return new Response(JSON.stringify(report, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${job.id}.json"`,
        },
      });
    }

    return new Response(report.markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${job.id}.md"`,
      },
    });
  } catch (e: any) {
    console.log('export code review failed:', e);
    return respErr(`export code review failed: ${e.message}`);
  }
}
