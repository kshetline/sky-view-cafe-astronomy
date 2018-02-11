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

import {
  abs, acos, acos_deg, Angle, asin_deg, atan2_deg, atan_deg, cos, cos_deg, exp, limitNeg1to1, log, log10, max, min, mod, mod2, pow,
  sin, sin_deg, SphericalPosition, SphericalPosition3D, sqrt, tan, tan_deg, to_radian, TWO_PI, Unit
} from 'ks-math';
import { ISkyObserver } from './i-sky-observer';
import { Ecliptic, NMode } from './ecliptic';
import { MeeusMoon } from './meeus-moon';
import { Vsop87Planets } from './vsop87-planets';
import { Pluto } from './pluto';
import { TDB_to_UT, UT_to_TDB } from './ut-converter';
import {
  ABERRATION, ASTEROID_BASE, ASTEROID_MAX, ASTROMETRIC, COMET_BASE, COMET_MAX, DEFAULT_FLAGS, DELAYED_TIME, EARTH, EARTH_RADIUS_KM,
  EARTH_RADIUS_POLAR_KM, FIRST_PLANET, HIGH_PRECISION, JD_J2000, JUPITER, KM_PER_AU, LAST_PLANET, LIGHT_DAYS_PER_AU, LOW_PRECISION,
  MARS, MERCURY, MOON, MOON_RADIUS_KM, NEPTUNE, NO_MATCH, NUTATION, PLUTO, QUICK_PLANET, QUICK_SUN, SATURN, SIGNED_HOUR_ANGLE, SUN,
  SUN_RADIUS_KM, TOPOCENTRIC, TRUE_DISTANCE, UNKNOWN_MAGNITUDE, URANUS, VENUS
} from './astro-constants';
import * as _ from 'lodash';
import { AdditionalOrbitingObjects } from './additional-orbiting-objects';
import { AstroDataService } from './astro-data.service';

export interface AsteroidCometElements {
  e: number;  // eccentricity
  epoch: string | number;
  i: number;  // inclination
  L: number;  // longitude of the ascending node
  Tp: number; // Time of perihelion passage
  q: number;  // perihelion distance
  w: number;  // argument of the perihelion
}

export interface AsteroidCometDescription {
  designation: string; // Horizons data service designation
  G?: number; // slope parameter for magnitude
  H?: number; // absolute visual magnitude
  name: string;
}

export interface AsteroidCometInfo {
  body: AsteroidCometDescription;
  elements: AsteroidCometElements[];
}

export interface EclipseInfo {
  // All angular values are in arcseconds.
  isSolar: boolean;
  pos: SphericalPosition3D; // position of body that may have shadow cast upon it
  radius: number; // angular radius of body that may have shadow cast upon it
  shadowPos: SphericalPosition;
  penumbraRadius: number;
  umbraRadius: number;
  centerSeparation: number;
  penumbralSeparation: number; // Zero at contact of penumbra and Moon's disc, negative for overlap.
  inPenumbra: boolean;
  umbralSeparation: number; // Zero at contact of umbra and Moon's disc, negative for overlap.
  inUmbra: boolean; // If this is true, inPenumbra must also be true
  total: boolean;
  annular: boolean;
  hybrid: boolean;
  surfaceShadow: ISkyObserver; // Only for solar eclipse, latitude and longitude of shadow's center.
}

export interface RingInfo {
  // Angles B, B1, and U are Saturnicentric, in degrees, measured in the plane of the ring.
  B:  number;   // Latitude of Earth. When positive, northern surface of ring is visible.
  B1: number;   // Latitude of Sun. When positive, northern surface of ring is illuminated.
  P:  number;   // Geocentric position angle, degrees, measured from North toward East.
  a:  number;   // ring's major axis, arcseconds
  b:  number;   // ring's minor axis, arcseconds
  dU: number;   // Difference in longitudes of the Sun and the Earth, needed for apparent magnitude.
}

