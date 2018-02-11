/*
  Copyright © 2017 Kerry Shetline, kerry@shetline.com

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

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ZoneInfo } from 'ks-date-time-zone';

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

  constructor(private httpClient: HttpClient) {
    this.hostname = document.location.hostname;
  }

  public getRegionsAndSubzones(): Promise<RegionAndSubzones[]> {
    // Yes, localhost and 127.0.0.1 are really the same thing, but for testing purposes they look
    // different enough for using as a trick for testing with different JSONP servers.
    if (this.hostname === 'localhost') {
      return this.httpClient.jsonp<RegionAndSubzones[]>('http://test.skyviewcafe.com/timeservices/zones', 'callback').toPromise();
    }
    else if (this.hostname === '127.0.0.1') {
      return this.httpClient.jsonp<RegionAndSubzones[]>('http://localhost:8088/time/zones', 'callback').toPromise();
    }
    else {
      return this.httpClient.get<RegionAndSubzones[]>('/timeservices/zones').toPromise();
    }
  }

  public getZoneInfo(zoneName: string): Promise<ZoneInfo> {
    const q = encodeURI(zoneName);

    if (this.hostname === 'localhost') {
      return this.httpClient.jsonp<ZoneInfo>('http://test.skyviewcafe.com/timeservices/zone?q=' + q, 'callback').toPromise();
    }
    else if (this.hostname === '127.0.0.1') {
      return this.httpClient.jsonp<ZoneInfo>('http://localhost:8088/time/zone?q=' + q, 'callback').toPromise();
    }
    else {
      return this.httpClient.get<ZoneInfo>('/timeservices/zone?q=' + q).toPromise();
    }
  }

  public getZoneForLocation(longitude: number, latitude: number, timestamp?: number | null, timeout?: number): Promise<ZoneForLocation> {
    if (timestamp === null || timestamp === undefined)
      timestamp = Math.floor(Date.now() / 1000);

    const params = 'lon=' + longitude + '&lat=' + latitude + '&timestamp=' + timestamp;

    if (!timeout)
      timeout = 60000;

    if (this.hostname === 'localhost') {
      return this.httpClient.jsonp<ZoneForLocation>
        ('http://test.skyviewcafe.com/timeservices/zoneloc?' + params, 'callback').timeout(timeout).toPromise();
    }
    else if (this.hostname === '127.0.0.1') {
      return this.httpClient.jsonp<ZoneForLocation>
        ('http://localhost:8088/time/zoneloc?' + params, 'callback').timeout(timeout).toPromise();
    }
    else {
      return this.httpClient.get<ZoneForLocation>('/timeservices/zoneloc?' + params).timeout(timeout).toPromise();
    }
  }
}
