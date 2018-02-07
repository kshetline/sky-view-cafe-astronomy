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

import * as _ from 'lodash';
import * as M_ from './ks-math';
import * as S_ from './ks-util';

export enum CalendarType {PURE_GREGORIAN, PURE_JULIAN}
export const GREGORIAN_CHANGE_MIN_YEAR = 300;
export const GREGORIAN_CHANGE_MAX_YEAR = 3900;
export const DISTANT_YEAR_PAST = -9999999;
export const DISTANT_YEAR_FUTURE = 9999999;

export const FIRST_GREGORIAN_DAY_SGC = -141427; // 1582-10-15

export const SUNDAY    = 0;
export const MONDAY    = 1;
export const TUESDAY   = 2;
export const WEDNESDAY = 3;
export const THURSDAY  = 4;
export const FRIDAY    = 5;
export const SATURDAY  = 6;

/**
 * @description Constant for indicating the last occurrence of a particular day of the week (e.g. the last Tuesday) of a given month.
 */
export const LAST = 6;

export interface YMDDate {
  y: number;
  m: number;
  d: number;
  n?: number; // Day number where 1970-01-01 = 0.
  j?: boolean; // true if Julian calendar date.
}

export type YearOrDate = number | YMDDate | number[];
export type GregorianChange = YMDDate | CalendarType | string;

export function handleVariableDateArgs(yearOrDate: YearOrDate, month?: number, day?: number): number[] {
  let year: number;

  if (_.isNumber(yearOrDate))
    year = <number> yearOrDate;
  else if (_.isArray(yearOrDate) && (<number[]> yearOrDate).length >= 3 && _.isNumber((<number[]> yearOrDate)[0]))
    return <number[]> yearOrDate;
  else if (_.isObject(yearOrDate)) {
    year  = (<YMDDate> yearOrDate).y;
    month = (<YMDDate> yearOrDate).m;
    day   = (<YMDDate> yearOrDate).d;
  }

  if (_.isUndefined(year) || _.isUndefined(month) || _.isUndefined(day))
    throw('KsCalendar: Invalid date arguments');

  return [year, month, day];
}

export function isJulianCalendarDate_SGC(yearOrDate: YearOrDate, month?: number, day?: number): boolean {
  let year: number; [year, month, day] = handleVariableDateArgs(yearOrDate, month, day);

  return (year < 1582 || (year === 1582 && (month < 10 || month === 10 && day < 15)));
}

export function getDayNumber_SGC(yearOrDate: YearOrDate, month?: number, day?: number): number {
  let year: number; [year, month, day] = handleVariableDateArgs(yearOrDate, month, day);

  while (month <  1) { month += 12; --year; }
  while (month > 12) { month -= 12; ++year; }

  if (isJulianCalendarDate_SGC(year, month, day))
    return getDayNumberJulian(year, month, day);
  else
    return getDayNumberGregorian(year, month, day);
}

export function getDayNumberGregorian(yearOrDate: YearOrDate, month?: number, day?: number): number {
  let year: number; [year, month, day] = handleVariableDateArgs(yearOrDate, month, day);

  while (month <  1) { month += 12; --year; }
  while (month > 12) { month -= 12; ++year; }

  return 367 * year - M_.div_rd(7 * (year + M_.div_tt0(month + 9, 12)), 4) - M_.div_tt0(3 * (M_.div_tt0(year + M_.div_tt0(month - 9, 7), 100) + 1), 4) +
    M_.div_tt0(275 * month, 9) + day - 719559;
}

export function getDayNumberJulian(yearOrDate: YearOrDate, month?: number, day?: number): number {
  let year: number; [year, month, day] = handleVariableDateArgs(yearOrDate, month, day);

  while (month <  1) { month += 12; --year; }
  while (month > 12) { month -= 12; ++year; }

  return 367 * year - M_.div_rd(7 * (year + M_.div_tt0(month + 9, 12)), 4) + M_.div_tt0(275 * month, 9) + day - 719561;
}

// Always returns 1. This function exists only to parallel getFirstDateInMonth, which can be a different
// value when the Gregorian change date is not fixed.
//
export function getFirstDateInMonth_SGC(year: number, month: number): number {
  return 1;
}

