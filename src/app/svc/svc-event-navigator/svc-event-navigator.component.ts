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

import { AfterViewInit, Component, Input, OnDestroy } from '@angular/core';
import {
  APHELION, EARTH, EclipseInfo, EventFinder, FALL_EQUINOX, FIRST_QUARTER, FULL_MOON, GALILEAN_MOON_EVENT, GREATEST_ELONGATION,
  GRS_TRANSIT_EVENT, INFERIOR_CONJUNCTION, JUPITER, JupiterInfo, LAST_QUARTER, LUNAR_ECLIPSE, MARS, MERCURY, MOON, NEPTUNE, NEW_MOON,
  OPPOSITION, PERIHELION, PLUTO, QUADRATURE, RISE_EVENT, RISE_SET_EVENT_BASE, SATURN, SET_EVENT, SET_EVENT_MINUS_1_MIN, SkyObserver,
  SOLAR_ECLIPSE, SPRING_EQUINOX, SUMMER_SOLSTICE, SUN, SUPERIOR_CONJUNCTION, TRANSIT_EVENT, TWILIGHT_BEGINS, TWILIGHT_ENDS, URANUS,
  VENUS, WINTER_SOLSTICE
} from 'ks-astronomy';
import { KsDateTime, KsTimeZone } from 'ks-date-time-zone';
import { isString } from 'lodash';
import { MessageService, SelectItem } from 'primeng/api';
import { Subscription, timer } from 'rxjs';
import { AppService, UserSetting } from '../../app.service';
import { AstroDataService } from '../../astronomy/astro-data.service';
import { PROPERTY_FIXED_GRS, PROPERTY_GRS_OVERRIDE, VIEW_MOONS } from '../svc-moons-view/svc-moons-view.component';

const CLICK_REPEAT_DELAY = 500;
const CLICK_REPEAT_RATE  = 100;

@Component({
  selector: 'svc-event-navigator',
  providers: [MessageService],
  templateUrl: './svc-event-navigator.component.html'
})
export class SvcEventNavigatorComponent implements AfterViewInit, OnDestroy {
  private _selectedEvent = RISE_EVENT;
  private _selectedPlanet = SUN;
  private clickTimer: Subscription;
  private lastGoBack = false;
  private waitingForEvent = false;
  private eventFinder: EventFinder;
  private jupiterInfo: JupiterInfo;
  private lastGrsOverride = false;
  private lastGrsLongitude = JupiterInfo.DEFAULT_GRS_LONG.degrees;

  events: SelectItem[] = [
    {label: 'Rising',                  value: RISE_EVENT},
    {label: 'Transit',                 value: TRANSIT_EVENT},
    {label: 'Setting - 1 min.',        value: SET_EVENT_MINUS_1_MIN},
    {label: 'Setting',                 value: SET_EVENT},
    {label: '-', value: -1},
    {label: 'Morning twilight begins', value: TWILIGHT_BEGINS},
    {label: 'Evening twilight ends',   value: TWILIGHT_ENDS},
    {label: '-', value: -1},
    {label: 'New moon',                value: NEW_MOON},
    {label: 'First quarter',           value: FIRST_QUARTER},
    {label: 'Full moon',               value: FULL_MOON},
    {label: 'Last quarter',            value: LAST_QUARTER},
    {label: '-', value: -1},
    {label: 'Spring equinox',          value: SPRING_EQUINOX},
    {label: 'Summer solstice',         value: SUMMER_SOLSTICE},
    {label: 'Fall equinox',            value: FALL_EQUINOX},
    {label: 'Winter solstice',         value: WINTER_SOLSTICE},
    {label: '-', value: -1},
    {label: 'Lunar eclipse',           value: LUNAR_ECLIPSE},
    {label: 'Solar eclipse',           value: SOLAR_ECLIPSE},
    {label: '-', value: -1},
    {label: 'Opposition',              value: OPPOSITION},
    {label: 'Superior conjunction',    value: SUPERIOR_CONJUNCTION},
    {label: 'Inferior conjunction',    value: INFERIOR_CONJUNCTION},
    {label: 'Greatest elongation',     value: GREATEST_ELONGATION},
    {label: '-', value: -1},
    {label: 'Perihelion',              value: PERIHELION},
    {label: 'Aphelion',                value: APHELION},
    {label: 'Quadrature',              value: QUADRATURE},
    {label: '-', value: -1},
    {label: 'Galilean moon',           value: GALILEAN_MOON_EVENT},
    {label: 'GRS transit',             value: GRS_TRANSIT_EVENT}
  ];
  planetChoices: SelectItem[] = [
    {label: 'of Sun',     value: SUN},
    {label: 'of Moon',    value: MOON},
    {label: 'of Mercury', value: MERCURY},
    {label: 'of Venus',   value: VENUS},
    {label: 'of Earth',   value: EARTH},
    {label: 'of Mars',    value: MARS},
    {label: 'of Jupiter', value: JUPITER},
    {label: 'of Saturn',  value: SATURN},
    {label: 'of Uranus',  value: URANUS},
    {label: 'of Neptune', value: NEPTUNE},
    {label: 'of Pluto',   value: PLUTO}
  ];

