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
    { label: 'Civil Twilight (-6°)', value: -6.0 },
    { label: 'Nautical Twilight (-12°)', value: -12.0 },
    { label: 'Astronomical Twilight (-18°)', value: -18.0 }
  ];

  twilightDisabled = false;

  constructor(private appService: AppService) {
    appService.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_TABLES && setting.source !== this) {
        if (setting.property === PROPERTY_PLANET_CHOICE)
          this.planetChoice = setting.value as number;
        else if (setting.property === PROPERTY_TABLE_TYPE)
          this.tableType = setting.value as TableType;
        else if (setting.property === PROPERTY_TWILIGHT)
          this.twilight = setting.value as number;

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
      this.appService.updateUserSetting(VIEW_TABLES, PROPERTY_TWILIGHT, value, this);
    }
  }
}
