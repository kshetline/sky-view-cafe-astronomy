/*
  Copyright © 2017-2019 Kerry Shetline, kerry@shetline.com.

  IMPORTANT NOTE: The license below DOES NOT COVER use of the
  skyviewcafe.com web site for fulfilling API requests. Users of
  this code must supply their own server-side support.

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

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { urlEncodeParams } from '@tubular/util';

const PING_INTERVAL = 1800000; // half hour

export interface AtlasResults {
  originalSearch: string;
  normalizedSearch: string;
  time: number;
  error: string;
  warning: string;
  info: string;
  limitReached: boolean;
  matches: AtlasLocation[];
}

export interface AtlasLocation {
  displayName: string;
  city: string;
  county: string;
  showCounty: boolean;
  state: string;
  showState: boolean;
  country: string;
  longCountry: string;
  flagCode: string;
  latitude: number;
  longitude: number;
  elevation: number;
  zone: string;
  zoneOffset: number; // in minutes
  zoneDst: number; // in minutes
  zip: string;
  rank: number;
  placeType: string;
  source: number;
  matchedByAlternateName: boolean;
  matchedBySound: boolean;
}

@Injectable()
export class SvcAtlasService {
  private static states: string[];
  private static statesPromise: Promise<string[]>;

  private readonly hostname: string;
  private readonly port: number;
  private readonly localTesting: boolean;
  private lastPing = -Number.MAX_SAFE_INTEGER;

  constructor(private httpClient: HttpClient) {
    this.hostname = document.location.hostname;
    this.port = parseInt(document.location.port, 10);
    this.localTesting = (this.hostname === 'localhost' || this.hostname === '127.0.0.1' || this.port === 3000);
  }

  search(q: string, extend?: boolean): Promise<AtlasResults> {
    const params = urlEncodeParams({
      client: 'web',
      notrace: this.localTesting ? 'true' : null,
      pt: 'false',
      q,
      remote: extend ? 'extend' : null
    });

    if (this.localTesting) {
      return this.httpClient.jsonp<AtlasResults>('https://test.skyviewcafe.com/atlas/?' + params, 'callback').toPromise();
    }
    else {
      return this.httpClient.get<AtlasResults>('/atlas/?' + params).toPromise();
    }
  }

  getStates(): Promise<string[]> {
    if (SvcAtlasService.states)
      return Promise.resolve(SvcAtlasService.states);
    else if (SvcAtlasService.statesPromise)
      return SvcAtlasService.statesPromise;

    if (this.localTesting) {
      SvcAtlasService.statesPromise = this.httpClient.jsonp<string[]>
        ('https://test.skyviewcafe.com/states/', 'callback').toPromise().then(data => {
          SvcAtlasService.states = data;

          return data;
        }, reason => { console.log(reason); return []; });
    }
    else {
      SvcAtlasService.statesPromise = this.httpClient.get<string[]>('/states/').toPromise().then(data => {
        SvcAtlasService.states = data;

        return data;
      });
    }

    return SvcAtlasService.statesPromise;
  }

  ping(): void {
    if (performance.now() > this.lastPing + PING_INTERVAL) {
      // We don't care about nor need to return these results.
      if (this.localTesting) {
        this.httpClient.jsonp('https://test.skyviewcafe.com/maps/ping/', 'callback').subscribe(() => this.lastPing = performance.now());
      }
      else {
        this.httpClient.get('/maps/ping').subscribe(() => this.lastPing = performance.now());
      }
    }
  }
}
