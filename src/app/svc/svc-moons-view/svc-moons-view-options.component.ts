/*
  Copyright © 2017 Kerry Shetline, kerry@shetline.com.

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

import { AfterViewInit, Component } from '@angular/core';
import { AppService, UserSetting } from '../../app.service';
import {
  VIEW_MOONS, PROPERTY_NORTH_ON_TOP, PROPERTY_EAST_ON_LEFT, PROPERTY_MOON_NUMBERS, PROPERTY_MOON_NAMES, PROPERTY_PHOTOGRAPHIC_PLANETS,
  PROPERTY_MARK_GRS, PROPERTY_GRS_OVERRIDE, PROPERTY_FIXED_GRS, PROPERTY_ZOOM, SvcMoonsViewComponent, DEFAULT_ZOOM, ZOOM_STEPS,
  DEFAULT_FIXED_GRS
} from './svc-moons-view.component';

@Component({
  selector: 'svc-moons-view-options',
  templateUrl: './svc-moons-view-options.component.html',
  styleUrls: ['./svc-moons-view-options.component.scss']
})
export class SvcMoonsViewOptionsComponent implements AfterViewInit {
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

  constructor(private appService: AppService) {
    appService.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_MOONS && setting.source !== this) {
        if (setting.property === PROPERTY_NORTH_ON_TOP)
          this.northOnTop = <boolean> setting.value;
        else if (setting.property === PROPERTY_EAST_ON_LEFT)
          this.eastOnLeft = <boolean> setting.value;
        else if (setting.property === PROPERTY_PHOTOGRAPHIC_PLANETS)
          this.photoPlanets = <boolean> setting.value;
        else if (setting.property === PROPERTY_MARK_GRS)
          this.markGrs = <boolean> setting.value;
        else if (setting.property === PROPERTY_GRS_OVERRIDE)
          this.grsOverride = <boolean> setting.value;
        else if (setting.property === PROPERTY_FIXED_GRS)
          this.fixedGrs = <number> setting.value;
        else if (setting.property === PROPERTY_ZOOM)
          this.reverseZoom = ZOOM_STEPS - <number> setting.value;
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.appService.requestViewSettings(VIEW_MOONS));
  }

  get northOnTop(): boolean { return this._northOnTop; }
  set northOnTop(value: boolean) {
    if (this._northOnTop !== value) {
      this._northOnTop = value;
      this.appService.updateUserSetting({view: VIEW_MOONS, property: PROPERTY_NORTH_ON_TOP, value: value, source: this});
    }
  }

  get eastOnLeft(): boolean { return this._eastOnLeft; }
  set eastOnLeft(value: boolean) {
    if (this._eastOnLeft !== value) {
      this._eastOnLeft = value;
      this.appService.updateUserSetting({view: VIEW_MOONS, property: PROPERTY_EAST_ON_LEFT, value: value, source: this});
    }
  }

  get moonNumbers(): boolean { return this._moonNumbers; }
  set moonNumbers(value: boolean) {
    if (this._moonNumbers !== value) {
      this._moonNumbers = value;
      this.appService.updateUserSetting({view: VIEW_MOONS, property: PROPERTY_MOON_NUMBERS, value: value, source: this});
    }
  }

  get moonNames(): boolean { return this._moonNames; }
  set moonNames(value: boolean) {
    if (this._moonNames !== value) {
      this._moonNames = value;
      this.appService.updateUserSetting({view: VIEW_MOONS, property: PROPERTY_MOON_NAMES, value: value, source: this});
    }
  }

  get photoPlanets(): boolean { return this._photoPlanets; }
  set photoPlanets(value: boolean) {
    if (this._photoPlanets !== value) {
      this._photoPlanets = value;
      this.appService.updateUserSetting({view: VIEW_MOONS, property: PROPERTY_PHOTOGRAPHIC_PLANETS, value: value, source: this});
    }
  }

  get markGrs(): boolean { return this._markGrs; }
  set markGrs(value: boolean) {
    if (this._markGrs !== value) {
      this._markGrs = value;
      this.appService.updateUserSetting({view: VIEW_MOONS, property: PROPERTY_MARK_GRS, value: value, source: this});
    }
  }

  get grsOverride(): boolean { return this._grsOverride; }
  set grsOverride(value: boolean) {
    if (this._grsOverride !== value) {
      this._grsOverride = value;
      this.appService.updateUserSetting({view: VIEW_MOONS, property: PROPERTY_GRS_OVERRIDE, value: value, source: this});
    }
  }

  get fixedGrs(): number { return this._fixedGrs; }
  set fixedGrs(value: number) {
    if (this._fixedGrs !== value) {
      this._fixedGrs = value;
      this.appService.updateUserSetting({view: VIEW_MOONS, property: PROPERTY_FIXED_GRS, value: value, source: this});
    }
  }

  get reverseZoom(): number { return this._reverseZoom; }
  set reverseZoom(value: number) {
    if (this._reverseZoom !== value) {
      this._reverseZoom = value;
      this.appService.updateUserSetting({view: VIEW_MOONS, property: PROPERTY_ZOOM, value: ZOOM_STEPS - value, source: this});
    }
  }

  setDefaultZoom(): void {
    this.reverseZoom = ZOOM_STEPS - SvcMoonsViewComponent.zoomToZoomSteps(DEFAULT_ZOOM);
  }
}