export interface OrbitalElements {
  L:     number;    // mean longitude
  a:     number;    // semimajor axis
  e:     number;    // eccentricity
  i:     number;    // inclination of orbit
  OMEGA: number;    // longitude of ascending node
  pi:    number;    // longitude of perihelion
  omega: number;    // argument of the perihelion (pi - OMEGA)
  M:     number;    // mean anomaly
  C:     number;    // equation of center
  v:     number;    // true anomaly
  partial: boolean; // true when all other fields not filled in, such as results returned by AdditionalOrbitingObjects.
}

  // Orbital elements for mean equinox of date (except Pluto, J2000.0).
  //
  //        t^0, t^1, t^2, t^3
  // L      mean longitude
  // a      semi-major axis (no time-dependent terms)
  // e      eccentricity
  // i      inclination
  // OMEGA  longitude of the ascending node
  // pi     longitude of the perihelion
  //
  const elems =
  [
    [ // Mercury
      [252.250906, 149474.0722491, 0.00030350, 0.000000018],
      [0.387098310, 0.0, 0.0, 0.0],
      [0.20563175, 0.000020407, -0.0000000283, -0.00000000018],
      [7.004986, 0.0018215, -0.00001810, 0.000000056],
      [48.330893, 1.1861883, 0.00017542, 0.000000215],
      [77.456119, 1.5564776, 0.00029544, 0.000000009]
    ],
    [ // Venus
      [181.979801, 58519.2130302, 0.00031014, 0.000000015],
      [0.723329820, 0.0, 0.0, 0.0],
      [0.00677192, -0.000047765, 0.0000000981, 0.00000000046],
      [3.394662, 0.0010037, -0.00000088, -0.000000007],
      [76.679920, 0.9011206, 0.00040618, -0.000000093],
      [131.563703, 1.4022288, -0.00107618, -0.000005678]
    ],
    [ // Earth
      [100.466457, 36000.7698278, 0.00030322, 0.000000020],
      [1.000001018, 0.0, 0.0, 0.0],
      [0.01670863, -0.000042037, -0.0000001267, 0.00000000014],
      [0.0, 0.0, 0.0, 0.0],
      [0.0, 0.0, 0.0, 0.0],
      [102.937348, 1.7195366, 0.00045688, -0.000000018]
    ],
    [ // Mars
      [355.433000, 19141.6964471, 0.00031052, 0.000000016],
      [1.523679342, 0.0, 0.0, 0.0],
      [0.09340065, 0.000090484, -0.0000000806, -0.00000000025],
      [1.849726, -0.0006011, 0.00001276, -0.000000007],
      [49.558093, 0.7720959, 0.00001557, 0.000002267],
      [336.060234, 1.8410449, 0.00013477, 0.000000536]
    ],
    [ // Jupiter
      [34.351519, 3036.3027748, 0.00022330, 0.000000037],
      [5.202603209, 0.0000001913, 0.0, 0.0],
      [0.04849793, 0.000163225, -0.0000004714, -0.00000000201],
      [1.303267, -0.0054965, 0.00000466, -0.000000002],
      [100.464407, 1.0209774, 0.00040315, 0.000000404],
      [14.331207, 1.6126352, 0.00103042, -0.000004464]
    ],
    [ // Saturn
      [50.077444, 1223.5110686, 0.00051908, -0.000000030],
      [9.554909192, -0.0000021390, 0.000000004, 0.0],
      [0.05554814, -0.000346641, -0.0000006436, 0.00000000340],
      [2.488879, -0.0037362, -0.00001519, 0.000000087],
      [113.665503, 0.8770880, -0.00012176, -0.000002249],
      [93.057237, 1.9637613, 0.00083753, 0.000004928]
    ],
    [ // Uranus
      [314.055005, 429.8640561, 0.00030390, 0.000000026],
      [19.218446062, -0.0000000372, 0.00000000098, 0.0],
      [0.04638122, -0.000027293, 0.0000000789, 0.00000000024],
      [0.773197, 0.0007744, 0.00003749, -0.000000092],
      [74.005957, 0.5211278, 0.00133947, 0.000018484],
      [173.005291, 1.4863790, 0.00021406, 0.000000434]
    ],
    [ // Neptune
      [304.348665, 219.8833092, 0.00030882, 0.000000018],
      [30.110386869, -0.0000001663, 0.00000000069, 0.0],
      [0.00945575, 0.000006033, 0.0000000000, -0.00000000005],
      [1.769953, -0.0093082, -0.00000708, 0.000000027],
      [131.784057, 1.1022039, 0.00025952, -0.000000637],
      [48.120276, 1.4262957, 0.00038434, 0.000000020]
    ],
    [ // Pluto -- J2000.0 instead of equinox of date, no precessional terms.
      [238.96, 144.96, 0.0, 0.0],
      [39.543, 0.0, 0.0, 0.0],
      [0.2490, 0.0, 0.0, 0.0],
      [17.140, 0.0, 0.0, 0.0],
      [110.307, 0.0, 0.0, 0.0],
      [224.075, 0.0, 0.0, 0.0],
    ]
  ];

export class SolarSystem {
  public static createSkyObserver: (longitude: number, latitude: number) => ISkyObserver;

  private static sharedAdditionalsInitPending = true;
  private static sharedAdditionalsPendingPromise: Promise<boolean>;
  private static sharedAdditionals: AdditionalOrbitingObjects;

  private ecliptic = new Ecliptic();
  private moon = new MeeusMoon();
  private planets = new Vsop87Planets();
  private pluto = new Pluto();
  private planetNames = ['Sun', 'Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn',
                         'Uranus', 'Neptune', 'Pluto', 'Moon'];
  private planetSymbols = ['\u2609', '\u263F', '\u2640', '\u2641', '\u2642', '\u2643', '\u2644',
                           '\u2645', '\u2646', '\u2647', '\u263D'];

  private static getPrecision(planet: number, flags: number): number {
    if ((flags & HIGH_PRECISION) !== 0 || planet === PLUTO)
      return 0.0;
    else if (planet === MOON)
      return (flags & LOW_PRECISION) !== 0 ? 0.1 : 0.01;
    else
      return 0.0;
  }

  // Result in degrees
  //
  public static getGreenwichMeanSiderealTime(time_JDU: number): number {
    const t = time_JDU - JD_J2000;
    const T = t / 36525;

    return mod(280.46061837 + 360.98564736629 * t + 0.000387933 * T * T - T * T * T / 38710000.0, 360.0);
  }

  public static isNominalPlanet(planet: number): boolean {
    return (FIRST_PLANET <= planet && planet <= LAST_PLANET);
  }

  public static isTruePlanet(planet: number): boolean {
    return (MERCURY <= planet || planet <= NEPTUNE);
  }

  public static isAsteroid(planet: number): boolean {
    return (ASTEROID_BASE < planet && planet <= ASTEROID_MAX);
  }

  public static isComet(planet: number): boolean {
    return (COMET_BASE < planet && planet <= COMET_MAX);
  }

  public static getAsteroidCount(): number {
    if (this.sharedAdditionals)
      return this.sharedAdditionals.getAsteroidCount();
    else
      return 0;
  }

  public static getCometCount(): number {
    if (this.sharedAdditionals)
      return this.sharedAdditionals.getCometCount();
    else
      return 0;
  }

  public static getAsteroidAndCometNames(forMenu = false): string[] {
    if (this.sharedAdditionals)
      return this.sharedAdditionals.getObjectNames(forMenu);
    else
      return [];
  }

  public static isAsteroidOrComet(planet: number): boolean {
    return (SolarSystem.isAsteroid(planet) || SolarSystem.isComet(planet));
  }

  public static orbitsSun(planet: number): boolean {
    return ((MERCURY <= planet && planet <= PLUTO) || SolarSystem.isAsteroidOrComet(planet));
  }