export function getLastDateInMonth_SGC(year: number, month: number): number {
  if (month === 9 || month === 4 || month === 6 || month === 11)
    return 30;
  else if (month !== 2)
    return 31; // Works for pseudo-months 0 and 13 as well.
  else if (year % 4 === 0 && (year < 1583 || year % 100 !== 0 || year % 400 === 0))
    return 29;
  else
    return 28;
}

export function getLastDateInMonthGregorian(year: number, month: number): number {
  if (month === 9 || month === 4 || month === 6 || month === 11)
    return 30;
  else if (month !== 2)
    return 31; // Works for pseudo-months 0 and 13 as well.
  else if (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))
    return 29;
  else
    return 28;
}

export function getLastDateInMonthJulian(year: number, month: number): number {
  if (month === 9 || month === 4 || month === 6 || month === 11)
    return 30;
  else if (month !== 2)
    return 31; // Works for pseudo-months 0 and 13 as well.
  else if (year % 4 === 0)
    return 29;
  else
    return 28;
}

export function getDaysInMonth_SGC(year: number, month: number): number {
  if (year === 1582 && month === 10)
    return 21;
  else if (month === 9 || month === 4 || month === 6 || month === 11)
    return 30;
  else if (month !== 2)
    return 31; // Works for pseudo-months 0 and 13 as well.
  else
    return getDayNumber_SGC(year, 3, 1) - getDayNumber_SGC(year, 2, 1);
}

export function getDaysInYear_SGC(year: number): number {
  return getDayNumber_SGC(year + 1, 1, 1) - getDayNumber_SGC(year, 1, 1);
}

/**
 * @description Get day of week for a given 1970-01-01-based day number.
 *
 * @param {number} dayNum - 1970-01-01-based day number.
 *
 * @return {number} Day of week as 0-6: 0 for Sunday, 1 for Monday... 6 for Saturday.
 */
export function getDayOfWeek(dayNum: number): number {
  return M_.mod(dayNum + 4, 7);
}

/**
 * @description Get day of week for a given date, assuming standard Gregorian change.
 *
 * @param {YearOrDate} yearOrDateOrDayNum - 1970-01-01-based day number (month and date must be left undefined) - OR -
 *                                          YMDDate form y/m/d - OR - [y, m, d].
 * @param {number} month
 *
 * @param {number} day
 *
 * @return {number} Day of week as 0-6: 0 for Sunday, 1 for Monday... 6 for Saturday.
 */
export function getDayOfWeek_SGC(yearOrDateOrDayNum: YearOrDate, month?: number, day?: number): number {
  if (_.isNumber(yearOrDateOrDayNum) && _.isUndefined(month))
    return M_.mod(<number> yearOrDateOrDayNum + 4, 7);
  else
    return getDayOfWeek(getDayNumber_SGC(yearOrDateOrDayNum, month, day));
}

/**
 * @description Get the date of the index-th day of the week of a given month, e.g. the date of the
 * first Wednesday or the third Monday or the last Friday of the month.
 *
 * @param {number} year - Year.
 * @param {number} month - Month.
 * @param {number} dayOfTheWeek - The day of the week (e.g. 0 for Sunday, 2 for Tuesday, 6 for Saturday) for
 *                                which you wish to find the date.
 * @param {number} index - A value of 1-5, or LAST (6), for the occurrence of the specified day of the week.
 *
 * @return {number} 0 if the described day does not exist (e.g. there is no fifth Monday in the given month) or
 *                  the date of the specified day.
 */
export function getDateOfNthWeekdayOfMonth_SGC(year: number, month: number, dayOfTheWeek: number, index: number): number {
  const last: boolean = (index >= LAST);
  const day = 1;
  let dayNum: number = getDayNumber_SGC(year, month, day);
  const dayOfWeek = getDayOfWeek(dayNum);
  let ymd: YMDDate;
  let lastDay = 0;

  if (dayOfWeek === dayOfTheWeek && index === 1)
    return day;

  dayNum += M_.mod(dayOfTheWeek - dayOfWeek, 7);
  ymd = getDateFromDayNumber_SGC(dayNum);

  while (ymd.m === month) {
    lastDay = ymd.d;

    if (--index === 0)
      return lastDay;

    dayNum += 7;
    ymd = getDateFromDayNumber_SGC(dayNum);
  }

  if (last)
    return lastDay;
  else
    return 0;
}

