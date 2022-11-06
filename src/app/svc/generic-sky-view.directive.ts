import { AfterViewInit, Directive } from '@angular/core';
import { LABEL_ANCHOR, LINE_BREAK, NO_MATCH, REFRACTION } from '@tubular/astronomy';
import { max, min, Point, pow, round, SphericalPosition, SphericalPosition3D } from '@tubular/math';
import { strokeEllipse } from '@tubular/util';
import { AppService, CurrentTab } from '../app.service';
import {
  DrawingContextPlanetary, FAR_AWAY, GenericPlanetaryViewDirective, highlightedStarColor, LABEL_TYPE, LabelInfo, NONPLANET, SELECTION_TYPE,
  SortablePlanet, SUBJECT
} from './generic-planetary-view.directive';

export const eclipticColor               = '#666699';
export const eclipticGridColor           = 'rgba(102,102,153,0.4)';
export const eclipticPrintColor          = '#9999CC';
export const eclipticGridPrintColor      = 'rgba(153,153,204,0.3)';
export const equatorColor                = '#990099';
export const equatorialGridColor         = 'rgba(153,0,153,0.4)';
export const equatorPrintColor           = '#CC66CC';
export const equatorialGridPrintColor    = 'rgba(204,102,204,0.3)';
export const horizonColor                = '#339933';
export const horizonPrintColor           = '#99CC99';
export const constellationLineColor      = '#0000FF';
export const constellationLinePrintColor = '#9999FF';
export const sunPathColor                = '#FFFF66';
export const moonPathColor               = '#66FFFF';

export const NO_DEEP_SKY  = -1000.0;
export const ALL_DEEP_SKY =  1000.0;
export const BRIGHT_STAR_LIMIT = 1.5;
  // Polaris is only magnitude 2.0, but I want it labeled with the other bright
  // stars anyway because of its importance for orientation.
export const POLARIS_FK5_NUM = 907;

const SCALE_WHERE_BRIGHTEST_STAR_IS_3x3 = 0.0026;
const DIMMEST_ALLOWED_1x1_STAR_IMAGE_INDEX  = 33;
// const DIMMEST_AT_SCALE_1x1_STAR_IMAGE_INDEX = 100;
const BRIGHTEST_1x1_STAR_IMAGE_INDEX        = 500;
const BRIGHTEST_3x3_STAR_IMAGE_INDEX        = 1500;

const opacitiesOfWhite: string[] = [];

for (let i = 0; i <= 255; ++i)
  opacitiesOfWhite[i] = 'rgba(255,255,255,' + (i / 255).toFixed(3) + ')';

const QUICK_DRAW_STAR_COUNT = 500;

@Directive()
export abstract class GenericSkyViewDirective extends GenericPlanetaryViewDirective implements AfterViewInit {
  protected deepSkyLabelMagnitude = NO_DEEP_SKY;
  protected labelBrightStars = false;
  protected labelConstellations = false;
  protected labelPlanets = true;
  protected labelStars = false;
  protected showConstellations = false;
  protected showDimStars = false;

  protected constructor(app: AppService, tabId: CurrentTab) {
    super(app, tabId);
  }

  protected drawView(dc: DrawingContextPlanetary): void {
    if (this.checkRefraction()) {
      dc.starFlags |= REFRACTION;
      dc.planetFlags |= REFRACTION;
    }

    this.drawSky(dc);

    if (this.starsReady) {
      if (this.showConstellations)
        this.drawConstellations(dc);

      this.drawStars(dc);
    }

    this.drawPlanets(dc);
    this.drawSkyMask(dc);
  }

  protected abstract getSphericalPosition(bodyIndex: number, dc: DrawingContextPlanetary): SphericalPosition;
  protected abstract sphericalToScreenXY(pos: SphericalPosition, dc: DrawingContextPlanetary, subject: SUBJECT): Point;
  protected abstract drawSky(dc: DrawingContextPlanetary): void;

  protected drawConstellations(dc: DrawingContextPlanetary): void {
    let minD = FAR_AWAY;
    let selectedLabel: LabelInfo;

    dc.sc.forEachConstellation(cInfo => {
      const starList = cInfo.starList;
      let starCount = 0;
      let breakLine = true;
      let minX = Number.MAX_SAFE_INTEGER, minY = Number.MAX_SAFE_INTEGER;
      let maxX = Number.MIN_SAFE_INTEGER, maxY = Number.MIN_SAFE_INTEGER;
      let hasAnchor = false;
      let nextIsAnchor = false;
      let outOfView = false;
      let lastPt;

      dc.context.strokeStyle = (dc.inkSaver ? constellationLinePrintColor : constellationLineColor);

      for (const starIndex of starList) {
        if (starIndex === LINE_BREAK) {
          breakLine = true;
          continue;
        }
        else if (starIndex === LABEL_ANCHOR) {
          nextIsAnchor = true;
          continue;
        }

        const pt = this.sphericalToScreenXY(this.getSphericalPosition(-starIndex - 1, dc), dc, NONPLANET.CONSTELLATIONS);

        if (!pt)
          break;

        if (!breakLine) // noinspection JSUnusedAssignment
          outOfView = outOfView || !this.drawSkyPlotLine(pt, lastPt, dc, NONPLANET.CONSTELLATIONS);

        if (nextIsAnchor) {
          minX = maxX = pt.x;
          minY = maxY = pt.y;
          nextIsAnchor = false;
          hasAnchor = true;
        }
        else if (!hasAnchor) {
          minX = min(minX, pt.x);
          maxX = max(maxX, pt.x);
          minY = min(minY, pt.y);
          maxY = max(maxY, pt.y);
        }

        ++starCount;
        lastPt = pt;
        breakLine = false;
      }

      if (!outOfView && starCount > 0 && this.labelConstellations) {
        const pt = { x: this.scaledRound((minX + maxX) / 2), y: this.scaledRound((minY + maxY) / 2) };

        if (this.withinPlot(pt.x, pt.y, dc)) {
          const name = cInfo.name.toUpperCase();
          const li = { name, pt, labelType: LABEL_TYPE.CONSTELLATION, bodyIndex: NO_MATCH };

          if (this.lastMoveX < 0 || this.lastMoveY < 0)
            this.addLabel(li, dc);
          else {
            // The mouse is pointing inside the view, so we'll only show
            // the constellation label closest to the mouse point;
            const d = this.distanceFromMousePoint(pt);

            if (!selectedLabel || d < minD) {
              li.labelType = LABEL_TYPE.SOLE_CONSTELLATION;
              selectedLabel = li;
              minD = d;
            }
          }
        }
      }
    });

    if (selectedLabel)
      this.addLabel(selectedLabel, dc);
  }

