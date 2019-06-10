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

import { Component, EventEmitter, forwardRef, Input, OnInit, Output, ViewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { find, isArray, isEqual, isObject, isString, isUndefined } from 'lodash';
import { SelectItem } from 'primeng/components/common/api';
import { Dropdown } from 'primeng/dropdown';

const DROPDOWN_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => KsDropdownComponent),
  multi: true
};

const noop = () => {};

@Component({
  selector: 'ks-dropdown',
  templateUrl: './ks-dropdown.component.html',
  styleUrls: ['./ks-dropdown.component.scss'],
  providers: [DROPDOWN_VALUE_ACCESSOR]
})
export class KsDropdownComponent implements ControlValueAccessor, OnInit {
  private _options: any[] = [];
  private _value: any;
  private _primeValue: any;
  private _selectValue: string;
  private hasFocus = false;
  private onTouchedCallback: () => void = noop;
  private onChangeCallback: (_: any) => void = noop;
  private usingTouch = false;

  @ViewChild('pDropdown', { static: true }) private pDropdown: Dropdown;

  primeOptions: SelectItem[] = [];
  selectOptions: string[] = [];
  disabled = false;
  useSelect = true;

  @Output() focus: EventEmitter<any> = new EventEmitter();
  @Output() blur: EventEmitter<any> = new EventEmitter();
  @Input() autoWidth = false; // TODO: Add my own support for autoWidth, now that PrimeNG doesn't support it?
  @Input() editable = false;
  @Input() scrollHeight = '200px';
  @Input() style = '';

  get value(): any { return this._value; }
  set value(newValue: any) {
    if (!isEqual(this._value, newValue)) {
      this._value = newValue;
      this._primeValue = this.findMatchingPrimeOption(newValue);
      this._selectValue = this.findMatchingIndex(newValue);
      this.onChangeCallback(newValue);
    }
  }

  ngOnInit(): void {
  }

  selectClick(event: MouseEvent): void {
    if (!this.usingTouch) {
      this.useSelect = false;
      event.preventDefault();
      event.stopPropagation();
      this.pDropdown.focus();
      setTimeout(() => this.pDropdown.containerViewChild.nativeElement.click());
    }
  }

  onTouchStart(): void {
    // TODO: Disable special touch interface mode for now
    // this.usingTouch = true;
  }

  onDropdownFocus(event: any): void {
    this.hasFocus = true;
    this.focus.emit(event);
  }

  onDropdownBlur(event: any): void {
    this.hasFocus = false;
    this.onTouchedCallback();
    this.blur.emit(event);
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
    if (!isEqual(this._primeValue, newValue)) {
      this._primeValue = newValue;
      this._value = this.findMatchingOption(newValue);
      this.onChangeCallback(newValue);
    }
  }

  get selectValue(): string { return this._selectValue; }
  set selectValue(newSelectValue: string) {
    if (this._selectValue !== newSelectValue) {
      this._selectValue = newSelectValue;

      let newValue = this._options[parseInt(newSelectValue, 10)];

      if (typeof newValue === 'object' && newValue.value !== undefined)
        newValue = newValue.value;

      this.value = newValue;
    }
  }

  get options(): any[] { return this._options; }
  @Input() set options(newOptions: any[]) {
    if (!isEqual(this._options, newOptions)) {
      if (!isArray(newOptions)) {
        newOptions = [];
      }

      this._options = newOptions;
      this.primeOptions = newOptions.map((option: any): SelectItem => {
        let item: SelectItem;

        if (isString(option)) {
          item = {label: option, value: option};
        }
        else {
          item = option;
        }

        return item;
      });
      this.selectOptions = newOptions.map((option: any): string => {
        let item: string;

        if (isString(option)) {
          item = option;
        }
        else {
          item = option.label;
        }

        return item;
      });

      this._primeValue = this.findMatchingPrimeOption(this._value);
    }
  }

  applyFocus(): void {
    this.pDropdown.applyFocus();
  }

  private findMatchingOption(testValue: any): any {
    return this._options.find(option => isObject(option as any) && option.value === testValue || option === testValue);
  }

  private findMatchingPrimeOption(testValue: any): any {
    let result = find(this.primeOptions, option => isEqual(option, testValue));

    if (isUndefined(result)) {
      result = find(this.primeOptions, option => option.value === testValue);

      if (!isUndefined(result))
        result = result.value;
    }

    return result;
  }

  private findMatchingIndex(testValue: any): string {
    const result = this._options.findIndex(option => isObject(option as any) && option.value === testValue || option === testValue) || 0;

    return result.toString();
  }
}
