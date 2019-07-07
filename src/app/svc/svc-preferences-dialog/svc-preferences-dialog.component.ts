/*
  Copyright © 2017-2019 Kerry Shetline, kerry@shetline.com.

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

import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { getISOFormatDate, parseISODate, YMDDate } from 'ks-date-time-zone';
import { eventToKey } from 'ks-util';
import { MenuItem } from 'primeng/components/common/api';
import {
  AppService, CalendarSetting, CurrentTab, PROPERTY_DEFAULT_TAB, PROPERTY_GREGORIAN_CHANGE_DATE, PROPERTY_INK_SAVER, PROPERTY_NATIVE_DATE_TIME, PROPERTY_NORTH_AZIMUTH,
  PROPERTY_TWILIGHT_BY_DEGREES, PROPERTY_TWILIGHT_DEGREES, PROPERTY_TWILIGHT_MINUTES, VIEW_APP
} from '../../app.service';
import { KsDropdownComponent } from '../../widgets/ks-dropdown/ks-dropdown.component';
import { SvcTimeEditorComponent } from '../svc-time-editor/svc-time-editor.component';

interface MenuItemPlus extends MenuItem {
  value?: any;
}

@Component({
  selector: 'svc-preferences-dialog',
  templateUrl: './svc-preferences-dialog.component.html',
  styleUrls: ['./svc-preferences-dialog.component.scss']
})
export class SvcPreferencesDialogComponent {
  private _visible = false;
  private _calendarOption = CalendarSetting.STANDARD;
  private _twilightByDegrees = true;
  private twilightDegrees = 12;
  private twilightMinutes = 80;

  @ViewChild('defaultLocationDropdown', { static: true }) private defaultLocationDropdown: KsDropdownComponent;

// SKY, ECLIPTIC, ORBITS, MOONS_GRS, INSOLATION, MAP, CALENDAR, TIME, TABLES
  tabs: MenuItemPlus[] = [
    {label: 'Sky',        value: CurrentTab.SKY},
    {label: 'Ecliptic',   value: CurrentTab.ECLIPTIC},
    {label: 'Orbits',     value: CurrentTab.ORBITS},
    {label: 'Moons/GRS',  value: CurrentTab.MOONS_GRS},
    {label: 'Insolation', value: CurrentTab.INSOLATION},
    {label: 'Map',        value: CurrentTab.MAP},
    {label: 'Calendar',   value: CurrentTab.CALENDAR},
    {label: 'Time',       value: CurrentTab.TIME},
    {label: 'Tables',     value: CurrentTab.TABLES}
  ];

  azimuths: MenuItemPlus[] = [
    {label: 'Due south is 0°, azimuth increases westward', value: false},
    {label: 'Due north is 0°, azimuth increases eastward', value: true}
  ];

  twilightOptions: MenuItemPlus[] = [
    {label: 'Sun, degrees below horizon (1-18):', value: true},
    {label: 'Minutes before sunrise/after sunset (4-160):', value: false}
  ];

  calendarOptions: MenuItemPlus[] = [
    {label: 'Gregorian calendar starting 1582-10-15', value: CalendarSetting.STANDARD},
    {label: 'Pure Gregorian calendar', value: CalendarSetting.PURE_GREGORIAN},
    {label: 'Pure Julian calendar', value: CalendarSetting.PURE_JULIAN},
    {label: 'Gregorian calendar starting (YYYY-MM-DD):', value: CalendarSetting.CUSTOM_GCD}
  ];

  inkSaverOptions: MenuItemPlus[] = [
    {label: 'Print black stars on white background, etc.', value: true},
    {label: 'Print using on-screen colors', value: false}
  ];

  dateTimeOptions: MenuItemPlus[] = [
    {label: 'Use web browser\'s own date/time input method (no years BCE)', value: true},
    {label: 'Use Sky View Café date/time input method', value: false}
  ];

  locations: string[] = [''];
  defaultLocation = '';
  defaultTab = CurrentTab.SKY;
  northAzimuth = false;
  twilightValue = this.twilightDegrees;
  gcdVisible = true;
  gcdDisabled = true;
  gcdValue: YMDDate = {y: 1582, m: 10, d: 15};
  formValid = true;
  invalidMessage = '';
  inkSaver = true;
  nativeDateTime = false;
  showDateTimeOptions = SvcTimeEditorComponent.supportsNativeDateTime;
  resetWarnings = false;
  get dialogSize(): string { return SvcTimeEditorComponent.supportsNativeDateTime ? '590!,335' : '590!,300'; }

  @Input() get visible(): boolean { return this._visible; }
  set visible(isVisible: boolean) {
    if (this._visible !== isVisible) {
      this._visible = isVisible;
      this.visibleChange.emit(isVisible);

      if (isVisible) {
        this.northAzimuth = this.appService.northAzimuth;
        this.defaultTab = this.appService.defaultTab;
        this.twilightDegrees = this.appService.twilightDegrees;
        this.twilightMinutes = this.appService.twilightMinutes;
        this.twilightByDegrees = this.appService.twilightByDegrees;
        this.twilightValue = (this.twilightByDegrees ? this.twilightDegrees : this.twilightMinutes);
        this.calendarOption = this.appService.calendarType;
        this.inkSaver = this.appService.inkSaver;
        this.nativeDateTime = this.appService.nativeDateTime;

        const gcd = this.appService.gregorianChangeDate;

        if (!/[gj]/i.test(gcd))
          this.gcdValue = parseISODate(gcd);

        this.locations = [];

        for (const location of this.appService.locations) {
          this.locations.push(location.name);

          if (!this.defaultLocation || location.isDefault)
            this.defaultLocation = location.name;
        }

        if (this.locations.length === 0)
          this.locations.push('');

        setTimeout(() => this.defaultLocationDropdown.applyFocus());
      }
    }
  }
  @Output() visibleChange: EventEmitter<any> = new EventEmitter();

  get twilightByDegrees(): boolean { return this._twilightByDegrees; }
  set twilightByDegrees(value) {
    if (this._twilightByDegrees !== value) {
      this._twilightByDegrees = value;
      this.twilightValue = (value ? this.twilightDegrees : this.twilightMinutes);
      this.onTwilightChange(String(this.twilightValue));
    }
  }

  @Input() get calendarOption(): CalendarSetting { return this._calendarOption; }
  set calendarOption(value: CalendarSetting) {
    if (this._calendarOption !== value) {
      this._calendarOption = value;
      this.calendarOptionChange.emit(value);

      switch (value) {
        case CalendarSetting.STANDARD:
          this.gcdVisible = true;
          this.gcdDisabled = true;
          this.gcdValue = {y: 1582, m: 10, d: 15};
          break;

        case CalendarSetting.PURE_GREGORIAN:
          this.gcdVisible = false;
          this.gcdDisabled = true;
          break;

        case CalendarSetting.PURE_JULIAN:
          this.gcdVisible = false;
          this.gcdDisabled = true;
          break;

        case CalendarSetting.CUSTOM_GCD:
          this.gcdVisible = true;
          this.gcdDisabled = false;
          break;
      }
    }
  }
  @Output() calendarOptionChange = new EventEmitter();

  constructor(private appService: AppService) {
  }

  onKey(event: KeyboardEvent): void {
    const key = eventToKey(event);

    if (key === 'Enter') {
      event.preventDefault();
      this.setPreferences();
    }
  }

  setPreferences(): void {
    if (!this.formValid)
      return;

    this.appService.updateUserSetting({view: VIEW_APP, property: PROPERTY_NORTH_AZIMUTH, value: this.northAzimuth, source: this});
    this.appService.updateUserSetting({view: VIEW_APP, property: PROPERTY_INK_SAVER, value: this.inkSaver, source: this});
    this.appService.updateUserSetting({view: VIEW_APP, property: PROPERTY_NATIVE_DATE_TIME, value: this.nativeDateTime, source: this});
    this.appService.updateUserSetting({view: VIEW_APP, property: PROPERTY_DEFAULT_TAB, value: this.defaultTab, source: this});
    this.appService.updateUserSetting({view: VIEW_APP, property: PROPERTY_TWILIGHT_BY_DEGREES, value: this.twilightByDegrees, source: this});

    if (this.twilightByDegrees)
      this.appService.updateUserSetting({view: VIEW_APP, property: PROPERTY_TWILIGHT_DEGREES, value: this.twilightDegrees, source: this});
    else
      this.appService.updateUserSetting({view: VIEW_APP, property: PROPERTY_TWILIGHT_MINUTES, value: this.twilightMinutes, source: this});

    let gcd = getISOFormatDate(this.gcdValue);

    if (this.calendarOption === CalendarSetting.PURE_GREGORIAN)
      gcd = 'G';
    else if (this.calendarOption === CalendarSetting.PURE_JULIAN)
      gcd = 'J';

    this.appService.updateUserSetting({view: VIEW_APP, property: PROPERTY_GREGORIAN_CHANGE_DATE, value: gcd, source: this});

    if (this.defaultLocation)
      this.appService.setDefaultLocationByName(this.defaultLocation);

    if (this.resetWarnings)
      this.appService.resetWarnings();

    this.visible = false;
  }

  onTwilightChange(value: string | EventTarget): void {
    if (value && typeof value !== 'string')
      value = (value as HTMLInputElement).value;

    value = value || (value as any) === 0 ? value.toString() : '';

    if (!/^\d{0,4}$/.test(value)) {
      this.formValid = false;
      this.invalidMessage = 'Invalid value.';

      return;
    }

    const val = Number(value);

    this.formValid = ((this.twilightByDegrees && 1 <= val && val <= 18) ||
                      (!this.twilightByDegrees && 4 <= val && val <= 160));

    if (!this.formValid) {
      if (value.length === 0)
        this.invalidMessage = 'Twilight value is required.';
      else
        this.invalidMessage = this.twilightByDegrees ? 'Must be a value from 1 to 18 degrees.' : 'Must be a value from 4 to 160 minutes.';
    }
    else if (this.twilightByDegrees)
      this.twilightDegrees = val;
    else
      this.twilightMinutes = val;
  }
}
