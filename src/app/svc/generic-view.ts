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

import { AfterViewInit } from '@angular/core';
import { AppService, CurrentTab } from '../app.service';
import { ISkyObserver } from '../astronomy/i-sky-observer';
import { StarCatalog } from '../astronomy/star-catalog';
import { SolarSystem } from '../astronomy/solar-system';
import { abs, ceil, max } from '../util/ks-math';
import { FontMetrics, isSafari, getFontMetrics } from '../util/ks-util';
import * as _ from 'lodash';
import { KsDateTime } from '../util/ks-date-time';
import { ASTEROID_BASE, COMET_BASE, EARTH, FIRST_PLANET, HALF_MINUTE, LAST_PLANET, NO_MATCH } from '../astronomy/astro-constants';
import { UT_to_TDB } from '../astronomy/ut-converter';
import { SafeStyle } from '@angular/platform-browser';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { SkyObserver } from '../astronomy/sky-observer';

export const PROPERTY_ADDITIONALS = 'additionals';
export enum    ADDITIONALS {NONE, ALL_ASTEROIDS, ALL_COMETS, ALL}

const MAX_RESIZE_TOLERANCE = 4;
const MAX_RESIZE_CYCLES = 3;

export interface DrawingContext {
  context: CanvasRenderingContext2D;
  w: number;
  h: number;
  largeLabelFm: FontMetrics;
  mediumLabelFm: FontMetrics;
  smallLabelFm: FontMetrics;
  sc: StarCatalog;
  ss: SolarSystem;
  skyObserver: ISkyObserver;
  jdu: number;
  jde: number;
  inkSaver: boolean;
}

export abstract class GenericView implements AfterViewInit {
  private static _printing = new BehaviorSubject<boolean>(false);
  private static printingObserver: Observable<boolean> = GenericView._printing.asObservable();

  public static get printing(): boolean {
    return GenericView._printing.getValue();
  }

  protected wrapper: HTMLDivElement;
  protected canvas: HTMLCanvasElement;
  protected marquee: HTMLDivElement;
  protected lastWidth = -1;
  protected lastHeight = -1;
  protected width = -1;
  protected height = -1;
  protected time: number;
  protected timeSubscription: Subscription;
  protected locationSubscription: Subscription;
  protected clickX = -1;
  protected clickY = -1;
  protected canDrag = true;
  protected debouncedDraw: () => void;
  protected debouncedMouseMove: () => void;
  protected debouncedResize: () => void;
  protected dragging = false;
  protected excludedPlanets: number[] = [EARTH];
  protected isSafari = false;
  protected lastMoveX = -1;
  protected lastMoveY = -1;
  protected lastDrawingContext: DrawingContext;
  protected planetsToDraw: number[] = [];
  protected additional: ADDITIONALS | string = ADDITIONALS.NONE;
  protected waitingForResizeToSettle = false;
  protected resizeTolerance = 0;
  protected lastSizeDiff = 0;
  protected resizeCycles = 0;

  protected sanitizedHandCursor: SafeStyle;
  protected sanitizedLabelCrosshair: SafeStyle;

  protected readonly largeLabelFont  = '12px Arial, Helvetica, sans-serif';
  protected readonly mediumLabelFont = '11px Arial, Helvetica, sans-serif';
  protected readonly smallLabelFont  = '10px Arial, Helvetica, sans-serif';

  public marqueeText = '';

  cursor: SafeStyle;

  static initialize(): void {
    const mql = window.matchMedia('print');

    GenericView._printing.next(mql.matches);

    mql.addListener(() => {
      GenericView._printing.next(mql.matches);
    });
  }

  public static getPrintingUpdate(callback: (printing: boolean) => void): Subscription {
    return GenericView.printingObserver.subscribe(callback);
  }

