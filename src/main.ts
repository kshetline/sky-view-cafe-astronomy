import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { environment } from './environments/environment';

import * as tbABR from '@tubular/array-buffer-reader';
import * as tbMath from '@tubular/math';
import * as tbTime from '@tubular/time';
import * as tbUtil from '@tubular/util';

(window as any)['@tubular/array-buffer-reader'] = tbABR;
(window as any)['@tubular/math'] = tbMath;
(window as any)['@tubular/time'] = tbTime;
(window as any)['@tubular/util'] = tbUtil;

import('./app/app.module').then(pkg => {
  tbTime.initTimezoneLargeAlt(true);
  tbTime.pollForTimezoneUpdates(tbTime.zonePollerBrowser, 'large-alt');

  if (environment.production)
    enableProdMode();

  platformBrowserDynamic().bootstrapModule(pkg.AppModule)
    .catch(err => console.log(err));
});
