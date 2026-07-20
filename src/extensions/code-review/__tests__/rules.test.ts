import { describe, expect, it } from 'vitest';

import { runRuleScan } from '../rules';
import { ReviewableFile } from '../types';

function file(path: string, content: string): ReviewableFile {
  return {
    path,
    content,
    language: 'typescript',
    sizeBytes: Buffer.byteLength(content),
    lineCount: content.split('\n').length,
    hash: path,
    included: true,
  };
}

describe('deterministic rule scan', () => {
  it('classifies standards and potential risk findings', () => {
    const findings = runRuleScan([
      file(
        'src/a.ts',
        '// TODO: remove temporary path\n// @ts-ignore\nconst value = eval(input);'
      ),
    ]);

    expect(findings.map((finding) => finding.category)).toEqual(
      expect.arrayContaining(['standards', 'risk'])
    );
    expect(findings.find((finding) => finding.category === 'risk')?.status).toBe(
      'needs_review'
    );
  });

  it('detects substantial repeated logic across files', () => {
    const duplicated = [
      'const normalizedEmail = email.trim().toLowerCase();',
      'const existingUser = await findUserByEmail(normalizedEmail);',
      'if (existingUser) throw new Error("user already exists");',
      'const passwordHash = await hashPassword(password);',
      'const user = await createUser({ email: normalizedEmail, passwordHash });',
      'return { id: user.id, email: user.email, createdAt: user.createdAt };',
    ].join('\n');

    const findings = runRuleScan([
      file('src/register.ts', duplicated),
      file('src/invite.ts', duplicated),
    ]);

    expect(findings.some((finding) => finding.category === 'duplication')).toBe(
      true
    );
  });
});