  constructor(protected appService: AppService, protected tabId: CurrentTab) {
    this.isSafari = isSafari();

    this.sanitizedHandCursor = appService.sanitizer.bypassSecurityTrustStyle('url(/assets/resources/hand_cursor.cur), auto');
    this.sanitizedLabelCrosshair = appService.sanitizer.bypassSecurityTrustStyle('url(/assets/resources/label_crosshair.cur), auto');

    this.updatePlanetsToDraw();

    this.debouncedDraw = _.debounce(() => {
      this.draw();
    }, 0);

    appService.getCurrentTabUpdates((currentTab: CurrentTab) => {
      if (this.tabId === currentTab)
        setTimeout(() => this.onResize());
    });

    this.timeSubscription = appService.getTimeUpdates((time) => {
      this.time = time;
      this.draw();
    });

    this.locationSubscription = appService.getLocationUpdates(() => {
      this.draw();
    });
  }

  ngAfterViewInit(): void {
    this.onResize();

    GenericView.getPrintingUpdate(printing => {
      this.doResize();
    });
  }

  onResize(): void {
    this.waitingForResizeToSettle = false;
    this.resizeCycles = 0;
    this.onResizeAux();
  }

  protected onResizeAux(): void {
    if (!this.debouncedResize) {
      this.debouncedResize = _.debounce(() => {
        this.doResize();

        setTimeout(() => {
          // Ideally this.wrapper.clientWidth and this.canvas.clientWidth are equal after resizing,
          // but in Firefox (and possibly other browsers) they don't match exactly even after an extra
          // cycle of resizing. Below we try to dynamically figure out how much tolerance in width
          // difference to allow for.
          const sizeDiff = abs(this.wrapper.clientWidth - this.canvas.clientWidth);
          let resizeAgain = true;

          if (sizeDiff > this.resizeTolerance) {
            if (this.waitingForResizeToSettle && sizeDiff <= MAX_RESIZE_TOLERANCE) {
              if (sizeDiff === this.lastSizeDiff) {
                if (++this.resizeCycles === MAX_RESIZE_CYCLES) {
                  this.resizeTolerance = sizeDiff;
                  resizeAgain = false;
                  this.waitingForResizeToSettle = false;
                }
              }
              else
                this.resizeCycles = 0;
            }

            this.lastSizeDiff = sizeDiff;

            if (resizeAgain) {
              this.waitingForResizeToSettle = true;
              this.onResizeAux();
            }
          }
        }, 50);
      }, 50);
    }

    this.marqueeText = '';
    this.debouncedResize();
  }

  private doResize(): void {
    const top = ceil(this.canvas.getBoundingClientRect().top);
    const marqueeHeight = this.marquee.getBoundingClientRect().height;

    this.width = this.wrapper.clientWidth;
    // Using the document's clientHeight instead of the window's innerHeight accounts for possible scroll bar.
    this.height = max(window.document.documentElement.clientHeight - top - marqueeHeight - 12, 250);

    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.height = this.height + 'px';
    this.wrapper.style.height = this.height + 'px';

    this.draw();
  }

  // noinspection JSUnusedGlobalSymbols
  onMouseDown(event: MouseEvent): void {
    this.clickX = this.lastMoveX = event.offsetX;
    this.clickY = this.lastMoveY = event.offsetY;
  }

  onMouseMove(event: MouseEvent): void {
    this.lastMoveX = event.offsetX;
    this.lastMoveY = event.offsetY;

    let  justCleared = false;

    if (!this.isInsideView()) {
      this.clearMouseHighlighting();
      justCleared = true;
      this.resetCursor();
    }
    // noinspection JSBitwiseOperatorUsage
    else if (this.canDrag && ((event.buttons & 0x01) || (this.isSafari && (event.which & 0x01)))) {
      this.dragging = true;
      this.cursor = this.sanitizedHandCursor;
    }
    else {
      this.dragging = false;
      this.resetCursor();
    }

    if (!this.dragging || justCleared) {
      if (!this.debouncedMouseMove) {
         this.debouncedMouseMove = _.debounce(() => {
           this.draw();
         }, 100);
      }

      this.debouncedMouseMove();
    }
  }

