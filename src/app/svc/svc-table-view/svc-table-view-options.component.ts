/*
  Copyright © 2017-2018 Kerry Shetline, kerry@shetline.com.

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
import { SUN } from '@tubular/astronomy';
import { SelectItem } from 'primeng/api';
import { AppService, UserSetting } from '../../app.service';
import {
  PROPERTY_PLANET_CHOICE, PROPERTY_TABLE_TYPE, PROPERTY_TWILIGHT, TableType, VIEW_TABLES
} from './svc-table-view.component';

@Component({
  selector: 'svc-table-view-options',
  templateUrl: './svc-table-view-options.component.html',
  styleUrls: ['./svc-table-view-options.component.scss']
})
export class SvcTableViewOptionsComponent implements AfterViewInit {
  private planetChoice = SUN;
  private tableType = TableType.RISE_SET_TIMES;
  private _twilight = -6.0;

  twilightOptions: SelectItem[] = [
    {label: 'Civil Twilight (-6°)', value: -6.0},
    {label: 'Nautical Twilight (-12°)', value: -12.0},
    {label: 'Astronomical Twilight (-18°)', value: -18.0}
  ];

  twilightDisabled = false;

  constructor(private appService: AppService) {
    appService.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_TABLES && setting.source !== this) {
        if (setting.property === PROPERTY_PLANET_CHOICE)
          this.planetChoice = <number> setting.value;
        else if (setting.property === PROPERTY_TABLE_TYPE)
          this.tableType = <TableType> setting.value;
        else if (setting.property === PROPERTY_TWILIGHT)
          this.twilight = <number> setting.value;

        this.twilightDisabled = (this.tableType !== TableType.RISE_SET_TIMES || this.planetChoice !== SUN);
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.appService.requestViewSettings(VIEW_TABLES));
  }

  get twilight(): number { return this._twilight; }
  set twilight(value: number) {
    if (this._twilight !== value) {
      this._twilight = value;
      this.appService.updateUserSetting({view: VIEW_TABLES, property: PROPERTY_TWILIGHT, value: value, source: this});
    }
  }
}