export function getDayOfWeekInMonthCount_SGC(year: number, month: number, dayOfTheWeek: number): number {
  const firstDay = getDayNumber_SGC(year, month, getDateOfNthWeekdayOfMonth_SGC(year, month, dayOfTheWeek, 1));
  const nextMonth = getDayNumber_SGC(year, month + 1, 1);

  return (nextMonth - firstDay - 1) / 7 + 1;
}

export function getDayOnOrAfter_SGC(year: number, month: number, dayOfTheWeek: number, minDate: number): number {
  const dayNum = getDayNumber_SGC(year, month, minDate);
  const dayOfWeek = getDayOfWeek(dayNum);
  const delta = M_.mod(dayOfTheWeek - dayOfWeek, 7);

  if (year === 1582 && month === 10) {
    const ymd = getDateFromDayNumber_SGC(dayNum + delta);

    if (ymd.y !== year || ymd.m !== month)
      minDate = 0;
    else
      minDate = ymd.d;
  }
  else {
    minDate += delta;

    if (minDate > getLastDateInMonth_SGC(year, month))
      minDate = 0;
  }

  return minDate;
}

export function getDayOnOrBefore_SGC(year: number, month: number, dayOfTheWeek: number, maxDate: number): number {
  const dayNum = getDayNumber_SGC(year, month, maxDate);
  const dayOfWeek = getDayOfWeek(dayNum);
  const delta = M_.mod(dayOfWeek - dayOfTheWeek, 7);

  if (year === 1582 && month === 10) {
    const ymd = getDateFromDayNumber_SGC(dayNum - delta);

    if (ymd.y !== year || ymd.m !== month)
      maxDate = 0;
    else
      maxDate = ymd.d;
  }
  else {
    maxDate -= delta;

    if (maxDate < 0)
      maxDate = 0;
  }

  return maxDate;
}

export function addDaysToDate_SGC(deltaDays: number, yearOrDate: YearOrDate, month?: number, day?: number): YMDDate {
  return getDateFromDayNumber_SGC(getDayNumber_SGC(yearOrDate, month, day) + deltaDays);
}

export function getDateFromDayNumber_SGC(dayNum: number): YMDDate {
  if (dayNum >= FIRST_GREGORIAN_DAY_SGC)
    return getDateFromDayNumberGregorian(dayNum);
  else
    return getDateFromDayNumberJulian(dayNum);
}

export function getDateFromDayNumberGregorian(dayNum: number): YMDDate {
  let year: number;
  let month: number;
  let day: number;
  let lastDay: number;

  year = Math.floor((dayNum + 719528) / 365.2425);

  while (dayNum < getDayNumberGregorian(year, 1, 1))
    --year;

  while (dayNum >= getDayNumberGregorian(year + 1, 1, 1))
    ++year;

  day = dayNum - getDayNumberGregorian(year, 1, 1) + 1;

  for (month = 1; day > (lastDay = getLastDateInMonthGregorian(year, month)); ++month)
    day -= lastDay;

  return {y: year, m: month, d: day, n: dayNum, j: false};
}

export function getDateFromDayNumberJulian(dayNum: number): YMDDate {
  let year: number;
  let month: number;
  let day: number;
  let lastDay: number;

  year = Math.floor((dayNum + 719530) / 365.25);

  while (dayNum < getDayNumberJulian(year, 1, 1))
    --year;

  while (dayNum >= getDayNumberJulian(year + 1, 1, 1))
    ++year;

  day = dayNum - getDayNumberJulian(year, 1, 1) + 1;

  for (month = 1; day > (lastDay = getLastDateInMonthJulian(year, month)); ++month)
    day -= lastDay;

  return {y: year, m: month, d: day, n: dayNum, j: true};
}

export function isValidDate_SGC(yearOrDate: YearOrDate, month?: number, day?: number): boolean {
  let year: number; [year, month, day] = handleVariableDateArgs(yearOrDate, month, day);
  const ymd: YMDDate = getDateFromDayNumber_SGC(getDayNumber_SGC(year, month, day));

  return (year === ymd.y && month === ymd.m && day === ymd.d);
}

