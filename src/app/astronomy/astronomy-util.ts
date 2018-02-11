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

// Note: I've modified the standard refraction formulas so that if they are
// fed values well below the horizon they won't return weird values, but will
// instead make a smooth transition between -2 and -4 degrees to an identity
// function for angles from -4 to -90 degrees.

// Degrees in, degrees out.
//

import { Angle, floor, interpolate, limitNeg1to1, max, min, pow, round, SphericalPosition, sqrt, tan_deg, Unit } from 'ks-math';
import { ISkyObserver } from './i-sky-observer';
import { GALACTIC_ASCENDING_NODE_B1950, GALACTIC_NORTH_B1950, JD_B1950, JD_J2000, LOW_PRECISION, MOON, QUICK_SUN, SUN } from './astro-constants';
import { SolarSystem } from './solar-system';
import { blendColors } from 'ks-util';
import { Ecliptic } from './ecliptic';

export const COLOR_NIGHT                 = 'black';
export const COLOR_ASTRONOMICAL_TWILIGHT = '#000044';
export const COLOR_NAUTICAL_TWILIGHT     = '#000066';
export const COLOR_CIVIL_TWILIGHT        = '#990066';
export const COLOR_NEAR_SUNRISE          = '#CC6600';
export const COLOR_EARLY_SUNRISE         = '#DDBB33';
export const COLOR_LATE_SUNRISE          = '#DDDDAA';
export const COLOR_DAY                   = '#99CCFF';

export const COLORS_MOONLIGHT: string[] = ['black', '#333333', '#666666', '#999999'];

const COLORS_DEEP_TWILIGHT: string[] = [COLOR_ASTRONOMICAL_TWILIGHT, COLOR_NAUTICAL_TWILIGHT];
const TWILIGHT_MOON_BLENDS: string[][] = [];

(function(): void {
  for (let i = 0; i < 2; ++i) {
    TWILIGHT_MOON_BLENDS[i] = [];

    for (let j = 0; j < 3; ++j)
      TWILIGHT_MOON_BLENDS[i][j] = blendColors(COLORS_DEEP_TWILIGHT[i], COLORS_MOONLIGHT[j + 1]);
  }
})();

const h_adj  = refractedAltitudeAux(90.0);
const h0_adj = unrefractedAltitudeAux(90.0);

export function refractedAltitude(trueAltitude: number): number {
  if (trueAltitude < -4.0)
    return trueAltitude;

  const h2 = trueAltitude + refractedAltitudeAux(trueAltitude) - h_adj;

  if (trueAltitude < -2.0)
    return interpolate(-4.0, trueAltitude, -2.0, trueAltitude, h2);
  else
    return h2;
}

function refractedAltitudeAux(h: number): number {
  // Tweaked a little for agreement with standard of 0.5833 degrees at horizon
  // (Original form was 1.02 / tan_deg(h...
  return 1.033879 / tan_deg(h + 10.3 / (h + 5.11)) / 60.0;
}

// Degrees in, degrees out.
//
export function unrefractedAltitude(apparentAltitude: number): number {
  if (apparentAltitude < -4.0)
    return apparentAltitude;

  const h2 = apparentAltitude - unrefractedAltitudeAux(apparentAltitude) + h0_adj;

  if (apparentAltitude < -2.0)
    return interpolate(-4.0, apparentAltitude, -2.0, apparentAltitude, h2);
  else
    return h2;
}

function unrefractedAltitudeAux(h0: number): number {
  // Tweaked a little for agreement with standard of 0.5833 degrees at horizon
  // (Original form was 1.0 / tan_deg(h0...
  return 1.015056 / tan_deg(h0 + 7.31 / (h0 + 4.4)) / 60.0;
}

export function getSkyColor(sunPos: SphericalPosition, skyPos: SphericalPosition, eclipseTotality = 0): string {
  const sunAltitude = sunPos.altitude.degrees;

  if (sunAltitude <= - 18.0)
    return 'black';

  let   elongation  = skyPos.distanceFrom(sunPos).degrees;
  const skyAltitude = skyPos.altitude.degrees;

  const shade     = min((18.0 + sunAltitude) / 18.0, 1.0);
  const sunRed    = min(1.2 * shade, 1.0);
  const sunGreen  = pow(shade, 1.6);
  const sunBlue   = 0.8 * pow(0.8 * shade, 2.2);
  const baseRed   = 0.4 * shade;
  const baseGreen = 0.6 * shade;
  const baseBlue  = shade;

  if (sunAltitude < 0.0)
    elongation = max(elongation + sunAltitude, 0.20);

  const sunBias  = min(max((45.0 - elongation) / 45.0, 0.0), 1.0);
  const baseBias = 1.0 - sunBias / 2.5;
  const altBias  = 1.0 - (sqrt(max(skyAltitude, 0.0))) / 30.0;
  let   eclBias  = 1.0 - 0.8 * eclipseTotality;

  if (eclipseTotality > 0.995)
    eclBias = 0.0;

  const r = (sunRed   * sunBias + baseRed * baseBias) * altBias * eclBias;
  const g = (sunGreen * sunBias + baseGreen * baseBias) * altBias * eclBias;
  const b = (sunBlue  * sunBias + baseBlue  * baseBias) * altBias * (0.2 + eclBias * 0.8);
  const scale = 255 / max(r, g, b, 1.0);

  return 'rgb(' + round(r * scale) + ',' + round(g * scale) + ',' + round(b * scale) + ')';
}

