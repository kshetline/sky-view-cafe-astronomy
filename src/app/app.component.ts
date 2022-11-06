import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { AstroEvent, EventFinder, FIRST_QUARTER, FULL_MOON, LAST_QUARTER, NEW_MOON } from '@tubular/astronomy';
import { max, min, Point } from '@tubular/math';
import { CalendarDateInfo, TimeEditorOptions, YearStyle } from '@tubular/ng-widgets';
import { DateTime, defaultLocale, getStartOfWeek, Timezone, YMDDate } from '@tubular/time';
import { isEqual, toggleFullScreen } from '@tubular/util';
import { debounce } from 'lodash-es';
import { MenuItem, MessageService } from 'primeng/api';
import { Subscription, timer } from 'rxjs';
import {
  AppService, ClockStyle, currentMinuteMillis, CurrentTab, PROPERTY_CLOCK_FLOATING, PROPERTY_CLOCK_POSITION,
  PROPERTY_GREGORIAN_CHANGE_DATE, PROPERTY_NATIVE_DATE_TIME, SVC_MAX_YEAR, SVC_MIN_YEAR, UserSetting, VIEW_APP
} from './app.service';
import { SvcAtlasService } from './svc/svc-atlas.service';
import { addResizeListener, removeResizeListener } from 'detect-resize';
import { PROPERTY_FIRST_DAY_OF_WEEK, VIEW_CALENDAR } from './svc/svc-calendar-view/svc-calendar-view.component';

const MIN_APP_WIDTH = 1040;
const MIN_APP_HEIGHT = 640;

const FLOAT_CLOCK_MAX_FONT_SIZE_EMS = 3;
const MAX_CLOCK_EFFECTIVE_WIDTH = 600;

@Component({
  selector: 'svc-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  providers: [AppService, MessageService]
})
export class AppComponent implements AfterViewInit, OnDestroy {
  Timezone = Timezone;
  SVC_MIN_YEAR = SVC_MIN_YEAR.toString();
  SVC_MAX_YEAR = SVC_MAX_YEAR.toString();

  private _clockPosition: Point = undefined;
  private clockPositionDebounce: any;
  private dateTime = new DateTime(null, Timezone.OS_ZONE);
  private _date: YMDDate = {};
  private debouncedResize: () => void;
  private eventFinder = new EventFinder();
  private lastEventMonth = 0;
  private lastEvents: AstroEvent[];
  private lastEventYear = Number.MIN_SAFE_INTEGER;
  private _timeZone: Timezone = Timezone.OS_ZONE;
  private _time: number = this.dateTime.utcTimeMillis;
  private _trackTime = false;
  private timer: Subscription;

  moreItems: MenuItem[] = [
    { label: 'Preferences', icon: 'fas fa-cog', command: (): any => this.displayPreferences = true },
    { label: 'Help', icon: 'fas fa-question-circle', command: (): void => this.openHelp() },
    { label: 'Toggle floating clock', icon: 'far fa-clock', command: (): void => this.toggleFloatingClock() },
    { label: 'Toggle full screen', icon: 'fas fa-arrows-alt', command: (): void => this.toggleFullScreen() },
    { label: 'About Sky View Café', icon: 'fas fa-info-circle', command: (): any => this.displayAbout = true }
  ];

  clockCaption = '\xA0';
  displayAbout = false;
  displayPreferences = false;
  firstDay = getStartOfWeek(defaultLocale);
  floatingClockFontSize = FLOAT_CLOCK_MAX_FONT_SIZE_EMS;
  gcDate = '1582-10-15';
  nativeDateTime = false;
  selectedTab = CurrentTab.SKY;
  showEclipseCircumstances = true;

