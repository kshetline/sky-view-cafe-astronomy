/* eslint-disable n/no-deprecated-api */
// noinspection JSDeprecatedSymbols

import { Request, Response, Router } from 'express';
import https from 'https';
// eslint-disable-next-line n/no-deprecated-api
import { parse as parseUrl } from 'url';
import { asyncHandler, escapeRegExp, getRemoteAddress, notFound, notFoundForEverythingElse } from './common';
import { getPublicIp } from './public-ip';
import { requestText } from 'by-request';
import { processMillis } from '@tubular/util';

export const router = Router();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
let fakeApiKey = GOOGLE_API_KEY;
const scramble = 'LX-IlYd0ZRQsij6eCO3cxFhk5bpNMq1a2SrPoV_9Et7mAywGfBnuJvWzHTg8DKU4';

if (GOOGLE_API_KEY && GOOGLE_API_KEY.length > 3) {
  fakeApiKey = GOOGLE_API_KEY.substr(0, 3);

  for (let i = 3; i < GOOGLE_API_KEY.length; ++i) {
    const cc = GOOGLE_API_KEY.charCodeAt(i);
    let index;

    if (cc === 45)
      index = 62;
    else if (cc === 95)
      index = 63;
    else if (cc < 65)
      index = cc + 4;
    else if (cc < 97)
      index = cc - 64;
    else
      index = cc - 71;

    fakeApiKey += scramble.charAt(index);
  }
}

const ADDED_CLIENT_MAPS_SCRIPT = `
function setSvcMapsApiKey(k) {
  var s = '${scramble}';
  window.svcOrigKey = k;
  window.svcModKey = k.substr(0, 3);

  for (var i = 3; i < k.length; ++i) {
    var c = k.charAt(i);
    var n = s.indexOf(c);

    if (n >= 0) {
      if (n < 26)
        c = String.fromCharCode(n + 64);
      else if (n < 52)
        c = String.fromCharCode(n + 71);
      else if (n < 62)
        c = String.fromCharCode(n - 4);
      else if (n === 62)
        c = '-';
      else
        c = '_';
    }

    window.svcModKey += c;
  }

  return window.svcModKey;
}`.replace(/\n+/g, ' ').replace(/ +/g, ' ').replace(/(\W) (?=\w)/g, '$1').replace(/(.) (?=\W)/g, '$1').trim();

const authorizedIps: Record<string, number> = {};
const ALLOWED_IP_AGE = 7200000; // two hours
const MAX_AUTHORIZATION_DELAY = 30000; // half minute

router.get('/script/', asyncHandler(async (req: Request, res: Response) => {
  const url = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&callback=initGoogleMaps`;
  let script = await requestText(url);

  script = script.replace(new RegExp(`['"]${GOOGLE_API_KEY}['"]`, 'g'), `setSvcMapsApiKey('${fakeApiKey}')`).trim();
  script += '\n' + ADDED_CLIENT_MAPS_SCRIPT;

  res.set('Content-Type', 'text/javascript');
  res.send(script);
}));

router.get('/proxy*', asyncHandler(async (req: Request, res: Response) => {
  if (!(await isAuthorized(req))) {
    res.status(401).send('Not authorized');
    return;
  }

  let url = req.originalUrl;
  const $ = /^\/maps\/proxy(.*)$/.exec(url);

  if ($)
    url = `https://maps.googleapis.com${$[1]}`;
  else {
    notFound(res);
    return;
  }

  maintainAuthorizedIps();

  url = url.replace(new RegExp(escapeRegExp(fakeApiKey), 'g'), GOOGLE_API_KEY);

  const options = parseUrl(url);
  const publicIp = await getPublicIp();
  const referer = `https://${publicIp}/`;

  (options as any).headers = {
    'user-agent': req.headers['user-agent'],
    referer
  };

  const proxy = https.request(options, function (res2) {
    res.writeHead(res2.statusCode, res2.headers);
    res2.pipe(res, {
      end: true
    });
  });

  req.pipe(proxy, {
    end: true
  });
}));

router.get('/ping/', (req: Request, res: Response) => {
  const remoteAddr = getRemoteAddress(req);

  if (remoteAddr)
    authorizedIps[remoteAddr] = processMillis();

  if (req.query.callback)
    res.jsonp('ok');
  else
    res.json('ok');

  maintainAuthorizedIps();
});

async function isAuthorized(req: Request): Promise<boolean> {
  const remoteAddr = getRemoteAddress(req);

  if (authorizedIps[remoteAddr])
    return Promise.resolve(true);

  return new Promise(resolve => {
    const start = processMillis();
    const checkInterval = setInterval(() => {
      if (authorizedIps[remoteAddr]) {
        clearInterval(checkInterval);
        resolve(true);
      }
      else if (processMillis() > start + MAX_AUTHORIZATION_DELAY) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, 50);
  });
}

function maintainAuthorizedIps(): void {
  const now = processMillis();
  const ips = Object.keys(authorizedIps);

  ips.forEach(ip => {
    const time = authorizedIps[ip];

    if (now > time + ALLOWED_IP_AGE)
      delete authorizedIps[ip];
  });
}

notFoundForEverythingElse(router);
