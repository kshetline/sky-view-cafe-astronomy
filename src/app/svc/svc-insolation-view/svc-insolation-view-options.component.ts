/*
  Copyright © 2017 Kerry Shetline, kerry@shetline.com.

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

import { AfterViewInit, Component } from '@angular/core';
import { AppService, UserSetting } from '../../app.service';
import {
  PROPERTY_CENTER_MIDNIGHT, PROPERTY_SHOW_MOONLIGHT,  VIEW_INSOLATION
} from './svc-insolation-view.component';
import { SelectItem } from 'primeng/primeng';

@Component({
  selector: 'svc-insolation-view-options',
  templateUrl: './svc-insolation-view-options.component.html',
  styleUrls: ['./svc-insolation-view-options.component.scss']
})
export class SvcInsolationViewOptionsComponent implements AfterViewInit {
  private _centerMidnight = true;
  private _showMoonlight = false;

  centerOptions: SelectItem[] = [
    {label: 'Center on midnight', value: true},
    {label: 'Center on noon', value: false}
  ];

  constructor(private appService: AppService) {
    appService.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_INSOLATION && setting.source !== this) {
        if (setting.property === PROPERTY_CENTER_MIDNIGHT)
          this.centerMidnight = <boolean> setting.value;
        else if (setting.property === PROPERTY_SHOW_MOONLIGHT)
          this.showMoonlight = <boolean> setting.value;
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.appService.requestViewSettings(VIEW_INSOLATION));
  }

  get centerMidnight(): boolean { return this._centerMidnight; }
  set centerMidnight(value: boolean) {
    if (this._centerMidnight !== value) {
      this._centerMidnight = value;
      this.appService.updateUserSetting({view: VIEW_INSOLATION, property: PROPERTY_CENTER_MIDNIGHT, value: value, source: this});
    }
  }

  get showMoonlight(): boolean { return this._showMoonlight; }
  set showMoonlight(value: boolean) {
    if (this._showMoonlight !== value) {
      this._showMoonlight = value;
      this.appService.updateUserSetting({view: VIEW_INSOLATION, property: PROPERTY_SHOW_MOONLIGHT, value: value, source: this});
    }
  }
}
