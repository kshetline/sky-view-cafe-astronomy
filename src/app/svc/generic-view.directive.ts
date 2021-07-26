import { AfterViewInit, Directive, ElementRef, ViewChild } from '@angular/core';
import { SafeStyle } from '@angular/platform-browser';
import {
  ASTEROID_BASE, COMET_BASE, EARTH, FIRST_PLANET, HALF_MINUTE, ISkyObserver, LAST_PLANET, NO_MATCH, SkyObserver, SolarSystem,
  StarCatalog
} from '@tubular/astronomy';
import { DateTime, utToTdt } from '@tubular/time';
import { ceil, max, round, sqrt } from '@tubular/math';
import { clone, FontMetrics, getFontMetrics, isSafari, isString, padLeft } from '@tubular/util';
import { debounce, throttle } from 'lodash-es';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { AppService, CurrentTab } from '../app.service';
import { getXYForTouchEvent } from '../util/ks-touch-events';
import { KsMarqueeComponent } from '../widgets/ks-marquee/ks-marquee.component';

export const PROPERTY_ADDITIONALS = 'additionals';
export enum    ADDITIONALS {NONE, ALL_ASTEROIDS, ALL_COMETS, ALL}

const FLICK_REJECTION_THRESHOLD = 250;
const SLOW_DRAWING_THRESHOLD = 125;
const MAX_SLOW_FRAMES = 3;
const SLOW_FRAME_COUNT_RESET_TIME = 3000;
const FULL_REDRAW_DELAY = 1500;

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
  fullDraw: boolean;
}

@Directive()
export abstract class GenericViewDirective implements AfterViewInit {
  private static _printing = new BehaviorSubject<boolean>(false);
  private static printingObserver: Observable<boolean> = GenericViewDirective._printing.asObservable();

  static get printing(): boolean {
    return GenericViewDirective._printing.getValue();
  }

  protected wrapper: HTMLDivElement;
  protected canvas: HTMLCanvasElement;
  protected marquee: HTMLElement;
  protected lastMarqueeClick = 0;
  protected marqueeClickCount = 0;
  protected canvasScaling = 1;
  protected touchGuard: HTMLDivElement;
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
  protected canTouchZoom = false;
  protected initialZoomSpread = 0; // 0 means not zooming.
  protected goodDragStart = false;
  protected dragStartTime = 0;
  protected throttledRedraw: () => void;
  protected debouncedFullRedraw: () => void;
  protected throttledResize: () => void;
  protected dragging = false;
  protected excludedPlanets: number[] = [EARTH];
  protected isSafari = false;
  protected lastMoveX = -1;
  protected lastMoveY = -1;
  protected lastDrawingContext: DrawingContext;
  protected slowFrameCount = 0;
  protected lastSlowFrameTime = 0;
  protected planetsToDraw: number[] = [];
  protected additional: ADDITIONALS | string = ADDITIONALS.NONE;

  protected showMetrics = false;
  protected lastDrawStart = 0;
  protected lastFullDrawTime: number;

  protected sanitizedHandCursor: SafeStyle;
  protected sanitizedLabelCrosshair: SafeStyle;

  protected readonly largeLabelFont  = '12px Arial, Helvetica, sans-serif';
  protected readonly mediumLabelFont = '11px Arial, Helvetica, sans-serif';
  protected readonly smallLabelFont  = '10px Arial, Helvetica, sans-serif';

  @ViewChild(KsMarqueeComponent, { read: ElementRef }) protected marqueeRef: ElementRef;

  marqueeText = '';
  cursor: SafeStyle;

  static initialize(): void {
    const mql = window.matchMedia('print');

    GenericViewDirective._printing.next(mql.matches);

    const printChange = (): void => {
      console.log(mql.matches);
      GenericViewDirective._printing.next(mql.matches);
    };

    if (mql.addEventListener)
      mql.addEventListener('change', printChange);
    else {
      // noinspection JSDeprecatedSymbols
      mql.addListener(printChange);
    }
  }

  static getPrintingUpdate(callback: (printing: boolean) => void): Subscription {
    return GenericViewDirective.printingObserver.subscribe(callback);
  }

