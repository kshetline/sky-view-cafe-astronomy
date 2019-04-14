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

import { Component, EventEmitter, forwardRef, Input, Output, ViewChild } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { SelectItem } from 'primeng/components/common/api';
import * as _ from 'lodash';
import { Dropdown } from 'primeng/dropdown';

const DROPDOWN_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => KsDropdownComponent),
  multi: true
};

const noop = () => {};

@Component({
  selector: 'ks-dropdown',
  template: `
    <p-dropdown #pDropdown [options]="primeOptions" [(ngModel)]="primeValue" appendTo="body"
      [disabled]="(options.length === 0 && !editable) || disabled"
      (onFocus)="onDropdownFocus($event)" (onBlur)="onDropdownBlur($event)" [scrollHeight]="scrollHeight"
      [editable]="editable" [autoWidth]="autoWidth" [style]="style"></p-dropdown>`,
  providers: [DROPDOWN_VALUE_ACCESSOR]
})
export class KsDropdownComponent implements ControlValueAccessor {
  private _options: any[] = [];
  private _value: any;
  private _primeValue: any;
  private hasFocus = false;
  private onTouchedCallback: () => void = noop;
  private onChangeCallback: (_: any) => void = noop;

  @ViewChild('pDropdown') private pDropdown: Dropdown;

  public primeOptions: SelectItem[] = [];
  public disabled = false;

  @Output() onFocus: EventEmitter<any> = new EventEmitter();
  @Output() onBlur: EventEmitter<any> = new EventEmitter();
  @Input() autoWidth = true;
  @Input() editable = false;
  @Input() scrollHeight = '200px';
  @Input() style = '';

  get value(): any { return this._value; }
  set value(newValue: any) {
    if (!_.isEqual(this._value, newValue)) {
      this._value = newValue;
      this._primeValue = this.findMatchingPrimeOption(newValue);
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
    if (this._value !== newValue) {
      this.value = newValue;
      this._primeValue = this.findMatchingPrimeOption(newValue);
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

  get primeValue(): any { return this._primeValue; }
  set primeValue(newValue: any) {
    if (!_.isEqual(this._primeValue, newValue)) {
      this._primeValue = newValue;
      this._value = this.findMatchingOption(newValue);
      this.onChangeCallback(newValue);
    }
  }

  get options(): any[] { return this._options; }
  @Input() set options(newOptions: any[]) {
    if (!_.isEqual(this._options, newOptions)) {
      if (!_.isArray(newOptions)) {
        newOptions = [];
      }

      this._options = newOptions;
      this.primeOptions = newOptions.map((option: any): SelectItem => {
        let item: SelectItem;

        if (_.isString(option)) {
          item = {label: option, value: option};
        }
        else {
          item = option;
        }

        return item;
      });

      this._primeValue = this.findMatchingPrimeOption(this._value);
    }
  }

  public applyFocus(): void {
    this.pDropdown.applyFocus();
  }

  private findMatchingOption(testValue: any): any {
    return this._options.find(option => { return _.isObject(option as any) && option.value === testValue || option === testValue; });
  }

  private findMatchingPrimeOption(testValue: any): any {
    let result = _.find(this.primeOptions, option => { return _.isEqual(option, testValue); });

    if (_.isUndefined(result)) {
      result = _.find(this.primeOptions, option => { return option.value === testValue; });

      if (!_.isUndefined(result))
        result = result.value;
    }

    return result;
  }
}
