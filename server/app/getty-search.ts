import { closeMatchForCity, closeMatchForState, containsMatchingLocation, fixRearrangedName, getCode3ForCountry,
  getFlagCode, LocationMap, makeLocationKey, processPlaceNames } from './gazetteer';
import { timedPromise } from './common';
import { AtlasLocation } from './atlas-location';
import { getTimeZone } from './timezones';
import { toNumber, toInt, processMillis } from '@tubular/util';
import { requestText } from 'by-request';

export interface GettyMetrics {
  totalTime: number;
  preliminaryTime: number;
  retrievalTime: number;
  matchedCount: number;
  retrievedCount: number;
  complete: boolean;
  failedSyntax: string;
}

const MAX_TIME_GETTY = 110; // seconds
const PREFERRED_RETRIEVAL_TIME_GETTY = 40; // seconds
const FAKE_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:98.0) Gecko/20100101 Firefox/98.0';

export async function gettySearch(targetCity: string, targetState: string, metrics: GettyMetrics, noTrace: boolean): Promise<LocationMap> {
  return timedPromise(gettySearchAux(targetCity, targetState, metrics, noTrace), MAX_TIME_GETTY * 1000, 'Getty search timed out');
}

async function gettySearchAux(targetCity: string, targetState: string, metrics: GettyMetrics, noTrace: boolean): Promise<LocationMap> {
  const startTime = processMillis();
  const keyedPlaces = await gettyPreliminarySearch(targetCity, targetState, metrics, noTrace);
  const originalKeys = keyedPlaces.keys;
  const itemCount = keyedPlaces.size;
  const matches = new LocationMap();
  const retrievalStartTime = processMillis();
  let goodFormat: boolean;
  let latitude = 0.0;
  let location: AtlasLocation;
  let longitude = 0.0;
  let retrieved = 0;
  let hasCoordinates = 0;
  let $: string[];

  for (let i = 0; i < originalKeys.length; ++i) {
    let key = originalKeys[i];
    const url = 'http://www.getty.edu/vow/TGNFullDisplay?find=&place=&nation=&english=Y&subjectid=' + key;
    const options = { headers: { 'User-Agent': FAKE_USER_AGENT, Referer: 'http://www.getty.edu/vow/TGNServlet' } };
    let lines: string[];

    try {
      lines = (await requestText(url, options)).split(/\r\n|\n|\r/);
    }
    catch (err) {
      throw new Error('Getty secondary error: ' + err);
    }

    let pending = false;
    let gotLat = false;
    let gotLong = false;

    goodFormat = false;

    for (const line of lines) {
      if (($ = /<B>ID: (\d+)<\/B>/.exec(line)) && key === $[1]) {
        pending = true;
        goodFormat = true;
        ++retrieved;
      }
      else if (pending && ($ = /Lat:\s*([-.\d]+).*decimal degrees</.exec(line))) {
        latitude = toNumber($[1]);
        gotLat = true;
      }
      else if (pending && ($ = /Long:\s*([-.\d]+).*decimal degrees</.exec(line))) {
        longitude = toNumber($[1]);
        gotLong = true;
      }

      if (gotLat && gotLong) {
        location = keyedPlaces.get(key);

        location.latitude = latitude;
        location.longitude = longitude;

        key = makeLocationKey(location.city, location.state, location.country, matches);
        matches.set(key, location);
        ++hasCoordinates;

        break;
      }
    }

    if (!goodFormat)
      throw new Error('Failed to parse secondary Getty data.');

    const totalTimeSoFar = processMillis() - retrievalStartTime;
    const remainingTime = PREFERRED_RETRIEVAL_TIME_GETTY * 1000 - totalTimeSoFar;

    // If this is taking too long, settle for what has already been retrieved and give up on the rest.
    if (remainingTime <= 0)
      break;
  }

  if (metrics) {
    const missingCoordinates = retrieved - hasCoordinates;

    metrics.matchedCount = itemCount - missingCoordinates;
    metrics.retrievedCount = retrieved - missingCoordinates;
    metrics.totalTime = processMillis() - startTime;
    metrics.preliminaryTime = retrievalStartTime - startTime;
    metrics.retrievalTime = metrics.totalTime - metrics.preliminaryTime;
    metrics.complete = (metrics.matchedCount === metrics.retrievedCount);
  }

  return matches;
}

enum Stage { LOOKING_FOR_ID_CODE, LOOKING_FOR_PLACE_NAME, LOOKING_FOR_HIERARCHY, LOOKING_FOR_EXTRAS_OR_END, PLACE_HAS_BEEN_PARSED }

