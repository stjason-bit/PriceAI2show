import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';

export function CodeReviewReportView({
  jobId,
  report,
  files,
}: {
  jobId: string;
  report?: {
    executiveSummary: string;
    riskScore: number;
    summaryMarkdown: string;
  };
  files: { included: boolean; ignoredReason?: string | null; path: string }[];
}) {
  const ignoredFiles = files.filter((file) => !file.included);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle>Report Overview</CardTitle>
            <CardDescription>
              Professional summary, risk score, and export options.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <a href={`/api/code-reviews/${jobId}/export?format=markdown`}>
                Markdown
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={`/api/code-reviews/${jobId}/export?format=json`}>
                JSON
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {report ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="border-border rounded-md border p-4">
                  <div className="text-muted-foreground text-xs">
                    Risk Score
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    {report.riskScore}
                  </div>
                </div>
                <div className="border-border rounded-md border p-4">
                  <div className="text-muted-foreground text-xs">
                    Reviewed Files
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    {files.filter((file) => file.included).length}
                  </div>
                </div>
                <div className="border-border rounded-md border p-4">
                  <div className="text-muted-foreground text-xs">
                    Ignored Files
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    {ignoredFiles.length}
                  </div>
                </div>
              </div>
              <p className="text-sm leading-6">{report.executiveSummary}</p>
              <div className="bg-muted/40 rounded-md p-4">
                <pre className="whitespace-pre-wrap text-sm leading-6">
                  {report.summaryMarkdown}
                </pre>
              </div>
            </>
          ) : (
            <div className="text-muted-foreground text-sm">
              Report has not been generated yet.
            </div>
          )}
        </CardContent>
      </Card>

      {ignoredFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ignored Files</CardTitle>
            <CardDescription>
              Files skipped by safety, size, dependency, or asset filters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 space-y-2 overflow-auto text-sm">
              {ignoredFiles.map((file) => (
                <div
                  key={file.path}
                  className="border-border flex gap-2 rounded-md border p-2"
                >
                  <span className="min-w-0 flex-1 truncate">{file.path}</span>
                  <span className="text-muted-foreground">
                    {file.ignoredReason || 'ignored'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
