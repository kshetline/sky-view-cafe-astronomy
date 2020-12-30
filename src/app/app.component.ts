/*
  Copyright © 2017-2019 Kerry Shetline, kerry@shetline.com.

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

import { AfterViewInit, Component, HostListener, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { DateTime, Timezone, YMDDate } from '@tubular/time';
import { toggleFullScreen } from '@tubular/util';
import { debounce } from 'lodash-es';
import { MenuItem, MessageService } from 'primeng/api';
import { Subscription, timer } from 'rxjs';
import { AppService, currentMinuteMillis, CurrentTab, PROPERTY_GREGORIAN_CHANGE_DATE, PROPERTY_NATIVE_DATE_TIME,
  UserSetting, VIEW_APP } from './app.service';
import { SvcAtlasService } from './svc/svc-atlas.service';

const MIN_APP_WIDTH = 1040;
const MIN_APP_HEIGHT = 640;

@Component({
  selector: 'svc-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  providers: [AppService, MessageService]
})
export class AppComponent implements AfterViewInit, OnDestroy {
  private dateTime = new DateTime(null, Timezone.OS_ZONE);
  private _date = <YMDDate> {};
  private debouncedResize: () => void;
  private _timeZone: Timezone = Timezone.OS_ZONE;
  private _time: number = this.dateTime.utcTimeMillis;
  private _trackTime = false;
  private timer: Subscription;

  moreItems: MenuItem[] = [
      { label: 'Preferences', icon: 'fas fa-cog', command: () => this.displayPreferences = true },
      { label: 'Help', icon: 'fas fa-question-circle', command: () => this.openHelp() },
      { label: 'Toggle full screen', icon: 'fas fa-arrows-alt', command: () => this.toggleFullScreen() },
      { label: 'About Sky View Café', icon: 'fas fa-info-circle', command: () => this.displayAbout = true }
    ];

  displayAbout = false;
  displayPreferences = false;
  selectedTab = <number> CurrentTab.SKY;
  gcDate = '1582-10-15';
  nativeDateTime = false;

  constructor(public app: AppService, private router: Router, atlasService: SvcAtlasService,
              private messageService: MessageService) {
    this.time = app.time;

    atlasService.ping();

    this.updateTimeZone();
    this.dateTime.setGregorianChange(app.gregorianChangeDate);
    this.gcDate = app.gregorianChangeDate;
    this.nativeDateTime = app.nativeDateTime;

    app.getTimeUpdates((newTime: number) => {
      this.time = newTime;
    });

    app.getLocationUpdates(() => this.updateTimeZone());

    app.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_APP) {
        if (setting.property === PROPERTY_GREGORIAN_CHANGE_DATE) {
          app.applyCalendarType(this.dateTime);
          this.gcDate = app.gregorianChangeDate;
        }
        else if (setting.property === PROPERTY_NATIVE_DATE_TIME)
          this.nativeDateTime = <boolean> setting.value;
      }
    });

    app.getCurrentTabUpdates(tabIndex => {
      this.selectedTab = tabIndex;
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.doResize();

      if (this.router.url === '/') {
        this.selectedTab = <number> this.app.defaultTab;
        this.app.currentTab = this.app.defaultTab;
      }
    });
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  stopTimer(): void {
    if (this.timer) {
      this.timer.unsubscribe();
      this.timer = undefined;
    }
  }

  get time(): number { return this._time; }
  set time(newTime: number) {
    if (this._time !== newTime) {
      this._time = newTime;
      this.app.time = this.dateTime.utcTimeMillis = newTime;
    }
  }

  get timezone(): Timezone { return this._timeZone; }

  get date(): YMDDate {
    const wt = this.dateTime.wallTime;

    if (wt.y !== this._date.y || wt.m !== this._date.m || wt.d !== this._date.d)
      this._date = {y: wt.y, m: wt.m, d: wt.d};

    return this._date;
  }
  set date(newDate: YMDDate) {
    const wt = this.dateTime.wallTime;

    if (wt.y !== newDate.y || wt.m !== newDate.m || wt.d !== newDate.d) {
      this.dateTime.wallTime = {y: newDate.y, m: newDate.m, d: newDate.d, hrs: wt.hrs, min: wt.min, sec: wt.sec};
      this._time = this.app.time = this.dateTime.utcTimeMillis;
    }
  }

  get trackTime(): boolean { return this._trackTime; }
  set trackTime(state: boolean) {
    if (this._trackTime !== state) {
      this._trackTime = state;

      if (state) {
        this.timer = timer(250, 250).subscribe(() => {
          this.time = currentMinuteMillis();
        });
      }
      else
        this.stopTimer();
    }
  }

  setToNow(): void {
    this.time = currentMinuteMillis();
  }

  tabChanged(index: number): void {
    this.app.currentTab = <CurrentTab> index;
  }

  private updateTimeZone(): void {
    this._timeZone = Timezone.getTimezone(this.app.location.zone, this.app.location.longitude);
    this.dateTime.timezone = this._timeZone;

    if (this._timeZone.error)
      this.messageService.add({key: 'general', severity: 'error', summary: 'Failed to retrieve time zone',
        detail: 'Using your OS time zone instead.'});
  }

  // noinspection JSMethodCanBeStatic
  private openHelp(): void {
    window.open('/assets/help/', '_blank');
  }

  // noinspection JSMethodCanBeStatic
  private toggleFullScreen(): void {
    toggleFullScreen();
  }

  @HostListener('window:resize') private onResize(): void {
    if (!this.debouncedResize)
      this.debouncedResize = debounce(() => this.doResize(), 1000);

    this.debouncedResize();
  }

  // noinspection JSMethodCanBeStatic
  private doResize(): void {
    let outermost = document.querySelector('html') as HTMLElement;

    if (!outermost)
      outermost = document.querySelector('body');

    const origOverflow = outermost.style.overflow;

    if (outermost.clientWidth < outermost.scrollWidth || outermost.clientWidth < MIN_APP_WIDTH ||
        outermost.clientHeight < outermost.scrollHeight || outermost.clientHeight < MIN_APP_HEIGHT)
      outermost.style.overflow = 'auto';
    else
      outermost.style.overflow = 'hidden';

    if (outermost.style.overflow !== origOverflow)
      document.dispatchEvent(new Event('scroll-changed'));
  }
}