  public static getOrbitalElements(planet: number, time_JDE: number): OrbitalElements {
    if (planet < MERCURY || planet > PLUTO) {
      if (this.sharedAdditionals && this.isAsteroidOrComet(planet))
        return this.sharedAdditionals.getOrbitalElements(planet, time_JDE);

      return undefined;
    }

    const index = planet - MERCURY;
    const oe = <OrbitalElements> {};
    const T = (time_JDE - JD_J2000) / 36525.0;
    let   t = 1.0;
    const elem = [0, 0, 0, 0, 0, 0];

    for (let p = 0; p < 4; ++p) {
      for (let n = 0; n < 6; ++n)
        elem[n] += elems[index][n][p] * t;

      t *= T;
    }

    oe.L = mod(elem[0], 360.0);
    oe.a = elem[1];
    oe.e = elem[2];
    oe.i = elem[3];
    oe.OMEGA = mod(elem[4], 360.0);
    oe.pi = mod(elem[5], 360.0);

    // All other planets besides Pluto have automatically computed precession.
    if (planet === PLUTO) {
      const deltaL = Ecliptic.precessEcliptical(new SphericalPosition(), time_JDE).longitude.degrees;

      oe.L = mod(oe.L + deltaL, 360.0);
      oe.OMEGA = mod(oe.OMEGA + deltaL, 360.0);
      oe.pi = mod(oe.pi + deltaL, 360.0);
    }

    oe.omega = mod(oe.pi - oe.OMEGA, 360.0);
    oe.M = mod(oe.L - oe.pi, 360.0);

    const M = to_radian(oe.M);
    let E0 = M, E1 = M;

    for (let i = 0; i < 100; ++i) { // Limiting number of iterations to a max of 100
      E1 = M + oe.e * sin(E0);

      if (abs(mod2(E1 - E0, TWO_PI)) < 1.0E-6)
        break;

      E0 = E1;
    }

    oe.v = mod(2.0 * atan_deg(sqrt((1.0 + oe.e) / (1.0 - oe.e)) * tan(E1 / 2.0)), 360.0);
    oe.C = mod(oe.v - oe.M, 360.0);

    return oe;
  }

  public static getHeliocentricPositionFromElements(oe: OrbitalElements): SphericalPosition3D {
    const cos_i = cos_deg(oe.i);
    const sin_i = sin_deg(oe.i);
    const cos_o = cos_deg(oe.OMEGA);
    const sin_o = sin_deg(oe.OMEGA);
    const r = oe.a * (1.0 - oe.e * oe.e) / (1.0 + oe.e * cos_deg(oe.v));
    const vpo = oe.v + oe.pi - oe.OMEGA;
    const cos_vpo = cos_deg(vpo);
    const sin_vpo = sin_deg(vpo);
    const x = r * (cos_o * cos_vpo - sin_o * sin_vpo * cos_i);
    const y = r * (sin_o * cos_vpo + cos_o * sin_vpo * cos_i);
    const z = r * sin_vpo * sin_i;

    return new SphericalPosition3D(Angle.atan2_nonneg(y, x), Angle.atan2(z, sqrt(x * x + y * y)), r);
  }

  // Result in days per revolution.
  //
  public static getMeanOrbitalPeriod(planet: number): number {
    if (planet < MERCURY || planet > PLUTO)
      return 0.0;

    // Convert degrees per Julian century into days per revolution.
    return 100.0 * 365.25 * 360.0 / elems[planet - MERCURY][0][1];
  }

  // Result in days per mean conjunction period.
  //
  public static getMeanConjunctionPeriod(planet: number): number {
    if (planet === EARTH || planet < FIRST_PLANET || planet > LAST_PLANET)
      return 0.0;

    let p0 = SolarSystem.getMeanOrbitalPeriod(planet);
    let p1 = SolarSystem.getMeanOrbitalPeriod(EARTH);

    if (p0 === 0)
      return 0.0;

    if (p1 < p0) {
      const temp = p0;
      p0 = p1;
      p1 = temp;
    }

    let catchUp = 1.0;
    let total = 0.0;

    for (let i = 0; i < 25; ++i) {
      total += catchUp * p0;
      catchUp = catchUp * p0 / p1;
    }

    return total;
  }

  public static initAsteroidsAndComets(dataService: AstroDataService): Promise<boolean> {
    if (this.sharedAdditionalsInitPending) {
      this.sharedAdditionalsInitPending = false;

      this.sharedAdditionalsPendingPromise = AdditionalOrbitingObjects.getAdditionalOrbitingObjects(dataService).then(ao => {
          this.sharedAdditionals = ao;
          this.sharedAdditionalsPendingPromise = null;

          return Promise.resolve(true);
        }).catch(result => {
          this.sharedAdditionalsPendingPromise = null;
          console.log('Failed to initialze asteroids and comets: ', result);

          return Promise.resolve(false);
        });

      return this.sharedAdditionalsPendingPromise;
    }
    else if (this.sharedAdditionalsPendingPromise)
      return this.sharedAdditionalsPendingPromise;
    else
      return Promise.resolve(!!this.sharedAdditionals);
  }

  public getPlanetName(planet: number): string {
    if (SolarSystem.sharedAdditionals && SolarSystem.isAsteroidOrComet(planet))
      return SolarSystem.sharedAdditionals.getObjectName(planet);

    if (planet >= 0 && planet < this.planetNames.length)
      return this.planetNames[planet];

    return undefined;
  }

  public getPlanetByName(planetName: string): number {
    planetName = planetName.toLowerCase();

    for (let i = 0; i < this.planetNames.length; ++i)
      if (this.planetNames[i].toLowerCase() === planetName)
        return i;

    if (SolarSystem.sharedAdditionals)
      return SolarSystem.sharedAdditionals.getObjectByName(planetName);

    return NO_MATCH;
  }