  @Input() disabled = false;
  noPlanets = false;
  eventFinderReady = false;
  planets: SelectItem[] = this.planetChoices;

  constructor(private app: AppService, dataService: AstroDataService, private messageService: MessageService) {
    this.updatePlanets(this._selectedEvent);

    JupiterInfo.getJupiterInfo(dataService).then((jupiterInfo: JupiterInfo) => {
      this.jupiterInfo = jupiterInfo;
      this.eventFinder = new EventFinder(jupiterInfo);
      this.eventFinderReady = true;
    }).catch(() => {
      this.eventFinder = new EventFinder();
      // Trigger update of angular component by creating new (shortened) copy of event item array.
      this.events = this.events.slice(0, this.events.length - 1);
      this.eventFinderReady = true;
    });

    app.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_MOONS && this.jupiterInfo) {
        if (setting.property === PROPERTY_GRS_OVERRIDE) {
          this.lastGrsOverride = <boolean> setting.value;

          if (this.lastGrsOverride)
            this.jupiterInfo.setFixedGRSLongitude(this.lastGrsLongitude);
          else
            this.jupiterInfo.clearFixedGRSLongitude();
        }
        else if (setting.property === PROPERTY_FIXED_GRS) {
          this.lastGrsLongitude = <number> setting.value;

          if (this.lastGrsOverride)
            this.jupiterInfo.setFixedGRSLongitude(this.lastGrsLongitude);
        }
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.app.requestViewSettings(VIEW_MOONS));
  }

  ngOnDestroy(): void {
    this.stopClickTimer();
  }

  stopClickTimer(): void {
    if (this.clickTimer) {
      this.clickTimer.unsubscribe();
      this.clickTimer = undefined;
    }
  }

  get selectedEvent(): number { return this._selectedEvent; }
  @Input() set selectedEvent(newEvent: number) {
    if (this._selectedEvent !== newEvent) {
      const lastEvent = this._selectedEvent;
      this._selectedEvent = newEvent;

      if (newEvent < 0) {
        timer(0).subscribe(() => {
          this.selectedEvent = lastEvent;
        });
      }
      else
        this.updatePlanets(newEvent);
    }
  }

  get selectedPlanet(): number { return this._selectedPlanet; }
  @Input() set selectedPlanet(newPlanet: number) {
    if (this._selectedPlanet !== newPlanet) {
      const lastPlanet = this._selectedPlanet;
      this._selectedPlanet = newPlanet;

      if (newPlanet < 0) {
        timer(0).subscribe(() => {
          this.selectedPlanet = lastPlanet;
        });
      }
    }
  }

  onTouchStart(event: TouchEvent, goBack: boolean): void {
    event.preventDefault();
    this.onMouseDown(goBack);
  }

  onMouseDown(goBack: boolean, event?: MouseEvent): void {
    if (!this.clickTimer && (!event || event.button === 0)) {
      this.lastGoBack = goBack;

      this.clickTimer = timer(CLICK_REPEAT_DELAY, CLICK_REPEAT_RATE).subscribe(() => {
        this.getEvent(this.lastGoBack);
      });
    }
  }

  onTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    this.onMouseUp();
  }

  onMouseUp(): void {
    if (this.clickTimer) {
      this.stopClickTimer();
      this.getEvent(this.lastGoBack);
    }
  }

  private updatePlanets(event: number): void {
    let badValue = -1;
    let firstIncluded = -1;
    this.planets = [];

    for (const planet of this.planetChoices) {
      let includePlanet: boolean;

      if (event === TWILIGHT_BEGINS || event === TWILIGHT_ENDS)
        includePlanet = false;
      else if (planet.value === SUN || planet.value === MOON)
        includePlanet = (Math.floor(event / 100) === Math.floor(RISE_SET_EVENT_BASE / 100));
      else if (event === PERIHELION || event === APHELION)
        includePlanet = true;
      else if (planet.value === EARTH)
        includePlanet = false;
      else if (event === SUPERIOR_CONJUNCTION || Math.floor(event / 100) === Math.floor(RISE_SET_EVENT_BASE / 100))
        includePlanet = true;
      else if (event === OPPOSITION || event === QUADRATURE)
        includePlanet = (planet.value >= MARS);
      else if (event === INFERIOR_CONJUNCTION || event === GREATEST_ELONGATION)
        includePlanet = (planet.value <= VENUS);
      else
        includePlanet = false;

      if (includePlanet) {
        this.planets.push(planet);

        if (firstIncluded < 0)
          firstIncluded = planet.value;
      }
      else
        this.planets.push({label: '\u00A0', value: badValue--});
    }

    if (firstIncluded >= 0 && this.planets[this._selectedPlanet].value < 0)
      this.selectedPlanet = firstIncluded;

    this.noPlanets = (firstIncluded < 0);
  }

  private getEvent(goBack: boolean): void {
    if (this.waitingForEvent)
      return;

    this.waitingForEvent = true;

    const observer = new SkyObserver(this.app.location.longitude, this.app.location.latitude);
    let altMins: number;

    if (this._selectedEvent === TWILIGHT_BEGINS || this._selectedEvent === TWILIGHT_ENDS) {
      if (this.app.twilightByDegrees)
        altMins = -this.app.twilightDegrees;
      else
        altMins = this.app.twilightMinutes;
    }

    const timeZone = KsTimeZone.getTimeZone(this.app.location.zone, this.app.location.longitude);
    const event = this.eventFinder.findEvent(this._selectedPlanet, this._selectedEvent, KsDateTime.julianDay(this.app.time),
                    observer, timeZone, this.app.gregorianChangeDate, goBack, altMins);

    this.waitingForEvent = false;

    if (event) {
      this.app.time = event.eventTime.utcTimeMillis;

      let message: string;

      if (isString(event.miscInfo))
        message = <string> event.miscInfo;
      else if (event.eventType === LUNAR_ECLIPSE || event.eventType === SOLAR_ECLIPSE) {
        const ei = <EclipseInfo> event.miscInfo;

        if (ei.total)
          message = 'Total';
        else if (ei.hybrid)
          message = 'Hybrid';
        else if (ei.annular)
          message = 'Annular';
        else
          message = 'Partial';

        message += ' eclipse of the ' + (event.eventType === LUNAR_ECLIPSE ? 'Moon' : 'Sun');
      }

      if (message)
        this.messageService.add({key: 'navigator', severity: 'info', summary: '', detail: message, life: 6000});
    }
  }
}
