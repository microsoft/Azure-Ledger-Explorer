/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { LedgerFileInfo } from '../utils/ledger-validation';
import { parseLedgerFilename, validateLedgerSequence } from '../utils/ledger-validation';

export interface DownloadProgress {
  currentFile: number;
  totalFiles: number;
  currentFilename: string;
}

// NGINX directory listing response interfaces
interface NginxFileEntry {
  name: string;
  type: 'file' | 'directory';
  mtime: string;
  size?: number;
}

type NginxDirectoryResponse = NginxFileEntry[];

// File info interface for MstClient
interface FileInfo {
  name: string;
  kind: 'file' | 'directory';
  url: string;
}

// Download response interface
interface DownloadResponse {
  blobBody: Promise<Blob>;
}

interface IMstClient {
  listAllLedgerFiles(): AsyncGenerator<FileInfo>;
  downloadFile(filename: string): Promise<DownloadResponse>;
}

// MstClient implementation using fetch to access NGINX-indexed ledger files
class MstClient implements IMstClient {
  private ledgerFilesUrl: string;

  constructor(domain: string) {
    // Prefix domain with 'ledger-files-' and construct base URL
    // parse domain to avoid double protocol
    if (domain.startsWith('http://')) {
      domain = domain.slice('http://'.length);
    } else if (domain.startsWith('https://')) {
      domain = domain.slice('https://'.length);
    }
    // remove trailing slash if present
    if (domain.endsWith('/')) {
      domain = domain.slice(0, -1);
    }
    // try parsing domain to ensure it's valid
    try {
      new URL(`https://${domain}`);
    } catch {
      throw new Error(`Invalid domain provided: ${domain}`);
    }
    this.ledgerFilesUrl = `https://ledger-files-${domain}/ledger/`;
  }

  async *listAllLedgerFiles(): AsyncGenerator<FileInfo> {
    yield* this.listFilesRecursively('/');
  }

