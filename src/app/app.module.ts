/*
  Copyright © 2017-2018 Kerry Shetline, kerry@shetline.com.

  This code is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This code is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this code.  If not, see <http://www.gnu.org/licenses/>.

  For commercial, proprietary, or other uses not compatible with
  GPL-3.0-or-later, terms of licensing for this code may be
  negotiated by contacting the author, Kerry Shetline, otherwise all
  other uses are restricted.
*/

import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { DatePipe } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HttpClientJsonpModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { FlexLayoutModule } from '@angular/flex-layout';

import { NgBusyModule, BusyConfig } from 'ng-busy';

import { BlockUIModule } from 'primeng/blockui';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService } from 'primeng/components/common/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { GrowlModule } from 'primeng/growl';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { PanelModule } from 'primeng/panel';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SharedModule } from 'primeng/shared';
import { SliderModule } from 'primeng/slider';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { TooltipModule } from 'primeng/tooltip';

import { AppComponent } from './app.component';
import { AppService } from './app.service';
import { AstroDataService } from './astronomy/astro-data.service';
import { JpegCommentReader } from './util/ks-read-jpeg-comment';
import { KsTimeService } from './util/ks-time.service';
import { KsCalendarComponent } from './widgets/ks-calendar/ks-calendar.component';
import { KsCheckboxComponent } from './widgets/ks-checkbox/ks-checkbox.component';
import { KsDropdownComponent } from './widgets/ks-dropdown/ks-dropdown.component';
import { KsIconButtonComponent } from './widgets/ks-icon-button/ks-icon-button.component';
import { KsMarqueeComponent } from './widgets/ks-marquee/ks-marquee.component';
import { KsSequenceEditorComponent } from './widgets/ks-sequence-editor/ks-sequence-editor.component';
import { KsTabComponent } from './widgets/ks-tab/ks-tab.component';
import { KsTabViewComponent } from './widgets/ks-tab-view/ks-tab-view.component';
import { SvcAngleEditorComponent } from './svc/svc-angle-editor.component';
import { SvcAtlasDialogComponent } from './svc/svc-atlas-dialog/svc-atlas-dialog.component';
import { SvcAtlasService } from './svc/svc-atlas.service';
import { SvcCalendarViewComponent } from './svc/svc-calendar-view/svc-calendar-view.component';
import { SvcCalendarViewOptionsComponent } from './svc/svc-calendar-view/svc-calendar-view-options.component';
import { SvcChangeLocationDialogComponent } from './svc/svc-change-location-dialog/svc-change-location-dialog.component';
import { SvcDateEditorComponent } from './svc/svc-date-editor.component';
import { SvcEclipticViewComponent } from './svc/svc-ecliptic-view/svc-ecliptic-view.component';
import { SvcEclipticViewOptionsComponent } from './svc/svc-ecliptic-view/svc-ecliptic-view-options.component';
import { SvcEventNavigatorComponent } from './svc/svc-event-navigator/svc-event-navigator.component';
import { SvcInsolationViewComponent } from './svc/svc-insolation-view/svc-insolation-view.component';
import { SvcInsolationViewOptionsComponent } from './svc/svc-insolation-view/svc-insolation-view-options.component';
import { SvcLocationSettingsComponent } from './svc/svc-location-settings/svc-location-settings.component';
import { SvcMapViewComponent } from './svc/svc-map-view/svc-map-view.component';
import { SvcMapViewOptionsComponent } from './svc/svc-map-view/svc-map-view-options.component';
import { SvcMoonsViewComponent } from './svc/svc-moons-view/svc-moons-view.component';
import { SvcMoonsViewOptionsComponent } from './svc/svc-moons-view/svc-moons-view-options.component';
import { SvcOptionsPanelComponent } from './svc/svc-options-panel/svc-options-panel.component';
import { SvcOrbitViewComponent } from './svc/svc-orbit-view/svc-orbit-view.component';
import { SvcOrbitViewOptionsComponent } from './svc/svc-orbit-view/svc-orbit-view-options.component';
import { SvcPreferencesDialogComponent } from './svc/svc-preferences-dialog/svc-preferences-dialog.component';
import { SvcSkyViewComponent } from './svc/svc-sky-view/svc-sky-view.component';
import { SvcSkyViewOptionsComponent } from './svc/svc-sky-view/svc-sky-view-options.component';
import { SvcTableViewComponent } from './svc/svc-table-view/svc-table-view.component';
import { SvcTableViewOptionsComponent } from './svc/svc-table-view/svc-table-view-options.component';
import { SvcTimeEditorComponent } from './svc/svc-time-editor.component';
import { SvcTimeViewComponent } from './svc/svc-time-view/svc-time-view.component';
import { SvcZoneSelectorComponent } from './svc/svc-zone-selector/svc-zone-selector.component';

import { AppRoutingModule } from './app-routing.module';

export function busyConfigFactory(): BusyConfig {
  return new BusyConfig({
     delay: 500,
     minDuration: 250
  });
}

@NgModule({
  imports: [
    AppRoutingModule,
    BlockUIModule,
    BrowserAnimationsModule,
    BrowserModule,
    ButtonModule,
    CheckboxModule,
    ConfirmDialogModule,
    DialogModule,
    DropdownModule,
    FlexLayoutModule,
    FormsModule,
    GrowlModule,
    HttpClientModule,
    HttpClientJsonpModule,
    InputTextModule,
    MenuModule,
    NgBusyModule,
    OverlayPanelModule,
    PanelModule,
    RadioButtonModule,
    SharedModule,
    SliderModule,
    TableModule,
    TabViewModule,
    TooltipModule
  ],
  declarations: [
    AppComponent,
    KsCalendarComponent,
    KsCheckboxComponent,
    KsDropdownComponent,
    KsIconButtonComponent,
    KsMarqueeComponent,
    KsSequenceEditorComponent,
    KsTabComponent,
    KsTabViewComponent,
    SvcAngleEditorComponent,
    SvcAtlasDialogComponent,
    SvcCalendarViewComponent,
    SvcCalendarViewOptionsComponent,
    SvcChangeLocationDialogComponent,
    SvcDateEditorComponent,
    SvcEclipticViewComponent,
    SvcEclipticViewOptionsComponent,
    SvcEventNavigatorComponent,
    SvcInsolationViewComponent,
    SvcInsolationViewOptionsComponent,
    SvcLocationSettingsComponent,
    SvcMapViewComponent,
    SvcMapViewOptionsComponent,
    SvcMoonsViewComponent,
    SvcMoonsViewOptionsComponent,
    SvcOptionsPanelComponent,
    SvcOrbitViewComponent,
    SvcOrbitViewOptionsComponent,
    SvcPreferencesDialogComponent,
    SvcSkyViewComponent,
    SvcSkyViewOptionsComponent,
    SvcTableViewComponent,
    SvcTableViewOptionsComponent,
    SvcTimeEditorComponent,
    SvcTimeViewComponent,
    SvcZoneSelectorComponent
  ],
  providers: [
    AppService,
    AstroDataService,
    ConfirmationService,
    DatePipe,
    JpegCommentReader,
    KsTimeService,
    SvcAtlasService,
    {provide: BusyConfig, useFactory: busyConfigFactory}
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})

export class AppModule {}