  public getPlanetSymbol(planet: number): string {
    if (planet >= 0 && planet < this.planetSymbols.length)
      return this.planetSymbols[planet];

    return undefined;
  }

  public getHeliocentricPosition(planet: number, time_JDE: number, flags = 0): SphericalPosition3D {
    let result: SphericalPosition3D = null;
    const precFlags = flags & ~LOW_PRECISION & ~HIGH_PRECISION;

    if (MERCURY <= planet && planet <= NEPTUNE) {
      if (this.planets !== null && (flags & QUICK_PLANET) === 0)
        result = this.planets.getHeliocentricPosition(planet, time_JDE, SolarSystem.getPrecision(planet, flags));
      else
        result = SolarSystem.getHeliocentricPositionFromElements(SolarSystem.getOrbitalElements(planet, time_JDE));
    }
    else if (planet === SUN)
      return new SphericalPosition3D();
    else if (planet === MOON) {
      const sunPos = this.getEclipticPosition(SUN, time_JDE, null, precFlags);

      result = this.getEclipticPosition(MOON, time_JDE, null, precFlags).translate(sunPos);
    }
    else if (planet === PLUTO) {
      if (this.pluto !== null && (flags & QUICK_PLANET) === 0)
        result = this.pluto.getHeliocentricPosition(time_JDE);
      else
        result = SolarSystem.getHeliocentricPositionFromElements(SolarSystem.getOrbitalElements(planet, time_JDE));
    }
    else if (SolarSystem.isAsteroidOrComet(planet) && SolarSystem.sharedAdditionals)
      result = SolarSystem.sharedAdditionals.getHeliocentricPosition(planet, time_JDE);

    return result;
  }

  public getEclipticPosition(planet: number, time_JDE: number, observer?: ISkyObserver,
                             flags = DEFAULT_FLAGS, earthTime?: number): SphericalPosition3D {
    if (_.isNil(earthTime))
      earthTime = time_JDE;

    if (flags === DEFAULT_FLAGS) {
      flags = ABERRATION | NUTATION;

      if (observer)
        flags |= TOPOCENTRIC;
    }

    let result: SphericalPosition3D;

    // Round-about, but effective: If we're asked to compute an ecliptic position with
    // topocentric correction, we compute an equatorial position with topocentric
    // correction and convert that result into an ecliptic position. The computation
    // of an equatorial position, however, first requires the computation of an ecliptic
    // position. A catch-22 is avoided by making sure the equatorial computation does
    // not pass the topocentric flag into this function.

    if ((flags & TOPOCENTRIC) !== 0 && !_.isNil(observer)) {
      const equPos = this.getEquatorialPosition(planet, time_JDE, observer, flags);

      return this.ecliptic.equatorialToEcliptic3D(equPos, time_JDE,
        (flags & NUTATION) !== 0 ? NMode.NUTATED : NMode.J2000);
    }

    if (planet === EARTH)
      return new SphericalPosition3D();
    else if (planet === MOON)
      result = this.moon.getEclipticPosition(time_JDE);
    else if (planet === SUN && (flags & QUICK_SUN) !== 0) {
      const T = (time_JDE - JD_J2000) / 36525.0;
      const T2 = T * T;
      const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T2;
      const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T2;
      const M = 357.52911 + 35999.05029 * T - 0.0001537 * T2;
      const C = (1.914602 - 0.004817 * T - 0.000014 * T2) * sin_deg(M)
              + (0.019993 - 0.000101 * T) * sin_deg(2.0 * M)
              + 0.000289 * sin_deg(3.0 * M);
      const L = mod(L0 + C, 360.0);
      const R = 1.000001018 * (1.0 - e * e) / (1.0 + e * cos_deg(M + C));

      result = new SphericalPosition3D(L, 0.0, R, Unit.DEGREES, Unit.RADIANS);
    }
    else if (SolarSystem.isNominalPlanet(planet) || SolarSystem.isAsteroidOrComet(planet)) {
      const earthPos = this.getHeliocentricPosition(EARTH, earthTime, flags);
      const planetPos = this.getHeliocentricPosition(planet, time_JDE, flags);

      if (planetPos == null)
        return null;
      else
        result = planetPos.translate(earthPos);
    }
    else
      return null;

    if ((flags & ABERRATION) !== 0 || (flags & ASTROMETRIC) !== 0 || (flags & DELAYED_TIME) !== 0) {
      let adjPos: SphericalPosition3D = null;
      let distance = result.radius;
      let delayedTime = time_JDE;
      const flags2 = flags & ~ABERRATION & ~ASTROMETRIC & ~DELAYED_TIME & ~NUTATION;

      // This converges very quickly. Three iterations is easily enough,
      // just one for the Moon.
      for (let i = 0; i < (planet === MOON ? 1 : 3); ++i) {
        delayedTime = time_JDE - LIGHT_DAYS_PER_AU * distance;

        if ((flags & ASTROMETRIC) !== 0)
          adjPos = this.getEclipticPosition(planet, delayedTime, null, flags2, earthTime);
        else
          adjPos = this.getEclipticPosition(planet, delayedTime, null, flags2, delayedTime);

        distance = adjPos.radius;
      }

      if ((flags & TRUE_DISTANCE) !== 0)
        result = new SphericalPosition3D(adjPos.longitude, adjPos.latitude, result.radius);
      else if ((flags & DELAYED_TIME) !== 0)
        // The DELAYED_TIME flag indicates that light delay time should replace distance in the
        // result so that the caller of this method can know the moment in time when a body was
        // in the calculated position.
        result = new SphericalPosition3D(adjPos.longitude, adjPos.latitude, delayedTime);
      else
        result = adjPos;
    }

    if ((flags & NUTATION) !== 0)
      result = this.ecliptic.nutateEclipticPosition3D(result, time_JDE);

    return result;
  }

