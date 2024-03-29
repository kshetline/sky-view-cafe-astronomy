import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { MOON, TOPOCENTRIC } from '@tubular/astronomy';
import {
  abs, Angle, ceil, cos, cos_deg, floor, limitNeg1to1, max, min, Point, round, sin, sin_deg, SphericalPosition, squared, tan_deg,
  TWO_PI, Unit
} from '@tubular/math';
import { strokeCircle, strokeLine } from '@tubular/util';
import { AppService, CurrentTab, UserSetting } from '../../app.service';
import {
  DrawingContextPlanetary, MARQUEE_ECLIPTIC, MARQUEE_EQUATORIAL, MARQUEE_ILLUMINATION, MARQUEE_MAGNITUDE, MARQUEE_SIZE, NONPLANET,
  OUTER_LABEL_GAP, SUBJECT
} from '../generic-planetary-view.directive';
import {
  eclipticColor, eclipticGridColor, eclipticGridPrintColor, eclipticPrintColor, equatorColor, equatorPrintColor, GenericSkyViewDirective,
  horizonColor, horizonPrintColor
} from '../generic-sky-view.directive';
import { PROPERTY_ADDITIONALS } from '../generic-view.directive';

export const  VIEW_ECLIPTIC = 'ecliptic';
export const    PROPERTY_SPAN_25 = 'span_25';
export const    PROPERTY_ORIENTATION = 'orientation';
export const    PROPERTY_ECLIPTIC_GRID = 'ecliptic_grid';
export const    PROPERTY_CELESTIAL_EQUATOR = 'celestial_equator';
export const    PROPERTY_SHOW_CONSTELLATIONS = 'show_constellations';
export const    PROPERTY_LOCAL_HORIZON = 'local_horizon';
export const    PROPERTY_SHOW_STARS = 'show_stars';
export const    PROPERTY_BRIGHTEN_STARS = 'brighten_stars';
export const    PROPERTY_TOPOCENTRIC_MOON = 'topocentric_moon';
export const    PROPERTY_ENLARGE_SUN_MOON = 'enlarge_sun_moon';
export const    PROPERTY_LABEL_PLANETS = 'label_planets';
export const    PROPERTY_LABEL_BRIGHT_STARS = 'label_bright_stars';
export const    PROPERTY_LABEL_STARS = 'label_stars';
export const    PROPERTY_LABEL_CONSTELLATIONS = 'label_constellations';
export const    PROPERTY_LABEL_DSOS = 'label_dsos';

interface DrawingContextEcliptic extends DrawingContextPlanetary {
  gridSteps: number;
  orientation: number;
  semiSpan: number;
  span: number;
  spanDegrees: number;
}

@Component({
  selector: 'svc-ecliptic-view',
  templateUrl: './svc-ecliptic-view.component.html',
  styleUrls: ['./svc-ecliptic-view.component.scss']
})
export class SvcEclipticViewComponent extends GenericSkyViewDirective implements AfterViewInit {
  private span25 = false;
  private northOutward = true;
  private showEclipticGrid = true;
  private showCelestialEquator = true;
  private localHorizon = true;
  private showStars = true;

  @ViewChild('canvasWrapper', { static: true }) private wrapperRef: ElementRef;
  @ViewChild('skyCanvas', { static: true }) private canvasRef: ElementRef;

