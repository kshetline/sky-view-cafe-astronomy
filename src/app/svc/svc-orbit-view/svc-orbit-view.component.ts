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

import {
  GenericPlanetaryView, DrawingContextPlanetary, MARQUEE_AU, MARQUEE_ECLIPTIC, MARQUEE_HELIOCENTRIC, MARQUEE_DISTANCE,
  planetColors, SELECTION_TYPE, SUBJECT, LABEL_TYPE, LabelInfo, ASTEROID_COLOR_INDEX, COMET_COLOR_INDEX, planetPrintColors
} from '../generic-planetary-view';
import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { abs, cos_deg, floor, log10, max, min, mod, mod2, Point, Point3D, pow, round, SphericalPosition3D, sin_deg,
} from 'ks-math';
import { CurrentTab, AppService, UserSetting } from '../../app.service';
import { EARTH, MARS, MOON, NEPTUNE, PLUTO, REFRACTION, SATURN, SUN } from '../../astronomy/astro-constants';
import { colorFromRGB, parseColor, replaceAlpha, RGBA } from 'ks-util';
import { ZBuffer } from '../../util/ks-z-buffer';
import { SolarSystem } from '../../astronomy/solar-system';
import { NMode } from '../../astronomy/ecliptic';
import { ADDITIONALS, GenericView, PROPERTY_ADDITIONALS } from '../generic-view';
import * as _ from 'lodash';

export const  VIEW_ORBITS = 'orbits';
export const    PROPERTY_EXTENT = 'extent';
export const    PROPERTY_CENTER_EARTH = 'center_earth';
export const    PROPERTY_MARQUEE_UNITS = 'marquee_units';
export const    PROPERTY_SHOW_PATHS = 'show_paths';
export const    PROPERTY_SHOW_MARKERS = 'show_markers';
export const    PROPERTY_GRAY_ORBITS = 'gray_orbits';
export const    PROPERTY_SHOW_NAMES = 'show_names';
export const    PROPERTY_ZOOM = 'zoom';
export const    PROPERTY_ANAGLYPH_3D = 'anaglyph_3d';
export const    PROPERTY_ANAGLYPH_RC = 'anaglyph_rc';

const scales = [
  // Scales in AU needed to display orbits out to a particular planet
  50.0, // All planets out to Pluto. (Yeah, yeah... it's not officially a "planet" any more.)
  30.5, // Neptune
  10.0, // Saturn
  1.75, // Mars
];

const lastPlanetToDraw = [
  PLUTO,
  NEPTUNE,
  SATURN,
  MARS,
];

export const ZOOM_STEPS = 200;
const MIN_ZOOM =  1.0; // AU
const MAX_ZOOM = 50.0; // AU
const ZOOM_RESET_TOLERANCE = 250; // msec

const LOG_MIN_ZOOM   = log10(MIN_ZOOM);
const LOG_MAX_ZOOM   = log10(MAX_ZOOM);
const ZOOM_LOG_RANGE = LOG_MAX_ZOOM - LOG_MIN_ZOOM;

const VIEWING_DISTANCE_FACTOR =  3.0;
const EYE_OFFSET_DIVISOR      = 30.0;

const MARKER_SIZE = 9;
const MARKER_SIZE2 = floor(MARKER_SIZE / 2);
const MARKER_GAP = 2;

const DRAG_LOCK_DELTA = 5;

const BELOW_HORIZON_COLOR       = '#404040';
const BELOW_HORIZON_PRINT_COLOR = '#C0C0C0';

enum DrawingMode { FULL_COLOR, LEFT_EYE, RIGHT_EYE }

const orbitColors: string[][] = [];
const SHADES = 50;

