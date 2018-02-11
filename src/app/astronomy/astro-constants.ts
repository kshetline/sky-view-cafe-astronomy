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

import { Angle, Unit, SphericalPosition } from 'ks-math';

export const JD_J2000 = 2451545.0;    // Julian date for the J2000.0 epoch.
export const JD_B1950 = 2433282.4235; // Julian date for the B1950 epoch.

export const FIRST_PLANET =  0;
export const SUN          =  0;
export const MERCURY      =  1;
export const VENUS        =  2;
export const EARTH        =  3;
export const MARS         =  4;
export const JUPITER      =  5;
export const SATURN       =  6;
export const URANUS       =  7;
export const NEPTUNE      =  8;
export const PLUTO        =  9;
export const MOON         = 10;
export const LAST_PLANET  = 10;

export const NO_MATCH         = Number.MIN_SAFE_INTEGER;
export const NO_SELECTION     = NO_MATCH;
export const CANCEL_SELECTION = Number.MAX_SAFE_INTEGER;

// Flags for methods and adjustments to be applied to coordinate calculations.
//
export const LOW_PRECISION     = 0x00000001; // For faster calculation when several arcseconds of error are acceptable.
export const HIGH_PRECISION    = 0x00000002; // For highest available precision -- can be slow for such things as ELP 2000-82B.
export const NUTATION          = 0x00000004; // Include effects of nutation.
export const TOPOCENTRIC       = 0x00000008; // As opposed to geocentric
export const REFRACTION        = 0x00000010; // Only applies to horizontal coordinates
export const QUICK_SUN         = 0x00000020; // Use simple formula instead of VSOP
export const QUICK_PLANET      = 0x00000040; // Use orbital elements instead of VSOP
export const ABERRATION        = 0x00000080; // Full planetary aberration
export const ASTROMETRIC       = 0x00000100; // Effect of light delay without aberration
export const TRUE_DISTANCE     = 0x00000200; // Include true distance in otherwise light-delayed result
export const DELAYED_TIME      = 0x00000400; // Return (T - tau) instead of distance
export const SIGNED_HOUR_ANGLE = 0x00000800; // Hour angle result +/- 12h, instead of 0-24h.
export const NO_PRECESSION     = 0x00001000; // StarCatalog only: for results referred to J2000.0 equinox rather than equinox of date.
export const DEFAULT_FLAGS     = 0x40000000; // Determine flags from context.

export const MIN_YEAR = -6000;
export const MAX_YEAR =  9999;

export const NON_EVENT               =  -1;

export const IN_BETWEEN_PHASES       =  -1;
export const PHASE_EVENT_BASE        =   0;
export const NEW_MOON                =   0;
export const FIRST_QUARTER           =   1;
export const FULL_MOON               =   2;
export const LAST_QUARTER            =   3;
export const THIRD_QUARTER           =   3;

export const NOT_EQUINOX_OR_SOLSTICE =  -2;
export const EQ_SOLSTICE_EVENT_BASE  = 100;
export const SPRING_EQUINOX          = 100;
export const SUMMER_SOLSTICE         = 101;
export const FALL_EQUINOX            = 102;
export const WINTER_SOLSTICE         = 103;

export const RISE_SET_EVENT_BASE     = 200;
export const RISE_EVENT              = 200;
export const SET_EVENT               = 201;
export const VISIBLE_ALL_DAY         = 202;
export const UNSEEN_ALL_DAY          = 203;
export const TRANSIT_EVENT           = 204;
export const TWILIGHT_BEGINS         = 205;
export const TWILIGHT_ENDS           = 206;
export const SET_EVENT_MINUS_1_MIN   = 207;

export const PLANET_EVENT_BASE       = 300;
export const OPPOSITION              = 300;
export const SUPERIOR_CONJUNCTION    = 301;
export const INFERIOR_CONJUNCTION    = 302;
export const GREATEST_ELONGATION     = 303;
export const PERIHELION              = 304;
export const APHELION                = 305;
export const QUADRATURE              = 306;

export const ECLIPSE_EVENT_BASE      = 400;
export const LUNAR_ECLIPSE           = 400;
export const SOLAR_ECLIPSE           = 401;

export const MOONS_EVENT_BASE        = 500;
export const GALILEAN_MOON_EVENT     = 500;

export const GRS_TRANSIT_EVENT_BASE  = 600;
export const GRS_TRANSIT_EVENT       = 600;

export const NO_TWILIGHT           =   0.0;
export const CIVIL_TWILIGHT        =  -6.0;
export const NAUTICAL_TWILIGHT     = -12.0;
export const ASTRONOMICAL_TWILIGHT = -18.0;
export const MAX_ALT_FOR_TWILIGHT  = CIVIL_TWILIGHT;

export const EARTH_RADIUS_KM       =   6378.14; // equatorial radius
export const EARTH_RADIUS_POLAR_KM =   6356.755;
export const SUN_RADIUS_KM         = 696000.0;
export const MOON_RADIUS_KM        =   1737.4;
export const KM_PER_AU             = 1.49597870691E8;
export const LIGHT_DAYS_PER_AU     = 0.005775518328;
export const MEAN_JUPITER_SYS_II   = 0.4137042242;
export const MEAN_SYNODIC_MONTH    = 29.530589;
export const REFRACTION_AT_HORIZON = 0.5833; // in degrees
export const AVG_SUN_MOON_RADIUS   = 0.25; // in degrees
export const UNKNOWN_MAGNITUDE     = 10000.0;
export const OBLIQUITY_J2000       = 23.43929111; // in degrees
export const K_DEG                 = 0.98560766860142; // Gaussian gravitation in degrees.
export const K_RAD                 = K_DEG * Math.PI / 180.0; // Gaussian gravitation in radians.

export const GALACTIC_NORTH_B1950 = new SphericalPosition(192.25, 27.4, Unit.DEGREES, Unit.DEGREES);
export const GALACTIC_ASCENDING_NODE_B1950 = new Angle(33.0, Unit.DEGREES);

export const DAY          = 1.0;
export const HALF_DAY     = 0.5;
export const HOUR         = 1.0 / 24.0;
export const HALF_HOUR    = 1.0 / 48.0;
export const QUARTER_HOUR = 1.0 / 96.0;
export const MINUTE       = 1.0 / 1440.0;
export const HALF_MINUTE  = 1.0 / 2880.0;
export const SECOND       = 1.0 / 86400.0;
export const HALF_SECOND  = 1.0 / 172800.0;

export const JUPITER_FLATTENING = 1.069303;

export const FIRST_JUPITER_MOON = 5001;
export const IO                 = 5001;
export const EUROPA             = 5002;
export const GANYMEDE           = 5003;
export const CALLISTO           = 5004;
export const LAST_JUPITER_MOON  = 5004;

export const SATURN_FLATTENING = 1.120699;

export const FIRST_SATURN_MOON = 6001;
export const MIMAS             = 6001;
export const ENCELADUS         = 6002;
export const TETHYS            = 6003;
export const DIONE             = 6004;
export const RHEA              = 6005;
export const TITAN             = 6006;
export const HYPERION          = 6007;
export const IAPETUS           = 6008;
export const LAST_SATURN_MOON  = 6008;

export const ASTEROID_BASE    = 20000; // First asteroid will be ASTEROID_BASE + 1
export const ASTEROID_MAX     = 29999;
export const COMET_BASE       = 30000; // First comet will be COMET_BASE + 1
export const COMET_MAX        = 39999;
export const SOLAR_SYSTEM_MAX = COMET_MAX;

export const CONSTELLATION_BASE = 100000;
export const CONSTELLATION_MAX  = 100999;

