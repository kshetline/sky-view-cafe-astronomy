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

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { SolarSystem, StarCatalog } from 'ks-astronomy';
import { KsCalendar } from 'ks-date-time-zone';
import { ceil } from 'ks-math';
import { clone, compact, debounce, forEach, isEqual, isString, sortedIndexBy } from 'lodash';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { AstroDataService } from './astronomy/astro-data.service';

export const SVC_MIN_YEAR = -6000;
export const SVC_MAX_YEAR = 9999;

export const  VIEW_APP = 'app';
export const    PROPERTY_NORTH_AZIMUTH = 'north_azimuth';
export const    PROPERTY_DEFAULT_TAB = 'default_tab';
export const    PROPERTY_TWILIGHT_BY_DEGREES = 'twilight_by_degrees';
export const    PROPERTY_TWILIGHT_DEGREES = 'twilight_degrees';
export const    PROPERTY_TWILIGHT_MINUTES = 'twilight_minutes';
export const    PROPERTY_GREGORIAN_CHANGE_DATE = 'gregorian_change_date';
export const    PROPERTY_INK_SAVER = 'ink_saver';

export const NEW_LOCATION = '(new location)';

export function currentMinuteMillis(): number {
  return Math.floor(Date.now() / 60000) * 60000;
}

export enum CurrentTab {SKY, ECLIPTIC, ORBITS, MOONS_GRS, INSOLATION, MAP, CALENDAR, TIME, TABLES}
const tabNames = ['sky', 'ecliptic', 'orbits', 'moons', 'insolation', 'map', 'calendar', 'time', 'tables'];
export enum CalendarSetting {STANDARD, PURE_GREGORIAN, PURE_JULIAN, CUSTOM_GCD}

export interface AppEvent {
  name: string;
  value?: any;
}

export class Location {
  isDefault?: boolean;

  constructor(public name: string, public latitude: number, public longitude: number,
              public zone: string, isDefault?: boolean) {
    this.isDefault = !!isDefault;
  }

  static fromString(s: string): Location {
    const parts = s.split('\t');

    if (parts.length === 5)
      return new Location(parts[0], Number(parts[1]), Number(parts[2]), parts[3], parts[4] === 'true');

    return null;
  }

  static fromStringList(s: string): Location[] {
    const locations = s.split('\n');

    return locations.map((location: string) => Location.fromString(location));
  }

  static toStringList(locations: Location[]): string {
    const strLocations = locations.map((location: Location) => location.toString());

    return strLocations.join('\n');
  }

  toString(): string {
    return [this.name, this.latitude, this.longitude, this.zone, Boolean(this.isDefault)].join('\t');
  }
}

export interface UserSetting {
  view: string;
  property: string;
  value: boolean | number | string;
  source: any;
}

interface IpLocation {
  city: string;
  countryCode: string;
  lat: number;
  lon: number;
  region: string;
  status: string;
  timezone: string;
}

@Injectable()
export class AppService {
  private _appEvent = new BehaviorSubject<AppEvent>({name: 'non-event'});
  private appEventObserver: Observable<AppEvent> = this._appEvent.asObservable();
  private _time = new BehaviorSubject<number>(currentMinuteMillis());
  private timeObserver: Observable<number> = this._time.asObservable();
  private defaultLocation: Location = new Location('(Greenwich Observatory)', 51.47, 0, 'UT');
  private _location = new BehaviorSubject<Location>(this.defaultLocation);
  private locationObserver: Observable<Location> = this._location.asObservable();
  private _locations: Location[] = [];
  private _solarSystem = new SolarSystem();
  private _starCatalog: StarCatalog;
  private _starsReady = new BehaviorSubject<boolean>(false);
  private starsReadyObserver: Observable<boolean> = this._starsReady.asObservable();
  private _asteroidsReady = new BehaviorSubject<boolean>(false);
  private asteroidsReadyObserver: Observable<boolean> = this._asteroidsReady.asObservable();
  private _currentTab = new BehaviorSubject<CurrentTab>(CurrentTab.SKY);
  private currentTabObserver: Observable<CurrentTab> = this._currentTab.asObservable();
  private settingsSource = new Subject<UserSetting>();
  private settingsObserver: Observable<UserSetting> = this.settingsSource.asObservable();
  private allSettings: {[view: string]: {[setting: string]: boolean | number | string}} = {};
  private debouncedSaveSettings: () => void;
  private knownIanaTimezones: Set<string>;
  private _northAzimuth = false;
  private _defaultTab = CurrentTab.SKY;
  private _twilightByDegrees = true;
  private _twilightDegrees = 12;
  private _twilightMinutes = 80;
  private _gcDate = '1582-10-15';
  private _inkSaver = true;
  private hostname: string;

