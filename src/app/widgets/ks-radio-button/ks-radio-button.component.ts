import { Component, ElementRef, EventEmitter, forwardRef, Input, Output, ViewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { isEqual, noop } from '@tubular/util';

const RADIO_BUTTON_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => KsRadioButtonComponent),
  multi: true
};

@Component({
  selector: 'ks-radioButton',
  templateUrl: './ks-radio-button.component.html',
  styleUrls: ['./ks-radio-button.component.scss'],
  providers: [RADIO_BUTTON_VALUE_ACCESSOR],
  standalone: false
})
export class KsRadioButtonComponent implements ControlValueAccessor {
  private _ngValue: any;
  private hasFocus = false;
  private onTouchedCallback: () => void = noop;
  private onChangeCallback: (_: any) => void = noop;

  disabled = false;

  @ViewChild('radioButton', { static: true, read: ElementRef }) private radioButtonRef: ElementRef;

  @Output() focus: EventEmitter<any> = new EventEmitter();
  @Output() blur: EventEmitter<any> = new EventEmitter();
  @Input() label: string;
  @Input() value: any;

  get ngValue(): any { return this._ngValue; }
  set ngValue(newValue: any) {
    if (!isEqual(this._ngValue, newValue)) {
      this._ngValue = newValue;
      this.onChangeCallback(newValue);
    }
  }

  onFocus(event: any): void {
    this.hasFocus = true;
    this.focus.emit(event);
  }

  onBlur(event: any): void {
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
    if (!this.disabled && event.type === 'click') {
      const target = (this.radioButtonRef.nativeElement as HTMLElement).querySelector('input');

      target.click();
    }
  }
}
