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
import { KsSequenceEditorComponent, BACKGROUND_ANIMATIONS } from '../widgets/ks-sequence-editor/ks-sequence-editor.component';
import { abs, div_rd, min, mod, mod2, round } from '../util/ks-math';
import * as _ from 'lodash';

export const SVC_ANGLE_EDITOR_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => SvcAngleEditorComponent),
  multi: true
};

export const DD_MM_NS  = 'DD_MM_NS';
export const DDD_MM_EW = 'DDD_MM_EW';
export const HH_MM     = 'HH_MM';
export const PN_DDD_D  = 'PN_DDD_D';

const noop = () => {};

const NO_BREAK_SPACE = '\u00A0';

@Component({
  selector: 'svc-angle-editor',
  animations: [BACKGROUND_ANIMATIONS],
  templateUrl: '../widgets/ks-sequence-editor/ks-sequence-editor.component.html',
  styleUrls: ['../widgets/ks-sequence-editor/ks-sequence-editor.component.scss'],
  providers: [SVC_ANGLE_EDITOR_VALUE_ACCESSOR]
})
export class SvcAngleEditorComponent extends KsSequenceEditorComponent implements ControlValueAccessor {
  private angle = 0;
  private onTouchedCallback: () => void = noop;
  private onChangeCallback: (_: any) => void = noop;
  private _format: string = DDD_MM_EW;
  private directions = 'EW';
  private minutesDigit = 6;
  private maxAngle = 360;
  private maxNormalMagnitude = 0;
  private tenthsDigit = -1;
  private unitsDigit = 3;
  private wrapAtMax = true;

  constructor() {
    super();
    this.signDigit = 8;
  }

  get value(): number {
    if (this.maxNormalMagnitude !== 0)
      return mod2(this.angle, this.maxNormalMagnitude);
    else
      return this.angle;
  }
  set value(newAngle: number) {
    if (this.angle !== newAngle) {
      this.angle = newAngle;
      this.updateDigits();
      this.onChangeCallback(newAngle);
    }
  }

  protected lostFocus(): void {
    this.onTouchedCallback();
  }

