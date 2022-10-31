import { AfterViewInit, ChangeDetectorRef, Component, Input, OnDestroy } from '@angular/core';
import {
  APHELION, AstroEvent, EARTH, EclipseInfo, EventFinder, FALL_EQUINOX, FIRST_QUARTER, FULL_MOON, GALILEAN_MOON_EVENT, GREATEST_ELONGATION,
  GRS_TRANSIT_EVENT, INFERIOR_CONJUNCTION, JUPITER, JupiterInfo, LAST_QUARTER, LocalEclipseCircumstances, LUNAR_ECLIPSE, LUNAR_ECLIPSE_LOCAL, MARS, MERCURY, MOON, NEPTUNE, NEW_MOON,
  OPPOSITION, PERIHELION, PLUTO, QUADRATURE, RISE_EVENT, RISE_SET_EVENT_BASE, SATURN, SET_EVENT, SET_EVENT_MINUS_1_MIN, SkyObserver,
  SOLAR_ECLIPSE, SOLAR_ECLIPSE_LOCAL, SPRING_EQUINOX, SUMMER_SOLSTICE, SUN, SUPERIOR_CONJUNCTION, TRANSIT_EVENT, TWILIGHT_BEGINS,
  TWILIGHT_ENDS, URANUS, VENUS, WINTER_SOLSTICE
} from '@tubular/astronomy';
import { DateTime, Timezone } from '@tubular/time';
import { isString } from '@tubular/util';
import { MessageService, SelectItem } from 'primeng/api';
import { Subscription, timer } from 'rxjs';
import { AppService, UserSetting } from '../../app.service';
import { AstroDataService } from '../../astronomy/astro-data.service';
import { PROPERTY_FIXED_GRS, PROPERTY_GRS_OVERRIDE, VIEW_MOONS } from '../svc-moons-view/svc-moons-view.component';

const CLICK_REPEAT_DELAY = 500;
const CLICK_REPEAT_RATE  = 100;

export const  VIEW_EVENT_NAV = 'event_nav';
export const    PROPERTY_EVENT_BODY = 'event_body';
export const    PROPERTY_EVENT_TYPE = 'event_type';

@Component({
  selector: 'svc-event-navigator',
  providers: [MessageService],
  styleUrls: ['./svc-event-navigator.component.scss'],
  templateUrl: './svc-event-navigator.component.html'
})
export class SvcEventNavigatorComponent implements AfterViewInit, OnDestroy {
  private clickTimer: Subscription;
  private eventFinder: EventFinder;
  private initDone = false;
  private jupiterInfo: JupiterInfo;
  private lastGoBack = false;
  private lastGrsLongitude = JupiterInfo.DEFAULT_GRS_LONG.degrees;
  private lastGrsOverride = false;
  private _selectedEvent = RISE_EVENT;
  private _selectedPlanet = SUN;
  private waitingForEvent = false;

