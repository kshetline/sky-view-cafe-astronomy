/*
  Copyright © 2017 Kerry Shetline, kerry@shetline.com

  MIT license: https://opensource.org/licenses/MIT

  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
  documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
  rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
  persons to whom the Software is furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
  Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
  WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
  COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
  OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import { EclipseInfo, SolarSystem } from './solar-system';
import {
  APHELION, AVG_SUN_MOON_RADIUS, FALL_EQUINOX, FIRST_QUARTER, FULL_MOON, GALILEAN_MOON_EVENT, GREATEST_ELONGATION, GRS_TRANSIT_EVENT, HALF_MINUTE,
  INFERIOR_CONJUNCTION, LAST_QUARTER, LUNAR_ECLIPSE, MARS, MAX_ALT_FOR_TWILIGHT, MEAN_JUPITER_SYS_II, MEAN_SYNODIC_MONTH, MERCURY, MINUTE, MOON,
  NAUTICAL_TWILIGHT, NEPTUNE, NEW_MOON, NON_EVENT, OPPOSITION, PERIHELION, PHASE_EVENT_BASE, QUADRATURE, QUICK_PLANET, REFRACTION_AT_HORIZON, RISE_EVENT, SET_EVENT,
  SET_EVENT_MINUS_1_MIN, SIGNED_HOUR_ANGLE, SOLAR_ECLIPSE, SPRING_EQUINOX, SUMMER_SOLSTICE, SUN, SUPERIOR_CONJUNCTION, TRANSIT_EVENT, TWILIGHT_BEGINS,
  TWILIGHT_ENDS, UNSEEN_ALL_DAY, URANUS, VENUS, VISIBLE_ALL_DAY, WINTER_SOLSTICE
} from './astro-constants';
import { UT_to_TDB } from './ut-converter';
import {
  abs, Angle, div_rd, floor, FMT_DD, FMT_MINS, max, min, MinMaxFinder, mod, mod2, round, sign, sin_deg, Unit, ZeroFinder
} from 'ks-math';
import { DateTimeField, getISOFormatDate, GregorianChange, KsCalendar, KsDateTime, KsTimeZone, YMDDate } from 'ks-date-time-zone';
import { ISkyObserver } from './i-sky-observer';
import * as _ from 'lodash';
import { JupiterInfo } from './jupiter-info';
import { JupitersMoons } from './jupiter-moons';

export class AstroEvent {
  private _eventType: number;
  private _eventText: string;
  private _value: number;

  eventTime: KsDateTime;

  public miscInfo: any;

  constructor(eventType: number, eventText: string, year: number, month: number, day: number, hourOffset: number,
              zone: KsTimeZone, gregorianChange?: GregorianChange, value?: number) {
    this._eventType = eventType;
    this._eventText = eventText;
    this._value = value;
    this.eventTime = new KsDateTime({y: year, m: month, d: day, hrs: 0, min: 0, sec: 0, occurrence: 1}, zone, gregorianChange);

    const minutesInDay = this.eventTime.getMinutesInDay(year, month, day);
    const minutesIntoDay = min(max(floor(hourOffset * 60), 0), minutesInDay - 1);

    this.eventTime.add(DateTimeField.MINUTES, minutesIntoDay);
  }

  static fromJdu(eventType: number, eventText: string, jdu: number, zone: KsTimeZone, gregorianChange?: GregorianChange, value?: number): AstroEvent {
    const dateTime = new KsDateTime(KsDateTime.millisFromJulianDay(jdu), zone, gregorianChange);
    const startOfDay = dateTime.getStartOfDayMillis();
    const ymd = dateTime.wallTime;
    const hourOffset = (dateTime.utcTimeMillis - startOfDay) / 3600000;

    return new AstroEvent(eventType, eventText, ymd.y, ymd.m, ymd.d, hourOffset, zone, gregorianChange, value);
  }

  get eventType(): number { return this._eventType; }
  get eventText(): string { return this._eventText; }
  get value(): number { return this._value; }
  get ut(): number { return KsDateTime.julianDay(this.eventTime.utcTimeMillis); }

  public toString(): string {
    return this._eventType + '; ' + this._eventText + '; ' + this.eventTime.toYMDhmString() +
      (_.isUndefined(this.value) ? '' : '; ' + this.value) +
      (_.isString(this.miscInfo) ? '; ' + this.miscInfo : '');
  }
}

export interface LunarPhasesHtmlOptions {
  tableClass?: string;
  headers?: string[];
  formatYear?: (number) => string;
  formatDateTime?: (AstroEvent) => string;
}

export interface EquinoxSolsticeHtmlOptions extends LunarPhasesHtmlOptions {
  southernHemisphere?: boolean;
}

export interface RiseAndSetHtmlOptions {
  tableClass?: string;
  headers?: string[];
  unseenAllDay?: string;
  visibleAllDay?: string;
  formatDate?: (AstroEvent) => string;
  formatDay?: (AstroEvent) => string;
  formatTime?: (AstroEvent) => string;
}

export interface GalileanMoonsHtmlOptions {
  tableClass?: string;
  formatDateTime?: (AstroEvent) => string;
  formatTime?: (AstroEvent) => string;
}

function esc(s: string): string {
  return _.escape(s).replace(/\n/g, '<br>');
}

export class EventFinder {
  private ss = new SolarSystem();
  private jupitersMoons = new JupitersMoons();

  constructor(private jupiterInfo?: JupiterInfo) {
  }

  public getLunarPhaseEvent(year: number, month: number, day: number, zone?: KsTimeZone, gregorianChange?: GregorianChange): AstroEvent {
    if (!zone)
      zone = KsTimeZone.UT_ZONE;

    const dateTime = new KsDateTime({y: year, m: month, d: day, hrs: 0, min: 0, sec: 0, occurrence: 1}, zone, gregorianChange);
    let startOfDay = KsDateTime.julianDay(dateTime.utcTimeMillis) - HALF_MINUTE;
    const minutesInDay = dateTime.getMinutesInDay(year, month, day);

    if (minutesInDay === 0)
      return null;

    let endOfDay = startOfDay + minutesInDay * MINUTE;

    startOfDay = UT_to_TDB(startOfDay);
    endOfDay   = UT_to_TDB(endOfDay);

    let lowPhase  = this.ss.getLunarPhase(startOfDay);
    let highPhase = this.ss.getLunarPhase(endOfDay);
    let angle: number;
    let eventTime = startOfDay + HALF_MINUTE;
    let gotEvent = false;
    let phaseIndex = -1;

    // Make sure lowPhase < highPhase when 0-degree point is in between the two.
    if (lowPhase > 315.0)
      lowPhase -= 360.0;
    if (highPhase > 315.0)
      highPhase -= 360.0;

    do {
      ++phaseIndex;
      angle = phaseIndex * 90.0;

      // Does the magic moment of one of the enumerated phases occur
      // between the start and end of this day?
      if (lowPhase <= angle && angle < highPhase) {
        gotEvent = true;

        const zeroFinder = new ZeroFinder((x: number) => {
            return mod2(this.ss.getLunarPhase(x) - angle, 360.0);
          }, 0.0001, 6,
          startOfDay, lowPhase - angle,
          endOfDay,   highPhase - angle);

        eventTime = (zeroFinder.getXAtZero() - startOfDay) * 24.0;
      }
    } while (phaseIndex < 3 && !gotEvent);

    if (!gotEvent)
      return null;

    dateTime.add(DateTimeField.MINUTES, eventTime);

    return new AstroEvent(NEW_MOON + phaseIndex,
                           ['new moon', '1st quarter', 'full moon', 'third quarter'][phaseIndex],
                           year, month, day, eventTime, zone);
  }

  public getLunarPhasesByYear(startYear: number, endYear: number, zone?: KsTimeZone, gregorianChange?: GregorianChange, addPaddingMonths = false): Promise<AstroEvent[]> {
    if (!zone)
      zone = KsTimeZone.UT_ZONE;

    const results: AstroEvent[] = [];
    const dateTime = new KsDateTime(null, zone);
    const delta = (addPaddingMonths ? 1 : 0);
    const lastMonthYear = (endYear + 1) * 12 + delta;

    let monthYear = startYear * 12 - delta;
    let checkPhase = 0;
    let event: AstroEvent;

    const calculate = () => {
      const startTick = Date.now();

      for (; monthYear < lastMonthYear && Date.now() < startTick + 50; ++monthYear) {
        const year = div_rd(monthYear, 12);
        const month = mod(monthYear, 12) + 1;
        const firstDay = dateTime.getFirstDateInMonth(year, month);
        const lastDay = dateTime.getLastDateInMonth(year, month);
        const missing = dateTime.getMissingDateRange(year, month);

        for (let day = firstDay; day <= lastDay; ++day) {
          if (missing && missing[0] <= day && day <= missing[1])
            continue;

          if (checkPhase > 0)
            --checkPhase;
          else {
            event = this.getLunarPhaseEvent(year, month, day, zone, gregorianChange);

            if (event) {
              // No sense calculating phase data again for at least 4 days.
              if (!missing)
                checkPhase = 4;

              results.push(event);
            }
          }
        }
      }
    };

    return new Promise<AstroEvent[]>((resolve, reject) => {
      const loop = () => {
        calculate();

        if (monthYear === lastMonthYear)
          resolve(results);
        else
          setTimeout(loop);
      };

      setTimeout(loop);
    });
  }

  private static formatEventDate(event: AstroEvent): string {
    return getISOFormatDate(event.eventTime.wallTime);
  }

  private static formatEventTime(event: AstroEvent): string {
    const hour   = event.eventTime.wallTime.hrs;
    const minute = event.eventTime.wallTime.min;
    let dstSymbol = KsTimeZone.getDstSymbol(event.eventTime.wallTime.dstOffset);

    if (!dstSymbol)
      dstSymbol = ' ';

    return (hour < 10 ? '0' : '') + hour + ':' + (minute < 10 ? '0' : '') + minute + dstSymbol;
  }

  private static formatEventDateTime(event: AstroEvent): string {
    return EventFinder.formatEventDate(event) + ' ' + EventFinder.formatEventTime(event);
  }

  private static formatEventDateTimeWithoutYear(event: AstroEvent): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = event.eventTime.wallTime.m;
    const day   = event.eventTime.wallTime.d;

    return months[month - 1] + ' ' + (day < 10 ? ' ' : '') + day + ' ' + EventFinder.formatEventTime(event);
  }

  public getLunarPhasesByYearAsHtml(startYear: number, endYear: number, zone?: KsTimeZone, gregorianChange?: GregorianChange,
                                    options?: LunarPhasesHtmlOptions): Promise<string> {
    return this.getLunarPhasesByYear(startYear, endYear, zone, gregorianChange).then(events => {
      const results: string[] = [];
      let headers = ['New', 'First Quarter', 'Full', 'Last Quarter'];
      let lastYear = -Number.MAX_VALUE;
      let col = 0;

      if (options && options.tableClass)
        results.push(`<table class="${options.tableClass}">\n`);
      else
        results.push('<table>\n');

      let formatDateTime = EventFinder.formatEventDateTimeWithoutYear;

      if (options && options.formatDateTime)
        formatDateTime = options.formatDateTime;

      let formatYear = (year: number) => year.toString();

      if (options && options.formatYear)
        formatYear = options.formatYear;

      if (options && options.headers)
        headers = options.headers;

      results.push('  <tr>\n');
      results.push(`    <th>&nbsp;</th><th>${esc(headers[0])}</th><th>${esc(headers[1])}</th><th>${esc(headers[2])}</th><th>${esc(headers[3])}</th>\n`);
      results.push('  </tr>\n');

      events.forEach(event => {
        const year = event.eventTime.wallTime.y;
        const formattedDate = formatDateTime(event);

        while (col > 0 && year > lastYear) {
          results.push('<td>&nbsp;</td>');

          if (++col > 4) {
            results.push('\n  </tr>\n');
            col = 0;
          }
        }

        if (col === 0) {
          results.push('  <tr>\n    <td>');
          ++col;

          if (year > lastYear) {
            results.push(formatYear(year));
            lastYear = year;
          }
          else
            results.push('&nbsp;');

          results.push('</td>');
        }

        while (event.eventType - PHASE_EVENT_BASE + 1 > col) {
          results.push('<td>&nbsp;</td>');
          ++col;
        }

        results.push(`<td>${formattedDate}</td>`);
        ++col;

        if (col > 4) {
          results.push('\n  </tr>\n');
          col = 0;
        }
      });

      if (col > 0) {
        while (++col <= 5)
          results.push('<td>&nbsp;</td>');

        results.push('\n  </tr>\n');
      }

      results.push('</table>\n');

      return Promise.resolve(results.join(''));
    });
  }

  public getLunarPhasesForMonth(year: number, month: number, zone?: KsTimeZone, gregorianChange?: GregorianChange): AstroEvent[] {
    if (!zone)
      zone = KsTimeZone.UT_ZONE;

    const results: AstroEvent[] = [];
    const dateTime = new KsDateTime(null, zone);
    const firstDay = dateTime.getFirstDateInMonth(year, month);
    const lastDay = dateTime.getLastDateInMonth(year, month);
    const missing = dateTime.getMissingDateRange(year, month);

    let checkPhase = 0;

    for (let day = firstDay; day <= lastDay; ++day) {
      if (missing && missing[0] <= day && day <= missing[1])
        continue;

      if (checkPhase > 0)
        --checkPhase;
      else {
        const event = this.getLunarPhaseEvent(year, month, day, zone, gregorianChange);

        if (event) {
          // No sense calculating phase data again for at least 4 days.
          if (!missing)
            checkPhase = 4;

          results.push(event);
        }
      }
    }

    return results;
  }

  public getEquinoxSolsticeEvent(year: number, month: number, day: number, zone?: KsTimeZone, gregorianChange?: GregorianChange): AstroEvent {
    if (month % 3 !== 0 && year > -500 && year < 2700)
      return null;

    if (!zone)
      zone = KsTimeZone.UT_ZONE;

    const dateTime = new KsDateTime({y: year, m: month, d: day, hrs: 0, min: 0, sec: 0, occurrence: 1}, zone, gregorianChange);
    let startOfDay = KsDateTime.julianDay(dateTime.utcTimeMillis) - HALF_MINUTE;
    const minutesInDay = dateTime.getMinutesInDay(year, month, day);

    if (minutesInDay === 0)
      return null;

    let endOfDay = startOfDay + minutesInDay * MINUTE;

    startOfDay = UT_to_TDB(startOfDay);
    endOfDay   = UT_to_TDB(endOfDay);

    let lowLongitude  = this.ss.getEclipticPosition(SUN, startOfDay).longitude.degrees;
    let highLongitude = this.ss.getEclipticPosition(SUN,   endOfDay).longitude.degrees;
    let angle: number;
    let eventTime = 0.0;
    let gotEvent = false;
    let eventIndex = -1;

    // Make sure lowLongitude < highLongitude when 0-degree point is in between the two.
    if (lowLongitude > 315.0)
      lowLongitude -= 360.0;
    if (highLongitude > 315.0)
      highLongitude -= 360.0;

    do {
      ++eventIndex;
      angle = eventIndex * 90.0;

      // Does the magic moment of one of the equinoxes or solstices occur
      // between the start and end of this day?
      if (lowLongitude <= angle && angle < highLongitude) {
        gotEvent = true;

        const zeroFinder = new ZeroFinder((x: number) => {
            return mod2(this.ss.getEclipticPosition(SUN, x).longitude.degrees - angle, 360.0);
          }, 0.00001, 6,
          startOfDay, lowLongitude - angle,
          endOfDay,   highLongitude - angle);

        eventTime = (zeroFinder.getXAtZero() - startOfDay) * 24.0;
      }

    } while (eventIndex < 3 && !gotEvent);

    if (!gotEvent)
      return null;

    return new AstroEvent(SPRING_EQUINOX + eventIndex,
                           ['vernal equinox', 'summer solstice', 'autumnal equinox', 'winter solstice'][eventIndex],
                           year, month, day, eventTime, zone, gregorianChange);
  }

  public getEquinoxesAndSolsticesForOneYear(year: number, zone?: KsTimeZone, gregorianChange?: GregorianChange): AstroEvent[]
  {
    const results: AstroEvent[] = [];

    const dateTime = new KsDateTime(null, zone ? zone : KsTimeZone.UT_ZONE, gregorianChange);
    let firstMonth = 3;
    let step = 3;

    if (year < -500 || year > 2700) {
      firstMonth = 1;
      step = 1;
    }

    for (let month = firstMonth; month <= 12; month += step) {
      const firstDay = dateTime.getFirstDateInMonth(year, month);
      const lastDay  = dateTime.getLastDateInMonth(year, month);

      for (let day = firstDay; day <= lastDay; ++day) {
        if (dateTime.isValidDate(year, month, day)) {
          const event = this.getEquinoxSolsticeEvent(year, month, day, zone);

          if (event !== null) {
            results.push(event);
            break;
          }
        }
      }
    }

    return results;
  }

  public getEquinoxesAndSolsticesByYear(startYear: number, endYear: number, zone?: KsTimeZone, gregorianChange?: GregorianChange): Promise<AstroEvent[]>
  {
    const results: AstroEvent[] = [];
    const dateTime = new KsDateTime(null, zone ? zone : KsTimeZone.UT_ZONE, gregorianChange);
    const lastMonthYear = (endYear + 1) * 12;

    let monthYear = startYear * 12;

    const calculate = () => {
      const startTick = Date.now();

      for (; monthYear < lastMonthYear && Date.now() < startTick + 50; ++monthYear) {
        const year = div_rd(monthYear, 12);
        const month = mod(monthYear, 12) + 1;

        // Over a safe range of years even under the Julian calendar the equinoxes and solstices will
        // stay in months divisible by three.
        if (-500 <= year && year <= 2700 && month % 3 !== 0)
          continue;

        const firstDay = dateTime.getFirstDateInMonth(year, month);
        const lastDay  = dateTime.getLastDateInMonth(year, month);

        for (let day = firstDay; day <= lastDay; ++day) {
          if (dateTime.isValidDate(year, month, day)) {
            const event = this.getEquinoxSolsticeEvent(year, month, day, zone);

            if (event !== null) {
              results.push(event);
              break;
            }
          }
        }
      }
    };

    return new Promise<AstroEvent[]>((resolve, reject) => {
      const loop = () => {
        calculate();

        if (monthYear === lastMonthYear)
          resolve(results);
        else
          setTimeout(loop);
      };

      setTimeout(loop);
    });
  }


  public getEquinoxesAndSolsticesByYearAsHtml(startYear: number, endYear: number, zone?: KsTimeZone, gregorianChange?: GregorianChange,
                                              options?: EquinoxSolsticeHtmlOptions): Promise<string> {
    return this.getEquinoxesAndSolsticesByYear(startYear, endYear, zone, gregorianChange).then(events => {
      const results: string[] = [];
      let headers = ['Spring\nEquinox', 'Summer\nSolstice', 'Fall\nEquinox', 'Winter\nSolstice'];
      let col = 0;

      if (options && options.tableClass)
        results.push(`<table class="${options.tableClass}">\n`);
      else
        results.push('<table>\n');

      let formatDateTime = EventFinder.formatEventDateTimeWithoutYear;

      if (options && options.formatDateTime)
        formatDateTime = options.formatDateTime;

      let formatYear = (year: number) => year.toString();

      if (options && options.formatYear)
        formatYear = options.formatYear;

      if (options && options.headers)
        headers = options.headers;

      results.push('  <tr>\n');

      if (options && options.southernHemisphere)
        results.push(`    <th>&nbsp;</th><th>${esc(headers[2])}</th><th>${esc(headers[3])}</th><th>${esc(headers[0])}</th><th>${esc(headers[1])}</th>\n`);
      else
        results.push(`    <th>&nbsp;</th><th>${esc(headers[0])}</th><th>${esc(headers[1])}</th><th>${esc(headers[2])}</th><th>${esc(headers[3])}</th>\n`);

      results.push('  </tr>\n');

      events.forEach(event => {
        const year = event.eventTime.wallTime.y;
        const formattedDate = formatDateTime(event);

        if (col === 0) {
          ++col;
          results.push('    <td>');
          results.push(formatYear(year));
          results.push('</td>');
        }

        results.push(`<td>${formattedDate}</td>`);
        ++col;

        if (col > 4) {
          results.push('\n  </tr>\n');
          col = 0;
        }
      });

      results.push('</table>\n');

      return Promise.resolve(results.join(''));
    });
  }

  // This method breaks a day up into segments and looks for segments during which the local
  // altitude of a body passes through the target altitude for rise/set times (or twilight
  // start/end times). Situations such as no rising, no setting, no rising or setting, or
  // even two risings or two settings during a single day are handled.
  //
  public getRiseAndSetTimes(body: number, year: number, month: number, day: number, observer: ISkyObserver,
                            zone?: KsTimeZone, gregorianChange?: GregorianChange,
                            minutesBefore = 0, targetAltitude?: number, doTwilight?: boolean): AstroEvent[] {
    if (!zone)
      zone = KsTimeZone.UT_ZONE;

    if (_.isNil(targetAltitude)) {
      targetAltitude = -REFRACTION_AT_HORIZON;

      if (body === SUN || body === MOON)
        targetAltitude -= AVG_SUN_MOON_RADIUS;
    }

    if (_.isNil(doTwilight))
      doTwilight = (body === SUN && targetAltitude <= MAX_ALT_FOR_TWILIGHT);

    const results: AstroEvent[] = [];
    const dateTime = new KsDateTime({y: year, m: month, d: day, hrs: 0, min: 0, sec: 0, occurrence: 1}, zone, gregorianChange);
    let startOfDay = KsDateTime.julianDay(dateTime.utcTimeMillis) - HALF_MINUTE;
    const minutesInDay = dateTime.getMinutesInDay(year, month, day);

    if (minutesInDay === 0)
      return results;

    const dayLength = minutesInDay / 1440.0;
    let segments = 6;
    let subsegments: number;

    if (body === MOON)
      segments *= 2;

    if (abs(observer.latitude.degrees) > 60.0)
      segments *= 2;

    startOfDay += minutesBefore / 1440.0;

    let startTime = startOfDay;
    let startAltitude = this.ss.getHorizontalPosition(body, startTime, observer).altitude.degrees;
    let endTime: number;
    let endAltitude: number;
    let savedEndAltitude: number;
    let middayAltitude = -90.0;
    let eventTime: number;
    let eventType: number;
    let eventText: string;

    for (let i = 1; i <= segments; ++i) {
      if (i === segments / 2)
        middayAltitude = startAltitude;

      endTime = startOfDay + i / segments * dayLength;
      endAltitude = this.ss.getHorizontalPosition(body, endTime, observer).altitude.degrees;
      savedEndAltitude = endAltitude;

      // If the body seems to be skimming the horizon (or other target altitude)
      // we'll need to break this segment into subsegments.

      if ((abs(startAltitude - targetAltitude) < 1.0 ||
           abs(endAltitude   - targetAltitude) < 1.0) &&
          abs(startAltitude - endAltitude) < 2.0)
        subsegments = 10;
      else
        subsegments = 1;

      for (let j = 1; j <= subsegments; ++j) {
        if (subsegments > 1) {
          if (j < subsegments) {
            endTime = startOfDay + ((i - 1.0) + j / subsegments) / segments * dayLength;
            endAltitude = this.ss.getHorizontalPosition(body, endTime, observer).altitude.degrees;
          }
          else {
            endTime = startOfDay + i / segments * dayLength;
            endAltitude = savedEndAltitude;
          }
        }

        // Is the target altitude in between the start and end altitudes?
        if ((startAltitude <= targetAltitude &&
             targetAltitude < endAltitude) ||
            (endAltitude < targetAltitude && targetAltitude <= startAltitude))
        {
          if (startAltitude < endAltitude) {
            eventType = (doTwilight ? TWILIGHT_BEGINS : RISE_EVENT);
            eventText = (doTwilight ? 'twilight begins' : 'rise');
          }
          else {
            eventType = (doTwilight ? TWILIGHT_ENDS : (minutesBefore !== 0 ? SET_EVENT_MINUS_1_MIN : SET_EVENT));
            eventText = (doTwilight ? 'twilight ends' : (minutesBefore !== 0 ? 'set - 1' : 'set'));
          }

          const zeroFinder = new ZeroFinder((x: number) => {
              return this.ss.getHorizontalPosition(body, x, observer).altitude.degrees - targetAltitude;
            }, 0.001, 8,
            startTime, startAltitude - targetAltitude,
            endTime,   endAltitude - targetAltitude);

          eventTime = zeroFinder.getXAtZero();

          const rsTime = (eventTime - startOfDay) * 24.0;

          results.push(new AstroEvent(eventType, eventText, year, month, day, rsTime, zone, gregorianChange));
        }

        startTime = endTime;
        startAltitude = endAltitude;
      }
    }

    if (!doTwilight && results.length === 0) {
      if (middayAltitude > targetAltitude)
        results.push(new AstroEvent(VISIBLE_ALL_DAY, 'visible all day', year, month, day, 0.0, zone, gregorianChange));
      else
        results.push(new AstroEvent(UNSEEN_ALL_DAY, 'unseen all day', year, month, day, 0.0, zone, gregorianChange));
    }

    return results;
  }

  public getTransitTimes(body: number, year: number, month: number, day: number, observer: ISkyObserver,
                         zone?: KsTimeZone, gregorianChange?: GregorianChange): AstroEvent[] {
    if (!zone)
      zone = KsTimeZone.UT_ZONE;

    const results: AstroEvent[] = [];
    const dateTime = new KsDateTime({y: year, m: month, d: day, hrs: 0, min: 0, sec: 0, occurrence: 1}, zone, gregorianChange);
    const startOfDay = KsDateTime.julianDay(dateTime.utcTimeMillis) - HALF_MINUTE;
    const minutesInDay = dateTime.getMinutesInDay(year, month, day);

    if (minutesInDay === 0)
      return results;

    let  minAltitude = -0.5833;

    if (body === SUN || body === MOON)
      minAltitude = -0.8333;

    const dayLength = minutesInDay / 1440.0;
    const segments = 5;
    let startTime = startOfDay;
    let startAngle = this.ss.getHourAngle(body, startTime, observer, SIGNED_HOUR_ANGLE).radians;
    let endTime: number;
    let endAngle: number;
    let eventTime: number;

    for (let i = 1; i <= segments; ++i) {
      endTime = startOfDay + i / segments * dayLength;
      endAngle = this.ss.getHourAngle(body, endTime, observer, SIGNED_HOUR_ANGLE).radians;

      // No angle change? Too close to a pole -- bail out.
      if (startAngle === endAngle)
        break;

      // Is an hour angle of zero between the start and end angles?
      if (startAngle <= 0.0 && 0.0 < endAngle) {
        const zeroFinder = new ZeroFinder((x: number) => {
            return this.ss.getHourAngle(body, x, observer, SIGNED_HOUR_ANGLE).radians;
          }, 0.0001, 8,
          startTime, startAngle,
          endTime,   endAngle);

        eventTime = zeroFinder.getXAtZero();

        // Accept the event only if the object is above the horizon at the time
        if (this.ss.getHorizontalPosition(body, eventTime, observer).altitude.degrees >= minAltitude) {
          const transitTime = (eventTime - startOfDay) * 24.0;

          results.push(new AstroEvent(TRANSIT_EVENT, 'transit', year, month, day, transitTime, zone, gregorianChange));
        }
      }

      startTime = endTime;
      startAngle = endAngle;
    }

    return results;
  }

  public getMinutesOfDaylight(year: number, month: number, day: number, observer: ISkyObserver,
                              zone?: KsTimeZone, gregorianChange?: GregorianChange): number {
    const sunEvents = this.getRiseAndSetTimes(SUN, year, month, day, observer, zone, gregorianChange);

    if (sunEvents.length === 1 && sunEvents[0].eventType === UNSEEN_ALL_DAY)
      return 0;

    const dateTime = new KsDateTime({y: year, m: month, d: day, hrs: 0, min: 0, sec: 0, occurrence: 1}, zone, gregorianChange);
    const minutesInDay = dateTime.getMinutesInDay(year, month, day);

    if (sunEvents.length === 1 && sunEvents[0].eventType === VISIBLE_ALL_DAY)
      return minutesInDay;

    const startOfDay = KsDateTime.julianDay(dateTime.utcTimeMillis);
    let lastTime = startOfDay;
    let total = 0;
    let lastEvent = NON_EVENT;

    sunEvents.forEach(event => {
      if (event.eventType === RISE_EVENT) {
        lastEvent = RISE_EVENT;
        lastTime = event.ut;
      }
      else if (event.eventType === SET_EVENT) {
        total += event.ut - lastTime;
        lastEvent = SET_EVENT;
      }
    });

    if (lastEvent === RISE_EVENT)
      total += startOfDay + minutesInDay / 1440 - lastTime;

    return min(round(total * 1440), minutesInDay);
  }

  public getMonthOfEvents(body: number, year: number, month: number, observer: ISkyObserver,
                          zone?: KsTimeZone, gregorianChange?: GregorianChange, targetAltitude?: number): AstroEvent[] {
    const monthsEvents: AstroEvent[] = [];
    const eAndSList = this.getEquinoxesAndSolsticesForOneYear(year, zone, gregorianChange);
    const dateTime = new KsDateTime(null, zone ? zone : KsTimeZone.UT_ZONE, gregorianChange);

    for (const event of eAndSList) {
      if (event.eventTime.wallTime.m === month) {
        monthsEvents.push(event);
        break;
      }
    }

    const keyPhases = this.getLunarPhasesForMonth(year, month, zone, gregorianChange);

    Array.prototype.push.apply(monthsEvents, keyPhases);

    const firstDay = dateTime.getFirstDateInMonth(year, month);
    const lastDay = dateTime.getLastDateInMonth(year, month);
    const missing = dateTime.getMissingDateRange(year, month);
    let doTwilight = false;

    if (_.isNil(targetAltitude)) {
      targetAltitude = -REFRACTION_AT_HORIZON;

      if (body === SUN || body === MOON)
        targetAltitude -= AVG_SUN_MOON_RADIUS;
    }
    else
      doTwilight = true;

    for (let day = firstDay; day <= lastDay; ++day) {
      if (missing && missing[0] <= day && day <= missing[1])
        continue;

      const risesAndSets = this.getRiseAndSetTimes(body, year, month, day, observer, zone, gregorianChange, 0, targetAltitude, doTwilight);

      Array.prototype.push.apply(monthsEvents, risesAndSets);

      const transits = this.getTransitTimes(body, year, month, day, observer, zone, gregorianChange);

      Array.prototype.push.apply(monthsEvents, transits);
    }

    monthsEvents.sort((a: AstroEvent, b: AstroEvent): number => {
      return a.eventTime.utcTimeMillis - b.eventTime.utcTimeMillis;
    });

    return monthsEvents;
  }

  public getRiseAndSetEvents(body: number, year: number, month: number, day: number, dayCount: number, observer: ISkyObserver,
                             zone?: KsTimeZone, gregorianChange?: GregorianChange, twilightAltitude?: number): Promise<AstroEvent[][]> {
    const results: AstroEvent[][] = [];
    const calendar = new KsCalendar(gregorianChange);

    let dayNum = 0;

    const calculate = () => {
      const startTick = Date.now();

      while (dayNum < dayCount && Date.now() < startTick + 50) {
        const ymd = calendar.addDaysToDate(dayNum, year, month, day);
        const eventsForOneDay: AstroEvent[] = [];

        Array.prototype.push.apply(eventsForOneDay, this.getRiseAndSetTimes(body, ymd.y, ymd.m, ymd.d, observer, zone, gregorianChange, 0, null, false));

        if (body === SUN && !_.isNil(twilightAltitude))
          Array.prototype.push.apply(eventsForOneDay, this.getRiseAndSetTimes(body, ymd.y, ymd.m, ymd.d, observer, zone, gregorianChange, 0, twilightAltitude, true));

        Array.prototype.push.apply(eventsForOneDay, this.getTransitTimes(body, ymd.y, ymd.m, ymd.d, observer, zone, gregorianChange));

        if (eventsForOneDay.length > 0) {
          eventsForOneDay.sort((a, b) => {
            return sign(a.ut - b.ut);
          });

          results.push(eventsForOneDay);
        }

        ++dayNum;
      }
    };

    return new Promise<AstroEvent[][]>((resolve, reject) => {
      const loop = () => {
        calculate();

        if (dayNum === dayCount)
          resolve(results);
        else
          setTimeout(loop);
      };

      setTimeout(loop);
    });
  }

  public getRiseAndSetEventsAsHtml(body: number, year: number, month: number, day: number, dayCount: number, observer: ISkyObserver,
                                   zone?: KsTimeZone, gregorianChange?: GregorianChange, twilightAltitude?: number, options?: RiseAndSetHtmlOptions): Promise<string> {
    return this.getRiseAndSetEvents(body, year, month, day, dayCount, observer, zone, gregorianChange, twilightAltitude).then(daysOfEvents => {
      const results: string[] = [];
      const doTwilight = (body === SUN && !_.isNil(twilightAltitude));

      if (options && options.tableClass)
        results.push(`<table class="${options.tableClass}">\n`);
      else
        results.push('<table>\n');

      let headers: string[];

      if (options && options.headers)
        headers = options.headers;
      else if (doTwilight)
        headers = ['Twilight\nBegins', '\nRise', '\nTransit', '\nSet', 'Twilight\nEnds'];
      else
        headers = ['Rise', 'Transit', 'Set'];

      let extraColumn = false;

      if (!doTwilight)
        extraColumn = _.findIndex(_.flatten(daysOfEvents), {eventType: VISIBLE_ALL_DAY}) >= 0;

      if (extraColumn && headers.length === 3)
        headers.push('\u00A0');

      results.push('  <tr>\n    <th>&nbsp;</th>');
      headers.forEach(header => results.push(`<th>${esc(header)}</th>`));
      results.push('\n  </tr>\n');

      let lastMonth = -1;
      let formatDate = EventFinder.formatEventDate;

      if (options && options.formatDate)
        formatDate = options.formatDate;

      const formatDay = (event: AstroEvent) => {
        const d = event.eventTime.wallTime.d;

        return (d < 10 ? '0' : '') + d;
      };

      if (options && options.formatDay)
        formatDate = options.formatDay;

      let formatTime = EventFinder.formatEventTime;

      if (options && options.formatTime)
        formatTime = options.formatTime;

      let unseenAllDay = 'below horizon all day';

      if (options && options.unseenAllDay)
        unseenAllDay = options.unseenAllDay;

      let visibleAllDay = 'above horizon all day';

      if (options && options.visibleAllDay)
        visibleAllDay = options.visibleAllDay;

      daysOfEvents.forEach(events => {
        let date;
        const m = events[0].eventTime.wallTime.m;

        if (m !== lastMonth) {
          date = formatDate(events[0]);
          lastMonth = m;
        }
        else
          date = formatDay(events[0]);

        results.push('  <tr>\n');
        results.push(`    <td>${date}</td>`);

        const tableOffset = (doTwilight ? 0 : 1);
        const cols = (doTwilight ? 5 : (extraColumn ? 4 : 3));
        const output: string[][] = [[], []];

        events.forEach(event => {
          let col: number;
          let row: number;
          let text: string;

          // noinspection FallThroughInSwitchStatementJS
          switch (event.eventType) {
            case TWILIGHT_BEGINS: col = 0; break;
            case UNSEEN_ALL_DAY:
              text = unseenAllDay;
            case RISE_EVENT:      col = 1; break;
            case TRANSIT_EVENT:   col = 2; break;
            case VISIBLE_ALL_DAY:
              text = visibleAllDay;
            case SET_EVENT:       col = 3; break;
            case TWILIGHT_ENDS:   col = 4; break;
          }

          col -= tableOffset;
          row = 0;

          if (output[row][col])
            ++row;

          if (!text)
            text = formatTime(event);

          output[row][col] = text;
        });

        if (output[1].length === 0)
          output.length = 1;

        let skip = 0;

        output.forEach((row, rowIndex) => {
          if (rowIndex > 0)
            results.push('\n  </tr>\n    <td>&nbsp;</td>');

          for (let i = 0; i < cols; ++i) {
            if (skip) {
              --skip;
              continue;
            }

            const text = row[i];

            if (!text)
              results.push(`<td>&nbsp;</td>`);
            else if (text === unseenAllDay || text === visibleAllDay) {
              results.push(`<td colspan="2">${text}</td>`);
              skip = 1;
            }
            else
              results.push(`<td>${text}</td>`);
          }
        });

        results.push('\n  </tr>\n');
      });

      return results.join('');
    });
  }

  public getGalileanMoonEvents(startJdu: number, endJdu: number, includeGrsTransits: boolean, zone?: KsTimeZone, gregorianChange?: GregorianChange): Promise<AstroEvent[]> {
    const results: AstroEvent[] = [];

    let t = floor(startJdu * 1440.0) / 1440.0;

    const calculate = () => {
      const startTick = Date.now();

      do {
        const mEvents = this.jupitersMoons.getMoonEventsForOneMinuteSpan(t, true, includeGrsTransits ? this.jupiterInfo : null);

        if (mEvents.count > 0) {
          // Round event time to nearest minute by adding half a minute.
          const event = AstroEvent.fromJdu(GALILEAN_MOON_EVENT, mEvents.text, t + 1 / 2880.0, zone, gregorianChange, mEvents.searchDeltaT);

          event.miscInfo = mEvents;
          results.push(event);
        }

        t += mEvents.searchDeltaT / 1440.0;
      } while (t < endJdu && Date.now() < startTick + 50);
    };

    return new Promise<AstroEvent[]>((resolve, reject) => {
      const loop = () => {
        calculate();

        if (t >= endJdu)
          resolve(results);
        else
          setTimeout(loop);
      };

      setTimeout(loop);
    });
  }

  public getGalileanMoonEventsAsHtml(startJdu: number, endJdu: number, includeGrsTransits: boolean, zone?: KsTimeZone,
                                     gregorianChange?: GregorianChange, options?: GalileanMoonsHtmlOptions): Promise<string> {
    return this.getGalileanMoonEvents(startJdu, endJdu, includeGrsTransits, zone, gregorianChange).then(events => {
      const results: string[] = [];
      let lastDay = -1;

      if (options && options.tableClass)
        results.push(`<table class="${options.tableClass}">\n`);
      else
        results.push('<table>\n');

      let formatDateTime = EventFinder.formatEventDateTime;

      if (options && options.formatDateTime)
        formatDateTime = options.formatDateTime;

      let formatTime = EventFinder.formatEventTime;

      if (options && options.formatTime)
        formatTime = options.formatTime;

      events.forEach(event => {
        let dateTime;
        const wallTime = event.eventTime.wallTime;

        if (wallTime.d !== lastDay) {
          dateTime = formatDateTime(event);
          lastDay = wallTime.d;
        }
        else
          dateTime = formatTime(event);

        results.push('  <tr>\n');
        results.push(`    <td>${dateTime}</td><td>${event.eventText}</td>\n`);
        results.push('  </tr>\n');
      });

      results.push('</table>\n');

      return results.join('');
    });
  }

  public findEvent(planet: number, eventType: number, originalTime: number,
                   observer: ISkyObserver, zone?: KsTimeZone, gregorianChange?: GregorianChange,
                   doPrevious = false, argument?: any): AstroEvent {
    if (!zone)
      zone = KsTimeZone.UT_ZONE;

    const delta = (doPrevious ? -1 : 1);

    originalTime += delta * HALF_MINUTE; // Bias time by a half minute towards the event seek direction.

    const dateTime = new KsDateTime(KsDateTime.millisFromJulianDay(originalTime), zone, gregorianChange);
    let ymd: YMDDate = dateTime.wallTime;

    let testTime = originalTime;
    let eventPeriod = 0.0;
    let eventTime: number;
    let events: AstroEvent[];
    let event: AstroEvent;
    let tries = 0;
    let a: number, b: number;
    let minEventGap = 5.0, eventGap: number;

    while (true) {
      switch (eventType) {
        case RISE_EVENT:
        case SET_EVENT:
        case SET_EVENT_MINUS_1_MIN:
        case TRANSIT_EVENT:
        case TWILIGHT_BEGINS:
        case TWILIGHT_ENDS:
          if (tries > 0)
            ymd = dateTime.addDaysToDate(delta, ymd);

          let minsBefore = 0;
          let targetAlt: number = undefined;

          if (eventType === TWILIGHT_BEGINS || eventType === TWILIGHT_ENDS) {
            if (!_.isNumber(argument))
              targetAlt = NAUTICAL_TWILIGHT;
            else if (<number> argument < 0)
              targetAlt = <number> argument;
            else
              minsBefore = (eventType === TWILIGHT_ENDS ? -<number> argument : <number> argument);

            events = this.getRiseAndSetTimes(SUN, ymd.y, ymd.m, ymd.d, observer, zone, gregorianChange, minsBefore, targetAlt, true);
          }
          else if (eventType === TRANSIT_EVENT)
            events = this.getTransitTimes(planet, ymd.y, ymd.m, ymd.d, observer, zone, gregorianChange);
          else
            events = this.getRiseAndSetTimes(planet, ymd.y, ymd.m, ymd.d, observer, zone, gregorianChange, eventType === SET_EVENT_MINUS_1_MIN ? 1 : 0);
        break;

        case SPRING_EQUINOX:
        case SUMMER_SOLSTICE:
        case FALL_EQUINOX:
        case WINTER_SOLSTICE:
          if (tries === 1)
            ymd.y += delta;
          else if (tries > 1)
            return null;

          events = this.getEquinoxesAndSolsticesForOneYear(ymd.y, zone, gregorianChange);
        break;

        case NEW_MOON:
        case FIRST_QUARTER:
        case FULL_MOON:
        case LAST_QUARTER:
          if (tries > 0)
            ymd = dateTime.addDaysToDate(delta, ymd);

          events = [];
          event = this.getLunarPhaseEvent(ymd.y, ymd.m, ymd.d, zone, gregorianChange);

          if (event)
            events.push(event);
        break;

        case OPPOSITION:
        case SUPERIOR_CONJUNCTION:
        case INFERIOR_CONJUNCTION:
        case GREATEST_ELONGATION:
        case QUADRATURE:
          eventPeriod = SolarSystem.getMeanConjunctionPeriod(planet);
          // Execution intended to fall through to next section...
        case LUNAR_ECLIPSE:
        case SOLAR_ECLIPSE:
        case APHELION:
        case PERIHELION:
        case GRS_TRANSIT_EVENT:
          let resolution = (planet <= MARS ? 1.0 / 24.0 : 1.0); // hours or days
          const tolerance = 0.0001;
          let seekMin = false;
          let seekMax = false;
          let seekZero = false;
          let divisions = 10;

          switch (eventType) {
            case OPPOSITION:
            case SUPERIOR_CONJUNCTION:
            case INFERIOR_CONJUNCTION:
              resolution = 1.0 / 1440.0; // minutes
              seekZero = true;
            break;

            case GREATEST_ELONGATION:
              seekMax = true;
            break;

            case PERIHELION:
              eventPeriod = SolarSystem.getMeanOrbitalPeriod(planet) * 1.25;

              if (planet >= URANUS)
                divisions = 20;

              seekMin = true;
            break;

            case APHELION:
              eventPeriod = SolarSystem.getMeanOrbitalPeriod(planet) * 1.25;

              if (planet >= URANUS)
                divisions = 20;

              seekMax = true;
            break;

            case LUNAR_ECLIPSE:
            case SOLAR_ECLIPSE:
              eventPeriod = MEAN_SYNODIC_MONTH * 1.25;
              resolution = 1.0 / 1440.0; // minutes
              divisions = 30;
              seekMin = true;
            break;

            case QUADRATURE:
              resolution = 1.0 / 1440.0; // minutes
              seekMax = true;
            break;

            case GRS_TRANSIT_EVENT:
              eventPeriod = MEAN_JUPITER_SYS_II * 1.25;
              resolution = 1.0 / 1440.0; // minutes
              seekZero = true;
            break;
          }

          const eventTimes: number[] = [];
          const eventValues: number[] = [];

          events = [];

          for (let i = 0; i <= divisions; ++i) {
            eventTimes[i]  = testTime + i * eventPeriod / divisions - eventPeriod / 2.0;
            eventValues[i] = this.getEventSearchValue(planet, eventType, eventTimes[i]);

            if (!seekZero && i < 2 || i < 1)
              continue;

            if (seekZero && ((eventValues[i - 1] <= 0.0 && 0.0 <  eventValues[i]) ||
                             (eventValues[i - 1] >  0.0 && 0.0 >= eventValues[i])))
            {
              if (abs(eventValues[i - 1] - eventValues[i]) > 180.0)
                continue;

              const zeroFinder = new ZeroFinder((x: number) => {
                    return this.getEventSearchValue(planet, eventType, x);
                  }, tolerance, 10,
                  eventTimes[i - 1], eventValues[i - 1],
                  eventTimes[i],     eventValues[i]);

              eventTime = zeroFinder.getXAtZero();
            }
            else if (seekMin && eventValues[i - 2] > eventValues[i - 1] && eventValues[i - 1] < eventValues[i] ||
                  seekMax && eventValues[i - 2] < eventValues[i - 1] && eventValues[i - 1] > eventValues[i])
            {
              const minMaxFinder = new MinMaxFinder((x: number) => {
                    return this.getEventSearchValue(planet, eventType, x);
                  }, 1E-10, 100,
                  eventTimes[i - 2], eventTimes[i - 1], eventTimes[i]);

              eventTime = minMaxFinder.getXAtMinMax();
            }
            else
              continue;

            if ((planet === MERCURY || planet === VENUS) &&
               (eventType === SUPERIOR_CONJUNCTION || eventType === INFERIOR_CONJUNCTION))
            {
              const inferior = this.isInferior(planet, eventTime);

              if (eventType === SUPERIOR_CONJUNCTION && inferior ||
                  eventType === INFERIOR_CONJUNCTION && !inferior)
                continue;
            }

            // Since the min-max finder has a hard time settling down on a consistent
            // time for the same event when the differences from moment to moment are
            // very small, we'll do an additional sweep by steps of the current resolution.
            // Once the differences from moment to moment are less than any real available
            // precision, producing consistent results when skipping back and forth through
            // events is what becomes important.

            let testMoment;
            let testValue: number, bestValue = 0.0;

            // When the resolution is in whole days, center on midnight instead of noon.
            if (resolution === 1.0)
              testMoment = floor(eventTime + 0.5) - 0.5;
            else
              testMoment = floor(eventTime / resolution - 4.5) * resolution;

            for (let j = -5; j <= 5; ++j) {
              testValue = this.getEventSearchValue(planet, eventType, testMoment);

              if (j === -5 ||
                 seekZero && abs(bestValue) > abs(testValue) ||
                 seekMin && bestValue > testValue ||
                 seekMax && bestValue < testValue)
              {
                bestValue = testValue;
                eventTime = testMoment;
              }

              testMoment += resolution;
            }

            let ei: EclipseInfo;

            if (eventType === LUNAR_ECLIPSE) {
              ei = this.ss.getLunarEclipseInfo(UT_to_TDB(eventTime));

              if (!ei.inPenumbra)
                continue;
            }

            if (eventType === SOLAR_ECLIPSE) {
              ei = this.ss.getSolarEclipseInfo(UT_to_TDB(eventTime));

              if (!ei.inPenumbra)
                continue;
              else
                // Since the clock will be rounded up half a minute, we'll get the location
                // of the fast-moving shadow at that moment.
                ei = this.ss.getSolarEclipseInfo(UT_to_TDB(eventTime + 0.5 / 1440.0), true);
            }

            // TODO: Add event text
            event = AstroEvent.fromJdu(eventType, '', eventTime, zone, gregorianChange, bestValue);

            if (ei)
              event.miscInfo = ei;

            events.push(event);
          }

          testTime += eventPeriod * delta * 0.95;
        break;

        case GALILEAN_MOON_EVENT:
          minEventGap = 0.49;
          testTime = floor(testTime * 1440.0) / 1440.0;
          events = [];

          const mevents = this.jupitersMoons.getMoonEventsForOneMinuteSpan(testTime, true);

          if (mevents.count > 0) {
            event = AstroEvent.fromJdu(GALILEAN_MOON_EVENT, 'Galilean moon', testTime, zone, gregorianChange, mevents.searchDeltaT);
            event.miscInfo = mevents.text;
            events.push(event);
          }

          testTime += (delta * mevents.searchDeltaT + 0.1) / 1440.0;
        break;

        default:
          return null;
      }

      a = 0;
      b = events.length - 1;

      if (doPrevious) {
        a = b;
        b = 0;
      }

      for (let i = a; i !== b + delta; i += delta) {
        event = events[i];
        eventTime = event.ut;

        if (tries === 0)
          eventGap = 0.49;
        else
          eventGap = minEventGap;

        if (event.eventType === eventType && (eventTime - originalTime) * delta >= eventGap / 1440.0) {
          if (eventType === GREATEST_ELONGATION) {
            let message: string;
            const angle = new Angle(event.value, Unit.DEGREES);
            const angleStr = angle.toString(FMT_DD | FMT_MINS, 0);

            if (this.ss.getSolarElongationInLongitude(planet, eventTime) > 0)
              message = '{0} in evening sky, {1} east of Sun';
            else
              message = '{0} in morning sky, {1} west of Sun';

            message = message.replace('{0}', this.ss.getPlanetName(planet));
            message = message.replace('{1}', angleStr);
            event.miscInfo = message;
          }

          return event;
        }
      }

      ++tries;
    }
  }

  protected  getEventSearchValue(planet: number, eventType: number, time_JDU: number): number {
    const time_JDE = UT_to_TDB(time_JDU);

    switch (eventType) {
      case OPPOSITION:
        return mod2(this.ss.getSolarElongationInLongitude(planet, time_JDE) + 180.0, 360.0);

      case SUPERIOR_CONJUNCTION:
      case INFERIOR_CONJUNCTION:
        return mod2(this.ss.getSolarElongationInLongitude(planet, time_JDE), 360.0);

      case GREATEST_ELONGATION:
        return this.ss.getSolarElongation(planet, time_JDE);

      case PERIHELION:
      case APHELION:
        return this.ss.getHeliocentricPosition(planet, time_JDE, planet >= NEPTUNE ? QUICK_PLANET : 0).radius;

      case LUNAR_ECLIPSE:
        return this.ss.getLunarEclipseInfo(time_JDE).centerSeparation;

      case SOLAR_ECLIPSE:
        return this.ss.getSolarEclipseInfo(time_JDE).centerSeparation;

      case QUADRATURE:
        const sinElong = sin_deg(this.ss.getSolarElongationInLongitude(planet, time_JDE));

        return sinElong * sinElong;

      case GRS_TRANSIT_EVENT:
        if (this.jupiterInfo)
          return this.jupiterInfo.getGRSCMOffset(time_JDE).degrees;
      // Falls through
      default:
        return 0.0;
    }
  }

  protected isInferior(planet: number, time_JDU: number): boolean {
    if (planet !== MERCURY && planet !== VENUS)
      return false;

    const time_JDE = UT_to_TDB(time_JDU);
    const sunPos = this.ss.getEclipticPosition(SUN, time_JDE);
    const planetPos = this.ss.getEclipticPosition(planet, time_JDE);

    return (planetPos.radius < sunPos.radius);
  }
}