export function getInsolationColor(observer: ISkyObserver, solarSystem: SolarSystem, time_JDU: number, moonlight = false, blendMoonlight = true): string {
  let color: string;
  let twilightIndex = -1;
  let moonIndex: number;
  let altitudeOfSun: number;
  let altitudeOfMoon: number;
  let illuminationOfMoon: number;

  altitudeOfSun = solarSystem.getHorizontalPosition(SUN, time_JDU, observer, QUICK_SUN).altitude.degrees;

  if (altitudeOfSun < -18.0)
    color = COLOR_NIGHT;
  else if (altitudeOfSun < -12.0) {
    color = COLOR_ASTRONOMICAL_TWILIGHT;
    twilightIndex = 0;
  }
  else if (altitudeOfSun < -6.0) {
    color = COLOR_NAUTICAL_TWILIGHT;
    twilightIndex = 1;
  }
  else if (altitudeOfSun < -3.0)
    color = COLOR_CIVIL_TWILIGHT;
  else if (altitudeOfSun < -0.833)
    color = COLOR_NEAR_SUNRISE;
  else if (altitudeOfSun < 4.0)
    color = COLOR_EARLY_SUNRISE;
  else if (altitudeOfSun < 8.0)
    color = COLOR_LATE_SUNRISE;
  else
    color = COLOR_DAY;

  if (moonlight && altitudeOfSun < -6.0) {
    altitudeOfMoon = solarSystem.getHorizontalPosition(MOON, time_JDU, observer, LOW_PRECISION).altitude.degrees;

    if (altitudeOfMoon >= 0.0) {
      // Technically this should be Dynamical Time, not Universal Time,
      // but the difference is trivial here.
      illuminationOfMoon = solarSystem.getLunarIlluminatedFraction(time_JDU);
      moonIndex = floor((illuminationOfMoon + 0.16) * 3.0);

      if (moonIndex > 0) {
        if (twilightIndex >= 0 && blendMoonlight)
          color = TWILIGHT_MOON_BLENDS[twilightIndex][moonIndex - 1];
        else
          color = COLORS_MOONLIGHT[moonIndex];
      }
    }
  }

  return color;
}

const A_G = GALACTIC_NORTH_B1950.rightAscension;
const D_G = GALACTIC_NORTH_B1950.declination;
const AN1 = GALACTIC_ASCENDING_NODE_B1950.add(new Angle(270.0, Unit.DEGREES));
const AN2 = GALACTIC_ASCENDING_NODE_B1950.add(new Angle(90.0, Unit.DEGREES));
const AG2 = A_G.subtract(new Angle(180.0, Unit.DEGREES));

export function equatorialToGalactic(pos: SphericalPosition, time_JDE = JD_J2000): SphericalPosition {
  pos = Ecliptic.precessEquatorial(pos, time_JDE, JD_B1950);

  const ga_a = A_G.subtract(pos.rightAscension);
  const d = pos.declination;

  return new SphericalPosition(AN1.subtract(
                Angle.atan2_nonneg(ga_a.sin, ga_a.cos * D_G.sin - d.tan * D_G.cos)),
                Angle.asin(limitNeg1to1(d.sin * D_G.sin + d.cos * D_G.cos * ga_a.cos)));
}

export function galacticToEquatorial(pos: SphericalPosition, time_JDE = JD_J2000): SphericalPosition {

  const l_an2 = pos.rightAscension.subtract(AN2);
  const b = pos.declination;

  pos = new SphericalPosition(AG2.add(
                Angle.atan2_nonneg(l_an2.sin, l_an2.cos * D_G.sin - b.tan * D_G.cos)),
                Angle.asin(limitNeg1to1(b.sin * D_G.sin + b.cos * D_G.cos * l_an2.cos)));

  return Ecliptic.precessEquatorial(pos, JD_B1950, time_JDE);
}
