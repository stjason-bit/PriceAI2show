import { respData, respErr } from '@/shared/lib/resp';
import {
  findCodeReviewJobById,
  findCodeReviewReportByJobId,
  getCodeReviewFiles,
  getCodeReviewFindings,
} from '@/shared/models/code_review';
import { getUserInfo } from '@/shared/models/user';

export async function GET(
  _req: Request,
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

    const [files, findings, report] = await Promise.all([
      getCodeReviewFiles({ jobId: job.id }),
      getCodeReviewFindings({ jobId: job.id }),
      findCodeReviewReportByJobId(job.id),
    ]);

    return respData({ job, files, findings, report });
  } catch (e: any) {
    console.log('get code review failed:', e);
    return respErr(`get code review failed: ${e.message}`);
  }
}
