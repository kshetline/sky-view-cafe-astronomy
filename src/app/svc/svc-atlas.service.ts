/*
  Copyright © 2017 Kerry Shetline, kerry@shetline.com.

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

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { urlEncodeParams } from '../util/ks-util';

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
  zoneOffset: number;
  zoneDst: number;
  zip: string;
  rank: number;
  placeType: string;
  source: number;
  matchedByAlternateName: boolean;
  matchedBySound: boolean;
}

@Injectable()
export class SvcAtlasService {
  private static states: string[] = null;

  private hostname: string;

  constructor(private httpClient: HttpClient) {
    this.hostname = document.location.hostname;
  }

  public search(q: string, extend?: boolean): Promise<AtlasResults> {
    const localTesting = (this.hostname === 'localhost' || this.hostname === '127.0.0.1');
    const params = urlEncodeParams({
      client: 'web',
      notrace: localTesting ? 'true' : null,
      q: q,
      remote: extend ? 'extend' : null
    });

    if (localTesting) {
      return this.httpClient.jsonp<AtlasResults>('http://test.skyviewcafe.com/atlasdb/atlas?' + params, 'callback').toPromise();
    }
    else {
      return this.httpClient.get<AtlasResults>('/atlasdb/atlas?' + params).toPromise();
    }
  }

  public getStates(): Promise<string[]> {
    if (SvcAtlasService.states)
      return Promise.resolve(SvcAtlasService.states);

    const localTesting = (this.hostname === 'localhost' || this.hostname === '127.0.0.1');

    if (localTesting) {
      return this.httpClient.jsonp<string[]>
        ('http://test.skyviewcafe.com/atlasdb/states', 'callback').toPromise().then(data => {
          SvcAtlasService.states = data;

          return data;
        });
    }
    else {
      return this.httpClient.get<string[]>('/atlasdb/states').toPromise().then(data => {
          SvcAtlasService.states = data;

          return data;
        });
    }
  }
}