  constructor(
    public app: AppService,
    private router: Router,
    atlasService: SvcAtlasService,
    private messageService: MessageService,
    private sanitizer: DomSanitizer,
    private elemRef: ElementRef
  ) {
    this.time = app.time;

    atlasService.ping();

    this.updateTimeZone();
    this.dateTime.setGregorianChange(app.gregorianChangeDate);
    this.gcDate = app.gregorianChangeDate;
    this.nativeDateTime = app.nativeDateTime;

    app.getTimeUpdates((newTime: number) => this.time = newTime);
    app.getLocationUpdates(() => this.updateTimeZone());

    app.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_APP) {
        if (setting.property === PROPERTY_GREGORIAN_CHANGE_DATE) {
          app.applyCalendarType(this.dateTime);
          this.gcDate = app.gregorianChangeDate;
          this.lastEventMonth = 0;
        }
        else if (setting.property === PROPERTY_NATIVE_DATE_TIME)
          this.nativeDateTime = setting.value as boolean;
      }
      else if (setting.view === VIEW_CALENDAR && setting.property === PROPERTY_FIRST_DAY_OF_WEEK)
        this.firstDay = (setting.value as number) < 0 ? getStartOfWeek(defaultLocale) : setting.value as number;
    });

    app.getCurrentTabUpdates(tabIndex => {
      this.selectedTab = tabIndex;
      this.showEclipseCircumstances =
        ![CurrentTab.CALENDAR, CurrentTab.INSOLATION, CurrentTab.ORBITS, CurrentTab.INSOLATION,
          CurrentTab.MOONS_GRS, CurrentTab.TABLES, CurrentTab.TIME].includes(tabIndex);
    });
  }

  ngAfterViewInit(): void {
    addResizeListener(this.elemRef.nativeElement, this.onResize);
    setTimeout(() => {
      this.doResize();

      if (this.router.url === '/') {
        this.selectedTab = this.app.defaultTab;
        this.app.currentTab = this.app.defaultTab;
      }
    });
  }

  ngOnDestroy(): void {
    this.stopTimer();
    removeResizeListener(this.elemRef.nativeElement, this.onResize);
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

  get clockOptions(): string | TimeEditorOptions | (string | TimeEditorOptions)[]  {
    const showSeconds = (this.app.clockStyle === ClockStyle.ISO_SEC || this.app.clockStyle === ClockStyle.LOCAL_SEC);

    if (!this.app.localTimeFormat) {
      this.clockCaption = '±YYYY-MM-DD HH:mm' + (showSeconds ? ':ss' : '');

      return ['iso', { showDstSymbol: true, showOccurrence: true, showSeconds, showUtcOffset: true,
                       yearStyle: YearStyle.SIGNED }];
    }
    else {
      this.clockCaption = '\xA0';

      return { numbering: 'latn', showDstSymbol: true, showOccurrence: true, showSeconds, showUtcOffset: true,
               twoDigitYear: false, yearStyle: YearStyle.AD_BC };
    }
  }

  get timezone(): Timezone { return this._timeZone; }

  get date(): YMDDate {
    const wt = this.dateTime.wallTime;

    if (wt.y !== this._date.y || wt.m !== this._date.m || wt.d !== this._date.d)
      this._date = { y: wt.y, m: wt.m, d: wt.d };

    return this._date;
  }

  set date(newDate: YMDDate) {
    const wt = this.dateTime.wallTime;

    if (wt.y !== newDate.y || wt.m !== newDate.m || wt.d !== newDate.d) {
      this.dateTime.wallTime = { y: newDate.y, m: newDate.m, d: newDate.d, hrs: wt.hrs, min: wt.min, sec: wt.sec };
      this._time = this.app.time = this.dateTime.utcTimeMillis;
    }
  }

  private cachedSafeHtml = new Map<string, SafeHtml>();

  getBackground = (dateInfo: CalendarDateInfo): string | SafeHtml => {
    if (dateInfo.otherMonth)
      return '';

    if (this.lastEventYear !== dateInfo.y || this.lastEventMonth !== dateInfo.m || !this.lastEvents) {
      this.lastEvents = this.eventFinder.getLunarPhasesForMonth(dateInfo.y, dateInfo.m, this._timeZone, this.gcDate);
      this.lastEventMonth = dateInfo.m;
      this.lastEventYear = dateInfo.y;
    }

    const match = this.lastEvents.find(evt => evt.eventTime.get('day') === dateInfo.d);

    if (match) {
      let phaseImage: string;

      switch (match.eventType) {
        case NEW_MOON:      phaseImage = '/assets/resources/new_moon.svg'; break;
        case FIRST_QUARTER: phaseImage = '/assets/resources/fq_moon.svg'; break;
        case FULL_MOON:     phaseImage = '/assets/resources/full_moon.svg'; break;
        case LAST_QUARTER:  phaseImage = '/assets/resources/lq_moon.svg'; break;
      }

      if (phaseImage) {
        let html = this.cachedSafeHtml.get(phaseImage);

        if (!html) {
          html = this.sanitizer.bypassSecurityTrustHtml(
`<img src="${phaseImage}" alt="${phaseImage.substr(18)}" style="opacity: 0.5; width: 1em; height: 1em; position: relative">`);
          this.cachedSafeHtml.set(phaseImage, html);
        }

        return html;
      }
    }

    return '';
  };

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
    this.app.currentTab = index;
  }

  private updateTimeZone(): void {
    this._timeZone = Timezone.getTimezone(this.app.location.zone, this.app.location.longitude);
    this.dateTime.timezone = this._timeZone;
    this.lastEventMonth = 0;

    if (this._timeZone.error)
      this.messageService.add({ key: 'general', severity: 'error', summary: 'Failed to retrieve timezone',
                                detail: 'Using your OS timezone instead.' });
  }

  private toggleFloatingClock(value = !this.app.clockFloating): void {
    this.app.updateUserSetting({ view: VIEW_APP, property: PROPERTY_CLOCK_FLOATING, value, source: this });
  }

  closeFloatingClock(): void {
    this.toggleFloatingClock(false);
  }

  get clockPosition(): Point { return this._clockPosition ?? this.app.clockPosition; }
  set clockPosition(newValue: Point) {
    if (!isEqual(this._clockPosition, newValue)) {
      this._clockPosition = newValue;

      if (!this.clockPositionDebounce) {
        this.clockPositionDebounce = debounce(() =>
          this.app.updateUserSetting(
            { view: VIEW_APP, property: PROPERTY_CLOCK_POSITION, value: JSON.stringify(this._clockPosition), source: this }), 500);
      }

      this.clockPositionDebounce();
    }
  }

  // noinspection JSMethodCanBeStatic
  private openHelp(): void {
    window.open('/assets/help/', '_blank');
  }

  // noinspection JSMethodCanBeStatic
  private toggleFullScreen(): void {
    toggleFullScreen();
  }

  @HostListener('window:resize') private onResize = (): void => {
    if (!this.debouncedResize)
      this.debouncedResize = debounce(() => this.doResize(), 1000);

    this.debouncedResize();
  };

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

    const floater = document.querySelector('#floating-clock > div');

    if (floater) {
      const origSize = this.floatingClockFontSize;
      const clockWidth = floater.getBoundingClientRect().width;
      const winWidth = min(window.innerWidth, document.documentElement.clientWidth) * 0.95;
      const prevFontSize = this.floatingClockFontSize;
      const screenRatio = max(window.innerWidth / window.screen.width, 1);

      this.floatingClockFontSize = min(this.floatingClockFontSize / (clockWidth / winWidth), FLOAT_CLOCK_MAX_FONT_SIZE_EMS);

      const newEffectiveWidth = clockWidth * this.floatingClockFontSize / prevFontSize / screenRatio;

      if (newEffectiveWidth > MAX_CLOCK_EFFECTIVE_WIDTH)
        this.floatingClockFontSize *= MAX_CLOCK_EFFECTIVE_WIDTH / newEffectiveWidth;

      if (this.floatingClockFontSize !== origSize && this._clockPosition) {
        this.clockPosition.x += 0.001; // Just enough change to force position re-check.
      }
    }
  }

  promptForNative = (): boolean => {
    if (this.app.warningNativeDateTime)
      return false;

    this.app.showNativeInputDialog = true;

    return true;
  };
}