  protected clearMouseHighlighting(): void {
    this.lastMoveX = this.lastMoveY = -1;
  }

  // noinspection JSUnusedGlobalSymbols
  onMouseUp(event: MouseEvent): void {
    this.lastMoveX = event.offsetX;
    this.lastMoveY = event.offsetY;
    this.resetCursor();
  }

  protected draw(): void {
    if (this.tabId !== this.appService.currentTab)
      return;

    const dc = <DrawingContext> {};

    dc.w = this.width;
    dc.h = this.height;

    if (!this.canvas || dc.w < 0 || dc.h < 0)
      return;

    if (this.lastWidth !== dc.w || this.lastHeight !== dc.h) {
      this.canvas.width = dc.w;
      this.canvas.height = dc.h;
      this.lastWidth = dc.w;
      this.lastHeight = dc.h;
    }

    dc.context = this.canvas.getContext('2d');
    dc.largeLabelFm = getFontMetrics(this.largeLabelFont);
    dc.mediumLabelFm = getFontMetrics(this.mediumLabelFont);
    dc.smallLabelFm = getFontMetrics(this.smallLabelFont);
    dc.sc = this.appService.starCatalog;
    dc.ss = this.appService.solarSystem;
    dc.skyObserver = new SkyObserver(this.appService.longitude, this.appService.latitude);
    // Bias time half a minute ahead of the clock time for rounding to the middle of the selected minute.
    dc.jdu = KsDateTime.julianDay(this.time) + HALF_MINUTE;
    dc.jde = UT_to_TDB(dc.jdu);
    dc.inkSaver = GenericView.printing && this.appService.inkSaver;

    this.additionalDrawingSetup(dc);
    this.drawView(dc);
    this.additionalDrawingSteps(dc);

    this.lastDrawingContext = dc;
  }

  protected additionalDrawingSetup(dc: DrawingContext): void {
  }

  protected additionalDrawingSteps(dc: DrawingContext): void {
  }

  protected abstract drawView(dc: DrawingContext): void;

  protected resetCursor(): void {
    if (this.isInsideView())
      this.cursor = this.sanitizedLabelCrosshair;
    else
      this.cursor = 'default';
  }

  // noinspection JSMethodCanBeStatic
  protected isInsideView(): boolean {
    return false;
  }

  // noinspection JSMethodCanBeStatic
  protected withinPlot(x: number, y: number, dc?: DrawingContext): boolean {
    return false;
  }

  protected withinToleranceOfPlot(x: number, y: number, tolerance: number, dc?: DrawingContext): boolean {
    for (let dy = -tolerance; dy <= tolerance; dy += tolerance) {
      for (let dx = -tolerance; dx <= tolerance; dx += tolerance) {
        if (this.withinPlot(x + dx, y + dy, dc))
          return true;
      }
    }

    return false;
  }

  protected updatePlanetsToDraw(): void {
    this.planetsToDraw = [];

    for (let i = FIRST_PLANET; i <= LAST_PLANET; ++i) {
      if (_.indexOf(this.excludedPlanets, i) < 0)
        this.planetsToDraw.push(i);
    }

    if (this.additional === ADDITIONALS.ALL_ASTEROIDS || this.additional === ADDITIONALS.ALL) {
      for (let i = ASTEROID_BASE + 1; i <= ASTEROID_BASE + SolarSystem.getAsteroidCount(); ++i)
        this.planetsToDraw.push(i);
    }

    if (this.additional === ADDITIONALS.ALL_COMETS || this.additional === ADDITIONALS.ALL) {
      for (let i = COMET_BASE + 1; i <= COMET_BASE + SolarSystem.getCometCount(); ++i)
        this.planetsToDraw.push(i);
    }

    if (_.isString(this.additional)) {
      const id = this.appService.solarSystem.getPlanetByName(<string> this.additional);

      if (id !== NO_MATCH)
        this.planetsToDraw.push(id);
    }
  }
}

GenericView.initialize();
