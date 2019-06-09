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

import { Component, ElementRef, EventEmitter, forwardRef, Input, Output, ViewChild } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import * as _ from 'lodash';

const CHECKBOX_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => KsCheckboxComponent),
  multi: true
};

const noop = () => {};

@Component({
  selector: 'ks-checkbox',
  templateUrl: './ks-checkbox.component.html',
  styleUrls: ['./ks-checkbox.component.scss'],
  providers: [CHECKBOX_VALUE_ACCESSOR]
})
export class KsCheckboxComponent implements ControlValueAccessor {
  private _ngValue: any;
  private hasFocus = false;
  private onTouchedCallback: () => void = noop;
  private onChangeCallback: (_: any) => void = noop;

  public disabled = false;

  @ViewChild('checkbox', { static: true }) private checkboxRef: ElementRef;

  @Output() onFocus: EventEmitter<any> = new EventEmitter();
  @Output() onBlur: EventEmitter<any> = new EventEmitter();
  @Input() label: string;
  @Input() binary: boolean;
  @Input() value: any;

  get ngValue(): any { return this._ngValue; }
  set ngValue(newValue: any) {
    if (!_.isEqual(this._ngValue, newValue)) {
      this._ngValue = newValue;
      this.onChangeCallback(newValue);
    }
  }

  onDropdownFocus(event: any): void {
    this.hasFocus = true;
    this.onFocus.emit(event);
  }

  onDropdownBlur(event: any): void {
    this.hasFocus = false;
    this.onTouchedCallback();
    this.onBlur.emit(event);
  }

  writeValue(newValue: any): void {
    if (this._ngValue !== newValue) {
      this.ngValue = newValue;
    }
  }

  registerOnChange(fn: any): void {
    this.onChangeCallback = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouchedCallback = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onClick(event: MouseEvent): void {
    if (!this.disabled)
      (<any> this.checkboxRef).onClick(event);
  }
}
