import { AfterViewInit, Directive } from '@angular/core';
import * as C_ from '@tubular/astronomy';
import {
  ABERRATION, EARTH, Ecliptic, KM_PER_AU, MOON, MOON_SHADOW, NEPTUNE, NO_MATCH, NO_SELECTION, NUTATION, PlanetaryMoons, PLUTO,
  SolarSystem, SUN, TOPOCENTRIC, UNKNOWN_MAGNITUDE, URANUS
} from '@tubular/astronomy';
import {
  abs, Angle, cos_deg, floor, FMT_MINS, FMT_SECS, intersects, max, min, mod2, Point, Rectangle, round, sin_deg, SphericalPosition,
  SphericalPosition3D, sqrt, TWO_PI, union
} from '@tubular/math';
import { getTextWidth, toDefaultLocaleFixed } from '@tubular/util';
import { AppService, CurrentTab, PROPERTY_NORTH_AZIMUTH, UserSetting, VIEW_APP } from '../app.service';
import { DrawingContext, GenericViewDirective } from './generic-view.directive';

export interface SortablePlanet {
  planet: number;
  pos: SphericalPosition;
}

export enum LABEL_CLASS {MINOR, STAR_OR_PLANET, CONSTELLATION}
export enum LABEL_TYPE {STAR, DSO, PLANET, CONSTELLATION, SOLE_CONSTELLATION, MOON, HIDDEN_MOON}
export enum SELECTION_TYPE {NONE, STAR, PLANET, DSO, MOON, MOON_SHADOW, CONSTELLATION, PRIORITY_DSO}

export interface LabelInfo {
  name: string;
  pt: Point;
  bodyIndex: number;
  labelClass?: LABEL_CLASS;
  labelType: LABEL_TYPE;
  overlapped?: boolean;
  overrideColor?: string;
  offsetColor?: string;
  offsetX?: number;
  dimmed?: boolean;
  hidden?: boolean;
  textPt?: Point;
  symbolBounds?: Rectangle;
  labelBounds?: Rectangle;
}

export const starColor               = 'gray';
export const moonColor               = 'white';
export const moonPrintColor          = 'black';
export const highlightedStarColor    = '#FF66CC';
export const highlightFromWhite      = '#FFFFCC';
export const constellationLabelColor = '#00CCCC';
export const deepSkyLabelColor       = '#FFFFCC';
export const dimmedLabelColor        = '#999999';
export const hiddenMoonColor         = 'gray';
export const trackOffscreenColor     = 'orange';
export const trackOnscreenColor      = 'cyan';
export const dsoColor                = '#AA55CC';
export const asteroidColor           = '#EEBB88';
export const cometColor              = '#88FFFF';

export const planetColors = [
  'yellow',  '#C0C0C0', '#EEEEFF', // Sun, Mercury, Venus
  '#00CCCC', 'red',     'orange',  // Earth, Mars, Jupiter
  'yellow',  '#00DD00', '#6666FF', // Saturn, Uranus, Neptune
  '#9999FF', '#EEEEFF',            // Pluto, Moon
  asteroidColor, cometColor
];

export const planetPrintColors = [
  '#CCCC00', 'gray',    'black',   // Sun, Mercury, Venus
  '#00CCCC', 'red',     'orange',  // Earth, Mars, Jupiter
  '#CCCC00', '#00DD00', '#3333FF', // Saturn, Uranus, Neptune
  '#9999FF', '#99CCFF',            // Pluto, Moon
  asteroidColor, cometColor
];

export const ASTEROID_COLOR_INDEX = 11;
export const COMET_COLOR_INDEX = 12;

export const MARQUEE_ECLIPTIC     = 0x0001;
export const MARQUEE_HELIOCENTRIC = 0x0002;
export const MARQUEE_EQUATORIAL   = 0x0004;
export const MARQUEE_HORIZONTAL   = 0x0008;
export const MARQUEE_MAGNITUDE    = 0x0010;
export const MARQUEE_ILLUMINATION = 0x0020;
export const MARQUEE_SIZE         = 0x0040;
export const MARQUEE_DISTANCE     = 0x0080;
export const    MARQUEE_AU        = 0;
export const    MARQUEE_KM        = 1;
export const    MARQUEE_MILES     = 2;

// These color specifications are left incomplete so that the alpha value can be varied.
const SHADED_MOON            = 'rgba(102,153,204,';
const INTERMEDIATE_MOON      = 'rgba(178,204,229,';
const ILLUMINATED_MOON       = 'rgba(255,255,255,';
const ILLUMINATED_MOON_PRINT = 'rgba(221,221,187,';

