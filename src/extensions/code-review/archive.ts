import crypto from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

import { CODE_REVIEW_LIMITS } from './limits';
import { shouldIgnoreFile } from './filters';
import { normalizeArchivePath } from './path';
import { redactSecrets } from './secrets';
import { ReviewableFile } from './types';

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP_METHOD_STORED = 0;
const ZIP_METHOD_DEFLATED = 8;

export interface IgnoredArchiveFile {
  path: string;
  reason: string;
  sizeBytes?: number;
}

export interface ExtractedProject {
  archiveName: string;
  files: ReviewableFile[];
  ignoredFiles: IgnoredArchiveFile[];
  totalBytes: number;
}

interface ZipEntry {
  path: string;
  compressedContent: Buffer;
  compressionMethod: number;
  uncompressedSize: number;
  isSymlink: boolean;
}

export async function extractZipProject(
  buffer: Buffer,
  archiveName: string
): Promise<ExtractedProject> {
  if (buffer.byteLength > CODE_REVIEW_LIMITS.maxArchiveBytes) {
    throw new Error('archive_too_large');
  }

  const entries = readZipEntries(buffer);
  const files: ReviewableFile[] = [];
  const ignoredFiles: IgnoredArchiveFile[] = [];
  let totalBytes = 0;

  for (const entry of entries) {
    if (entry.path.endsWith('/')) {
      continue;
    }

    const normalizedPath = normalizeArchivePath(entry.path);
    if (!normalizedPath) {
      ignoredFiles.push({ path: entry.path, reason: 'unsafe_path' });
      continue;
    }

    if (entry.isSymlink) {
      ignoredFiles.push({ path: normalizedPath, reason: 'symlink' });
      continue;
    }

    totalBytes += entry.uncompressedSize;
    if (totalBytes > CODE_REVIEW_LIMITS.maxExtractedBytes) {
      throw new Error('extracted_content_too_large');
    }

    const ignore = shouldIgnoreFile({
      path: normalizedPath,
      sizeBytes: entry.uncompressedSize,
    });
    if (ignore.ignored) {
      ignoredFiles.push({
        path: normalizedPath,
        reason: ignore.reason || 'ignored',
        sizeBytes: entry.uncompressedSize,
      });
      continue;
    }

    const contentBuffer = decompressContent(
      entry.compressedContent,
      entry.compressionMethod
    );
    if (contentBuffer.byteLength !== entry.uncompressedSize) {
      throw new Error('zip_size_mismatch');
    }

    const content = redactSecrets(contentBuffer.toString('utf8'));
    files.push({
      path: normalizedPath,
      content,
      language: detectLanguage(normalizedPath),
      sizeBytes: contentBuffer.byteLength,
      lineCount: content.split('\n').length,
      hash: crypto.createHash('sha256').update(contentBuffer).digest('hex'),
      included: true,
    });
  }

  if (files.length + ignoredFiles.length > CODE_REVIEW_LIMITS.maxFiles) {
    throw new Error('too_many_files');
  }

  return { archiveName, files, ignoredFiles, totalBytes };
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) {
    throw new Error('invalid_zip');
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (entryCount > CODE_REVIEW_LIMITS.maxFiles) {
    throw new Error('too_many_files');
  }
  if (centralDirectoryOffset < 0 || centralDirectoryOffset >= eocdOffset) {
    throw new Error('invalid_zip_central_directory');
  }

  const entries: ZipEntry[] = [];
  let cursor = centralDirectoryOffset;
  let declaredExtractedBytes = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (cursor < 0 || cursor + 46 > buffer.length) {
      throw new Error('invalid_zip_central_directory');
    }
    if (buffer.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_HEADER) {
      throw new Error('invalid_zip_central_directory');
    }

    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const externalAttributes = buffer.readUInt32LE(cursor + 38);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const fileNameStart = cursor + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    const nextCursor = fileNameEnd + extraLength + commentLength;
    if (fileNameEnd > buffer.length || nextCursor > buffer.length) {
      throw new Error('invalid_zip_central_directory');
    }
    const path = buffer.subarray(fileNameStart, fileNameEnd).toString('utf8');

    declaredExtractedBytes += uncompressedSize;
    if (declaredExtractedBytes > CODE_REVIEW_LIMITS.maxExtractedBytes) {
      throw new Error('extracted_content_too_large');
    }

    if ((flags & 0x1) === 0x1) {
      throw new Error('encrypted_zip_not_supported');
    }

    const compressedContent = readCompressedContent(
      buffer,
      localHeaderOffset,
      compressedSize
    );

    entries.push({
      path,
      compressedContent,
      compressionMethod: method,
      uncompressedSize,
      isSymlink: isUnixSymlink(externalAttributes),
    });

    cursor = nextCursor;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) {
      return offset;
    }
  }

  return -1;
}

function readCompressedContent(
  buffer: Buffer,
  localHeaderOffset: number,
  compressedSize: number
): Buffer {
  if (localHeaderOffset < 0 || localHeaderOffset + 30 > buffer.length) {
    throw new Error('invalid_zip_local_header');
  }
  if (buffer.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_HEADER) {
    throw new Error('invalid_zip_local_header');
  }

  const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + compressedSize;
  if (dataStart < 0 || dataEnd > buffer.length) {
    throw new Error('invalid_zip_local_header');
  }

  return buffer.subarray(dataStart, dataEnd);
}

function decompressContent(content: Buffer, method: number): Buffer {
  if (method === ZIP_METHOD_STORED) {
    return content;
  }

  if (method === ZIP_METHOD_DEFLATED) {
    return inflateRawSync(content);
  }

  throw new Error('unsupported_zip_compression');
}

function isUnixSymlink(externalAttributes: number): boolean {
  const mode = (externalAttributes >>> 16) & 0o170000;
  return mode === 0o120000;
}

function detectLanguage(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    php: 'php',
    rb: 'ruby',
    md: 'markdown',
    json: 'json',
    yml: 'yaml',
    yaml: 'yaml',
  };

  return extension ? map[extension] || extension : 'text';
}
