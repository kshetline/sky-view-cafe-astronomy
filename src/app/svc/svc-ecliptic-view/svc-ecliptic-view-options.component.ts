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

import { AfterViewInit, Component } from '@angular/core';
import { MenuItem, SelectItem } from 'primeng/components/common/api';
import { AppService, UserSetting } from '../../app.service';
import { VIEW_ECLIPTIC, PROPERTY_SPAN_25, PROPERTY_ORIENTATION, PROPERTY_ECLIPTIC_GRID, PROPERTY_CELESTIAL_EQUATOR,
         PROPERTY_SHOW_CONSTELLATIONS, PROPERTY_LOCAL_HORIZON, PROPERTY_SHOW_STARS, PROPERTY_BRIGHTEN_STARS,
         PROPERTY_TOPOCENTRIC_MOON, PROPERTY_ENLARGE_SUN_MOON, PROPERTY_LABEL_PLANETS, PROPERTY_LABEL_BRIGHT_STARS,
         PROPERTY_LABEL_STARS, PROPERTY_LABEL_CONSTELLATIONS, PROPERTY_LABEL_DSOS } from './svc-ecliptic-view.component';
import { NO_DEEP_SKY, ALL_DEEP_SKY } from '../generic-sky-view';
import * as _ from 'lodash';
import { SvcGenericOptionsComponent } from '../svc-generic-options.component';

const CHECKED = 'far fa-check-square';
const UNCHECKED = 'far fa-square';
const EM_DASH = '\u2014';

interface MenuItemPlus extends MenuItem {
  property?: string;
  value?: any;
}

interface MenuEvent {
  originalEvent: MouseEvent;
  item: MenuItemPlus;
}

@Component({
  selector: 'svc-ecliptic-view-options',
  templateUrl: './svc-ecliptic-view-options.component.html',
  styleUrls: ['./svc-ecliptic-view-options.component.scss']
})
export class SvcEclipticViewOptionsComponent extends SvcGenericOptionsComponent implements AfterViewInit {
  private _span25 = false;
  private _northOutward = true;
  private _ecliptic = true;
  private _celestial = true;
  private _showConstellations = false;
  private _localHorizon = true;
  private _showStars = true;
  private _brightenStars = false;
  private _topocentricMoon = true;
  private _enlargeSunMoon = false;
  private deepSkyLabelMagnitude = NO_DEEP_SKY;

  spans: SelectItem[] = [
    {label: 'Ecliptic ±15°', value: false},
    {label: 'Ecliptic ±25°', value: true},
  ];

  orientations: SelectItem[] = [
    {label: 'North outward', value: true},
    {label: 'South outward', value: false},
  ];

  namesCategories: MenuItemPlus[] = [
    {label: 'None',                  icon: UNCHECKED, property: null,
      command: (event) => { this.toggleLabels(event); }},
    {label: EM_DASH, icon: 'fas fa-fw'},
    {label: 'Planets',               icon: CHECKED,   property: PROPERTY_LABEL_PLANETS,
      command: (event) => { this.toggleLabels(event); }},
    {label: 'Bright Stars',          icon: UNCHECKED, property: PROPERTY_LABEL_BRIGHT_STARS,
      command: (event) => { this.toggleLabels(event); }},
    {label: 'Stars',                 icon: UNCHECKED, property: PROPERTY_LABEL_STARS,
      command: (event) => { this.toggleLabels(event); }},
    {label: 'Constellations',        icon: UNCHECKED, property: PROPERTY_LABEL_CONSTELLATIONS,
      command: (event) => { this.toggleLabels(event); }, disabled: true},
    {label: EM_DASH, icon: 'fas fa-fw'},
    {label: 'No Deep Sky Objects',   icon: CHECKED,   property: PROPERTY_LABEL_DSOS,
      command: (event) => { this.toggleLabels(event); }, value: NO_DEEP_SKY},
    {label: 'DSOs 4.0 and Brighter', icon: UNCHECKED, property: PROPERTY_LABEL_DSOS,
      command: (event) => { this.toggleLabels(event); }, value: 4},
    {label: 'DSOs 5.0 and Brighter', icon: UNCHECKED, property: PROPERTY_LABEL_DSOS,
      command: (event) => { this.toggleLabels(event); }, value: 5},
    {label: 'DSOs 6.0 and Brighter', icon: UNCHECKED, property: PROPERTY_LABEL_DSOS,
      command: (event) => { this.toggleLabels(event); }, value: 6},
    {label: 'All Deep Sky Objects',  icon: UNCHECKED, property: PROPERTY_LABEL_DSOS,
      command: (event) => { this.toggleLabels(event); }, value: ALL_DEEP_SKY}
  ];

