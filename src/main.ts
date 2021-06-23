import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { initTimezoneLargeAlt, pollForTimezoneUpdates, zonePollerBrowser } from '@tubular/time';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

initTimezoneLargeAlt(true);
pollForTimezoneUpdates(zonePollerBrowser, 'large-alt');

if (environment.production)
  enableProdMode();

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.log(err));
