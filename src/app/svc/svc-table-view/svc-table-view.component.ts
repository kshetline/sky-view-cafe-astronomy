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

import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { AppService, CurrentTab, Location, UserSetting } from '../../app.service';
import { AstroDataService } from '../../astronomy/astro-data.service';
import { DateAndTime, GregorianChange, KsDateTime, KsTimeZone } from 'ks-date-time-zone';
import * as _ from 'lodash';
import {
  EARTH, EventFinder, ISkyObserver, JUPITER, JupiterInfo, MARS, MERCURY, MOON, NEPTUNE, PLUTO, SATURN, SkyObserver, SUN, URANUS, VENUS
} from 'ks-astronomy';
import { SelectItem } from 'primeng/components/common/api';

export enum TableType {NONE, EPHEMERIS, EPHEMERIS_TBD, RISE_SET_TIMES, LUNAR_PHASES, EQUINOX_SOLSTICE, GALILEAN_MOONS}

export const  VIEW_TABLES = 'tables';
export const    PROPERTY_PLANET_CHOICE = 'planet_choice';
export const    PROPERTY_TABLE_TYPE = 'table_type';
export const    PROPERTY_TWILIGHT = 'twilight';

@Component({
  selector: 'svc-table-view',
  templateUrl: './svc-table-view.component.html',
  styleUrls: ['./svc-table-view.component.scss']
})
export class SvcTableViewComponent implements AfterViewInit {
  private dateTime: KsDateTime;
  private throttledResize: () => void;
  private eventFinder: EventFinder;
  private eventFinderReady = false;
  private height: number;
  private jupiterInfo: JupiterInfo;
  private lastGregorianChange: GregorianChange = null;
  private lastObserver: ISkyObserver = null;
  private lastTableTime: DateAndTime = {y: Number.MIN_SAFE_INTEGER, m: 0, d: 0, hrs: -1, min: -1, sec: -1, occurrence: 0};
  private lastTableType = TableType.NONE;
  private lastZone: string = null;
  private observer: ISkyObserver;
  private _planetChoice = SUN;
  private tableContainer: HTMLDivElement;
  private _tableType = TableType.RISE_SET_TIMES;
  private time: number;
  private twilight = -6.0;
  private wallTime: DateAndTime;
  private width: number;
  private wrapper: HTMLDivElement;
  private zone: string;

  @ViewChild('wrapper') private wrapperRef: ElementRef;
  @ViewChild('tableContainer') private tableContainerRef: ElementRef;
  @ViewChild('tableTypesDropdown') private tableTypesDropdown: ElementRef;
  @ViewChild('planetsDropdown') private planetsDropdown: ElementRef;

  planetChoices: SelectItem[] = [];

  tableTypes: SelectItem[] = [
    {label: 'Ephemeris', value: TableType.EPHEMERIS},
    {label: 'Ephemeris - TBD', value: TableType.EPHEMERIS_TBD},
    {label: 'Rise/Set Times', value: TableType.RISE_SET_TIMES},
    {label: 'Lunar Phases', value: TableType.LUNAR_PHASES},
    {label: 'Equinox/Solstice', value: TableType.EQUINOX_SOLSTICE},
    {label: 'Galilean Moons/GRS', value: TableType.GALILEAN_MOONS}
  ];

  public tableHtml = '&nbsp;';
  public planetChoiceEnabled = true;

