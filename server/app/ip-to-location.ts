import { Request, Response, Router } from 'express';
import http from 'http';
import querystring from 'querystring';
import requestIp from 'request-ip';
import { notFound, notFoundForEverythingElse } from './common';
import { processMillis } from '@tubular/util';

export const router = Router();

const MAX_PER_MINUTE = 140;
const times: number[] = [];

router.get('/json/*', (req: Request, res: Response) => {
  const [url, paramStr] = req.url.split('?');
  const params = querystring.parse(paramStr);
  const $ = /^\/json(\/(.*))?$/.exec(url);

  if ($) {
    const now = processMillis();

    if (times.length === MAX_PER_MINUTE && times[0] > now - 60000) {
      if (params.callback)
        res.jsonp({ message: 'busy', status: 'fail' });
      else
        res.send({ message: 'busy', status: 'fail' });
    }
    else {
      times.push(now);

      if (times.length > MAX_PER_MINUTE) {
        times.shift();
      }

      let address = $[2];

      if (!address) {
        address = requestIp.getClientIp(req);

        if (address && /:/.test(address)) {
          address = encodeURIComponent(address);
        }
      }

      if (!address) {
        address = '';
      }

      const options = {
        hostname: 'ip-api.com',
        port: 80,
        path: '/json/' + address + (paramStr ? '?' + paramStr : ''),
        method: req.method,
        headers: req.headers
      };

      const proxy = http.request(options, function (res2) {
        res.writeHead(res2.statusCode, res2.headers);
        res2.pipe(res, {
          end: true
        });
      });

      req.pipe(proxy, {
        end: true
      });
    }
  }
  else {
    notFound(res);
  }
});

notFoundForEverythingElse(router);