  protected constructor(protected appService: AppService, protected tabId: CurrentTab) {
    this.isSafari = isSafari();

    this.sanitizedHandCursor = appService.sanitizer.bypassSecurityTrustStyle('url(/assets/resources/hand_cursor.cur), auto');
    this.sanitizedLabelCrosshair = appService.sanitizer.bypassSecurityTrustStyle('url(/assets/resources/label_crosshair.cur), auto');

    this.updatePlanetsToDraw();

    this.throttledRedraw = throttle(() => {
      this.draw();
    }, 100);

    this.debouncedFullRedraw = debounce(() => {
      this.draw(true);
    }, FULL_REDRAW_DELAY);

    this.throttledResize = throttle(() => {
      this.doResize();
    }, 100);

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

    document.addEventListener('scroll-changed', () => {
      this.onResize();
    });
  }

  ngAfterViewInit(): void {
    this.canvasScaling = window.devicePixelRatio || 1;
    this.onResize();

    if ((this.canDrag || this.canTouchZoom) && this.canvas) {
      this.touchGuard = document.createElement('div');

      const style = this.touchGuard.style;

      style.display = 'none';
      style.position = 'absolute';
      style.backgroundColor = 'rgba(128, 128, 128, 0.5)';
      style.top = style.right = style.bottom = style.left = '0';

      this.canvas.parentElement.appendChild(this.touchGuard);
      this.touchGuard.addEventListener('touchstart', (event: TouchEvent) => this.onTouchStartForTouchGuard(event));
    }

    GenericViewDirective.getPrintingUpdate(printing => {
      this.doResize(printing);
    });

    if (this.marqueeRef) {
      this.marquee = this.marqueeRef.nativeElement as HTMLElement;
      this.marquee.addEventListener('click', event => this.marqueeClick(event));
      this.marquee.addEventListener('touchstart', event => this.marqueeTouch(event));
    }
  }

  private marqueeClick(event: MouseEvent): void {
    if (event.detail === 3)
      this.toggleMarqueeMetrics();
    else if (event.detail === 0 || event.detail === undefined)
      this.countMarqueeClicks();
  }

  private marqueeTouch(event: TouchEvent): void {
    if (event.touches.length > 2)
      this.toggleMarqueeMetrics();
    else if (event.touches.length === 1)
      this.countMarqueeClicks();
  }

  private countMarqueeClicks(): void {
    const now = performance.now();

    if (now > this.lastMarqueeClick + 500)
      this.marqueeClickCount = 1;
    else if (++this.marqueeClickCount === 3)
      this.toggleMarqueeMetrics();

    this.lastMarqueeClick = now;
  }

  private toggleMarqueeMetrics(): void {
    const saveBackground = this.marquee.style.backgroundColor;

    this.showMetrics = !this.showMetrics;
    this.marqueeText = '';
    this.clearMouseHighlighting();
    this.marquee.style.backgroundColor = 'cyan';
    setTimeout(() => this.marquee.style.backgroundColor = saveBackground, 500);
  }

  onResize(): void {
    this.marqueeText = '';
    this.throttledResize();
  }

  private doResize(forceFullDraw = false): void {
    if (this.wrapper.clientWidth === 0 || this.wrapper.clientHeight === 0)
      return;

    this.width = this.wrapper.clientWidth;
    this.height = this.wrapper.clientHeight;
    this.canvas.width = ceil(this.width * this.canvasScaling);
    this.canvas.height = ceil(this.height * this.canvasScaling);
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';

    if (this.touchGuard) {
      this.touchGuard.style.width = this.width + 'px';
      this.touchGuard.style.height = this.height + 'px';
    }

    this.draw(forceFullDraw);
  }

