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

import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { SelectItem } from 'primeng/components/common/api';
import { AppService, SVC_MAX_YEAR, SVC_MIN_YEAR, UserSetting } from '../../app.service';
import { VIEW_CALENDAR, PROPERTY_KEY_MOON_PHASES, PROPERTY_EQUISOLSTICE, PROPERTY_DAILY_DAYLIGHT, PROPERTY_DAILY_MOON_PHASE,
         PROPERTY_EVENT_TYPE, PROPERTY_INCLUDE_TRANSITS
} from './svc-calendar-view.component';
import { DateTimeField, KsDateTime, KsTimeZone } from 'ks-date-time-zone';
import { Subscription, timer } from 'rxjs';

const CLICK_REPEAT_DELAY = 500;
const CLICK_REPEAT_RATE  = 250;

@Component({
  selector: 'svc-calendar-view-options',
  templateUrl: './svc-calendar-view-options.component.html',
  styleUrls: ['./svc-calendar-view-options.component.scss']
})
export class SvcCalendarViewOptionsComponent implements AfterViewInit, OnDestroy {
  private _eventType = 0;
  private _keyMoonPhases = true;
  private _equisolstice = true;
  private _dailyDaylight = true;
  private _dailyMoonPhase = true;
  private _includeTransits = false;
  private clickTimer: Subscription;
  private pendingDelta = 0;

  eventTypes: SelectItem[] = [
    {label: 'Rise/Set Sun',     value: 0},
    {label: 'Rise/Set Moon',    value: 1},
    {label: 'Rise/Set Mercury', value: 2},
    {label: 'Rise/Set Venus',   value: 3},
    {label: 'Rise/Set Mars',    value: 4},
    {label: 'Rise/Set Jupiter', value: 5},
    {label: 'Rise/Set Saturn',  value: 6},
    {label: 'Rise/Set Uranus',  value: 7},
    {label: 'Rise/Set Neptune', value: 8},
    {label: 'Rise/Set Pluto',   value: 9},
    {label: 'Civil Twilight',   value: 10},
    {label: 'Naut. Twilight',   value: 11},
    {label: 'Astro. Twilight',  value: 12}
  ];

  constructor(private appService: AppService) {
    appService.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_CALENDAR && setting.source !== this) {
        if (setting.property === PROPERTY_EVENT_TYPE)
          this.eventType = <number> setting.value;
        else if (setting.property === PROPERTY_INCLUDE_TRANSITS)
          this.includeTransits = <boolean> setting.value;
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.appService.requestViewSettings(VIEW_CALENDAR));
  }

  ngOnDestroy(): void {
    this.stopClickTimer();
  }

  get eventType(): number { return this._eventType; }
  set eventType(value: number) {
    if (this._eventType !== value) {
      this._eventType = value;
      this.appService.updateUserSetting({view: VIEW_CALENDAR, property: PROPERTY_EVENT_TYPE, value: value, source: this});
    }
  }

  get keyMoonPhases(): boolean { return this._keyMoonPhases; }
  set keyMoonPhases(value: boolean) {
    if (this._keyMoonPhases !== value) {
      this._keyMoonPhases = value;
      this.appService.updateUserSetting({view: VIEW_CALENDAR, property: PROPERTY_KEY_MOON_PHASES, value: value, source: this});
    }
  }

  get equisolstice(): boolean { return this._equisolstice; }
  set equisolstice(value: boolean) {
    if (this._equisolstice !== value) {
      this._equisolstice = value;
      this.appService.updateUserSetting({view: VIEW_CALENDAR, property: PROPERTY_EQUISOLSTICE, value: value, source: this});
    }
  }

  get dailyDaylight(): boolean { return this._dailyDaylight; }
  set dailyDaylight(value: boolean) {
    if (this._dailyDaylight !== value) {
      this._dailyDaylight = value;
      this.appService.updateUserSetting({view: VIEW_CALENDAR, property: PROPERTY_DAILY_DAYLIGHT, value: value, source: this});
    }
  }

  get dailyMoonPhase(): boolean { return this._dailyMoonPhase; }
  set dailyMoonPhase(value: boolean) {
    if (this._dailyMoonPhase !== value) {
      this._dailyMoonPhase = value;
      this.appService.updateUserSetting({view: VIEW_CALENDAR, property: PROPERTY_DAILY_MOON_PHASE, value: value, source: this});
    }
  }

  get includeTransits(): boolean { return this._includeTransits; }
  set includeTransits(value: boolean) {
    if (this._includeTransits !== value) {
      this._includeTransits = value;
      this.appService.updateUserSetting({view: VIEW_CALENDAR, property: PROPERTY_INCLUDE_TRANSITS, value: value, source: this});
    }
  }

  stopClickTimer(): void {
    if (this.clickTimer) {
      this.clickTimer.unsubscribe();
      this.clickTimer = undefined;

      if (this.pendingDelta) {
        this.changeMonth(this.pendingDelta);
        this.pendingDelta = 0;
      }
    }
  }

  onTouchStart(event: TouchEvent, delta: number): void {
    event.preventDefault();
    this.pendingDelta = delta;
    this.onMouseDown(delta);
  }

  onMouseDown(delta: number): void {
    if (!this.clickTimer) {
      this.clickTimer = timer(CLICK_REPEAT_DELAY, CLICK_REPEAT_RATE).subscribe(() => {
        this.changeMonth(delta);
      });
    }
  }

  changeMonth(delta: number): void {
    const zone = KsTimeZone.getTimeZone(this.appService.timeZone, this.appService.longitude);
    const currentTime = new KsDateTime(this.appService.time, zone);

    currentTime.add(DateTimeField.MONTHS, delta);

    if (SVC_MIN_YEAR <= currentTime.wallTime.y && currentTime.wallTime.y <= SVC_MAX_YEAR)
      this.appService.time = currentTime.utcTimeMillis;
  }
}
