import { toBoolean } from '@tubular/util';
import { Request, Response, Router } from 'express';
import { requestText } from 'by-request';
import { asyncHandler } from './common';

export const router = Router();

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const plainText = toBoolean(req.query.pt, false, true);
  const homePage = await requestText('https://github.com/evansiroky/timezone-boundary-builder/');
  let data = (/<img.*src="([^>]+\d{4}[a-z]{1,3}\.png)/i.exec(homePage) || [])[1];

  if (data)
    data = 'https://github.com' + data;

  if (plainText) {
    res.set('Content-Type', 'text/plain');
    res.send(JSON.stringify(data));
  }
  else if (req.query.callback)
    res.jsonp(data);
  else
    res.json(data);
}));