  constructor(app: AppService) {
    super(app, CurrentTab.ECLIPTIC);

    this.marqueeFlags = MARQUEE_ECLIPTIC | MARQUEE_EQUATORIAL | MARQUEE_MAGNITUDE |
                        MARQUEE_ILLUMINATION | MARQUEE_SIZE;
    this.topocentricMoon = true;
    this.canDrag = false;

    app.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_ECLIPTIC && setting.source !== this) {
        if (setting.property === PROPERTY_SPAN_25)
          this.span25 = setting.value as boolean;
        else if (setting.property === PROPERTY_ORIENTATION)
          this.northOutward = setting.value as boolean;
        else if (setting.property === PROPERTY_ECLIPTIC_GRID)
          this.showEclipticGrid = setting.value as boolean;
        else if (setting.property === PROPERTY_CELESTIAL_EQUATOR)
          this.showCelestialEquator = setting.value as boolean;
        else if (setting.property === PROPERTY_SHOW_CONSTELLATIONS)
          this.showConstellations = setting.value as boolean;
        else if (setting.property === PROPERTY_LOCAL_HORIZON)
          this.localHorizon = setting.value as boolean;
        else if (setting.property === PROPERTY_SHOW_STARS)
          this.showStars = setting.value as boolean;
        else if (setting.property === PROPERTY_BRIGHTEN_STARS)
          this.brightenStars(setting.value as boolean);
        else if (setting.property === PROPERTY_TOPOCENTRIC_MOON)
          this.topocentricMoon = setting.value as boolean;
        else if (setting.property === PROPERTY_ENLARGE_SUN_MOON)
          this.enlargeSunMoon = setting.value as boolean;
        else if (setting.property === PROPERTY_LABEL_PLANETS)
          this.labelPlanets = setting.value as boolean;
        else if (setting.property === PROPERTY_LABEL_BRIGHT_STARS) {
          this.labelBrightStars = setting.value as boolean;
          this.labelStars = this.labelStars && !this.labelBrightStars;
        }
        else if (setting.property === PROPERTY_LABEL_STARS) {
          this.labelStars = setting.value as boolean;
          this.labelBrightStars = this.labelBrightStars && !this.labelStars;
        }
        else if (setting.property === PROPERTY_LABEL_CONSTELLATIONS)
          this.labelConstellations = setting.value as boolean;
        else if (setting.property === PROPERTY_LABEL_DSOS)
          this.deepSkyLabelMagnitude = setting.value as number;
        else if (setting.property === PROPERTY_ADDITIONALS) {
          this.additional = setting.value as string;
          this.updatePlanetsToDraw();
        }

        this.throttledRedraw();
      }
    });
  }

  ngAfterViewInit(): void {
    this.wrapper = this.wrapperRef.nativeElement;
    this.canvas = this.canvasRef.nativeElement;

    setTimeout(() => this.app.requestViewSettings(VIEW_ECLIPTIC));

    super.ngAfterViewInit();
  }

  protected drawSky(dc: DrawingContextEcliptic): void {
    const vInset = round(dc.largeLabelFm.lineHeight * 5 / 4);
    dc.context.font = this.largeLabelFont;
    const hInset = ceil(dc.context.measureText('MMMM').width);

    dc.size = max(min(dc.w - hInset * 2, dc.h - vInset * 2), 100);

    if (dc.size % 2 !== 0)
      --dc.size;

    dc.radius = dc.size / 2;

    if (!this.span25) {
      dc.span = floor(dc.size * 0.20748);
      dc.spanDegrees = 30.0;
      dc.gridSteps = 6;
    }
    else {
      dc.span = floor(dc.size * 0.30378);
      dc.spanDegrees = 50.0;
      dc.gridSteps = 10;
    }

    dc.pixelsPerArcSec = dc.span / dc.spanDegrees / 3600.0;
    dc.semiSpan = dc.spanDegrees / 2.02;

    if (dc.span % 2 !== 0)
      --dc.span;

    if (this.northOutward)
      dc.orientation = 1.0;
    else
      dc.orientation = -1.0;

    dc.context.fillStyle = (dc.inkSaver ? 'white' : 'black');
    dc.context.fillRect(0, 0, dc.w, dc.h);

    if (this.showCelestialEquator)
      this.drawCelestialEquator(dc);

    if (this.showEclipticGrid)
      SvcEclipticViewComponent.drawEclipticGrid(dc);

    if (this.localHorizon)
      this.drawLocalHorizon(dc);
  }

  protected drawStars(dc: DrawingContextPlanetary): void {
    if (this.showStars)
      super.drawStars(dc);
  }

  protected drawSkyMask(dc: DrawingContextEcliptic): void {
    dc.context.fillStyle = (dc.inkSaver ? 'white' : '#006699');

    dc.context.beginPath();
    dc.context.arc(dc.xctr, dc.yctr, dc.radius, 0, TWO_PI, true);
    dc.context.rect(0, 0, dc.w, dc.h);
    dc.context.arc(dc.xctr, dc.yctr, dc.radius - dc.span, 0, TWO_PI);
    dc.context.fill();

    if (dc.inkSaver) {
      dc.context.strokeStyle = 'gray';
      strokeCircle(dc.context, dc.xctr, dc.yctr, dc.radius);
      strokeCircle(dc.context, dc.xctr, dc.yctr, dc.radius - dc.span);
    }
  }

  protected drawLabels(dc: DrawingContextEcliptic): void {
    const ascent = dc.largeLabelFm.fullAscent;

    dc.context.fillStyle = 'black';
    dc.context.font = this.largeLabelFont;

    for (let longitude = 0; longitude < 360; longitude += 90) {
      let x1 = this.scaledRound(dc.xctr + cos_deg(-longitude * dc.orientation) * (dc.size - 2) / 2.0);
      let y1 = this.scaledRound(dc.yctr + sin_deg(-longitude * dc.orientation) * (dc.size - 2) / 2.0);
      const label = longitude + '°';
      const textWidth = dc.context.measureText(String(longitude)).width; // Center without the degree sign

      if (longitude === 0) {
        x1 += OUTER_LABEL_GAP * 2;
        y1 += ascent / 2;
      }
      else if (longitude === 90 && dc.orientation > 0.0 || longitude === 270 && dc.orientation < 0.0) {
        x1 -= textWidth / 2; // Center without the degree sign
        y1 -= OUTER_LABEL_GAP + dc.largeLabelFm.descent;
      }
      else if (longitude === 180) {
        x1 -= OUTER_LABEL_GAP * 2 + dc.context.measureText(label).width;
        y1 += ascent / 2;
      }
      else {
        x1 -= textWidth / 2;
        y1 += OUTER_LABEL_GAP + ascent;
      }

      dc.context.fillText(label, x1, y1);
    }

    super.drawLabels(dc);
  }

  protected isInsideView(): boolean {
    if (!this.lastDrawingContext)
      return false;

    return this.withinPlot(this.lastMoveX, this.lastMoveY, this.lastDrawingContext as DrawingContextEcliptic);
  }

  protected withinPlot(x: number, y: number, dc = this.lastDrawingContext as DrawingContextEcliptic): boolean {
    if (!dc)
      return false;

    x -= dc.xctr;
    y -= dc.yctr;
    const r2 = x * x + y * y;

    return (r2 <= squared(dc.radius) && r2 >= squared(dc.radius - dc.span));
  }

  protected getSphericalPosition(bodyIndex: number, dc: DrawingContextEcliptic): SphericalPosition {
    if (bodyIndex < 0)
      return dc.sc.getEclipticPosition(-bodyIndex - 1, dc.jde, 365.25, dc.starFlags);
    else {
      let flags = dc.planetFlags;

      if (this.topocentricMoon && bodyIndex === MOON)
        flags |= TOPOCENTRIC;

      return dc.ss.getEclipticPosition(bodyIndex, dc.jde, dc.skyObserver, flags);
    }
  }

  protected sphericalToScreenXY(pos: SphericalPosition, dc: DrawingContextEcliptic, subject: SUBJECT): Point {
    return SvcEclipticViewComponent.sphericalToScreenXYAux(pos.longitude.radians, pos.latitude.degrees, dc, subject);
  }

  // Note: longitude L in radians, latitude B in degrees.
  //
  protected static sphericalToScreenXYAux(L: number, B: number, dc: DrawingContextEcliptic, subject: SUBJECT): Point {
    if (abs(B) >= dc.spanDegrees / 2.0 && (subject >= 0 || subject === NONPLANET.STARS))
      return null;

    const r = B * dc.orientation / dc.spanDegrees * dc.span + (dc.size - dc.span) / 2.0;

    return { x: (dc.xctr + cos(-L * dc.orientation) * r),
             y: (dc.yctr + sin(-L * dc.orientation) * r) };
  }

  protected getMoonShadingOrientation(dc: DrawingContextEcliptic): number {
    const moonPos = this.getSphericalPosition(MOON, dc);

    return (90.0 - moonPos.longitude.degrees) * dc.orientation;
  }

  protected drawSkyPlotLine(pt1: Point, pt2: Point, dc: DrawingContextPlanetary, _subject: SUBJECT): boolean {
    strokeLine(dc.context, pt1.x, pt1.y, pt2.x, pt2.y);

    return true;
  }

  protected drawCelestialEquator(dc: DrawingContextEcliptic): void {
    dc.context.strokeStyle = (dc.inkSaver ? equatorPrintColor : equatorColor);

    let pt2 = null;
    let B2 = null;

    for (let ra = 0; ra <= 360; ++ra) {
      const rightAscension = new Angle(ra, Unit.DEGREES);
      const equatorPoint = this.ecliptic.equatorialToEcliptic(new SphericalPosition(rightAscension, Angle.ZERO), dc.jde);

      const B1 = equatorPoint.latitude.degrees;
      const L = equatorPoint.longitude.radians;
      const pt1 = SvcEclipticViewComponent.sphericalToScreenXYAux(L, B1, dc, NONPLANET.DEFAULT);

      if (ra > 0 && abs(B1) < dc.semiSpan && abs(B2) < dc.semiSpan)
        strokeLine(dc.context, pt1.x, pt1.y, pt2.x, pt2.y);

      pt2 = pt1;
      B2 = B1;
    }
  }

  protected static drawEclipticGrid(dc: DrawingContextEcliptic): void {
    for (let i = 1; i < dc.gridSteps; ++i) {
      const r = dc.radius - i * dc.span / dc.gridSteps;

      if (i === dc.gridSteps / 2)
        dc.context.strokeStyle = (dc.inkSaver ? eclipticPrintColor : eclipticColor);
      else
        dc.context.strokeStyle = (dc.inkSaver ? eclipticGridPrintColor : eclipticGridColor);

      strokeCircle(dc.context, dc.xctr, dc.yctr, r);
    }

    for (let longitude = 0; longitude < 360; longitude += 15) {
      const x1 = (dc.xctr + cos_deg(-longitude * dc.orientation) * (dc.size - 2) / 2.0);
      const y1 = (dc.yctr + sin_deg(-longitude * dc.orientation) * (dc.size - 2) / 2.0);

      const x2 = (dc.xctr + cos_deg(-longitude * dc.orientation) * (dc.size - dc.span * 2 + 2) / 2.0);
      const y2 = (dc.yctr + sin_deg(-longitude * dc.orientation) * (dc.size - dc.span * 2 + 2) / 2.0);

      if (longitude === 0)
        dc.context.strokeStyle = (dc.inkSaver ? eclipticPrintColor : eclipticColor);
      else
        dc.context.strokeStyle = (dc.inkSaver ? eclipticGridPrintColor : eclipticGridColor);

      strokeLine(dc.context, x1, y1, x2, y2);
    }
  }

  protected drawLocalHorizon(dc: DrawingContextEcliptic): void {
    const localHourAngle = dc.skyObserver.getLocalHourAngle(dc.jdu, false);
    const sin_lat = dc.skyObserver.latitude.sin;
    const cos_lat = dc.skyObserver.latitude.cos;
    let hadj1: number, hadj2: number, step: number, B2: number = null;
    let pt2: Point = null;

    dc.context.fillStyle = (dc.inkSaver ? horizonPrintColor : horizonColor);
    dc.context.strokeStyle = (dc.inkSaver ? horizonPrintColor : horizonColor);

    // Two passes -- first to do the horizon, then a dotted line two degrees above the horizon.

    for (let i = 0; i < 2; ++i) {
      if (i === 0) {
        hadj1 = 0.0;
        hadj2 = 0.0;
        step = 1;
      }
      else {
        hadj1 = tan_deg(2) * cos_lat;
        hadj2 = sin_deg(2) * sin_lat;
        step = 2;
      }

      for (let az = 0; az <= 360; az += step) {
        const azimuth = new Angle(az, Unit.DEGREES);
        const hourAngle = Angle.atan2(azimuth.sin, azimuth.cos * sin_lat + hadj1);
        const rightAscension = localHourAngle.subtract_nonneg(hourAngle);
        const declination = Angle.asin(limitNeg1to1(hadj2 - cos_lat * azimuth.cos));
        const horizonPoint = this.ecliptic.equatorialToEcliptic(new SphericalPosition(
          rightAscension, declination), dc.jde);

        const B1 = horizonPoint.latitude.degrees;
        const L = horizonPoint.longitude.radians;
        const pt1 = SvcEclipticViewComponent.sphericalToScreenXYAux(L, B1, dc, NONPLANET.DEFAULT);

        if (i === 0 && az > 0 && abs(B1) < dc.semiSpan && abs(B2) < dc.semiSpan)
          strokeLine(dc.context, pt1.x, pt1.y, pt2.x, pt2.y);
        else if (i === 1 && abs(B1) < dc.semiSpan)
          dc.context.fillRect(pt1.x, pt1.y, 1, 1);

        pt2 = pt1;
        B2 = B1;
      }
    }
  }
}
