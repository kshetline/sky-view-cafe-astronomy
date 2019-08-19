/*
  Copyright © 2019 Kerry Shetline, kerry@shetline.com.

  This code is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This code is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this code.  If not, see <http://www.gnu.org/licenses/>.

  For commercial, proprietary, or other uses not compatible with
  GPL-3.0-or-later, terms of licensing for this code may be
  negotiated by contacting the author, Kerry Shetline, otherwise all
  other uses are restricted.
*/

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { eventToKey, isIOS } from 'ks-util';
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

  onKey(event: KeyboardEvent): void {
    const key = eventToKey(event);

    if (key === 'Enter') {
      event.preventDefault();
      // this.setPreferences();
    }
  }

  setPreferences(): void {
    this.app.updateUserSetting({view: VIEW_APP, property: PROPERTY_WARNING_NATIVE_DATE_TIME, value: true, source: this});
    this.app.updateUserSetting({view: VIEW_APP, property: PROPERTY_NATIVE_DATE_TIME, value: this.nativeDateTime, source: this});
    this.visible = false;
  }
}