  constructor(appService: AppService) {
    super(appService, VIEW_ECLIPTIC);

    appService.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_ECLIPTIC && setting.source !== this) {
        if (setting.property === PROPERTY_CELESTIAL_EQUATOR)
          this.celestial = <boolean> setting.value;
        else if (setting.property === PROPERTY_ECLIPTIC_GRID)
          this.ecliptic = <boolean> setting.value;
        else if (setting.property === PROPERTY_BRIGHTEN_STARS)
          this.brightenStars = <boolean> setting.value;
        else if (setting.property === PROPERTY_SHOW_CONSTELLATIONS)
          this.showConstellations = <boolean> setting.value;
        else if (setting.property === PROPERTY_ENLARGE_SUN_MOON)
          this.enlargeSunMoon = <boolean> setting.value;
        else if (setting.property === PROPERTY_LABEL_PLANETS ||
                 setting.property === PROPERTY_LABEL_BRIGHT_STARS ||
                 setting.property === PROPERTY_LABEL_STARS ||
                 setting.property === PROPERTY_LABEL_CONSTELLATIONS)
          this.updateShowNames(setting.property, <boolean> setting.value);
        else if (setting.property === PROPERTY_LABEL_DSOS) {
          this.deepSkyLabelMagnitude = <number> setting.value;
          this.adjustShowNamesMenu(setting.property);
        }
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.appService.requestViewSettings(VIEW_ECLIPTIC));
  }

  get span25(): boolean { return this._span25; }
  set span25(value: boolean) {
    if (this._span25 !== value) {
      this._span25 = value;
      this.appService.updateUserSetting({view: VIEW_ECLIPTIC, property: PROPERTY_SPAN_25, value: value, source: this});
    }
  }

  get northOutward(): boolean { return this._northOutward; }
  set northOutward(value: boolean) {
    if (this._northOutward !== value) {
      this._northOutward = value;
      this.appService.updateUserSetting({view: VIEW_ECLIPTIC, property: PROPERTY_ORIENTATION, value: value, source: this});
    }
  }

  get ecliptic(): boolean { return this._ecliptic; }
  set ecliptic(value: boolean) {
    if (this._ecliptic !== value) {
      this._ecliptic = value;
      this.appService.updateUserSetting({view: VIEW_ECLIPTIC, property: PROPERTY_ECLIPTIC_GRID, value: value, source: this});
    }
  }

  get celestial(): boolean { return this._celestial; }
  set celestial(value: boolean) {
    if (this._celestial !== value) {
      this._celestial = value;
      this.appService.updateUserSetting({view: VIEW_ECLIPTIC, property: PROPERTY_CELESTIAL_EQUATOR, value: value, source: this});
    }
  }

  get showConstellations(): boolean { return this._showConstellations; }
  set showConstellations(value: boolean) {
    if (this._showConstellations !== value) {
      this._showConstellations = value;
      _.find(this.namesCategories, {'property': PROPERTY_LABEL_CONSTELLATIONS}).disabled = !value;
      this.appService.updateUserSetting({view: VIEW_ECLIPTIC, property: PROPERTY_SHOW_CONSTELLATIONS, value: value, source: this});
    }
  }

  get localHorizon(): boolean { return this._localHorizon; }
  set localHorizon(value: boolean) {
    if (this._localHorizon !== value) {
      this._localHorizon = value;
      this.appService.updateUserSetting({view: VIEW_ECLIPTIC, property: PROPERTY_LOCAL_HORIZON, value: value, source: this});
    }
  }

  get showStars(): boolean { return this._showStars; }
  set showStars(value: boolean) {
    if (this._showStars !== value) {
      this._showStars = value;
      this.appService.updateUserSetting({view: VIEW_ECLIPTIC, property: PROPERTY_SHOW_STARS , value: value, source: this});
    }
  }

  get brightenStars(): boolean { return this._brightenStars; }
  set brightenStars(value: boolean) {
    if (this._brightenStars !== value) {
      this._brightenStars = value;
      this.appService.updateUserSetting({view: VIEW_ECLIPTIC, property: PROPERTY_BRIGHTEN_STARS , value: value, source: this});
    }
  }

  get topocentricMoon(): boolean { return this._topocentricMoon; }
  set topocentricMoon(value: boolean) {
    if (this._topocentricMoon !== value) {
      this._topocentricMoon = value;
      this.appService.updateUserSetting({view: VIEW_ECLIPTIC, property: PROPERTY_TOPOCENTRIC_MOON, value: value, source: this});
    }
  }

  get enlargeSunMoon(): boolean { return this._enlargeSunMoon; }
  set enlargeSunMoon(value: boolean) {
    if (this._enlargeSunMoon !== value) {
      this._enlargeSunMoon = value;
      this.appService.updateUserSetting({view: VIEW_ECLIPTIC, property: PROPERTY_ENLARGE_SUN_MOON, value: value, source: this});
    }
  }

  private updateShowNames(property: string, value: boolean | number): void {
    for (const item of this.namesCategories) {
      if (item.property === property)
        item.icon = (value ? CHECKED : UNCHECKED);

      if (value &&
          ((item.property === PROPERTY_LABEL_STARS && property === PROPERTY_LABEL_BRIGHT_STARS) ||
           (item.property === PROPERTY_LABEL_BRIGHT_STARS && property === PROPERTY_LABEL_STARS)))
        item.icon = UNCHECKED;
    }

    this.adjustShowNamesMenu(null);
  }

  toggleLabels(event: MenuEvent): void {
    const property = event.item.property;

    for (const item of this.namesCategories) {
      let value: boolean = undefined;

      if (item.label === EM_DASH)
        continue;

      if (item.property === null && property === null) {
        item.icon = CHECKED;
        this.deepSkyLabelMagnitude = NO_DEEP_SKY;
        continue;
      }
      else if (property === null) {
        value = false;
        item.icon = UNCHECKED;
      }
      else if (item === event.item) {
        if (item.property === PROPERTY_LABEL_DSOS)
          value = this.deepSkyLabelMagnitude = item.value;
        else {
          value = (item.icon === UNCHECKED);
          item.icon = (value ? CHECKED : UNCHECKED);
        }
      }

      if (value !== undefined) {
        this.appService.updateUserSetting({view: VIEW_ECLIPTIC, property: item.property, value: value, source: this});

        if (property === PROPERTY_LABEL_STARS && value)
          this.appService.updateUserSetting({view: VIEW_ECLIPTIC, property: PROPERTY_LABEL_BRIGHT_STARS, value: false, source: this});

        if (property === PROPERTY_LABEL_BRIGHT_STARS && value)
          this.appService.updateUserSetting({view: VIEW_ECLIPTIC, property: PROPERTY_LABEL_STARS, value: false, source: this});
      }
    }

    this.adjustShowNamesMenu(property);
  }

  private adjustShowNamesMenu(property: string): void {
    let anyButNoneChecked = false;

    for (const item of this.namesCategories) {
      if (item.label === EM_DASH)
        continue;

      if (item.property === PROPERTY_LABEL_BRIGHT_STARS && property === PROPERTY_LABEL_STARS)
        item.icon = UNCHECKED;

      if (item.property === PROPERTY_LABEL_STARS && property === PROPERTY_LABEL_BRIGHT_STARS)
        item.icon = UNCHECKED;

      if (item.property === PROPERTY_LABEL_DSOS)
        item.icon = (item.value === this.deepSkyLabelMagnitude ? CHECKED : UNCHECKED);

      if (item.property !== null &&
          !(item.property === PROPERTY_LABEL_DSOS && item.value === NO_DEEP_SKY))
        anyButNoneChecked = anyButNoneChecked || (item.icon === CHECKED);
    }

    this.namesCategories[0].icon = (anyButNoneChecked ? UNCHECKED : CHECKED);
  }
}
