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

import { Component } from '@angular/core';
import { SkyObserver, UT_to_TDB } from '@tubular/astronomy';
import { DAY_MSEC, DateTime, Timezone } from '@tubular/time';
import { Angle, FMT_MINS, mod2, Mode, round, Unit } from '@tubular/math';
import { padLeft, toDefaultLocaleFixed } from '@tubular/util';
import { AppService, CurrentTab, Location } from '../../app.service';

const nbsp = '\u00A0';

@Component({
  selector: 'svc-time-view',
  templateUrl: './svc-time-view.component.html',
  styleUrls: ['./svc-time-view.component.scss']
})
export class SvcTimeViewComponent {
  private longitude: number;
  private time: number;
  private zone = 'OS';
  private skyObserver = new SkyObserver(0, 0);

  formattedLocalTime: string;
  formattedUt: string;
  formattedGast: string;
  formattedLst: string;
  formattedLmt: string;
  lmtLongitude: string;
  formattedSolarTime: string;
  formattedJulianDate: string;
  formattedEphemerisDate: string;
  formattedDays: string;
  formattedSeconds: string;

  constructor(private appService: AppService) {
    appService.getTimeUpdates((time: number) => {
      this.time = time;
      this.updateTime();
    });

    appService.getLocationUpdates((location: Location) => {
      this.zone = location.zone;
      this.longitude = location.longitude;
      this.skyObserver = new SkyObserver(location.longitude, location.latitude);
      this.updateTime();
    });

    appService.getCurrentTabUpdates(() => this.updateTime());
  }

  private updateTime(): void {
    if (this.appService.currentTab !== CurrentTab.TIME)
      return;

    const jdu = DateTime.julianDay(this.time);
    const timezone = Timezone.getTimezone(this.zone, this.longitude);

    // It takes a bit of effort to force locale formatting to be done using a timezone which is
    // not necessarily the browser's local timezone.
    const dateTime = new DateTime(this.time, timezone);
    const wallTime = dateTime.wallTime;
    const jsDate = new Date(Date.UTC(wallTime.y, wallTime.m - 1, wallTime.d, wallTime.hrs, wallTime.min, 0));

    this.formattedLocalTime = jsDate.toLocaleString(undefined,
      {timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
       hour: 'numeric', minute: '2-digit'}) + ' ' + dateTime.getTimezoneDisplayName();

    this.formattedLst = this.skyObserver.getLocalHourAngle(jdu, true).toTimeString(FMT_MINS);

    const longitudeMinutes = round(mod2(this.longitude, 360) * 4);
    const lmtWallTime = new DateTime(this.time, Timezone.getTimezone('LMT', this.longitude)).wallTime;

    this.formattedLmt = padLeft(lmtWallTime.hrs, 2, '0') + ':' + padLeft(lmtWallTime.min, 2, '0');
    this.lmtLongitude = new Angle(longitudeMinutes, Unit.HOUR_ANGLE_MINUTES).toSuffixedString('E', 'W', FMT_MINS);

    this.formattedSolarTime = this.skyObserver.getApparentSolarTime(jdu).toTimeString(FMT_MINS);

    const utWallTime = new DateTime(this.time, Timezone.UT_ZONE).wallTime;

    this.formattedUt = padLeft(utWallTime.hrs, 2, '0') + ':' + padLeft(utWallTime.min, 2, '0');

    this.formattedGast = new Angle(this.appService.solarSystem.getGreenwichApparentSiderealTime(jdu),
      Unit.DEGREES, Mode.RANGE_LIMIT_NONNEGATIVE).toTimeString(FMT_MINS);

    this.formattedJulianDate = padLeft(toDefaultLocaleFixed(jdu, 6, 6), 17, nbsp);
    this.formattedEphemerisDate = padLeft(toDefaultLocaleFixed(UT_to_TDB(jdu), 6, 6), 17, nbsp);
    this.formattedDays = padLeft(toDefaultLocaleFixed(this.time / DAY_MSEC, 6, 6), 17, nbsp);
    this.formattedSeconds = padLeft(toDefaultLocaleFixed(this.time / 1000, 0, 0), 17, nbsp);
  }
}
