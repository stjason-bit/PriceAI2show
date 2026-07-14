'use client';

import { FormEvent, useState } from 'react';

import { useRouter } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  CodeReviewWorkflow,
  ReviewWorkflowStage,
} from './review-workflow';

const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;

export function CodeReviewUploadForm({
  labels,
}: {
  labels: {
    title: string;
    description: string;
    file: string;
    fileHint: string;
    mode: string;
    modeStandard: string;
    modeDeep: string;
    modeSecurity: string;
    instructions: string;
    instructionsPlaceholder: string;
    submit: string;
    uploading: string;
    fileRequired: string;
    fileTooLarge: string;
    failed: string;
    workflowTitle: string;
    workflowDescription: string;
    workflowWorking: string;
    workflowStages: ReviewWorkflowStage[];
  };
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState('standard');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState(0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError(labels.fileRequired);
      return;
    }
    if (file.size > MAX_ARCHIVE_BYTES) {
      setError(labels.fileTooLarge);
      return;
    }

    setLoading(true);
    setError('');
    setActiveStep(0);
    const progressTimer = window.setInterval(() => {
      setActiveStep((current) => Math.min(current + 1, 5));
    }, 1800);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    formData.append('instructions', instructions);

    try {
      const response = await fetch('/api/code-reviews', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      if (!response.ok || result.code !== 0) {
        setError(result.message || labels.failed);
        return;
      }

      setActiveStep(6);
      router.push(`/activity/code-reviews/${result.data.job.id}`);
      router.refresh();
    } catch {
      setError(labels.failed);
    } finally {
      window.clearInterval(progressTimer);
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>{labels.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="code-review-file">{labels.file}</Label>
            <Input
              id="code-review-file"
              type="file"
              accept=".zip,application/zip"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <p className="text-muted-foreground text-xs">{labels.fileHint}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="code-review-mode">{labels.mode}</Label>
            <select
              id="code-review-mode"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              value={mode}
              onChange={(event) => setMode(event.target.value)}
            >
              <option value="standard">{labels.modeStandard}</option>
              <option value="deep">{labels.modeDeep}</option>
              <option value="security">{labels.modeSecurity}</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="code-review-instructions">
              {labels.instructions}
            </Label>
            <Textarea
              id="code-review-instructions"
              value={instructions}
              placeholder={labels.instructionsPlaceholder}
              rows={4}
              onChange={(event) => setInstructions(event.target.value)}
            />
          </div>

          {error && <div className="text-destructive text-sm">{error}</div>}

          {loading && (
            <div className="space-y-3 rounded-lg border p-4">
              <CodeReviewWorkflow
                title={labels.workflowTitle}
                description={labels.workflowDescription}
                stages={labels.workflowStages}
                activeStep={activeStep}
              />
              <p className="text-muted-foreground text-xs">
                {labels.workflowWorking}
              </p>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? labels.uploading : labels.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