  public getEquatorialPosition(planet: number, time_JDE: number, observer?: ISkyObserver,
                               flags = DEFAULT_FLAGS): SphericalPosition3D {
    if (planet === EARTH)
      return new SphericalPosition3D();

    if (flags === DEFAULT_FLAGS) {
      flags = ABERRATION | NUTATION;

      if (observer)
        flags |= TOPOCENTRIC;
    }

    let obliquityMode: NMode;

    if ((flags & NUTATION) !== 0)
      obliquityMode = NMode.NUTATED;
    else
      obliquityMode = NMode.MEAN_OBLIQUITY;

    const eclipticPos = this.getEclipticPosition(planet, time_JDE, null, flags & ~TOPOCENTRIC);
    let pos = this.ecliptic.eclipticToEquatorial3D(eclipticPos, time_JDE, obliquityMode);

    if ((flags & TOPOCENTRIC) !== 0 && !_.isNil(observer))
      pos = observer.equatorialTopocentricAdjustment(pos, time_JDE, flags);

    return pos;
  }

  // Result in degrees
  //
  public getGreenwichApparentSiderealTime(time_JDU: number): number {
    const gmst = SolarSystem.getGreenwichMeanSiderealTime(time_JDU);
    const nutation = this.ecliptic.getNutation(UT_to_TDB(time_JDU));

    return mod(gmst + nutation.deltaPsi.degrees * nutation.obliquity.cos, 360.0);
  }

  // Note that getHorizontalPosition() is LOW_PRECISION by default -- which is still typically better
  // than one arcsecond for the planets, 2-3 arcseconds for the Moon.
  //
  // Always topocentric for Moon, even if TOPOCENTRIC flag isn't set -- error too great otherwise.
  // Topocentric adjustment, on the other hand, is usually quite small for other planets
  //
  public getHorizontalPosition(planet: number, time_JDU: number, observer: ISkyObserver,
                               flags = ABERRATION | LOW_PRECISION): SphericalPosition3D {
    if (_.isNil(observer) || (!SolarSystem.isNominalPlanet(planet) && !SolarSystem.isAsteroidOrComet(planet)))
      return null;
    else if (planet === EARTH)
      return new SphericalPosition3D();

    // The SkyObserver method equatorialToHorizontal3D() expects to process coordinates
    // that do not include the effects of nutation.
    flags &= ~NUTATION;

    if (planet === MOON)
      flags |= TOPOCENTRIC;

    const pos = this.getEquatorialPosition(planet, UT_to_TDB(time_JDU), observer, flags);

    return <SphericalPosition3D> observer.equatorialToHorizontal(pos, time_JDU, flags);
  }

  public getHourAngle(planet: number, time_JDU: number, observer: ISkyObserver, flags = DEFAULT_FLAGS): Angle {
    if (flags === DEFAULT_FLAGS) {
      flags = ABERRATION;

      if (!_.isNil(observer))
        flags |= TOPOCENTRIC;
    }

    flags &= ~NUTATION;

    const pos = this.getEquatorialPosition(planet, UT_to_TDB(time_JDU), observer, flags);

    if ((flags & SIGNED_HOUR_ANGLE) !== 0)
      return observer.getLocalHourAngle(time_JDU, false).subtract(pos.rightAscension);
    else
      return observer.getLocalHourAngle(time_JDU, false).subtract_nonneg(pos.rightAscension);
  }

  public getParallacticAngle(planet: number, time_JDU: number, observer: ISkyObserver, flags = DEFAULT_FLAGS): Angle {
    if (planet < SUN || planet > MOON)
      return null;

    if (flags === DEFAULT_FLAGS) {
      flags = ABERRATION;

      if (!_.isNil(observer))
        flags |= TOPOCENTRIC;
    }

    flags &= ~NUTATION;

    const pos = this.getEquatorialPosition(planet, UT_to_TDB(time_JDU), observer, flags);
    const hourAngle = this.getHourAngle(planet, time_JDU, observer, flags);
    const numer = hourAngle.sin;
    const denom = observer.latitude.tan * pos.declination.cos - pos.declination.sin * hourAngle.cos;

    if (denom === 0.0)
      return null;

    return Angle.atan2(numer, denom);
  }

  // Result continuously-variable value in degrees.
  // Key values: 0 - new, 90 - first quarter, 180 - full, 270 - last quarter.
  //
  public getLunarPhase(time_JDE: number): number {
    const posMoon = this.getEclipticPosition(MOON, time_JDE, null, ABERRATION | LOW_PRECISION);
    const posSun  = this.getEclipticPosition(SUN,  time_JDE, null, ABERRATION | LOW_PRECISION);

    return mod(posMoon.longitude.degrees -
                posSun.longitude.degrees, 360.0);
  }

  // Note: this method is different from using getIlluminatedFraction(MOON, time_JDE)
  // because it depends solely on longitudinal separation.
  //
  public getLunarIlluminatedFraction(time_JDE: number): number {
    return (1.0 - cos_deg(this.getLunarPhase(time_JDE))) / 2.0;
  }

  protected getCosPhaseAngle(planet: number, time_JDE: number): number {
    const r = this.getHeliocentricPosition(planet, time_JDE, LOW_PRECISION).radius;
    const D = this.getEclipticPosition(planet, time_JDE, null, ABERRATION | LOW_PRECISION).radius;
    const R = this.getHeliocentricPosition(EARTH, time_JDE, LOW_PRECISION).radius;
    const cpa = (r * r + D * D - R * R) / (2.0 * r * D);

    // Rounding error can cause this number to slightly exceed the valid
    // range [-1, 1], returning an invalid argument for the arc cos function.
    return limitNeg1to1(cpa);
  }

  public getPhaseAngle(planet: number, time_JDE: number): number {
    if (planet <= SUN || planet === EARTH || planet > MOON)
      return 0.0;

    return acos_deg(this.getCosPhaseAngle(planet, time_JDE));
  }

