import { Request, Response, Router } from 'express';
import { getStatesProvincesAndCountries } from './gazetteer';
import { toBoolean } from '@tubular/util';

export const router = Router();

router.get('/', (req: Request, res: Response) => {
  const plainText = toBoolean(req.query.pt, false, true);
  const response = [''];

  response.push(...getStatesProvincesAndCountries().map(nameAndCode => {
    if (nameAndCode)
      return `${nameAndCode.name} - ${nameAndCode.code}`;
    else
      return '   ---';
  }));

  if (plainText) {
    res.set('Content-Type', 'text/plain');
    response.push('');
    res.send(response.join('\n'));
  }
  else if (req.query.callback)
    res.jsonp(response);
  else
    res.send(response);
});