async function gettyPreliminarySearch(targetCity: string, targetState: string, metrics: GettyMetrics, noTrace: boolean): Promise<LocationMap> {
  let keyedPlaces = new LocationMap();
  const altKeyedPlaces = new LocationMap();
  let matchCount = 0;
  let nextItem = 1;
  let page = 0;
  let theresMore = false;
  let goodFormat: boolean;

  do {
    ++page;
    goodFormat = false;

    let altNames: string;
    let asAlternate: boolean;
    let city: string;
    let continent: string;
    let country: string;
    let county: string;
    let hierarchy: string;
    let key: string;
    let longCountry: string;
    let longState: string;
    let isMatch: boolean;
    let placeType: string = null;
    let stage: Stage;
    let state: string;
    let url: string;
    let variant: string;
    let vernacular: string;
    let searchStr = targetCity.toLowerCase().replace(' ', '-') + '*';
    let $: string[];

    searchStr = searchStr.replace(/^mt\b/, 'mount');

    url = 'http://www.getty.edu/'
         + 'vow/TGNServlet'
         + '?nation='
         + '&english=Y'
         + '&find=' + encodeURIComponent(searchStr).replace('*', '%2A')
         + '&place=atoll%2C+cape%2C+city%2C+county%2C+dependent+state%2C+inhabited+place%2C+island%2C+mountain%2C+'
         + 'nation%2C+neighborhood%2C+park%2C+peak%2C+province%2C+state%2C+suburb%2C+town%2C+township%2C+village';

    if (page > 1)
      url += '&prev_page=' + (page - 1);

    url += '&page=' + page;

    const options = { headers: { 'User-Agent': FAKE_USER_AGENT, Referer: 'http://www.getty.edu/research/tools/vocabularies/tgn/index.html' } };
    let lines: string[];

    try {
      lines = (await requestText(url, options)).split(/\r\n|\n|\r/);
    }
    catch (err) {
      throw new Error('Getty preliminary error: ' + err);
    }

    for (let i = 0; i < lines.length; ++i) {
      let line = lines[i];

      if (matchCount === 0 && /Your search has produced (no|too many) results\./i.test(line)) {
        goodFormat = true;

        break;
      }
      else if (matchCount === 0 && /Your search has invalid syntax\./i.test(line)) {
        goodFormat = true; // The Getty output format is good -- it's our input format that's bad.

        if (metrics != null)
          metrics.failedSyntax = searchStr;

        break;
      }
      else if (matchCount === 0 && /Server Error/i.test(line)) {
        throw new Error('Getty server error');
      }
      else if (/global_next.gif/i.test(line)) {
        theresMore = true;
      }
      else if (($ = /<TD><SPAN class="page"><B>(\d+)\.&nbsp;&nbsp;<\/B><\/SPAN><\/TD>/.exec(line)) &&
               toInt($[1]) === nextItem) {
        ++nextItem;

        stage = Stage.LOOKING_FOR_ID_CODE;
        city = undefined;
        key = '0';
        hierarchy = undefined;
        altNames = '';
        asAlternate = false;
        vernacular = undefined;

        while (++i < lines.length) {
          line = lines[i].trim();

          if (stage === Stage.LOOKING_FOR_ID_CODE && ($ = /<INPUT type=checkbox value=(\d+) name=checked>/.exec(line))) {
            key = $[1];
            stage = Stage.LOOKING_FOR_PLACE_NAME;
          }
          else if (stage === Stage.LOOKING_FOR_PLACE_NAME && ($ = /(.+)<b>(.+)<\/B><\/A> \.\.\.\.\.\.\.\.\.\. \((.+)\)/.exec(line))) {
            city = $[2];
            placeType = $[3];
            stage = Stage.LOOKING_FOR_HIERARCHY;
          }
          else if (stage === Stage.LOOKING_FOR_HIERARCHY && ($ = /<TD COLSPAN=2><SPAN CLASS=page>\((.+)\) \[\d+]/.exec(line))) {
            hierarchy = $[1];
            // It sucks having commas as part of real data which is itself delimited by commas! (Foobar, Republic of).
            hierarchy = hierarchy.replace(/(, )(.[^,]+?), ([^,]+? (ar-|da|de|du|d'|La|la|Le|le|Las|las|Les|les|Los|los|of|The|the|van))(,|$)/g, '$1$3 2$5');

            if (/Indonesia/.test(hierarchy))
              hierarchy = hierarchy.replace(/(, Daerah Tingkat I)|(, Pulau)/, '');

            stage = Stage.LOOKING_FOR_EXTRAS_OR_END;
          }
          else if (stage === Stage.LOOKING_FOR_EXTRAS_OR_END) {
            if (!vernacular && ($ = /Vernacular: (.+?)(<|$)/.exec(line))) {
              vernacular = $[1].trim();
            }
            else if (($ = /<B>(\D.+)<\/B><BR>/.exec(line))) {
              if (altNames)
                altNames += ';';

              altNames += $[1];
            }
            else if (($ = /<TD><SPAN class="page"><B>(\d+)\.&nbsp;&nbsp;<\/B><\/SPAN><\/TD>/.exec(line)) &&
                     toInt($[1]) === nextItem) {
              --i; // We'll want to parse this same line again as the first line of the next city.
              stage = Stage.PLACE_HAS_BEEN_PARSED;
              break;
            }
            else if (/<\/TABLE>/.test(line)) {
              stage = Stage.PLACE_HAS_BEEN_PARSED;
              break;
            }
          }
        }

        if (stage === Stage.PLACE_HAS_BEEN_PARSED) {
          goodFormat = true;
          isMatch = false;
          continent = undefined;
          state = undefined;
          county = undefined;

          if (($ = /(.+?), (.+?), (.+?), (.+?), (.+?)(,|$)/.exec(hierarchy))) {
            continent = $[2];
            country = $[3];
            state = $[4];
            county = $[5];
          }
          else if (($ = /(.+?), (.+?), (.+?), (.+?)(,|$)/.exec(hierarchy))) {
            continent = $[2];
            country = $[3];
            state = $[4];
          }
          else if (($ = /(.+?), (.+?), (.+?)(,|$)/.exec(hierarchy))) {
            continent = $[2];
            country = $[3];
          }
          else if (($ = /(.+?), (.+?)(,|$)/.exec(hierarchy))) {
            continent = $[2];

            if (/Antarctica/i.test(hierarchy))
              country = 'ATA';
            else {
              const possibleCountry = fixRearrangedName(city).name;

              if (getCode3ForCountry(possibleCountry)) {
                city = possibleCountry;
                country = possibleCountry;
              }
              else
                country = undefined;
            }
          }
          else
            country = city;

          const names = processPlaceNames(city, county, state, country, continent, true, noTrace);

          if (!names)
            continue;

          city = names.city;
          variant = names.variant;
          county = names.county;
          state = names.state;
          longState = names.longState;
          country = names.country;
          longCountry = names.longCountry;

          if (placeType === 'nation' || placeType === 'dependent state') {
            city = longCountry;

            if (closeMatchForCity(targetCity, country) || closeMatchForCity(targetCity, longCountry))
              isMatch = true;
          }
          else if (placeType === 'state' || placeType === 'province') {
            city = longState;

            if (closeMatchForCity(targetCity, state) || closeMatchForCity(targetCity, longState))
              isMatch = true;
          }
          else {
            if (closeMatchForCity(targetCity, city) || closeMatchForCity(targetCity, variant))
              isMatch = true;
            else if (closeMatchForCity(targetCity, vernacular)) {
              city = vernacular;
              isMatch = true;
            }
            else if (altNames) {
              for (const altName of altNames.split(';')) {
                if (closeMatchForCity(targetCity, altName)) {
                  city = altName;
                  isMatch = true;
                  asAlternate = true;

                  break;
                }
              }
            }
          }

          if (isMatch && closeMatchForState(targetState, state, country)) {
            if (placeType === 'cape')
              placeType = 'T.CAPE';
            else if (placeType === 'park')
              placeType = 'L.PRK';
            else if (placeType === 'peak')
              placeType = 'T.PK';
            else if (placeType === 'county')
              placeType = 'A.ADM2';
            else if (placeType === 'atoll' || placeType === 'island')
              placeType = 'T.ISL';
            else if (placeType === 'mountain')
              placeType = 'T.MT';
            else if (placeType === 'dependent state' || placeType === 'nation')
              placeType = 'A.ADM0';
            else if (placeType === 'province' || placeType === 'state')
              placeType = 'A.ADM1';
            else
              placeType = 'P.PPL';

            const location = new AtlasLocation();

            location.city = city;
            location.county = county;
            location.state = state;
            location.country = country;
            location.longCountry = longCountry;
            location.flagCode = getFlagCode(country, state);
            location.placeType = placeType;
            location.variant = variant;
            location.source = 'GTTY';
            location.rank = 0; // TODO: Can be improved?

            if (!containsMatchingLocation(keyedPlaces, location) &&
                !containsMatchingLocation(altKeyedPlaces, location)) {
              ++matchCount;
              location.zone = getTimeZone(location);

              if (asAlternate)
                altKeyedPlaces.set(key, location);
              else
                keyedPlaces.set(key, location);
            }
          }
        }
      }
    }

    // Never read more than 6 pages, and don't keep going if at least
    // 50 matches have been found. If the match rate is high in the first
    // two of pages or more, don't go any further than that.
  } while (theresMore && page < 6 && matchCount < 50 && !(page > 1 && matchCount >= page * 12));

  if (matchCount === 0 && !goodFormat)
    throw new Error('Failed to parse Getty data.');

  if (keyedPlaces.size === 0)
    keyedPlaces = altKeyedPlaces;
  else if (keyedPlaces.size + altKeyedPlaces.size < 25)
    altKeyedPlaces.forEach((value, key) => keyedPlaces.set(key, value));

  return keyedPlaces;
}