export interface DrawingContextPlanetary extends DrawingContext {
  size: number;
  radius: number;
  xctr: number;
  yctr: number;
  labels: LabelInfo[];
  heavyLabels: boolean;
  hiddenLabels: number;
  pixelsPerArcSec: number;
  planetFlags: number;
  planetSizes: number[];
  minStarBrightness: number;
  scaleBoost: number;
  selectionDistance: number;
  selectionExact: boolean;
  selectionType: SELECTION_TYPE;
  selectionIndex: number;
  selectionLabeled: boolean;
  selectionPoint: Point;
  selectionOnscreen: boolean;
  starBrightestLevel: number;
  starDimmestLevel: number;
  starFlags: number;
  starLevelRange: number;
}

export enum NONPLANET {DEFAULT = -1, CONSTELLATIONS = -2, STARS = -3, MOONSHADE = -4}
export type SUBJECT = NONPLANET | number;
export const OUTER_LABEL_GAP = 2;
const STAR_LABEL_GAP    = 3;
const PLANET_LABEL_GAP  = 4;
const LABEL_VADJ        = 4;
const DSO_LABEL_GAP     = 6;
const SUN_MOON_GAP      = 6;
const HIDE_LABEL_RADIUS = 75;
const POINTING_MIN_DISTANCE = 8;
const PLANET_EXTRA_SPAN     = 2;
const STAR_REDUCED_SPAN     = 2;
export const FAR_AWAY = 999999;

const DIMMEST_AT_SCALE_1x1_STAR_IMAGE_INDEX = 100;

const opacitiesOfWhite: string[] = [];
const opacitiesOfBlack: string[] = [];

for (let i = 0; i <= 255; ++i) {
  opacitiesOfWhite[i] = 'rgba(255,255,255,' + (i / 255).toFixed(3) + ')';
  opacitiesOfBlack[i] = 'rgba(0,0,0,' + (i / 255).toFixed(3) + ')';
}

@Directive()
export abstract class GenericPlanetaryViewDirective extends GenericViewDirective implements AfterViewInit {
  protected ecliptic = new Ecliptic();
  protected starsReady = false;
  protected asteroidsReady = false;
  protected enlargeSunMoon = false;
  protected marqueeFlags = 0;
  protected marqueeUnits = MARQUEE_AU;
  protected specialLabelIndex = NO_SELECTION;
  protected starBaseBrightness: number;
  protected starBrightnessAdj: number;
  protected starContrastAdj: number;
  protected starMaxRadius: number;
  protected topocentricMoon = false;
  protected northAzimuth = false;