  protected drawStars(dc: DrawingContextPlanetary): void {
    dc.scaleBoost = pow(dc.pixelsPerArcSec / SCALE_WHERE_BRIGHTEST_STAR_IS_3x3, 0.521);
    dc.starBrightestLevel = min(round(dc.scaleBoost * BRIGHTEST_3x3_STAR_IMAGE_INDEX), 1999);
    dc.starDimmestLevel   = min(max(min(round(dc.scaleBoost * this.starBaseBrightness), 1999),
                              DIMMEST_ALLOWED_1x1_STAR_IMAGE_INDEX), BRIGHTEST_1x1_STAR_IMAGE_INDEX);
    dc.starLevelRange = dc.starBrightestLevel - dc.starDimmestLevel;

    const firstStar = (dc.fullDraw ? 0 : max(dc.sc.getStarCount() - QUICK_DRAW_STAR_COUNT, 0));

    for (let i = firstStar; i < dc.sc.getStarCount(); ++i) {
      const bodyIndex = -i - 1;
      const isDeepSky = dc.sc.isDeepSkyObject(i);
      const vmag = dc.sc.getMagnitude(i);
      const pos = this.getSphericalPosition(bodyIndex, dc);

      if (!this.showDimStars && !isDeepSky && vmag > 6.0)
        continue;

      const pt = this.sphericalToScreenXY(pos, dc, NONPLANET.STARS);

      if (pt) {
        if (!isDeepSky)
          this.drawStar(pt, vmag, dc);
        else if (vmag <= this.deepSkyLabelMagnitude) {
          dc.context.strokeStyle = highlightedStarColor;
          strokeEllipse(dc.context, pt.x, pt.y, 3, 2);
          dc.context.strokeStyle = 'black';
        }
      }

      if (pt || bodyIndex === this.specialLabelIndex)
        this.qualifyBodyForSelection(pt, SELECTION_TYPE.STAR, bodyIndex, Boolean(pt), dc);

      if (pt && this.withinToleranceOfPlot(pt.x, pt.y, 1, dc) &&
          (bodyIndex === this.specialLabelIndex ||
           (isDeepSky && vmag <= this.deepSkyLabelMagnitude) ||
           (!isDeepSky && this.labelStars) ||
           (!isDeepSky && this.labelBrightStars &&
            (vmag <= BRIGHT_STAR_LIMIT || dc.sc.getFK5Number(i) === POLARIS_FK5_NUM)))) {
        const fullName = dc.sc.getName(i);
        let name;

        if (isDeepSky || (!fullName && bodyIndex === this.specialLabelIndex))
          name = dc.sc.getCodedName(i);
        else
          name = fullName;

        if (name)
          this.addLabel({ name, pt, bodyIndex, labelType: isDeepSky ? LABEL_TYPE.DSO : LABEL_TYPE.STAR }, dc);
      }
    }
  }

  protected drawPlanets(dc: DrawingContextPlanetary): void {
    let planets: SortablePlanet[] = [];

    this.planetsToDraw.forEach(p => {
      planets.push({ planet: p, pos: this.getSphericalPosition(p, dc) as SphericalPosition3D });
    });

    planets = planets.sort((a, b) => b.pos.radius - a.pos.radius);

    for (const planet of planets) {
      const p = planet.planet;
      const pt = this.sphericalToScreenXY(planet.pos, dc, p);

      if (pt)
        this.drawPlanet(p, pt, dc);

      if (pt || p === this.specialLabelIndex)
        this.qualifyBodyForSelection(pt, SELECTION_TYPE.PLANET, p, Boolean(pt), dc);

      if (pt && this.labelPlanets && this.withinToleranceOfPlot(pt.x, pt.y, 2, dc)) {
        this.addLabel({ name: dc.ss.getPlanetName(p), pt, bodyIndex: p,
                        labelType: LABEL_TYPE.PLANET }, dc);
      }
    }
  }

  protected abstract drawSkyMask(dc: DrawingContextPlanetary): void;
}
