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

import { abs, div_rd, round, sign } from 'ks-math';
import { padLeft } from 'ks-util';

export function formatLatitude(lat: number): string {
  const theSign = sign(lat);
  let minutes = round(abs(lat) * 60);
  const degrees = div_rd(minutes, 60);
  minutes -= degrees * 60;

  return padLeft(degrees, 2, '0') + '°' + padLeft(minutes, 2, '0') + '\'' + (theSign < 0 ? 'S' : 'N');
}

export function formatLongitude(lon: number): string {
  const theSign = sign(lon);
  let minutes = round(abs(lon) * 60);
  const degrees = div_rd(minutes, 60);
  minutes -= degrees * 60;

  return padLeft(degrees, 3, '0') + '°' + padLeft(minutes, 2, '0') + '\'' + (theSign < 0 ? 'W' : 'E');
}