  onTouchStart(evt: TouchEvent): void {
    if (this.touchGuard && evt.touches.length > 2) {
      this.touchGuard.style.display = 'block';
      this.goodDragStart = false;
      this.initialZoomSpread = 0;
      this.clearMouseHighlighting();
      this.resetCursor();
      if (evt.cancelable) evt.preventDefault();

      return;
    }

    const pt0 = getXYForTouchEvent(evt);
    const pt = clone(pt0);
    let pt1;

    if (evt.touches.length > 1) {
      pt1 = getXYForTouchEvent(evt, 1);
      pt.x = (pt0.x + pt1.x) / 2;
      pt.y = (pt0.y + pt1.y) / 2;
    }

    this.clickX = this.lastMoveX = pt.x;
    this.clickY = this.lastMoveY = pt.y;

    if (this.canDrag && this.isInsideView()) {
      this.goodDragStart = true;
      this.dragStartTime = performance.now();
      this.draw();
      if (evt.cancelable) evt.preventDefault();

      if (this.canTouchZoom && pt1) {
        const dx = pt1.x - pt0.x;
        const dy = pt1.y - pt0.y;

        this.initialZoomSpread = max(sqrt(dx * dx + dy * dy), 1);
        this.startTouchZoom();
      }
      else
        this.initialZoomSpread = 0;
    }
    else {
      this.goodDragStart = false;
      this.initialZoomSpread = 0;
    }
  }

  protected onTouchStartForTouchGuard(evt: TouchEvent): void {
    if (evt.touches.length > 2) {
      this.touchGuard.style.display = 'none';
      if (evt.cancelable) evt.preventDefault();
    }
  }

  onMouseDown(event: MouseEvent): void {
    this.clickX = this.lastMoveX = event.offsetX;
    this.clickY = this.lastMoveY = event.offsetY;
    this.goodDragStart = this.canDrag && this.isInsideView();
  }

  onTouchMove(evt: TouchEvent): void {
    const notAFlick = performance.now() > this.dragStartTime + FLICK_REJECTION_THRESHOLD;
    const pt0 = getXYForTouchEvent(evt);
    const pt = clone(pt0);
    let pt1;

    if (evt.touches.length > 1) {
      pt1 = getXYForTouchEvent(evt, 1);
      pt.x = (pt0.x + pt1.x) / 2;
      pt.y = (pt0.y + pt1.y) / 2;
    }

    if (this.goodDragStart && notAFlick && evt.touches.length === 1 || this.canTouchZoom)
      this.handleMouseMove(pt.x, pt.y, true);

    if (this.initialZoomSpread) {
      if (pt1) {
        const dx = pt1.x - pt0.x;
        const dy = pt1.y - pt0.y;
        const newSpread = max(sqrt(dx * dx + dy * dy), 1);
        const zoomRatio = newSpread / this.initialZoomSpread;

        this.touchZoom(zoomRatio);
      }
      else
        this.initialZoomSpread = 0;
    }

    if (this.isInsideView() && notAFlick && evt.cancelable)
      evt.preventDefault();
  }

  protected startTouchZoom(): void {
  }

  protected touchZoom(_zoomRatio: number): void {
  }

  onMouseMove(event: MouseEvent): void {
    if (this.goodDragStart || !this.dragging) // noinspection JSDeprecatedSymbols (for `which`)
      this.handleMouseMove(event.offsetX, event.offsetY, !!((event.buttons & 0x01) || (this.isSafari && (event.which & 0x01))));
  }

  protected handleMouseMove(x: number, y: number, button1Down: boolean): void {
    this.lastMoveX = x;
    this.lastMoveY = y;

    let justCleared = false;

    if (!this.isInsideView()) {
      this.clearMouseHighlighting();
      justCleared = true;
      this.resetCursor();
      this.goodDragStart = false;
    }
    else if (this.canDrag && this.goodDragStart && button1Down) {
      this.dragging = true;
      this.cursor = this.sanitizedHandCursor;
    }
    else {
      this.dragging = false;
      this.resetCursor();
    }

    if (!this.dragging || justCleared)
      this.throttledRedraw();
  }

  protected clearMouseHighlighting(): void {
    this.lastMoveX = this.lastMoveY = -1;
  }

  onTouchEnd(evt: TouchEvent): void {
    if (evt.touches.length < 2)
      this.initialZoomSpread = 0;

    if (evt.touches.length === 1)
      this.onTouchStart(evt);
    else if (evt.touches.length === 0) {
      this.dragging = false;
      this.goodDragStart = false;
      if (evt.cancelable) evt.preventDefault();
    }
  }

