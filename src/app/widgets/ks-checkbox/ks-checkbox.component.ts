import { Component, ElementRef, EventEmitter, forwardRef, Input, Output, ViewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { isEqual } from 'lodash-es';

const CHECKBOX_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => KsCheckboxComponent),
  multi: true
};

const noop = (): void => {};

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

  disabled = false;

  @ViewChild('checkbox', { static: true }) private checkboxRef: ElementRef;

  @Output() focus: EventEmitter<any> = new EventEmitter();
  @Output() blur: EventEmitter<any> = new EventEmitter();
  @Input() label: string;
  @Input() binary: boolean;
  @Input() value: any;

  get ngValue(): any { return this._ngValue; }
  set ngValue(newValue: any) {
    if (!isEqual(this._ngValue, newValue)) {
      this._ngValue = newValue;
      this.onChangeCallback(newValue);
    }
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