  constructor(astroDataService: AstroDataService, private httpClient: HttpClient, private _sanitizer: DomSanitizer,
              private router: Router) {
    this.hostname = document.location.hostname;

    const savedLocationsString = localStorage.getItem('locations');

    if (savedLocationsString)
      this._locations = compact(Location.fromStringList(savedLocationsString));

    if (this._locations.length > 0) {
      const userDefault = this._locations.findIndex(location => location.isDefault);

      this.location = this._locations[Math.max(userDefault, 0)];
    }
    else
      this.getLocationFromIp();

    this._starCatalog = new StarCatalog(astroDataService, (initialized: boolean) => {
      this._starsReady.next(initialized);
    });

    SolarSystem.initAsteroidsAndComets(astroDataService).then(initialized => {
      this._asteroidsReady.next(initialized);
    });

    const savedSettings = localStorage.getItem('allSettings');

    if (savedSettings) {
      this.allSettings = JSON.parse(savedSettings);

      const appSettings = this.allSettings[VIEW_APP];

      if (appSettings) {
        for (const property in appSettings) {
          if (appSettings.hasOwnProperty(property))
            this.checkAppSetting(property, appSettings[property]);
        }
      }
    }

    this.debouncedSaveSettings = debounce(() => {
      localStorage.setItem('allSettings', JSON.stringify(this.allSettings));
    }, 1000);

    router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        const url = event.url;
        const newTab = tabNames.map(name => '/' + name).indexOf(url);

        if (newTab >= 0)
          this.currentTab = newTab;
        else
          this.currentTab = CurrentTab.SKY;
      }
    });
  }

  static get title(): string { return 'Sky View Café'; }

  get sanitizer(): DomSanitizer { return this._sanitizer; }

  getAppEventUpdates(callback: (appEvent: AppEvent) => void): Subscription {
    return this.appEventObserver.subscribe(callback);
  }
  sendAppEvent(appEventOrName: AppEvent | string, value?: any): void {
    if (isString(appEventOrName))
      this._appEvent.next({name: appEventOrName, value: value});
    else
      this._appEvent.next(appEventOrName);
  }

  getRightEdgeOfViewArea(): number {
    const qt = window.document.getElementById('quickTips');
    const lo = window.document.getElementById('locationAndOptions');

    return ceil(window.document.documentElement.clientWidth - qt.getBoundingClientRect().width - lo.getBoundingClientRect().width);
  }

  get time(): number { return this._time.getValue(); }
  set time(newTime: number) {
    if (this._time.getValue() !== newTime)
      this._time.next(newTime);
  }
  getTimeUpdates(callback: (time: number) => void): Subscription {
    return this.timeObserver.subscribe(callback);
  }

  get location(): Location { return this._location.getValue(); }
  set location(newObserver: Location) {
    if (!isEqual(this._location.getValue(), newObserver))
      this._location.next(newObserver);
  }
  getLocationUpdates(callback: (observer: Location) => void): Subscription {
    return this.locationObserver.subscribe(callback);
  }

  get latitude(): number { return this._location.getValue().latitude; }
  set latitude(newLatitude: number) {
    if (this._location.getValue().latitude !== newLatitude) {
      const newLocation = clone(this._location.getValue());

      newLocation.latitude = newLatitude;
      this.renameIfMatchesSavedLocation(newLocation);
      this._location.next(newLocation);
    }
  }

  get longitude(): number { return this._location.getValue().longitude; }
  set longitude(newLongitude: number) {
    if (this._location.getValue().longitude !== newLongitude) {
      const newLocation = clone(this._location.getValue());

      newLocation.longitude = newLongitude;
      this.renameIfMatchesSavedLocation(newLocation);
      this._location.next(newLocation);
    }
  }

  get timeZone(): string { return this._location.getValue().zone; }
  set timeZone(newZone: string) {
    if (this._location.getValue().zone !== newZone) {
      const newLocation = clone(this._location.getValue());

      newLocation.zone = newZone;
      this.renameIfMatchesSavedLocation(newLocation);
      this._location.next(newLocation);
    }
  }

  get locations(): Location[] { return this._locations; }

  addLocation(location: Location): void {
    if (location.isDefault)
      this._locations.forEach(loc => loc.isDefault = false);

    // If a location already exists by the same name, modify that location rather than adding a new one.
    const oldIndex = this._locations.findIndex(loc => loc.name === location.name);

    if (oldIndex >= 0)
      this._locations[oldIndex] = location;
    else
      this._locations.splice(sortedIndexBy(this._locations, location, 'name'), 0, location);

    localStorage.setItem('locations', Location.toStringList(this._locations));
  }

  deleteLocation(locationName: string): void {
    const index = this._locations.findIndex(loc => loc.name === locationName);

    if (index >= 0) {
      const deletedLocation = this._locations.splice(index, 1)[0];
      localStorage.setItem('locations', Location.toStringList(this._locations));

      if (this._location.getValue().name === deletedLocation.name) {
        const newLocation = clone(this._location.getValue());

        newLocation.name = NEW_LOCATION;
        this._location.next(newLocation);
      }
    }
  }

  setDefaultLocationByName(name: string): void {
    const match = this.locations.find(loc => loc.name === name);

    if (match) {
      this._locations.forEach(loc => loc.isDefault = false);
      match.isDefault = true;
      localStorage.setItem('locations', Location.toStringList(this._locations));
    }
  }

  get currentTab(): CurrentTab { return this._currentTab.getValue(); }
  set currentTab(newTab: CurrentTab) {
    if (this._currentTab.getValue() !== newTab) {
      this._currentTab.next(newTab);
      this.router.navigate(['/' + tabNames[this._currentTab.getValue()]]);
    }
  }
  getCurrentTabUpdates(callback: (tabIndex: CurrentTab) => void): Subscription {
    return this.currentTabObserver.subscribe(callback);
  }

  getUserSettingUpdates(callback: (setting: UserSetting) => void): Subscription {
    return this.settingsObserver.subscribe(callback);
  }
  updateUserSetting(setting: UserSetting): void {
    let viewSettings = this.allSettings[setting.view];

    if (!viewSettings)
      viewSettings = this.allSettings[setting.view] = {};

    viewSettings[setting.property] = setting.value;
    this.debouncedSaveSettings();

    if (setting.view === VIEW_APP)
      this.checkAppSetting(setting.property, setting.value);

    this.settingsSource.next(setting);
  }
  requestViewSettings(view: string): void {
    const viewSettings = this.allSettings[view];

    if (viewSettings) {
      forEach(viewSettings, (value, property) => {
        const userSetting = {view: view, property: property, value: value, source: this};
        this.settingsSource.next(userSetting);
      });
    }
  }

  get solarSystem(): SolarSystem { return this._solarSystem; }

  get starCatalog(): StarCatalog { return this._starCatalog; }

  get starsReady(): boolean { return this._starsReady.getValue(); }
  getStarsReadyUpdate(callback: (initialized: boolean) => void): Subscription {
    return this.starsReadyObserver.subscribe(callback);
  }

  get asteroidsReady(): boolean { return this._asteroidsReady.getValue(); }
  getAsteroidsReadyUpdate(callback: (initialized: boolean) => void): Subscription {
    return this.asteroidsReadyObserver.subscribe(callback);
  }

  setKnownIanaTimezones(zones: Set<string>): void {
    this.knownIanaTimezones = zones;
  }

  isKnownIanaTimezone(zone: string): boolean {
    return this.knownIanaTimezones && this.knownIanaTimezones.has(zone);
  }

  get northAzimuth(): boolean { return this._northAzimuth; }

  get defaultTab(): CurrentTab { return this._defaultTab; }

  get twilightByDegrees(): boolean { return this._twilightByDegrees; }

  get twilightDegrees(): number { return this._twilightDegrees; }

  get twilightMinutes(): number { return this._twilightMinutes; }

  get gregorianChangeDate(): string { return this._gcDate; }

  get calendarType(): CalendarSetting {
    if ('1582-10-15' === this._gcDate)
      return CalendarSetting.STANDARD;
    else if ('g' === this._gcDate || 'G' === this._gcDate)
      return CalendarSetting.PURE_GREGORIAN;
    else if ('j' === this._gcDate || 'J' === this._gcDate)
      return CalendarSetting.PURE_JULIAN;
    else
      return CalendarSetting.CUSTOM_GCD;
  }

  applyCalendarType(dateTime: KsCalendar): void {
    if (dateTime)
      dateTime.setGregorianChange(this._gcDate);
  }

  get inkSaver(): boolean { return this._inkSaver; }

  private checkAppSetting(property: string, value: any): void {
    if (property === PROPERTY_NORTH_AZIMUTH)
      this._northAzimuth = <boolean> value;
    else if (property === PROPERTY_DEFAULT_TAB)
      this._defaultTab = <CurrentTab> value;
    else if (property === PROPERTY_TWILIGHT_BY_DEGREES)
      this._twilightByDegrees = <boolean> value;
    else if (property === PROPERTY_TWILIGHT_DEGREES)
      this._twilightDegrees = <number> value;
    else if (property === PROPERTY_TWILIGHT_MINUTES)
      this._twilightMinutes = <number> value;
    else if (property === PROPERTY_GREGORIAN_CHANGE_DATE)
      this._gcDate = <string> value;
    else if (property === PROPERTY_INK_SAVER)
      this._inkSaver = <boolean> value;
  }

  private renameIfMatchesSavedLocation(loc: Location): void {
    const match = this._locations.find(loc2 => {
      return (Math.abs(loc.latitude - loc2.latitude) < 0.0084 && Math.abs(loc.longitude - loc2.longitude) < 0.0084 &&
              loc.zone === loc2.zone);
    });

    if (match)
      loc.name = match.name;
    else
      loc.name = NEW_LOCATION;
  }

  private getLocationFromIp(): void {
    const localTesting = (this.hostname === 'localhost' || this.hostname === '127.0.0.1');

    if (localTesting) {
      this.httpClient.jsonp('https://skyviewcafe.com/ip/json/', 'callback').subscribe((location: IpLocation) => {
        this.setLocationFromIpLocation(location);
      }, () => {
        this.getLocationFromGeoLocation();
      });
    }
    else {
      this.httpClient.get('/ip/json/').subscribe((location: IpLocation) => {
        this.setLocationFromIpLocation(location);
      }, () => {
        this.getLocationFromGeoLocation();
      });
    }
  }

  private setLocationFromIpLocation(location: IpLocation): void {
    if (location.status === 'success') {
      const cc = location.countryCode;
      const reg = location.region;
      let state: string;
      let timezone = location.timezone;

      if (cc && (cc !== 'US' || !reg))
        state = cc;
      else if (reg)
        state = reg;

      const city = '(' + location.city + ', ' + state + ')';

      if (!timezone)
        timezone = 'OS';

      this.location = new Location(city, location.lat, location.lon, timezone);
    }
    else
      this.getLocationFromGeoLocation();
  }

  private getLocationFromGeoLocation(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position: Position) => {
        this.location = new Location('(unnamed)', position.coords.latitude, position.coords.longitude, 'OS');
      },
      () => {
        console.log('Using default location');
      });
    }
    else
      console.log('Using default location');
  }
}
