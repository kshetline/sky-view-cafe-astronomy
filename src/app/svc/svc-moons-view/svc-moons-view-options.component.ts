import { AfterViewInit, Component } from '@angular/core';
import { AngleStyle } from '@tubular/ng-widgets';
import { AppService, UserSetting } from '../../app.service';
import {
  DEFAULT_FIXED_GRS, DEFAULT_ZOOM, PROPERTY_EAST_ON_LEFT, PROPERTY_FIXED_GRS, PROPERTY_GRS_OVERRIDE, PROPERTY_MARK_GRS,
  PROPERTY_MOON_NAMES, PROPERTY_MOON_NUMBERS, PROPERTY_NORTH_ON_TOP, PROPERTY_PHOTOGRAPHIC_PLANETS, PROPERTY_ZOOM, SvcMoonsViewComponent, VIEW_MOONS,
  ZOOM_STEPS
} from './svc-moons-view.component';

@Component({
  selector: 'svc-moons-view-options',
  templateUrl: './svc-moons-view-options.component.html',
  styleUrls: ['./svc-moons-view-options.component.scss']
})
export class SvcMoonsViewOptionsComponent implements AfterViewInit {
  DDD = AngleStyle.DDD;

  private _northOnTop = true;
  private _eastOnLeft = true;
  private _moonNumbers = true;
  private _moonNames = false;
  private _photoPlanets = true;
  private _markGrs = false;
  private _grsOverride = false;
  private _fixedGrs = DEFAULT_FIXED_GRS;
  private _reverseZoom = ZOOM_STEPS - SvcMoonsViewComponent.zoomToZoomSteps(DEFAULT_ZOOM);

  readonly zoomSteps = ZOOM_STEPS;

  constructor(private app: AppService) {
    app.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_MOONS && setting.source !== this) {
        if (setting.property === PROPERTY_NORTH_ON_TOP)
          this.northOnTop = setting.value as boolean;
        else if (setting.property === PROPERTY_EAST_ON_LEFT)
          this.eastOnLeft = setting.value as boolean;
        else if (setting.property === PROPERTY_PHOTOGRAPHIC_PLANETS)
          this.photoPlanets = setting.value as boolean;
        else if (setting.property === PROPERTY_MARK_GRS)
          this.markGrs = setting.value as boolean;
        else if (setting.property === PROPERTY_GRS_OVERRIDE)
          this.grsOverride = setting.value as boolean;
        else if (setting.property === PROPERTY_FIXED_GRS)
          this.fixedGrs = setting.value as number;
        else if (setting.property === PROPERTY_ZOOM)
          this.reverseZoom = ZOOM_STEPS - (setting.value as number);
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.app.requestViewSettings(VIEW_MOONS));
  }

  get northOnTop(): boolean { return this._northOnTop; }
  set northOnTop(value: boolean) {
    if (this._northOnTop !== value) {
      this._northOnTop = value;
      this.app.updateUserSetting(VIEW_MOONS, PROPERTY_NORTH_ON_TOP, value, this);
    }
  }

  get eastOnLeft(): boolean { return this._eastOnLeft; }
  set eastOnLeft(value: boolean) {
    if (this._eastOnLeft !== value) {
      this._eastOnLeft = value;
      this.app.updateUserSetting(VIEW_MOONS, PROPERTY_EAST_ON_LEFT, value, this);
    }
  }

  get moonNumbers(): boolean { return this._moonNumbers; }
  set moonNumbers(value: boolean) {
    if (this._moonNumbers !== value) {
      this._moonNumbers = value;
      this.app.updateUserSetting(VIEW_MOONS, PROPERTY_MOON_NUMBERS, value, this);
    }
  }

  get moonNames(): boolean { return this._moonNames; }
  set moonNames(value: boolean) {
    if (this._moonNames !== value) {
      this._moonNames = value;
      this.app.updateUserSetting(VIEW_MOONS, PROPERTY_MOON_NAMES, value, this);
    }
  }

  get photoPlanets(): boolean { return this._photoPlanets; }
  set photoPlanets(value: boolean) {
    if (this._photoPlanets !== value) {
      this._photoPlanets = value;
      this.app.updateUserSetting(VIEW_MOONS, PROPERTY_PHOTOGRAPHIC_PLANETS, value, this);
    }
  }

  get markGrs(): boolean { return this._markGrs; }
  set markGrs(value: boolean) {
    if (this._markGrs !== value) {
      this._markGrs = value;
      this.app.updateUserSetting(VIEW_MOONS, PROPERTY_MARK_GRS, value, this);
    }
  }

  get grsOverride(): boolean { return this._grsOverride; }
  set grsOverride(value: boolean) {
    if (this._grsOverride !== value) {
      this._grsOverride = value;
      this.app.updateUserSetting(VIEW_MOONS, PROPERTY_GRS_OVERRIDE, value, this);
    }
  }

  get fixedGrs(): number { return this._fixedGrs; }
  set fixedGrs(value: number) {
    if (this._fixedGrs !== value) {
      this._fixedGrs = value;
      this.app.updateUserSetting(VIEW_MOONS, PROPERTY_FIXED_GRS, value, this);
    }
  }

  get reverseZoom(): number { return this._reverseZoom; }
  set reverseZoom(value: number) {
    if (this._reverseZoom !== value) {
      this._reverseZoom = value;
      this.app.updateUserSetting(VIEW_MOONS, PROPERTY_ZOOM, ZOOM_STEPS - value, this);
    }
  }

  setDefaultZoom(): void {
    this.reverseZoom = ZOOM_STEPS - SvcMoonsViewComponent.zoomToZoomSteps(DEFAULT_ZOOM);
  }
}
