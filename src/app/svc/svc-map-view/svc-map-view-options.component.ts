import { AfterViewInit, Component } from '@angular/core';
import { SelectItem } from 'primeng/api';
import { AppEvent, AppService, UserSetting } from '../../app.service';
import { SvcAtlasService } from '../svc-atlas.service';
import {
  EVENT_MAP_ACTIVE_ECLIPSE, EVENT_MAP_ACTIVE_ECLIPSE_REQUEST, EVENT_MAP_GO_TO_ECLIPSE_CENTER, EVENT_MAP_GO_TO_SUBSOLAR_POINT, MapType,
  PROPERTY_BLINK_LOCATION_MARKERS, PROPERTY_MAP_TYPE, PROPERTY_SHOW_DAY_NIGHT, PROPERTY_SHOW_ECLIPSE_SHADOWS, PROPERTY_SHOW_LOCATION_MARKERS,
  VIEW_MAP
} from './svc-map-view.component';

@Component({
  selector: 'svc-map-view-options',
  templateUrl: './svc-map-view-options.component.html',
  styleUrls: ['./svc-map-view-options.component.scss']
})
export class SvcMapViewOptionsComponent implements AfterViewInit {
  private _mapType = MapType.TERRAIN;
  private _showDayNight = true;
  private _showEclipseShadows = true;
  private _showMarkers = true;
  private _blink = true;

  eclipseActive = false;

  mapTypes: SelectItem[] = [
    { label: 'Terrain map', value: MapType.TERRAIN },
    { label: 'Political map', value: MapType.POLITICAL }
  ];

  constructor(
    private appService: AppService,
    private atlasService: SvcAtlasService
  ) {
    appService.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_MAP && setting.source !== this) {
        if (setting.property === PROPERTY_MAP_TYPE)
          this.mapType = setting.value as MapType;
        else if (setting.property === PROPERTY_SHOW_DAY_NIGHT)
          this.showDayNight = setting.value as boolean;
        else if (setting.property === PROPERTY_SHOW_ECLIPSE_SHADOWS)
          this.showEclipseShadows = setting.value as boolean;
        else if (setting.property === PROPERTY_SHOW_LOCATION_MARKERS)
          this.showMarkers = setting.value as boolean;
        else if (setting.property === PROPERTY_BLINK_LOCATION_MARKERS)
          this.blink = setting.value as boolean;
      }
    });

    appService.getAppEventUpdates((appEvent: AppEvent) => {
      if (appEvent.name === EVENT_MAP_ACTIVE_ECLIPSE)
        this.eclipseActive = appEvent.value as boolean;
    });

    appService.sendAppEvent(EVENT_MAP_ACTIVE_ECLIPSE_REQUEST);
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.appService.requestViewSettings(VIEW_MAP));
    this.atlasService.getTimezoneMapUrl().then(img => console.log(img));
  }

  get mapType(): MapType { return this._mapType; }
  set mapType(value: MapType) {
    if (this._mapType !== value) {
      this._mapType = value;
      this.appService.updateUserSetting({ view: VIEW_MAP, property: PROPERTY_MAP_TYPE, value, source: this });
    }
  }

  get showDayNight(): boolean { return this._showDayNight; }
  set showDayNight(value: boolean) {
    if (this._showDayNight !== value) {
      this._showDayNight = value;
      this.appService.updateUserSetting({ view: VIEW_MAP, property: PROPERTY_SHOW_DAY_NIGHT, value, source: this });
    }
  }

  get showEclipseShadows(): boolean { return this._showEclipseShadows; }
  set showEclipseShadows(value: boolean) {
    if (this._showEclipseShadows !== value) {
      this._showEclipseShadows = value;
      this.appService.updateUserSetting({ view: VIEW_MAP, property: PROPERTY_SHOW_ECLIPSE_SHADOWS, value, source: this });
    }
  }

  get showMarkers(): boolean { return this._showMarkers; }
  set showMarkers(value: boolean) {
    if (this._showMarkers !== value) {
      this._showMarkers = value;
      this.appService.updateUserSetting({ view: VIEW_MAP, property: PROPERTY_SHOW_LOCATION_MARKERS, value, source: this });
    }
  }

  get blink(): boolean { return this._blink; }
  set blink(value: boolean) {
    if (this._blink !== value) {
      this._blink = value;
      this.appService.updateUserSetting({ view: VIEW_MAP, property: PROPERTY_BLINK_LOCATION_MARKERS, value, source: this });
    }
  }

  goToSubsolarPoint(): void {
    this.appService.sendAppEvent(EVENT_MAP_GO_TO_SUBSOLAR_POINT);
  }

  goToEclipseCenter(): void {
    this.appService.sendAppEvent(EVENT_MAP_GO_TO_ECLIPSE_CENTER);
  }
}
