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

import { DrawingContextPlanetary, GenericPlanetaryView, LABEL_TYPE, SELECTION_TYPE, SUBJECT } from '../generic-planetary-view';
import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { floor, log10, max, min, PI, Point, pow, round, sin_deg, sqrt } from 'ks-math';
import { AppService, CurrentTab, UserSetting } from '../../app.service';
import {
  AS_SEEN_FROM_SUN, AVG_SUN_MOON_RADIUS, DataQuality, JUPITER, JUPITER_FLATTENING, JupiterInfo, JupitersMoons, MOON_SHADOW, MoonInfo,
  NAUTICAL_TWILIGHT, PlanetaryMoons, REFRACTION_AT_HORIZON, SATURN, SATURN_FLATTENING, SaturnMoons, SUN
} from 'ks-astronomy';
import * as _ from 'lodash';
import { JupiterDrawer } from '../jupiter-drawer';
import { SaturnDrawer } from '../saturn-drawer';
import { AstroDataService } from '../../astronomy/astro-data.service';
import { HttpClient } from '@angular/common/http';
import { PlanetDrawer } from '../planet-drawer';
import { extendDelimited, fillEllipse, getFontMetrics, padLeft, strokeEllipse } from 'ks-util';

export const  VIEW_MOONS = 'moons';
export const    PROPERTY_NORTH_ON_TOP = 'north_on_top';
export const    PROPERTY_EAST_ON_LEFT = 'east_on_left';
export const    PROPERTY_MOON_NUMBERS = 'moon_numbers';
export const    PROPERTY_MOON_NAMES = 'moon_names';
export const    PROPERTY_PHOTOGRAPHIC_PLANETS = 'photo_planets';
export const    PROPERTY_MARK_GRS = 'mark_grs';
export const    PROPERTY_GRS_OVERRIDE = 'grs_override';
export const    PROPERTY_FIXED_GRS = 'fixed_grs';
export const    PROPERTY_ZOOM = 'zoom';

export const DEFAULT_ZOOM = 1.0;
export const ZOOM_STEPS   = 200;
export const DEFAULT_FIXED_GRS = -97.0;
const MIN_ZOOM     = 0.25;
const MAX_ZOOM     = 2.5;

const LOG_MIN_ZOOM   = log10(MIN_ZOOM);
const LOG_MAX_ZOOM   = log10(MAX_ZOOM);
const ZOOM_LOG_RANGE = LOG_MAX_ZOOM - LOG_MIN_ZOOM;

const SUBVIEW_GAP = 4;
const MESSAGE_INSET = 3;

const basicMessageColor      = '#66FF66';
const basicMessagePrintColor = '#009966';
const jupiterColor           = '#C4AF9F';
const grsMarkerColor         = '#FF00FF';
const grsOutlineColor        = '#0066FF';
const saturnColor            = '#DCCFB2';
const ringColor              = '#DDDDDD';
const warningColor           = '#FFFF00';
const warningPrintColor      = '#CCCC00';
const overrideColor          = '#FF00FF';
const errorColor             = '#FF3366';
const moonOutlineColor       = 'rgba(153, 153, 153, 0.5)';

@Component({
  selector: 'svc-moons-view',
  templateUrl: './svc-moons-view.component.html',
  styleUrls: ['./svc-moons-view.component.scss']
})
export class SvcMoonsViewComponent extends GenericPlanetaryView implements AfterViewInit {
  private jupiterDrawer: JupiterDrawer;
  private jupiterInfo: JupiterInfo;
  private jupiterMoons = new JupitersMoons();
  private saturnDrawer: SaturnDrawer;
  private saturnMoons = new SaturnMoons();

  private northOnTop = true;
  private eastOnLeft = true;
  private moonNumbers = true;
  private moonNames = false;
  private photoPlanets = true;
  private markGrs = false;
  private grsOverride = false;
  private fixedGrs = DEFAULT_FIXED_GRS;
  private zoom = SvcMoonsViewComponent.zoomToZoomSteps(DEFAULT_ZOOM);
  private initialZoomScale: number;

  @ViewChild('canvasWrapper') private wrapperRef: ElementRef;
  @ViewChild('orbitCanvas') private canvasRef: ElementRef;