  public getIlluminatedFraction(planet: number, time_JDE: number): number {
    if (planet <= SUN || planet === EARTH || planet > MOON)
      return 0.0;

    return (1.0 + this.getCosPhaseAngle(planet, time_JDE)) / 2.0;
  }

  // Angular separation of apparent ecliptic coordinates.
  // Result in non-negative degrees.
  //
  public getSolarElongation(planet: number, time_JDE: number, observer?: ISkyObserver, flags = DEFAULT_FLAGS): number {
    if (planet === SUN || planet === EARTH)
      return 0.0;

    if (flags === DEFAULT_FLAGS) {
      flags = ABERRATION;

      if (!_.isNil(observer))
        flags |= TOPOCENTRIC;
    }

    const sunPos = this.getEclipticPosition(SUN, time_JDE, observer, flags);
    const planetPos = this.getEclipticPosition(planet, time_JDE, observer, flags);

    return sunPos.distanceFrom(planetPos).degrees;
  }

  // Difference in apparent longitude.
  // Result in degrees, positive when planet is east of Sun, negative when west.
  //
  public getSolarElongationInLongitude(planet: number, time_JDE: number): number {
    const sunPos = this.getEclipticPosition(SUN, time_JDE);
    const planetPos = this.getEclipticPosition(planet, time_JDE);

    return planetPos.longitude.subtract(sunPos.longitude).degrees;
  }

  public getSaturnRingInfo(time_JDE: number): RingInfo {
    const T = (time_JDE - JD_J2000) / 36525.0;
    const i = 28.075216 - 0.012998 * T + 0.000004 * T * T;
    const sin_i = sin_deg(i);
    const cos_i = cos_deg(i);
    const OMEGA = 169.508470 + 1.394681 * T + 0.000412 * T * T;
    const ri = <RingInfo> {};

    const delayedTime = this.getEclipticPosition(SATURN, time_JDE, null, DELAYED_TIME | LOW_PRECISION).radius;
    const hpos = this.getHeliocentricPosition(SATURN, delayedTime, LOW_PRECISION);
    const N = 113.6655 + 0.8771 * T;
    const r = hpos.radius;
    const l = hpos.longitude.degrees;
    const l1 = l - 0.01759 / r;
    const b1 = hpos.latitude.degrees - 0.000764 * cos_deg(l - N) / r;
    const epos = this.getEclipticPosition(SATURN, delayedTime, null, LOW_PRECISION);
    const lambda = epos.longitude.degrees;
    const beta = epos.latitude.degrees;
    const sin_beta = sin_deg(beta);
    const cos_beta = cos_deg(beta);
    const DELTA = epos.radius;

    ri.B = asin_deg(sin_i * cos_beta * sin_deg(lambda - OMEGA)
           - cos_i * sin_beta);
    ri.a = 375.35 / DELTA;
    ri.b = ri.a * sin_deg(abs(ri.B));
    ri.B1 = asin_deg(sin_deg(i) * sin_deg(b1) * sin_deg(l1 - OMEGA) - cos_deg(i) * sin_deg(b1));

    const sin_b1 = sin_deg(b1);
    const cos_b1 = cos_deg(b1);
    const U1 = atan2_deg(sin_i * sin_b1 + cos_i * cos_b1 * sin_deg(l1 - OMEGA),
               cos_b1 * cos_deg(l1 - OMEGA));
    const U2 = atan2_deg(sin_i * sin_beta + cos_i * cos_beta * sin_deg(lambda - OMEGA),
               cos_b1 * cos_deg(lambda - OMEGA));

    ri.dU = abs(U1 - U2);

    const lambda0 = OMEGA - 90.0;
    const beta0 = 90.0 - i;
    // Equatorial position of Saturn (with aberration).
    const eqpos = this.getEquatorialPosition(SATURN, time_JDE, null, ABERRATION | LOW_PRECISION);
    // Equatorial position of northern pole of the ring plain.
    const eqpos0 = this.ecliptic.eclipticToEquatorial(
                      new SphericalPosition(lambda0, beta0, Unit.DEGREES, Unit.DEGREES));
    const a = eqpos.rightAscension.radians;
    const d = eqpos.declination.radians;
    const a0 = eqpos0.rightAscension.radians;
    const d0 = eqpos0.declination.radians;

    ri.P = atan2_deg(cos(d0) * sin(a0 - a),
                     sin(d0) * cos(d) - cos(d0) * sin(d) * cos(a0 - a));

    return ri;
  }

  public getMagnitude(planet: number, time_JDE: number): number {
    const r = this.getHeliocentricPosition(planet, time_JDE, QUICK_SUN | LOW_PRECISION).radius;
    const DELTA = this.getEclipticPosition(planet, time_JDE, null, QUICK_SUN | LOW_PRECISION).radius;

    const i = this.getPhaseAngle(planet, time_JDE);
    const i2 = i * i;
    const i3 = i2 * i;
    const _5log_rD = 5.0 * log10(r * DELTA);

    switch (planet) {
      // Mercury and Venus from "Improving the Visual Magnitudes of the Planets in the Astronomical
      // Almanac. I. Mercury and Venus", by James L. Hilton, The Astronomical Journal, June 2005.
      case MERCURY:
        return -0.60 + _5log_rD + 0.0498 * i - 0.000488 * i2 + 0.00000302 * i3;

      case VENUS:
        if (i < 163.3)
          return -4.47 + _5log_rD + 0.0103 * i + 0.000057 * i2 + 0.00000013 * i3;
        else
          return 0.98 + _5log_rD - 0.0102 * i;

      case MARS:
        return -1.52 + _5log_rD + 0.016 * i;

      case JUPITER:
        return -9.40 + _5log_rD + 0.005 * i;

      case SATURN:
        const ri = this.getSaturnRingInfo(time_JDE);
        const sin_B = sin_deg(ri.B);

        return -8.88 + _5log_rD + 0.044 * ri.dU - 2.60 * sin_deg(abs(ri.B)) + 1.25 * sin_B * sin_B;

      case URANUS:
        return -7.19 + _5log_rD;

      case NEPTUNE:
        return -6.87 + _5log_rD;

      case PLUTO:
        return -1.00 + _5log_rD;

      case MOON:
        return 0.23 + _5log_rD + 0.026 * i + 4.0E-9 * i3 * i;

      case SUN:
        return -26.74 + 5 * log10(DELTA);

      default:
        if (SolarSystem.sharedAdditionals && SolarSystem.isAsteroidOrComet(planet)) {
          const mp = SolarSystem.sharedAdditionals.getMagnitudeParameters(planet);

          if (mp) {
            const f1 = exp(-3.33 * pow(tan_deg(i / 2.0), 0.63));
            const f2 = exp(-1.87 * pow(tan_deg(i / 2.0), 1.22));
            const H = mp[0], G = mp[1];

            return H + _5log_rD - 2.5 * log((1.0 - G) * f1 + G * f2);
          }
        }
    }

    return UNKNOWN_MAGNITUDE;
  }

