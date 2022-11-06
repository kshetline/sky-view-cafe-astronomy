import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import {
  EARTH, EventFinder, ISkyObserver, JUPITER, JupiterInfo, MARS, MERCURY, MOON, NEPTUNE, PLUTO, SATURN, SkyObserver, SUN, URANUS, VENUS
} from '@tubular/astronomy';
import { DateAndTime, GregorianChange, DateTime, Timezone } from '@tubular/time';
import { clone, isEqual, isString } from '@tubular/util';
import throttle from 'lodash-es/throttle';
import { SelectItem } from 'primeng/api';
import { AppService, CurrentTab, Location, UserSetting } from '../../app.service';
import { AstroDataService } from '../../astronomy/astro-data.service';

export enum TableType { NONE, EPHEMERIS, EPHEMERIS_TBD, RISE_SET_TIMES, LUNAR_PHASES, EQUINOX_SOLSTICE, GALILEAN_MOONS }

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
  private dateTime: DateTime;
  private readonly throttledResize: () => void;
  private eventFinder: EventFinder;
  private eventFinderReady = false;
  private height: number;
  private jupiterInfo: JupiterInfo;
  private lastGregorianChange: GregorianChange = null;
  private lastObserver: ISkyObserver = null;
  private lastTableTime: DateAndTime = { y: Number.MIN_SAFE_INTEGER, m: 0, d: 0, hrs: -1, min: -1, sec: -1, occurrence: 0 };
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

  @ViewChild('wrapper', { static: true }) private wrapperRef: ElementRef;
  @ViewChild('tableContainer', { static: true }) private tableContainerRef: ElementRef;
  @ViewChild('tableTypesDropdown', { static: true }) private tableTypesDropdown: ElementRef;
  @ViewChild('planetsDropdown', { static: true }) private planetsDropdown: ElementRef;

  planetChoices: SelectItem[] = [];

  tableTypes: SelectItem[] = [
    { label: 'Ephemeris', value: TableType.EPHEMERIS },
    { label: 'Ephemeris - TBD', value: TableType.EPHEMERIS_TBD },
    { label: 'Rise/Set Times', value: TableType.RISE_SET_TIMES },
    { label: 'Lunar Phases', value: TableType.LUNAR_PHASES },
    { label: 'Equinox/Solstice', value: TableType.EQUINOX_SOLSTICE },
    { label: 'Galilean Moons/GRS', value: TableType.GALILEAN_MOONS }
  ];

  tableHtml = '&nbsp;';
  planetChoiceEnabled = true;

  constructor(private app: AppService, dataService: AstroDataService) {
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

    this.throttledResize = throttle(() => {
      this.doResize();
    }, 100);

    app.getCurrentTabUpdates((currentTab: CurrentTab) => {
      if (currentTab === CurrentTab.TABLES) {
        setTimeout(() => {
          this.throttledResize();
          this.updateView();
        });
      }
    });

    app.getTimeUpdates((time) => {
      this.time = time;
      this.updateView();
    });

    app.getLocationUpdates((location: Location) => {
      this.zone = location.zone;
      this.observer = new SkyObserver(location.longitude, location.latitude);
      this.updateView();
    });

    app.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_TABLES && setting.source !== this) {
        let forced = false;

        if (setting.property === PROPERTY_PLANET_CHOICE)
          this.planetChoice = setting.value as number;
        else if (setting.property === PROPERTY_TABLE_TYPE)
          this.tableType = setting.value as TableType;
        else if (setting.property === PROPERTY_TWILIGHT) {
          this.twilight = setting.value as number;
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
      this.app.requestViewSettings(VIEW_TABLES);
      this.updatePlanetChoices();
    });
  }

  get tableType(): TableType { return this._tableType; }
  set tableType(value: TableType) {
    if (this._tableType !== value) {
      this._tableType = value;
      this.app.updateUserSetting(VIEW_TABLES, PROPERTY_TABLE_TYPE, value, this);
      this.updatePlanetChoices();
      this.updateView();
    }
  }

  get planetChoice(): number { return this._planetChoice; }
  set planetChoice(value: number) {
    if (this._planetChoice !== value) {
      this._planetChoice = value;
      this.app.updateUserSetting(VIEW_TABLES, PROPERTY_PLANET_CHOICE, value, this);
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
    if (this.app.currentTab !== CurrentTab.TABLES || !this.eventFinderReady)
      return;

    const timezone = Timezone.getTimezone(this.zone, this.observer.longitude.degrees);

    this.dateTime = new DateTime(this.time, timezone, this.app.gregorianChangeDate);

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
        !isEqual(this.lastGregorianChange, this.app.gregorianChangeDate) ||
        checkYearChanged &&  lt.y !== wt.y ||
        checkDayChanged  && (lt.y !== wt.y || lt.m !== wt.m || lt.d !== wt.d) ||
        checkTimeChanged && (lt.y !== wt.y || lt.m !== wt.m || lt.d !== wt.d || lt.hrs !== wt.hrs || lt.min !== wt.min || lt.occurrence !== wt.occurrence) ||
        checkObserverChanged && !isEqual(this.lastObserver, this.observer)) {
      let newTable: Promise<string> | string;
      let daysInMonth: number;
      let jdu: number;

      switch (this._tableType) {
        case TableType.EPHEMERIS:
        case TableType.EPHEMERIS_TBD:
          newTable = '<i>Not yet implemented</i>';
          break;

        case TableType.RISE_SET_TIMES:
          daysInMonth = this.dateTime.getDaysInMonth(wt.y, wt.m);
          newTable = this.eventFinder.getRiseAndSetEventsAsHtml(this._planetChoice, wt.y, wt.m, wt.d, daysInMonth, this.observer, timezone,
              this.app.gregorianChangeDate, this.twilight, { tableClass: 'table-view' });
          break;

        case TableType.LUNAR_PHASES:
          newTable = this.eventFinder.getLunarPhasesByYearAsHtml(wt.y, wt.y + 1, timezone, this.app.gregorianChangeDate,
              { tableClass: 'table-view' });
          break;

        case TableType.EQUINOX_SOLSTICE:
          newTable = this.eventFinder.getEquinoxesAndSolsticesByYearAsHtml(wt.y, wt.y + 9, timezone, this.app.gregorianChangeDate,
              { tableClass: 'table-view' });
          break;

        case TableType.GALILEAN_MOONS:
          jdu = DateTime.julianDay(this.time);
          newTable = this.eventFinder.getGalileanMoonEventsAsHtml(jdu, jdu + 3, true, timezone, this.app.gregorianChangeDate,
              { tableClass: 'table-view' });
          break;
      }

      if (isString(newTable))
        this.tableHtml = newTable;
      else
        newTable.then(html => this.tableHtml = html);
    }

    this.lastGregorianChange = clone(this.app.gregorianChangeDate);
    this.lastObserver = new SkyObserver(this.observer.longitude, this.observer.latitude);
    this.lastTableTime = clone(wt);
    this.lastTableType = this._tableType;
    this.lastZone = this.zone;
  }

  private updatePlanetChoices(): void {
    this.planetChoiceEnabled = (this._tableType === TableType.RISE_SET_TIMES);

    this.planetChoices = [
      { label: 'Sun',     value: SUN },
      { label: 'Moon',    value: MOON },
      { label: 'Mercury', value: MERCURY },
      { label: 'Venus',   value: VENUS },
      { label: 'Earth',   value: EARTH },
      { label: 'Mars',    value: MARS },
      { label: 'Jupiter', value: JUPITER },
      { label: 'Saturn',  value: SATURN },
      { label: 'Uranus',  value: URANUS },
      { label: 'Neptune', value: NEPTUNE },
      { label: 'Pluto',   value: PLUTO }
    ];

    if (this._tableType === TableType.RISE_SET_TIMES)
      this.planetChoices.splice(4, 1); // Remove Earth
  }
}
