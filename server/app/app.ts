import express, { Application, Request, Response } from 'express';
import serveIndex from 'serve-index';
import morgan from 'morgan';
import { join as pathJoin } from 'path';

import { router as atlasRouter, initAtlas } from './atlas';
import { router as stateRouter } from './states';
import { router as ipToLocationRouter } from './ip-to-location';
import { router as logRouter } from './log-access';
import { router as zoneRouter } from './zone-for-location';
import { router as mapsRouter } from './maps-api';
import { initTimezoneLargeAlt } from '@tubular/time';
import { svcApiConsole, svcApiLogStream, svcApiSkipFilter } from './svc-api-logger';
import { formatDateTime } from '@tubular/util';
import { getPublicIp } from './public-ip';

initTimezoneLargeAlt();

const app: Application = express();
const port = process.env.PORT || 80;

app.use(morgan((tokens, req, res) => {
  // If we're running node as an extension under Apache/nginx, the above IP address will
  // probably always be localhost. `x-real-ip` should provide the original remote address.
  const remoteAddr = tokens.req(req, res, 'x-real-ip') || tokens['remote-addr'](req, res);

  return [
    formatDateTime(),
    '- REQ:',
    remoteAddr,
    '"' + tokens.method(req, res),
    tokens.url(req, res),
    'HTTP/' + tokens['http-version'](req, res) + '"',
    tokens.status(req, res),
    tokens['response-time'](req, res), 'ms -',
    tokens.res(req, res, 'content-length')
  ].join(' ');
}, {
  skip: svcApiSkipFilter,
  stream: svcApiLogStream
}));

app.use('/atlas/', atlasRouter);
app.use('/atlasdb/atlas/', atlasRouter); // Legacy Tomcat path
app.use('/states/', stateRouter);
app.use('/atlasdb/states/', stateRouter); // Legacy Tomcat path
app.use('/ip/', ipToLocationRouter);
app.use('/log/', logRouter);
app.use('/zoneloc/', zoneRouter);
app.use('/timeservices/zoneloc/', zoneRouter); // Legacy Tomcat path
app.use('/maps/', mapsRouter);
app.use(express.static('../public'));
// Make the flags folder browsable.
app.use('/assets/resources/flags/', serveIndex(pathJoin(__dirname, '../../public/assets/resources/flags/')));
app.get('/', (req: Request, res: Response) => {
  res.send('Static home file not found');
});

(async (): Promise<void> => {
  try {
    await initAtlas();

    app.listen(port, () => {
      svcApiConsole.log(`Sky View Café listening on port ${port}.`);
      getPublicIp();
    });
  }
  catch (err) {
    svcApiConsole.error('Sky View Café failed to start');
    process.exit(1);
  }
})();