  // Result in arcseconds.
  public getAngularDiameter(planet: number, time_JDE: number, observer: ISkyObserver = null, polarSize = false): number {
    if (planet < SUN || planet === EARTH || planet > MOON)
      return 0.0;

    let DELTA;

    if (!_.isNil(observer) && planet === MOON)
      DELTA = this.getHorizontalPosition(planet, time_JDE, observer).radius;
    else
      DELTA = this.getEclipticPosition(planet, time_JDE, null, ABERRATION + QUICK_SUN).radius;

    let r = 0.0;

    switch (planet) {
      case SUN:     r = 959.63 / DELTA;                      break;
      case MOON:    r = 358473400 / (DELTA * KM_PER_AU);     break;
      case MERCURY: r =   3.36 / DELTA;                      break;
      case VENUS:   r =   8.34 / DELTA;                      break;
      case MARS:    r =   4.68 / DELTA;                      break;
      case JUPITER: r = (polarSize ? 92.06 : 98.44) / DELTA; break;
      case SATURN:  r = (polarSize ? 73.82 : 82.73) / DELTA; break;
      case URANUS:  r =  35.02 / DELTA;                      break;
      case NEPTUNE: r =  33.50 / DELTA;                      break;
      case PLUTO:   r =   2.07 / DELTA;                      break;
    }

    return r * 2.0;
  }

  // I treat the umbra and penumbra of the Earth as imaginary circular objects
  // directly opposite from the Sun and located at the same distance from the
  // Earth as the Moon.
  //
  // If you can imagine the typical diagram of how umbral and penumbral shadows are
  // cast, I'm simply solving some similar triangles that can be drawn into such a
  // diagram to figure out the size of Moon-distanced cross-sections of the two
  // shadows.
  //
  public getLunarEclipseInfo(time_JDE: number): EclipseInfo {
    const ei = <EclipseInfo> {};

    ei.isSolar = false;
    ei.pos = this.getEclipticPosition(MOON, time_JDE, null, ABERRATION | NUTATION);

    const sunPos = this.getEclipticPosition(SUN, time_JDE, null, ABERRATION | NUTATION);
    const B = sunPos.radius * KM_PER_AU;
    const A = SUN_RADIUS_KM - EARTH_RADIUS_KM; // For umbral shadow.
    const b = ei.pos.radius * KM_PER_AU;
    const a = A * b / B;
    const umbra = EARTH_RADIUS_KM - a;

    ei.radius = atan_deg(MOON_RADIUS_KM / b) * 3600.0;
    ei.umbraRadius = atan_deg(umbra / b) * 3600.0;

    const A1 = SUN_RADIUS_KM + EARTH_RADIUS_KM; // For penumbral shadow.
    const a1 = A1 * b / B;
    const penumbra = EARTH_RADIUS_KM + a1;

    ei.penumbraRadius      = atan_deg(penumbra / b) * 3600.0;
    ei.shadowPos           = new SphericalPosition(sunPos.longitude.opposite_nonneg(),
                                                   sunPos.latitude.negate());
    ei.centerSeparation    = ei.pos.distanceFrom(ei.shadowPos).getAngle(Unit.ARC_SECONDS);
    ei.penumbralSeparation = ei.centerSeparation - ei.radius - ei.penumbraRadius;
    ei.inPenumbra          = (ei.penumbralSeparation <= 0.0);
    ei.umbralSeparation    = ei.centerSeparation - ei.radius - ei.umbraRadius;
    ei.inUmbra             = (ei.umbralSeparation <= 0.0);
    // 0.9844 fudge-factor to loosely account for perspective effects of the curvature of the moon.
    ei.total               = ((ei.centerSeparation + ei.radius) * 0.9844 <= ei.umbraRadius);

    ei.annular             = false;
    ei.hybrid              = false;

    return ei;
  }

