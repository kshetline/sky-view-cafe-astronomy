import { DatePipe } from '@angular/common';
import { HttpClientJsonpModule, HttpClientModule } from '@angular/common/http';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { ConfirmationService, SharedModule } from 'primeng/api';
import { BlockUIModule } from 'primeng/blockui';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { MessageModule } from 'primeng/message';
import { MessagesModule } from 'primeng/messages';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { PanelModule } from 'primeng/panel';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SliderModule } from 'primeng/slider';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import { TubularNgWidgetsModule } from '@tubular/ng-widgets';

import { AppComponent } from './app.component';
import { AppService } from './app.service';
import { AstroDataService } from './astronomy/astro-data.service';
import { KsSizerDirective } from './directives/ks-sizer.directive';
import { SvcAtlasDialogComponent } from './svc/svc-atlas-dialog/svc-atlas-dialog.component';
import { SvcAtlasService } from './svc/svc-atlas.service';
import { SvcCalendarViewOptionsComponent } from './svc/svc-calendar-view/svc-calendar-view-options.component';
import { SvcCalendarViewComponent } from './svc/svc-calendar-view/svc-calendar-view.component';
import { SvcChangeLocationDialogComponent } from './svc/svc-change-location-dialog/svc-change-location-dialog.component';
import { SvcEclipseCircumstancesComponent } from './svc/svc-eclipse-circumstances/svc-eclipse-circumstances.component';
import { SvcEclipticViewOptionsComponent } from './svc/svc-ecliptic-view/svc-ecliptic-view-options.component';
import { SvcEclipticViewComponent } from './svc/svc-ecliptic-view/svc-ecliptic-view.component';
import { SvcEventNavigatorComponent } from './svc/svc-event-navigator/svc-event-navigator.component';
import { SvcInsolationViewOptionsComponent } from './svc/svc-insolation-view/svc-insolation-view-options.component';
import { SvcInsolationViewComponent } from './svc/svc-insolation-view/svc-insolation-view.component';
import { SvcLocationSettingsComponent } from './svc/svc-location-settings/svc-location-settings.component';
import { SvcMapViewOptionsComponent } from './svc/svc-map-view/svc-map-view-options.component';
import { SvcMapViewComponent } from './svc/svc-map-view/svc-map-view.component';
import { SvcMoonsViewOptionsComponent } from './svc/svc-moons-view/svc-moons-view-options.component';
import { SvcMoonsViewComponent } from './svc/svc-moons-view/svc-moons-view.component';
import { SvcNativeDateTimeDialogComponent } from './svc/svc-native-date-time-dialog/svc-native-date-time-dialog.component';
import { SvcOptionsPanelComponent } from './svc/svc-options-panel/svc-options-panel.component';
import { SvcOrbitViewOptionsComponent } from './svc/svc-orbit-view/svc-orbit-view-options.component';
import { SvcOrbitViewComponent } from './svc/svc-orbit-view/svc-orbit-view.component';
import { SvcPreferencesDialogComponent } from './svc/svc-preferences-dialog/svc-preferences-dialog.component';
import { SvcSkyViewOptionsComponent } from './svc/svc-sky-view/svc-sky-view-options.component';
import { SvcSkyViewComponent } from './svc/svc-sky-view/svc-sky-view.component';
import { SvcTableViewOptionsComponent } from './svc/svc-table-view/svc-table-view-options.component';
import { SvcTableViewComponent } from './svc/svc-table-view/svc-table-view.component';
import { SvcTimeViewComponent } from './svc/svc-time-view/svc-time-view.component';
import { SvcZoneSelectorComponent } from './svc/svc-zone-selector/svc-zone-selector.component';
import { JpegCommentReader } from './util/ks-read-jpeg-comment';
import { KsTimeService } from './util/ks-time.service';
import { KsCheckboxComponent } from './widgets/ks-checkbox/ks-checkbox.component';
import { KsDropdownComponent } from './widgets/ks-dropdown/ks-dropdown.component';
import { KsIconButtonComponent } from './widgets/ks-icon-button/ks-icon-button.component';
import { KsMarqueeComponent } from './widgets/ks-marquee/ks-marquee.component';
import { KsTabViewComponent } from './widgets/ks-tab-view/ks-tab-view.component';
import { KsTabComponent } from './widgets/ks-tab/ks-tab.component';

import { AppRoutingModule } from './app-routing.module';

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
    FormsModule,
    HttpClientModule,
    HttpClientJsonpModule,
    InputTextModule,
    MenuModule,
    MessageModule,
    MessagesModule,
    OverlayPanelModule,
    PanelModule,
    RadioButtonModule,
    SharedModule,
    SliderModule,
    TableModule,
    TabViewModule,
    ToastModule,
    TooltipModule,
    TubularNgWidgetsModule
  ],
  declarations: [
    AppComponent,
    KsCheckboxComponent,
    KsDropdownComponent,
    KsIconButtonComponent,
    KsMarqueeComponent,
    KsTabComponent,
    KsTabViewComponent,
    SvcAtlasDialogComponent,
    SvcCalendarViewComponent,
    SvcCalendarViewOptionsComponent,
    SvcChangeLocationDialogComponent,
    SvcEclipseCircumstancesComponent,
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
    SvcNativeDateTimeDialogComponent,
    SvcSkyViewComponent,
    SvcSkyViewOptionsComponent,
    SvcTableViewComponent,
    SvcTableViewOptionsComponent,
    SvcTimeViewComponent,
    SvcZoneSelectorComponent,
    KsSizerDirective
  ],
  providers: [
    AppService,
    AstroDataService,
    ConfirmationService,
    DatePipe,
    JpegCommentReader,
    KsTimeService,
    SvcAtlasService
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})

export class AppModule {}
