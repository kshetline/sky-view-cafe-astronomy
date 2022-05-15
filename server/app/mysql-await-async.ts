/* eslint-disable n/no-deprecated-api */
// noinspection JSDeprecatedSymbols

import mysql, {
  FieldInfo, MysqlError, PoolConnection as _PoolConnection, QueryOptions, Pool as _Pool, PoolConfig } from 'mysql';
import { parse as parseUrl } from 'url';

export interface FullQueryResults {
  err: MysqlError | null;
  results: any;
  fields: FieldInfo[];
}

export class Pool {
  private _pool: _Pool;
  private readonly dbName: string;

  constructor(config: PoolConfig | string, private consoleLogErrors = true) {
    this._pool = mysql.createPool(config);

    if (typeof config === 'string')
      this.dbName = parseUrl(config).path;
    else
      this.dbName = config.database;
  }

  getConnection(): Promise<PoolConnection> {
    return new Promise<PoolConnection>((resolve, reject) => {
      this._pool.getConnection((err, connection) => {
        if (err) {
          this.logError(err);
          reject(err);
        }
        else
          resolve(new PoolConnection(connection, this));
      });
    });
  }

  on(ev: 'acquire' | 'connection' | 'release', callback: (connection: PoolConnection) => void): Pool;
  on(ev: 'error', callback: (err: MysqlError) => void): Pool;
  on(ev: 'enqueue', callback: (err?: MysqlError) => void): Pool;
  on(ev: string, callback: (...args: any[]) => void): Pool {
    this._pool.on(ev, (...args: any[]) => {
      if (ev === 'error')
        this.logError(args[0]);

      if (args[0] && /^(acquire|connection|release)$/.test(ev))
        callback(new PoolConnection(args[0]));
      else
        // eslint-disable-next-line n/no-callback-literal
        callback(...args);
    });

    return this;
  }

  query(sqlStringOrOptions: string | QueryOptions, values?: any): Promise<FullQueryResults> {
    return new Promise<FullQueryResults>(resolve => {
      const args = typeof sqlStringOrOptions === 'string' ?
        [sqlStringOrOptions, values] : [sqlStringOrOptions];

      (this._pool.query as any)(...args, (err: MysqlError, results: any, fields: FieldInfo[]) => {
        this.logError(err);
        resolve({ err, results, fields });
      });
    });
  }

  queryResults(sqlStringOrOptions: string | QueryOptions, values?: any): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const args = typeof sqlStringOrOptions === 'string' ?
        [sqlStringOrOptions, values] : [sqlStringOrOptions];

      (this._pool.query as any)(...args, (err: MysqlError, results: any) => {
        if (err) {
          this.logError(err);
          reject(err);
        }
        else
          resolve(results);
      });
    });
  }

  logError(err: MysqlError): void {
    if (err && this.consoleLogErrors) {
      const name = this.dbName ? ` "${this.dbName}"` : '';

      if (err.code === 'PROTOCOL_CONNECTION_LOST')
        console.error(`Database${name} connection was closed.`);
      else if (err.code === 'ER_CON_COUNT_ERROR')
        console.error(`Database${name} has too many connections.`);
      else if (err.code === 'ECONNREFUSED')
        console.error(`Database${name} connection was refused.`);
      else if (err.code === 'ENOTFOUND')
        console.error(`Address ${(err as any).host} for database${name} not found.`);
      else
        console.error(`Database${name} error: ${err.code}`);
    }
  }
}

export class PoolConnection {
  constructor(private connection: _PoolConnection, private parent?: Pool) { }

  query(sqlStringOrOptions: string | QueryOptions, values?: any): Promise<FullQueryResults> {
    return new Promise<FullQueryResults>(resolve => {
      const args = typeof sqlStringOrOptions === 'string' ?
        [sqlStringOrOptions, values] : [sqlStringOrOptions];

        (this.connection.query as any)(...args, (err: MysqlError, results: any, fields: FieldInfo[]) => {
          this.logError(err);
          resolve({ err, results, fields });
        });
    });
  }

  queryResults(sqlStringOrOptions: string | QueryOptions, values?: any): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const args = typeof sqlStringOrOptions === 'string' ?
        [sqlStringOrOptions, values] : [sqlStringOrOptions];

      (this.connection.query as any)(...args, (err: MysqlError, results: any) => {
        if (err) {
          this.logError(err);
          reject(err);
        }
        else
          resolve(results);
      });
    });
  }

  release(): void {
    this.connection.release();
  }

  private logError(err: MysqlError): void {
    if (err && this.parent)
      this.parent.logError(err);
  }
}