(function(): void {
  for (let i = 0; i < planetColors.length + 4; ++i) {
    const shades = [];
    let rgb: RGBA;

    switch (i - planetColors.length) {
      case 0: rgb = { r: 255, g:   0, b:   0, alpha: 1.0 }; break;
      case 1: rgb = { r:   0, g: 153, b: 255, alpha: 1.0 }; break;
      case 2: rgb = { r:   0, g: 204, b:   0, alpha: 1.0 }; break;
      case 3: rgb = { r: 255, g:   0, b: 255, alpha: 1.0 }; break;
      default: rgb = parseColor(planetColors[i]);
    }

    for (let j = 0; j <= SHADES; ++j) {
      const brightness = 0.25 + j * 0.01;
      shades.push(colorFromRGB(rgb.r * brightness, rgb.g * brightness, rgb.b * brightness));
    }

    orbitColors.push(shades);
  }
})();

const LEFT_EYE_COLOR_RC_INDEX  = planetColors.length;
const RIGHT_EYE_COLOR_RC_INDEX = planetColors.length + 1;
const LEFT_EYE_COLOR_GM_INDEX  = planetColors.length + 2;
const RIGHT_EYE_COLOR_GM_INDEX = planetColors.length + 3;

interface ZSortablePlanet {
  planet: number;
  pos: Point3D;
  pt: Point;
}

@Component({
  selector: 'svc-orbit-view',
  templateUrl: './svc-orbit-view.component.html',
  styleUrls: ['./svc-orbit-view.component.scss']
})
export class SvcOrbitViewComponent extends GenericPlanetaryView implements AfterViewInit {
  private anaglyph3d = false;
  private anaglyphRC = true;
  private centerEarth = false;
  private debouncedWheelRedraw: () => void;
  private dragStartRotation_xz = 0.0;
  private dragStartRotation_yz = 0.0;
  private dragXOnly = false;
  private dragYOnly = false;
  private extent = 0; // Pluto
  private grayOrbits = false;
  private leftEyeLabels: LabelInfo[] = [];
  private showMarkers = false;
  private showNames = true;
  private showPaths = true;
  private zBuffer = new ZBuffer();
  private zoom = SvcOrbitViewComponent.zoomToZoomSteps(scales[this.extent]);
  private zoomLastSet = 0;

  public rotation_xz = 0.0;
  public rotation_yz = 0.0;

  @ViewChild('canvasWrapper') private wrapperRef: ElementRef;
  @ViewChild('orbitCanvas') private canvasRef: ElementRef;
  @ViewChild('marquee') private marqueeRef: ElementRef;

