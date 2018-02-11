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

import { JD_J2000 } from './astro-constants';
import { floor, squared } from 'ks-math';

const historicDeltaT = [
// Values to smooth transition from polynomial used for earlier years.
  // 1600-1619
  120.3 , 120.3 , 120.5 , 120.6 , 120.7 , 120.9 , 121.0 , 121.1 , 121.3 , 121.5 ,
  121.6 , 121.9 , 122.0 , 122.2 , 122.5 , 122.7 , 122.9 , 123.2 , 123.4 , 123.7 ,
// From http://www.phys.uu.nl/~vgent/deltat/deltat.htm (1659 value modified for
// smoother transition to next data source.)
  // 1620-1659
  124   , 119   , 115   , 110   , 106   , 102   ,  98   ,  95   ,  91   ,  88   ,
   85   ,  82   ,  79   ,  77   ,  74   ,  72   ,  70   ,  67   ,  65   ,  63   ,
   62   ,  60   ,  58   ,  57   ,  55   ,  54   ,  53   ,  51   ,  50   ,  49   ,
   48   ,  47   ,  46   ,  45   ,  44   ,  43   ,  42   ,  41   ,  40   ,  39   ,
// From http://maia.usno.navy.mil/ser7/historic_deltat.data
  // 1660-1699
   38   ,  37   ,  36   ,  37   ,  38   ,  36   ,  35   ,  34   ,  33   ,  32   ,
   31   ,  30   ,  29   ,  29   ,  28   ,  27   ,  26   ,  25   ,  25   ,  26   ,
   26   ,  25   ,  24   ,  24   ,  24   ,  24   ,  24   ,  23   ,  23   ,  22   ,
   22   ,  22   ,  21   ,  21   ,  21   ,  21   ,  20   ,  20   ,  20   ,  20   ,
  // 1700-1749
   21   ,  21   ,  20   ,  20   ,  19   ,  19   ,  19   ,  20   ,  20   ,  20   ,
   20   ,  20   ,  21   ,  21   ,  21   ,  21   ,  21   ,  21   ,  21   ,  21   ,
   21.1 ,  21.0 ,  20.9 ,  20.7 ,  20.4 ,  20.0 ,  19.4 ,  18.7 ,  17.8 ,  17.0 ,
   16.6 ,  16.1 ,  15.7 ,  15.3 ,  14.7 ,  14.3 ,  14.1 ,  14.1 ,  13.7 ,  13.5 ,
   13.5 ,  13.4 ,  13.4 ,  13.3 ,  13.2 ,  13.2 ,  13.1 ,  13.0 ,  13.3 ,  13.5 ,
  // 1750-1799
   13.7 ,  13.9 ,  14.0 ,  14.1 ,  14.1 ,  14.3 ,  14.4 ,  14.6 ,  14.7 ,  14.7 ,
   14.8 ,  14.9 ,  15.0 ,  15.2 ,  15.4 ,  15.6 ,  15.6 ,  15.9 ,  15.9 ,  15.7 ,
   15.7 ,  15.7 ,  15.9 ,  16.1 ,  15.9 ,  15.7 ,  15.3 ,  15.5 ,  15.6 ,  15.6 ,
   15.6 ,  15.5 ,  15.4 ,  15.2 ,  14.9 ,  14.6 ,  14.3 ,  14.1 ,  14.2 ,  13.7 ,
   13.3 ,  13.0 ,  13.2 ,  13.1 ,  13.3 ,  13.5 ,  13.2 ,  13.1 ,  13.0 ,  12.6 ,
  // 1800-1849
   12.6 ,  12.0 ,  11.8 ,  11.4 ,  11.1 ,  11.1 ,  11.1 ,  11.1 ,  11.2 ,  11.5 ,
   11.2 ,  11.7 ,  11.9 ,  11.8 ,  11.8 ,  11.8 ,  11.6 ,  11.5 ,  11.4 ,  11.3 ,
   11.13,  10.94,  10.29,   9.94,   9.88,   9.72,   9.66,   9.51,   9.21,   8.60,
    7.95,   7.59,   7.36,   7.10,   6.89,   6.73,   6.39,   6.25,   6.25,   6.22,
    6.22,   6.30,   6.35,   6.32,   6.33,   6.37,   6.40,   6.46,   6.48,   6.53,
  // 1850-1899
    6.55,   6.69,   6.84,   7.03,   7.15,   7.26,   7.23,   7.21,   6.99,   7.19,
    7.35,   7.41,   7.36,   6.95,   6.45,   5.92,   5.15,   4.11,   2.94,   1.97,
    1.04,   0.11,  -0.82,  -1.70,  -2.48,  -3.19,  -3.84,  -4.43,  -4.79,  -5.09,
   -5.36,  -5.37,  -5.34,  -5.40,  -5.58,  -5.74,  -5.69,  -5.67,  -5.73,  -5.78,
   -5.86,  -6.01,  -6.28,  -6.53,  -6.50,  -6.41,  -6.11,  -5.63,  -4.68,  -3.72,
  // 1900-1949
   -2.70,  -1.48,  -0.08,   1.26,   2.59,   3.92,   5.20,   6.29,   7.68,   9.13,
   10.38,  11.64,  13.23,  14.69,  16.00,  17.19,  18.19,  19.13,  20.14,  20.86,
   21.41,  22.06,  22.51,  23.01,  23.46,  23.63,  23.95,  24.39,  24.34,  24.10,
   24.02,  23.98,  23.89,  23.93,  23.88,  23.91,  23.76,  23.91,  23.96,  24.04,
   24.35,  24.82,  25.30,  25.77,  26.27,  26.76,  27.27,  27.77,  28.25,  28.70,
  // 1950-1973
   29.15,  29.57,  29.97,  30.36,  30.72,  31.07,  31.35,  31.68,  32.17,  32.67,
   33.15,  33.58,  33.99,  34.47,  35.03,  35.74,  36.55,  37.43,  38.29,  39.20,
   40.18,  41.17,  42.23,  43.37,

// From http://maia.usno.navy.mil/ser7/deltat.data
  // 1974-1999
                                   44.48,  45.48,  46.46,  47.52,  48.53,  49.59,
   50.54,  51.38,  52.17,  52.96,  53.79,  54.34,  54.87,  55.32,  55.82,  56.30,
   56.86,  57.57,  58.31,  59.12,  59.98,  60.79,  61.63,  62.30,  62.97,  63.47,
  // 2000-2018
   63.83,  64.09,  64.30,  64.47,  64.57,  64.69,  64.85,  65.15,  65.46,  65.78,
   66.07,  66.32,  66.60,  66.91,  67.28,  67.64,  68.10,  68.59,  68.97
];

