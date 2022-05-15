import { NextFunction, Request, Response, Router } from 'express';
import { isNil } from 'lodash';
import { createReadStream } from 'fs';

export const MIN_EXTERNAL_SOURCE = 100;
export const SOURCE_GEONAMES_POSTAL_UPDATE  = 101;
export const SOURCE_GEONAMES_GENERAL_UPDATE = 103;
export const SOURCE_GETTY_UPDATE = 104;

export function notFound(res: Response): void {
  res.status(403).send('Not found');
}

export function formatVariablePrecision(value: number, maxDecimals = 3): string {
  let result = value.toFixed(maxDecimals);

  if (result.substr(-1) === '0')
    result = result.replace(/\.?0+$/, '');

  return result;
}

export function notFoundForEverythingElse(router: Router): void {
  router.get('*', (req: Request, res: Response) => notFound(res));
}

// noinspection JSVoidFunctionReturnValueUsed
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => void) =>
  (req: Request, res: Response, next: NextFunction): Promise<void> =>
    Promise.resolve(fn(req, res, next)).catch(next);

export function eqci(s1: string, s2: string): boolean {
  return s1 === s2 || isNil(s1) && isNil(s2) || s1.localeCompare(s2, undefined, { usage: 'search', sensitivity: 'base' }) === 0;
}

export class PromiseTimeoutError extends Error {}

export function timedPromise<T>(promise: Promise<T>, maxTime: number, errorResponse?: any): Promise<T> {
  if (typeof errorResponse === 'string')
    errorResponse = new PromiseTimeoutError(errorResponse);

  const timer = new Promise<T>((resolve, reject) => setTimeout(() => reject(errorResponse), maxTime));

  return Promise.race([promise, timer]);
}

export async function getFileContents(path: string, encoding?: string): Promise<string> {
  if (!encoding)
    encoding = 'utf8';

  return new Promise<string>((resolve, reject) => {
    const input = createReadStream(path, { encoding: encoding as any });
    let content = '';

    input.on('error', err => {
      reject(new Error(`Error reading ${path}: ${err.toString()}`));
    });
    input.on('data', (data: Buffer) => {
      content += data.toString(encoding as any);
    });
    input.on('end', () => {
      input.close();
      resolve(content);
    });
  });
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getRemoteAddress(req: Request): string {
  return (req.headers['x-real-ip'] as string) || req.connection.remoteAddress;
}
