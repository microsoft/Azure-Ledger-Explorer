// IndexedDB service for verification checkpointing

import type { VerificationCheckpoint } from '../types/verification-types';

class VerificationCheckpointService {
  private dbName = 'CCFVerificationCheckpoints';
  private dbVersion = 1;
  private storeName = 'checkpoints';
  private db: IDBDatabase | null = null;

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create checkpoints store
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
      };
    });
  }

  /**
   * Save a checkpoint to IndexedDB
   */
  async saveCheckpoint(checkpoint: VerificationCheckpoint): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(checkpoint);

      request.onerror = () => {
        reject(new Error(`Failed to save checkpoint: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Get the latest checkpoint for a session
   */
  async getLatestCheckpoint(sessionId: string): Promise<VerificationCheckpoint | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(sessionId);

      request.onerror = () => {
        reject(new Error(`Failed to get checkpoint: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve(request.result || null);
      };
    });
  }

  /**
   * Get all checkpoints, sorted by timestamp
   */
  async getAllCheckpoints(): Promise<VerificationCheckpoint[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      const request = index.getAll();

      request.onerror = () => {
        reject(new Error(`Failed to get all checkpoints: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        const checkpoints = request.result.sort((a, b) => b.timestamp - a.timestamp);
        resolve(checkpoints);
      };
    });
  }

  /**
   * Delete a checkpoint
   */
  async deleteCheckpoint(sessionId: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(sessionId);

      request.onerror = () => {
        reject(new Error(`Failed to delete checkpoint: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Clear all checkpoints
   */
  async clearAllCheckpoints(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => {
        reject(new Error(`Failed to clear checkpoints: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Check if there's a failed checkpoint that blocks resumption
   */
  async hasFailedCheckpoint(sessionId: string): Promise<boolean> {
    const checkpoint = await this.getLatestCheckpoint(sessionId);
    return checkpoint?.status === 'fail';
  }

  /**
   * Check if there's a checkpoint that can be resumed (stopped or pass, but not fail)
   */
  async canResumeFromCheckpoint(sessionId: string): Promise<boolean> {
    const checkpoint = await this.getLatestCheckpoint(sessionId);
    return checkpoint?.status === 'stopped' || checkpoint?.status === 'pass';
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Export a singleton instance
export const checkpointService = new VerificationCheckpointService();
