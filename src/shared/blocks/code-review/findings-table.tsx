'use client';

import { useState } from 'react';

import { Badge } from '@/shared/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';

interface Finding {
  id: string;
  title: string;
  severity: string;
  category: string;
  confidence: string;
  status: string;
  filePath?: string | null;
  startLine?: number | null;
  evidence: string;
  recommendation: string;
}

const statuses = ['open', 'needs_review', 'ignored', 'fixed'];

export function CodeReviewFindingsTable({
  jobId,
  findings,
}: {
  jobId: string;
  findings: Finding[];
}) {
  const [items, setItems] = useState(findings);

  async function updateStatus(findingId: string, status: string) {
    const response = await fetch(
      `/api/code-reviews/${jobId}/findings/${findingId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }
    );
    const result = await response.json();
    if (result.code === 0) {
      setItems((current) =>
        current.map((item) =>
          item.id === findingId ? { ...item, status } : item
        )
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Findings</CardTitle>
        <CardDescription>
          Review, triage, and update issue status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <div className="text-muted-foreground text-sm">
            No findings detected.
          </div>
        ) : (
          items.map((finding) => (
            <div
              key={finding.id}
              className="border-border rounded-md border p-4"
            >
              <div className="flex flex-wrap items-start gap-2">
                <Badge variant="secondary">{finding.severity}</Badge>
                <Badge variant="outline">{finding.category}</Badge>
                <Badge variant="outline">{finding.confidence}</Badge>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">{finding.title}</h3>
                  {finding.filePath && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {finding.filePath}
                      {finding.startLine ? `:${finding.startLine}` : ''}
                    </p>
                  )}
                </div>
                <select
                  className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                  value={finding.status}
                  onChange={(event) =>
                    updateStatus(finding.id, event.target.value)
                  }
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-3 text-sm">{finding.evidence}</p>
              <p className="text-muted-foreground mt-2 text-sm">
                {finding.recommendation}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