  onMouseUp(event: MouseEvent): void {
    this.lastMoveX = event.offsetX;
    this.lastMoveY = event.offsetY;
    this.dragging = false;
    this.goodDragStart = false;
    this.resetCursor();
  }

  protected scaledRound(x: number): number {
    return round(x * this.canvasScaling) / this.canvasScaling;
  }

  protected draw(forceFullDraw = false): void {
    if (this.tabId !== this.appService.currentTab)
      return;

    const startTime = performance.now();
    const dc = {} as DrawingContext;

    dc.w = this.width;
    dc.h = this.height;

    if (!this.canvas || dc.w < 0 || dc.h < 0)
      return;

    if (startTime > this.lastSlowFrameTime + SLOW_FRAME_COUNT_RESET_TIME)
      this.slowFrameCount = 0;

    dc.fullDraw = (forceFullDraw || GenericViewDirective.printing || this.slowFrameCount < MAX_SLOW_FRAMES);

    if (this.lastWidth !== dc.w || this.lastHeight !== dc.h) {
      this.canvas.width = ceil(dc.w * this.canvasScaling);
      this.canvas.height = ceil(dc.h * this.canvasScaling);
      this.lastWidth = dc.w;
      this.lastHeight = dc.h;
    }

    dc.context = this.canvas.getContext('2d');
    dc.context.setTransform(this.canvasScaling, 0, 0, this.canvasScaling, 0, 0);
    dc.largeLabelFm = getFontMetrics(this.largeLabelFont);
    dc.mediumLabelFm = getFontMetrics(this.mediumLabelFont);
    dc.smallLabelFm = getFontMetrics(this.smallLabelFont);
    dc.sc = this.appService.starCatalog;
    dc.ss = this.appService.solarSystem;
    dc.skyObserver = new SkyObserver(this.appService.longitude, this.appService.latitude);
    // Bias time half a minute ahead of the clock time for rounding to the middle of the selected minute.
    dc.jdu = DateTime.julianDay(this.time) + HALF_MINUTE;
    dc.jde = utToTdt(dc.jdu);
    dc.inkSaver = GenericViewDirective.printing && this.appService.inkSaver;

    this.additionalDrawingSetup(dc);
    this.drawView(dc);
    this.additionalDrawingSteps(dc);

    this.lastDrawingContext = dc;

    const now = performance.now();
    const drawingTime = now - startTime;

    if (dc.fullDraw) {
      this.lastFullDrawTime = max(drawingTime, 1);

      if (forceFullDraw)
        this.slowFrameCount = 0;

      if (this.lastFullDrawTime > SLOW_DRAWING_THRESHOLD) {
        ++this.slowFrameCount;
        this.lastSlowFrameTime = now;
      }
    }
    else {
      this.debouncedFullRedraw();
      this.lastSlowFrameTime = now;
    }

    if (this.showMetrics) {
      const interval = max(startTime - this.lastDrawStart, 1);

      this.marqueeText = padLeft(drawingTime.toFixed(1), 6, '\u2007') + (dc.fullDraw ? 'F' : 'Q') + ', ' +
        padLeft(interval.toFixed(1), 6, '\u2007');

      if (!dc.fullDraw)
        this.marqueeText += ', ' + padLeft(this.lastFullDrawTime.toFixed(1), 6, '\u2007') + 'F';
    }

    this.lastDrawStart = startTime;
  }

  protected additionalDrawingSetup(_dc: DrawingContext): void {
  }

  protected additionalDrawingSteps(_dc: DrawingContext): void {
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
  protected withinPlot(_x: number, _y: number, _dc?: DrawingContext): boolean {
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
      if (this.excludedPlanets.indexOf(i) < 0)
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

    if (isString(this.additional)) {
      const id = this.appService.solarSystem.getPlanetByName(this.additional);

      if (id !== NO_MATCH)
        this.planetsToDraw.push(id);
    }
  }
}

GenericViewDirective.initialize();