  protected constructor(protected appService: AppService, protected tabId: CurrentTab) {
    super(appService, tabId);

    this.brightenStars(false);
    this.starsReady = appService.starsReady;
    this.asteroidsReady = appService.asteroidsReady;

    if (!this.starsReady) {
      appService.getStarsReadyUpdate((initialized) => {
        this.starsReady = initialized;

        if (initialized)
          this.draw();
      });
    }

    if (!this.asteroidsReady) {
      appService.getAsteroidsReadyUpdate((initialized) => {
        this.asteroidsReady = initialized;

        if (initialized) {
          this.updatePlanetsToDraw();
          this.draw();
        }
      });
    }
    else
      this.updatePlanetsToDraw();

    appService.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_APP) {
        if (setting.property === PROPERTY_NORTH_AZIMUTH) {
          if (this.northAzimuth !== setting.value) {
            this.northAzimuth = setting.value as boolean;
            this.draw();
          }
        }
      }
    });
  }

  protected clearMouseHighlighting(): void {
    super.clearMouseHighlighting();

    if (this.lastDrawingContext) {
      if (this.specialLabelIndex === NO_MATCH)
        this.marqueeText = '';
      else
        this.showSelection(this.lastDrawingContext as DrawingContextPlanetary);
    }
  }

  protected additionalDrawingSetup(dc: DrawingContextPlanetary): void {
    dc.size = dc.radius * 2;
    dc.xctr = floor(dc.w / 2);
    dc.yctr = floor(dc.h / 2);
    dc.pixelsPerArcSec = dc.w / 90.0 / 3600.0;

    dc.selectionDistance = Number.MAX_SAFE_INTEGER;
    dc.selectionExact = false;
    dc.selectionType = SELECTION_TYPE.NONE;
    dc.selectionPoint = null;
    dc.selectionOnscreen = false;
    dc.selectionLabeled = false;

    dc.starFlags = 0;
    dc.planetFlags = ABERRATION | NUTATION;
    dc.planetSizes = [];
    dc.minStarBrightness = 0;
    dc.labels = [];
    dc.hiddenLabels = 0;
  }

  protected additionalDrawingSteps(dc: DrawingContextPlanetary): void {
    this.drawLabels(dc);
    this.showSelection(dc);

    if (dc.inkSaver) {
      dc.context.strokeStyle = 'black';
      dc.context.strokeRect(0, 0, dc.w, dc.h);
    }
  }

  protected checkRefraction(): boolean {
    return false;
  }

  protected brightenStars(brighter: boolean): void {
    this.starBaseBrightness = brighter ? round(DIMMEST_AT_SCALE_1x1_STAR_IMAGE_INDEX * 1.5) : DIMMEST_AT_SCALE_1x1_STAR_IMAGE_INDEX;
    this.starBrightnessAdj  = brighter ? -0.5 : 0.0;
    this.starContrastAdj    = brighter ?  1.3 : 1.2;
    this.starMaxRadius      = brighter ?  2.5 : 2.0;
  }

  protected drawStar(pt: Point, vmag: number, dc: DrawingContextPlanetary, colorForPlanetDrawnAsStar?: string): void {
    const { x, y } = pt;

    const maxRange = (colorForPlanetDrawnAsStar ? 2000 - dc.starDimmestLevel - 1 : dc.starLevelRange);
    const brightness = min(max(dc.starLevelRange - round((vmag + 1.0 + this.starBrightnessAdj) / 7.0 *
          dc.starLevelRange * this.starContrastAdj), 0), maxRange) + dc.starDimmestLevel;
    const radius = brightness / 500;

    if (radius < 0.564 && !colorForPlanetDrawnAsStar) { // 0.564 is the radius of circle with an area of 1.
      const shade = round(radius * 452.13); // 0->0.564 transformed to a 0-255 range.

      dc.context.fillStyle = (dc.inkSaver ? opacitiesOfBlack[shade] : opacitiesOfWhite[shade]);
      dc.context.fillRect(x, y, 1, 1);
    }
    else {
      dc.context.beginPath();
      dc.context.arc(x + 0.5, y + 0.5, min(radius, this.starMaxRadius), 0, TWO_PI);
      dc.context.fillStyle = colorForPlanetDrawnAsStar || (dc.inkSaver ? 'black' : 'white');
      dc.context.fill();
    }
  }

  protected drawPlanet(planet: number, pt: Point, dc: DrawingContextPlanetary, colorOverride?: string): void {
    const { x, y } = pt;
    let size = 3;
    let color: string;

    if (planet === C_.SUN || planet === C_.MOON) {
      if (dc.pixelsPerArcSec > 0.0) {
        size = round(dc.ss.getAngularDiameter(planet, dc.jde) * dc.pixelsPerArcSec);
        size += (size + 1) % 2;
      }

      if (this.enlargeSunMoon && size < 12)
        size = 12;
      else if (size < 6)
        size = 6;
    }

    if (SolarSystem.isNominalPlanet(planet))
      dc.planetSizes[planet] = size;

    if (colorOverride)
      color = colorOverride;
    else if (SolarSystem.isNominalPlanet(planet))
      color = (dc.inkSaver ? planetPrintColors[planet] : planetColors[planet]);
    else if (SolarSystem.isAsteroid(planet))
      color = asteroidColor;
    else
      color = cometColor;

    const r0 = floor(size / 2);

    if (planet === MOON) {
      const phase = dc.ss.getLunarPhase(dc.jde);
      const coverage = (cos_deg(phase) + 1.0) / 2.0;
      const shadeAngle = this.getMoonShadingOrientation(dc);
      const sin_sa = sin_deg(shadeAngle);
      const cos_sa = cos_deg(shadeAngle);
      const r02 = r0 * r0;

      for (let dy = -r0 - 1; dy <= r0 + 1; ++dy) {
        for (let dx = -r0 - 1; dx <= r0 + 1; ++dx) {
          const rot_x = dx * cos_sa + dy * sin_sa;
          const rot_y = dy * cos_sa - dx * sin_sa;
          const r = sqrt(rot_x * rot_x + rot_y * rot_y);

          if (r <= r0 + 1) {
            let alpha = 1.0;

            if (r > r0)
              alpha = 1.0 - r + r0;

            if (abs(mod2(phase, 360)) < 20.0) {
              color = SHADED_MOON;
            }
            else if (abs(phase - 180.0) < 20.0)
              color = (dc.inkSaver ? ILLUMINATED_MOON_PRINT : ILLUMINATED_MOON);
            else {
              const lineWidth = 2 * sqrt(max(r02 - rot_y * rot_y, 0.0)) + 1.0;
              const inset = rot_x + (lineWidth - 1.0) / 2;
              const shadowWidth = coverage * lineWidth;
              let leftSpan: number;

              if (phase <= 180.0)
                leftSpan = shadowWidth - 0.5;
              else
                leftSpan = lineWidth - shadowWidth - 0.5;

              if ((phase <= 180.0 && inset < leftSpan + 0.25) ||
                  (phase  > 180.0 && inset > leftSpan + 0.25))
                color = SHADED_MOON;
              else if (abs(inset - leftSpan) <= 0.5) {
                color = INTERMEDIATE_MOON;
              }
              else
                color = (dc.inkSaver ? ILLUMINATED_MOON_PRINT : ILLUMINATED_MOON);
            }

            dc.context.fillStyle = color + alpha + ')';
            dc.context.fillRect(x + dx, y + dy, 1, 1);
          }
        }
      }
    }
    else {
      // If scaled drawing is being done, draw potentially bright planets as stars before drawing them in the
      // usual rectangle/circle form, just in case the star form would be larger, so that a bright planet
      // doesn't get lost by size comparison amid otherwise larger/brighter looking stars.
      if (dc.pixelsPerArcSec > 0.0 && (planet === C_.VENUS || planet === C_.MARS || planet === C_.JUPITER)) {
        const vmag = dc.ss.getMagnitude(planet, dc.jde);

        this.drawStar(pt, vmag, dc, color);
      }

      dc.context.fillStyle = color;

      if (size <= 3)
        dc.context.fillRect(x - r0, y - r0, size, size);
      else {
        dc.context.beginPath();
        dc.context.arc(x + 0.5, y + 0.5, r0, 0, TWO_PI);
        dc.context.fill();
      }
    }
  }

  protected getMoonShadingOrientation(_dc: DrawingContextPlanetary): number {
    return 0.0;
  }

  protected drawLabels(dc: DrawingContextPlanetary): void {
    GenericPlanetaryViewDirective.adjustLabelsToAvoidOverlap(dc);
    this.drawLabelsAux(dc, false);
    this.drawHiddenLabelNearestMousePoint(dc);
  }

  protected drawLabelsAux(dc: DrawingContextPlanetary, hidden: boolean): void {
    for (const li of dc.labels) {
      if (Boolean(li.hidden) === hidden)
        this.drawLabel(li, li.bodyIndex === dc.selectionIndex, dc);
    }
  }

  protected drawLabel(li: LabelInfo, showHighlighting: boolean, dc: DrawingContextPlanetary): void {
    let labelColor;
    const heavy = dc.heavyLabels || li.bodyIndex === SUN || li.bodyIndex === MOON;

    if (li.labelType !== LABEL_TYPE.CONSTELLATION && li.labelType !== LABEL_TYPE.SOLE_CONSTELLATION)
      dc.context.font = this.mediumLabelFont;
    else
      dc.context.font = this.smallLabelFont;

    if (li.overrideColor)
      labelColor = li.overrideColor;
    else if (li.dimmed)
      labelColor = dimmedLabelColor;
    else {
      switch (li.labelType) {
        case LABEL_TYPE.STAR:
        case LABEL_TYPE.DSO:
          if (showHighlighting ||
              (li.bodyIndex === this.specialLabelIndex && li.bodyIndex === dc.selectionIndex &&
               dc.selectionDistance < FAR_AWAY))
            labelColor = highlightedStarColor;
          else
            labelColor = (li.labelType === LABEL_TYPE.DSO ? dsoColor : starColor);
          break;

        case LABEL_TYPE.PLANET:
          if (C_.FIRST_PLANET <= li.bodyIndex && li.bodyIndex <= C_.LAST_PLANET)
            labelColor = (dc.inkSaver ? planetPrintColors[li.bodyIndex] : planetColors[li.bodyIndex]);
          else if (SolarSystem.isAsteroid(li.bodyIndex))
            labelColor = asteroidColor;
          else
            labelColor = cometColor;
          break;

        case LABEL_TYPE.CONSTELLATION:
        case LABEL_TYPE.SOLE_CONSTELLATION:
          labelColor = constellationLabelColor;
          break;

        case LABEL_TYPE.HIDDEN_MOON:
          labelColor = hiddenMoonColor;
          break;

        case LABEL_TYPE.MOON:
        default:
          labelColor = (dc.inkSaver ? moonPrintColor : moonColor);
          break;
      }
    }

    const outlineColor = (dc.inkSaver ? 'white' : 'black');

    dc.context.fillStyle = outlineColor;
    dc.context.strokeStyle = outlineColor;

    if (heavy || dc.inkSaver) { // Black (or white) background for text.
      dc.context.save();
      dc.context.lineWidth = 4;

      if (li.labelBounds) {
        dc.context.rect(li.labelBounds.x - 1, li.labelBounds.y - 1, li.labelBounds.w + 2, li.labelBounds.h + 2);
        dc.context.clip();
      }

      dc.context.lineJoin = 'round';
      dc.context.strokeText(li.name, li.textPt.x, li.textPt.y);
      dc.context.restore();
    }
    else
      dc.context.fillText(li.name, li.textPt.x + 1, li.textPt.y + 1); // Drop shadow.

    let x1 = -1, y1 = -1, w = -1;

    // When label color doesn't change with highlighting, use an underline for emphasis.
    if (showHighlighting && (li.labelType === LABEL_TYPE.PLANET || li.labelType === LABEL_TYPE.MOON || li.overrideColor)) {
      x1 = li.textPt.x + 1;
      w = round(dc.context.measureText(li.name).width);
      y1 = li.textPt.y + 2;

      dc.context.fillStyle = outlineColor;
      dc.context.fillRect(x1 - 0.5, y1 - 0.5, w + 1, 2);
      dc.context.fillStyle = labelColor;
      dc.context.fillRect(x1 - 1, y1 - 1, w, 1);
    }

    dc.context.fillStyle = labelColor;
    dc.context.fillText(li.name, li.textPt.x, li.textPt.y);

    if (li.offsetColor) {
      dc.context.fillStyle = li.offsetColor;
      dc.context.globalCompositeOperation = 'lighten';

      if (w >= 0)
        dc.context.fillRect(x1 - 1 + li.offsetX, y1 - 1, w, 1);

      dc.context.fillText(li.name, li.textPt.x + li.offsetX, li.textPt.y);
      dc.context.globalCompositeOperation = 'source-over';
    }
  }

  protected addLabel(li: LabelInfo, dc: DrawingContextPlanetary): void {
    let textWidth: number;

    li.textPt = {} as Point;
    li.overlapped = false;

    if (li.labelType === LABEL_TYPE.CONSTELLATION || li.labelType === LABEL_TYPE.SOLE_CONSTELLATION) {
      textWidth = getTextWidth(li.name, this.smallLabelFont);
      li.textPt.x = li.pt.x -  textWidth / 2;
    }
    else {
      textWidth = getTextWidth(li.name, this.mediumLabelFont);

      if      (li.labelType === LABEL_TYPE.STAR)
        li.textPt.x = li.pt.x + STAR_LABEL_GAP;
      else if (li.labelType === LABEL_TYPE.DSO)
        li.textPt.x = li.pt.x + DSO_LABEL_GAP;
      else if (li.bodyIndex === SUN || li.bodyIndex === MOON)
        li.textPt.x = li.pt.x + SUN_MOON_GAP;
      else
        li.textPt.x = li.pt.x + PLANET_LABEL_GAP;
    }

    li.textPt.y = li.pt.y + LABEL_VADJ;

    let crowdedDso = false;

    if (li.labelType === LABEL_TYPE.DSO) {
      const ngc = dc.sc.getNgcNumber(-1 - li.bodyIndex);
      crowdedDso = (ngc === 869 || ngc === 884);
    }

    if      (li.labelType === LABEL_TYPE.PLANET || li.labelType === LABEL_TYPE.STAR ||
             li.labelType === LABEL_TYPE.MOON   || li.labelType === LABEL_TYPE.HIDDEN_MOON ||
             li.labelType === LABEL_TYPE.SOLE_CONSTELLATION ||
             li.bodyIndex === dc.selectionIndex || crowdedDso)
      li.labelClass = LABEL_CLASS.STAR_OR_PLANET;
    else if (li.labelType === LABEL_TYPE.CONSTELLATION)
      li.labelClass = LABEL_CLASS.CONSTELLATION;
    else
      li.labelClass = LABEL_CLASS.MINOR;

    if (li.labelClass !== LABEL_CLASS.MINOR) {
      const ascent = dc.mediumLabelFm.ascent;
      const labelH = ascent + dc.mediumLabelFm.descent - 1;

      li.symbolBounds = { x: li.pt.x - 2, y: li.pt.y - 2,          w: 5,         h: 5 };
      li.labelBounds  = { x: li.textPt.x, y: li.textPt.y - ascent, w: textWidth, h: labelH };
    }

    if (li.labelType !== LABEL_TYPE.CONSTELLATION && this.withinHideZone(li.textPt, textWidth)) {
      li.hidden = true;
      ++dc.hiddenLabels;
    }

    dc.labels.push(li);
  }

  protected static adjustLabelsToAvoidOverlap(dc: DrawingContextPlanetary): void {
    for (const li of dc.labels) {
      if (li.labelClass !== LABEL_CLASS.MINOR) {
        let delta = GenericPlanetaryViewDirective.checkForOverlap(li, -1, false, dc);

        if (delta !== 0) {
          li.labelBounds.y += delta;
          li.textPt.y      += delta;

          if (GenericPlanetaryViewDirective.checkForOverlap(li, -1, false, dc) !== 0) {
            li.labelBounds.y -= delta;
            li.textPt.y      -= delta;
            delta = GenericPlanetaryViewDirective.checkForOverlap(li, 1, false, dc);
            li.labelBounds.y += delta;
            li.textPt.y      += delta;

            if (GenericPlanetaryViewDirective.checkForOverlap(li, 1, true, dc) !== 0) {
              li.labelBounds.y -= delta;
              li.textPt.y      -= delta;
            }
          }
        }
      }
    }

    // If a label which has been tested for overlapping does not overlap anything,
    // there's no need to hide the label when the cursor is nearby, since the
    // hiding is done mainly to pick out overlapped labels and reduce overlap clutter.
    for (const li of dc.labels) {
      if (li.labelClass !== LABEL_CLASS.MINOR && !li.overlapped && li.hidden) {
        li.hidden = false;
        --dc.hiddenLabels;
      }
    }
  }

  protected static checkForOverlap(li: LabelInfo, bias: number, markOverlaps: boolean, dc: DrawingContextPlanetary): number {
    for (const li2 of dc.labels) {
      if (li === li2 || li.labelClass !== li2.labelClass)
        continue;

      if (intersects(li.labelBounds, li2.labelBounds) || intersects(li.labelBounds, li2.symbolBounds)) {
        const r = union(li2.labelBounds, li2.symbolBounds);
        const h = li.labelBounds.h;

        if (markOverlaps) {
          li.overlapped = true;
          li2.overlapped = true;
        }

        if ((bias <= 0 && li.pt.y < li2.pt.y) || (bias > 0 && li.pt.y >= li2.pt.y))
          return max(r.y - li.labelBounds.y - h, -h);
        else
          return min(r.y + r.h - li.labelBounds.y, h);
      }
    }

    return 0;
  }

  protected withinHideZone(textPt: Point, _textWidth: number): boolean {
    if (this.specialLabelIndex !== NO_MATCH)
      return false;

    const x = textPt.x - this.lastMoveX;
    const y = textPt.y - this.lastMoveY;
    const r2 = x * x + y * y;

    return (r2 <= HIDE_LABEL_RADIUS * HIDE_LABEL_RADIUS);
  }

  protected qualifyBodyForSelection(pt: Point, selType: SELECTION_TYPE, bodyIndex: number, onscreen: boolean, dc: DrawingContextPlanetary): void {
    let extraTolerance = 0;

    if (selType === SELECTION_TYPE.PLANET && bodyIndex < dc.planetSizes.length)
      extraTolerance = round(dc.planetSizes[bodyIndex] / 2);

    const isNear = onscreen && this.nearMousePoint(pt, extraTolerance);
    let exact = false;

    if (isNear || bodyIndex === this.specialLabelIndex) {
      let d;

      if (isNear) {
        d = max(this.distanceFromMousePoint(pt) - extraTolerance, 0);
        exact = (d === 0);

        // Make planets a little easier to select, and DSOs a little harder to select
        // than nearby stars.
        if (selType === SELECTION_TYPE.PLANET || selType === SELECTION_TYPE.PRIORITY_DSO)
          d -= PLANET_EXTRA_SPAN;
        else if (selType === SELECTION_TYPE.STAR)
          d += STAR_REDUCED_SPAN;
      }
      else
        d = FAR_AWAY;

      if (d <= dc.selectionDistance && (exact || !dc.selectionExact)) {
        dc.selectionDistance = d;
        dc.selectionExact    = exact;
        dc.selectionType     = selType;
        dc.selectionIndex    = bodyIndex;
        dc.selectionPoint    = pt;
        dc.selectionOnscreen = onscreen;

        if (dc.selectionType === SELECTION_TYPE.PRIORITY_DSO)
          dc.selectionType = SELECTION_TYPE.DSO;
      }
    }
  }

  protected nearMousePoint(pt: Point, extraTolerance = 0): boolean {
    if (this.lastMoveX < 0 || this.lastMoveY < 0 || !pt)
      return false;

    const dx = this.lastMoveX - pt.x;
    const dy = this.lastMoveY - pt.y;

    return (sqrt(dx * dx + dy * dy) - extraTolerance < POINTING_MIN_DISTANCE);
  }

  protected distanceFromMousePoint(pt: Point): number {
    if (this.lastMoveX < 0 || this.lastMoveY < 0 || !pt)
      return Number.MAX_SAFE_INTEGER;

    const dx = this.lastMoveX - pt.x;
    const dy = this.lastMoveY - pt.y;

    return round(sqrt(dx * dx + dy * dy));
  }

  protected drawHiddenLabelNearestMousePoint(dc: DrawingContextPlanetary): void {
    if (dc.hiddenLabels === 0)
      return;
    else if (dc.selectionType === SELECTION_TYPE.NONE) {
      this.drawLabelsAux(dc, true);

      return;
    }

    let li: LabelInfo;
    let li2: LabelInfo;
    let closest = Number.MAX_SAFE_INTEGER;

    // We'll look in reverse order of plotting for the nearest
    // label, because the brightest/nearest objects are plotted
    // last, and they should have label-visibility priority.

    for (let i = dc.labels.length - 1; i >= 0; --i) {
      li2 = dc.labels[i];

      if (!li2.hidden)
        continue;

      const r2 = this.distanceFromMousePoint(li2.pt);

      if (!li || r2 < closest) {
        li = li2;
        closest = r2;
      }
    }

    if (!li)
      return;

    // The selected object might not have a label, and showing the nearest labeled
    // as highlighted would be confusing, so we'll set the label color back to normal
    // and not draw the highlighted selection dot.

    const isSelected = (li.bodyIndex === dc.selectionIndex);

    if (dc.selectionPoint && !isSelected)
      li.dimmed = true;
    else if (dc.selectionPoint)
      dc.selectionLabeled = true;

    if (li.bodyIndex < 0 && this.withinPlot(li.pt.x, li.pt.y, dc)) {
      if (li.dimmed)
        dc.context.fillStyle = dimmedLabelColor;
      else
        dc.context.fillStyle = highlightedStarColor;

      dc.context.fillRect(li.pt.x, li.pt.y, 2, 2);
    }

    this.drawLabel(li, isSelected, dc);
  }

  protected showSelection(dc: DrawingContextPlanetary): void {
    if (dc.selectionDistance === FAR_AWAY && this.lastMoveX >= 0 || dc.selectionType === SELECTION_TYPE.NONE || dc.inkSaver) {
      this.marqueeText = '';

      return;
    }

    let name: string;
    let info = '';
    let eclPos: SphericalPosition;
    let equPos: SphericalPosition;
    let horPos: SphericalPosition;
    let helPos: SphericalPosition3D;
    let vmag = UNKNOWN_MAGNITUDE;
    let illum = -1;
    let diam = 0.0;
    let starIndex;
    const format = (SolarSystem.isAsteroidOrComet(dc.selectionIndex) ? FMT_MINS : FMT_SECS);
    const separator = ' • ';

    switch (dc.selectionType) {
      case SELECTION_TYPE.STAR:
      case SELECTION_TYPE.DSO:
        starIndex = -dc.selectionIndex - 1;
        name = dc.sc.getExpandedName(starIndex);

        if (!name)
          name = dc.sc.getCodedName(starIndex);

        if (!dc.selectionLabeled && dc.selectionOnscreen && this.withinPlot(dc.selectionPoint.x, dc.selectionPoint.y, dc)) {
          dc.context.fillStyle = highlightedStarColor;
          dc.context.fillRect(dc.selectionPoint.x, dc.selectionPoint.y, 2, 2);
        }

        if ((this.marqueeFlags & MARQUEE_ECLIPTIC) !== 0)
          eclPos = dc.sc.getEclipticPosition(starIndex, dc.jde, 0, dc.starFlags | ABERRATION | NUTATION);

        if ((this.marqueeFlags & MARQUEE_EQUATORIAL) !== 0)
          equPos = dc.sc.getEquatorialPosition(starIndex, dc.jde, 0, dc.starFlags | ABERRATION | NUTATION);

        if ((this.marqueeFlags & MARQUEE_HORIZONTAL) !== 0)
          horPos = dc.sc.getHorizontalPosition(starIndex, dc.jdu, dc.skyObserver, 0, dc.starFlags | ABERRATION | NUTATION);

        if ((this.marqueeFlags & MARQUEE_MAGNITUDE) !== 0)
          vmag = dc.sc.getMagnitude(starIndex);
        break;

      case SELECTION_TYPE.PLANET:
        name = dc.ss.getPlanetName(dc.selectionIndex);

        if (dc.selectionIndex !== EARTH) {
          let flags = dc.planetFlags;

          if (this.topocentricMoon && dc.selectionIndex === MOON)
            flags |= TOPOCENTRIC;

          if ((this.marqueeFlags & MARQUEE_ECLIPTIC) !== 0)
            eclPos = dc.ss.getEclipticPosition(dc.selectionIndex, dc.jde, dc.skyObserver, flags);

          if ((this.marqueeFlags & MARQUEE_EQUATORIAL) !== 0)
            equPos = dc.ss.getEquatorialPosition(dc.selectionIndex, dc.jde, dc.skyObserver, flags);

          if (dc.selectionIndex === MOON)
            flags |= TOPOCENTRIC;

          if ((this.marqueeFlags & MARQUEE_HORIZONTAL) !== 0)
            horPos = dc.ss.getHorizontalPosition(dc.selectionIndex, dc.jdu, dc.skyObserver, flags);

          if ((this.marqueeFlags & MARQUEE_SIZE) !== 0)
            diam = dc.ss.getAngularDiameter(dc.selectionIndex, dc.jde, this.topocentricMoon ? dc.skyObserver : null);

          if ((this.marqueeFlags & MARQUEE_ILLUMINATION) !== 0 &&
              dc.selectionIndex !== SUN &&
              dc.selectionIndex !== URANUS &&
              dc.selectionIndex !== NEPTUNE &&
              dc.selectionIndex !== PLUTO &&
              !SolarSystem.isAsteroidOrComet(dc.selectionIndex))
            illum = dc.ss.getIlluminatedFraction(dc.selectionIndex, dc.jde) * 100.0;

          if ((this.marqueeFlags & MARQUEE_MAGNITUDE) !== 0)
            vmag = dc.ss.getMagnitude(dc.selectionIndex, dc.jde);
        }

        if (dc.selectionIndex !== SUN && (this.marqueeFlags & MARQUEE_HELIOCENTRIC) !== 0)
          helPos = dc.ss.getHeliocentricPosition(dc.selectionIndex, dc.jde);
        break;

      case SELECTION_TYPE.MOON:
        name = PlanetaryMoons.getMoonName(dc.selectionIndex) + ' (' +
               PlanetaryMoons.getMoonNumber(dc.selectionIndex) + ')';
        break;

      case SELECTION_TYPE.MOON_SHADOW:
        name = PlanetaryMoons.getMoonName(dc.selectionIndex, MOON_SHADOW) + ' (' +
               PlanetaryMoons.getMoonNumber(dc.selectionIndex) + ')';
    }

    if (eclPos) {
      info = (info ? info + separator : '');
      info += 'Long. = ' + eclPos.longitude.toString(format);
      info += ', Lat. = ' + eclPos.latitude.toString(format);

      if ((this.marqueeFlags & MARQUEE_DISTANCE) !== 0) {
        const r = (eclPos as SphericalPosition3D).radius;

        if (this.marqueeUnits === MARQUEE_AU)
          info += ', Dist. ' + r.toFixed(4) + ' AU';
        else if (this.marqueeUnits === MARQUEE_KM)
          info += ', Dist. ' + toDefaultLocaleFixed(r * KM_PER_AU, 0, 0) + ' km';
        else if (this.marqueeUnits === MARQUEE_MILES)
          info += ', Dist. ' + toDefaultLocaleFixed(r * KM_PER_AU / 1.609344, 0, 0) + ' miles';
      }
    }

    if (helPos) {
      info = (info ? info + separator : '');
      info += 'Hel. long. = ' + helPos.longitude.toString(format);
      info += ', Hel. lat. = ' + helPos.latitude.toString(format);

      if ((this.marqueeFlags & MARQUEE_DISTANCE) !== 0) {
        const r = helPos.radius;

        if (this.marqueeUnits === MARQUEE_AU)
          info += ', Hel. dist. ' + r.toFixed(4) + ' AU';
        else if (this.marqueeUnits === MARQUEE_KM)
          info += ', Hel. dist. ' + toDefaultLocaleFixed(r * KM_PER_AU, 0, 0) + ' km';
        else if (this.marqueeUnits === MARQUEE_MILES)
          info += ', Hel. dist. ' + toDefaultLocaleFixed(r * KM_PER_AU / 1.609344, 0, 0) + ' miles';
      }
    }

    if (equPos) {
      info = (info ? info + separator : '');
      info += 'RA = ' + equPos.rightAscension.toHourString(format);
      info += ', Decl. = ' + equPos.declination.toString(format);
    }

    if (horPos) {
      let azimuth = horPos.azimuth;

      if (this.northAzimuth)
        azimuth = azimuth.add_nonneg(Angle.STRAIGHT); // 180 degrees

      info = (info ? info + separator : '');
      info += 'Az. = ' + azimuth.toString(format);
      info += ', Alt. = ' + horPos.altitude.toString(format);
    }

    if (vmag < UNKNOWN_MAGNITUDE) {
      info = (info ? info + separator : '');
      info += 'Mag. = ' + vmag.toFixed(1);
    }

    if (illum >= 0.0) {
      info = (info ? info + separator : '');
      info += 'Illum. frac. = ' + illum.toFixed(1) + '%';
    }

    if (diam > 0.0) {
      info = (info ? info + separator : '');
      info += 'Ang. diam. = ';

      if (diam < 60.0)
        info += diam.toFixed(2) + '"';
      else
        info += (diam / 60.0).toFixed(2) + '\'';
    }

    if (name && info)
      name += ': ';
    else if (!name)
      name = '';

    this.marqueeText = name + info;
  }

  protected abstract drawSkyPlotLine(pt1: Point, pt2: Point, dc: DrawingContextPlanetary, subject: SUBJECT): boolean;
}
