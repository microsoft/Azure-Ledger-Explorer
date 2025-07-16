// Type declarations for sql.js when types are not available
declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: DatabaseConstructor;
  }

  export interface DatabaseConstructor {
    new(): Database;
    new(data?: ArrayLike<number>): Database;
  }

  export interface Database {
    run(sql: string, params?: unknown[]): void;
    exec(sql: string, params?: unknown[]): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export interface Statement {
    run(params?: unknown[]): void;
    step(): boolean;
    get(params?: unknown[]): unknown[];
    getColumnNames(): string[];
    bind(values?: unknown[]): boolean;
    reset(): boolean;
    freemem(): void;
    free(): boolean;
  }

  export interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }

  export interface SqlJsConfig {
    locateFile?: (filename: string) => string;
  }

  function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
  export default initSqlJs;
}
