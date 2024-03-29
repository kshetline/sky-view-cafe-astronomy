import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { TimeEditorComponent } from '@tubular/ng-widgets';
import { eventToKey } from '@tubular/util';
import { MenuItem } from 'primeng/api';
import {
  AppService, CalendarSetting, CurrentTab, ClockStyle, LatLongStyle, PROPERTY_DEFAULT_TAB, PROPERTY_GREGORIAN_CHANGE_DATE,
  PROPERTY_INK_SAVER, PROPERTY_LAT_LONG_STYLE, PROPERTY_NATIVE_DATE_TIME, PROPERTY_NORTH_AZIMUTH, PROPERTY_TWILIGHT_BY_DEGREES,
  PROPERTY_TWILIGHT_DEGREES, PROPERTY_TWILIGHT_MINUTES, VIEW_APP, PROPERTY_CLOCK_STYLE, PROPERTY_RESTORE_LAST_STATE
} from '../../app.service';
import { KsDropdownComponent } from '../../widgets/ks-dropdown/ks-dropdown.component';

interface MenuItemPlus extends MenuItem {
  value?: any;
}

const standardGregorian = '1582-10-15';

@Component({
  selector: 'svc-preferences-dialog',
  templateUrl: './svc-preferences-dialog.component.html',
  styleUrls: ['./svc-preferences-dialog.component.scss']
})
export class SvcPreferencesDialogComponent {
  ISO_SEC = ClockStyle.ISO_SEC;
  LOCAL_SEC = ClockStyle.LOCAL_SEC;

  private _visible = false;
  private _calendarOption = CalendarSetting.STANDARD;
  private _twilightByDegrees = true;
  private twilightDegrees = 12;
  private twilightMinutes = 80;

  @ViewChild('defaultLocationDropdown', { static: true }) private defaultLocationDropdown: KsDropdownComponent;

  startUpOptions: MenuItemPlus[] = [
    { label: 'Current time, default location, default view', value: false },
    { label: 'Last used time, location, and view', value: true }
  ];

// SKY, ECLIPTIC, ORBITS, MOONS_GRS, INSOLATION, MAP, CALENDAR, TIME, TABLES
  tabs: MenuItemPlus[] = [
    { label: 'Sky',        value: CurrentTab.SKY },
    { label: 'Ecliptic',   value: CurrentTab.ECLIPTIC },
    { label: 'Orbits',     value: CurrentTab.ORBITS },
    { label: 'Moons/GRS',  value: CurrentTab.MOONS_GRS },
    { label: 'Insolation', value: CurrentTab.INSOLATION },
    { label: 'Map',        value: CurrentTab.MAP },
    { label: 'Calendar',   value: CurrentTab.CALENDAR },
    { label: 'Time',       value: CurrentTab.TIME },
    { label: 'Tables',     value: CurrentTab.TABLES }
  ];

  clockStyles: MenuItemPlus[] = [
    { label: 'ISO-8601 (±YYYY-MM-DD HH:mm), always 24-hour time', value: ClockStyle.ISO },
    { label: 'Localized time format, possibly with AM/PM', value: ClockStyle.LOCAL },
    { label: 'ISO-8601 (±YYYY-MM-DD HH:mm:ss), 24-hour with seconds', value: ClockStyle.ISO_SEC },
    { label: 'Localized time format with seconds, possibly AM/PM', value: ClockStyle.LOCAL_SEC }
  ];

  latLongStyles: MenuItemPlus[] = [
    { label: 'Using degrees and minutes', value: LatLongStyle.DEGREES_AND_MINUTES },
    { label: 'Using decimal degrees', value: LatLongStyle.DECIMAL }
  ];

  azimuths: MenuItemPlus[] = [
    { label: 'Due south is 0°, azimuth increases westward', value: false },
    { label: 'Due north is 0°, azimuth increases eastward', value: true }
  ];

  twilightOptions: MenuItemPlus[] = [
    { label: 'Sun, degrees below horizon (1-18):', value: true },
    { label: 'Minutes before sunrise/after sunset (4-160):', value: false }
  ];

  calendarOptions: MenuItemPlus[] = [
    { label: 'Gregorian calendar starting 1582-10-15', value: CalendarSetting.STANDARD },
    { label: 'Pure Gregorian calendar', value: CalendarSetting.PURE_GREGORIAN },
    { label: 'Pure Julian calendar', value: CalendarSetting.PURE_JULIAN },
    { label: 'Gregorian calendar starting (YYYY-MM-DD):', value: CalendarSetting.CUSTOM_GCD }
  ];

