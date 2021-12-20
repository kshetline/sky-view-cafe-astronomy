import { Component } from '@angular/core';
import { SkyObserver } from '@tubular/astronomy';
import ttime, { DAY_MSEC, DateTime, Timezone, utToTdt, isSafeUtcMillis } from '@tubular/time';
import { Angle, FMT_MINS, FMT_SECS, mod2, Mode, round, Unit } from '@tubular/math';
import { padLeft, toDefaultLocaleFixed } from '@tubular/util';
import { AppService, CurrentTab, Location } from '../../app.service';
import getDeltaTAtJulianDate = ttime.getDeltaTAtJulianDate;

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

  deltaT: string;
  deltaTai: string;
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
  modifiedEphemerisDate: string;
  modifiedJulianDate: string;
  taiToUtcWellDefined = false;

  constructor(private app: AppService) {
    app.getTimeUpdates((time: number) => {
      this.time = time;
      this.updateTime();
    });

    app.getLocationUpdates((location: Location) => {
      this.zone = location.zone;
      this.longitude = location.longitude;
      this.skyObserver = new SkyObserver(location.longitude, location.latitude);
      this.updateTime();
    });

    app.getCurrentTabUpdates(() => this.updateTime());
    app.getUserSettingUpdates(() => this.updateTime());
  }

  private updateTime(): void {
    if (this.app.currentTab !== CurrentTab.TIME)
      return;

    const jdu = DateTime.julianDay(this.time);
    const timezone = Timezone.getTimezone(this.zone, this.longitude);
    const showSecs = this.app.showingSeconds;
    const timeFormat = showSecs ? 'HH:mm:ss' : 'HH:mm';
    const angleFormat = showSecs ? FMT_SECS : FMT_MINS;

    // It takes a bit of effort to force locale formatting to be done using a timezone which is
    // not necessarily the browser's local timezone.
    const dateTime = new DateTime(this.time, timezone);

    this.deltaT = getDeltaTAtJulianDate(jdu).toFixed(3);
    this.deltaTai = (dateTime.deltaTaiMillis / 1000).toFixed(3);
    this.taiToUtcWellDefined = isSafeUtcMillis(this.time);
    this.formattedLocalTime = dateTime.format('IF' + (showSecs ? 'L' : 'S z') + ' Z');
    this.formattedLst = this.skyObserver.getLocalHourAngle(jdu, true).toTimeString(angleFormat);

    const longitudeMinutes = round(mod2(this.longitude, 360) * 4);
    const lmtTime = new DateTime(this.time, Timezone.getTimezone('LMT', this.longitude));

    this.formattedLmt = lmtTime.format(timeFormat);
    this.lmtLongitude = new Angle(longitudeMinutes, Unit.HOUR_ANGLE_MINUTES).toSuffixedString('E', 'W', angleFormat);

    this.formattedSolarTime = this.skyObserver.getApparentSolarTime(jdu).toTimeString(angleFormat);

    const utTime = new DateTime(this.time, Timezone.UT_ZONE);

    this.formattedUt = utTime.format(timeFormat);

    this.formattedGast = new Angle(this.app.solarSystem.getGreenwichApparentSiderealTime(jdu),
      Unit.DEGREES, Mode.RANGE_LIMIT_NONNEGATIVE).toTimeString(angleFormat);

    this.formattedJulianDate = padLeft(toDefaultLocaleFixed(jdu, 6, 6), 17, nbsp);
    this.modifiedJulianDate = padLeft(toDefaultLocaleFixed(jdu - 2400000.5, 6, 6), 17, nbsp);
    this.formattedEphemerisDate = padLeft(toDefaultLocaleFixed(utToTdt(jdu), 6, 6), 17, nbsp);
    this.modifiedEphemerisDate = padLeft(toDefaultLocaleFixed(utToTdt(jdu) - 2400000.5, 6, 6), 17, nbsp);
    this.formattedDays = padLeft(toDefaultLocaleFixed(this.time / DAY_MSEC, 6, 6), 17, nbsp);
    this.formattedSeconds = padLeft(toDefaultLocaleFixed(this.time / 1000, 0, 0), 17, nbsp);
  }
}
