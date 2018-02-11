/*
  Copyright © 2017 Kerry Shetline, kerry@shetline.com

  MIT license: https://opensource.org/licenses/MIT

  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
  documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
  rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
  persons to whom the Software is furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
  Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
  WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
  COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
  OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import { ISkyObserver } from './i-sky-observer';
import {
  abs, Angle, asin, atan, atan2, cos, HALF_PI, interpolate, limitNeg1to1, mod, PI, sign, sin, SphericalPosition, SphericalPosition3D,
  sqrt, tan, to_degree, to_radian, TWO_PI, Unit
} from 'ks-math';
import { refractedAltitude, unrefractedAltitude } from './astronomy-util';
import { SolarSystem } from './solar-system';
import { TDB_to_UT, UT_to_TDB } from './ut-converter';
import { ABERRATION, EARTH_RADIUS_KM, EARTH_RADIUS_POLAR_KM, KM_PER_AU, NUTATION, REFRACTION, SUN, TOPOCENTRIC } from './astro-constants';
import * as _ from 'lodash';

const A90_1SEC = 1.5707915;
const A90_2SEC = 1.5707866;

SolarSystem.createSkyObserver = (longitude, latitude) => new SkyObserver(longitude, latitude);

export class SkyObserver implements ISkyObserver {
  private static solarSystem: SolarSystem;

  private _longitude: Angle;
  private _latitude: Angle;
  private elevation = 0;
  private rho_sin_gcl: number;
  private rho_cos_gcl: number;

  private cachedHourAngle: Angle = null;
  private cacheTimeHourAngle = 0;
  private cacheApparentHourAngle = false;

  private computeGeocentricValues(): void {
    const peRatio = EARTH_RADIUS_POLAR_KM / EARTH_RADIUS_KM;
    const latRad = this._latitude.radians;
    let u: number;

    // If within one arc-second of either pole, u is very close to the value of
    // the latitude anyway, so avoid having the tan function blow up at ±90°.
    // Between one and two arc-seconds from pole, interpolate to avoid a discontinuity.

    if (abs(latRad) > A90_1SEC)
      u = latRad;
    else if (abs(latRad) > A90_2SEC) {
      const s = sign(latRad);

      u = interpolate(s * A90_1SEC, latRad, s * A90_2SEC, latRad, atan(peRatio * tan(A90_2SEC)));
    }
    else
      u = atan(peRatio * this._latitude.tan);

    this.rho_sin_gcl = peRatio * sin(u) + this.elevation / EARTH_RADIUS_KM / 1000.0 * this._latitude.sin;
    this.rho_cos_gcl = cos(u) + this.elevation / EARTH_RADIUS_KM / 1000.0 * this._latitude.cos;
  }

  constructor(longitudeOrLatLong: number | SphericalPosition | Angle, latitude?: number | Angle) {
    if (!SkyObserver.solarSystem)
      SkyObserver.solarSystem = new SolarSystem();

    if (longitudeOrLatLong instanceof SphericalPosition) {
      this._longitude = (<SphericalPosition> longitudeOrLatLong).longitude;
      this._latitude = (<SphericalPosition> longitudeOrLatLong).latitude;
    }
    else {
      if (_.isNumber(longitudeOrLatLong))
        this._longitude = new Angle(<number> longitudeOrLatLong, Unit.DEGREES);
      else
        this._longitude = <Angle> longitudeOrLatLong;

      if (_.isNumber(latitude))
        this._latitude = new Angle(<number> latitude, Unit.DEGREES);
      else
        this._latitude = <Angle> latitude;
    }

    this.computeGeocentricValues();
  }

  get longitude(): Angle { return this._longitude; }

  get latitude(): Angle { return this._latitude; }

  public getLocalHourAngle(time_JDU: number, apparent: boolean): Angle {
    if (this.cachedHourAngle === null || this.cacheTimeHourAngle !== time_JDU || this.cacheApparentHourAngle === apparent) {
      let gst: number;

      if (apparent)
        gst = SkyObserver.solarSystem.getGreenwichApparentSiderealTime(time_JDU);
      else
        gst = SolarSystem.getGreenwichMeanSiderealTime(time_JDU);

      this.cachedHourAngle = new Angle(gst, Unit.DEGREES).add_nonneg(this._longitude);
      this.cacheTimeHourAngle = time_JDU;
      this.cacheApparentHourAngle = apparent;
    }

    return this.cachedHourAngle;
  }

  public getApparentSolarTime(time_JDU: number): Angle {
    const lha = this.getLocalHourAngle(time_JDU, true);
    const time_JDE = UT_to_TDB(time_JDU);
    const sun =  SkyObserver.solarSystem.getEquatorialPosition(SUN, time_JDE, this).rightAscension;

    return lha.subtract(sun).add_nonneg(Angle.STRAIGHT);
  }

  // Note: Only right ascension and declination are modified -- distance is not modified
  // by the offset of the geographic location of the observer from the center of the
  // Earth. Distance is modified, however, in the function equatorialToHorizontalAux() in
  // order to improve the accuracy of computations such as the angular size of the Moon.
  //
  // Note: If diurnal aberration is computed for coordinates near the poles, there is a
  // slight discontinuity within one arcsecond of each pole.
  //
  public equatorialTopocentricAdjustment(pos: SphericalPosition3D, time_JDE: number, flags: number): SphericalPosition3D {
    const time_JDU = TDB_to_UT(time_JDE);
    const lha      = this.getLocalHourAngle(time_JDU, (flags & NUTATION) !== 0).radians;
    const distance = pos.radius;
    // Sine of parallax, using 8.79412 arc seconds and distance in AU.
    const sinp = sin(8.79412 / 3600.0 / 180.0 * PI) / distance;
    let   RA   = pos.rightAscension.radians;
    const d    = pos.declination.radians;
    const H    = lha - RA;

    let deltaRA = atan2(-this.rho_cos_gcl * sinp * sin(H),
                        cos(d) - this.rho_cos_gcl * sinp * cos(H));
    let d1      = atan2((sin(d) - this.rho_sin_gcl * sinp) * cos(deltaRA),
                        cos(d) - this.rho_cos_gcl * sinp * cos(H));

    if ((flags & ABERRATION) !== 0) {
      RA += deltaRA;

      if (abs(d1) > HALF_PI - 4.85E-6) {
        deltaRA = 0.0;

        const rd = HALF_PI - abs(d1);
        const rl = 1.551E-6 * this._latitude.cos;
        const x  = cos(RA) * rd - sin(lha) * rl;
        const y  = sin(RA) * rd + cos(lha) * rl;
        const r  = sqrt(x * x + y * y);

        RA = atan2(y, x);
        d1 = (HALF_PI - r) * sign(d1);
      }
      else {
        deltaRA = 1.551E-6 * this._latitude.cos * cos(H) / cos(d1);
        d1 += 1.551E-6 * this._latitude.cos * sin(d1) * sin(H);
      }
    }

    return new SphericalPosition3D(RA + deltaRA, d1, distance);
  }

  public equatorialToHorizontal(pos: SphericalPosition, time_JDU: number, flags = 0): SphericalPosition {
    // Calculations are faster if nutation isn't calculated into the position of the planet,
    // because then nutation doesn't need to be figured into the hour angle either.
    const lha = this.getLocalHourAngle(time_JDU, (flags & NUTATION) !== 0).radians;
    const RA  = pos.rightAscension.radians;
    const d   = pos.declination.radians;
    const H   = lha - RA;

    const azimuth = atan2(sin(H),
                          (cos(H) * this._latitude.sin - tan(d) * this._latitude.cos));
    let altitude = asin(limitNeg1to1(this._latitude.sin * sin(d) + this._latitude.cos * cos(d) * cos(H)));
    const unrefracted = altitude;

    if ((flags & REFRACTION) !== 0)
      altitude = to_radian(refractedAltitude(to_degree(altitude)));

    if (pos instanceof SphericalPosition3D) {
      let distance = (<SphericalPosition3D> pos).radius;

      if ((flags & TOPOCENTRIC) !== 0) {
        const earthCtrDistance = EARTH_RADIUS_POLAR_KM +
                (EARTH_RADIUS_KM - EARTH_RADIUS_POLAR_KM) * this._latitude.cos + this.elevation / 1000.0;

        distance -= sin(unrefracted) * earthCtrDistance / KM_PER_AU;
      }

      return new SphericalPosition3D(azimuth, altitude, distance);
    }
    else
      return new SphericalPosition(azimuth, altitude);
  }

  public horizontalToEquatorial(pos: SphericalPosition, time_JDU: number, flags = 0): SphericalPosition {
    const lha = this.getLocalHourAngle(time_JDU, (flags & NUTATION) !== 0).radians;
    let   altitude = pos.altitude.radians;
    const azimuth  = pos.azimuth.radians;

    if ((flags & REFRACTION) !== 0)
      altitude = to_radian(unrefractedAltitude(to_degree(altitude)));

    const RA = lha - atan2(sin(azimuth), cos(azimuth) * this._latitude.sin + tan(altitude) * this._latitude.cos);
    const declination = asin(limitNeg1to1(this._latitude.sin * sin(altitude) -
                                            this._latitude.cos * cos(altitude) * cos(azimuth)));

    return new SphericalPosition(mod(RA, TWO_PI), declination);
  }
}