export function isValidDateGregorian(yearOrDate: YearOrDate, month?: number, day?: number): boolean {
  let year: number; [year, month, day] = handleVariableDateArgs(yearOrDate, month, day);
  const ymd: YMDDate = getDateFromDayNumberGregorian(getDayNumberGregorian(year, month, day));

  return (year === ymd.y && month === ymd.m && day === ymd.d);
}

export function isValidDateJulian(yearOrDate: YearOrDate, month?: number, day?: number): boolean {
  let year: number; [year, month, day] = handleVariableDateArgs(yearOrDate, month, day);
  const ymd: YMDDate = getDateFromDayNumberJulian(getDayNumberJulian(year, month, day));

  return (year === ymd.y && month === ymd.m && day === ymd.d);
}

export function getISOFormatDate(yearOrDate: YearOrDate, month?: number, day?: number): string {
  let year: number; [year, month, day] = handleVariableDateArgs(yearOrDate, month, day);

  const yyyy = (year < 0 ? '-' : '') + S_.padLeft(Math.abs(year), 4, '0');
  const mm   = S_.padLeft(month, 2, '0');
  const dd   = S_.padLeft(day, 2, '0');

  return yyyy + '-' + mm + '-' + dd;
}

export function parseISODate(date: string): YMDDate {
  let sign = 1;

  if (date.startsWith('-')) {
    sign = -1;
    date = date.substring(1);
  }

  const match = /(\d+)-(\d+)-(\d+)/.exec(date);

  if (!match)
    throw new Error('Invalid ISO date');

  return {y: Number(match[1]) * sign, m: Number(match[2]), d: Number(match[3])};
}

export class KsCalendar {
  private gcYear  = 1582;
  private gcMonth = 10;
  private gcDate  = 15;
  private firstGregorianDay: number = FIRST_GREGORIAN_DAY_SGC;
  private firstDateInGCChangeMonth = 1;
  private lengthOfGCChangeMonth = 21;
  private lastJulianYear:  number = Number.MIN_SAFE_INTEGER;
  private lastJulianMonth: number = Number.MIN_SAFE_INTEGER;
  private lastJulianDate = 4;

  constructor(gcYearOrDateOrType?: YearOrDate | CalendarType | string, gcMonth?: number, gcDate?: number) {
    if (gcYearOrDateOrType === CalendarType.PURE_GREGORIAN)
      this.setGregorianChange(DISTANT_YEAR_PAST, 0, 0);
    else if (gcYearOrDateOrType === CalendarType.PURE_JULIAN)
      this.setGregorianChange(DISTANT_YEAR_FUTURE, 0, 0);
    else if (arguments.length === 0 || _.isNil(gcYearOrDateOrType))
      this.setGregorianChange(1582, 10, 15);
    else
      this.setGregorianChange(<YearOrDate | string> gcYearOrDateOrType, gcMonth, gcDate);
  }

  public setPureGregorian(pureGregorian: boolean): void {
    if (pureGregorian)
      this.setGregorianChange(DISTANT_YEAR_PAST, 0, 0);
    else
      this.setGregorianChange(1582, 10, 15);
  }

  public isPureGregorian(): boolean {
    return (this.gcYear <= DISTANT_YEAR_PAST);
  }

  public setPureJulian(pureJulian: boolean): void {
    if (pureJulian)
      this.setGregorianChange(DISTANT_YEAR_FUTURE, 0, 0);
    else
      this.setGregorianChange(1582, 10, 15);
  }

  public isPureJulian(): boolean {
    return (this.gcYear >= DISTANT_YEAR_FUTURE);
  }

