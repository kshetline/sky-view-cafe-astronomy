import { Request, Response, Router } from 'express';
import { readdir } from 'fs/promises';
import { join as pathJoin } from 'path';
import { asyncHandler } from './common';

export const router = Router();

const SVC_DIR_PATH_MOD = process.env.SVC_DIR_PATH_MOD || 'public';

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const dir = pathJoin(__dirname, SVC_DIR_PATH_MOD, req.baseUrl);
  const files = await readdir(dir);
  let content = '';

  res.set('Content-Type', 'text/html');

  for (const file of files) {
    if (!file.startsWith('.'))
      content += `<a href=${req.baseUrl}/${file}>${file}</a><br>\n`;
  }

  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>${req.baseUrl}</title>
</head>
<body>
${content}
</body>
</html>
`);
}));
