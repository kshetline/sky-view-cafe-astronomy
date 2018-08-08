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

import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import {
  AppService, CurrentTab, Location, PROPERTY_GREGORIAN_CHANGE_DATE, SVC_MAX_YEAR, SVC_MIN_YEAR, UserSetting, VIEW_APP
} from '../../app.service';
import { DateAndTime, KsDateTime, KsTimeZone, YMDDate } from 'ks-date-time-zone';
import {
  AstroEvent, EQ_SOLSTICE_EVENT_BASE, EventFinder, FALL_EQUINOX, FIRST_QUARTER, FULL_MOON, ISkyObserver, JUPITER, LAST_QUARTER, MARS,
  MERCURY, MOON, NEPTUNE, NEW_MOON, PHASE_EVENT_BASE, PLUTO, RISE_EVENT, RISE_SET_EVENT_BASE, SATURN, SET_EVENT, SkyObserver,
  SPRING_EQUINOX, SUMMER_SOLSTICE, SUN, TRANSIT_EVENT, TWILIGHT_BEGINS, TWILIGHT_ENDS, UNSEEN_ALL_DAY, URANUS, UT_to_TDB, VENUS,
  VISIBLE_ALL_DAY, WINTER_SOLSTICE
} from 'ks-astronomy';
import { DatePipe } from '@angular/common';
import { ceil, floor, max, min, round } from 'ks-math';
import { isEdge, isFirefox, isIE } from 'ks-util';
import * as _ from 'lodash';
import { MoonDrawer } from '../moon-drawer';
import { GenericView } from '../generic-view';

export const  VIEW_CALENDAR = 'calendar';
export const    PROPERTY_KEY_MOON_PHASES = 'key_moon_phases';
export const    PROPERTY_EQUISOLSTICE = 'equisolstice';
export const    PROPERTY_DAILY_DAYLIGHT = 'daily_daylight';
export const    PROPERTY_DAILY_MOON_PHASE = 'daily_moon_phase';
export const    PROPERTY_EVENT_TYPE = 'event_type';
export const    PROPERTY_INCLUDE_TRANSITS = 'include_transits';

const MOON_IMAGE_INSET = 20;
const MOON_IMAGE_PRINT_INSET = 30;
const MIN_MOON_IMAGE_SIZE = 32;

const DAY_HIGHLIGHT = '#000044';

interface TextAndTime {
  text: string;
  time: number;
}

interface EventType {
  planet: number;
  altitude: number;
}

interface DateInfo extends YMDDate {
  text: string;
  dayLength: number;
  jdeNoon: number;
  highlight?: boolean;
  shortDay?: boolean;
  longDay?: boolean;
  otherMonth?: boolean;
  voidDay?: boolean;
  planet?: string;
  equiSolstice?: TextAndTime;
  riseSetTimes?: TextAndTime[];
  phaseTime?: TextAndTime;
  phaseImage?: string;
  daylight?: string;
}

@Component({
  selector: 'svc-calendar-view',
  templateUrl: './svc-calendar-view.component.html',
  styleUrls: ['./svc-calendar-view.component.scss']
})
export class SvcCalendarViewComponent implements AfterViewInit {
  private wrapper: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private calendarTable: HTMLTableElement;
  private width = -1;
  private height = -1;
  private dayTop = 58;
  private time: number;
  private dateTime: KsDateTime;
  private wallTime: DateAndTime;
  private zone: string;
  private observer: ISkyObserver;
  private year = Number.MIN_SAFE_INTEGER;
  private month = -1;
  private _firstDay = 0;
  private _minYear = SVC_MIN_YEAR;
  private _maxYear = SVC_MAX_YEAR;
  private events: AstroEvent[] = [];
  private eventType = 0;
  private keyMoonPhases = true;
  private equisolstice = true;
  private dailyMoonPhase = true;
  private dailyDaylight = true;
  private throttledResize: () => void;
  private eventFinder = new EventFinder();
  private moonDrawer: MoonDrawer;

