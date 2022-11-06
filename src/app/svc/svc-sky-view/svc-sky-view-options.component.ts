import { AfterViewInit, Component } from '@angular/core';
import { MenuItem, SelectItem } from 'primeng/api';
import { AppService, UserSetting } from '../../app.service';
import { ALL_DEEP_SKY, NO_DEEP_SKY } from '../generic-sky-view.directive';
import { PROPERTY_ADDITIONALS } from '../generic-view.directive';
import { SvcGenericOptionsComponent } from '../svc-generic-options.component';
import {
  PROPERTY_BRIGHTEN_STARS, PROPERTY_CELESTIAL_GRID, PROPERTY_ECLIPTIC_GRID, PROPERTY_ENLARGE_SUN_MOON, PROPERTY_LABEL_BRIGHT_STARS,
  PROPERTY_LABEL_CONSTELLATIONS, PROPERTY_LABEL_DSOS, PROPERTY_LABEL_PLANETS,
  PROPERTY_LABEL_STARS, PROPERTY_PATH_OF_MOON, PROPERTY_PATH_OF_SUN,
  PROPERTY_REFRACTION, PROPERTY_SHOW_CONSTELLATIONS, PROPERTY_SHOW_MILKY_WAY, PROPERTY_SKY_COLOR,
  PROPERTY_VIEW_TYPE, SKY_COLOR, VIEW_SKY, VIEW_TYPE,
} from './svc-sky-view.component';

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
  selector: 'svc-sky-view-options',
  templateUrl: './svc-sky-view-options.component.html',
  styleUrls: ['./svc-sky-view-options.component.scss']
})
export class SvcSkyViewOptionsComponent extends SvcGenericOptionsComponent implements AfterViewInit {
  private _viewType = VIEW_TYPE.FULL_SKY_FLAT;
  private _skyColor = SKY_COLOR.MULTI;
  private _refraction = true;
  private _celestial = false;
  private _ecliptic = false;
  private _pathOfSun = false;
  private _pathOfMoon = false;
  private _brightenStars = false;
  private _showConstellations = false;
  private _enlargeSunMoon = false;
  private _showMilkyWay = false;
  private deepSkyLabelMagnitude = NO_DEEP_SKY;

  viewTypes: SelectItem[] = [
    { label: 'Full Sky - Flat',     value: VIEW_TYPE.FULL_SKY_FLAT },
    { label: 'Full Sky - Dome',     value: VIEW_TYPE.FULL_SKY_DOME },
    { label: 'Horizon - 45° Span',  value: VIEW_TYPE.HORIZON_45 },
    { label: 'Horizon - 90° Span',  value: VIEW_TYPE.HORIZON_90 },
    { label: 'Horizon - 120° Span', value: VIEW_TYPE.HORIZON_120 },
    { label: 'Horizon to Zenith',   value: VIEW_TYPE.HORIZON_TO_ZENITH },
    { label: 'Zenith - 100° Span',  value: VIEW_TYPE.ZENITH_100 },
    { label: 'Moon - 2° Span',      value: VIEW_TYPE.MOON_CLOSEUP_2 },
    { label: 'Moon - 4° Span',      value: VIEW_TYPE.MOON_CLOSEUP_4 },
    { label: 'Moon - 8° Span',      value: VIEW_TYPE.MOON_CLOSEUP_8 },
    { label: 'Moon - 16° Span',     value: VIEW_TYPE.MOON_CLOSEUP_16 },
    { label: 'Sun - 2° Span',       value: VIEW_TYPE.SUN_CLOSEUP_2 },
    { label: 'Sun - 4° Span',       value: VIEW_TYPE.SUN_CLOSEUP_4 },
    { label: 'Sun - 8° Span',       value: VIEW_TYPE.SUN_CLOSEUP_8 },
    { label: 'Sun - 16° Span',      value: VIEW_TYPE.SUN_CLOSEUP_16 },
  ];