  events: SelectItem[] = [
    { label: 'Rising',                  value: RISE_EVENT },
    { label: 'Transit',                 value: TRANSIT_EVENT },
    { label: 'Setting - 1 min.',        value: SET_EVENT_MINUS_1_MIN },
    { label: 'Setting',                 value: SET_EVENT },
    { label: '-', value: -1 },
    { label: 'Morning twilight begins', value: TWILIGHT_BEGINS },
    { label: 'Evening twilight ends',   value: TWILIGHT_ENDS },
    { label: '-', value: -1 },
    { label: 'New moon',                value: NEW_MOON },
    { label: 'First quarter',           value: FIRST_QUARTER },
    { label: 'Full moon',               value: FULL_MOON },
    { label: 'Last quarter',            value: LAST_QUARTER },
    { label: '-', value: -1 },
    { label: 'Spring equinox',          value: SPRING_EQUINOX },
    { label: 'Summer solstice',         value: SUMMER_SOLSTICE },
    { label: 'Fall equinox',            value: FALL_EQUINOX },
    { label: 'Winter solstice',         value: WINTER_SOLSTICE },
    { label: '-', value: -1 },
    { label: 'Lunar eclipse',           value: LUNAR_ECLIPSE },
    { label: 'Solar eclipse',           value: SOLAR_ECLIPSE },
    { label: 'Local lunar eclipse',     value: LUNAR_ECLIPSE_LOCAL },
    { label: 'Local solar eclipse',     value: SOLAR_ECLIPSE_LOCAL },
    { label: '-', value: -1 },
    { label: 'Opposition',              value: OPPOSITION },
    { label: 'Superior conjunction',    value: SUPERIOR_CONJUNCTION },
    { label: 'Inferior conjunction',    value: INFERIOR_CONJUNCTION },
    { label: 'Greatest elongation',     value: GREATEST_ELONGATION },
    { label: '-', value: -1 },
    { label: 'Perihelion',              value: PERIHELION },
    { label: 'Aphelion',                value: APHELION },
    { label: 'Quadrature',              value: QUADRATURE },
    { label: '-', value: -1 },
    { label: 'Galilean moon',           value: GALILEAN_MOON_EVENT },
    { label: 'GRS transit',             value: GRS_TRANSIT_EVENT }
  ];

  planetChoices: SelectItem[] = [
    { label: 'of Sun',     value: SUN },
    { label: 'of Moon',    value: MOON },
    { label: 'of Mercury', value: MERCURY },
    { label: 'of Venus',   value: VENUS },
    { label: 'of Earth',   value: EARTH },
    { label: 'of Mars',    value: MARS },
    { label: 'of Jupiter', value: JUPITER },
    { label: 'of Saturn',  value: SATURN },
    { label: 'of Uranus',  value: URANUS },
    { label: 'of Neptune', value: NEPTUNE },
    { label: 'of Pluto',   value: PLUTO }
  ];

  @Input() disabled = false;

  busy = false;
  busyTimer: any;
  eventFinderReady = false;
  noPlanets = false;
  planets: SelectItem[] = this.planetChoices;

