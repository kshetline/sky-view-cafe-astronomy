import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { timeout } from 'rxjs/operators';

// noinspection JSUnusedGlobalSymbols
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
  private readonly hostname: string;
  private readonly port: number;

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
