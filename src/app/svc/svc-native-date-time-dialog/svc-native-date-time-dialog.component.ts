import { Component, EventEmitter, Input, Output } from '@angular/core';
import { eventToKey, isIOS } from '@tubular/util';
import { AppService, PROPERTY_NATIVE_DATE_TIME, PROPERTY_WARNING_NATIVE_DATE_TIME, VIEW_APP } from '../../app.service';
import { Dialog } from 'primeng/dialog';
import { KsSizerDirective } from '../../directives/ks-sizer.directive';
import { KsRadioButtonComponent } from '../../widgets/ks-radio-button/ks-radio-button.component';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { PrimeTemplate } from 'primeng/api';
import { Button } from 'primeng/button';

@Component({
  selector: 'svc-native-date-time-dialog',
  templateUrl: './svc-native-date-time-dialog.component.html',
  styleUrls: ['./svc-native-date-time-dialog.component.scss'],
  imports: [Button, Dialog, FormsModule, KsRadioButtonComponent, KsSizerDirective, NgIf, PrimeTemplate]
})
export class SvcNativeDateTimeDialogComponent {
  private _visible = false;

  @Input() get visible(): boolean { return this._visible; }
  set visible(isVisible: boolean) {
    if (this._visible !== isVisible) {
      this._visible = isVisible;
      this.visibleChange.emit(isVisible);
    }
  }

  @Output() visibleChange: EventEmitter<any> = new EventEmitter();

  nativeDateTime = this.app.nativeDateTime;
  // noinspection JSMethodCanBeStatic
  get isIOS(): boolean { return isIOS(); }

  constructor(private app: AppService) { }

  onKey(evt: KeyboardEvent): void {
    const key = eventToKey(evt);

    if (key === 'Enter') {
      evt.preventDefault();
      // this.setPreferences(); // TODO: Why was this commented out?
    }
  }

  setPreferences(): void {
    this.app.updateUserSetting(VIEW_APP, PROPERTY_WARNING_NATIVE_DATE_TIME, true, this);
    this.app.updateUserSetting(VIEW_APP, PROPERTY_NATIVE_DATE_TIME, this.nativeDateTime, this);
    this.visible = false;
  }
}
