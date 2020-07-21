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

import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { SafeStyle } from '@angular/platform-browser';
import { getInsolationColor, MOON, SUN, UT_to_TDB } from 'ks-astronomy';
import { KsDateTime, KsTimeZone } from 'ks-date-time-zone';
import { floor, FMT_DD, FMT_MINS, min, round } from 'ks-math';
import { strokeLine } from 'ks-util';
import { AppService, CurrentTab, Location, UserSetting } from '../../app.service';
import { DrawingContext, GenericViewDirective } from '../generic-view.directive';

export const  VIEW_INSOLATION = 'insolation';
export const    PROPERTY_CENTER_MIDNIGHT = 'center_midnight';
export const    PROPERTY_SHOW_MOONLIGHT = 'show_moonlight';

const MINS_PER_DAY = 1440;
const FIVE_MIN_INTERVALS_PER_DAY = 288;
const MAX_DAYS_PER_YEAR = 366;
const MARK_GAP    = 2;
const MARK_LENGTH = 5;

const ABBR_MONTH_NAMES = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const enum RefreshMode {NEVER_REFRESH, REFRESH_ON_CHANGED_YEAR, ALWAYS_REFRESH}

const crosshairColor        = 'green';
const crosshairOutlineColor = 'white';
const crosshairCenterColor  = 'black';

const CROSSHAIR_SIZE     = 8;
const CROSSHAIR_CLEARING = 2;

@Component({
  selector: 'svc-insolation-view',
  templateUrl: './svc-insolation-view.component.html',
  styleUrls: ['./svc-insolation-view.component.scss']
})
export class SvcInsolationViewComponent extends GenericViewDirective implements AfterViewInit {
  private insolationCanvas: HTMLCanvasElement;
  private refreshImage = false;
  private lastPlotSize: number;
  private lastPlotY = 0;
  private drawingComplete = false;
  private location: Location;
  private dateTime: KsDateTime;
  private wasWithinGraph = false;

  private currentYear = Number.MIN_SAFE_INTEGER;
  private daysInYear = 365;
  private baseTime: number;
  private hOffset = 0;
  private vOffset = 0;
  private graphWidth = 1;
  private graphHeight = 1;

  private centerMidnight = true;
  private showMoonlight = false;

  private readonly sanitizedOpenCrosshair: SafeStyle;

  @ViewChild('canvasWrapper', { static: true }) private wrapperRef: ElementRef;
  @ViewChild('insolationCanvas', { static: true }) private canvasRef: ElementRef;

  skyColor = 'black';
  moonColor = 'black';