  constructor(private appService: AppService, dataService: AstroDataService) {
    JupiterInfo.getJupiterInfo(dataService).then((jupiterInfo: JupiterInfo) => {
      this.jupiterInfo = jupiterInfo;
      this.eventFinder = new EventFinder(jupiterInfo);
      this.eventFinderReady = true;
      this.updateView();
    }).catch(() => {
      this.eventFinder = new EventFinder();
      this.eventFinderReady = true;
      this.updateView();
    });

    this.throttledResize = _.throttle(() => {
      this.doResize();
    }, 100);

    appService.getCurrentTabUpdates((currentTab: CurrentTab) => {
      if (currentTab === CurrentTab.TABLES) {
        setTimeout(() => {
          this.updateView();
          (<any> this.tableTypesDropdown).updateDimensions();
          (<any> this.planetsDropdown).updateDimensions();
        });
      }
    });

    appService.getTimeUpdates((time) => {
      this.time = time;
      this.updateView();
    });

    appService.getLocationUpdates((location: Location) => {
      this.zone = location.zone;
      this.observer = new SkyObserver(location.longitude, location.latitude);
      this.updateView();
    });

    appService.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_TABLES && setting.source !== this) {
        let forced = false;

        if (setting.property === PROPERTY_PLANET_CHOICE)
          this.planetChoice = <number> setting.value;
        else if (setting.property === PROPERTY_TABLE_TYPE)
          this.tableType = <TableType> setting.value;
        else if (setting.property === PROPERTY_TWILIGHT) {
          this.twilight = <number> setting.value;
          forced = true;
        }

        this.updateView(forced);
      }
    });

    document.addEventListener('scroll-changed', () => {
      this.onResize();
    });
  }

  ngAfterViewInit(): void {
    this.wrapper = this.wrapperRef.nativeElement;
    this.tableContainer = this.tableContainerRef.nativeElement;
    this.onResize();

    setTimeout(() => {
      this.appService.requestViewSettings(VIEW_TABLES);
      this.updatePlanetChoices();
    });
  }

  public get tableType(): TableType { return this._tableType; }
  public set tableType(value: TableType) {
    if (this._tableType !== value) {
      this._tableType = value;
      this.appService.updateUserSetting({view: VIEW_TABLES, property: PROPERTY_TABLE_TYPE, value: value, source: this});
      this.updatePlanetChoices();
      this.updateView();
    }
  }

  public get planetChoice(): number { return this._planetChoice; }
  public set planetChoice(value: number) {
    if (this._planetChoice !== value) {
      this._planetChoice = value;
      this.appService.updateUserSetting({view: VIEW_TABLES, property: PROPERTY_PLANET_CHOICE, value: value, source: this});
      this.updateView(true);
    }
  }

  onResize(): void {
    this.throttledResize();
  }

  private doResize(): void {
    this.width = this.wrapper.clientWidth;
    this.height = this.wrapper.clientHeight;
    this.tableContainer.style.width = this.width + 'px';
    this.tableContainer.style.height = this.height + 'px';
  }

  private updateView(force = false): void {
    if (this.appService.currentTab !== CurrentTab.TABLES || !this.eventFinderReady)
      return;

    const timeZone = KsTimeZone.getTimeZone(this.zone, this.observer.longitude.degrees);

    this.dateTime = new KsDateTime(this.time, timeZone, this.appService.gregorianChangeDate);

    const wt = this.wallTime = this.dateTime.wallTime;
    const lt = this.lastTableTime;
    let checkTimeChanged = false;
    let checkDayChanged = false;
    let checkYearChanged = false;
    let checkObserverChanged = false;

    switch (this._tableType) {
      case TableType.RISE_SET_TIMES:
        checkDayChanged = true;
        checkObserverChanged = true;
      break;

      case TableType.LUNAR_PHASES:
      case TableType.EQUINOX_SOLSTICE:
        checkYearChanged = true;
      break;

      case TableType.GALILEAN_MOONS:
        checkTimeChanged = true;
      break;
    }

    if (force ||
        this.lastTableType !== this._tableType ||
        this.lastZone !== this.zone ||
        !_.isEqual(this.lastGregorianChange, this.appService.gregorianChangeDate) ||
        checkYearChanged &&  lt.y !== wt.y ||
        checkDayChanged  && (lt.y !== wt.y || lt.m !== wt.m || lt.d !== wt.d) ||
        checkTimeChanged && (lt.y !== wt.y || lt.m !== wt.m || lt.d !== wt.d || lt.hrs !== wt.hrs || lt.min !== wt.min || lt.occurrence !== wt.occurrence) ||
        checkObserverChanged && !_.isEqual(this.lastObserver, this.observer)) {
      let newTable: Promise<string> | string;

      switch (this._tableType) {
        case TableType.EPHEMERIS:
        case TableType.EPHEMERIS_TBD:
          newTable = '<i>Not yet implemented</i>';
        break;

        case TableType.RISE_SET_TIMES:
          const daysInMonth = this.dateTime.getDaysInMonth(wt.y, wt.m);

          newTable = this.eventFinder.getRiseAndSetEventsAsHtml(this._planetChoice, wt.y, wt.m, wt.d, daysInMonth, this.observer, timeZone,
              this.appService.gregorianChangeDate, this.twilight, {tableClass: 'table-view'});
        break;

        case TableType.LUNAR_PHASES:
          newTable = this.eventFinder.getLunarPhasesByYearAsHtml(wt.y, wt.y + 1, timeZone, this.appService.gregorianChangeDate,
              {tableClass: 'table-view'});
        break;

        case TableType.EQUINOX_SOLSTICE:
          newTable = this.eventFinder.getEquinoxesAndSolsticesByYearAsHtml(wt.y, wt.y + 9, timeZone, this.appService.gregorianChangeDate,
              {tableClass: 'table-view'});
        break;

        case TableType.GALILEAN_MOONS:
          const jdu = KsDateTime.julianDay(this.time);
          newTable = this.eventFinder.getGalileanMoonEventsAsHtml(jdu, jdu + 3, true, timeZone, this.appService.gregorianChangeDate,
              {tableClass: 'table-view'});
        break;
      }

      if (_.isString(newTable))
        this.tableHtml = newTable;
      else
        newTable.then(html => this.tableHtml = html);
    }

    this.lastGregorianChange = _.clone(this.appService.gregorianChangeDate);
    this.lastObserver = new SkyObserver(this.observer.longitude, this.observer.latitude);
    this.lastTableTime = _.clone(wt);
    this.lastTableType = this._tableType;
    this.lastZone = this.zone;
  }

  private updatePlanetChoices(): void {
    this.planetChoiceEnabled = (this._tableType === TableType.RISE_SET_TIMES);

    this.planetChoices = [
      {label: 'Sun',     value: SUN},
      {label: 'Moon',    value: MOON},
      {label: 'Mercury', value: MERCURY},
      {label: 'Venus',   value: VENUS},
      {label: 'Earth',   value: EARTH},
      {label: 'Mars',    value: MARS},
      {label: 'Jupiter', value: JUPITER},
      {label: 'Saturn',  value: SATURN},
      {label: 'Uranus',  value: URANUS},
      {label: 'Neptune', value: NEPTUNE},
      {label: 'Pluto',   value: PLUTO}
    ];

    if (this._tableType === TableType.RISE_SET_TIMES)
      this.planetChoices.splice(4, 1); // Remove Earth

    setTimeout(() => {
      (<any> this.planetsDropdown).updateDimensions();
    });
  }
}
