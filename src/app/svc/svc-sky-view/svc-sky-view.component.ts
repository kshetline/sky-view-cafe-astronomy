/*
  Copyright © 2017-2018 Kerry Shetline, kerry@shetline.com.

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

import {
  eclipticColor, eclipticGridColor, eclipticGridPrintColor, eclipticPrintColor, equatorColor, equatorialGridColor,
  equatorialGridPrintColor, equatorPrintColor, GenericSkyView, moonPathColor, sunPathColor
} from '../generic-sky-view';
import {
  asteroidColor, cometColor, DrawingContextPlanetary, FAR_AWAY, LabelInfo, MARQUEE_EQUATORIAL, MARQUEE_HORIZONTAL, MARQUEE_ILLUMINATION,
  MARQUEE_MAGNITUDE, MARQUEE_SIZE, NONPLANET, OUTER_LABEL_GAP, planetColors, planetPrintColors,
  SUBJECT
} from '../generic-planetary-view';
import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { AppService, CurrentTab, PROPERTY_NORTH_AZIMUTH, UserSetting, VIEW_APP } from '../../app.service';
import {
  AVG_SUN_MOON_RADIUS, equatorialToGalactic, getSkyColor, LOW_PRECISION, MOON, NO_SELECTION, QUICK_SUN, refractedAltitude,
  REFRACTION, REFRACTION_AT_HORIZON, SolarSystem, SUN, TOPOCENTRIC
} from 'ks-astronomy';
import {
  abs, Angle, asin_deg, atan2_deg, ceil, cos, cos_deg, floor, interpolate, limitNeg1to1, max, min, mod, mod2, PI, Point, round, sin,
  sin_deg, SphericalPosition, SphericalPosition3D, sqrt, tan, tan_deg, TWO_PI, Unit
} from 'ks-math';
import { colorFromRGB, drawOutlinedText, padLeft, parseColor, replaceAlpha, strokeLine } from 'ks-util';
import { DAY_MINUTES } from 'ks-date-time-zone';
import { MoonDrawer } from '../moon-drawer';
import { MilkyWay } from '../milky-way';
import { ADDITIONALS, PROPERTY_ADDITIONALS } from '../generic-view';

export const  VIEW_SKY = 'sky';
export const    PROPERTY_VIEW_TYPE = 'view_type';
export enum       VIEW_TYPE {FULL_SKY_FLAT , FULL_SKY_DOME,
                             HORIZON_45, HORIZON_90, HORIZON_120, HORIZON_TO_ZENITH,
                             ZENITH_100,
                             MOON_CLOSEUP_1, MOON_CLOSEUP_4, MOON_CLOSEUP_8, MOON_CLOSEUP_16,
                             SUN_CLOSEUP_1, SUN_CLOSEUP_4, SUN_CLOSEUP_8, SUN_CLOSEUP_16}
export const    PROPERTY_SKY_COLOR = 'sky_color';
export enum       SKY_COLOR {BLACK, BASIC, MULTI}
export const    PROPERTY_REFRACTION = 'refraction';
export const    PROPERTY_CELESTIAL_GRID = 'celestial_grid';
export const    PROPERTY_ECLIPTIC_GRID = 'ecliptic_grid';
export const    PROPERTY_PATH_OF_SUN = 'sun_path';
export const    PROPERTY_PATH_OF_MOON = 'moon_path';
export const    PROPERTY_BRIGHTEN_STARS = 'brighten_stars';
export const    PROPERTY_SHOW_CONSTELLATIONS = 'show_constellations';
export const    PROPERTY_ENLARGE_SUN_MOON = 'enlarge_sun_moon';
export const    PROPERTY_SHOW_MILKY_WAY = 'show_milky_way';
export const    PROPERTY_LABEL_PLANETS = 'label_planets';
export const    PROPERTY_LABEL_BRIGHT_STARS = 'label_bright_stars';
export const    PROPERTY_LABEL_STARS = 'label_stars';
export const    PROPERTY_LABEL_CONSTELLATIONS = 'label_constellations';
export const    PROPERTY_LABEL_DSOS = 'label_dsos';
export const    PROPERTY_FACING = 'facing';
export const    PROPERTY_TRACK_SUN = 'track_sun';
export const    PROPERTY_PARALLEL_TO_ECLIPTIC = 'parallel_to_ecliptic';

enum VIEW_MODE {FULL_SKY, HORIZON, ZENITH, MOON_CLOSEUP, SUN_CLOSEUP}

const COMPASS_POINTS = ['S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
                        'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE'];

interface GridLabel {
  pt: Point;
  text: string;
  color: string;
  background: string;
}

interface DrawingContextSky extends DrawingContextPlanetary {
  parallacticAngle: Angle;
  plotHeight: number;
  plotWidth: number;
  trackingAltitude: number;
  trackingPos: SphericalPosition;
  x_br: number;
  x_ul: number;
  y_br: number;
  y_ul: number;
  gridLabels: GridLabel[];
  groundColor?: string;
  skyColor?: string;
  sunPos?: SphericalPosition;
  totality?: number;
}

const MARK_GAP = 3;
const MARK_LENGTH = 5;
const MESSAGE_INSET = 3;

@Component({
  selector: 'svc-sky-view',
  templateUrl: './svc-sky-view.component.html',
  styleUrls: ['./svc-sky-view.component.scss']
})
export class SvcSkyViewComponent extends GenericSkyView implements AfterViewInit {
  private _facing = 0;
  private refraction = true;
  private _parallelToEcliptic = false;
  private _trackSun = false;
  private _viewType = VIEW_TYPE.FULL_SKY_FLAT;
  private dragStartFacing: number;
  private lastFullSkyType = VIEW_TYPE.FULL_SKY_FLAT;
  private lastHorizonType = VIEW_TYPE.HORIZON_45;
  private lastMoonType = VIEW_TYPE.MOON_CLOSEUP_4;
  private lastSunType = VIEW_TYPE.SUN_CLOSEUP_4;
  private milkyWay: MilkyWay;
  private minAlt = -0.00833; // half arc-minute
  private showCelestialGrid = false;
  private showEclipticGrid = false;
  private showMilkyWay = false;
  private showPathOfSun = false;
  private showPathOfMoon = false;
  private skyColor = SKY_COLOR.MULTI;
  private viewHeight = 90.0;
  private viewMode = VIEW_MODE.FULL_SKY;
  private viewWidth = 180.0;
  private moonDrawer: MoonDrawer;

  public facingOrigin = 'W of S';
  public trackingPlanet = NO_SELECTION;

  @ViewChild('canvasWrapper') private wrapperRef: ElementRef;
  @ViewChild('skyCanvas') private canvasRef: ElementRef;
  @ViewChild('marquee', {read: ElementRef}) private marqueeRef: ElementRef;

  private readonly gridFont  = 'italic bold 14px Arial, Helvetica, sans-serif';

  formattedFacing = '000.0';

  private static offsetFromTrackingCenter(pos: SphericalPosition, dc: DrawingContextSky): SphericalPosition {
    if (pos instanceof SphericalPosition3D)
      return new SphericalPosition3D(pos.longitude.subtract(dc.trackingPos.longitude),
                                     pos.latitude.subtract(dc.trackingPos.latitude), pos.radius);
    else
      return new SphericalPosition(pos.longitude.subtract(dc.trackingPos.longitude),
                                   pos.latitude.subtract(dc.trackingPos.latitude));
  }

  private static adjustParallactically(pos: SphericalPosition, dc: DrawingContextSky): SphericalPosition {
    if (!dc.parallacticAngle)
      return pos;

    const lon = pos.longitude.radians;
    const lat = pos.latitude.radians;

    if (pos instanceof SphericalPosition3D)
      return new SphericalPosition3D(new Angle(lon * dc.parallacticAngle.cos - lat * dc.parallacticAngle.sin),
                                     new Angle(lon * dc.parallacticAngle.sin + lat * dc.parallacticAngle.cos),
                                     pos.radius);
    else
      return new SphericalPosition(new Angle(lon * dc.parallacticAngle.cos - lat * dc.parallacticAngle.sin),
                                   new Angle(lon * dc.parallacticAngle.sin + lat * dc.parallacticAngle.cos));
  }

  private setFacing(newFacing: number, redraw?: boolean): void {
    if (this._facing !== newFacing) {
      this._facing = newFacing;
      this.formatFacing();

      if (!this._trackSun)
        this.appService.updateUserSetting({view: VIEW_SKY, property: PROPERTY_FACING, value: newFacing, source: this});

      if (redraw)
        this.draw();
    }
  }

  private formatFacing(): void {
    let facing: number;

    if (this.northAzimuth) {
      facing = mod(this._facing + 180, 360);
      this.facingOrigin = 'E of N';
    }
    else {
      facing = this._facing;
      this.facingOrigin = 'W of S';
    }

    this.formattedFacing = padLeft(facing.toFixed(1), 5, '0');
  }

  constructor(appService: AppService) {
    super(appService, CurrentTab.SKY);

    this.marqueeFlags = MARQUEE_EQUATORIAL   | MARQUEE_HORIZONTAL | MARQUEE_MAGNITUDE |
                        MARQUEE_ILLUMINATION | MARQUEE_SIZE;
    this.topocentricMoon = true;

    MoonDrawer.getMoonDrawer().then((moonDrawer: MoonDrawer) => {
      this.moonDrawer = moonDrawer;
      this.draw();
    },
    (reason) => console.error(reason))
    .catch((reason) => console.error(reason));

    MilkyWay.getMilkyWay().then((milkyWay: MilkyWay) => {
      this.milkyWay = milkyWay;

      if (this.showMilkyWay)
        this.draw();
    },
    (reason) => console.error(reason))
    .catch((reason) => console.error(reason));

    appService.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_SKY && setting.source !== this) {
        if (setting.property === PROPERTY_VIEW_TYPE)
          this.viewType = <VIEW_TYPE> setting.value;
        else if (setting.property === PROPERTY_SKY_COLOR)
          this.skyColor = <SKY_COLOR> setting.value;
        else if (setting.property === PROPERTY_REFRACTION)
          this.refraction = <boolean> setting.value;
        else if (setting.property === PROPERTY_CELESTIAL_GRID)
          this.showCelestialGrid = <boolean> setting.value;
        else if (setting.property === PROPERTY_ECLIPTIC_GRID)
          this.showEclipticGrid = <boolean> setting.value;
        else if (setting.property === PROPERTY_PATH_OF_SUN)
          this.showPathOfSun = <boolean> setting.value;
        else if (setting.property === PROPERTY_PATH_OF_MOON)
          this.showPathOfMoon = <boolean> setting.value;
        else if (setting.property === PROPERTY_BRIGHTEN_STARS)
          this.brightenStars(<boolean> setting.value);
        else if (setting.property === PROPERTY_SHOW_CONSTELLATIONS)
          this.showConstellations = <boolean> setting.value;
        else if (setting.property === PROPERTY_ENLARGE_SUN_MOON)
          this.enlargeSunMoon = <boolean> setting.value;
        else if (setting.property === PROPERTY_SHOW_MILKY_WAY)
          this.showMilkyWay = <boolean> setting.value;
        else if (setting.property === PROPERTY_LABEL_PLANETS)
          this.labelPlanets = <boolean> setting.value;
        else if (setting.property === PROPERTY_LABEL_BRIGHT_STARS) {
          this.labelBrightStars = <boolean> setting.value;
          this.labelStars = this.labelStars && !this.labelBrightStars;
        }
        else if (setting.property === PROPERTY_LABEL_STARS) {
          this.labelStars = <boolean> setting.value;
          this.labelBrightStars = this.labelBrightStars && !this.labelStars;
        }
        else if (setting.property === PROPERTY_LABEL_CONSTELLATIONS)
          this.labelConstellations = <boolean> setting.value;
        else if (setting.property === PROPERTY_LABEL_DSOS)
          this.deepSkyLabelMagnitude = <number> setting.value;
        else if (setting.property === PROPERTY_FACING)
          this.facing = <number> setting.value;
        else if (setting.property === PROPERTY_TRACK_SUN)
          this.trackSun = <boolean> setting.value;
        else if (setting.property === PROPERTY_PARALLEL_TO_ECLIPTIC)
          this.parallelToEcliptic = <boolean> setting.value;
        else if (setting.property === PROPERTY_ADDITIONALS) {
          this.additional = <ADDITIONALS | string> setting.value;
          this.updatePlanetsToDraw();
        }

        this.debouncedDraw();
      }
      else if (setting.view === VIEW_APP && setting.property === PROPERTY_NORTH_AZIMUTH)
        this.formatFacing();
    });
  }

  ngAfterViewInit(): void {
    this.wrapper = this.wrapperRef.nativeElement;
    this.canvas = this.canvasRef.nativeElement;
    this.marquee = this.marqueeRef.nativeElement;

    setTimeout(() => this.appService.requestViewSettings(VIEW_SKY));

    super.ngAfterViewInit();
  }

  get viewType(): VIEW_TYPE { return this._viewType; }
  set viewType(value: VIEW_TYPE) {
    if (this._viewType !== value) {
      this._viewType = value;
      this.trackingPlanet = NO_SELECTION;

      switch (value) {
        case VIEW_TYPE.FULL_SKY_FLAT:
          this.viewMode = VIEW_MODE.FULL_SKY;
          this.lastFullSkyType = value;
          this.viewWidth = 180.0;
          this.minAlt = -0.00833; // half arc-minute
        break;

        case VIEW_TYPE.FULL_SKY_DOME:
          this.viewMode = VIEW_MODE.FULL_SKY;
          this.lastFullSkyType = value;
          this.viewWidth = 180.0;
          this.minAlt = -0.00833;
        break;

        case VIEW_TYPE.HORIZON_45:
          this.viewMode = VIEW_MODE.HORIZON;
          this.lastHorizonType = value;
          this.viewWidth = 45.0;
          this.viewHeight = 45.0;
          this.minAlt = -0.00833;
        break;

        case VIEW_TYPE.HORIZON_90:
          this.viewMode = VIEW_MODE.HORIZON;
          this.lastHorizonType = value;
          this.viewWidth = 90.0;
          this.viewHeight = 45.0;
          this.minAlt = -0.00833;
        break;

        case VIEW_TYPE.HORIZON_120:
          this.viewMode = VIEW_MODE.HORIZON;
          this.lastHorizonType = value;
          this.viewWidth = 120.0;
          this.viewHeight = 45.0;
          this.minAlt = -0.00833;
        break;

        case VIEW_TYPE.HORIZON_TO_ZENITH:
          this.viewMode = VIEW_MODE.HORIZON;
          this.lastHorizonType = value;
          this.viewWidth = 90.0;
          this.viewHeight = 90.0;
          this.minAlt = -0.00833;
        break;

        case VIEW_TYPE.ZENITH_100:
          this.viewMode = VIEW_MODE.ZENITH;
          this.viewWidth = 100.0;
          this.minAlt = 40.0;
        break;

        case VIEW_TYPE.MOON_CLOSEUP_1:
          this.viewMode = VIEW_MODE.MOON_CLOSEUP;
          this.lastMoonType = value;
          this.trackingPlanet = MOON;
          this.viewWidth = 1.0;
          this.minAlt = -90.0;
        break;

        case VIEW_TYPE.MOON_CLOSEUP_4:
          this.viewMode = VIEW_MODE.MOON_CLOSEUP;
          this.lastMoonType = value;
          this.trackingPlanet = MOON;
          this.viewWidth = 4.0;
          this.minAlt = -90.0;
        break;

        case VIEW_TYPE.MOON_CLOSEUP_8:
          this.viewMode = VIEW_MODE.MOON_CLOSEUP;
          this.lastMoonType = value;
          this.trackingPlanet = MOON;
          this.viewWidth = 8.0;
          this.minAlt = -90.0;
        break;

        case VIEW_TYPE.MOON_CLOSEUP_16:
          this.viewMode = VIEW_MODE.MOON_CLOSEUP;
          this.lastMoonType = value;
          this.trackingPlanet = MOON;
          this.viewWidth = 16.0;
          this.minAlt = -90.0;
        break;

        case VIEW_TYPE.SUN_CLOSEUP_1:
          this.viewMode = VIEW_MODE.SUN_CLOSEUP;
          this.lastSunType = value;
          this.trackingPlanet = SUN;
          this.viewWidth = 1.0;
          this.minAlt = -90.0;
        break;

        case VIEW_TYPE.SUN_CLOSEUP_4:
          this.viewMode = VIEW_MODE.SUN_CLOSEUP;
          this.lastSunType = value;
          this.trackingPlanet = SUN;
          this.viewWidth = 4.0;
          this.minAlt = -90.0;
        break;

        case VIEW_TYPE.SUN_CLOSEUP_8:
          this.viewMode = VIEW_MODE.SUN_CLOSEUP;
          this.lastSunType = value;
          this.trackingPlanet = SUN;
          this.viewWidth = 8.0;
          this.minAlt = -90.0;
        break;

        case VIEW_TYPE.SUN_CLOSEUP_16:
          this.viewMode = VIEW_MODE.SUN_CLOSEUP;
          this.lastSunType = value;
          this.trackingPlanet = SUN;
          this.viewWidth = 16.0;
          this.minAlt = -90.0;
        break;
      }

      this.onResize();
      this.draw();
      this.appService.updateUserSetting({view: VIEW_SKY, property: PROPERTY_VIEW_TYPE, value: value, source: this});
    }
  }

  get facing(): number { return this._facing; }
  set facing(newFacing: number) { this.setFacing(newFacing, true); }
  changeFacing(newFacing: number): void {
    this.facing = newFacing;
  }

  get trackSun(): boolean { return this._trackSun; }
  set trackSun(value: boolean) {
    if (this._trackSun !== value) {
      this._trackSun = value;
      this.appService.updateUserSetting({view: VIEW_SKY, property: PROPERTY_TRACK_SUN, value: value, source: this});
      this.draw();
    }
  }

  get parallelToEcliptic(): boolean { return this._parallelToEcliptic; }
  set parallelToEcliptic(value: boolean) {
    if (this._parallelToEcliptic !== value) {
      this._parallelToEcliptic = value;
      this.appService.updateUserSetting({view: VIEW_SKY, property: PROPERTY_PARALLEL_TO_ECLIPTIC, value: value, source: this});
      this.draw();
    }
  }

  handleMouseMove(x: number, y: number, button1Down: boolean): void {
    const wasDragging = this.dragging;
    const lastX = this.lastMoveX;
    const lastY = this.lastMoveY;

    super.handleMouseMove(x, y, button1Down);

    if (this.dragging && this.lastDrawingContext) {
      if (!wasDragging && !this.trackSun)
        this.dragStartFacing = this.facing;

      if (this.viewMode === VIEW_MODE.HORIZON)
        this.facing = mod(this.dragStartFacing -
                          (this.lastMoveX - this.clickX) * this.viewWidth /
                          (<DrawingContextSky> this.lastDrawingContext).plotWidth, 360.0);
      else {
        const lastDc = <DrawingContextPlanetary> this.lastDrawingContext;
        const dx1 = this.clickX - lastDc.xctr;
        const dy1 = this.clickY - lastDc.yctr;
        const dx2 = lastX - lastDc.xctr;
        const dy2 = lastY - lastDc.yctr;

        this.facing = round(mod(this.dragStartFacing + atan2_deg(dy2, dx2) -
                                atan2_deg(dy1, dx1), 360.0) * 10.0) / 10.0;
      }
    }
  }

  onDoubleClick(event: MouseEvent): void {
    const x = event.offsetX;
    const y = event.offsetY;
    const clickPos = this.screenXYToHorizontal(x, y);
    const lastDc = <DrawingContextPlanetary> this.lastDrawingContext;

    if (this.viewMode !== VIEW_MODE.FULL_SKY)
      this.viewType = this.lastFullSkyType;
    else if (lastDc && lastDc.selectionIndex === MOON && lastDc.selectionDistance < FAR_AWAY)
      this.viewType = this.lastMoonType;
    else if (lastDc && lastDc.selectionIndex === SUN && lastDc.selectionDistance < FAR_AWAY)
      this.viewType = this.lastSunType;
    else if (clickPos.altitude.degrees >= 42.5)
      this.viewType = VIEW_TYPE.ZENITH_100;
    else {
      this.facing = clickPos.azimuth.degrees;
      this.viewType = this.lastHorizonType;
    }
  }

  protected checkRefraction(): boolean {
    return (this.trackingPlanet === NO_SELECTION && this.refraction);
  }

  protected drawSky(dc: DrawingContextSky): void {
    const vInset = round(dc.largeLabelFm.lineHeight * 5 / 4);
    dc.context.font = this.largeLabelFont;
    const hInset = ceil(dc.context.measureText('MMMM').width);
    const showMilkyWay = (this.milkyWay && this.showMilkyWay && this.trackingPlanet === NO_SELECTION);
    const multiColor = (this.skyColor === SKY_COLOR.MULTI && !dc.inkSaver);

    dc.x_ul = dc.y_ul = 0;
    dc.plotWidth = dc.w;
    dc.plotHeight = dc.h;

    if (this.trackingPlanet === NO_SELECTION) {
      dc.plotWidth  -= hInset * 2;
      dc.plotHeight -= vInset * 2;
      dc.plotWidth  -= ((dc.plotWidth  + 1) % 2);
      dc.plotHeight -= ((dc.plotHeight + 1) % 2);
    }

    if (this.viewMode === VIEW_MODE.HORIZON) {
      dc.plotHeight -= MARK_GAP * 4;

      if (dc.plotWidth > dc.plotHeight / this.viewHeight * this.viewWidth)
        dc.plotWidth = floor(dc.plotHeight / this.viewHeight * this.viewWidth);
      else
        dc.plotHeight = floor(dc.plotWidth / this.viewWidth * this.viewHeight);
    }
    else if (this.viewMode === VIEW_MODE.ZENITH) {
      dc.plotWidth  -= OUTER_LABEL_GAP * 2;
      dc.plotHeight -= OUTER_LABEL_GAP * 2;
    }

    if (this.trackingPlanet === NO_SELECTION) {
      dc.x_ul = dc.xctr - dc.plotWidth / 2;
      dc.y_ul = dc.yctr - dc.plotHeight / 2;
      dc.plotWidth  -= ((dc.plotWidth  + 1) % 2);
      dc.plotHeight -= ((dc.plotHeight + 1) % 2);
    }
    else {
      dc.trackingPos = dc.ss.getEclipticPosition(this.trackingPlanet, dc.jde, dc.skyObserver);
      dc.heavyLabels = true;

      if (!this.parallelToEcliptic) {
        dc.parallacticAngle = dc.ss.getParallacticAngle(this.trackingPlanet, dc.jdu, dc.skyObserver);

        if (!dc.parallacticAngle)
          dc.parallacticAngle = Angle.ZERO;
        else {
          // To produce the right visual appearance, the parallactic angle needs to be
          // adjusted by the angle between the ecliptic at the location of the Moon
          // and the celestial equator, as the orientation of the Moon's shadow is
          // predominantly oriented along the ecliptic.
          const obliquity = this.ecliptic.getNutation(dc.jde).obliquity;

          dc.parallacticAngle = dc.parallacticAngle.add(obliquity.multiply(dc.trackingPos.longitude.cos));
        }

        dc.trackingAltitude = dc.ss.getHorizontalPosition(this.trackingPlanet, dc.jdu,
          dc.skyObserver).altitude.degrees;
      }
    }

    dc.radius = max(floor(min(dc.plotWidth, dc.plotHeight) / 2), 100);
    dc.size = dc.radius * 2;
    dc.pixelsPerArcSec = dc.plotWidth / this.viewWidth / 3600.0;
    dc.x_br = dc.x_ul + dc.plotWidth;
    dc.y_br = dc.y_ul + dc.plotHeight;

    dc.sunPos = dc.ss.getHorizontalPosition(SUN, dc.jdu, dc.skyObserver, dc.planetFlags);
    const az = dc.sunPos.azimuth.degrees;
    const alt = dc.sunPos.altitude.degrees;
    dc.totality = dc.ss.getLocalSolarEclipseTotality(dc.jde, dc.skyObserver);

    if (this.trackSun)
      this.setFacing(az);

    if (dc.inkSaver)
      dc.skyColor = 'white';
    else if (alt < -18 || this.skyColor === SKY_COLOR.BLACK)
      dc.skyColor = 'black';
    else if (alt < 0) {
      const shade = (18 + alt) / 18;

      dc.minStarBrightness = round(shade * 153);
      dc.skyColor = colorFromRGB(shade * 51, shade * 51, dc.minStarBrightness);
    }
    else {
      dc.minStarBrightness = 153;
      dc.skyColor = '#333399';
    }

    if ((multiColor && alt >= -18) || showMilkyWay) {
      dc.heavyLabels = true;

      if (this.trackingPlanet !== NO_SELECTION) {
        let pos: SphericalPosition = dc.ss.getHorizontalPosition(this.trackingPlanet, dc.jdu, dc.skyObserver, dc.planetFlags);

        if (pos.altitude.radians < 0)
          pos = new SphericalPosition(pos.azimuth.radians, 0.0);

        dc.skyColor = getSkyColor(dc.sunPos, pos, dc.totality);
        dc.context.fillStyle = dc.skyColor;
        dc.context.fillRect(dc.x_ul, dc.y_ul, dc.plotWidth, dc.plotHeight);
      }
      else if (this.viewMode === VIEW_MODE.FULL_SKY || this.viewMode === VIEW_MODE.ZENITH) {
        const minAlt2 = this.minAlt - 5.0 / dc.pixelsPerArcSec / 3600.0;

        for (let y = dc.yctr - dc.radius - 5; y <= dc.yctr + dc.radius + 5; y += 5) {
          for (let x = dc.xctr - dc.radius - 5; x <= dc.xctr + dc.radius + 5; x += 5) {
            const pos = this.screenXYToHorizontal(x, y, dc);
            const skyAlt = pos.altitude.degrees;

            if (skyAlt >= minAlt2) {
              dc.context.fillStyle = this.getSkyColor(dc, multiColor ? null : dc.skyColor, dc.sunPos, pos, dc.totality, showMilkyWay);
              dc.context.fillRect(x - 2, y - 2, 6, 6);
            }
          }
        }
      }
      else {
        for (let y = dc.y_ul; y < dc.y_br; y += 5) {
          for (let x = dc.x_ul; x < dc.x_br; x += 5) {
            const pos = this.screenXYToHorizontal(x + 3, y + 3, dc);
            let rw = 6;
            let rh = 6;

            if (x + rw > dc.x_br)
              rw = dc.x_br - x;

            if (y + rh > dc.y_br)
              rh = dc.y_br - y;

            dc.context.fillStyle = this.getSkyColor(dc, multiColor ? null : dc.skyColor, dc.sunPos, pos, dc.totality, showMilkyWay);
            dc.context.fillRect(x, y, rw, rh);
          }
        }
      }
    }
    else {
      dc.context.fillStyle = dc.skyColor;
      dc.context.fillRect(0, 0, dc.w, dc.h);
    }

    if (dc.inkSaver)
      dc.groundColor = '#CCFFCC';
    else if (alt < -18 || this.skyColor === SKY_COLOR.BLACK)
      dc.groundColor = '#004400';
    else if (alt < 0 || multiColor) {
      const shade = (18 + alt) / 18;

      dc.groundColor = colorFromRGB(0, min(round(68 + 34 * shade), 255), 0);
    }
    else
      dc.groundColor = '#006600';

    if (this.trackingPlanet !== NO_SELECTION)
      this.drawWhereTheEarthIsInTheWay(dc);

    if (this.showCelestialGrid)
      this.drawCelestialGrid(dc);

    if (this.showEclipticGrid)
      this.drawEclipticGrid(dc);

    if (this.trackingPlanet === NO_SELECTION)
      this.drawSunAndMoonPaths(dc);

    if (dc.gridLabels) {
      dc.context.save();
      dc.context.lineWidth = 4;
      dc.context.lineJoin = 'round';
      dc.context.font = this.gridFont;

      for (const label of dc.gridLabels) {
        dc.context.strokeStyle = label.background;
        dc.context.strokeText(label.text, label.pt.x + 4, label.pt.y);
        dc.context.fillStyle = label.color;
        dc.context.fillText(label.text, label.pt.x + 4, label.pt.y);
      }

      dc.context.restore();
    }
  }

  protected drawPlanet(planet: number, pt: Point, dc: DrawingContextSky, colorOverride?: string): void {
    if (this.trackingPlanet === NO_SELECTION)
      return super.drawPlanet(planet, pt, dc, colorOverride);
    else
      return this.drawScaledPlanet(planet, pt, dc, colorOverride);
  }

  protected drawScaledPlanet(planet: number, pt: Point, dc: DrawingContextSky, colorOverride?: string): void {
    const cx = pt.x;
    const cy = pt.y;
    let pSize = round(dc.ss.getAngularDiameter(planet, dc.jde, dc.skyObserver) * dc.pixelsPerArcSec);

    pSize += (pSize + 1) % 2;

    if (pSize < 3)
      pSize = 3;

    if (planet >= 0)
      dc.planetSizes[planet] = pSize;

    if (planet === MOON && this.moonDrawer)
      this.moonDrawer.drawMoon(dc.context, dc.ss, dc.jde, cx, cy, 0, dc.pixelsPerArcSec, dc.parallacticAngle,
                               dc.skyObserver, true);
    else {
      if (this.trackingPlanet !== NO_SELECTION && planet !== SUN) {
        dc.context.fillStyle = 'black';
        dc.context.beginPath();
        dc.context.arc(cx, cy, pSize / 2 + 1, 0, TWO_PI);
        dc.context.fill();
      }

      if (SolarSystem.isNominalPlanet(planet))
        dc.context.fillStyle = (dc.inkSaver ? planetPrintColors[planet] : planetColors[planet]);
      else if (SolarSystem.isAsteroid(planet))
        dc.context.fillStyle = asteroidColor;
      else
        dc.context.fillStyle = cometColor;

      dc.context.beginPath();
      dc.context.arc(cx, cy, pSize / 2, 0, TWO_PI);
      dc.context.fill();
    }
  }

  protected getMoonShadingOrientation(dc: DrawingContextSky): number {
    if (this.viewMode !== VIEW_MODE.FULL_SKY && this.viewMode !== VIEW_MODE.HORIZON &&
        this.viewMode !== VIEW_MODE.ZENITH)
      return 0.0;

    let dt = 0.0;
    let moonPara: Angle;

    // In the very unlikely event that the moon is precisely at the zenith, which makes the
    // parallactic angle calculation fail, we'll just move on to a slightly later moment in
    // time to fix the problem.
    //
    while (!(moonPara = dc.ss.getParallacticAngle(MOON, dc.jdu + dt, dc.skyObserver)))
      dt += 1.0E-5;

    const eclipticPos = dc.ss.getEclipticPosition(MOON, dc.jde + dt, dc.skyObserver);
    const obliquity = this.ecliptic.getNutation(dc.jde + dt).obliquity;
    const horizontalPos = this.getSphericalPosition(MOON, dc);

    moonPara = moonPara.add(obliquity.multiply(eclipticPos.longitude.cos));

    let angle = moonPara.degrees;
    const az = horizontalPos.azimuth.degrees;

    if (this.viewMode !== VIEW_MODE.HORIZON)
      angle += this.facing - az;
    else if (this.viewType === VIEW_TYPE.HORIZON_TO_ZENITH)
      // This is a far from mathematically rigorous treatment for computing the
      // orientation of the Moon against the odd projection of HORIZON_TO_ZENITH,
      // but it seems good enough for the low-res drawing needed here, where the
      // whole of the Moon is only a few pixels is diameter.
      angle += mod2(this.facing - az, 360.0) * horizontalPos.altitude.sin;

    return angle;
  }

  protected drawSkyMask(dc: DrawingContextSky): void {
    dc.context.fillStyle = (dc.inkSaver ? 'white' : '#006699');

    if (this.viewMode === VIEW_MODE.FULL_SKY || this.viewMode === VIEW_MODE.ZENITH) {
      dc.context.beginPath();
      dc.context.arc(dc.xctr, dc.yctr, dc.radius, 0, TWO_PI, true);
      dc.context.rect(0, 0, dc.w, dc.h);
      dc.context.fill();
    }
    else {
      dc.context.fillRect(0, 0, dc.w, dc.y_ul);
      dc.context.fillRect(0, dc.y_ul - 1, dc.x_ul, dc.y_br - dc.y_ul + 2);
      dc.context.fillRect(dc.x_br, dc.y_ul - 1, dc.w - dc.x_br, dc.y_br - dc.y_ul + 2);
      dc.context.fillRect(0, dc.y_br, dc.w, dc.h - dc.y_br);
    }

    if (this.trackingPlanet !== NO_SELECTION &&
       dc.ss.getHorizontalPosition(this.trackingPlanet, dc.jdu, dc.skyObserver).altitude.degrees <
        -REFRACTION_AT_HORIZON - AVG_SUN_MOON_RADIUS)
    {
      const ascent = dc.largeLabelFm.ascent;
      const message = '(' + dc.ss.getPlanetName(this.trackingPlanet) + ' is below the horizon)';

      dc.context.font = this.largeLabelFont;
      drawOutlinedText(dc.context, message, MESSAGE_INSET, MESSAGE_INSET + ascent, 'black', 'white');
    }
  }

  protected drawLabels(dc: DrawingContextSky): void {
    const ascent = dc.largeLabelFm.ascent;

    dc.context.fillStyle = 'black';
    dc.context.font = this.largeLabelFont;

    if (this.viewMode === VIEW_MODE.HORIZON) {
      for (let i = 0; i <= this.viewHeight; i += 5) {
        const y = round(dc.y_br - i * (dc.plotHeight - 1) / this.viewHeight - 1);
        dc.context.fillRect(dc.x_ul - MARK_LENGTH, y, MARK_LENGTH, 1);

        if (i % 15 === 0) {
          const altStr = i + '°';
          dc.context.fillText(altStr, dc.x_ul - MARK_LENGTH - MARK_GAP - dc.context.measureText(altStr).width,
                       y + ascent / 2);
        }
      }

      let az = 0.0;

      for (let i = 0; i < 32; ++i, az += 11.25) {
        const x = round(dc.xctr + mod2(az - this.facing, 360.0) * (dc.plotWidth - 1) / this.viewWidth);

        if (dc.x_ul <= x && x < dc.x_br) {
          dc.context.fillRect(x, dc.y_br, 1, MARK_LENGTH);
          const cp = COMPASS_POINTS[i / 2];

          if (i % 2 === 0)
            dc.context.fillText(cp, x - dc.context.measureText(cp).width / 2,
                                dc.y_br + MARK_LENGTH + MARK_GAP + ascent);
        }
      }
    }
    else if (this.trackingPlanet === NO_SELECTION) {
      let gapExtra = 2;

      if (this.viewMode !== VIEW_MODE.FULL_SKY || dc.inkSaver) {
        const radius2 = dc.radius + OUTER_LABEL_GAP;
        gapExtra += OUTER_LABEL_GAP;
        dc.context.beginPath();
        dc.context.arc(dc.xctr, dc.yctr, radius2, 0, TWO_PI);
        dc.context.strokeStyle = 'lightGray';
        dc.context.stroke();
        dc.context.closePath();
        dc.context.strokeStyle = 'black';
      }

      let az = 0.0;

      for (let i = 0; i < 8; ++i, az += 45.0) {
        const theta = mod(az - this.facing - 90.0, 360.0);
        const s = COMPASS_POINTS[i * 2];
        const sw = dc.context.measureText(s).width;
        const outerR = dc.size / 2 + OUTER_LABEL_GAP + gapExtra;

        let x = dc.xctr + round(outerR * cos_deg(theta));
        let y = dc.yctr - round(outerR * sin_deg(theta));

        x -= (dc.xctr + outerR - x) * sw / outerR / 2;
        y += (y - dc.yctr + outerR) * (ascent - 2) / outerR / 2;

        dc.context.fillText(COMPASS_POINTS[i * 2], x, y);
      }
    }

    super.drawLabels(dc);
  }

  protected isInsideView(): boolean {
    if (!this.lastDrawingContext)
      return false;

    return this.withinPlot(this.lastMoveX, this.lastMoveY, <DrawingContextSky> this.lastDrawingContext);
  }

  protected withinPlot(x: number, y: number, dc = <DrawingContextSky> this.lastDrawingContext): boolean {
    if (!dc)
      return false;

    if (this.viewMode === VIEW_MODE.HORIZON || this.trackingPlanet !== NO_SELECTION) {
      return (dc.x_ul <= x && x < dc.x_ul + dc.plotWidth &&
              dc.y_ul <= y && y < dc.y_ul + dc.plotHeight);
    }

    x -= dc.xctr;
    y -= dc.yctr;
    const r2 = x * x + y * y;

    return (r2 <= dc.radius * dc.radius);
  }

  protected drawLabel(li: LabelInfo, showHighlighting: boolean, dc: DrawingContextPlanetary): void {
    if (this.trackingPlanet === NO_SELECTION || (li.bodyIndex !== SUN && li.bodyIndex !== MOON))
      super.drawLabel(li, showHighlighting, dc);
  }

  protected getSphericalPosition(bodyIndex: number, dc: DrawingContextSky): SphericalPosition {
    if (this.trackingPlanet !== NO_SELECTION) {
      if (dc.trackingPos === null)
        return null;

      if (bodyIndex < 0) {
        const starPos = dc.sc.getEclipticPosition(-bodyIndex - 1, dc.jde, 365.25, dc.starFlags);

        return SvcSkyViewComponent.adjustParallactically(SvcSkyViewComponent.offsetFromTrackingCenter(starPos, dc), dc);
      }
      else {
        const planetPos = dc.ss.getEclipticPosition(bodyIndex, dc.jde, dc.skyObserver);

        return SvcSkyViewComponent.adjustParallactically(SvcSkyViewComponent.offsetFromTrackingCenter(planetPos, dc), dc);
      }
    }

    if (bodyIndex < 0)
      return dc.sc.getHorizontalPosition(-bodyIndex - 1, dc.jdu, dc.skyObserver, 365.25, dc.starFlags);
    else {
      let flags = dc.planetFlags;

      if (bodyIndex === MOON)
        flags |= TOPOCENTRIC;

      return dc.ss.getHorizontalPosition(bodyIndex, dc.jdu, dc.skyObserver, flags);
    }
  }

  protected screenXYToHorizontal(x: number, y: number, dc = <DrawingContextSky> this.lastDrawingContext): SphericalPosition {
    let az;
    let alt;

    if (this.viewType === VIEW_TYPE.HORIZON_TO_ZENITH) {
      let x0 = (x - dc.xctr) / (dc.plotWidth - 1.0);
      let y0 = (y - dc.yctr + (dc.plotHeight - 1.0) / 2.0) / dc.plotHeight;

      if (y0 > 1.0)
        x0 /= 0.70711;
      else
        x0 /= (1.0 - 0.29289 * y0);

      y0 *= sqrt(1.0 - x0 * x0);

      const azOffset = atan2_deg(x0, y0);
      const r = sqrt(x0 * x0 + y0 * y0);

      az = mod(this.facing + azOffset, 360.0);
      alt = 90.0 * (1.0 - r);
    }
    else if (this.viewMode === VIEW_MODE.HORIZON) {
      az  = this.facing + (x - dc.xctr) / dc.pixelsPerArcSec / 3600.0;
      alt = this.viewHeight / 2 - (y - dc.yctr) / dc.pixelsPerArcSec / 3600.0;
    }
    else {
      const dx = x - dc.xctr;
      const dy = y - dc.yctr;
      const r = sqrt(dx * dx + dy * dy);

      az = mod(90.0 - atan2_deg(dy, dx) + this.facing, 360.0);
      alt = 90.0 - r / dc.size * this.viewWidth;
    }

    return new SphericalPosition(az, alt, Unit.DEGREES, Unit.DEGREES);
  }

  protected sphericalToScreenXY(pos: SphericalPosition, dc: DrawingContextSky, subject: SUBJECT): Point {
    if (this.trackingPlanet !== NO_SELECTION) {
      return {x: dc.xctr - round(pos.longitude.arcSeconds * dc.pixelsPerArcSec),
              y: dc.yctr - round(pos.latitude.arcSeconds * dc.pixelsPerArcSec)};
    }
    else
      return this.horizontalToScreenXY(pos.altitude.degrees, pos.azimuth.degrees, dc, subject);
  }

  protected horizontalToScreenXY(alt: number, az: number, dc: DrawingContextSky, subject: SUBJECT): Point {
    if (this.trackingPlanet !== NO_SELECTION) {
      let pos = new SphericalPosition(az, alt, Unit.DEGREES, Unit.DEGREES);

      pos = dc.skyObserver.horizontalToEquatorial(pos, dc.jdu, dc.planetFlags);
      pos = this.ecliptic.equatorialToEcliptic(pos, dc.jde);

      return this.sphericalToScreenXY(SvcSkyViewComponent.adjustParallactically(
                SvcSkyViewComponent.offsetFromTrackingCenter(pos, dc), dc), dc, subject);
    }
    else if (subject === NONPLANET.CONSTELLATIONS) {
      if (alt < -75.0)
        return null;
    }
    else if (subject === NONPLANET.DEFAULT || subject === NONPLANET.MOONSHADE) {
      // Do nothing.
    }
    else if (alt < this.minAlt - AVG_SUN_MOON_RADIUS) {
      return null;
    }
    else if (subject !== SUN && subject !== MOON && alt < this.minAlt)
      return null;

    const pt = <Point> {};

    if (this.viewMode === VIEW_MODE.HORIZON) {
      const azOffset = mod2(az - this.facing, 360.0);

      if (this.viewType === VIEW_TYPE.HORIZON_TO_ZENITH) {
        const r = (90.0 - alt) / 90.0;
        let x0 = sin_deg(azOffset) * r;
        let y0 = cos_deg(azOffset) * r;

        if (y0 > 0) {
          y0 /= sqrt(1.0 - x0 * x0);

          if (y0 > 1.0)
            x0 *= 0.70711;
          else
            x0 *= (1.0 - 0.29289 * y0);
        }

        pt.x = round(dc.xctr + x0 * (dc.plotWidth - 1));
        pt.y = round(dc.yctr - (dc.plotHeight - 1) / 2 + y0 * dc.plotHeight);
      }
      else {
        pt.x = round(dc.xctr + azOffset * (dc.plotWidth - 1) / this.viewWidth);
        pt.y = round(dc.yctr + (dc.plotHeight - 1) / 2 - alt * dc.plotHeight / this.viewHeight);
      }
    }
    else {
      let r;

      if (alt <= 0.0 || this.viewType !== VIEW_TYPE.FULL_SKY_DOME)
        r = (90.0 - alt) * dc.size / this.viewWidth * 0.995;
      else
        r = 90.0 * cos_deg(alt) * dc.size / this.viewWidth * 0.995;

      pt.x = round(dc.xctr + cos_deg(-az + this.facing + 90.0) * r);
      pt.y = round(dc.yctr + sin_deg(-az + this.facing + 90.0) * r);
    }

    return pt;
  }

  protected drawSkyPlotLine(pt1: Point, pt2: Point, dc: DrawingContextPlanetary, subject: SUBJECT): boolean {
    if (this.viewMode === VIEW_MODE.HORIZON || this.trackingPlanet !== NO_SELECTION) {
      const deg_45 = ceil(dc.pixelsPerArcSec * 45.0 * 3600.0);

      if (abs(pt2.x - pt1.x) >= deg_45 || abs(pt2.y - pt1.y) >= deg_45)
        return false;
    }

    strokeLine(dc.context, pt1.x, pt1.y, pt2.x, pt2.y);

    return true;
  }

  protected drawCelestialGrid(dc: DrawingContextSky): void {
    const localHourAngle = dc.skyObserver.getLocalHourAngle(dc.jdu, false).degrees;
    const sin_lat = dc.skyObserver.latitude.sin;
    const cos_lat = dc.skyObserver.latitude.cos;
    let gridColor = (dc.inkSaver ? equatorialGridPrintColor : equatorialGridColor);
    let pt2: Point;
    let alt2: number;

    if (dc.minStarBrightness > 0) {
      if (this.skyColor === SKY_COLOR.BASIC)
        gridColor = replaceAlpha(gridColor, 0.4 + 0.0015 * dc.minStarBrightness);
      else
        gridColor = replaceAlpha(gridColor, 0.4 - 0.0015 * dc.minStarBrightness);
    }

    // Draw celestial equator and lines of celestial latitude
    for (let dec = -75; dec <= 75; dec += 15) {
      const sin_d = sin_deg(dec);
      const cos_d = cos_deg(dec);
      const tan_d = tan_deg(dec);

      if (dec === 0)
        dc.context.strokeStyle = (dc.inkSaver ? equatorPrintColor : equatorColor);
      else
        dc.context.strokeStyle = gridColor;

      for (let ha = 0; ha <= 360; ++ha) {
        const sin_ha = sin_deg(ha);
        const cos_ha = cos_deg(ha);

        const az = atan2_deg(sin_ha, (cos_ha * sin_lat - tan_d * cos_lat));
        let alt1 = asin_deg(limitNeg1to1(sin_lat * sin_d + cos_lat * cos_d * cos_ha));

        if (this.checkRefraction())
          alt1 = refractedAltitude(alt1);

        const pt1 = this.horizontalToScreenXY(alt1, az, dc, NONPLANET.DEFAULT);

        if (ha > 0 && (alt1 >= this.minAlt - 0.1 || alt2 >= this.minAlt - 0.1) &&
            (this.viewMode === VIEW_MODE.HORIZON || this.trackingPlanet !== NO_SELECTION ||
             (abs(pt2.x - pt1.x) < dc.radius && abs(pt2.y - pt1.y) < dc.radius)))
        {
          this.drawSkyPlotLine(pt1, pt2, dc, NONPLANET.DEFAULT);
        }

        pt2 = pt1;
        alt2 = alt1;
      }
    }

    if (!dc.gridLabels)
      dc.gridLabels = [];

    dc.context.fillStyle = gridColor;

    // Draw hour angle lines
    for (let ha = 0; ha < 360; ha += 15) {
      const sin_ha = sin_deg(localHourAngle - ha);
      const cos_ha = cos_deg(localHourAngle - ha);

      for (let dec = -90; dec <= 90; ++dec) {
        const sin_d = sin_deg(dec);
        const cos_d = cos_deg(dec);
        const tan_d = tan_deg(dec);

        const az = atan2_deg(sin_ha, (cos_ha * sin_lat - tan_d * cos_lat));
        let alt1 = asin_deg(limitNeg1to1(sin_lat * sin_d + cos_lat * cos_d * cos_ha));

        if (this.checkRefraction())
          alt1 = refractedAltitude(alt1);

        const pt1 = this.horizontalToScreenXY(alt1, az, dc, NONPLANET.DEFAULT);

        if (dec > -90 && (alt1 >= this.minAlt - 0.1 || alt2 >= this.minAlt - 0.1) &&
            (this.viewMode === VIEW_MODE.HORIZON || this.trackingPlanet !== NO_SELECTION ||
             (abs(pt2.x - pt1.x) < dc.radius && abs(pt2.y - pt1.y) < dc.radius)))
        {
          this.drawSkyPlotLine(pt1, pt2, dc, NONPLANET.DEFAULT);

          // Skip drawing 0h and 12h markers if ecliptic will be drawn...
          // let 0 and 180 degree ecliptic markers override.
          if (dec === 0 && ha % 30 === 0 && ((ha !== 0 && ha !== 180) || !this.showEclipticGrid)) {
            const pos = new SphericalPosition(az, alt1, Unit.DEGREES, Unit.DEGREES);
            const spotColor = (dc.skyColor ? dc.skyColor : getSkyColor(dc.sunPos, pos, dc.totality));
            dc.gridLabels.push({pt: pt1, text: (ha / 15) + 'h', color: equatorColor, background: spotColor});
          }
        }

        pt2 = pt1;
        alt2 = alt1;
      }
    }
  }

  protected drawEclipticGrid(dc: DrawingContextSky): void {
    const latitude = dc.skyObserver.latitude.radians;
    const localHourAngle = dc.skyObserver.getLocalHourAngle(dc.jdu, false).radians;
    const sin_lat = dc.skyObserver.latitude.sin;
    const cos_lat = dc.skyObserver.latitude.cos;
    let gridColor = (dc.inkSaver ? eclipticGridPrintColor : eclipticGridColor);
    let pt2: Point;
    let alt2: number;

    if (dc.minStarBrightness > 0) {
      if (this.skyColor === SKY_COLOR.BASIC)
        gridColor = replaceAlpha(gridColor, 0.4 + 0.0015 * dc.minStarBrightness);
      else
        gridColor = replaceAlpha(gridColor, 0.4 - 0.0015 * dc.minStarBrightness);
    }

    // Draw ecliptic and lines of ecliptic latitude
    for (let eLat = -75; eLat <= 75; eLat += 15) {
      const ecLat = new Angle(eLat, Unit.DEGREES);

      if (eLat === 0)
        dc.context.strokeStyle = (dc.inkSaver ? eclipticPrintColor : eclipticColor);
      else
        dc.context.strokeStyle = gridColor;

      for (let eLong = 0; eLong <= 360; ++eLong) {
        const L = new Angle(eLong, Unit.DEGREES);
        const eclipticPoint = this.ecliptic.eclipticToEquatorial(new SphericalPosition(L, ecLat), dc.jde);
        const ha = localHourAngle - eclipticPoint.rightAscension.radians;
        const dec = eclipticPoint.declination.radians;

        const az = atan2_deg(sin(ha), cos(ha) * sin(latitude) - tan(dec) * cos(latitude));
        let alt1 = asin_deg(sin(latitude) * sin(dec) + cos(latitude) * cos(dec) * cos(ha));

        if (this.checkRefraction())
          alt1 = refractedAltitude(alt1);

        const pt1 = this.horizontalToScreenXY(alt1, az, dc, NONPLANET.DEFAULT);

        if (eLong > 0 && (alt1 >= this.minAlt - 0.1 || alt2 >= this.minAlt - 0.1) &&
            (this.viewMode === VIEW_MODE.HORIZON || this.trackingPlanet !== NO_SELECTION ||
             (abs(pt2.x - pt1.x) < dc.radius && abs(pt2.y - pt1.y) < dc.radius)))
        {
          this.drawSkyPlotLine(pt1, pt2, dc, NONPLANET.DEFAULT);
        }

        pt2 = pt1;
        alt2 = alt1;
      }
    }

    if (!dc.gridLabels)
      dc.gridLabels = [];

    dc.context.fillStyle = gridColor;

    // Draw lines of ecliptic longitude
    for (let eLong = 0; eLong < 360; eLong += 15) {
      const L = new Angle(eLong, Unit.DEGREES);

      for (let eLat = -90; eLat <= 90; ++eLat) {
        const ecLat = new Angle(eLat, Unit.DEGREES);
        const eclipticPoint = this.ecliptic.eclipticToEquatorial(new SphericalPosition(L, ecLat), dc.jde);
        const ha = localHourAngle - eclipticPoint.rightAscension.radians;
        const dec = eclipticPoint.declination.radians;

        const az = atan2_deg(sin(ha), cos(ha) * sin(latitude) - tan(dec) * cos(latitude));
        let alt1 = asin_deg(sin(latitude) * sin(dec) + cos(latitude) * cos(dec) * cos(ha));

        if (this.checkRefraction())
          alt1 = refractedAltitude(alt1);

        const pt1 = this.horizontalToScreenXY(alt1, az, dc, NONPLANET.DEFAULT);

        if (eLat > -90 && (alt1 >= this.minAlt - 0.1 || alt2 >= this.minAlt - 0.1) &&
            (this.viewMode === VIEW_MODE.HORIZON || this.trackingPlanet !== NO_SELECTION ||
             (abs(pt2.x - pt1.x) < dc.radius && abs(pt2.y - pt1.y) < dc.radius)))
        {
          this.drawSkyPlotLine(pt1, pt2, dc, NONPLANET.DEFAULT);

          // Skip drawing 0h and 12h markers if ecliptic will be drawn...
          // let 0 and 180 degree ecliptic markers override.
          if (eLat === 0 && eLong % 30 === 0) {
            const pos = new SphericalPosition(az, alt1, Unit.DEGREES, Unit.DEGREES);
            const spotColor = (dc.skyColor ? dc.skyColor : getSkyColor(dc.sunPos, pos, dc.totality));
            dc.gridLabels.push({pt: pt1, text: eLong + '°', color: eclipticColor, background: spotColor});
          }
        }

        pt2 = pt1;
        alt2 = alt1;
      }
    }
  }

  protected drawSunAndMoonPaths(dc: DrawingContextSky): void {
    if (this.trackingPlanet !== NO_SELECTION)
      return;

    for (let i = 0; i < 2; ++i) {
      if (i === 0 && !this.showPathOfSun || i === 1 && !this.showPathOfMoon)
        continue;

      const planet = (i === 0 ? SUN : MOON);
      const pathColor = (i === 0 ? sunPathColor : moonPathColor);
      const flags = QUICK_SUN | LOW_PRECISION | (this.checkRefraction() ? REFRACTION : 0) |
                          (i === 0 ? 0 : TOPOCENTRIC);
      let haveLastPoint = false;
      let pt2: Point;
      let alt2: number;

      dc.context.strokeStyle = pathColor;

      for (let t = dc.jdu - 0.5; t <= dc.jdu + 0.5; t += 4.0 / DAY_MINUTES) {
        const pos = dc.ss.getHorizontalPosition(planet, t, dc.skyObserver, flags);
        const alt1 = pos.altitude.degrees;
        const pt1 = this.sphericalToScreenXY(pos, dc, NONPLANET.DEFAULT);

        if (haveLastPoint && (alt1 >= this.minAlt - 0.1 || alt2 >= this.minAlt - 0.1) &&
           (this.viewMode === VIEW_MODE.HORIZON ||
            (abs(pt2.x - pt1.x) < dc.radius && abs(pt2.y - pt1.y) < dc.radius)))
        {
          this.drawSkyPlotLine(pt1, pt2, dc, NONPLANET.DEFAULT);
        }

        pt2 = pt1;
        alt2 = alt1;
        haveLastPoint = true;
      }
    }
  }

  protected drawWhereTheEarthIsInTheWay(dc: DrawingContextSky): void {
    if (dc.parallacticAngle) {
      let y = dc.yctr + round((dc.trackingAltitude + REFRACTION_AT_HORIZON) * dc.pixelsPerArcSec * 3600.0);

      if (y > dc.plotHeight)
        return;
      else if (y < 0)
        y = 0;

      dc.context.fillStyle = dc.groundColor;
      dc.context.fillRect(0, y, dc.plotWidth, dc.plotHeight - y);

      return;
    }

    const pxperrad = dc.pixelsPerArcSec * 648000.0 / PI;
    const trackingLong = dc.trackingPos.longitude.radians;
    const trackingLat = dc.trackingPos.latitude.radians;
    const corners: SphericalPosition[] = [];

    corners.push(new SphericalPosition(trackingLong - (dc.plotWidth  / 2.0 + 1.0) / pxperrad,
                                       trackingLat  + (dc.plotHeight / 2.0 + 1.0) / pxperrad));
    corners.push(new SphericalPosition(trackingLong + (dc.plotWidth  / 2.0 + 1.0) / pxperrad,
                                       trackingLat  + (dc.plotHeight / 2.0 + 1.0) / pxperrad));
    corners.push(new SphericalPosition(trackingLong + (dc.plotWidth  / 2.0 + 1.0) / pxperrad,
                                       trackingLat  - (dc.plotHeight / 2.0 + 1.0) / pxperrad));
    corners.push(new SphericalPosition(trackingLong - (dc.plotWidth  / 2.0 + 1.0) / pxperrad,
                                       trackingLat  - (dc.plotHeight / 2.0 + 1.0) / pxperrad));
    corners.push(corners[0]);

    let cornersUsed = 0;
    const pts: Point[] = [];
    let pos: SphericalPosition;
    let lastPt: Point;
    let midPt: Point;
    let inSky;
    let lastInSky = false;
    let lastAlt = 0.0;

    for (let i = 0; i < 5; ++i) {
      const pt = this.sphericalToScreenXY(SvcSkyViewComponent.offsetFromTrackingCenter(corners[i], dc), dc, NONPLANET.DEFAULT);
      pos = this.ecliptic.eclipticToEquatorial(corners[i], dc.jde);
      pos = dc.skyObserver.equatorialToHorizontal(pos, dc.jdu);
      const alt = pos.altitude.degrees;

      if (alt < -REFRACTION_AT_HORIZON) {
        if (i !== 4)
          ++cornersUsed;

        inSky = true;
      }
      else
        inSky = false;

      if (lastPt != null && inSky !== lastInSky) {
        midPt = <Point> {};
        midPt.x = round(interpolate(alt, -REFRACTION_AT_HORIZON, lastAlt, pt.x, lastPt.x));
        midPt.y = round(interpolate(alt, -REFRACTION_AT_HORIZON, lastAlt, pt.y, lastPt.y));
        pts.push(midPt);
      }

      if (inSky)
        pts.push(pt);

      lastPt = pt;
      lastInSky = inSky;
      lastAlt = alt;
    }

    if (cornersUsed > 0) {
      dc.context.fillStyle = dc.groundColor;
      dc.context.beginPath();

      for (let i = 0; i < pts.length; ++i) {
        if (i === 0)
          dc.context.moveTo(pts[i].x, pts[i].y);
        else
          dc.context.lineTo(pts[i].x, pts[i].y);
      }

      dc.context.fill();
    }
  }

  protected getSkyColor(dc: DrawingContextSky, color: string, sunPos: SphericalPosition, pos: SphericalPosition, totality: number, milkyWay: boolean): string {
    if (!color)
      color = getSkyColor(sunPos, pos, totality);

    if (milkyWay) {
      pos = equatorialToGalactic(dc.skyObserver.horizontalToEquatorial(pos, dc.jdu, dc.planetFlags), dc.jde);

      const mw = this.milkyWay.getBrightness(pos) * 0.6;

      if (mw > 0) {
        const rgba = parseColor(color);
        let r = rgba.r;
        let g = rgba.g;
        let b = rgba.b;

        if (dc.inkSaver) {
          r = min(r, floor(255 - mw * 4 / 5));
          g = min(g, floor(255 - mw * 4 / 5));
          b = min(b, floor(255 - mw * 4 / 5));
        }
        else {
          r = max(r, mw);
          g = max(g, mw);
          b = max(b, mw);
        }

        color = colorFromRGB(r, g, b);
      }
    }

    return color;
  }
}
