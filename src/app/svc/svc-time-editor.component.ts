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

import { Component, forwardRef, Input } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { KsSequenceEditorComponent, BACKGROUND_ANIMATIONS, SequenceItemInfo } from '../widgets/ks-sequence-editor/ks-sequence-editor.component';
import { KsDateTime, DateTimeField } from '../util/ks-date-time';
import { abs, max, min } from '../util/ks-math';
import { KsTimeZone } from '../util/ks-timezone';
import { Observable } from 'rxjs';
import * as M_ from '../util/ks-math';
import { SVC_MAX_YEAR, SVC_MIN_YEAR } from '../app.service';
import { DateAndTime } from '../util/ks-date-time-zone-common';

export const SVC_TIME_EDITOR_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => SvcTimeEditorComponent),
  multi: true
};

const noop = () => {};

const NO_BREAK_SPACE = '\u00A0';
const THREE_PER_EM_SPACE = '\u2004';

@Component({
  selector: 'svc-time-editor',
  animations: [BACKGROUND_ANIMATIONS],
  templateUrl: '../widgets/ks-sequence-editor/ks-sequence-editor.component.html',
  styleUrls: ['../widgets/ks-sequence-editor/ks-sequence-editor.component.scss'],
  providers: [SVC_TIME_EDITOR_VALUE_ACCESSOR]
})
export class SvcTimeEditorComponent extends KsSequenceEditorComponent implements ControlValueAccessor {
  private dateTime = new KsDateTime();
  private _gregorianChangeDate = '1582-10-15';
  private onTouchedCallback: () => void = noop;
  private onChangeCallback: (_: any) => void = noop;
  private _minYear = SVC_MIN_YEAR;
  private _maxYear = SVC_MAX_YEAR;

  constructor() {
    super();
    this.signDigit = 0;
  }

  get value(): number { return this.dateTime.utcTimeMillis; }
  set value(newTime: number) {
    if (this.dateTime.utcTimeMillis !== newTime) {
      this.dateTime.utcTimeMillis = newTime;
      this.updateDigits();
      this.onChangeCallback(newTime);
    }
  }

  protected lostFocus(): void {
    this.onTouchedCallback();
  }

