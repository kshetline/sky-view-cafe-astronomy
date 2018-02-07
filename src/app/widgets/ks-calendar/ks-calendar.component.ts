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

import { Component, EventEmitter, forwardRef, Input, OnDestroy, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import * as _ from 'lodash';

import { KsDateTime } from '../../util/ks-date-time';
import { KsTimeZone } from '../../util/ks-timezone';
import { CalendarType, GregorianChange, YMDDate } from '../../util/ks-calendar';

const CLICK_REPEAT_DELAY = 500;
const CLICK_REPEAT_RATE  = 100;

export const KS_CALENDAR_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => KsCalendarComponent),
  multi: true
};

const noop = () => {};

interface DateInfo extends YMDDate {
  text: string;
  dayLength: number;
  highlight?: boolean;
  shortDay?: boolean;
  longDay?: boolean;
  otherMonth?: boolean;
  voidDay?: boolean;
}

@Component({
  selector: 'ks-calendar',
  templateUrl: './ks-calendar.component.html',
  styleUrls: ['./ks-calendar.component.scss'],
  providers: [KS_CALENDAR_VALUE_ACCESSOR]
})
export class KsCalendarComponent implements ControlValueAccessor, OnDestroy {
  private ymd: YMDDate = {y: 2017, m: 1, d: 1};
  private _gregorianChange: GregorianChange;
  private _showDst = false;
  private _minYear = 1;
  private _maxYear = 9999;
  private _firstDay = 0;
  private dateTime: KsDateTime = new KsDateTime();
  private onTouchedCallback: () => void = noop;
  private onChangeCallback: (_: any) => void = noop;
  private timerSubscription: Subscription;

  title: string;
  daysOfWeek: string[] = [];
  calendar: DateInfo[][] = [];

  @Output() dayClick = new EventEmitter();

  constructor(private datePipe: DatePipe) {
    this.updateDayHeadings();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  get value(): YMDDate { return this.ymd; }
  set value(newYMD: YMDDate) {
    if (!_.isEqual(this.ymd, newYMD)) {
      this.ymd = newYMD;
      this.updateCalendar();
      this.onChangeCallback(newYMD);
    }
  }

  writeValue(newYMD: YMDDate): void {
    if (!_.isEqual(this.ymd, newYMD)) {
      this.ymd = newYMD;
      this.updateCalendar();
    }
  }

  registerOnChange(fn: any): void {
    this.onChangeCallback = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouchedCallback = fn;
  }

  get timeZone(): KsTimeZone { return this.dateTime.timeZone; }
  @Input() set timeZone(newZone: KsTimeZone) {
    if (this.dateTime.timeZone !== newZone) {
      this.dateTime.timeZone = newZone;
      this.updateCalendar();
    }
  }

  get gregorianChangeDate(): GregorianChange { return this._gregorianChange; }
  @Input() set gregorianChangeDate(newChange: GregorianChange) {
    if (!_.isEqual(this._gregorianChange, newChange)) {
      this._gregorianChange = newChange;

      if (_.isObject(newChange) || _.isString(newChange))
        this.dateTime.setGregorianChange(<YMDDate | string> newChange);
      else if (newChange === CalendarType.PURE_GREGORIAN)
        this.dateTime.setPureGregorian(true);
      else if (newChange === CalendarType.PURE_JULIAN)
        this.dateTime.setPureJulian(true);
      else
        this.dateTime.setGregorianChange(1582, 10, 15);

      this.updateCalendar();
    }
  }

  get showDst(): boolean { return this._showDst; }
  @Input() set showDst(show: boolean) {
    if (this._showDst !== show) {
      this._showDst = show;
      this.updateCalendar();
    }
  }

  get minYear(): number { return this._minYear; }
  @Input() set minYear(year: number) {
    if (this._minYear !== year) {
      this._minYear = year;
    }
  }

  get maxYear(): number { return this._maxYear; }
  @Input() set maxYear(year: number) {
    if (this._maxYear !== year) {
      this._maxYear = year;
    }
  }

  get firstDay(): number { return this._firstDay; }
  @Input() set firstDay(dayOfWeek: number) {
    if (this._firstDay !== dayOfWeek) {
      this._firstDay = dayOfWeek;
      this.updateDayHeadings();
      this.updateCalendar();
    }
  }

  updateDayHeadings(): void {
    // Produce calendar day-of-week header using arbitrary days which start on the given first day of the week.
    this.daysOfWeek = [];

    for (let d = 1; d <= 7; ++d)
      this.daysOfWeek.push(this.datePipe.transform(new Date(2017, 0, d + this._firstDay, 12, 0), 'E'));
  }

  updateCalendar(): void {
    const year  = this.ymd ? this.ymd.y : 2017;
    const month = this.ymd ? this.ymd.m : 1;
    const day   = this.ymd ? this.ymd.d : 1;
    const calendar = this.dateTime.getCalendarMonth(year, month, this._firstDay);

    this.calendar = [];
    calendar.forEach((date: DateInfo, index: number) => {
      const dayLength = this.dateTime.getMinutesInDay(date.y, date.m, Math.abs(date.d));
      const row = Math.floor(index / 7);
      const col = index % 7;

      date.dayLength = dayLength;
      date.text = String(date.d);
      date.otherMonth = (date.m !== month);
      date.highlight = (date.m === month && date.d === day);

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
      else if (this._showDst && dayLength < 1440) {
        date.shortDay = true;
      }
      else if (this._showDst && dayLength > 1440) {
        date.longDay = true;
      }

      if (col === 0)
        this.calendar[row] = [];

      this.calendar[row][col] = date;
    });

    this.title = this.datePipe.transform(new Date(4000, month - 1, 1, 12, 0), 'MMM ') + year;
  }

  stopTimer(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
      this.timerSubscription = undefined;
    }
  }

  onMouseDown(event: MouseEvent, delta: number): void {
    if (!this.timerSubscription) {
      this.timerSubscription = Observable.timer(CLICK_REPEAT_DELAY, CLICK_REPEAT_RATE).subscribe(() => {
        this.onClick(event, delta);
      });
    }
  }

  onMouseUp(): void {
    this.stopTimer();
  }

  onClick(event: MouseEvent, delta: number): void {
    const date: YMDDate = _.clone(this.ymd);

    if (event.altKey)
      date.y += delta * 10;
    else if (event.shiftKey)
      date.y += delta;
    else
      date.m += delta;

    if (date.y < this._minYear || date.y === this._minYear && date.m < 1) {
      date.y = this._minYear;
      date.m = 1;
      date.d = 1;
    }
    else if (date.y > this._maxYear || date.y === this._maxYear && date.m > 12) {
      date.y = this._maxYear;
      date.m = 12;
      date.d = 31;
    }

    this.value = this.dateTime.normalizeDate(date);
  }

  onDayClick(dateInfo: DateInfo): void {
    if (dateInfo.d > 0) {
      this.value = {y: dateInfo.y, m: dateInfo.m, d: dateInfo.d};
      this.dayClick.emit(dateInfo.d);
    }
  }
}
