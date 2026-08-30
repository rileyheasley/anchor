// Minimal ambient types for sql.js — the published package ships no .d.ts file.
declare module 'sql.js' {
  export interface Statement {
    bind(params?: unknown[] | Record<string, unknown>): boolean
    step(): boolean
    get(): unknown[]
    getAsObject(): Record<string, unknown>
    free(): boolean
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null)
    run(sql: string, params?: unknown[] | Record<string, unknown>): Database
    prepare(sql: string, params?: unknown[] | Record<string, unknown>): Statement
    export(): Uint8Array
    close(): void
  }

  export interface SqlJsStatic {
    Database: typeof Database
  }

  export interface SqlJsConfig {
    locateFile?: (file: string) => string
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>
}
