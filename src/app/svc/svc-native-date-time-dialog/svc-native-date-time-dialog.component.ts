import { Component, EventEmitter, Input, Output } from '@angular/core';
import { eventToKey, isIOS } from '@tubular/util';
import { AppService, PROPERTY_NATIVE_DATE_TIME, PROPERTY_WARNING_NATIVE_DATE_TIME, VIEW_APP } from '../../app.service';

@Component({
  selector: 'svc-native-date-time-dialog',
  templateUrl: './svc-native-date-time-dialog.component.html',
  styleUrls: ['./svc-native-date-time-dialog.component.scss']
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
    this.app.updateUserSetting({ view: VIEW_APP, property: PROPERTY_WARNING_NATIVE_DATE_TIME, value: true, source: this });
    this.app.updateUserSetting({ view: VIEW_APP, property: PROPERTY_NATIVE_DATE_TIME, value: this.nativeDateTime, source: this });
    this.visible = false;
  }
}