  writeValue(newValue: number): void {
    if (this.dateTime.utcTimeMillis !== newValue) {
      this.dateTime.utcTimeMillis = newValue;
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

  get timeZone(): KsTimeZone { return this.dateTime.timeZone; }
  @Input() set timeZone(newZone: KsTimeZone) {
    if (this.dateTime.timeZone !== newZone) {
      this.dateTime.timeZone = newZone;
      this.updateDigits();
    }
  }

  @Input() set gregorianChangeDate(value: string) {
    if (this._gregorianChangeDate !== value) {
      this._gregorianChangeDate = value;
      this.dateTime.setGregorianChange(value);
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
    this.items.push({value: ' ', editable: false, selected: false });
    this.items.push({value: 0,   editable: true,  selected: false }); // 12 - Hour tens
    this.items.push({value: 0,   editable: true,  selected: false }); // 13 - Hour units
    this.items.push({value: ':', editable: false, selected: false });
    this.items.push({value: 0,   editable: true,  selected: false }); // 15 - Minute tens
    this.items.push({value: 0,   editable: true,  selected: true  }); // 16 - Minute units
    this.items.push({value: '\u2082\u200A', editable: false, selected: false, hidden: true }); // 17 - 2nd occurrence indicator (Subscript 2, hair space)
    this.items.push({value: '+00:00', editable: false, selected: false, fixedWidth: true, indicator: true }); // 18 - UTC offset
    this.items.push({value: NO_BREAK_SPACE, editable: false, selected: false, fixedWidth: true, indicator: true }); // 19 - DST indicator
    this.items.push({value: THREE_PER_EM_SPACE, editable: false, selected: false});
    this.selection = 16;

    this.updateDigits();
  }

  private updateDigits(): void {
    const i = this.items;

    if (i.length < 17)
      return;

    let wallTime = this.dateTime.wallTime;
    let reUpdate = false;

    if (wallTime.y < this.minYear) {
      wallTime = {y: this.minYear, m: 1, d: 1, hrs: 0, min: 0, sec: 0};
      reUpdate = true;
    }
    else if (wallTime.y > this.maxYear) {
      wallTime = {y: this.maxYear, m: 12, d: 31, hrs: 23, min: 59, sec: 0};
      reUpdate = true;
    }

    if (reUpdate) {
      Observable.timer().subscribe(() => {
        this.errorFlash();
        this.dateTime.wallTime = wallTime;
        this.onChangeCallback(this.dateTime.utcTimeMillis);
        this.updateDigits();
      });
      return;
    }

    const y = abs(wallTime.y);

    if (wallTime.y < 0)
      i[0].value = '-';
    else
      i[0].value = NO_BREAK_SPACE;

    const y4 = M_.div_tt0(y, 1000);
    const y3 = M_.div_tt0(y - y4 * 1000, 100);
    const y2 = M_.div_tt0(y - y4 * 1000 - y3 * 100, 10);
    const y1 = y % 10;

    [i[1].value, i[2].value, i[3].value, i[4].value] = [y4, y3, y2, y1];

    const M2 = M_.div_tt0(wallTime.m, 10);
    const M1 = wallTime.m % 10;

    [i[6].value, i[7].value] = [M2, M1];

    const d2 = M_.div_tt0(wallTime.d, 10);
    const d1 = wallTime.d % 10;

    [i[9].value, i[10].value] = [d2, d1];

    const h2 = M_.div_tt0(wallTime.hrs, 10);
    const h1 = wallTime.hrs % 10;

    [i[12].value, i[13].value] = [h2, h1];

    const m2 = M_.div_tt0(wallTime.min, 10);
    const m1 = wallTime.min % 10;

    [i[15].value, i[16].value] = [m2, m1];
    i[17].hidden = (wallTime.occurrence !== 2);
    i[18].value = this.dateTime.timeZone.getFormattedOffset(this.dateTime.utcTimeMillis);

    if (!wallTime.dstOffset)
      i[19].value = NO_BREAK_SPACE;
    else {
      i[19].value = KsTimeZone.getDstSymbol(wallTime.dstOffset);
    }

    this.draw();
  }

  private getWallTimeFromDigits(): DateAndTime {
    const i = this.items;
    let year = <number> i[1].value * 1000 + <number> i[2].value * 100 + <number> i[3].value * 10 + <number> i[4].value;

    if (i[0].value === '-')
      year *= -1;

    const month  = <number> i[ 6].value * 10 + <number> i[ 7].value;
    const date   = <number> i[ 9].value * 10 + <number> i[10].value;
    const hour   = <number> i[12].value * 10 + <number> i[13].value;
    const minute = <number> i[15].value * 10 + <number> i[16].value;

    return {y: year, m: month, d: date, hrs: hour, min: minute, sec: 0, occurrence: this.dateTime.wallTime.occurrence};
  }

  protected increment(): void {
    this.roll(1);
  }

  protected decrement(): void {
    this.roll(-1);
  }

  private roll(sign: number): void {
    const originalTime = this.dateTime.utcTimeMillis;
    let change = 0;
    let field = DateTimeField.YEARS;
    let wallTime = this.dateTime.wallTime;
    const sel = this.selection;
    const wasNegative = (this.items[this.signDigit].value === '-');

    if (sel === this.signDigit) { // Sign of year
      if (-wallTime.y < this.minYear || -wallTime.y > this.maxYear) {
        this.errorFlash();
        return;
      }
      change = wallTime.y * 2;
      sign = -1;
    }
    else if (sel === 16 || sel === 15) {
      field = DateTimeField.MINUTES;
      change = (sel === 15 ? 10 : 1);
    }
    else if (sel === 13 || sel === 12) {
      field = DateTimeField.HOURS;
      change = (sel === 12 ? 10 : 1);
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

    this.dateTime.add(field, change * sign);
    wallTime = this.dateTime.wallTime;

    if (wallTime.y < this.minYear || wallTime.y > this.maxYear) {
      this.dateTime.utcTimeMillis = originalTime;
      this.errorFlash();
    }
    else {
      this.onChangeCallback(this.dateTime.utcTimeMillis);
      this.updateDigits();

      if (sel === this.signDigit && this.dateTime.wallTime.y === 0)
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

      const wallTime = this.getWallTimeFromDigits();

      if (wallTime.y < this.minYear || wallTime.y > this.maxYear ||
          wallTime.m > 19 || wallTime.d > 39 ||
          wallTime.hrs > 29 || wallTime.min > 59) {
        i[sel].value = origValue;
        this.errorFlash();
        return;
      }

      if (sel === 6)
        wallTime.m = min(max(wallTime.m, 1), 12);

      if (sel === 9)
        wallTime.d = min(max(wallTime.d, 1), 31);

      if (sel === 12)
        wallTime.hrs = min(wallTime.hrs, 23);

      if (wallTime.m === 0 || wallTime.m > 12 || wallTime.d === 0 || wallTime.hrs > 23) {
        i[sel].value = origValue;
        this.errorFlash();
        return;
      }
      else if (!this.dateTime.isValidDate(wallTime)) {
        const lastDate = this.dateTime.getLastDateInMonth(wallTime.y, wallTime.m);
        // Check for date gaps caused by Julian-to-Gregorian transition, e.g. October 1582
        // having no 5th-14h, with 10/04 followed immediately by 10/15.
        const gap = this.dateTime.getMissingDateRange(wallTime.y, wallTime.m);

        if (gap && gap[0] <= wallTime.d && wallTime.d <= gap[1]) // Mind the gap! Step to either side of it.
          wallTime.d = (origDate > wallTime.d && gap[0] !== 1 ? gap[0] - 1 : min(gap[1] + 1, lastDate));

        if (wallTime.d > lastDate) {
          if ((lastDate < 30 && wallTime.d >= 30 && sel === 9) ||
              (wallTime.d > lastDate && sel === 10)) {
            i[sel].value = origValue;
            this.errorFlash();
            return;
          }

          wallTime.d = lastDate;
        }
      }

      this.dateTime.wallTime = wallTime;
      this.onChangeCallback(this.dateTime.utcTimeMillis);
      this.updateDigits();

      if (sel === this.signDigit && this.dateTime.wallTime.y === 0)
        this.items[sel].value = newValue;
    }

    this.cursorRight();
  }

  protected getColorForItem(item?: SequenceItemInfo, index?: number): string {
    // Turn hour offset indicator red for bad time zone
    if (index === 18 && this.timeZone.error)
      return '#C00';
    else
      return super.getColorForItem(item, index);
  }
}