  private eventTypes: EventType[] = [
    {planet: SUN, altitude: 0},
    {planet: MOON,    altitude: 0},
    {planet: MERCURY, altitude: 0},
    {planet: VENUS,   altitude: 0},
    {planet: MARS,    altitude: 0},
    {planet: JUPITER, altitude: 0},
    {planet: SATURN,  altitude: 0},
    {planet: URANUS,  altitude: 0},
    {planet: NEPTUNE, altitude: 0},
    {planet: PLUTO,   altitude: 0},
    {planet: SUN,     altitude: -6},
    {planet: SUN,     altitude: -12},
    {planet: SUN,     altitude: -18}
  ];

  @ViewChild('wrapper') private wrapperRef: ElementRef;
  @ViewChild('canvas') private canvasRef: ElementRef;
  @ViewChild('calendarTable') private calendarTableRef: ElementRef;
  @ViewChild('titleRow') private titleRowRef: ElementRef;
  @ViewChild('weekdaysRow') private weekdaysRowRef: ElementRef;

  title: string;
  calendar: DateInfo[][] = [];
  daysOfWeek: string[] = [];
  includeTransits = false;
  isFirefox = false;
  isEdgeOrIE = false;

  constructor(private appService: AppService, private datePipe: DatePipe) {
    this.isFirefox = isFirefox();
    this.isEdgeOrIE = isEdge() || isIE();
    // TODO: Call method below whenever first day of week changes.
    this.updateDayHeadings();

    this.throttledResize = _.throttle(() => {
      this.doResize();
    }, 100);

    appService.getCurrentTabUpdates((currentTab: CurrentTab) => {
      if (currentTab === CurrentTab.CALENDAR) {
        setTimeout(() => {
          this.onResize();
          this.updateView();
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
      this.updateView(true);
    });

    appService.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_CALENDAR && setting.source !== this) {
        if (setting.property === PROPERTY_KEY_MOON_PHASES) {
          this.keyMoonPhases = <boolean> setting.value;
        }
        else if (setting.property === PROPERTY_EQUISOLSTICE) {
          this.equisolstice = <boolean> setting.value;
        }
        else if (setting.property === PROPERTY_DAILY_DAYLIGHT) {
          this.dailyDaylight = <boolean> setting.value;
        }
        else if (setting.property === PROPERTY_DAILY_MOON_PHASE) {
          this.dailyMoonPhase = <boolean> setting.value;
        }
        else if (setting.property === PROPERTY_EVENT_TYPE) {
          this.eventType = <number> setting.value;
        }
        else if (setting.property === PROPERTY_INCLUDE_TRANSITS) {
          this.includeTransits = <boolean> setting.value;
        }

        this.updateView(true);
      }
      else if (setting.view === VIEW_APP && setting.property === PROPERTY_GREGORIAN_CHANGE_DATE) {
        appService.applyCalendarType(this.dateTime);
        this.updateView(true);
      }
    });

    MoonDrawer.getMoonDrawer().then(moonDrawer => {
      this.moonDrawer = moonDrawer;
      this.onResize();
    });

    document.addEventListener('scroll-changed', () => {
      this.onResize();
    });
  }

  ngAfterViewInit(): void {
    this.wrapper = this.wrapperRef.nativeElement;
    this.canvas = this.canvasRef.nativeElement;
    this.calendarTable = this.calendarTableRef.nativeElement;
    this.onResize();

    setTimeout(() => this.appService.requestViewSettings(VIEW_CALENDAR));

    GenericView.getPrintingUpdate(printing => {
      this.doResize();
    });
  }

  onResize(): void {
    this.throttledResize();
  }

  private doResize(): void {
    this.width = this.wrapper.clientWidth;
    this.height = this.wrapper.clientHeight;
    this.dayTop = (<HTMLElement> (this.titleRowRef.nativeElement)).clientHeight + (<HTMLElement> (this.weekdaysRowRef.nativeElement)).clientHeight;

    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.height = this.height + 'px';
    this.canvas.style.height = this.height + 'px';
    this.calendarTable.style.height = this.height + 'px';
    this.calendarTable.style.height = this.height + 'px';

    this.draw();
  }