  constructor(appService: AppService) {
    super(appService, CurrentTab.ORBITS);

    this.marqueeFlags = MARQUEE_ECLIPTIC | MARQUEE_HELIOCENTRIC | MARQUEE_DISTANCE;
    this.marqueeUnits = MARQUEE_AU;

    appService.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_ORBITS && setting.source !== this) {
        if (setting.property === PROPERTY_EXTENT) {
          const oldZoom = this.zoom;

          this.extent = <number> setting.value;
          this.updatePlanetsToDraw();

          // When loading old settings, extent might be set after zoom is set rather than before.
          // This should happen at a close time interval. Since a user wouldn't change both settings
          // one after the other very quickly, assume a short time interval means that old settings
          // are being loaded and that the change in extent shouldn't reset the zoom setting.
          if (Date.now() > this.zoomLastSet + ZOOM_RESET_TOLERANCE) {
            this.zoom = SvcOrbitViewComponent.zoomToZoomSteps(scales[this.extent]);

            if (this.zoom !== oldZoom)
              this.appService.updateUserSetting({view: VIEW_ORBITS, property: PROPERTY_ZOOM, value: this.zoom, source: this});
          }
        }
        else if (setting.property === PROPERTY_CENTER_EARTH)
          this.centerEarth = <boolean> setting.value;
        else if (setting.property === PROPERTY_MARQUEE_UNITS)
          this.marqueeUnits = <number> setting.value;
        else if (setting.property === PROPERTY_SHOW_PATHS)
          this.showPaths = <boolean> setting.value;
        else if (setting.property === PROPERTY_SHOW_MARKERS)
          this.showMarkers = <boolean> setting.value;
        else if (setting.property === PROPERTY_GRAY_ORBITS)
          this.grayOrbits = <boolean> setting.value;
        else if (setting.property === PROPERTY_SHOW_NAMES)
          this.showNames = <boolean> setting.value;
        else if (setting.property === PROPERTY_ZOOM) {
          this.zoom = <number> setting.value;
          this.zoomLastSet = Date.now();
        }
        else if (setting.property === PROPERTY_ANAGLYPH_3D)
          this.anaglyph3d = <boolean> setting.value;
        else if (setting.property === PROPERTY_ANAGLYPH_RC)
          this.anaglyphRC = <boolean> setting.value;
        else if (setting.property === PROPERTY_ADDITIONALS) {
          this.additional = <ADDITIONALS | string> setting.value;
          this.updatePlanetsToDraw();
        }

        this.debouncedDraw();
      }
    });
  }

  ngAfterViewInit(): void {
    this.wrapper = this.wrapperRef.nativeElement;
    this.canvas = this.canvasRef.nativeElement;
    this.marquee = this.marqueeRef.nativeElement;

    setTimeout(() => this.appService.requestViewSettings(VIEW_ORBITS));

    super.ngAfterViewInit();
  }

  protected drawView(dc: DrawingContextPlanetary): void {
    if (this.anaglyph3d && !GenericView.printing) {
      this.leftEyeLabels = [];

      this.drawViewAux(dc, DrawingMode.LEFT_EYE);
      dc.context.globalCompositeOperation = 'lighten';
      this.drawViewAux(dc, DrawingMode.RIGHT_EYE);
      dc.context.globalCompositeOperation = 'source-over';
    }
    else
      this.drawViewAux(dc, DrawingMode.FULL_COLOR);
  }

  protected drawViewAux(dc: DrawingContextPlanetary, mode: DrawingMode): void {
    const vInset = 10;
    const hInset = 10;

    dc.size = min(dc.w - hInset * 2, dc.h - vInset * 2);

    if (dc.size % 2 !== 0)
      --dc.size;

    dc.radius = floor(dc.size / 2);

    const scale = pow(10.0, LOG_MIN_ZOOM + ZOOM_LOG_RANGE * this.zoom / ZOOM_STEPS);
    const pixelsPerUnit = dc.radius / scale;
    const viewingDistance = scale * VIEWING_DISTANCE_FACTOR;
    let ctr: Point3D = {x: 0, y: 0, z: 0};
    let pt0: Point3D = {x: 0, y: 0, z: 0};
    const pt1: Point3D = {x: 0, y: 0, z: 0};
    const cos_xz = cos_deg(this.rotation_xz);
    const sin_xz = sin_deg(this.rotation_xz);
    const cos_yz = cos_deg(this.rotation_yz);
    const sin_yz = sin_deg(this.rotation_yz);
    const earthPos = dc.ss.getHeliocentricPosition(EARTH, dc.jde);
    const maxZ = viewingDistance;
    const shadingScale = (mode > DrawingMode.FULL_COLOR ? scale * 2.0 : scale);
    const specialCases: number[] = [];

    if (mode !== DrawingMode.RIGHT_EYE) {
      dc.context.fillStyle = (dc.inkSaver ? 'white' : 'black');
      dc.context.fillRect(0, 0, dc.w, dc.h);
    }

    if (this.centerEarth)
      ctr = earthPos.xyz;

    if (this.showPaths) {
      const orbitStep = 1.0;
      this.zBuffer.clear();

      for (let i = 0; i < this.planetsToDraw.length; ++i) {
        const planet = this.planetsToDraw[i];

        // Don't draw an orbit for the Sun.
        if (planet === SUN)
          continue;

        const oe = SolarSystem.getOrbitalElements(planet, dc.jde);
        let colorIndex = planet;

        if (SolarSystem.isAsteroidOrComet(planet)) {
          // Don't use this orbit drawing method for highly eccentric asteroids and comets.
          if (!oe || oe.e > 0.98) {
            specialCases.push(planet);

            continue;
          }

          if (SolarSystem.isAsteroid(planet))
            colorIndex = ASTEROID_COLOR_INDEX;
          else
            colorIndex = COMET_COLOR_INDEX;
        }

        colorIndex = this.get3DColorIndex(mode, colorIndex);

        const cos_i = cos_deg(oe.i);
        const sin_i = sin_deg(oe.i);
        const cos_o = cos_deg(oe.OMEGA);
        const sin_o = sin_deg(oe.OMEGA);

        // We'll use a full circle of imaginary true anomalies, offset from the
        // perihelion, to plot each orbit. The ascending and descending nodes must be
        // referred to the perihelion to be plotted.
        const ascNode_p = mod(oe.OMEGA - oe.pi, 360.0);
        const desNode_p = mod(ascNode_p + 180.0, 360.0);
        let x2: number, y2: number;

        for (let v = 0.0; v <= 360.0; v += orbitStep) {
          const r = oe.a * (1.0 - oe.e * oe.e) / (1.0 + oe.e * cos_deg(v));
          const vpo = v + oe.pi - oe.OMEGA;
          const cos_vpo = cos_deg(vpo);
          const sin_vpo = sin_deg(vpo);

          pt0.x = r * (cos_o * cos_vpo - sin_o * sin_vpo * cos_i);
          pt0.y = r * (sin_o * cos_vpo + cos_o * sin_vpo * cos_i);
          pt0.z = r * sin_vpo * sin_i;

          const heavy = (planet !== EARTH && pt0.z >= 0.0);

          pt1.x = pt0.x;
          pt1.y = pt0.y;
          pt1.z = pt0.z;
          SvcOrbitViewComponent.translate(mode, pt1, ctr, viewingDistance, cos_xz, sin_xz, cos_yz, sin_yz);

          // Scale and convert to integer form.
          const x1 = round(pt1.x * pixelsPerUnit) + dc.xctr;
          const y1 = dc.yctr - round(pt1.y * pixelsPerUnit);

          const range = orbitColors[colorIndex].length;
          let shading = round(range / 2 + pt1.z / shadingScale * range / 2.0);
          shading = min(max(shading, 0), range - 1);
          let color;

          if (dc.inkSaver) {
            color = planetPrintColors[colorIndex];

            const alpha = 1.0 - (SHADES - shading) / SHADES * 0.75;

            color = replaceAlpha(color, alpha);
          }
          else
            color = orbitColors[colorIndex][shading];

          if (this.grayOrbits && mode === DrawingMode.FULL_COLOR) {
            let pos = SphericalPosition3D.convertRectangular(pt0);

            pos = pos.translate(earthPos);
            pos = this.ecliptic.eclipticToEquatorial3D(pos, dc.jde, NMode.MEAN_OBLIQUITY);
            pos = <SphericalPosition3D> dc.skyObserver.equatorialToHorizontal(pos, dc.jdu, REFRACTION);

            if (pos.altitude.degrees < 0)
              color = (dc.inkSaver ? BELOW_HORIZON_PRINT_COLOR : BELOW_HORIZON_COLOR);
          }

          if (v > 0.0)
            this.zBuffer.addLine(color, x1, y1, x2, y2, pt1.z, heavy);

          if (this.showMarkers) {
            if (v === 0.0) { // Perihelion
              for (let dd = -MARKER_SIZE2; dd <= MARKER_SIZE2; ++dd) {
                this.zBuffer.addFilledRect(color, x1 - dd, y1 + dd, 1, 1, pt1.z);
                this.zBuffer.addFilledRect(color, x1 + dd, y1 + dd, 1, 1, pt1.z);
              }
            }
            else if (v === 180.0) { // Aphelion
              this.zBuffer.addLine(color, x1 - MARKER_SIZE2, y1 + 0.5,          x1 + MARKER_SIZE2 + 1, y1 + 0.5,              pt1.z);
              this.zBuffer.addLine(color, x1 + 0.5,          y1 - MARKER_SIZE2, x1 + 0.5,              y1 + MARKER_SIZE2 + 1, pt1.z);
            }

            if (planet !== EARTH) { // Ascending node
              if (v - orbitStep <= ascNode_p && ascNode_p < v) {
                const dv = (ascNode_p - v + orbitStep) / orbitStep;
                const x3 = x2 + round((x1 - x2) * dv);
                const y3 = y2 + round((y1 - y2) * dv);
                this.zBuffer.addCircle(color, x3, y3, MARKER_SIZE / 2, pt1.z);
              }
              else if (v - orbitStep <= desNode_p && desNode_p < v) { // Descending node
                const dv = (desNode_p - v + orbitStep) / orbitStep;
                const x3 = x2 + round((x1 - x2) * dv);
                const y3 = y2 + round((y1 - y2) * dv);
                this.zBuffer.addRect(color, x3 - MARKER_SIZE / 2, y3 - MARKER_SIZE / 2, MARKER_SIZE - 1, MARKER_SIZE - 1, pt1.z);
              }
            }
          }

          x2 = x1;
          y2 = y1;
        }
      }

      specialCases.forEach(planet => {
        // Alternate orbit drawing method for highly eccentric (e > 0.98) objects
        let colorIndex = (SolarSystem.isAsteroid(planet) ? ASTEROID_COLOR_INDEX : COMET_COLOR_INDEX);
        colorIndex = this.get3DColorIndex(mode, colorIndex);
        let x2: number, y2: number;

        for (let delta = -1; delta <= 1; delta += 2) {
          let t = dc.jde;
          const furthestT = t + delta * 36525; // Look for no more than 100 years forward or backward in time
          const angleStep = 0.5;

          for (let angle = 0; angle <= 180.0; angle += angleStep) {
            pt0 = dc.ss.getHeliocentricPosition(planet, t).xyz;
            const heavy = (pt0.z >= 0.0);

            pt1.x = pt0.x;
            pt1.y = pt0.y;
            pt1.z = pt0.z;
            SvcOrbitViewComponent.translate(mode, pt1, ctr, viewingDistance, cos_xz, sin_xz, cos_yz, sin_yz);

            // Scale and convert to integer form.
            const x1 = round(pt1.x * pixelsPerUnit) + dc.xctr;
            const y1 = dc.yctr - round(pt1.y * pixelsPerUnit);

            const range = orbitColors[colorIndex].length;
            let shading = round(range / 2 + pt1.z / shadingScale * range / 2.0);
            shading = min(max(shading, 0), range - 1);
            let color = orbitColors[colorIndex][shading];

            if (this.grayOrbits && mode === DrawingMode.FULL_COLOR) {
              let pos = SphericalPosition3D.convertRectangular(pt0);

              pos = pos.translate(earthPos);
              pos = this.ecliptic.eclipticToEquatorial3D(pos, dc.jde, NMode.MEAN_OBLIQUITY);
              pos = <SphericalPosition3D> dc.skyObserver.equatorialToHorizontal(pos, dc.jdu, REFRACTION);

              if (pos.altitude.degrees < 0)
                color = (dc.inkSaver ? BELOW_HORIZON_PRINT_COLOR : BELOW_HORIZON_COLOR);
            }

            if (angle > 0)
              this.zBuffer.addLine(color, x1, y1, x2, y2, pt1.z, heavy);

            x2 = x1;
            y2 = y1;

            t = dc.ss.getTimeForDegreesOfChange(planet, t, angleStep, furthestT);

            if (t === Number.MAX_VALUE)
              break;
          }
        }
      });

      this.zBuffer.draw(dc.context, maxZ);
    }

    let positions: ZSortablePlanet[] = [];

    for (let i = 0; i < this.planetsToDraw.length; ++i) {
      const planet = this.planetsToDraw[i];

      pt0 = dc.ss.getHeliocentricPosition(planet, dc.jde).xyz;
      SvcOrbitViewComponent.translate(mode, pt0, ctr, viewingDistance, cos_xz, sin_xz, cos_yz, sin_yz);

      const pt = {x: round(dc.xctr + pt0.x * pixelsPerUnit),
                  y: round(dc.yctr - pt0.y * pixelsPerUnit)};

      positions.push({planet: planet, pos: pt0, pt: pt});
    }

    positions = _.sortBy(positions, [(position: ZSortablePlanet) => { return position.pos.z; }]);

    const overrideColor = this.get3DColor(mode);

    for (const position of positions) {
      const p = position.planet;
      const pt = position.pt;

      if (position.pos.z >= maxZ)
        continue;

      this.drawPlanet(p, pt, dc, overrideColor);
      this.qualifyBodyForSelection(pt, SELECTION_TYPE.PLANET, p, true, dc);

      if (this.showNames) {
        const name = dc.ss.getPlanetName(p);
        const li: LabelInfo = {name: name, pt: pt, bodyIndex: p, labelType: LABEL_TYPE.PLANET, overrideColor: overrideColor};

        if (mode === DrawingMode.LEFT_EYE)
          this.leftEyeLabels.push(li);
        else
          this.addLabel(li, dc);
      }
    }
  }

  protected get3DColor(mode: DrawingMode): string {
    if (mode === DrawingMode.LEFT_EYE)
      return this.anaglyphRC ? '#FF0000'  : '#00CC00';
    else if (mode === DrawingMode.RIGHT_EYE)
      return this.anaglyphRC ? '#0099FF' : '#FF00FF';
    else
      return undefined;
  }

  protected get3DColorIndex(mode: DrawingMode, defaultIndex: number): number {
    if (mode === DrawingMode.LEFT_EYE)
      return this.anaglyphRC ? LEFT_EYE_COLOR_RC_INDEX  : LEFT_EYE_COLOR_GM_INDEX;
    else if (mode === DrawingMode.RIGHT_EYE)
      return this.anaglyphRC ? RIGHT_EYE_COLOR_RC_INDEX : RIGHT_EYE_COLOR_GM_INDEX;
    else
      return defaultIndex;
  }

  protected drawLabels(dc: DrawingContextPlanetary): void {
    if (this.anaglyph3d) {
      for (const leftLabel of this.leftEyeLabels) {
        const rightLabel = dc.labels.find((label: LabelInfo) => {
          return (label.bodyIndex === leftLabel.bodyIndex);
        });

        if (rightLabel) {
          rightLabel.offsetColor = leftLabel.overrideColor;
          rightLabel.offsetX = leftLabel.pt.x - rightLabel.pt.x;
        }
      }

      this.leftEyeLabels = [];
    }

    super.drawLabels(dc);
  }

  protected drawSkyPlotLine(pt1: Point, pt2: Point, dc: DrawingContextPlanetary, subject: SUBJECT): boolean {
    return null;
  }

  onMouseDown(event: MouseEvent): void {
    super.onMouseDown(event);
    this.dragStartRotation_xz = this.rotation_xz;
    this.dragStartRotation_yz = this.rotation_yz;
    this.dragXOnly = false;
    this.dragYOnly = false;
  }

  onMouseMove(event: MouseEvent): void {
    super.onMouseMove(event);

    if (this.dragging) {
      let dx = this.clickX - this.lastMoveX;
      let dy = this.lastMoveY - this.clickY;

      if (-90.0 <= this.dragStartRotation_yz && this.dragStartRotation_yz < 90.0)
        dx = -dx;

      if (event.shiftKey && !this.dragXOnly && !this.dragYOnly) {
        if (abs(dx) > abs(dy)) {
          dy = 0;

          if (abs(dx) >= DRAG_LOCK_DELTA)
            this.dragXOnly = true;
        }
        else {
          dx = 0;

          if (abs(dy) >= DRAG_LOCK_DELTA)
            this.dragYOnly = true;
        }
      }
      else if (this.dragXOnly)
        dy = 0;
      else if (this.dragYOnly)
        dx = 0;

      this.rotation_xz = mod2(this.dragStartRotation_xz - dx * 180.0 / this.width, 360.0);
      this.rotation_xz = round(this.rotation_xz * 10.0) / 10.0;

      if (this.rotation_xz === -180.0)
        this.rotation_xz = 180.0;

      this.rotation_yz = mod2(this.dragStartRotation_yz - dy * 180.0 / this.width, 360.0);
      this.rotation_yz = round(this.rotation_yz * 10.0) / 10.0;

      if (this.rotation_yz === -180.0)
        this.rotation_yz = 180.0;

      this.draw();
    }
  }

  onWheel(event: WheelEvent): void {
    const oldZoom = this.zoom;

    if (!this.debouncedWheelRedraw) {
      this.debouncedWheelRedraw = _.debounce(() => {
        this.draw();
      }, 10);
    }

    let zoomDelta = event.wheelDeltaY;

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
      this.debouncedWheelRedraw();
      this.appService.updateUserSetting({view: VIEW_ORBITS, property: PROPERTY_ZOOM, value: this.zoom, source: this});
    }

    event.preventDefault();
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

  public resetOrientation(): void {
    this.rotation_xz = 0.0;
    this.rotation_yz = 0.0;
    this.draw();
  }

  public changeOrientation(deltaX: number, deltaY: number): void {
    this.rotation_xz = mod2(floor(this.rotation_xz / 15 + deltaX) * 15, 360);

    if (this.rotation_xz === -180)
      this.rotation_xz = 180;

    this.rotation_yz = mod2(floor(this.rotation_yz / 15 + deltaY) * 15, 360);

    if (this.rotation_yz === -180)
      this.rotation_yz = 180;

    this.draw();
  }

  protected static translate(mode: DrawingMode, pt: Point3D, ctr: Point3D, viewingDistance: number,
                              cos_xz: number, sin_xz: number, cos_yz: number, sin_yz: number): Point3D {
    const x  = pt.x - ctr.x;
    const y  = pt.y - ctr.y;
    const z  = pt.z - ctr.z;
    pt.x     = x  * cos_xz - z  * sin_xz;
    const z1 = z  * cos_xz + x  * sin_xz;
    pt.y     = y  * cos_yz + z1 * sin_yz;
    pt.z     = z1 * cos_yz - y  * sin_yz;

    // "Camera" perspective
    const eyeOffset = (mode > DrawingMode.FULL_COLOR ? viewingDistance / EYE_OFFSET_DIVISOR * (mode === DrawingMode.LEFT_EYE ? 1.0 : -1.0) : 0.0);
    const distance = viewingDistance - pt.z;
    const reduction = max(distance, 0.00001) / viewingDistance;

    pt.x += eyeOffset;
    pt.x /= reduction;
    pt.y /= reduction;
    pt.x -= eyeOffset;

    return pt;
  }

  protected static zoomToZoomSteps(zoom: number): number {
    return min(max(0, round((log10(zoom) - LOG_MIN_ZOOM) / ZOOM_LOG_RANGE * ZOOM_STEPS)), ZOOM_STEPS);
  }

  protected updatePlanetsToDraw(): void {
    this.excludedPlanets = [MOON];

    for (let i = lastPlanetToDraw[this.extent] + 1; i <= PLUTO; ++i)
      this.excludedPlanets.push(i);

    super.updatePlanetsToDraw();
  }
}
