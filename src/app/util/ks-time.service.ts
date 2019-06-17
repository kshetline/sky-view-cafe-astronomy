/*
  Copyright © 2017-2019 Kerry Shetline, kerry@shetline.com

  IMPORTANT NOTE: The license below DOES NOT COVER use of the
  skyviewcafe.com web site for fulfilling API requests. Users of
  this code must supply their own server-side support.

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

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { timeout } from 'rxjs/operators';

export interface RegionAndSubzones {
  region: string;
  subzones: string[];
}

export interface ZoneForLocation {
  status: string;
  dstOffset?: number;
  rawOffset?: number;
  timeZoneId?: string;
  timeZoneName?: string;
  errorMessage?: string;
}

@Injectable()
export class KsTimeService {
  private hostname: string;
  private port: number;

  constructor(private httpClient: HttpClient) {
    this.hostname = document.location.hostname;
    this.port = parseInt(document.location.port, 10);
  }

  getZoneForLocation(longitude: number, latitude: number, timestamp?: number | null, timeoutValue?: number): Promise<ZoneForLocation> {
    if (timestamp === null || timestamp === undefined)
      timestamp = Math.floor(Date.now() / 1000);

    const params = 'lon=' + longitude + '&lat=' + latitude + '&timestamp=' + timestamp;

    if (!timeoutValue)
      timeoutValue = 60000;

    if (this.hostname === 'localhost' || this.port === 3000) {
      return this.httpClient.jsonp<ZoneForLocation>
        ('https://test.skyviewcafe.com/zoneloc/?' + params, 'callback').pipe(timeout(timeoutValue)).toPromise();
    }
    else if (this.hostname === '127.0.0.1') {
      return this.httpClient.jsonp<ZoneForLocation>
        ('http://localhost:8088/zoneloc/?' + params, 'callback').pipe(timeout(timeoutValue)).toPromise();
    }
    else {
      return this.httpClient.get<ZoneForLocation>('/zoneloc/?' + params).pipe(timeout(timeoutValue)).toPromise();
    }
  }
}
