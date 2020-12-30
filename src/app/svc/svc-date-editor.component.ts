/*
  Copyright © 2017-2019 Kerry Shetline, kerry@shetline.com

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

import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DateTimeField, Calendar, DateTime, Timezone, YMDDate } from '@tubular/time';
import * as M_ from '@tubular/math';
import { abs, max, min } from '@tubular/math';
import { clone, isMatch } from 'lodash-es';
import { timer } from 'rxjs';
import { SVC_MAX_YEAR, SVC_MIN_YEAR } from '../app.service';
import { BACKGROUND_ANIMATIONS, KsSequenceEditorComponent } from '../widgets/ks-sequence-editor/ks-sequence-editor.component';

export const SVC_DATE_EDITOR_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => SvcDateEditorComponent),
  multi: true
};

const noop = () => {};

const NO_BREAK_SPACE = '\u00A0';

@Component({
  selector: 'svc-date-editor',
  animations: [BACKGROUND_ANIMATIONS],
  templateUrl: '../widgets/ks-sequence-editor/ks-sequence-editor.component.html',
  styleUrls: ['../widgets/ks-sequence-editor/ks-sequence-editor.component.scss'],
  providers: [SVC_DATE_EDITOR_VALUE_ACCESSOR]
})
export class SvcDateEditorComponent extends KsSequenceEditorComponent implements ControlValueAccessor {
  private ymd: YMDDate = {y: 1970, m: 1, d: 1};
  private calendar = new Calendar();
  private onTouchedCallback: () => void = noop;
  private onChangeCallback: (_: any) => void = noop;
  private _minYear = SVC_MIN_YEAR;
  private _maxYear = SVC_MAX_YEAR;

  constructor() {
    super();
    this.signDigit = 0;
  }

  get value(): YMDDate { return clone(this.ymd); }
  set value(newDate: YMDDate) {
    if (newDate !== null && !isMatch(newDate, this.ymd)) {
      this.ymd.y = newDate.y;
      this.ymd.m = newDate.m;
      this.ymd.d = newDate.d;
      this.updateDigits();
      this.onChangeCallback(this.ymd);
    }
  }

  protected lostFocus(): void {
    this.onTouchedCallback();
  }

  writeValue(newDate: YMDDate): void {
    if (newDate !== null && !isMatch(newDate, this.ymd)) {
      this.ymd.y = newDate.y;
      this.ymd.m = newDate.m;
      this.ymd.d = newDate.d;
      this.updateDigits();
    }
  }

  registerOnChange(fn: any): void {
    this.onChangeCallback = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouchedCallback = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.displayState = (isDisabled ? 'disabled' : (this.viewOnly ? 'viewOnly' : 'normal'));
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

  get gregorianChange(): YMDDate { return this.calendar.getGregorianChange(); }
  @Input() set gregorianChange(changeDate: YMDDate) {
    if (!isMatch(this.calendar.getGregorianChange(), changeDate)) {
      this.calendar.setGregorianChange(<YMDDate> changeDate);
      this.updateDigits();
    }
  }

  get pureGregorian(): boolean { return this.calendar.isPureGregorian(); }
  @Input() set pureGregorian(value: boolean) {
    if (this.calendar.isPureGregorian() !== value) {
      this.calendar.setPureGregorian(value);
      this.updateDigits();
    }
  }

  get pureJulian(): boolean { return this.calendar.isPureJulian(); }
  @Input() set pureJulian(value: boolean) {
    if (this.calendar.isPureJulian() !== value) {
      this.calendar.setPureJulian(value);
      this.updateDigits();
    }
  }

  protected createDigits(): void {
    this.items.push({value: NO_BREAK_SPACE, editable: true, selected:  false, fixedWidth: true }); //  0 - Year sign
    this.items.push({value: 0,   editable: true,  selected: false }); //  1 - Year thousands
    this.items.push({value: 0,   editable: true,  selected: false }); //  2 - Year hundreds
    this.items.push({value: 0,   editable: true,  selected: false }); //  3 - Year tens
    this.items.push({value: 0,   editable: true,  selected: false }); //  4 - Year units
    this.items.push({value: '-', editable: false, selected: false });
    this.items.push({value: 0,   editable: true,  selected: false }); //  6 - Month tens
    this.items.push({value: 0,   editable: true,  selected: false }); //  7 - Month units
    this.items.push({value: '-', editable: false, selected: false });
    this.items.push({value: 0,   editable: true,  selected: false }); //  9 - Day tens
    this.items.push({value: 0,   editable: true,  selected: false }); // 10 - Day units
    this.items.push({value: NO_BREAK_SPACE, editable: false, selected: false, fixedWidth: true, indicator: true }); // 11 - blank
    this.selection = 10;

    this.updateDigits();
  }

  private updateDigits(): void {
    const i = this.items;

    if (i.length < 11)
      return;

    let ymd = this.ymd;
    let reUpdate = false;

    if (ymd.y < this.minYear) {
      ymd = {y: this.minYear, m: 1, d: 1};
      reUpdate = true;
    }
    else if (ymd.y > this.maxYear) {
      ymd = {y: this.maxYear, m: 12, d: 31};
      reUpdate = true;
    }

    if (reUpdate) {
      timer().subscribe(() => {
        this.errorFlash();
        this.onChangeCallback(this.ymd);
        this.updateDigits();
      });
      return;
    }

    const y = abs(ymd.y);

    if (ymd.y < 0)
      i[0].value = '-';
    else
      i[0].value = NO_BREAK_SPACE;

    // noinspection JSSuspiciousNameCombination
    const y4 = M_.div_tt0(y, 1000);
    const y3 = M_.div_tt0(y - y4 * 1000, 100);
    const y2 = M_.div_tt0(y - y4 * 1000 - y3 * 100, 10);
    const y1 = y % 10;

    [i[1].value, i[2].value, i[3].value, i[4].value] = [y4, y3, y2, y1];

    const M2 = M_.div_tt0(ymd.m, 10);
    const M1 = ymd.m % 10;

    [i[6].value, i[7].value] = [M2, M1];

    const d2 = M_.div_tt0(ymd.d, 10);
    const d1 = ymd.d % 10;

    [i[9].value, i[10].value] = [d2, d1];

    this.draw();
  }

  private getDateFromDigits(): YMDDate {
    const i = this.items;
    let year = <number> i[1].value * 1000 + <number> i[2].value * 100 + <number> i[3].value * 10 + <number> i[4].value;

    if (i[0].value === '-')
      year *= -1;

    const month  = <number> i[ 6].value * 10 + <number> i[ 7].value;
    const date   = <number> i[ 9].value * 10 + <number> i[10].value;

    return {y: year, m: month, d: date};
  }

  protected increment(): void {
    this.roll(1);
  }

  protected decrement(): void {
    this.roll(-1);
  }

  private roll(sign: number): void {
    let ymd = this.ymd;
    const rollingDate = new DateTime(0, Timezone.UT_ZONE, this.calendar.getGregorianChange());

    rollingDate.wallTime = {y: ymd.y, m: ymd.m, d: ymd.d, hrs: 12, min: 0, sec: 0};

    let change = 0;
    let field = DateTimeField.YEARS;
    const sel = this.selection;
    const wasNegative = (this.items[this.signDigit].value === '-');

    if (sel === this.signDigit) { // Sign of year
      if (-ymd.y < this.minYear || -ymd.y > this.maxYear) {
        this.errorFlash();
        return;
      }
      change = ymd.y * 2;
      sign = -1;
    }
    else if (sel === 10 || sel === 9) {
      field = DateTimeField.DAYS;
      change = (sel === 9 ? 10 : 1);
    }
    else if (sel === 7 || sel === 6) {
      field = DateTimeField.MONTHS;
      change = (sel === 6 ? 10 : 1);
    }
    else if (sel === 4 || sel === 3 || sel === 2 || sel === 1) {
      field = DateTimeField.YEARS;
      change = (sel === 1 ? 1000 : sel === 2 ? 100 : sel === 3 ? 10 : 1);
    }

    rollingDate.add(field, change * sign);
    ymd = rollingDate.wallTime;

    if (ymd.y < this.minYear || ymd.y > this.maxYear)
      this.errorFlash();
    else {
      this.ymd = ymd;
      this.onChangeCallback(this.ymd);
      this.updateDigits();

      if (sel === this.signDigit && ymd.y === 0)
        this.items[sel].value = (wasNegative ? NO_BREAK_SPACE : '-');
    }
  }

  protected digitTyped(charCode: number, key: string): void {
    const i = this.items;
    const origDate = <number> i[9].value * 10 + <number> i[10].value;
    const sel = this.selection;
    const origValue = i[sel].value;
    let newValue: number | string = origValue;

    if (sel === this.signDigit) {
      if (' +=-'.indexOf(key) < 0) {
        this.errorFlash();
        return;
      }
      else if (i[0].value === '-' && (key === ' ' || key === '+' || key === '='))
        newValue = NO_BREAK_SPACE;
      else if (i[0].value === NO_BREAK_SPACE && key === '-')
        newValue = '-';
    }
    else if (48 <= charCode && charCode < 58)
      newValue = charCode - 48;
    else {
      this.errorFlash();
      return;
    }

    if (newValue !== origValue) {
      i[sel].value = newValue;

      const ymd = this.getDateFromDigits();

      if (ymd.y < this.minYear || ymd.y > this.maxYear ||
          ymd.m > 19 || ymd.d > 39) {
        i[sel].value = origValue;
        this.errorFlash();
        return;
      }

      if (sel === 6)
        ymd.m = min(max(ymd.m, 1), 12);

      if (sel === 9)
        ymd.d = min(max(ymd.d, 1), 31);

      if (ymd.m === 0 || ymd.m > 12 || ymd.d === 0) {
        i[sel].value = origValue;
        this.errorFlash();
        return;
      }
      else if (!this.calendar.isValidDate(ymd)) {
        const lastDate = this.calendar.getLastDateInMonth(ymd.y, ymd.m);
        // Check for date gaps caused by Julian-to-Gregorian transition, e.g. October 1582
        // having no 5th-14h, with 10/04 followed immediately by 10/15.
        const gap = this.calendar.getMissingDateRange(ymd.y, ymd.m);

        if (gap && gap[0] <= ymd.d && ymd.d <= gap[1]) // Mind the gap! Step to either side of it.
          ymd.d = (origDate > ymd.d && gap[0] !== 1 ? gap[0] - 1 : min(gap[1] + 1, lastDate));

        if (ymd.d > lastDate) {
          if ((lastDate < 30 && ymd.d >= 30 && sel === 9) ||
              (ymd.d > lastDate && sel === 10)) {
            i[sel].value = origValue;
            this.errorFlash();
            return;
          }

          ymd.d = lastDate;
        }
      }

      this.ymd = ymd;
      this.onChangeCallback(this.ymd);
      this.updateDigits();

      if (sel === this.signDigit && ymd.y === 0)
        this.items[sel].value = newValue;
    }

    this.cursorRight();
  }
}
