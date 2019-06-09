import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { initTimeZoneLargeAlt } from 'ks-date-time-zone/dist/ks-timezone-large-alt';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

initTimeZoneLargeAlt();

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.log(err));