  constructor(
    private app: AppService,
    dataService: AstroDataService,
    private messageService: MessageService,
    private ref: ChangeDetectorRef
  ) {
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
      if (setting.view === VIEW_EVENT_NAV && setting.source !== this) {
        if (setting.property === PROPERTY_EVENT_BODY)
          this.selectedPlanet = setting.value as number;
        else if (setting.property === PROPERTY_EVENT_TYPE)
          this.selectedEvent = setting.value as number;
      }

      if (setting.view === VIEW_MOONS && this.jupiterInfo) {
        if (setting.property === PROPERTY_GRS_OVERRIDE) {
          this.lastGrsOverride = setting.value as boolean;

          if (this.lastGrsOverride)
            this.jupiterInfo.setFixedGRSLongitude(this.lastGrsLongitude);
          else
            this.jupiterInfo.clearFixedGRSLongitude();
        }
        else if (setting.property === PROPERTY_FIXED_GRS) {
          this.lastGrsLongitude = setting.value as number;

          if (this.lastGrsOverride)
            this.jupiterInfo.setFixedGRSLongitude(this.lastGrsLongitude);
        }
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.app.requestViewSettings(VIEW_EVENT_NAV);
      this.app.requestViewSettings(VIEW_MOONS);
    });
    this.initDone = true;
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
      else {
        this.app.updateUserSetting({ view: VIEW_EVENT_NAV, property: PROPERTY_EVENT_TYPE, value: newEvent, source: this });
        this.updatePlanets(newEvent);
      }
    }
  }

  get selectedPlanet(): number { return this._selectedPlanet; }
  @Input() set selectedPlanet(newPlanet: number) {
    if (this._selectedPlanet !== newPlanet) {
      const lastPlanet = this._selectedPlanet;
      this._selectedPlanet = newPlanet;

      if (newPlanet == null || newPlanet < 0) {
        timer(0).subscribe(() => {
          this.selectedPlanet = lastPlanet;
        });
      }
      else
        this.app.updateUserSetting({ view: VIEW_EVENT_NAV, property: PROPERTY_EVENT_BODY, value: newPlanet, source: this });
    }
  }

  onTouchStart(evt: TouchEvent, goBack: boolean): void {
    if (evt.cancelable)
      evt.preventDefault();

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

  onTouchEnd(evt: TouchEvent): void {
    if (evt.cancelable) evt.preventDefault();
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
        this.planets.push({ label: '\u00A0', value: badValue-- });
    }

    if (firstIncluded >= 0 && (!this._selectedPlanet || this.planets[this._selectedPlanet].value < 0))
      this.selectedPlanet = firstIncluded;

    this.noPlanets = (firstIncluded < 0);

    if (this.initDone)
      this.ref.detectChanges();
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

    const timezone = Timezone.getTimezone(this.app.location.zone, this.app.location.longitude);

    this.busyTimer = setTimeout(() => {
      if (this.waitingForEvent)
        this.busy = true;

      this.busyTimer = undefined;
    }, 500);

    setTimeout(() => this.eventFinder.findEventAsync(this._selectedPlanet, this._selectedEvent,
        DateTime.julianDay(this.app.time), observer, timezone, this.app.gregorianChangeDate, goBack, altMins)
      .then(event => this.gotEvent(event))
      .catch(err => {
        console.error(err);
        this.gotEvent(null);
      }));
  }

  private gotEvent(event: AstroEvent): void {
    this.waitingForEvent = false;

    if (this.busyTimer) {
      clearTimeout(this.busyTimer);
      this.busyTimer = undefined;
    }

    this.busy = false;

    if (event) {
      this.app.time = event.eventTime.utcTimeMillis;
      if (event.eventType === LUNAR_ECLIPSE_LOCAL || event.eventType === SOLAR_ECLIPSE_LOCAL) {
        const lec = event.miscInfo as LocalEclipseCircumstances;
        console.log(lec);
        if (lec.annular)
          console.log('Annular');
        if (lec.penumbralFirstContact != null)
          console.log(new DateTime({ jdu: lec.penumbralFirstContact }, this.app.timezone).toIsoString());
        console.log(new DateTime({ jdu: lec.firstContact }, this.app.timezone).toIsoString());
        if (lec.peakDuration) {
          console.log('   ', new DateTime({ jdu: lec.peakStarts }, this.app.timezone).toIsoString());
          console.log('   ', new DateTime({ jdu: lec.peakEnds }, this.app.timezone).toIsoString());
        }
        console.log(new DateTime({ jdu: lec.lastContact }, this.app.timezone).toIsoString());
        if (lec.penumbralLastContact != null)
          console.log(new DateTime({ jdu: lec.penumbralLastContact }, this.app.timezone).toIsoString());
      }

      let message: string;

      if (isString(event.miscInfo))
        message = event.miscInfo as string;
      else if (event.eventType === LUNAR_ECLIPSE || event.eventType === SOLAR_ECLIPSE) {
        const ei = event.miscInfo as EclipseInfo;
        console.log(ei);

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
      else if (event.eventType === LUNAR_ECLIPSE_LOCAL || event.eventType === SOLAR_ECLIPSE_LOCAL) {
        const lec = event.miscInfo as LocalEclipseCircumstances;

        if (lec.maxEclipse >= 100)
          message = 'Total';
        else if (lec.annular)
          message = 'Annular';
        else
          message = 'Partial';

        message += ' eclipse of the ' + (event.eventType === LUNAR_ECLIPSE_LOCAL ? 'Moon' : 'Sun');
      }

      if (message) {
        this.messageService.clear('navigator');
        this.messageService.add({ key: 'navigator', severity: 'info', summary: '', detail: message, life: 6000 });
      }
    }
  }
}
