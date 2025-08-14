import {ShareClient } from '@azure/storage-file-share';
import type {LedgerFileInfo } from '../utils/ledger-validation';
import {parseLedgerFilename, validateLedgerSequence } from '../utils/ledger-validation';

export class AzureFileShareService {
  private shareClient: ShareClient | null = null;

  async initialize(sasUrl: string): Promise<void> {
    try {
      console.log('Initializing with SAS URL:', sasUrl.split('?')[0]); // Log URL without token
      this.shareClient = new ShareClient(sasUrl);
      
    } catch (error) {
      console.error('Initialization error:', error);
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
      console.log('Listing files in the "ledger" directory');
      for await (const entity of directoryClient.listFilesAndDirectories()) {
        if (entity.kind === 'directory') {
              continue; // Skip directories, we only want files
        } else if (entity.kind === "file" && entity.name.endsWith('.committed')) {
            files.push({
                ...parseLedgerFilename(entity.name)
          });
        }

      }

      // Sort files alphabetically
    // files.sort((a, b) => {
    //     const extractStartTran = (filename: string): number => {
    //         const match = filename.match(/^ledger_(\d+)-\d+\.committed$/);
    //         return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
    //     };

    //     return extractStartTran(a.name) - extractStartTran(b.name);
    //     });
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

  async downloadLedgerFiles(ledgerFile: LedgerFileInfo): Promise<{ files: File[]; filesDownloaded: LedgerFileInfo[]; }> {
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
        const directoryClient = this.shareClient.getDirectoryClient("ledger")
        const files: File[] = [];
        const filesDownloaded: LedgerFileInfo[] = [];
        for (const downloadFile of ledgerFileToDownloadFromStorage) 
        {
            filesDownloaded.push(downloadFile);
            console.log(`Downloading file: ${downloadFile.filename}`);
            const fileClient = directoryClient.getFileClient(downloadFile.filename);
            const downloadResponse = await fileClient.download(0);
            const blob = await downloadResponse.blobBody;
            if (!blob) {
                console.error(`Failed to download file: ${downloadFile.filename}`);
                continue; // Skip if blob is null
            }
            const file = await this.blobToString(blob, downloadFile.filename);
            //console.log("Downloaded file content:", text);
            // const chunks: Uint8Array[] = [];
            // const reader = downloadResponse.readableStreamBody?.getReader();

            // if (!reader) {
            //   console.error("No readable stream returned.");
            // }

            
            // let result = await reader.read();
            // while (!result.done) {
            // chunks.push(result.value);
            // result = await reader.read();
            // }

            // const blob = new Blob(chunks, { type: downloadResponse.contentType || "application/octet-stream" });
            files.push(file);

        }
        return { files, filesDownloaded };
    }

    catch (error) {
      console.error('No Files to download in the File share', error);
      throw new Error('No Files to download in the File share');
    }
  }


async blobToString(blob: Blob, fileName: string): Promise<File> {
    const file = new File([blob], fileName, { type: blob.type });
    return file;

}

}