  skyColors: SelectItem[] = [
    { label: 'Sky Color: Basic',      value: SKY_COLOR.BASIC },
    { label: 'Sky Color: Black',      value: SKY_COLOR.BLACK },
    { label: 'Sky Color: Multicolor', value: SKY_COLOR.MULTI }
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
    super(appService, VIEW_SKY);

    appService.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_SKY && setting.source !== this) {
        if (setting.property === PROPERTY_VIEW_TYPE)
          this.viewType = setting.value as VIEW_TYPE;
        else if (setting.property === PROPERTY_SKY_COLOR)
          this.skyColor = setting.value as SKY_COLOR;
        else if (setting.property === PROPERTY_REFRACTION)
          this.refraction = setting.value as boolean;
        else if (setting.property === PROPERTY_CELESTIAL_GRID)
          this.celestial = setting.value as boolean;
        else if (setting.property === PROPERTY_ECLIPTIC_GRID)
          this.ecliptic = setting.value as boolean;
        else if (setting.property === PROPERTY_PATH_OF_SUN)
          this.pathOfSun = setting.value as boolean;
        else if (setting.property === PROPERTY_PATH_OF_MOON)
          this.pathOfMoon = setting.value as boolean;
        else if (setting.property === PROPERTY_BRIGHTEN_STARS)
          this.brightenStars = setting.value as boolean;
        else if (setting.property === PROPERTY_SHOW_CONSTELLATIONS)
          this.showConstellations = setting.value as boolean;
        else if (setting.property === PROPERTY_ENLARGE_SUN_MOON)
          this.enlargeSunMoon = setting.value as boolean;
        else if (setting.property === PROPERTY_SHOW_MILKY_WAY)
          this.showMilkyWay = setting.value as boolean;
        else if (setting.property === PROPERTY_ADDITIONALS)
          this.additional = setting.value as string;
        else if (setting.property === PROPERTY_LABEL_PLANETS ||
                 setting.property === PROPERTY_LABEL_BRIGHT_STARS ||
                 setting.property === PROPERTY_LABEL_STARS ||
                 setting.property === PROPERTY_LABEL_CONSTELLATIONS)
          this.updateShowNames(setting.property, setting.value as boolean);
        else if (setting.property === PROPERTY_LABEL_DSOS) {
          this.deepSkyLabelMagnitude = setting.value as number;
          this.adjustShowNamesMenu(setting.property);
        }
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.appService.requestViewSettings(VIEW_SKY));
  }

  get viewType(): VIEW_TYPE { return this._viewType; }
  set viewType(value: VIEW_TYPE) {
    if (this._viewType !== value) {
      this._viewType = value;
      this.appService.updateUserSetting(VIEW_SKY, PROPERTY_VIEW_TYPE, value, this);
    }
  }

  get skyColor(): SKY_COLOR { return this._skyColor; }
  set skyColor(value: SKY_COLOR) {
    if (this._skyColor !== value) {
      this._skyColor = value;
      this.appService.updateUserSetting(VIEW_SKY, PROPERTY_SKY_COLOR, value, this);
    }
  }

  get refraction(): boolean { return this._refraction; }
  set refraction(value: boolean) {
    if (this._refraction !== value) {
      this._refraction = value;
      this.appService.updateUserSetting(VIEW_SKY, PROPERTY_REFRACTION, value, this);
    }
  }

  get celestial(): boolean { return this._celestial; }
  set celestial(value: boolean) {
    if (this._celestial !== value) {
      this._celestial = value;
      this.appService.updateUserSetting(VIEW_SKY, PROPERTY_CELESTIAL_GRID, value, this);
    }
  }

  get ecliptic(): boolean { return this._ecliptic; }
  set ecliptic(value: boolean) {
    if (this._ecliptic !== value) {
      this._ecliptic = value;
      this.appService.updateUserSetting(VIEW_SKY, PROPERTY_ECLIPTIC_GRID, value, this);
    }
  }

  get pathOfSun(): boolean { return this._pathOfSun; }
  set pathOfSun(value: boolean) {
    if (this._pathOfSun !== value) {
      this._pathOfSun = value;
      this.appService.updateUserSetting(VIEW_SKY, PROPERTY_PATH_OF_SUN, value, this);
    }
  }

  get pathOfMoon(): boolean { return this._pathOfMoon; }
  set pathOfMoon(value: boolean) {
    if (this._pathOfMoon !== value) {
      this._pathOfMoon = value;
      this.appService.updateUserSetting(VIEW_SKY, PROPERTY_PATH_OF_MOON, value, this);
    }
  }

  get brightenStars(): boolean { return this._brightenStars; }
  set brightenStars(value: boolean) {
    if (this._brightenStars !== value) {
      this._brightenStars = value;
      this.appService.updateUserSetting(VIEW_SKY, PROPERTY_BRIGHTEN_STARS, value, this);
    }
  }

  get showConstellations(): boolean { return this._showConstellations; }
  set showConstellations(value: boolean) {
    if (this._showConstellations !== value) {
      this._showConstellations = value;
      this.namesCategories.find(cat => cat.property === PROPERTY_LABEL_CONSTELLATIONS).disabled = !value;
      this.appService.updateUserSetting(VIEW_SKY, PROPERTY_SHOW_CONSTELLATIONS, value, this);
    }
  }

  get enlargeSunMoon(): boolean { return this._enlargeSunMoon; }
  set enlargeSunMoon(value: boolean) {
    if (this._enlargeSunMoon !== value) {
      this._enlargeSunMoon = value;
      this.appService.updateUserSetting(VIEW_SKY, PROPERTY_ENLARGE_SUN_MOON, value, this);
    }
  }

  get showMilkyWay(): boolean { return this._showMilkyWay; }
  set showMilkyWay(value: boolean) {
    if (this._showMilkyWay !== value) {
      this._showMilkyWay = value;
      this.appService.updateUserSetting(VIEW_SKY, PROPERTY_SHOW_MILKY_WAY, value, this);
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
        this.appService.updateUserSetting(VIEW_SKY, item.property, value, this);

        if (property === PROPERTY_LABEL_STARS && value)
          this.appService.updateUserSetting(VIEW_SKY, PROPERTY_LABEL_BRIGHT_STARS, false, this);

        if (property === PROPERTY_LABEL_BRIGHT_STARS && value)
          this.appService.updateUserSetting(VIEW_SKY, PROPERTY_LABEL_STARS, false, this);
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