  public setGregorianChange(gcYearOrDate: YearOrDate | string, gcMonth?: number, gcDate?: number): void {
    if ('g' === gcYearOrDate || 'G' === gcYearOrDate) {
      this.setPureGregorian(true);

      return;
    }
    else if ('j' === gcYearOrDate || 'J' === gcYearOrDate) {
      this.setPureJulian(true);

      return;
    }
    else if (_.isString(gcYearOrDate))
      gcYearOrDate = parseISODate(<string> gcYearOrDate);

    let gcYear; [gcYear, gcMonth, gcDate] = handleVariableDateArgs(<YearOrDate> gcYearOrDate, gcMonth, gcDate);

    if (gcYear < GREGORIAN_CHANGE_MIN_YEAR) {
      if ((gcMonth !== 0 || gcDate !== 0) && gcYear > DISTANT_YEAR_PAST)
        throw('KsCalendar: Gregorian change year cannot be less than ' + GREGORIAN_CHANGE_MIN_YEAR);

      this.firstGregorianDay = Number.MIN_SAFE_INTEGER;
      this.gcYear = DISTANT_YEAR_PAST;
    }
    else if (gcYear > GREGORIAN_CHANGE_MAX_YEAR) {
      if ((gcMonth !== 0 || gcDate !== 0) && gcYear < DISTANT_YEAR_FUTURE)
        throw('KsCalendar: Gregorian change year cannot be greater than ' + GREGORIAN_CHANGE_MAX_YEAR);

      this.firstGregorianDay = Number.MAX_SAFE_INTEGER;
      this.gcYear = DISTANT_YEAR_FUTURE;
    }
    else if (!isValidDateGregorian(gcYear, gcMonth, gcDate))
      throw('KsCalendar: Invalid Gregorian date: ' + getISOFormatDate(gcYear, gcMonth, gcDate));

    this.gcYear  = gcYear;
    this.gcMonth = gcMonth;
    this.gcDate  = gcDate;
    this.firstGregorianDay = getDayNumberGregorian(gcYear, gcMonth, gcDate);

    const lastJDay: YMDDate = getDateFromDayNumberJulian(this.firstGregorianDay - 1);

    this.lastJulianDate = lastJDay.d;
    this.lengthOfGCChangeMonth = getLastDateInMonthGregorian(gcYear, gcMonth);

    if (lastJDay.y === gcYear && lastJDay.m === gcMonth) {
      this.lastJulianYear = Number.MIN_SAFE_INTEGER; // Number.MIN_SAFE_INTEGER used to indicate mixed Julian/Gregorian transition month
      this.lastJulianMonth = Number.MIN_SAFE_INTEGER;
      this.firstDateInGCChangeMonth = 1;
      this.lengthOfGCChangeMonth -= gcDate - this.lastJulianDate - 1;
    }
    else {
      this.lastJulianYear = lastJDay.y;
      this.lastJulianMonth = lastJDay.m;
      this.firstDateInGCChangeMonth = gcDate;
      this.lengthOfGCChangeMonth -= gcDate - 1;
    }
  }

  public getGregorianChange(): YMDDate {
    return {y: this.gcYear, m: this.gcMonth, d: this.gcDate, n: this.firstGregorianDay, j: false};
  }

  public isJulianCalendarDate(yearOrDate: YearOrDate, month?: number, day?: number): boolean {
    let year: number; [year, month, day] = handleVariableDateArgs(yearOrDate, month, day);

    return (year < this.gcYear || (year === this.gcYear && (month < this.gcMonth || month === this.gcMonth && day < this.gcDate)));
  }

  public getDayNumber(yearOrDate: YearOrDate, month?: number, day?: number): number {
    let year: number; [year, month, day] = handleVariableDateArgs(yearOrDate, month, day);

    while (month <  1) { month += 12; --year; }
    while (month > 12) { month -= 12; ++year; }

    if (year === this.lastJulianYear && month === this.lastJulianMonth) {
      if (day > this.lastJulianDate)
        day = this.lastJulianDate;
    }
    else if (year === this.gcYear && month === this.gcMonth && (day > this.lastJulianDate ||
             (this.lastJulianMonth !== this.gcMonth && this.lastJulianMonth > 0)) && day < this.gcDate) {
      day = this.gcDate;
    }

    if (this.isJulianCalendarDate(year, month, day))
      return getDayNumberJulian(year, month, day);
    else
      return getDayNumberGregorian(year, month, day);
  }

  public getDateFromDayNumber(dayNum: number): YMDDate {
    if (dayNum >= this.firstGregorianDay)
      return getDateFromDayNumberGregorian(dayNum);
    else
      return getDateFromDayNumberJulian(dayNum);
  }

  public getFirstDateInMonth(year: number, month: number): number {
    if (year === this.gcYear && month === this.gcMonth)
      return this.firstDateInGCChangeMonth;
    else
      return 1;
  }

