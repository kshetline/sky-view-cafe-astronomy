import { Component, OnInit } from '@angular/core';
import { AstroEvent, EclipseCircumstances, EventFinder, LUNAR_ECLIPSE_LOCAL, MOON, SkyObserver, SOLAR_ECLIPSE_LOCAL, SUN } from '@tubular/astronomy';
import { abs, floor, round } from '@tubular/math';
import ttime, { DateTime, Timezone, utToTdt } from '@tubular/time';
import { padLeft } from '@tubular/util';
// import { Timezone } from '@tubular/time';
import { AppService, Location } from '../../app.service';
import julianDay = ttime.julianDay;

const eventFinder = new EventFinder();

const UPDATE_DELAY = 2500;

function toDuration(secs: number): string {
  let result = '';
  let pad = 1;

  secs = round(secs);
  const hours = floor(secs / 3600);
  secs -= hours * 3600;
  const mins = floor(secs / 60);
  secs -= mins * 60;

  if (hours) {
    result += hours + 'h';
    pad = 2;
  }

  if (hours || mins) {
    result += padLeft(mins, pad, '0') + 'm';
    pad = 2;
  }

  result += padLeft(secs, pad, '0') + 's';

  return result;
}

@Component({
  selector: 'svc-eclipse-circumstances',
  templateUrl: './svc-eclipse-circumstances.component.html',
  styleUrls: ['./svc-eclipse-circumstances.component.scss']
})
export class SvcEclipseCircumstancesComponent implements OnInit {
  private isSolar: boolean;
  private location: Location;
  private updateTimer: any;

  eclipseTime: number;
  eventTitle = '';

  p1: string;
  u1: string;
  u2: string;
  u3: string;
  u4: string;
  p4: string;

  penumbralDuration: string;
  duration: string;
  totalityDuration: string;

  constructor(private app: AppService) {
    app.getTimeUpdates(t => this.update(t, app.location));
    app.getLocationUpdates(loc => this.update(app.time, loc));
  }

  ngOnInit(): void {
    this.update(this.app.time, this.app.location);
  }

  private update(millis: number, location: Location): void {
    if (this.updateTimer)
      clearTimeout(this.updateTimer);

    const jdu = julianDay(millis);

    if (location !== this.location || this.eclipseTime == null ||
        jdu < this.eclipseTime - 0.5 || jdu > this.eclipseTime + 0.5) {
      this.eclipseTime = undefined;
      this.location = location;

      this.updateTimer = setTimeout(() => {
        this.updateTimer = undefined;

        const jde = utToTdt(jdu);
        const gcd = this.app.gregorianChangeDate;
        const observer = new SkyObserver(location.longitude, location.latitude);
        const zone = Timezone.getTimezone(this.app.timezone);
        const elongation = this.app.solarSystem.getSolarElongation(MOON, jde, observer);
        let event: AstroEvent;

        if (abs(elongation) < 15) {
          this.isSolar = true;
          event = eventFinder.findEvent(SUN, SOLAR_ECLIPSE_LOCAL, jdu - 0.55, observer, zone, gcd, false, null, 1);
        }
        else if (abs(elongation - 180) < 15) {
          this.isSolar = false;
          event = eventFinder.findEvent(MOON, LUNAR_ECLIPSE_LOCAL, jdu - 0.55, observer, zone, gcd, false, null, 1);
        }

        if (event && event.ut < jdu + 0.5) {
          const ec = event.miscInfo as EclipseCircumstances;

          this.eclipseTime = event.ut;
          this.eventTitle = (this.isSolar ? 'Solar' : 'Lunar') + ' Eclipse, ';

          function formatTime(t: number): string {
            return new DateTime({ jdu: t}, zone).format('HH:mm:ss');
          }

          if (ec.annular)
            this.eventTitle += 'Annular';
          else if (ec.maxEclipse >= 100)
            this.eventTitle += 'Total';
          else if (ec.maxEclipse <= 0 && ec.penumbralDuration != null)
            this.eventTitle += 'Penumbral';
          else
            this.eventTitle += 'Partial';

          if (ec.penumbralDuration) {
            this.p1 = formatTime(ec.penumbralFirstContact);
            this.p4 = formatTime(ec.penumbralLastContact);
            this.penumbralDuration = toDuration(ec.penumbralDuration);
          }
          else
            this.p1 = this.p4 = this.penumbralDuration = '';

          if (ec.duration) {
            this.u1 = formatTime(ec.firstContact);
            this.u4 = formatTime(ec.lastContact);
            this.duration = toDuration(ec.duration);
          }
          else
            this.u1 = this.u4 = this.duration = '';

          if (ec.peakDuration) {
            this.u2 = formatTime(ec.peakStarts);
            this.u3 = formatTime(ec.peakEnds);
            this.totalityDuration = toDuration(ec.peakDuration);
          }
          else
            this.u2 = this.u3 = this.totalityDuration = '';
       }
      }, UPDATE_DELAY);
    }
  }
}