  inkSaverOptions: MenuItemPlus[] = [
    { label: 'Print black stars on white background, etc.', value: true },
    { label: 'Print using on-screen colors', value: false }
  ];

  dateTimeOptions: MenuItemPlus[] = [
    { label: "Use web browser's own date/time input method (no years BCE)", value: true },
    { label: 'Use Sky View Café date/time input method', value: false }
  ];

  locations: string[] = [''];
  defaultLocation = '';
  defaultTab = CurrentTab.SKY;
  clockStyle = ClockStyle.ISO;
  latLongStyle = LatLongStyle.DEGREES_AND_MINUTES;
  northAzimuth = false;
  twilightValue = this.twilightDegrees;
  gcdVisible = true;
  gcdDisabled = true;
  gcdValue = standardGregorian;
  formValid = true;
  invalidMessage = '';
  inkSaver = true;
  nativeDateTime = false;
  showDateTimeOptions = TimeEditorComponent.supportsNativeDateTime;
  startUpOption = false;
  resetWarnings = false;

  @Input() get visible(): boolean { return this._visible; }
  set visible(isVisible: boolean) {
    if (this._visible !== isVisible) {
      this._visible = isVisible;
      this.visibleChange.emit(isVisible);

      if (isVisible) {
        this.startUpOption = !!this.app.getUserSetting(VIEW_APP, PROPERTY_RESTORE_LAST_STATE);
        this.clockStyle = this.app.clockStyle;
        this.latLongStyle = this.app.latLongStyle;
        this.northAzimuth = this.app.northAzimuth;
        this.defaultTab = this.app.defaultTab;
        this.twilightDegrees = this.app.twilightDegrees;
        this.twilightMinutes = this.app.twilightMinutes;
        this.twilightByDegrees = this.app.twilightByDegrees;
        this.twilightValue = (this.twilightByDegrees ? this.twilightDegrees : this.twilightMinutes);
        this.invalidMessage = '';
        this.calendarOption = this.app.calendarType;
        this.inkSaver = this.app.inkSaver;
        this.nativeDateTime = this.app.nativeDateTime;
        this.resetWarnings = false;

        const gcd = this.app.gregorianChangeDate;

        if (!/[gj]/i.test(gcd))
          this.gcdValue = gcd;

        this.locations = [];

        for (const location of this.app.locations) {
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
          this.gcdValue = standardGregorian;
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

  constructor(private app: AppService) {}

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

    this.app.updateUserSetting(VIEW_APP, PROPERTY_RESTORE_LAST_STATE, this.startUpOption, this);
    this.app.updateUserSetting(VIEW_APP, PROPERTY_NORTH_AZIMUTH, this.northAzimuth, this);
    this.app.updateUserSetting(VIEW_APP, PROPERTY_INK_SAVER, this.inkSaver, this);
    this.app.updateUserSetting(VIEW_APP, PROPERTY_CLOCK_STYLE, this.clockStyle, this);
    this.app.updateUserSetting(VIEW_APP, PROPERTY_LAT_LONG_STYLE, this.latLongStyle, this);
    this.app.updateUserSetting(VIEW_APP, PROPERTY_NATIVE_DATE_TIME, this.nativeDateTime, this);
    this.app.updateUserSetting(VIEW_APP, PROPERTY_DEFAULT_TAB, this.defaultTab, this);
    this.app.updateUserSetting(VIEW_APP, PROPERTY_TWILIGHT_BY_DEGREES, this.twilightByDegrees, this);

    if (this.twilightByDegrees)
      this.app.updateUserSetting(VIEW_APP, PROPERTY_TWILIGHT_DEGREES, this.twilightDegrees, this);
    else
      this.app.updateUserSetting(VIEW_APP, PROPERTY_TWILIGHT_MINUTES, this.twilightMinutes, this);

    let gcd = this.gcdValue;

    if (this.calendarOption === CalendarSetting.PURE_GREGORIAN)
      gcd = 'G';
    else if (this.calendarOption === CalendarSetting.PURE_JULIAN)
      gcd = 'J';

    this.app.updateUserSetting(VIEW_APP, PROPERTY_GREGORIAN_CHANGE_DATE, gcd, this);

    if (this.defaultLocation)
      this.app.setDefaultLocationByName(this.defaultLocation);

    if (this.resetWarnings)
      this.app.resetWarnings();

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

    this.formValid = ((this.twilightByDegrees && val >= 1 && val <= 18) ||
                      (!this.twilightByDegrees && val >= 4 && val <= 160));

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
