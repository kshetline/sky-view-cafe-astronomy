import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { urlEncodeParams } from '@tubular/util';

const PING_INTERVAL = 1800000; // half hour

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

  search(q: string, extend?: boolean, fast = false): Promise<AtlasResults> {
    const params = urlEncodeParams({
      client: 'svc',
      notrace: this.localTesting ? 'true' : null,
      pt: 'false',
      q,
      remote: extend ? 'extend' : fast ? 'skip' : null
    });

    if (this.hostname === '127.0.0.1')
      return this.httpClient.jsonp<AtlasResults>('https://localhost:8088/atlas/?' + params, 'callback').toPromise();
    else if (this.localTesting)
      return this.httpClient.jsonp<AtlasResults>('https://test.skyviewcafe.com/atlas/?' + params, 'callback').toPromise();
    else
      return this.httpClient.get<AtlasResults>('/atlas/?' + params).toPromise();
  }

  getStates(): Promise<string[]> {
    if (SvcAtlasService.states)
      return Promise.resolve(SvcAtlasService.states);
    else if (SvcAtlasService.statesPromise)
      return SvcAtlasService.statesPromise;

    if (this.localTesting) {
      const apiHost = (this.hostname === '127.0.0.1' ? 'http://localhost:8088/states/' : 'https://test.skyviewcafe.com/states/');

      SvcAtlasService.statesPromise = this.httpClient.jsonp<string[]>(apiHost, 'callback').toPromise().then(data => {
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
