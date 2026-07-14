import { getTranslations } from 'next-intl/server';

import { Link } from '@/core/i18n/navigation';
import { Empty } from '@/shared/blocks/common';
import { CodeReviewUploadForm } from '@/shared/blocks/code-review/upload-form';
import { CodeReviewWorkflow } from '@/shared/blocks/code-review/review-workflow';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  getCodeReviewJobs,
  getCodeReviewJobsCount,
} from '@/shared/models/code_review';
import { getUserInfo } from '@/shared/models/user';

export default async function CodeReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: number; pageSize?: number }>;
}) {
  const user = await getUserInfo();
  if (!user) {
    return <Empty message="no auth" />;
  }

  const t = await getTranslations('activity.code-reviews');
  const { page: pageNum, pageSize } = await searchParams;
  const page = Number(pageNum || 1);
  const limit = Number(pageSize || 20);
  const [jobs, total] = await Promise.all([
    getCodeReviewJobs({ userId: user.id, page, limit }),
    getCodeReviewJobsCount({ userId: user.id }),
  ]);

  return (
    <div className="space-y-8">
      <CodeReviewWorkflow
        title={t('pipeline.title')}
        description={t('pipeline.description')}
        stages={t.raw('pipeline.stages')}
        activeStep={-1}
      />

      <CodeReviewUploadForm
        labels={{
          title: t('upload.title'),
          description: t('upload.description'),
          file: t('upload.file'),
          fileHint: t('upload.file_hint'),
          mode: t('upload.mode'),
          modeStandard: t('upload.mode_standard'),
          modeDeep: t('upload.mode_deep'),
          modeSecurity: t('upload.mode_security'),
          instructions: t('upload.instructions'),
          instructionsPlaceholder: t('upload.instructions_placeholder'),
          submit: t('upload.submit'),
          uploading: t('upload.uploading'),
          fileRequired: t('upload.file_required'),
          fileTooLarge: t('upload.file_too_large'),
          failed: t('upload.failed'),
          workflowTitle: t('pipeline.title'),
          workflowDescription: t('pipeline.description'),
          workflowWorking: t('pipeline.working'),
          workflowStages: t.raw('pipeline.stages'),
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('list.title')}</CardTitle>
          <CardDescription>
            {t('list.description', { total })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobs.length === 0 ? (
            <div className="text-muted-foreground text-sm">
              {t('list.empty')}
            </div>
          ) : (
            jobs.map((job) => (
              <div
                key={job.id}
                className="border-border flex flex-wrap items-center gap-3 rounded-md border p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {job.archiveName}
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    {t(`list.mode_${job.mode}`)} · {job.model} ·{' '}
                    {t('list.files', {
                      reviewed: job.includedFileCount,
                      total: job.fileCount,
                    })}
                  </div>
                </div>
                <Badge variant="secondary">{t(`status.${job.status}`)}</Badge>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/activity/code-reviews/${job.id}`}>
                    {t('list.open')}
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