  constructor(appService: AppService, private astroDataService: AstroDataService, private httpClient: HttpClient) {
    super(appService, CurrentTab.MOONS_GRS);

    this.canTouchZoom = true;

    appService.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_MOONS && setting.source !== this) {
        if (setting.property === PROPERTY_NORTH_ON_TOP)
          this.northOnTop = <boolean> setting.value;
        else if (setting.property === PROPERTY_EAST_ON_LEFT)
          this.eastOnLeft = <boolean> setting.value;
        else if (setting.property === PROPERTY_MOON_NUMBERS)
          this.moonNumbers = <boolean> setting.value;
        else if (setting.property === PROPERTY_MOON_NAMES)
          this.moonNames = <boolean> setting.value;
        else if (setting.property === PROPERTY_PHOTOGRAPHIC_PLANETS)
          this.photoPlanets = <boolean> setting.value;
        else if (setting.property === PROPERTY_MARK_GRS)
          this.markGrs = <boolean> setting.value;
        else if (setting.property === PROPERTY_GRS_OVERRIDE)
          this.grsOverride = <boolean> setting.value;
        else if (setting.property === PROPERTY_FIXED_GRS)
          this.fixedGrs = <number> setting.value;
        else if (setting.property === PROPERTY_ZOOM)
          this.zoom = <number> setting.value;

        this.throttledRedraw();
      }
    });
  }

  ngAfterViewInit(): void {
    this.wrapper = this.wrapperRef.nativeElement;
    this.canvas = this.canvasRef.nativeElement;

    JupiterDrawer.getJupiterDrawer(this.astroDataService, this.httpClient).then((drawer: JupiterDrawer) => {
      this.jupiterDrawer = drawer;
      this.jupiterInfo = this.jupiterDrawer.getJupiterInfo();
      this.throttledRedraw();
    });

    SaturnDrawer.getSaturnDrawer().then((drawer: SaturnDrawer) => {
      this.saturnDrawer = drawer;
      this.throttledRedraw();
    });

    setTimeout(() => this.appService.requestViewSettings(VIEW_MOONS));

    super.ngAfterViewInit();
  }

  protected drawView(dc: DrawingContextPlanetary): void {
    const jupiterAreaHeight = floor((dc.h - SUBVIEW_GAP) / 3);
    const saturnAreaHeight = dc.h - jupiterAreaHeight - SUBVIEW_GAP;
    const altSun = dc.ss.getHorizontalPosition(SUN, dc.jdu, dc.skyObserver).altitude.degrees;

    dc.context.fillStyle = (dc.inkSaver ? 'gray' : 'white');
    dc.context.fillRect(0, jupiterAreaHeight, dc.w, SUBVIEW_GAP);

    this.drawPlanetAndMoons(dc, dc.w, jupiterAreaHeight, 0,
      JUPITER, 'Moons of Jupiter, Great Red Spot', this.jupiterMoons,
      true, true, 28.0, 2.0, jupiterColor, JUPITER_FLATTENING, altSun);

    this.drawPlanetAndMoons(dc, dc.w, saturnAreaHeight, jupiterAreaHeight + SUBVIEW_GAP,
      SATURN, 'Moons of Saturn', this.saturnMoons,
      false, false, 29.0, 13.0, saturnColor, SATURN_FLATTENING, altSun);
  }

  private drawPlanetAndMoons(dc: DrawingContextPlanetary, width: number, height: number, yOffset: number,
                             planet: number, title: string, planetaryMoons: PlanetaryMoons,
                             doShadows: boolean, showTransitInfo: boolean,
                             baseRadiusWidth: number, baseRadiusHeight: number, planetColor: string, flattening: number, altSun: number): void {
    const ctx = dc.context;

    if (planet === JUPITER && this.jupiterInfo) {
      if (this.grsOverride)
        this.jupiterInfo.setFixedGRSLongitude(this.fixedGrs);
      else
        this.jupiterInfo.clearFixedGRSLongitude();
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, yOffset, width, height);
    ctx.clip();
    ctx.font = this.mediumLabelFont;

    const fm = getFontMetrics(this.mediumLabelFont);
    const ascent = fm.ascent;
    const lineHeight = fm.lineHeight;
    const textHeight = lineHeight * (showTransitInfo ? 4 : 1) + MESSAGE_INSET;
    const xctr = width / 2;
    const yctr = round((height - textHeight) / 2) + yOffset;
    const xsign = (this.eastOnLeft ? 1 : -1);
    const ysign = (this.northOnTop ? 1 : -1);
    const flipHorizontal = (xsign < 0);
    const flipVertical = (ysign < 0);
    const scale = pow(10.0, LOG_MIN_ZOOM + ZOOM_LOG_RANGE * this.zoom / ZOOM_STEPS);
    let discWidth = width / baseRadiusWidth / scale;

    discWidth = min(discWidth, (height - textHeight) / baseRadiusHeight / scale);
    discWidth = min(discWidth, height - textHeight - MESSAGE_INSET * 2);

    const radius = discWidth / 2.0;
    const discHeight = discWidth / flattening;

    const moons = planetaryMoons.getMoonPositions(dc.jde);
    let smoons: MoonInfo[];

    moons.sort((a: MoonInfo, b: MoonInfo) => b.Z - a.Z);

    if (doShadows)
      smoons = planetaryMoons.getMoonPositions(dc.jde, AS_SEEN_FROM_SUN);

    let pos: MoonInfo = null;
    let sunPos: MoonInfo = null;
    let planetShown = false;
    let colorOfMoon: string = null;
    const pt = <Point> {};
    let number = '', name = '', longName = '';
    let transitNames = '';
    let offscreenNames = '';
    let eclipsedNames = '';
    let occultedNames = '';
    let drawMoon = true;
    let hidden = false;
    const altPlanet = dc.ss.getHorizontalPosition(planet, dc.jdu, dc.skyObserver).altitude.degrees;
    let warning = '';
    const planetDrawer: PlanetDrawer = (planet === JUPITER ? this.jupiterDrawer : this.saturnDrawer);

    ctx.fillStyle = (dc.inkSaver ? 'white' : 'black');
    ctx.fillRect(0, yOffset, width, height);

    ctx.fillStyle = (dc.inkSaver ? basicMessagePrintColor : basicMessageColor);
    ctx.fillText(title, MESSAGE_INSET, yOffset + ascent + MESSAGE_INSET);

    if (altPlanet < -REFRACTION_AT_HORIZON)
      warning = '(' + dc.ss.getPlanetName(planet) + ' is below the horizon)';
    else if (altSun > -REFRACTION_AT_HORIZON - AVG_SUN_MOON_RADIUS)
      warning = '(Daylight)';
    else if (altSun > NAUTICAL_TWILIGHT)
      warning = '(Twilight)';
    else if (altPlanet < 2.0)
      warning = '(' + dc.ss.getPlanetName(planet) + ' is near the horizon)';

    if (warning != null)
      ctx.fillText(warning, width - MESSAGE_INSET - ctx.measureText(warning).width, yOffset + ascent + MESSAGE_INSET);

    ctx.fillStyle = (dc.inkSaver ? 'black' : 'white');

    for (let i = 0; i <= moons.length; ++i) {
      if (i < moons.length) {
        pos = moons[i];
        number = PlanetaryMoons.getMoonNumber(pos.moonIndex);
        name = PlanetaryMoons.getMoonName(pos.moonIndex);
        longName = name + ' (' + number + ')';
        drawMoon = true;
        hidden = false;

        if (doShadows)
          sunPos = _.find(smoons, (smoon: MoonInfo) => smoon.moonIndex === pos.moonIndex);

        if (pos.behindDisc) {
          occultedNames = extendDelimited(occultedNames, longName);
          drawMoon = false;
          hidden = true;
        }
        else if (sunPos != null && sunPos.behindDisc) {
          eclipsedNames = extendDelimited(eclipsedNames, longName);
          colorOfMoon = (dc.inkSaver ? 'lightGray' : 'gray');
          hidden = true;
        }
        else {
          colorOfMoon = (dc.inkSaver ? 'black' : 'white');

          if (pos.inFrontOfDisc)
            transitNames = extendDelimited(transitNames, longName);
        }
      }
      else if (planetShown)
        break;

      if (!planetShown && (i === moons.length || pos.inferior)) {
        if (this.photoPlanets && planetDrawer)
          planetDrawer.draw(ctx, dc.jde, xctr, yctr, discWidth, flipHorizontal, flipVertical);
        else {
          ctx.fillStyle = planetColor;
          fillEllipse(ctx, xctr + 0.5, yctr + 0.5, floor(radius), floor(discHeight / 2));
        }

        planetShown = true;

        if (planet === SATURN) {
          const ri = dc.ss.getSaturnRingInfo(dc.jde);
          const angularDiameter = dc.ss.getAngularDiameter(SATURN, dc.jde);
          const ringWidth = discWidth  * ri.a / angularDiameter;
          const ringHeight = discWidth * ri.b / angularDiameter;

          // Mask off either the top or bottom half of the planet image to create the appearance
          // of a portion of the rings disappearing behind the planet.
          const rx = floor(radius);
          const ry = floor(discHeight / 2);

          ctx.save();
          ctx.beginPath();
          ctx.rect(0, yOffset, width, height);
          ctx.translate(xctr + 0.5 - rx, yctr + 0.5 - ry);
          ctx.scale(rx, ry);

          if (ri.B * ysign < 0) {
            ctx.arc(1, 1, 1, PI, 0, true);
            ctx.lineTo(0, 1);
          }
          else {
            ctx.arc(1, 1, 1, 0, PI, true);
            ctx.lineTo(2, 1);
          }

          ctx.restore();
          ctx.save();
          ctx.clip();

          ctx.fillStyle = ringColor;
          ctx.strokeStyle = ringColor;
          this.drawRing(ctx, xctr, yctr, ringWidth, ringHeight, 1.0000, 0, 0.8801, 2); // Outer ring
          this.drawRing(ctx, xctr, yctr, ringWidth, ringHeight, 0.8599, -2, 0.6650, 0); // Inner ring
          ctx.restore();
        }

        if (i === moons.length)
          break;

        if (doShadows) {
          ctx.fillStyle = (dc.inkSaver ? 'gray' : 'black');

          for (let j = 0; j < moons.length; ++j) {
            sunPos = smoons[j];

            if (sunPos.inFrontOfDisc) {
              pt.x = xctr + xsign * round(sunPos.X * radius);
              pt.y = yctr - ysign * round(sunPos.Y * radius);

              this.qualifyBodyForSelection(pt, SELECTION_TYPE.MOON_SHADOW, sunPos.moonIndex, true, dc);

              ctx.fillRect(pt.x - 1, pt.y - 1, 3, 3);

              transitNames = extendDelimited(transitNames,
                PlanetaryMoons.getMoonName(sunPos.moonIndex, MOON_SHADOW) +
                  ' (' + PlanetaryMoons.getMoonNumber(sunPos.moonIndex) + ')');
            }
          }
        }
      }

      if (drawMoon) {
        ctx.fillStyle = colorOfMoon;
        pt.x = xctr + xsign * round(pos.X * radius);
        pt.y = yctr - ysign * round(pos.Y * radius);

        const onScreen = (0 < pt.x && pt.x < width - 1 && yOffset < pt.y && pt.y < yOffset + height - 1);

        if (onScreen) {
          ctx.fillRect(pt.x - 1, pt.y - 1, 3, 3);
          ctx.strokeStyle = moonOutlineColor;
          ctx.lineWidth = 1;
          strokeEllipse(ctx, pt.x + 0.5, pt.y + 0.5, 2, 2);

          this.qualifyBodyForSelection(pt, SELECTION_TYPE.MOON, pos.moonIndex, true, dc);

          if (this.moonNumbers || this.moonNames) {
            if (this.moonNumbers && this.moonNames)
              name = longName;
            else if (this.moonNumbers)
              name = number;

            const li = {name: name, pt: pt, labelType: hidden ? LABEL_TYPE.HIDDEN_MOON : LABEL_TYPE.MOON, bodyIndex: pos.moonIndex};
            this.addLabel(li, dc);
          }
        }
        else
          offscreenNames = extendDelimited(offscreenNames, longName);
      }
    }

    if (planet === JUPITER && this.jupiterInfo) {
      const grsCMOffset = this.jupiterInfo.getGRSCMOffset(dc.jde).degrees;

      if (-90.0 <= grsCMOffset && grsCMOffset <= 90.0) {
        transitNames = extendDelimited(transitNames, 'GRS');

        if (this.markGrs) {
          const grsLat = this.jupiterDrawer.getGrsLatitude();
          const dy = sin_deg(grsLat);
          const dxm = sqrt(1.0 - dy * dy);
          const dx = sin_deg(grsCMOffset);
          const grsY = round(yctr - ysign * dy * discHeight / 2.0);
          const grsX = round(xctr + xsign * dx * dxm * discWidth / 2.0);

          ctx.fillStyle = grsOutlineColor;
          ctx.fillRect(grsX - 1, grsY - 4, 3, 9);
          ctx.fillRect(grsX - 4, grsY - 1, 9, 3);
          ctx.fillStyle = grsMarkerColor;
          ctx.fillRect(grsX - 1, grsY - 1, 3, 3);
          ctx.fillRect(grsX, grsY - 3, 1, 7);
          ctx.fillRect(grsX - 3, grsY, 7, 1);
        }
      }
    }

    ctx.fillStyle = (dc.inkSaver ? basicMessagePrintColor : basicMessageColor);

    const transitLabel   = 'In transit: ';
    const eclipsedLabel  = 'Eclipsed: ';
    const occultedLabel  = 'Occulted: ';
    const offscreenLabel = 'Off screen: ';
    const transitWidth   = ctx.measureText(transitLabel).width;
    const eclipsedWidth  = ctx.measureText(eclipsedLabel).width;
    const occultedWidth  = ctx.measureText(occultedLabel).width;
    const offscreenWidth = ctx.measureText(offscreenLabel).width;
    const maxWidth = max(transitWidth, eclipsedWidth, occultedWidth, offscreenWidth);

    if (showTransitInfo) {
      ctx.fillText(transitLabel  + transitNames,  MESSAGE_INSET + maxWidth - transitWidth,
        yOffset + height - lineHeight * 4 + ascent - MESSAGE_INSET);
      ctx.fillText(eclipsedLabel + eclipsedNames, MESSAGE_INSET + maxWidth - eclipsedWidth,
        yOffset + height - lineHeight * 3 + ascent - MESSAGE_INSET);
      ctx.fillText(occultedLabel + occultedNames, MESSAGE_INSET + maxWidth - occultedWidth,
        yOffset + height - lineHeight * 2 + ascent - MESSAGE_INSET);
    }

    if (offscreenNames)
      ctx.fillText(offscreenLabel + offscreenNames, MESSAGE_INSET + maxWidth - offscreenWidth,
        yOffset + height - lineHeight + ascent - MESSAGE_INSET);

    if (planet === JUPITER && this.jupiterInfo) {
      const sys1      = this.jupiterInfo.getSystemILongitude(dc.jde).degrees;
      const sys2      = this.jupiterInfo.getSystemIILongitude(dc.jde).degrees;
      const grs       = this.jupiterInfo.getGRSLongitude(dc.jde).degrees;
      const grsOffset = this.jupiterInfo.getGRSCMOffset(dc.jde).degrees;
      const sys1Text      = padLeft(sys1.toFixed(1), 6) + '\u00B0 '; // degree sign
      const sys2Text      = padLeft(sys2.toFixed(1), 6) + '\u00B0 ';
      const grsText       = padLeft(grs.toFixed(1), 6) + '\u00B0 ';
      const grsOffsetText = padLeft(grsOffset.toFixed(1), 6) + '\u00B0 ';
      const sys1Label      = 'Central meridian (Sys I): ';
      const sys2Label      = 'Central meridian (Sys II): ';
      const grsLabel       = (this.jupiterInfo.getFixedGRSLongitude() ?
                              'Set GRS longitude (Sys II): ' : 'Est. GRS longitude (Sys II): ');
      const grsOffsetLabel = 'GRS central meridian offset: ';
      let sys1Width       = ctx.measureText(sys1Label).width;
      let sys2Width       = ctx.measureText(sys2Label).width;
      let grsWidth        = ctx.measureText(grsLabel).width;
      let grsOffsetWidth  = ctx.measureText(grsOffsetLabel).width;
      const extraRightInset = ctx.measureText('-999.9\u00B0 ').width;
      const grsQuality = JupiterInfo.grsDataQuality(dc.jdu);

      ctx.fillText(sys1Label,      width - MESSAGE_INSET - extraRightInset - sys1Width,
        yOffset + height - lineHeight * 4 + ascent - MESSAGE_INSET);
      ctx.fillText(sys2Label,      width - MESSAGE_INSET - extraRightInset - sys2Width,
        yOffset + height - lineHeight * 3 + ascent - MESSAGE_INSET);
      ctx.fillText(grsLabel,       width - MESSAGE_INSET - extraRightInset - grsWidth,
        yOffset + height - lineHeight * 2 + ascent - MESSAGE_INSET);
      ctx.fillText(grsOffsetLabel, width - MESSAGE_INSET - extraRightInset - grsOffsetWidth,
        yOffset + height - lineHeight     + ascent - MESSAGE_INSET);

      sys1Width      = ctx.measureText(sys1Text).width;
      sys2Width      = ctx.measureText(sys2Text).width;
      grsWidth       = ctx.measureText(grsText).width;
      grsOffsetWidth = ctx.measureText(grsOffsetText).width;

      ctx.fillText(sys1Text,      width - MESSAGE_INSET - sys1Width,
        yOffset + height - lineHeight * 4 + ascent - MESSAGE_INSET);
      ctx.fillText(sys2Text,      width - MESSAGE_INSET - sys2Width,
        yOffset + height - lineHeight * 3 + ascent - MESSAGE_INSET);

      if      (this.grsOverride)
        ctx.fillStyle = overrideColor;
      else if (grsQuality === DataQuality.POOR)
        ctx.fillStyle = errorColor;
      else if (grsQuality === DataQuality.FAIR)
        ctx.fillStyle = (dc.inkSaver ? warningPrintColor : warningColor);

      ctx.fillText(grsText,       width - MESSAGE_INSET - grsWidth,
        yOffset + height - lineHeight * 2 + ascent - MESSAGE_INSET);
      ctx.fillText(grsOffsetText, width - MESSAGE_INSET - grsOffsetWidth,
        yOffset + height - lineHeight     + ascent - MESSAGE_INSET);
    }

    ctx.restore();
  }

  // noinspection JSMethodCanBeStatic
  protected drawRing(ctx: CanvasRenderingContext2D, xctr: number, yctr: number, ringWidth: number, ringHeight: number,
    outside: number, outerAdj: number, inside: number, innerAdj: number): void {
    for (let a = outside * ringWidth + outerAdj; a >= inside * ringWidth + innerAdj; a -= 0.5) {
      const b = max(round(a * ringHeight / ringWidth), 1);

      if (b > 2)
        strokeEllipse(ctx, xctr, yctr, a / 2, b / 2);
      else
        ctx.fillRect(xctr - round(a / 2.0), yctr - b / 2, round(a), b);
    }
  }

  // noinspection JSUnusedGlobalSymbols
  onWheel(event: WheelEvent): void {
    const oldZoom = this.zoom;
    let zoomDelta = (event as any).wheelDeltaY;

    if (zoomDelta === undefined)
      zoomDelta = event.deltaY / 5;
    else
      zoomDelta /= 120;

    if (zoomDelta < 0 && zoomDelta > -1)
      zoomDelta = -1;
    else if (zoomDelta > 0 && zoomDelta < 1)
      zoomDelta = 1;

    this.zoom = min(max(this.zoom + round(zoomDelta), 0), ZOOM_STEPS);

    if (this.zoom !== oldZoom) {
      this.throttledRedraw();
      this.appService.updateUserSetting({view: VIEW_MOONS, property: PROPERTY_ZOOM, value: this.zoom, source: this});
    }

    event.preventDefault();
  }

  protected startTouchZoom(): void {
    this.initialZoomScale = pow(10.0, LOG_MIN_ZOOM + ZOOM_LOG_RANGE * this.zoom / ZOOM_STEPS);
  }

  protected touchZoom(zoomRatio: number): void {
    const oldZoom = this.zoom;
    const scale = this.initialZoomScale / zoomRatio;
    const newZoom = ZOOM_STEPS * (log10(scale) - LOG_MIN_ZOOM) / ZOOM_LOG_RANGE;

    this.zoom = min(max(newZoom, 0), ZOOM_STEPS);

    if (this.zoom !== oldZoom) {
      this.throttledRedraw();
      this.appService.updateUserSetting({view: VIEW_MOONS, property: PROPERTY_ZOOM, value: this.zoom, source: this});
    }
  }

  protected drawSkyPlotLine(pt1: Point, pt2: Point, dc: DrawingContextPlanetary, subject: SUBJECT): boolean {
    return false;
  }

  protected isInsideView(): boolean {
    if (!this.lastDrawingContext)
      return false;

    return this.withinPlot(this.lastMoveX, this.lastMoveY, <DrawingContextPlanetary> this.lastDrawingContext);
  }

  protected withinPlot(x: number, y: number, dc?: DrawingContextPlanetary): boolean {
    if (!dc)
      return false;

    return (0 <= x && x < this.width &&
            0 <= y && y < this.height);
  }

  public static zoomToZoomSteps(zoom: number): number {
    return min(max(0, round((log10(zoom) - LOG_MIN_ZOOM) / ZOOM_LOG_RANGE * ZOOM_STEPS)), ZOOM_STEPS);
  }
}