  writeValue(newValue: number): void {
    if (this.angle !== newValue) {
      this.angle = newValue;
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

  get format(): string { return this._format; }
  @Input() set format(newFormat: string) {
    if (this._format !== newFormat) {
      this._format = newFormat;
      this.createDigits();
    }
  }

  protected createDigits(): void {
    let firstDelim;
    let secondDelim;
    let selectionPending = true;

    this.items = [];

    this.items.push({value: NO_BREAK_SPACE, editable: false, selected: false }); // Padding.

    switch (this._format) {
      case DD_MM_NS:
        firstDelim = '\u00B0'; // Degree sign.
        secondDelim = '\'';

        this.directions = 'NS';
        this.signDigit = 7;
        this.minutesDigit = 5;
        this.tenthsDigit = -1;
        this.unitsDigit = 2;
        this.maxAngle = 90;
        this.maxNormalMagnitude = 0;
        this.wrapAtMax = false;
      break;

      case DDD_MM_EW:
        firstDelim = '\u00B0'; // Degree sign.
        secondDelim = '\'';

        this.directions = 'EW';
        this.signDigit = 8;
        this.minutesDigit = 6;
        this.tenthsDigit = -1;
        this.unitsDigit = 3;
        this.maxAngle = 360;
        this.maxNormalMagnitude = 180;
        this.wrapAtMax = true;

        this.items.push({value: 0, editable: true, selected: true }); // Hundreds of degrees.
        selectionPending = false;
      break;

      case HH_MM:
        firstDelim = 'h';
        secondDelim = 'm';

        this.directions = null;
        this.signDigit = -1;
        this.minutesDigit = 5;
        this.tenthsDigit = -1;
        this.unitsDigit = 2;
        this.maxAngle = 24;
        this.maxNormalMagnitude = 0;
        this.wrapAtMax = true;
      break;

      case PN_DDD_D:
        firstDelim = '.';
        secondDelim = '\u00B0'; // Degree sign.

        this.directions = '+-';
        this.signDigit = 1;
        this.minutesDigit = -1;
        this.tenthsDigit = 6;
        this.unitsDigit = 4;
        this.maxAngle = 360;
        this.maxNormalMagnitude = 180;
        this.wrapAtMax = true;

        this.items.push({value: '+', editable: true, selected: true, fixedWidth: true }); // sign
        this.items.push({value: 0, editable: true, selected: false }); // Hundreds of degrees.
        selectionPending = false;
      break;
    }

    this.items.push({value: 0, editable: true, selected: selectionPending }); // Tens of degrees/hours.
    this.items.push({value: 0, editable: true, selected: false }); // Units of degrees/hours.
    this.items.push({value: firstDelim, editable: false, selected: false }); // First delimiter.
    this.items.push({value: 0, editable: true, selected: false }); // Tens of minutes, or tenths of a degree.

    if (this._format !== PN_DDD_D)
      this.items.push({value: 0, editable: true, selected: false }); // Units of minutes.

    this.items.push({value: secondDelim, editable: false, selected: false }); // Second delimiter.

    if (this._format !== PN_DDD_D && this.directions !== null)
        this.items.push({value: this.directions.substr(0, 1), editable: true, selected: false, fixedWidth: true }); // Sign.

    this.items.push({value: ' ', editable: false, selected: false }); // Padding.

    this.selection = 1;
    this.updateDigits();
  }

  private updateDigits(): void {
    const i = this.items;
    let angle = (_.isNil(this.angle) ? 0 : this.angle);

    if (this.signDigit >= 0) {
      if (angle < 0) {
        i[this.signDigit].value = this.directions.substr(1, 1);
        angle *= -1;
      }
      else
        i[this.signDigit].value = this.directions.substr(0, 1);
    }

    let degrees;

    if (this.minutesDigit >= 0) {
      let minutes = round(angle * 60);

      degrees = div_rd(minutes, 60);
      minutes -= degrees * 60;
      i[this.minutesDigit].value = minutes % 10;
      i[this.minutesDigit - 1].value = div_rd(minutes, 10);
    }
    else if (this.tenthsDigit >= 0) {
      let tenths = round(angle * 10);

      degrees = div_rd(tenths, 10);
      tenths -= degrees * 10;
      i[this.tenthsDigit].value = tenths;
    }

    i[this.unitsDigit].value = degrees % 10;
    degrees = div_rd(degrees, 10);
    i[this.unitsDigit - 1].value = degrees % 10;

    if (this.maxAngle > 99)
      i[this.unitsDigit - 2].value = div_rd(degrees, 10);

    this.draw();
  }

  protected increment(): void {
    this.roll(1);
  }

  protected decrement(): void {
    this.roll(-1);
  }

  private roll(sign: number): void {
    const minutes = round(this.angle * 60);
    let change = 0;
    const sel = this.selection;
    const wasNegative = this.isNegative(<string> (this.signDigit >= 0 ? this.items[this.signDigit].value : null));

    if (sel === this.signDigit) {
      change = minutes * 2;
      sign = -1;
    }
    else if (sel === this.tenthsDigit)
      change = 6;
    else if (sel === this.minutesDigit)
      change = 1;
    else if (sel === this.minutesDigit - 1)
      change = 10;
    else if (sel === this.unitsDigit)
      change = 60;
    else if (sel === this.unitsDigit - 1)
      change = 600;
    else if (sel === this.unitsDigit - 2)
      change = 6000;

    let newAngle = (minutes + change * sign) / 60;

    if (newAngle < -this.maxAngle && !this.wrapAtMax) {
      this.errorFlash();
      newAngle = -this.maxAngle;
    }
    else if (newAngle > this.maxAngle && !this.wrapAtMax) {
      this.errorFlash();
      newAngle = this.maxAngle;
    }

    if (this.wrapAtMax) {
      if (this.maxNormalMagnitude !== 0 && this.maxNormalMagnitude < this.maxAngle)
        newAngle = mod2(newAngle, this.maxAngle);
      else
        newAngle = mod(newAngle, this.maxAngle);
    }

    this.value = newAngle;

    if (sel === this.signDigit && (this.angle === 0 || this.maxAngle === 360 && abs(this.angle) === 180))
      this.items[sel].value = this.directions.substr(wasNegative ? 0 : 1, 1);
  }

  protected digitTyped(charCode: number, key: string): void {
    const minutes = round(abs(this.angle) * 60);
    const i = this.items;
    const sel = this.selection;
    // Preserve sign so that negative 0 can be maintained as a state.
    let signCh: string = <string> (this.signDigit >= 0 ? i[this.signDigit].value : null);
    const wasNegative = this.isNegative(signCh);
    let max = this.maxAngle;
    const max0 = max;
    let maxMinutes = max * 60;

    if (max === 360) {
      max -= (wasNegative ? 1 : 0);
      maxMinutes = 21600 - (wasNegative ? 1 : 0);
    }
    else if (max === 24) {
      --max;
      --maxMinutes;
    }

    if (sel === this.signDigit) {
      key = key.toUpperCase();

      if (('+=-' + this.directions).indexOf(key) < 0) {
        this.errorFlash();
        return;
      }

      const isNegative = this.isNegative(key);
      signCh = this.directions.substr(isNegative ? 1 : 0, 1);

      if (wasNegative !== isNegative) {
        this.value = -this.angle;
        i[sel].value = signCh;
      }

      this.cursorRight();

      return;
    }
    else if (48 > charCode || charCode >= 58) {
      this.errorFlash();
      return;
    }

    let change = charCode - 48 - <number> i[sel].value;
    let error = false;
    const u0 = <number> i[this.unitsDigit].value;
    const u1 = <number> i[this.unitsDigit - 1].value * 10;
    const u2 = (max < 100 ? 0 : <number> i[this.unitsDigit - 2].value * 100);
    const uu = u0 + u1 + u2;

    if (sel === this.tenthsDigit) {
      error = (uu === max0 && key > '0');
      change *= 6;
    }
    else if (sel === this.minutesDigit)
      error = (uu === max0 && key > '0');
    else if (sel === this.minutesDigit - 1) {
      error = (key > '5' || uu === max0 && key > '0');
      change *= 10;
    }
    else if (sel === this.unitsDigit) {
      error = (max === 23 && u1 === 20 && key > '3' || max === 90 && u1 === 90 && key > '0' ||
               max === 360 && u2 === 300 && u1 === 60 && key > '0');
      change *= 60;
    }
    else if (sel === this.unitsDigit - 1) {
      error = (max === 23 && key > '2' || max === 360 && u2 === 300 && key > '6' || max === 359 && u2 === 300 && key > '5');
      change *= 600;
    }
    else if (sel === this.unitsDigit - 2) {
      error = (key > '3');
      change *= 6000;
    }

    if (error) {
      this.errorFlash();
      return;
    }

    this.value = min(minutes + change, maxMinutes) / 60 * (wasNegative ? -1 : 1);

    if (this.signDigit >= 0)
      i[this.signDigit].value = signCh; // Reinstate sign.

    this.checkForWarning();
    this.cursorRight();
  }

  isNegative(ch: string): boolean {
    return ch === '-' || (this.directions && ch === this.directions.substr(1, 1));
  }

  protected shouldWarn(): boolean {
    if (this.maxNormalMagnitude !== 0 && !this.disabled && !this.viewOnly)
      return (this.angle < -this.maxNormalMagnitude || this.angle >= this.maxNormalMagnitude);
    else
      return false;
  }

  protected endWarning(): void {
    if (this.maxNormalMagnitude !== 0)
      this.value = mod2(this.angle, this.maxAngle);

    super.endWarning();
  }
}
