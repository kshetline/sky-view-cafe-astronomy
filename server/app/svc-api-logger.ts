import rfs from 'rotating-file-stream';
import { join as pathJoin } from 'path';
import stream, { Writable } from 'stream';
import fs, { WriteStream } from 'fs';
import { Request, Response } from 'express';
import * as util from 'util';
import { formatDateTime, zeroPad } from '@tubular/util';

export let svcApiLogStream: Writable | WriteStream = process.stdout;

const INTERVAL_DAYS = 7;
const MAX_FILES = 10;

if (process.env.SVC_API_LOG) {
  const options: any = {
    interval: INTERVAL_DAYS + 'd',
    maxFiles: MAX_FILES,
    maxSize: '256K',
    rotationTime: true
  };
  const fullLogPath = pathJoin(__dirname, process.env.SVC_API_LOG);
  const intervalMillis = INTERVAL_DAYS * 86400000;
  let logPath: string;
  let logFile = fullLogPath;
  let ext = '';
  let separator = '';
  let $ = /(.*)([/\\])(.+)/.exec(logFile);

  if ($) {
    logPath = $[1];
    separator = $[2];
    logFile = $[3];

    if (logPath)
      options.path = logPath;
  }

  let logCreation = fs.existsSync(logPath) && fs.statSync(logPath).mtimeMs;

  if (($ = /(.*)(\..*)/.exec(logFile))) {
    logFile = $[1];
    ext = $[2];
  }

  const fileName = (time: Date, index: number): string => {
    if (!time)
      return logFile + ext;
    else {
      const date = new Date(+time - time.getTimezoneOffset() * 60000);

      return `${logFile}-${date.toISOString().substr(0, 10)}_${zeroPad(index, 2)}${ext}`;
    }
  };

  let fileStream = (rfs as any)(fileName, options);

  svcApiLogStream = new stream.Writable();
  svcApiLogStream._write = async (chunk: any, encoding: string, done: (error?: Error) => void): Promise<void> => {
    // rotating-file-stream isn't doing as complete a job as I'd hope for in rotating file names
    // and cleaning up files, so the code below takes over some of that work.
    const now = Date.now();
    let checkMaxFiles = false;

    if (logCreation && now > logCreation + intervalMillis) {
      const nowDate = new Date(now);
      let index = 0;
      let datedFilePath: string;

      do {
        datedFilePath = logPath + separator + fileName(nowDate, index++);
      } while (fs.existsSync(datedFilePath));

      if (fileStream.close)
        fileStream.close();
      else if (fileStream.end) {
        await new Promise<void>(resolve => {
          fileStream.end(() => resolve());
        });
      }

      logCreation = now;
      fs.renameSync(fullLogPath, datedFilePath);
      fileStream = (rfs as any)(fileName, options);
      checkMaxFiles = true;
    }

    let output: any;

    if (chunk instanceof Buffer) {
      try {
        output = chunk.toString((encoding === 'buffer' ? 'utf8' : encoding) as any);
      }
      catch (err) {
        // Unknown encoding?
        output = chunk.toString('utf8');
      }
    }
    else
      output = chunk.toString();

    try {
      fileStream.write(output, () => {
        if (checkMaxFiles) {
          const files = fs.readdirSync(logPath).sort().filter(name => name.startsWith(logFile + '-'));

          while (files.length > MAX_FILES - 1) {
            fs.unlinkSync(logPath + separator + files[0]);
            files.splice(0, 1);
          }
        }
      });
    }
    catch (err) { /* ignore errors writing to log file */ }

    process.stdout.write(output);
    done();
  };
}

// Only log requests that are for SVC API calls, not for static files pulled from the "public" folder.
export function svcApiSkipFilter(req: Request, _res: Response): boolean {
  return !/^\/?(atlas|atlasdb|ip|maps|states|timeservices|zoneloc)(\/|\?|$)/.test(req.baseUrl) ||
    (req.baseUrl === '/maps' && !/^\/ping(\/|$)/.test(req.url));
}

function argsToString(...args: any[]): string {
  let result = '';

  if (args.length > 0)
    result += ': ' + util.format(args[0], ...(args.splice(1)));

  return result + '\n';
}

export function getLogDate(): string {
  return formatDateTime(new Date()) + ' - ';
}

class SvcApiConsole {
  assert(assertion: boolean, ...args: any[]): void {
    if (!assertion) {
      this.error(...args);
      this.trace();
    }
  }

  // noinspection JSMethodCanBeStatic
  debug(...args: any): void {
    svcApiLogStream.write(getLogDate() + 'DEBUG' + argsToString(...args));
  }

  // noinspection JSMethodCanBeStatic
  error(...args: any): void {
    svcApiLogStream.write(getLogDate() + 'ERROR' + argsToString(...args));
  }

  // noinspection JSMethodCanBeStatic
  info(...args: any): void {
    svcApiLogStream.write(getLogDate() + 'INFO' + argsToString(...args));
  }

  // noinspection JSMethodCanBeStatic
  log(...args: any): void {
    svcApiLogStream.write(getLogDate() + 'LOG' + argsToString(...args));
  }

  // noinspection JSMethodCanBeStatic
  trace(): void {
    let stack = '';

    try {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('');
    }
    catch (err) {
      stack = err.stack || '';
    }

    const lines = stack.split('\n');

    svcApiLogStream.write(getLogDate() + 'TRACE:\n' + lines.splice(2).join('\n'));
  }

  // noinspection JSMethodCanBeStatic
  warn(...args: any): void {
    svcApiLogStream.write(getLogDate() + 'WARN' + argsToString(...args));
  }
}

export const svcApiConsole = new SvcApiConsole();

if (!(process.hrtime as any).bigint)
  svcApiConsole.warn('Environment does not support process.hrtime.bigint');