  constructor(appService: AppService) {
    super(appService, CurrentTab.INSOLATION);

    this.sanitizedOpenCrosshair = appService.sanitizer.bypassSecurityTrustStyle('url(/assets/resources/open_crosshair.cur), auto');
    this.cursor = this.sanitizedOpenCrosshair;
    this.canDrag = false;

    appService.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_INSOLATION && setting.source !== this) {
        if (setting.property === PROPERTY_CENTER_MIDNIGHT)
          this.centerMidnight = <boolean> setting.value;
        else if (setting.property === PROPERTY_SHOW_MOONLIGHT)
          this.showMoonlight = <boolean> setting.value;

        this.refreshImage = true;
        this.throttledRedraw();
      }
    });

    this.locationSubscription.unsubscribe();
    this.locationSubscription = appService.getLocationUpdates((location: Location) => {
      this.location = location;
      this.updateView(RefreshMode.ALWAYS_REFRESH);
    });

    this.location = appService.location;

    this.timeSubscription.unsubscribe();
    this.timeSubscription = appService.getTimeUpdates((time) => {
      this.time = time;
      this.updateView(RefreshMode.REFRESH_ON_CHANGED_YEAR);
    });

    this.time = appService.time;
    this.updateView(RefreshMode.NEVER_REFRESH);
  }

  ngAfterViewInit(): void {
    this.wrapper = this.wrapperRef.nativeElement;
    this.canvas = this.canvasRef.nativeElement;

    setTimeout(() => this.appService.requestViewSettings(VIEW_INSOLATION));

    super.ngAfterViewInit();
  }

  protected updateView(redrawMode: RefreshMode): void {
    const zone = KsTimeZone.getTimeZone(this.location.zone, this.location.longitude);

    this.dateTime = new KsDateTime(this.time, zone, this.appService.gregorianChangeDate);

    if (redrawMode === RefreshMode.ALWAYS_REFRESH ||
        (redrawMode === RefreshMode.REFRESH_ON_CHANGED_YEAR && this.dateTime.wallTime.y !== this.currentYear))
    {
      this.refreshImage = true;
    }

    this.draw();
  }

  protected drawView(dc: DrawingContext): void {
    dc.context.fillStyle = '#CCCCCC';
    dc.context.fillRect(0, 0, dc.w, dc.h);

    if (!this.dateTime)
      return;

    if (this.refreshImage) {
      this.refreshImage = false;

      this.currentYear = this.dateTime.wallTime.y;
      this.dateTime.wallTime = {y: this.currentYear, m: 1, d: 1, hrs: 0, min: 0, sec: 0};
      this.baseTime = KsDateTime.julianDay(this.dateTime.utcTimeMillis) + this.dateTime.dstOffsetMinutes / MINS_PER_DAY + (this.centerMidnight ? 0.5 : 0);
      this.daysInYear = this.dateTime.getDaysInYear(this.currentYear);

      if (!this.insolationCanvas)
        this.insolationCanvas = <HTMLCanvasElement> document.createElement('canvas');

      this.insolationCanvas.width = FIVE_MIN_INTERVALS_PER_DAY;
      this.insolationCanvas.height = this.daysInYear;
      this.insolationCanvas.style.width = FIVE_MIN_INTERVALS_PER_DAY + 'px';
      this.insolationCanvas.style.height = this.daysInYear + 'px';

      const context = this.insolationCanvas.getContext('2d');

      context.fillStyle = 'black';
      context.fillRect(0, 0, FIVE_MIN_INTERVALS_PER_DAY, this.daysInYear);

      this.lastPlotSize = 8;
      this.lastPlotY = 0;
      this.drawingComplete = false;
    }

    if (!this.drawingComplete) {
      const startTime = performance.now();
      const context = this.insolationCanvas.getContext('2d');
      let y0 = this.lastPlotY;
      let timedOut = false;

      outerLoop:
      for (let plotSize = this.lastPlotSize; plotSize >= 1; plotSize /= 2) {
        for (let y = y0; y < this.daysInYear; y += plotSize) {
          let time_jdu = this.baseTime + y + 2.5 / MINS_PER_DAY - 5.0 / MINS_PER_DAY * plotSize;

          for (let x = 0; x < FIVE_MIN_INTERVALS_PER_DAY; x += plotSize) {
            time_jdu += 5.0 / MINS_PER_DAY * plotSize;

            if (plotSize !== 8 && (x % (plotSize * 2)) === 0 && (y % (plotSize * 2)) === 0)
              continue;

            context.fillStyle = getInsolationColor(dc.skyObserver, dc.ss, time_jdu, this.showMoonlight);
            context.fillRect(x, y, plotSize, plotSize);
          }

          const currTime = performance.now();

          if (currTime > startTime + 250) {
            timedOut = true;
            this.lastPlotSize = plotSize;
            this.lastPlotY = y + plotSize;

            break outerLoop;
          }
        }

        y0 = 0;
      }

      this.drawingComplete = !timedOut;
    }

    const ascent = dc.mediumLabelFm.ascent;
    const lineHeight = dc.mediumLabelFm.lineHeight;

    this.graphHeight = dc.h - 6 * lineHeight;
    this.graphWidth = round(this.graphHeight * FIVE_MIN_INTERVALS_PER_DAY / MAX_DAYS_PER_YEAR);

    const altWidth = dc.w - 2 * (2 * lineHeight + dc.context.measureText('MMMM').width);

    if (this.graphWidth > altWidth) {
      this.graphWidth = altWidth;
      this.graphHeight = round(this.graphWidth * MAX_DAYS_PER_YEAR / FIVE_MIN_INTERVALS_PER_DAY);
    }

    this.hOffset = round((dc.w - this.graphWidth) / 2);
    this.vOffset = round((dc.h - this.graphHeight) / 2);

    this.graphHeight *= round(this.daysInYear / MAX_DAYS_PER_YEAR);

    dc.context.drawImage(this.insolationCanvas, this.hOffset, this.vOffset, this.graphWidth, this.graphHeight);

    dc.context.fillStyle = 'black';
    dc.context.strokeStyle = 'black';

    for (let hour = 0; hour <= 22; hour += 2) {
      let  hourStr;

      if (this.centerMidnight)
        hourStr = '' + ((hour + 12) % 24);
      else
        hourStr = '' + hour;

      const strWidth = dc.context.measureText(hourStr).width;
      const hpos = this.hOffset + hour / 24 * this.graphWidth;

      dc.context.fillText(hourStr, hpos - strWidth / 2, this.vOffset - 2 * MARK_GAP - MARK_LENGTH);
      strokeLine(dc.context, hpos, this.vOffset - MARK_GAP - MARK_LENGTH, hpos, this.vOffset - MARK_GAP - 1);
    }

    let dayNum = 0;

    for (let month = 1; month <= 12; ++month) {
      const name = ABBR_MONTH_NAMES[month];
      const strWidth = dc.context.measureText(name).width;
      const vpos = this.vOffset + dayNum / this.daysInYear * this.graphHeight;

      dc.context.fillText(name, this.hOffset - 2 * MARK_GAP - MARK_LENGTH - strWidth, vpos + ascent / 2 - 1);
      strokeLine(dc.context, this.hOffset - MARK_GAP - MARK_LENGTH, vpos, this.hOffset - MARK_GAP - 1, vpos);

      dayNum += this.dateTime.getDaysInMonth(this.currentYear, month);
    }

    if (!this.isInsideView()) {
      const day = floor(dc.jdu - this.baseTime);
      const y = this.vOffset + day / this.daysInYear * this.graphHeight;
      const timeOfDay = floor((dc.jdu - this.baseTime - day) * this.graphWidth);
      const x = this.hOffset + timeOfDay;

      dc.context.fillStyle = crosshairCenterColor;
      dc.context.strokeRect(x - CROSSHAIR_CLEARING / 2 - 1, y - CROSSHAIR_CLEARING / 2 - 1, CROSSHAIR_CLEARING + 2, CROSSHAIR_CLEARING + 2);

      dc.context.fillStyle = crosshairOutlineColor;
      dc.context.fillRect(x - 1, y - CROSSHAIR_SIZE,         3, CROSSHAIR_SIZE - CROSSHAIR_CLEARING);
      dc.context.fillRect(x - 1, y + CROSSHAIR_CLEARING + 1, 3, CROSSHAIR_SIZE - CROSSHAIR_CLEARING);
      dc.context.fillRect(x - CROSSHAIR_SIZE,         y - 1, CROSSHAIR_SIZE - CROSSHAIR_CLEARING, 3);
      dc.context.fillRect(x + CROSSHAIR_CLEARING + 1, y - 1, CROSSHAIR_SIZE - CROSSHAIR_CLEARING, 3);

      dc.context.fillStyle = crosshairColor;
      dc.context.fillRect(x, y - CROSSHAIR_SIZE,         1, CROSSHAIR_SIZE - CROSSHAIR_CLEARING);
      dc.context.fillRect(x, y + CROSSHAIR_CLEARING + 1, 1, CROSSHAIR_SIZE - CROSSHAIR_CLEARING);
      dc.context.fillRect(x - CROSSHAIR_SIZE,         y, CROSSHAIR_SIZE - CROSSHAIR_CLEARING, 1);
      dc.context.fillRect(x + CROSSHAIR_CLEARING + 1, y, CROSSHAIR_SIZE - CROSSHAIR_CLEARING, 1);
    }

    this.updateMarquee(dc, this.lastMoveX, this.lastMoveY);

    if (!this.drawingComplete)
      setTimeout(() => this.draw());
  }

  protected isInsideView(): boolean {
    if (!this.lastDrawingContext)
      return false;

    return this.withinPlot(this.lastMoveX, this.lastMoveY, this.lastDrawingContext);
  }

  protected withinPlot(x: number, y: number, dc?: DrawingContext): boolean {
    return (this.hOffset <= x && x < this.hOffset + this.graphWidth &&
            this.vOffset <= y && y < this.vOffset + this.graphHeight);
  }

  protected resetCursor(): void {
    if (this.isInsideView())
      this.cursor = this.sanitizedOpenCrosshair;
    else
      this.cursor = 'default';
  }

  onMouseMove(event: MouseEvent): void {
    super.onMouseMove(event);
    this.updateMarquee(this.lastDrawingContext, event.offsetX, event.offsetY);

    const within = this.withinPlot(event.offsetX, event.offsetY);

    if (this.wasWithinGraph !== within) {
      this.wasWithinGraph = within;
      this.throttledRedraw();
    }
  }

  private updateMarquee(dc: DrawingContext, x: number, y: number): void {
    if (!this.lastDrawingContext) {
      this.marqueeText = '';
    }
    else {
      let jdu: number;

      if (this.withinPlot(x, y)) {
        const days = min(round((y - this.vOffset) / this.graphHeight * this.daysInYear), this.daysInYear - 1);
        const mins = min(round((x - this.hOffset) / this.graphWidth * FIVE_MIN_INTERVALS_PER_DAY) * 5, MINS_PER_DAY - 5);
        jdu = this.baseTime + days + mins / MINS_PER_DAY;
      }
      else {
        jdu = this.lastDrawingContext.jdu;
      }

      const time = new KsDateTime(KsDateTime.millisFromJulianDay(jdu), this.dateTime.timeZone, this.dateTime.getGregorianChange());
      const jde = UT_to_TDB(jdu);

      this.skyColor = getInsolationColor(dc.skyObserver, dc.ss, jdu, false);
      this.moonColor = getInsolationColor(dc.skyObserver, dc.ss, jdu, true, false);
      this.marqueeText = time.toYMDhmString();

      this.marqueeText += ' \u2014 altitude Sun: ' + dc.ss.getHorizontalPosition(SUN, jdu, dc.skyObserver).altitude.toString(FMT_DD | FMT_MINS);
      this.marqueeText += ' \u2022 altitude Moon: ' + dc.ss.getHorizontalPosition(MOON, jdu, dc.skyObserver).altitude.toString(FMT_DD | FMT_MINS);
      this.marqueeText += ', ' + (dc.ss.getIlluminatedFraction(MOON, jde) * 100).toFixed(0) + '% full';
    }
  }
}