  private draw(): void {
    if (CurrentTab.CALENDAR !== this.appService.currentTab)
      return;

    const printing = GenericView.printing;
    const inkSaver = printing && this.appService.inkSaver;
    const context = this.canvas.getContext('2d');
    const rowHeight = (this.height - this.dayTop) / this.calendar.length;
    const colWidth = this.width / 7;
    const inset = (inkSaver ? MOON_IMAGE_PRINT_INSET : MOON_IMAGE_INSET);
    const imageSize = max(min(rowHeight, colWidth) - 2 * inset, MIN_MOON_IMAGE_SIZE);

    context.fillStyle = (inkSaver ? 'white' : 'black');
    context.fillRect(0, 0, this.width, this.height);

    for (let i = 0; i < this.calendar.length; ++i) {
      const y  = round(this.dayTop + i * rowHeight);
      const cy = round(this.dayTop + (i + 0.5) * rowHeight);

      for (let j = 0; j < 7; ++j) {
        const x  = round(j * colWidth);
        const cx = round((j + 0.5) * colWidth);
        const date = this.calendar[i][j];

        if (date.highlight && !printing) {
          context.fillStyle = DAY_HIGHLIGHT;
          context.fillRect(x, y, colWidth, rowHeight);
        }

        if (this.dailyMoonPhase && this.moonDrawer && !date.otherMonth && !date.voidDay) {
          const jde = date.jdeNoon;
          this.moonDrawer.drawMoon(context, this.appService.solarSystem, jde, cx, cy, imageSize, 0);
        }
      }
    }
  }

  private updateDayHeadings(): void {
    // Produce calendar day-of-week header using arbitrary days which start on the given first day of the week.
    this.daysOfWeek = [];

    for (let d = 1; d <= 7; ++d)
      this.daysOfWeek.push(this.datePipe.transform(new Date(2017, 0, d + this._firstDay, 12, 0), 'EEE'));
  }

  private updateView(forceUpdate?: boolean): void {
    if (forceUpdate)
      this.month = -1;

    if (this.appService.currentTab !== CurrentTab.CALENDAR)
      return;

    const timeZone = KsTimeZone.getTimeZone(this.zone, this.observer.longitude.degrees);

    this.dateTime = new KsDateTime(this.time, timeZone, this.appService.gregorianChangeDate);
    this.wallTime = this.dateTime.wallTime;

    if (this.year !== this.wallTime.y || this.month !== this.wallTime.m) {
      this.year = this.wallTime.y;
      this.month = this.wallTime.m;
      this.title = this.datePipe.transform(new Date(4000, this.month - 1, 1, 12, 0), 'MMMM ') + this.year +
        (this.year <= 0 ? ' (' + (-this.year + 1) + ' BCE)' : '');

      const calendar = this.dateTime.getCalendarMonth(this.year, this.month, this._firstDay);

      this.calendar = [];
      calendar.forEach((date: DateInfo, index: number) => {
        const dayLength = this.dateTime.getMinutesInDay(date.y, date.m, Math.abs(date.d));
        const row = Math.floor(index / 7);
        const col = index % 7;
        const noon = new KsDateTime({y: date.y, m: date.m, d: Math.abs(date.d), hrs: 12, min: 0, sec: 0}, timeZone, this.appService.gregorianChangeDate);

        date.dayLength = dayLength;
        date.jdeNoon = UT_to_TDB(KsDateTime.julianDay(noon.utcTimeMillis));
        date.text = String(date.d);
        date.otherMonth = (date.m !== this.month);
        date.highlight = (date.m === this.month && date.d === this.wallTime.d);

        if (date.y < this._minYear || date.y > this._maxYear) {
          date.d = 0;
          date.text = '\u2022'; // bullet
          date.voidDay = true;
        }
        else if (dayLength === 0) {
          date.d = 0;
          date.text = '\u2716'; // heavy x
          date.voidDay = true;
        }
        else if (dayLength < 1440) {
          date.shortDay = true;
        }
        else if (dayLength > 1440) {
          date.longDay = true;
        }

        if (this.dailyDaylight && !date.otherMonth && !date.voidDay) {
          const daylight = this.eventFinder.getMinutesOfDaylight(date.y, date.m, date.d, this.observer, timeZone, this.appService.gregorianChangeDate);
          const mins = daylight % 60;
          const hours = (daylight - mins) / 60;

          date.daylight = '\u263C' + hours + 'h' + (mins < 10 ? '0' : '') + mins + 'm';
        }
        else
          date.daylight = '';

        if (col === 0)
          this.calendar[row] = [];

        this.calendar[row][col] = date;
      });

      const planet = this.eventTypes[this.eventType].planet;
      const altitude = this.eventTypes[this.eventType].altitude;

      this.events = this.eventFinder.getMonthOfEvents(planet, this.year, this.month, this.observer, timeZone, this.appService.gregorianChangeDate,
        altitude !== 0 ? altitude : undefined);
      this.updateViewTime();
    }
    else {
      for (const row of this.calendar) {
        for (const date of row)
          date.highlight = (date.m === this.month && date.d === this.wallTime.d);
      }

      this.updateViewTime();
    }

    this.draw();
  }