  // Similar to above method, but based on looking at the shadow of the Moon on
  // the Earth from a selenocentric perspective.
  //
  // Detection of hybrid eclipses may require surveying a number of moments during
  // the duration of a solar eclipse, not just the peak of the eclipse.
  //
  public getSolarEclipseInfo(time_JDE: number, locateShadow = false): EclipseInfo {
    const ei = <EclipseInfo> {};
    const moonPos = this.getEclipticPosition(MOON, time_JDE, null, ABERRATION);

    ei.isSolar = true;
    ei.pos = new SphericalPosition3D().translate(moonPos); // Earth, in selenocentric coordinates

    const sunPos = this.getEclipticPosition(SUN, time_JDE, null, ABERRATION).translate(moonPos);
    const B = sunPos.radius * KM_PER_AU;
    const A = SUN_RADIUS_KM - MOON_RADIUS_KM; // For umbral shadow.
    let b = ei.pos.radius * KM_PER_AU;
    let a = A * b / B;
    let umbra = MOON_RADIUS_KM - a;

    if (umbra < 0.0) {
      ei.annular = true;
      umbra *= -1;
    }
    else
      ei.annular = false;

    ei.radius = atan_deg(EARTH_RADIUS_KM / b) * 3600.0;
    ei.umbraRadius = atan_deg(umbra / b) * 3600.0;

    const A1 = SUN_RADIUS_KM + MOON_RADIUS_KM; // For penumbral shadow.
    const a1 = A1 * b / B;
    const penumbra = MOON_RADIUS_KM + a1;

    ei.penumbraRadius      = atan_deg(penumbra / b) * 3600.0;
    ei.shadowPos           = new SphericalPosition(sunPos.longitude.opposite_nonneg(),
                                                   sunPos.latitude.negate());
    ei.centerSeparation    = ei.pos.distanceFrom(ei.shadowPos).getAngle(Unit.ARC_SECONDS);
    ei.penumbralSeparation = ei.centerSeparation - ei.radius - ei.penumbraRadius;
    ei.inPenumbra          = (ei.penumbralSeparation <= 0.0);
    ei.umbralSeparation    = ei.centerSeparation - ei.radius - ei.umbraRadius;
    ei.inUmbra             = (ei.umbralSeparation <= 0.0);
    ei.total               = ei.inUmbra && !ei.annular;
    ei.annular             = ei.annular && ei.inUmbra;
    ei.hybrid              = false;

    const umbraFromCenter = max(ei.centerSeparation - ei.umbraRadius, 0.0);

    // Taking into account how the curvature of the Earth brings an observer closer
    // to the Moon, there's a possibility of moving out of the anti-umbra into the
    // umbra, resulting in a hybrid eclipse.
    if (ei.annular) {
      if (umbraFromCenter < ei.radius) {
        const earthCurveAdj = EARTH_RADIUS_KM * sin(acos(limitNeg1to1(umbraFromCenter / ei.radius)));

        b -= earthCurveAdj;
        a = A * b / B;
        umbra = MOON_RADIUS_KM - a;

        if (umbra >= 0.0) {
          ei.annular = false;
          ei.hybrid = true;
          ei.total = false;
        }
      }
    }

    if (locateShadow) {
      // Compute where a line going through the center of the Sun and the Moon
      // intersects the sphere of the Earth.
      const time_JDU = TDB_to_UT(time_JDE);
      const siderealTime = SolarSystem.getGreenwichMeanSiderealTime(time_JDU);
      const flattening = EARTH_RADIUS_KM / EARTH_RADIUS_POLAR_KM;
      const sunPt = this.getEquatorialPosition(SUN, time_JDE, null, ABERRATION).xyz;
      const xs = sunPt.x, ys = sunPt.y, zs = sunPt.z * flattening;
      const moonPt = this.getEquatorialPosition(MOON, time_JDE, null, ABERRATION).xyz;
      const xm = moonPt.x, ym = moonPt.y, zm = moonPt.z * flattening;
      const r = EARTH_RADIUS_KM / KM_PER_AU;
      const dx = xs - xm;
      const dy = ys - ym;
      const dz = zs - zm;
      let c: number, radicand: number, u: number, xh: number, yh: number, zh: number;

      a = dx * dx + dy * dy + dz * dz;
      b = 2.0 * (xm * dx + ym * dy + zm * dz);
      c = xm * xm + ym * ym + zm * zm - r * r;

      radicand = max(b * b - 4.0 * a * c, 0.0);
      u = (-b + sqrt(radicand)) / 2.0 / a;
      xh = xm + u * dx;
      yh = ym + u * dy;
      zh = (zm + u * dz) / flattening;

      const shadowCtr = SphericalPosition3D.convertRectangular(xh, yh, zh);

      ei.surfaceShadow = SolarSystem.createSkyObserver(shadowCtr.longitude.degrees - siderealTime, shadowCtr.latitude.degrees);
    }

    return ei;
  }

  public getLocalSolarEclipseTotality(time_JDE: number, observer: ISkyObserver): number {
    const separation = this.getSolarElongation(MOON, time_JDE, observer);

    if (separation > 1.0)
       return 0.0;

    const moonRadius = this.getAngularDiameter(MOON, time_JDE, observer) / 7200.0;
    const sunRadius  = this.getAngularDiameter(SUN,  time_JDE)           / 7200.0;
    const overlap    = sunRadius + moonRadius - separation;

    return min(max(overlap / sunRadius / 2.0, 0.0), 1.0);
  }

  public getTimeForDegreesOfChange(bodyID: number, startTime_JDE: number, degrees: number, maxTime_JDE: number): number {
    const startPos = this.getHeliocentricPosition(bodyID, startTime_JDE);
    let   testPos: SphericalPosition3D;
    const tolerance = degrees / 100000.0;
    const sign = (maxTime_JDE < startTime_JDE ? -1.0 : 1.0);
    let   minTime = startTime_JDE;
    let   delta = sign;
    let   result = startTime_JDE + delta;
    let   change;
    let   found = false;

    for (let i = 0; i < 200; ++i) { // Impose a maximum number of iterations before giving up.
      testPos = this.getHeliocentricPosition(bodyID, result);
      change = startPos.distanceFrom(testPos).degrees;

      if (abs(change - degrees) < tolerance || result === maxTime_JDE) {
        found = true;

        break;
      }
      else if (change < degrees) {
        minTime = result;
        delta *= 2;

        if (sign < 0)
          result = Math.max(result + delta, maxTime_JDE);
        else
          result = Math.min(result + delta, maxTime_JDE);
      }
      else {
        result = (result + minTime) / 2.0;
        delta /= 2;
      }
    }

    return (found ? result : Number.MAX_VALUE);
  }
}
