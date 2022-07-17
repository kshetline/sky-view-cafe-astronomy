import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import {
  ABERRATION, AVG_SUN_MOON_RADIUS, MOON, QUICK_SUN, REFRACTION_AT_HORIZON, SkyObserver, SolarSystem, SUN, TOPOCENTRIC
} from '@tubular/astronomy';
import { abs, ceil, cos_deg, floor, max, min, mod, mod2, Point, round, sin_deg, SphericalPosition3D } from '@tubular/math';
import { AppEvent, AppService, CurrentTab, UserSetting } from '../../app.service';
import { KsTimeService, ZoneForLocation } from '../../util/ks-time.service';
import { DrawingContext, GenericViewDirective } from '../generic-view.directive';
import { formatLatitude, formatLongitude } from '../svc-util';

export const  VIEW_MAP = 'map';
export const    PROPERTY_MAP_TYPE = 'map_type';
export const    PROPERTY_SHOW_DAY_NIGHT = 'show_day_night';
export const    PROPERTY_SHOW_ECLIPSE_SHADOWS = 'show_eclipse_shadows';
export const    PROPERTY_SHOW_LOCATION_MARKERS = 'show_location_markers';
export const    PROPERTY_SHOW_TIMEZONES = 'show_timezones';
export const    PROPERTY_BLINK_LOCATION_MARKERS = 'blink_location_markers';
export const    PROPERTY_ZONE_IMAGE_URL = 'zone_image_url';

export const EVENT_MAP_GO_TO_SUBSOLAR_POINT = 'event_map_go_to_subsolar_point';
export const EVENT_MAP_GO_TO_ECLIPSE_CENTER = 'event_map_go_to_eclipse_center';
export const EVENT_MAP_ACTIVE_ECLIPSE = 'event_map_active_eclipse';
export const EVENT_MAP_ACTIVE_ECLIPSE_REQUEST = 'event_map_active_eclipse_request';

export enum MapType {TERRAIN, POLITICAL}

const MIN_ECLIPSE_MAGNITUDE = 0.8;  // Portion of full eclipse (1.0)
const MIN_SEARCH_MAGNITUDE  = 0.9;  // Portion of full eclipse (1.0)
const DAYLIGHT_EXPAND = 1.0;  // In degrees, extent beyond terminator to illuminate.

const UNCHECKED = 0;
const CHECKED = 1;
const MIN_SHADOWED = 2;
const MAX_SHADOWED = 17;

const MARKER_SIZE = 13;
const HALF_MARKER = floor(MARKER_SIZE / 2);

// relative neighbor coordinates for eclipse shadow flood fill
const ffdx = [0,  1,  1,  1,  0, -1, -1, -1];
const ffdy = [-1, -1,  0,  1,  1,  1,  0, -1];

const shadowColor = 'rgba(0,0,0,0.6)';

@Component({
  selector: 'svc-map-view',
  templateUrl: './svc-map-view.component.html',
  styleUrls: ['./svc-map-view.component.scss']
})
export class SvcMapViewComponent extends GenericViewDirective implements AfterViewInit {
  private dayMap: HTMLImageElement;
  private markerEclipse: HTMLImageElement;
  private markerLocation: HTMLImageElement;
  private markerSubsolar: HTMLImageElement;
  private nightMap: HTMLImageElement;
  private politicalMap: HTMLImageElement;
  private politicalNightMap: HTMLCanvasElement;
  private zoneOverlay: HTMLImageElement;

  private blink = true;
  private blinkPhase = 0;
  private blinkPending = false;
  private mapType = MapType.TERRAIN;
  private showDayNight = true;
  private showEclipseShadows = true;
  private showMarkers = true;

  private xOffset: number;
  private mapYOffset: number;
  private mapWidth: number;
  private mapHeight: number;
  private moonShadowPts: number[];
  private lastSunLatitude = 0;
  private lastSunLongitude = 0;
  private lastEclipseCenterLatitude = 0;
  private lastEclipseCenterLongitude = 0;
  private activeEclipse = false;

