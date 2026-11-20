import mysql from "mysql2/promise";
import { mysqlOptions } from "@/lib/mysql-options.mjs";
let pool: mysql.Pool | undefined;
/** Placeholder values accepted by mysql2's execute(). */
type SqlValues = Parameters<mysql.Pool["execute"]>[1];
export function getPool() {
  return (pool ??= mysql.createPool({
    ...mysqlOptions(),
    connectionLimit: 2,
    maxIdle: 1,
    idleTimeout: 60000,
    waitForConnections: true,
    queueLimit: 20,
  }));
}
class Statement {
  constructor(
    public sql: string,
    public values: unknown[] = [],
  ) {}
  bind(...values: unknown[]) {
    return new Statement(this.sql, values);
  }
  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return (await this.all<T>()).results[0] ?? null;
  }
  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    const [rows] = await getPool().execute(this.sql, this.values as SqlValues);
    return { results: rows as T[] };
  }
  async run() {
    const [r] = await getPool().execute(this.sql, this.values as SqlValues);
    return { meta: { changes: (r as mysql.ResultSetHeader).affectedRows } };
  }
}
export const database = {
  prepare: (sql: string) => new Statement(sql),
  async batch(statements: Statement[]) {
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const results = [];
      for (const s of statements) {
        const [r] = await connection.execute(s.sql, s.values as SqlValues);
        results.push(r);
      }
      await connection.commit();
      return results;
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },
};
