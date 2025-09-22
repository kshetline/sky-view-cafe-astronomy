import { enableProdMode, importProvidersFrom } from '@angular/core';

import { initTimezoneLargeAlt, pollForTimezoneUpdates, zonePollerBrowser } from '@tubular/time';

import { environment } from './environments/environment';
import { AppService } from './app/app.service';
import { AstroDataService } from './app/astronomy/astro-data.service';
import { ConfirmationService, SharedModule } from 'primeng/api';
import { DatePipe } from '@angular/common';
import { JpegCommentReader } from './app/util/ks-read-jpeg-comment';
import { KsTimeService } from './app/util/ks-time.service';
import { SvcAtlasService } from './app/svc/svc-atlas.service';
import { providePrimeNG } from 'primeng/config';
import { ColorScale, definePreset, palette } from '@primeng/themes';
import { provideHttpClient, withInterceptorsFromDi, withJsonpSupport } from '@angular/common/http';
import { AppRoutingModule } from './app/app-routing.module';
import { BlockUIModule } from 'primeng/blockui';
import { provideAnimations } from '@angular/platform-browser/animations';
import { bootstrapApplication } from '@angular/platform-browser';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { MessageModule } from 'primeng/message';
import { PanelModule } from 'primeng/panel';
import { PopoverModule } from 'primeng/popover';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SelectModule } from 'primeng/select';
import { SliderModule } from 'primeng/slider';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { AppComponent } from './app/app.component';
import Aura from '@primeng/themes/aura';

const AuraSky = definePreset(Aura, {
  semantic: {
    primary: palette('{sky}') as ColorScale
  }
});

initTimezoneLargeAlt(true);
pollForTimezoneUpdates(zonePollerBrowser, 'large-alt');

if (environment.production)
  enableProdMode();

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(
      AppRoutingModule, BlockUIModule, ButtonModule, CheckboxModule, ConfirmDialogModule, DialogModule, FormsModule, InputTextModule,
      MenuModule, MessageModule, MessageModule, PanelModule, PopoverModule, RadioButtonModule, SelectModule, SharedModule, SliderModule, TableModule,
      TabsModule, ToastModule, TooltipModule
    ),
    AppService,
    AstroDataService,
    ConfirmationService,
    DatePipe,
    JpegCommentReader,
    KsTimeService,
    SvcAtlasService,
    providePrimeNG({ theme: { preset: AuraSky } }),
    provideHttpClient(withInterceptorsFromDi(), withJsonpSupport()),
    provideAnimations()
  ]
})
  .catch(err => console.log(err));