  @ViewChild('canvasWrapper', { static: true }) private wrapperRef: ElementRef;
  @ViewChild('mapCanvas', { static: true }) private canvasRef: ElementRef;
  @ViewChild('zoneOverlay', { static: true }) private zoneOverlayRef: ElementRef;

  showLocationDialog = false;
  showTimezones = false;
  latitude: number;
  longitude: number;
  timezone: string;
  zoneImageUrl = '';

  private static getImagePromise(path: string): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();

      image.onload = (): void => {
        resolve(image);
      };
      image.onerror = (): void => {
        reject(new Error(image.src + ' failed to load.'));
      };

      image.src = path;
    });
  }

  constructor(appService: AppService, private timeService: KsTimeService) {
    super(appService, CurrentTab.MAP);
    this.cursor = 'crosshair';
    this.canDrag = false;

    appService.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_MAP && setting.source !== this) {
        if (setting.property === PROPERTY_MAP_TYPE)
          this.mapType = setting.value as MapType;
        else if (setting.property === PROPERTY_SHOW_DAY_NIGHT)
          this.showDayNight = setting.value as boolean;
        else if (setting.property === PROPERTY_SHOW_ECLIPSE_SHADOWS)
          this.showEclipseShadows = setting.value as boolean;
        else if (setting.property === PROPERTY_SHOW_LOCATION_MARKERS)
          this.showMarkers = setting.value as boolean;
        else if (setting.property === PROPERTY_SHOW_TIMEZONES)
          this.showTimezones = setting.value as boolean;
        else if (setting.property === PROPERTY_ZONE_IMAGE_URL)
          this.zoneImageUrl = setting.value as string;
        else if (setting.property === PROPERTY_BLINK_LOCATION_MARKERS)
          this.blink = setting.value as boolean;

        this.throttledRedraw();
      }
    });

    appService.getAppEventUpdates((appEvent: AppEvent) => {
      if (appEvent.name === EVENT_MAP_GO_TO_SUBSOLAR_POINT)
        this.goToSubsolarPoint();
      else if (appEvent.name === EVENT_MAP_GO_TO_ECLIPSE_CENTER)
        this.goToEclipseCenter();
      else if (appEvent.name === EVENT_MAP_ACTIVE_ECLIPSE_REQUEST)
        appService.sendAppEvent(EVENT_MAP_ACTIVE_ECLIPSE, this.activeEclipse);
    });
  }

  ngAfterViewInit(): void {
    this.wrapper = this.wrapperRef.nativeElement;
    this.canvas = this.canvasRef.nativeElement;
    this.zoneOverlay = this.zoneOverlayRef.nativeElement;

    setTimeout(() => this.appService.requestViewSettings(VIEW_MAP));

    const dayImagePromise = SvcMapViewComponent.getImagePromise('assets/resources/worldmap.jpg');
    const nightImagePromise = SvcMapViewComponent.getImagePromise('assets/resources/worldmap_night.jpg');
    const politicalImagePromise = SvcMapViewComponent.getImagePromise('assets/resources/worldmap_political.jpg');
    const markerEclipsePromise = SvcMapViewComponent.getImagePromise('assets/resources/marker_eclipse.gif');
    const markerLocationPromise = SvcMapViewComponent.getImagePromise('assets/resources/marker_location.gif');
    const markerSubsolarPromise = SvcMapViewComponent.getImagePromise('assets/resources/marker_subsolar.gif');

    Promise.all([dayImagePromise, nightImagePromise, politicalImagePromise, markerEclipsePromise, markerLocationPromise, markerSubsolarPromise]).then(
        ([dayMap, nightMap, politicalMap, markerEclipse, markerLocation, markerSubsolar]:
        [HTMLImageElement, HTMLImageElement, HTMLImageElement, HTMLImageElement, HTMLImageElement, HTMLImageElement]) => {
          this.dayMap = dayMap;
          this.nightMap = nightMap;
          this.politicalMap = politicalMap;
          this.markerEclipse = markerEclipse;
          this.markerLocation = markerLocation;
          this.markerSubsolar = markerSubsolar;

          this.politicalNightMap = document.createElement('canvas');
          this.politicalNightMap.width = this.politicalMap.width;
          this.politicalNightMap.height = this.politicalMap.height;

          const context = this.politicalNightMap.getContext('2d');

          context.drawImage(this.politicalMap, 0, 0);
          context.fillStyle = shadowColor;
          context.fillRect(0, 0, this.politicalMap.width, this.politicalMap.height);

          this.throttledRedraw();
        }).catch((reason: any) => {
      return Promise.reject(new Error('Failed to load all images: ' + reason));
    });

    super.ngAfterViewInit();
  }

  protected doResize(forceFullDraw = false): void {
    super.doResize(forceFullDraw);

    if (this.wrapper.clientWidth === 0 || this.wrapper.clientHeight === 0)
      return;

    this.zoneOverlay.width = this.width;
    this.zoneOverlay.height = floor(this.width / 2) + 4;
    this.zoneOverlay.parentElement.style.width = this.width + 'px';
    this.zoneOverlay.parentElement.style.height = floor(this.width / 2) + 'px';
  }

  protected drawView(dc: DrawingContext): void {
    dc.context.fillStyle = '#009966';
    dc.context.fillRect(0, 0, dc.w, dc.h);

    const map = (this.mapType === MapType.TERRAIN ? this.dayMap : this.politicalMap);

    if (!map)
      return;

    const ascent = dc.mediumLabelFm.ascent;
    const lineHeight = dc.mediumLabelFm.lineHeight;

    dc.context.font = this.mediumLabelFont;
    this.mapWidth = max(dc.w, 200);
    let mapHeightWithText = dc.w / 2 + 2 * lineHeight;
    this.xOffset = 0;
    let yOffset = floor((dc.h - mapHeightWithText) / 2);

    if (yOffset < 0) {
      yOffset = 0;
      mapHeightWithText = max(dc.h, 100);
      this.mapWidth = (mapHeightWithText - 2 * lineHeight) * 2;
      this.xOffset = floor((dc.w - this.mapWidth) / 2);
    }

    const   header = '- To set a new observer location, click on the map below -';

    dc.context.fillStyle = 'black';
    dc.context.fillText(header, (dc.w - dc.context.measureText(header).width) / 2, yOffset + ascent);
    this.mapHeight = mapHeightWithText - 2 * lineHeight;
    this.mapYOffset = yOffset + lineHeight;

    dc.context.drawImage(map, this.xOffset, this.mapYOffset, this.mapWidth, this.mapHeight);

    const ei = dc.ss.getSolarEclipseInfo(dc.jde, true);
    let eclipseLocation = null;

    if (ei.inPenumbra) {
      let msg: string;

      if (ei.total)
        msg = '- Sun is totally eclipsed -';
      else if (ei.annular)
        msg = '- Sun is annularly eclipsed -';
      else
        msg = '- Sun is partially eclipsed -';

      dc.context.fillStyle = 'white';
      dc.context.fillText(msg, (dc.w - dc.context.measureText(msg).width) / 2, this.mapYOffset + this.mapHeight + ascent);

      eclipseLocation = ei.surfaceShadow;
      this.lastEclipseCenterLatitude = eclipseLocation.latitude.degrees;
      this.lastEclipseCenterLongitude = eclipseLocation.longitude.degrees;

      if (this.showEclipseShadows) {
        const x0 = this.longitude_to_ix(eclipseLocation.longitude.degrees);
        const y0 = this.latitude_to_iy(eclipseLocation.latitude.degrees);

        this.floodFillMoonShadow(dc, x0, y0);
      }

      if (!this.activeEclipse) {
        this.activeEclipse = true;
        this.appService.sendAppEvent(EVENT_MAP_ACTIVE_ECLIPSE, true);
      }
    }
    else if (this.activeEclipse) {
      this.activeEclipse = false;
      this.appService.sendAppEvent(EVENT_MAP_ACTIVE_ECLIPSE, false);
    }

    const sunPos = dc.ss.getEquatorialPosition(SUN, dc.jde, null, QUICK_SUN);
    const siderealTime = SolarSystem.getGreenwichMeanSiderealTime(dc.jdu);
    const sunLatitude = this.lastSunLatitude = sunPos.declination.degrees;
    const sunLongitude = this.lastSunLongitude = mod2(sunPos.rightAscension.degrees - siderealTime, 360);

    if (this.showDayNight)
      this.benight(dc, sunLatitude, sunLongitude);

    if (this.showMarkers) {
      if (!this.blink || this.blinkPhase !== 1) {
        const x = this.xOffset + this.longitude_to_ix(sunLongitude) - HALF_MARKER;
        const y = this.mapYOffset + this.latitude_to_iy(sunLatitude) - HALF_MARKER;

        dc.context.drawImage(this.markerSubsolar, x, y);
      }

      if (!this.blink || this.blinkPhase < 2) {
        const x = this.xOffset + this.longitude_to_ix(dc.skyObserver.longitude.degrees) - HALF_MARKER;
        const y = this.mapYOffset + this.latitude_to_iy(dc.skyObserver.latitude.degrees) - HALF_MARKER;

        dc.context.drawImage(this.markerLocation, x, y);
      }

      if (eclipseLocation && (!this.blink || this.blinkPhase > 0)) {
        const x = this.xOffset + this.longitude_to_ix(eclipseLocation.longitude.degrees) - HALF_MARKER;
        const y = this.mapYOffset + this.latitude_to_iy(eclipseLocation.latitude.degrees) - HALF_MARKER;

        dc.context.drawImage(this.markerEclipse, x, y);
      }

      if (this.blink && !this.blinkPending) {
        this.blinkPending = true;

        setTimeout(() => {
          this.blinkPhase = ++this.blinkPhase % 3;
          this.blinkPending = false;
          this.draw();
        }, 500);
      }
    }
  }

  protected benight(dc: DrawingContext, sunLatitude: number, sunLongitude: number): void {
    const sinLat = sin_deg(sunLatitude);
    const cosLat = cos_deg(sunLatitude);
    const r = cos_deg(DAYLIGHT_EXPAND);
    const x_adj = sin_deg(DAYLIGHT_EXPAND) * -cosLat;
    const z_adj = sin_deg(DAYLIGHT_EXPAND) * -sinLat;
    const w = this.mapWidth;
    const h = this.mapHeight;
    const ctx = dc.context;
    let ymMin = Number.MAX_VALUE;
    let ymMax = -Number.MAX_VALUE;
    let ymLast = null;

    dc.context.fillStyle = shadowColor;

    // Step around a circle tilted away from the pole at the same angle as
    // the Sun's declination, turn those points into Earth-surface latitudes
    // and longitude, then offset the longitudes around the current
    // sub-solar longitude. This will give you the circle of illumination.
    //
    for (let a = 90; a >= -90; a -= 0.125) {
      const x = -sinLat * sin_deg(a) * r + x_adj;
      const y = cos_deg(a) * r;
      const z = cosLat * sin_deg(a) * r + z_adj;
      const pos = SphericalPosition3D.convertRectangular(x, y, z);
      const L = pos.longitude.degrees;

      if (abs(L) > 0.1) {
        const B = pos.latitude.degrees;
        const ym = max(min(h / 2 - B / 180.0 * h, h), 0);
        const dayStart = this.longitude_to_x(sunLongitude - L);
        const dayEnd = this.longitude_to_x(sunLongitude + L);

        if (ymLast === undefined)
          ymLast = ym;
        else if (ym >= ymLast + 0.5) {
          const thickness = max(ym - ymLast, 0.5);
          // A line thickness around 0.5 produces a smoother shadow edge, but visible banding within
          // large areas of the shadow. A minimum thickness of 1 eliminates the banding, but makes the
          // edge of the shadow jaggy. If we draw thin lines near the shadow edge, and thick lines in
          // the shadow interior, we can get the best of both worlds at the price of a little more time
          // spent drawing.

          if (dayStart < dayEnd - 1) {
            this.fillRectFromNightMap(ctx, 0, ymLast, dayStart, thickness);

            if (dayStart > 2)
              this.fillRectFromNightMap(ctx, 0, ymLast, dayStart - 2, 1);

            this.fillRectFromNightMap(ctx, dayEnd, ymLast, w - dayEnd, thickness);

            if (w - dayEnd > 2)
              this.fillRectFromNightMap(ctx, dayEnd + 2, ymLast, w - dayEnd - 2, 1);
          }
          else if (dayEnd < dayStart - 1) {
            this.fillRectFromNightMap(ctx, dayEnd, ymLast, dayStart - dayEnd, thickness);

            if (dayStart - dayEnd > 4)
              this.fillRectFromNightMap(ctx, dayEnd + 2, ymLast, dayStart - dayEnd - 4, 1);
          }

          ymLast = ym;
        }

        ymMin = min(ymMin, ym);
        ymMax = max(ymMax, ym);
      }
    }

    if (sunLatitude >= DAYLIGHT_EXPAND && ymMax > h / 2)
      this.fillRectFromNightMap(ctx, 0, floor(ymMax), w, h - floor(ymMax));
    else if (sunLatitude <= -DAYLIGHT_EXPAND && ymMin < h / 2)
      this.fillRectFromNightMap(ctx, 0, 0, w, ceil(ymMin));
  }

  protected longitude_to_x(lon: number): number {
    // noinspection JSSuspiciousNameCombination
    return mod(this.mapWidth / 2 + lon / 360 * this.mapWidth, this.mapWidth);
  }

  protected longitude_to_ix(lon: number): number {
    // noinspection JSSuspiciousNameCombination
    return mod(round(this.mapWidth / 2 + lon / 360 * this.mapWidth), this.mapWidth);
  }

  protected latitude_to_iy(lat: number): number {
    return max(min(round(this.mapHeight / 2 - lat / 180 * this.mapHeight), this.mapHeight), 0);
  }

  protected x_to_longitude(x: number): number {
    return mod2((x - this.mapWidth / 2) / this.mapWidth * 360, 360);
  }

  protected y_to_latitude(y: number): number {
    return max(min((this.mapHeight / 2 - y) / this.mapHeight * 180, 90), -90);
  }

  protected getMoonShadowPt(x: number, y: number): number {
    const value = this.moonShadowPts[y * this.mapWidth + x];

    return (value === undefined ? UNCHECKED : value);
  }

  protected setMoonShadowPt(x: number, y: number, value: number): void {
    this.moonShadowPts[y * this.mapWidth + x] = value;
  }

  protected fillRectFromNightMap(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const nightMap = (this.mapType === MapType.TERRAIN ? this.nightMap : this.politicalNightMap);

    if (this.nightMap) {
      const srcX = x / this.mapWidth * this.nightMap.width;
      const srcY = y / this.mapHeight * this.nightMap.height;
      const srcW = w / this.mapWidth * this.nightMap.width;
      const srcH = h / this.mapHeight * this.nightMap.height;

      ctx.drawImage(nightMap, srcX, srcY, srcW, srcH, x + this.xOffset, y + this.mapYOffset, w, h);
    }
  }

  protected floodFillMoonShadow(dc: DrawingContext, x: number, y: number): void {
    const stack: Point[] = [];

    this.moonShadowPts = [];
    stack.push({ x, y });

    while (stack.length > 0) {
      ({ x, y } = stack.pop());

      this.setMoonShadowPt(x, y, MAX_SHADOWED);
      dc.context.fillStyle = shadowColor;
      dc.context.fillRect(x + this.xOffset, y + this.mapYOffset, 1, 1);

      for (let i = 0; i < 8; ++i) {
        let ny = y + ffdy[i];
        let flipped = false;

        if (ny < 0) {
          ny *= -1;
          flipped = true;
        }
        else if (ny > this.mapHeight) {
          ny = (this.mapHeight - 1) * 2 - ny;
          flipped = true;
        }

        // noinspection JSSuspiciousNameCombination
        const nx = mod(x + ffdx[i] + (flipped ? floor(this.mapWidth / 2) : 0), this.mapWidth);

        if (this.getMoonShadowPt(nx, ny) === UNCHECKED) {
          this.setMoonShadowPt(nx, ny, CHECKED);
          const mag = this.getEclipseMagnitude(dc, nx, ny);

          if (mag > MIN_SEARCH_MAGNITUDE)
            stack.push({ x: nx, y: ny });
          else if (mag >= MIN_ECLIPSE_MAGNITUDE) {
            this.setMoonShadowPt(nx, ny,
              floor((MIN_SHADOWED + (MAX_SHADOWED - MIN_SHADOWED) *
               (mag - MIN_ECLIPSE_MAGNITUDE) / (MIN_SEARCH_MAGNITUDE - MIN_ECLIPSE_MAGNITUDE))));
            dc.context.fillStyle = 'rgba(0,0,0,' + (mag * 0.6) + ')';
            dc.context.fillRect(nx + this.xOffset, ny + this.mapYOffset, 1, 1);
          }
        }
      }
    }
  }

  // Magnitude for my purposes here doesn't necessarily match the standard definition of
  // eclipse magnitude. When the Sun and Moon are very close in angular size, note that
  // having time and geographic location rounded to whole minutes can easily result in
  // missing the time and location where full totality or annularity take place.
  //
  protected getEclipseMagnitude(dc: DrawingContext, x: number, y: number): number {
    const testObserver = new SkyObserver(this.x_to_longitude(x), this.y_to_latitude(y));
    const sunAltitude   = dc.ss.getHorizontalPosition(SUN, dc.jdu, testObserver, QUICK_SUN).altitude.degrees;

    if (sunAltitude < -REFRACTION_AT_HORIZON - AVG_SUN_MOON_RADIUS)
      return 0;

    const separation = dc.ss.getSolarElongation(MOON, dc.jde, testObserver,
                                                ABERRATION | QUICK_SUN | TOPOCENTRIC);
    const sunRadius  = dc.ss.getAngularDiameter(SUN,  dc.jde) / 7200.0;
    const moonRadius = dc.ss.getAngularDiameter(MOON, dc.jde, testObserver) / 7200.0;

    if (moonRadius >= sunRadius)
      return max((moonRadius - separation) / sunRadius, 0.0);
    else
      return max((sunRadius - separation) / moonRadius, 0.0);
  }

  protected isInsideView(): boolean {
    if (!this.lastDrawingContext)
      return false;

    return this.withinPlot(this.lastMoveX, this.lastMoveY, this.lastDrawingContext);
  }

  protected withinPlot(x: number, y: number, _dc?: DrawingContext): boolean {
    return (this.xOffset <= x && x < this.xOffset + this.mapWidth &&
            this.mapYOffset <= y && y < this.mapYOffset + this.mapHeight);
  }

  protected resetCursor(): void {
    if (this.isInsideView())
      this.cursor = 'crosshair';
    else
      this.cursor = 'default';
  }

  onMouseMove(event: MouseEvent): void {
    super.onMouseMove(event);

    if (this.withinPlot(event.offsetX, event.offsetY))
      this.marqueeText = formatLatitude(this.y_to_latitude(event.offsetY - this.mapYOffset)) + ', ' +
                         formatLongitude(this.x_to_longitude(event.offsetX - this.xOffset));
    else
      this.marqueeText = '';
  }

  onClick(event: MouseEvent): void {
    if (this.withinPlot(event.offsetX, event.offsetY))
      this.goToLocation(this.y_to_latitude(event.offsetY - this.mapYOffset),
                        this.x_to_longitude(event.offsetX - this.xOffset));
  }

  goToSubsolarPoint(): void {
    this.goToLocation(this.lastSunLatitude, this.lastSunLongitude);
  }

  goToEclipseCenter(): void {
    this.goToLocation(this.lastEclipseCenterLatitude, this.lastEclipseCenterLongitude);
  }

  goToLocation(lat: number, lon: number): void {
    this.latitude = lat;
    this.longitude = lon;

    this.timeService.getZoneForLocation(this.longitude, this.latitude, null, 5000).then((zoneForLocation: ZoneForLocation) => {
      if (zoneForLocation.status === 'OK' && this.appService.isKnownIanaTimezone(zoneForLocation.timeZoneId))
        this.timezone = zoneForLocation.timeZoneId;
      else
        this.timezone = null;

      this.showLocationDialog = true;
    }).catch((reason: any) => {
      console.log(reason);
      this.timezone = null;
      this.showLocationDialog = true;
    });
  }
}
