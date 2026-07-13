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

export function CodeReviewUploadForm({
  labels,
}: {
  labels: {
    title: string;
    description: string;
    file: string;
    mode: string;
    modeStandard: string;
    modeDeep: string;
    modeSecurity: string;
    instructions: string;
    instructionsPlaceholder: string;
    submit: string;
    uploading: string;
    fileRequired: string;
    failed: string;
  };
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState('standard');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError(labels.fileRequired);
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    formData.append('instructions', instructions);

    const response = await fetch('/api/code-reviews', {
      method: 'POST',
      body: formData,
    });
    const result = await response.json();

    setLoading(false);

    if (result.code !== 0) {
      setError(result.message || labels.failed);
      return;
    }

    router.push(`/activity/code-reviews/${result.data.job.id}`);
    router.refresh();
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

          <Button type="submit" disabled={loading}>
            {loading ? labels.uploading : labels.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
