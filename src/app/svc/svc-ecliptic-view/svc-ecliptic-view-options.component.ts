import { AfterViewInit, Component } from '@angular/core';
import { MenuItem, SelectItem } from 'primeng/api';
import { AppService, UserSetting } from '../../app.service';
import { ALL_DEEP_SKY, NO_DEEP_SKY } from '../generic-sky-view.directive';
import { PROPERTY_ADDITIONALS } from '../generic-view.directive';
import { SvcGenericOptionsComponent } from '../svc-generic-options.component';
import { PROPERTY_BRIGHTEN_STARS, PROPERTY_CELESTIAL_EQUATOR, PROPERTY_ECLIPTIC_GRID, PROPERTY_ENLARGE_SUN_MOON, PROPERTY_LABEL_BRIGHT_STARS,
  PROPERTY_LABEL_CONSTELLATIONS, PROPERTY_LABEL_DSOS, PROPERTY_LABEL_PLANETS, PROPERTY_LABEL_STARS,
  PROPERTY_LOCAL_HORIZON, PROPERTY_ORIENTATION, PROPERTY_SHOW_CONSTELLATIONS, PROPERTY_SHOW_STARS,
  PROPERTY_SPAN_25, PROPERTY_TOPOCENTRIC_MOON, VIEW_ECLIPTIC } from './svc-ecliptic-view.component';

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
    { label: 'Ecliptic ±15°', value: false },
    { label: 'Ecliptic ±25°', value: true },
  ];

  orientations: SelectItem[] = [
    { label: 'North outward', value: true },
    { label: 'South outward', value: false },
  ];

  namesCategories: MenuItemPlus[] = [
    { label: 'None',                  icon: UNCHECKED, property: null,
      command: (event): void => { this.toggleLabels(event); } },
    { label: EM_DASH, icon: 'fas fa-fw' },
    { label: 'Planets',               icon: CHECKED,   property: PROPERTY_LABEL_PLANETS,
      command: (event): void => { this.toggleLabels(event); } },
    { label: 'Bright Stars',          icon: UNCHECKED, property: PROPERTY_LABEL_BRIGHT_STARS,
      command: (event): void => { this.toggleLabels(event); } },
    { label: 'Stars',                 icon: UNCHECKED, property: PROPERTY_LABEL_STARS,
      command: (event): void => { this.toggleLabels(event); } },
    { label: 'Constellations',        icon: UNCHECKED, property: PROPERTY_LABEL_CONSTELLATIONS,
      command: (event): void => { this.toggleLabels(event); }, disabled: true },
    { label: EM_DASH, icon: 'fas fa-fw' },
    { label: 'No Deep Sky Objects',   icon: CHECKED,   property: PROPERTY_LABEL_DSOS,
      command: (event): void => { this.toggleLabels(event); }, value: NO_DEEP_SKY },
    { label: 'DSOs 4.0 and Brighter', icon: UNCHECKED, property: PROPERTY_LABEL_DSOS,
      command: (event): void => { this.toggleLabels(event); }, value: 4 },
    { label: 'DSOs 5.0 and Brighter', icon: UNCHECKED, property: PROPERTY_LABEL_DSOS,
      command: (event): void => { this.toggleLabels(event); }, value: 5 },
    { label: 'DSOs 6.0 and Brighter', icon: UNCHECKED, property: PROPERTY_LABEL_DSOS,
      command: (event): void => { this.toggleLabels(event); }, value: 6 },
    { label: 'All Deep Sky Objects',  icon: UNCHECKED, property: PROPERTY_LABEL_DSOS,
      command: (event): void => { this.toggleLabels(event); }, value: ALL_DEEP_SKY }
  ];

  constructor(appService: AppService) {
    super(appService, VIEW_ECLIPTIC);

    appService.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_ECLIPTIC && setting.source !== this) {
        if (setting.property === PROPERTY_SPAN_25)
          this.span25 = setting.value as boolean;
        else if (setting.property === PROPERTY_ORIENTATION)
          this.northOutward = setting.value as boolean;
        else if (setting.property === PROPERTY_ECLIPTIC_GRID)
          this.ecliptic = setting.value as boolean;
        else if (setting.property === PROPERTY_CELESTIAL_EQUATOR)
          this.celestial = setting.value as boolean;
        else if (setting.property === PROPERTY_SHOW_CONSTELLATIONS)
          this.showConstellations = setting.value as boolean;
        else if (setting.property === PROPERTY_LOCAL_HORIZON)
          this.localHorizon = setting.value as boolean;
        else if (setting.property === PROPERTY_SHOW_STARS)
          this.showStars = setting.value as boolean;
        else if (setting.property === PROPERTY_BRIGHTEN_STARS)
          this.brightenStars = setting.value as boolean;
        else if (setting.property === PROPERTY_TOPOCENTRIC_MOON)
          this.topocentricMoon = setting.value as boolean;
        else if (setting.property === PROPERTY_ENLARGE_SUN_MOON)
          this.enlargeSunMoon = setting.value as boolean;
        else if (setting.property === PROPERTY_LABEL_PLANETS ||
                 setting.property === PROPERTY_LABEL_BRIGHT_STARS ||
                 setting.property === PROPERTY_LABEL_STARS ||
                 setting.property === PROPERTY_LABEL_CONSTELLATIONS)
          this.updateShowNames(setting.property, setting.value as boolean);
        else if (setting.property === PROPERTY_LABEL_DSOS) {
          this.deepSkyLabelMagnitude = setting.value as number;
          this.adjustShowNamesMenu(setting.property);
        }
        else if (setting.property === PROPERTY_ADDITIONALS)
          this.additional = setting.value as string;
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
      this.appService.updateUserSetting(VIEW_ECLIPTIC, PROPERTY_SPAN_25, value, this);
    }
  }

  get northOutward(): boolean { return this._northOutward; }
  set northOutward(value: boolean) {
    if (this._northOutward !== value) {
      this._northOutward = value;
      this.appService.updateUserSetting(VIEW_ECLIPTIC, PROPERTY_ORIENTATION, value, this);
    }
  }

  get ecliptic(): boolean { return this._ecliptic; }
  set ecliptic(value: boolean) {
    if (this._ecliptic !== value) {
      this._ecliptic = value;
      this.appService.updateUserSetting(VIEW_ECLIPTIC, PROPERTY_ECLIPTIC_GRID, value, this);
    }
  }

  get celestial(): boolean { return this._celestial; }
  set celestial(value: boolean) {
    if (this._celestial !== value) {
      this._celestial = value;
      this.appService.updateUserSetting(VIEW_ECLIPTIC, PROPERTY_CELESTIAL_EQUATOR, value, this);
    }
  }

  get showConstellations(): boolean { return this._showConstellations; }
  set showConstellations(value: boolean) {
    if (this._showConstellations !== value) {
      this._showConstellations = value;
      this.namesCategories.find(cat => cat.property === PROPERTY_LABEL_CONSTELLATIONS).disabled = !value;
      this.appService.updateUserSetting(VIEW_ECLIPTIC, PROPERTY_SHOW_CONSTELLATIONS, value, this);
    }
  }

  get localHorizon(): boolean { return this._localHorizon; }
  set localHorizon(value: boolean) {
    if (this._localHorizon !== value) {
      this._localHorizon = value;
      this.appService.updateUserSetting(VIEW_ECLIPTIC, PROPERTY_LOCAL_HORIZON, value, this);
    }
  }

  get showStars(): boolean { return this._showStars; }
  set showStars(value: boolean) {
    if (this._showStars !== value) {
      this._showStars = value;
      this.appService.updateUserSetting(VIEW_ECLIPTIC, PROPERTY_SHOW_STARS, value, this);
    }
  }

  get brightenStars(): boolean { return this._brightenStars; }
  set brightenStars(value: boolean) {
    if (this._brightenStars !== value) {
      this._brightenStars = value;
      this.appService.updateUserSetting(VIEW_ECLIPTIC, PROPERTY_BRIGHTEN_STARS, value, this);
    }
  }

  get topocentricMoon(): boolean { return this._topocentricMoon; }
  set topocentricMoon(value: boolean) {
    if (this._topocentricMoon !== value) {
      this._topocentricMoon = value;
      this.appService.updateUserSetting(VIEW_ECLIPTIC, PROPERTY_TOPOCENTRIC_MOON, value, this);
    }
  }

  get enlargeSunMoon(): boolean { return this._enlargeSunMoon; }
  set enlargeSunMoon(value: boolean) {
    if (this._enlargeSunMoon !== value) {
      this._enlargeSunMoon = value;
      this.appService.updateUserSetting(VIEW_ECLIPTIC, PROPERTY_ENLARGE_SUN_MOON, value, this);
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
      let value: boolean;

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
        this.appService.updateUserSetting(VIEW_ECLIPTIC, item.property, value, this);

        if (property === PROPERTY_LABEL_STARS && value)
          this.appService.updateUserSetting(VIEW_ECLIPTIC, PROPERTY_LABEL_BRIGHT_STARS, false, this);

        if (property === PROPERTY_LABEL_BRIGHT_STARS && value)
          this.appService.updateUserSetting(VIEW_ECLIPTIC, PROPERTY_LABEL_STARS, false, this);
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
