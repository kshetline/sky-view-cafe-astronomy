import { Component, EventEmitter, forwardRef, Input, Output, ViewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { isArray, isObject, isString, isEqual, noop } from '@tubular/util';
import { SelectItem } from 'primeng/api';
import { Select } from 'primeng/select';

const DROPDOWN_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => KsDropdownComponent),
  multi: true
};

@Component({
  selector: 'ks-dropdown',
  templateUrl: './ks-dropdown.component.html',
  styleUrls: ['./ks-dropdown.component.scss'],
  providers: [DROPDOWN_VALUE_ACCESSOR],
  imports: [FormsModule, Select]
})
export class KsDropdownComponent implements ControlValueAccessor {
  private _options: any[] = [];
  private _value: any;
  private _primeValue: any;
  private _selectValue: string;
  private hasFocus = false;
  private onTouchedCallback: () => void = noop;
  private onChangeCallback: (_: any) => void = noop;
  private usingTouch = false;

  @ViewChild('pSelect', { static: true }) private pSelect: Select;

  disabled = false;
  primeOptions: SelectItem[] = [];
  selectOptions: string[] = [];
  useSelect = true;

  @Output() focus: EventEmitter<any> = new EventEmitter();
  @Output() blur: EventEmitter<any> = new EventEmitter();
  @Input() autoWidth = false; // TODO: Add my own support for autoWidth, now that PrimeNG doesn't support it?
  @Input() editable = false;
  @Input() scrollHeight = '220px';

  get value(): any { return this._value; }
  set value(newValue: any) {
    this.setValue(newValue);
  }

  private setValue(newValue: any) {
    if (newValue == null && this.options.length > 0)
      return;

    if (!isEqual(this._value, newValue)) {
      this._value = newValue;
      this._primeValue = this.findMatchingPrimeOption(newValue) ?? newValue;
      this._selectValue = this.findMatchingIndex(newValue);
      this.onChangeCallback(newValue);
    }
  }

  selectClick(evt: MouseEvent): void {
    if (!this.usingTouch) {
      this.useSelect = false;
      evt.preventDefault();
      evt.stopPropagation();
      this.pSelect.focus();
      setTimeout(() => this.pSelect.el.nativeElement.querySelector('div'));
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
    this.setValue(newValue);
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
    if (newValue == null && this.options.length > 0)
      return;

    if (!isEqual(this._primeValue, newValue)) {
      this._primeValue = newValue;
      this._value = this.findMatchingOption(newValue);
      this.onChangeCallback(this._primeValue);
    }
  }

  get selectValue(): string { return this._selectValue; }
  set selectValue(newSelectValue: string) {
    if (this._selectValue !== newSelectValue) {
      this._selectValue = newSelectValue;

      let newValue = this._options[parseInt(newSelectValue, 10)];

      if (isObject(newValue.value))
        newValue = newValue.value;

      this.setValue(newValue);
    }
  }

  get options(): any[] { return this._options; }
  @Input() set options(newOptions: any[]) {
    if (!isEqual(this._options, newOptions)) {
      if (!isArray(newOptions))
        newOptions = [];

      this._options = newOptions;
      this.primeOptions = newOptions.map((option: any): SelectItem => {
        let item: SelectItem;

        if (isString(option))
          item = { label: option, value: option };
        else
          item = option;

        return item;
      });
      this.selectOptions = newOptions.map((option: any): string => {
        let item: string;

        if (isString(option))
          item = option;
        else
          item = option.label;

        return item;
      });

      this._primeValue = this.findMatchingPrimeOption(this._value);
    }
  }

  applyFocus(): void {
    const input = this.pSelect?.el.nativeElement.querySelector('input');

    if (input)
      input.focus();
  }

  private findMatchingOption(testValue: any): any {
    return this._options.find(option => isObject(option as any) && option.value === testValue || option === testValue);
  }

  private findMatchingPrimeOption(testValue: any): any {
    let result = this.primeOptions.find(option => isEqual(option, testValue));

    if (result == null) {
      result = this.primeOptions.find(option => option.value === testValue);

      if (result != null)
        result = result.value;
    }

    return result;
  }

  private findMatchingIndex(testValue: any): string {
    const result = this._options.findIndex(option => isObject(option as any) && option.value === testValue || option === testValue) || 0;

    return result.toString();
  }
}