let calibration = 0;
let lastTableYear = -1;

export function getDeltaTAtJulianDate(time_JDE: number): number {
  const year = (time_JDE - JD_J2000) / 365.25 + 2000.0;

  // Do a three-point interpolation from either the table or the computed values.
  const tableMidYear = floor(year);
  const dt1 = deltaTAtStartOfYear(tableMidYear - 1);
  const dt2 = deltaTAtStartOfYear(tableMidYear);
  const dt3 = deltaTAtStartOfYear(tableMidYear + 1);
  const a = dt2 - dt1;
  const b = dt3 - dt2;
  const c = b - a;
  const n = year - tableMidYear;

  return dt2 + n * (a + b + n * c) / 2.0;
}

export function UT_to_TDB(time_JDU: number): number {
  let time_JDE = time_JDU;

  for (let i = 0; i < 5; ++i)
    time_JDE = time_JDU + getDeltaTAtJulianDate(time_JDE) / 86400.0;

  return time_JDE;
}

export function TDB_to_UT(time_JDE: number): number {
  return time_JDE - getDeltaTAtJulianDate(time_JDE) / 86400.0;
}

/* tslint:disable:whitespace */

function deltaTAtStartOfYear(year: number): number {
  // Make the post-table approximations line up with the last tabular delta T.
  if (lastTableYear < 0) {
    lastTableYear = historicDeltaT.length + 1598; // Temporarily 1 less than it should be
    calibration = historicDeltaT[historicDeltaT.length - 1] - deltaTAtStartOfYear(lastTableYear + 1);
    ++lastTableYear;
  }

  // Polynomial expressions from http://sunearth.gsfc.nasa.gov/eclipse/SEhelp/deltatpoly2004.html

  let t, u;

  if (year < -500) {
    u = (year - 1820.0) / 100.0;

    return - 20.0 + 32.0 * u*u;
  }
  else if (year < 500) {
    u = year / 100.0;

    return 10583.6 - 1014.41 * u + 33.78311 * u*u - 5.952053 * u*u*u
           - 0.1798452 * u*u*u*u + 0.022174192 * u*u*u*u*u + 0.0090316521 * u*u*u*u*u*u;
  }
  else if (year < 1600) {
    u = (year - 1000.0) / 100.0;

    return 1574.2 - 556.01 * u + 71.23472 * u*u + 0.319781 * u*u*u
           - 0.8503463 * u*u*u*u - 0.005050998 * u*u*u*u*u + 0.0083572073 * u*u*u*u*u*u;
  }
  else if (year <= lastTableYear)
    return historicDeltaT[year - 1600];
  else if (year < 2050) {
    t = year - 2000.0;

    // Had started with 69.62 + ..., modified so that this would agree with real observed delta-T at 2010.
    return calibration + 0.32217 * t + 0.005589 * t*t;
  }
  else if (year < 2150)
    // Had started with constant 20.0 + ..., modified so that this would agree with previous approximation at 2050
    return calibration - 81.76 + 32.0 * squared((year - 1820.0)/ 100.0) - 0.5628 * (2150.0 - year);

  u = (year - 1820.0) / 100.0;

  // Had started with constant 20.0 + ..., modified so that this would agree with previous approximation at 2150
  return calibration - 81.76 + 32.0 * u*u;
}
