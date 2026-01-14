/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import {ShareClient } from '@azure/storage-file-share';
import type {LedgerFileInfo } from '../utils/ledger-validation';
import {parseLedgerFilename, validateLedgerSequence } from '../utils/ledger-validation';

export interface DownloadProgress {
  currentFile: number;
  totalFiles: number;
  currentFilename: string;
}

export class AzureFileShareService {
  private shareClient: ShareClient | null = null;

  async initialize(sasUrl: string): Promise<void> {
    try {
      this.shareClient = new ShareClient(sasUrl);
    } catch (error) {
      console.error('Failed to initialize Azure file share client:', error);
      throw new Error(
        'Failed to initialize file share client. Please ensure your SAS token is valid and has Read/List permissions.'
      );
    }
  }

  async listLedgerFiles(): Promise<LedgerFileInfo[]> {
    if (!this.shareClient) {
      throw new Error('File share client not initialized');
    }

    try {
      const directoryClient = this.shareClient.getDirectoryClient("ledger");
      const files: LedgerFileInfo[] = [];

      // List only files in the "ledger" directory
      for await (const entity of directoryClient.listFilesAndDirectories()) {
        if (entity.kind === 'directory') {
              continue; // Skip directories, we only want files
        } else if (entity.kind === "file" && entity.name.endsWith('.committed')) {
            files.push({
                ...parseLedgerFilename(entity.name)
          });
        }

      }

    const validation = validateLedgerSequence([], files);
    if (validation.isValid) {
      return validation.sortedFiles;
    }
    else
    {
        return [];
    }

    } catch (error) {
      console.error('No Directory named ledger present in the File share', error);
      throw new Error('No Directory named ledger present in the File share');
    }
  }

  async downloadLedgerFiles(
    ledgerFile: LedgerFileInfo,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<{ files: File[]; filesDownloaded: LedgerFileInfo[]; }> {
    if (!this.shareClient) {
      throw new Error('File share client not initialized');
    }

    try 
    {
        const ledgerFileListFromStorage= await this.listLedgerFiles();
        if (ledgerFileListFromStorage.length === 0) {
            throw new Error('No ledger files found in the file share');
        }
        // Filter for files to download from storage
        const ledgerFileToDownloadFromStorage = ledgerFileListFromStorage.filter(file => file.endNo<=ledgerFile.endNo);
        const totalFiles = ledgerFileToDownloadFromStorage.length;
        const directoryClient = this.shareClient.getDirectoryClient("ledger")
        const files: File[] = [];
        const filesDownloaded: LedgerFileInfo[] = [];
        let currentFile = 0;
        for (const downloadFile of ledgerFileToDownloadFromStorage) 
        {
            currentFile++;
            onProgress?.({
                currentFile,
                totalFiles,
                currentFilename: downloadFile.filename,
            });
            
            filesDownloaded.push(downloadFile);
            const fileClient = directoryClient.getFileClient(downloadFile.filename);
            const downloadResponse = await fileClient.download(0);
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