  public getLastDateInMonth(year: number, month: number): number {
    if (month === 0) {
      month = 12;
      --year;
    }
    else if (month === 13) {
      month = 1;
      ++year;
    }

    if (year === this.lastJulianYear && month === this.lastJulianMonth)
      return this.lastJulianDate;
    else if (month === 9 || month === 4 || month === 6 || month === 11)
      return 30;
    else if (month !== 2)
      return 31;
    else if (year % 4 === 0 && (year < this.gcYear || (year === this.gcYear && this.gcMonth > 2) || year % 100 !== 0 || year % 400 === 0))
      return 29;
    else
      return 28;
  }

  public getDaysInMonth(year: number, month: number): number {
    if (month === 0) {
      month = 12;
      --year;
    }
    else if (month === 13) {
      month = 1;
      ++year;
    }

    if (year === this.gcYear && month === this.gcMonth)
      return this.lengthOfGCChangeMonth;
    else if (year === this.lastJulianYear && month === this.lastJulianMonth)
      return this.lastJulianDate;
    else if (month === 9 || month === 4 || month === 6 || month === 11)
      return 30;
    else if (month !== 2)
      return 31;
    else
      return this.getDayNumber(year, 3, 1) - this.getDayNumber(year, 2, 1);
  }

  public getDaysInYear(year: number): number {
    return this.getDayNumber(year + 1, 1, 1) - this.getDayNumber(year, 1, 1);
  }

  public getDayOfWeek(yearOrDateOrDayNum: YearOrDate, month?: number, day?: number): number {
    if (_.isNumber(yearOrDateOrDayNum) && _.isUndefined(month))
      return getDayOfWeek(<number> yearOrDateOrDayNum);
    else
      return getDayOfWeek(this.getDayNumber(yearOrDateOrDayNum, month, day));
  }

  /**
   * @description Get the date of the index-th day of the week of a given month, e.g. the date of the
   * first Wednesday or the third Monday or the last Friday of the month.
   *
   * @param {number} year - Year.
   * @param {number} month - Month.
   * @param {number} dayOfTheWeek - The day of the week (e.g. 0 for Sunday, 2 for Tuesday, 6 for Saturday) for
   *                                which you wish to find the date.
   * @param {number} index - A value of 1-5, or LAST (6), for the occurrence of the specified day of the week.
   *
   * @return {number} 0 if the described day does not exist (e.g. there is no fifth Monday in the given month) or
   *                  the date of the specified day.
   */
  public getDateOfNthWeekdayOfMonth(year: number, month: number, dayOfTheWeek: number, index: number): number {
    const last: boolean = (index >= LAST);
    const day = 1;
    let dayNum: number = this.getDayNumber(year, month, day);
    const dayOfWeek = getDayOfWeek(dayNum);
    let ymd: YMDDate;
    let lastDay = 0;

    if (dayOfWeek === dayOfTheWeek && index === 1)
      return day;

    dayNum += M_.mod(dayOfTheWeek - dayOfWeek, 7);
    ymd = this.getDateFromDayNumber(dayNum);

    while (ymd.m === month) {
      lastDay = ymd.d;

      if (--index === 0)
        return lastDay;

      dayNum += 7;
      ymd = this.getDateFromDayNumber(dayNum);
    }

    if (last)
      return lastDay;
    else
      return 0;
  }

  public getDayOfWeekInMonthCount(year: number, month: number, dayOfTheWeek: number): number {
    const firstDay = this.getDayNumber(year, month, this.getDateOfNthWeekdayOfMonth(year, month, dayOfTheWeek, 1));
    const nextMonth = this.getDayNumber(year, month + 1, 1);

    return M_.div_tt0(nextMonth - firstDay - 1, 7) + 1;
  }

  public getDayOnOrAfter(year: number, month: number, dayOfTheWeek: number, minDate: number): number {
    const dayNum = this.getDayNumber(year, month, minDate);
    const dayOfWeek = getDayOfWeek(dayNum);
    const delta = M_.mod(dayOfTheWeek - dayOfWeek, 7);

    if (year === this.gcYear && month === this.gcDate) {
      const ymd = this.getDateFromDayNumber(dayNum + delta);

      if (ymd.y !== year || ymd.m !== month)
        minDate = 0;
      else
        minDate = ymd.d;
    }
    else {
      minDate += delta;

      if (minDate > this.getLastDateInMonth(year, month))
        minDate = 0;
    }

    return minDate;
  }

