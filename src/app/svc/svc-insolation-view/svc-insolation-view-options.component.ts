import { AfterViewInit, Component } from '@angular/core';
import { SelectItem } from 'primeng/api';
import { AppService, UserSetting } from '../../app.service';
import {
  PROPERTY_CENTER_MIDNIGHT, PROPERTY_SHOW_MOONLIGHT,  VIEW_INSOLATION
} from './svc-insolation-view.component';

@Component({
  selector: 'svc-insolation-view-options',
  templateUrl: './svc-insolation-view-options.component.html',
  styleUrls: ['./svc-insolation-view-options.component.scss']
})
export class SvcInsolationViewOptionsComponent implements AfterViewInit {
  private _centerMidnight = true;
  private _showMoonlight = false;

  centerOptions: SelectItem[] = [
    { label: 'Center on midnight', value: true },
    { label: 'Center on noon', value: false }
  ];

  constructor(private appService: AppService) {
    appService.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_INSOLATION && setting.source !== this) {
        if (setting.property === PROPERTY_CENTER_MIDNIGHT)
          this.centerMidnight = setting.value as boolean;
        else if (setting.property === PROPERTY_SHOW_MOONLIGHT)
          this.showMoonlight = setting.value as boolean;
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
      this.appService.updateUserSetting({ view: VIEW_INSOLATION, property: PROPERTY_CENTER_MIDNIGHT, value, source: this });
    }
  }

  get showMoonlight(): boolean { return this._showMoonlight; }
  set showMoonlight(value: boolean) {
    if (this._showMoonlight !== value) {
      this._showMoonlight = value;
      this.appService.updateUserSetting({ view: VIEW_INSOLATION, property: PROPERTY_SHOW_MOONLIGHT, value, source: this });
    }
  }
}