  private async *listFilesRecursively(path: string): AsyncGenerator<FileInfo> {
    try {
      const targetUrl = `${this.ledgerFilesUrl}${path.startsWith('/') ? path.slice(1) : path}`;      
      const response = await fetch(targetUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list files at ${path}: ${response.status} ${response.statusText}`);
      }

      const data: NginxDirectoryResponse = await response.json();

      // check if response is array
      if (!Array.isArray(data)) {
        throw new Error(`Unexpected response format at ${path}: ${JSON.stringify(data)}`);
      }

      for (const entry of data) {
        // Skip parent directory entries
        if (entry.name === '../' || entry.name === './') {
          continue;
        }

        const fullPath = path === '/' ? entry.name : `${path}/${entry.name}`;
        const fileInfo: FileInfo = {
          name: entry.name,
          kind: entry.type,
          url: `${this.ledgerFilesUrl}${fullPath.startsWith('/') ? fullPath.slice(1) : fullPath}`,
        };

        if (entry.type === 'file') {
          yield fileInfo;
        } else if (entry.type === 'directory') {
          // Recursively search directories
          yield* this.listFilesRecursively(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error listing files in ${path}:`, error);
      throw new Error(`Failed to access directory ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async downloadFile(filename: string): Promise<DownloadResponse> {
    try {
      const targetUrl = `${this.ledgerFilesUrl}${filename}`;      
      const response = await fetch(targetUrl);

      if (!response.ok) {
        throw new Error(`Failed to download file ${filename}: ${response.status} ${response.statusText}`);
      }

      return {
        blobBody: response.blob(),
      };
    } catch (error) {
      console.error(`Error downloading file ${filename}:`, error);
      throw new Error(`Failed to download file ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export class MstFilesService {
  private mstClient: IMstClient | null = null;

  async initialize(domain: string): Promise<void> {
    try {
      this.mstClient = new MstClient(domain);
    } catch (error) {
      console.error('Initialization error:', error);
      throw new Error(
        'Failed to initialize MST client. Please ensure your domain is correct.'
      );
    }
  }

  async listLedgerFiles(): Promise<LedgerFileInfo[]> {
    if (!this.mstClient) {
      throw new Error('File share client not initialized');
    }

    const files: LedgerFileInfo[] = [];

    for await (const f of this.mstClient.listAllLedgerFiles()) {
      if (f.kind === "file" && f.name.endsWith('.committed')) {
        files.push({
          ...parseLedgerFilename(f.name)
        });
      }
    }
    const validation = validateLedgerSequence([], files);
    const sortedFilteredFiles: LedgerFileInfo[] = validation.sortedFiles;
    if (!validation.isValid) {
      console.warn(`Ledger files validation failed:`, validation.errors);

      // skip overlapping ranges, 
      // usually file starts with the same start number but ends with different end number
      const indexesToRemove = [];
      for (let i = 1; i < sortedFilteredFiles.length; i++) {
        const prevFile = sortedFilteredFiles[i - 1];
        const currFile = sortedFilteredFiles[i];
        if (currFile.startNo === prevFile.startNo && currFile.endNo >= prevFile.endNo) {
          console.warn(`Overlapping range. Skipping ${prevFile.filename}`);
          indexesToRemove.push(i - 1);
        } else if (currFile.startNo >= prevFile.startNo && currFile.endNo <= prevFile.endNo) {
          console.warn(`Overlapping range. Skipping ${currFile.filename}`);
          indexesToRemove.push(i);
        }
      }

      // remove duplicates from the end to avoid index shifting
      for (let i = indexesToRemove.length - 1; i >= 0; i--) {
        const index = indexesToRemove[i];
        sortedFilteredFiles.splice(index, 1);
      }
    }
    return sortedFilteredFiles;
  }

  async downloadLedgerFiles(
    upToFile: LedgerFileInfo,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<{ files: File[]; filesDownloaded: LedgerFileInfo[]; }> {
    if (!this.mstClient) {
      throw new Error('File share client not initialized');
    }

    try {
      const ledgerFileListFromStorage = await this.listLedgerFiles();
      if (ledgerFileListFromStorage.length === 0) {
        throw new Error('No ledger files found in the file share');
      }
      // Filter for files to download from storage
      const ledgerFileToDownloadFromStorage = ledgerFileListFromStorage.filter(file => file.endNo <= upToFile.endNo);
      const totalFiles = ledgerFileToDownloadFromStorage.length;
      const files: File[] = [];
      const filesDownloaded: LedgerFileInfo[] = [];
      let currentFile = 0;
      for (const downloadFile of ledgerFileToDownloadFromStorage) {
        currentFile++;
        onProgress?.({
          currentFile,
          totalFiles,
          currentFilename: downloadFile.filename,
        });
        
        filesDownloaded.push(downloadFile);
        const downloadResponse = await this.mstClient.downloadFile(downloadFile.filename);
        const blob = await downloadResponse.blobBody;
        if (!blob) {
          console.error(`Failed to download file: ${downloadFile.filename}`);
          continue; // Skip if blob is null
        }
        const file = await this.blobToFile(blob, downloadFile.filename);
        files.push(file);
      }
      return { files, filesDownloaded };
    }

    catch (error) {
      console.error('No Files to download in the File share', error);
      throw new Error('No Files to download in the File share');
    }
  }

  async downloadAllLedgerFiles(
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<{ files: File[]; filesDownloaded: LedgerFileInfo[]; }> {
    if (!this.mstClient) {
      throw new Error('File share client not initialized');
    }

    try {
      const ledgerFileListFromStorage = await this.listLedgerFiles();
      if (ledgerFileListFromStorage.length === 0) {
        throw new Error('No ledger files found in the file share');
      }
      const totalFiles = ledgerFileListFromStorage.length;
      const files: File[] = [];
      const filesDownloaded: LedgerFileInfo[] = [];
      let currentFile = 0;
      for (const downloadFile of ledgerFileListFromStorage) {
        currentFile++;
        onProgress?.({
          currentFile,
          totalFiles,
          currentFilename: downloadFile.filename,
        });
        
        filesDownloaded.push(downloadFile);
        const downloadResponse = await this.mstClient.downloadFile(downloadFile.filename);
        const blob = await downloadResponse.blobBody;
        if (!blob) {
          console.error(`Failed to download file: ${downloadFile.filename}`);
          continue; // Skip if blob is null
        }
        const file = await this.blobToFile(blob, downloadFile.filename);
        files.push(file);
      }
      return { files, filesDownloaded };
    }

    catch (error) {
      console.error('No Files to download in the File share', error);
      throw new Error('No Files to download in the File share');
    }
  }

  async blobToFile(blob: Blob, fileName: string): Promise<File> {
    const file = new File([blob], fileName, { type: blob.type });
    return file;
  }

}