import { CodeReviewFindingStatus } from '@/extensions/code-review/types';
import { respData, respErr } from '@/shared/lib/resp';
import {
  findCodeReviewJobById,
  getCodeReviewFindings,
  updateCodeReviewFindingStatus,
} from '@/shared/models/code_review';
import { getUserInfo } from '@/shared/models/user';

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string; findingId: string }> }
) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const { id, findingId } = await context.params;
    const job = await findCodeReviewJobById(id);
    if (!job) {
      return respErr('code review not found');
    }
    if (job.userId !== user.id) {
      return respErr('no permission');
    }

    const { status } = await req.json();
    if (!isFindingStatus(status)) {
      return respErr('invalid status');
    }

    const findings = await getCodeReviewFindings({ jobId: job.id });
    if (!findings.some((finding) => finding.id === findingId)) {
      return respErr('finding not found');
    }

    const finding = await updateCodeReviewFindingStatus(findingId, status);

    return respData(finding);
  } catch (e: any) {
    console.log('update code review finding failed:', e);
    return respErr(`update code review finding failed: ${e.message}`);
  }
}

function isFindingStatus(value: any): value is CodeReviewFindingStatus {
  return Object.values(CodeReviewFindingStatus).includes(value);
}
