import { Request, Response, Router } from 'express';
import auth from 'basic-auth';
import { existsSync } from 'fs';
import { join as pathJoin } from 'path';
import { asyncHandler, getFileContents } from './common';

export const router = Router();

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const user = auth(req);

  if (!user || !process.env.DB_PWD || user.name !== 'admin' || user.pass !== process.env.DB_PWD) {
    res.set('WWW-Authenticate', 'Basic realm="skyviewcafe.com"');
    res.status(401).send('Not authorized');
    return;
  }

  res.set('Content-Type', 'text/plain');

  if (process.env.SVC_API_LOG) {
    const path = pathJoin(__dirname, process.env.SVC_API_LOG);

    if (existsSync(path)) {
      try {
        res.send(await getFileContents(path, 'utf8'));
      }
      catch (err) {
        res.send('Error reading log file.');
      }
    }
    else
      res.send('Log file not present.');
  }
  else
    res.send('Log file not defined.');
}));