  public getDayOnOrBefore(year: number, month: number, dayOfTheWeek: number, maxDate: number): number {
    const dayNum = this.getDayNumber(year, month, maxDate);
    const dayOfWeek = getDayOfWeek(dayNum);
    const delta = M_.mod(dayOfWeek - dayOfTheWeek, 7);

    if (year === this.gcYear && month === this.gcDate) {
      const ymd = this.getDateFromDayNumber(dayNum - delta);

      if (ymd.y !== year || ymd.m !== month)
        maxDate = 0;
      else
        maxDate = ymd.d;
    }
    else {
      maxDate -= delta;

      if (maxDate < 0)
        maxDate = 0;
    }

    return maxDate;
  }

  public addDaysToDate(deltaDays: number, yearOrDate: YearOrDate, month?: number, day?: number): YMDDate {
    return this.getDateFromDayNumber(this.getDayNumber(yearOrDate, month, day) + deltaDays);
  }

  public getCalendarMonth(year: number, month: number, startingDayOfWeek: number): YMDDate[] {
    const dates: YMDDate[] = [];
    let dateOffset;
    let dayNum = this.getDayNumber(year, month, this.getFirstDateInMonth(year, month));
    let ymd: YMDDate;
    let currMonth;

    // Step back (if necessary) to the nearest prior day matching the requested starting day of the week.
    dateOffset = M_.mod(startingDayOfWeek - getDayOfWeek(dayNum), -7); // First time I recall ever wanting to use a negative modulus.
    dayNum += dateOffset; // dateOffset will be 0 or negative

    ymd = this.getDateFromDayNumber(dayNum);

    // This loop will fill in a calendar month's full set of dates in such a way as to obtain dates which
    // should be shown from previous and subsequent months, while also skipping over Julian-to-Gregorian
    // calendar switch-over dates.
    do {
      dates.push(ymd);
      ++dayNum;
      ++dateOffset;
      ymd = this.getDateFromDayNumber(dayNum);
      currMonth = ymd.m;
      // We've reached the end of the calendar when we're at a positive date offset, in a different month
      // than the requested month, and the day of week is back to the first day of the week of the calendar.
      // The first date to meet these criteria is just past the end of the calendar, and is not added to it.
    } while (dateOffset < 1 || currMonth === month || getDayOfWeek(dayNum) !== startingDayOfWeek);

    return dates;
  }

  public isValidDate(yearOrDate: YearOrDate, month?: number, day?: number): boolean {
    let year: number; [year, month, day] = handleVariableDateArgs(yearOrDate, month, day);
    const ymd = this.getDateFromDayNumber(this.getDayNumber(year, month, day));

    return (year === ymd.y && month === ymd.m && day === ymd.d);
  }

  public normalizeDate(yearOrDate: YearOrDate, month?: number, day?: number): YMDDate {
    let year: number; [year, month, day] = handleVariableDateArgs(yearOrDate, month, day);

    if (month < 1) {
      month += 12;
      year -= 1;
    }
    else if (month > 12) {
      month -= 12;
      year += 1;
    }

    if (!this.isValidDate(year, month, day)) {
      let d;

      if (day < (d = this.getFirstDateInMonth(year, month)))
        day = d;
      else if (day > (d = this.getLastDateInMonth(year, month)))
        day = d;
      else {
        const range = this.getMissingDateRange(year, month);

        if (range != null)
          day = range[1] + 1;
        else
          day = d;
      }
    }

    return {y: year, m: month, d: day};
  }

  public getMissingDateRange(year: number, month: number): number[] | null {
    if (year === this.lastJulianYear && month === this.lastJulianMonth) {
      const lastDate = getLastDateInMonthJulian(year, month);

      if (lastDate > this.lastJulianDate)
        return [this.lastJulianDate + 1, lastDate];
    }
    else if (year === this.gcYear && month === this.gcMonth && this.gcDate > 1 && this.gcDate > this.lastJulianDate + 1)
      return [this.lastJulianDate + 1, this.gcDate - 1];

    return null;
  }
}
