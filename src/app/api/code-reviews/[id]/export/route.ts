import { respErr } from '@/shared/lib/resp';
import {
  findCodeReviewJobById,
  findCodeReviewReportByJobId,
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

    const report = await findCodeReviewReportByJobId(job.id);
    if (!report) {
      return respErr('report not found');
    }

    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'markdown';

    if (format === 'json') {
      return new Response(report.reportJson, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${job.id}.json"`,
        },
      });
    }

    return new Response(report.summaryMarkdown, {
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
