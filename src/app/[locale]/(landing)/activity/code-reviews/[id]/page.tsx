import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common';
import { CodeReviewFindingsTable } from '@/shared/blocks/code-review/findings-table';
import { CodeReviewReportView } from '@/shared/blocks/code-review/report-view';
import { Badge } from '@/shared/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  findCodeReviewJobById,
  findCodeReviewReportByJobId,
  getCodeReviewFiles,
  getCodeReviewFindings,
} from '@/shared/models/code_review';
import { getUserInfo } from '@/shared/models/user';

export default async function CodeReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getUserInfo();
  if (!user) {
    return <Empty message="no auth" />;
  }

  const t = await getTranslations('activity.code-reviews');
  const { id } = await params;
  const job = await findCodeReviewJobById(id);
  if (!job || job.userId !== user.id) {
    return <Empty message={t('detail.not_found')} />;
  }

  const [files, findings, report] = await Promise.all([
    getCodeReviewFiles({ jobId: job.id }),
    getCodeReviewFindings({ jobId: job.id }),
    findCodeReviewReportByJobId(job.id),
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle>{job.archiveName}</CardTitle>
            <CardDescription>
              {job.mode} / {job.model}
            </CardDescription>
          </div>
          <Badge variant="secondary">{job.status}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Metric label={t('detail.files')} value={String(job.fileCount)} />
          <Metric
            label={t('detail.reviewed')}
            value={String(job.includedFileCount)}
          />
          <Metric
            label={t('detail.ignored')}
            value={String(job.ignoredFileCount)}
          />
          <Metric
            label={t('detail.tokens')}
            value={String(job.inputTokens + job.outputTokens)}
          />
        </CardContent>
      </Card>

      <CodeReviewReportView
        jobId={job.id}
        files={files}
        report={
          report
            ? {
                executiveSummary: report.executiveSummary,
                riskScore: report.riskScore,
                summaryMarkdown: report.summaryMarkdown,
              }
            : undefined
        }
      />

      <CodeReviewFindingsTable jobId={job.id} findings={findings} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border rounded-md border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