  private updateViewTime(): void {
    let eventIndex = 0;

    for (const row of this.calendar) {
      for (const date of row) {
        date.riseSetTimes = [];
        date.phaseImage = '/assets/resources/blank.svg';

        if (!date.otherMonth && this.eventTypes[this.eventType].planet !== SUN)
          date.planet = this.appService.solarSystem.getPlanetSymbol(this.eventTypes[this.eventType].planet);

        if (date.otherMonth)
          continue;

        while (eventIndex < this.events.length) {
          const event = this.events[eventIndex];
          const eventDate = new KsDateTime(event.eventTime.utcTimeMillis, this.dateTime.timeZone, this.appService.gregorianChangeDate);

          if (eventDate.wallTime.d === date.d) {
            let eventTime = eventDate.toHoursAndMinutesString(true);
            let eventType = event.eventType;
            const eventClass = floor(eventType / 100) * 100;

            if (eventClass === EQ_SOLSTICE_EVENT_BASE && this.equisolstice) {
              if (this.observer.latitude.degrees < 0) // Switch naming of equinoxes and solstices for southern hemisphere.
                eventType = EQ_SOLSTICE_EVENT_BASE + ((eventType + 2) % 4);

              switch (eventType) {
                case SPRING_EQUINOX:  eventTime = 'SE ' + eventTime; break;
                case SUMMER_SOLSTICE: eventTime = 'SS ' + eventTime; break;
                case FALL_EQUINOX:    eventTime = 'FE ' + eventTime; break;
                case WINTER_SOLSTICE: eventTime = 'WS ' + eventTime; break;
              }

              date.equiSolstice = {text: eventTime, time: event.eventTime.utcTimeMillis};
            }
            else if (eventClass === RISE_SET_EVENT_BASE && (this.includeTransits || eventType !== TRANSIT_EVENT)) {
              switch (eventType) {
                case RISE_EVENT:      eventTime = 'R ' + eventTime; break;
                case TRANSIT_EVENT:   eventTime = 'T ' + eventTime; break;
                case SET_EVENT:       eventTime = 'S ' + eventTime; break;
                case TWILIGHT_BEGINS: eventTime = 'TB ' + eventTime; break;
                case TWILIGHT_ENDS:   eventTime = 'TE ' + eventTime; break;
                case VISIBLE_ALL_DAY: eventTime = 'risen'; break;
                case UNSEEN_ALL_DAY:  eventTime = 'set'; break;
              }

              date.riseSetTimes.push({text: eventTime, time: event.eventTime.utcTimeMillis});
            }
            else if (eventClass === PHASE_EVENT_BASE && this.keyMoonPhases) {
              date.phaseTime = {text: eventTime, time: event.eventTime.utcTimeMillis};

              switch (eventType) {
                case NEW_MOON:      date.phaseImage = '/assets/resources/new_moon.svg'; break;
                case FIRST_QUARTER: date.phaseImage = '/assets/resources/fq_moon.svg'; break;
                case FULL_MOON:     date.phaseImage = '/assets/resources/full_moon.svg'; break;
                case LAST_QUARTER:  date.phaseImage = '/assets/resources/lq_moon.svg'; break;
              }
            }

            ++eventIndex;
          }
          else
            break;
        }
      }
    }
  }

  public onClick(yearOrMillis: number, month?: number, day?: number): void {
    if (month === undefined)
      this.appService.time = yearOrMillis;
    else {
      const newDate = new KsDateTime({y: yearOrMillis, m: month, d: day, hrs: 12, min: 0, sec: 0}, this.dateTime.timeZone, this.appService.gregorianChangeDate);
      this.appService.time = newDate.utcTimeMillis;
    }
  }
}
