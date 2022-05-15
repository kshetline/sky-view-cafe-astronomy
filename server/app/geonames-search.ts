import {
  closeMatchForCity, closeMatchForState, code2ToCode3, containsMatchingLocation, getFlagCode, LocationMap,
  makeLocationKey, processPlaceNames, standardizeShortCountyName
} from './gazetteer';
import { timedPromise } from './common';
import { AtlasLocation } from './atlas-location';
import { processMillis, toInt } from '@tubular/util';
import { requestJson } from 'by-request';

export interface GeonamesMetrics {
  retrievalTime: number;
  rawCount: number;
  matchedCount: number;
}

const MAX_TIME_GEONAMES = 20; // seconds
const FAKE_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:98.0) Gecko/20100101 Firefox/98.0';

export async function geonamesSearch(targetCity: string, targetState: string, postalCode: string, metrics: GeonamesMetrics, noTrace: boolean): Promise<LocationMap> {
  return timedPromise(geoNamesSearchAux(targetCity, targetState, postalCode, metrics, noTrace), MAX_TIME_GEONAMES * 1000, 'GeoNames search timed out');
}

async function geoNamesSearchAux(targetCity: string, targetState: string, postalCode: string, metrics: GeonamesMetrics, noTrace: boolean): Promise<LocationMap> {
  const startTime = processMillis();
  const keyedPlaces = new LocationMap();

  targetCity = targetCity.replace(/^mt\b/i, 'mount');
  metrics = metrics || {} as GeonamesMetrics;
  metrics.matchedCount = 0;

  let url = `http://api.geonames.org/${postalCode ? 'postalCodeSearchJSON' : 'searchJSON'}?username=skyview&style=full`;

  if (postalCode)
    url += '&postalcode=';
  else {
    url += '&isNameRequired=true'
            // Remove &featureCode=PRK for now -- too many obscure matches.
         + '&featureCode=LK&featureCode=MILB&featureCode=PPL&featureCode=PPLA&featureCode=PPLA2&featureCode=PPLA3'
         + '&featureCode=PPLA4&featureCode=PPLC&featureCode=PPLF&featureCode=PPLG&featureCode=PPLL&featureCode=PPLQ&featureCode=PPLR'
         + '&featureCode=PPLS&featureCode=PPLW&featureCode=PPLX&featureCode=ASTR&featureCode=ATHF&featureCode=CTRS&featureCode=OBS'
         + '&featureCode=STNB&featureCode=ATOL&featureCode=CAPE&featureCode=ISL&featureCode=MT&featureCode=PK'
         + '&name_startsWith=';
  }

  url += encodeURIComponent(postalCode || targetCity);

  let geonames: any[];
  const options = { headers: { 'User-Agent': FAKE_USER_AGENT } };
  let results: any;

  try {
    results = await requestJson(url, options);
  }
  catch (err) {
    throw new Error('GeoNames error: ' + err);
  }

  if (results) {
    if (!postalCode && results.totalResultsCount > 0 && Array.isArray(results.geonames))
      geonames = results.geonames;
    else if (postalCode && Array.isArray(results.postalCodes))
      geonames = results.postalCodes;
  }

  if (geonames) {
    metrics.rawCount = geonames.length;

    for (const geoname of geonames) {
      const city: string = postalCode ? geoname.placeName : geoname.name;
      let county: string = geoname.adminName2;
      let state: string;
      let country: string = geoname.countryCode;
      const continent: string = geoname.continentCode;
      const placeType = (postalCode ? 'P.PPL' : geoname.fcl + '.' + geoname.fcode);

      if (continent === 'AN')
        country = 'ATA';

      if (country && code2ToCode3[country])
        country = code2ToCode3[country];

      if (country === 'USA') {
        county = standardizeShortCountyName(county);
        state = geoname.adminCode1;
      }
      else
        state = geoname.adminName1;

      const names = processPlaceNames(city, county, state, country, continent, false, noTrace);

      if (!names)
        continue;

      if ((postalCode || closeMatchForCity(targetCity, names.city) || closeMatchForCity(targetCity, names.variant)) &&
           closeMatchForState(targetState, state, country)) {
        const location = new AtlasLocation();
        const population = toInt(geoname.population);
        let rank = 0;

        if (placeType.startsWith('A.') || placeType.startsWith('P.')) {
          ++rank;

          if (placeType.endsWith('PPLC'))
            ++rank;

          if (population > 0)
            rank += (population >= 1000000 ? 2 : 1);
        }

        location.city = names.city;
        location.county = names.county;
        location.state = names.state;
        location.country = names.country;
        location.longCountry = names.longCountry;
        location.flagCode = getFlagCode(names.country, names.state);
        location.rank = rank;
        location.placeType = placeType;
        location.latitude = geoname.lat;
        location.longitude = geoname.lng;
        location.zone = geoname.timezone && geoname.timezone.timeZoneId;
        location.zip = (postalCode ? geoname.postalcode : undefined);
        location.variant = names.variant;
        location.source = (postalCode ? 'GEOZ' : 'GEON');
        location.geonamesID = geoname.geonameId;

        if (!containsMatchingLocation(keyedPlaces, location)) {
          keyedPlaces.set(makeLocationKey(location.city, location.state, location.country, keyedPlaces), location);
          ++metrics.matchedCount;
        }
      }
    }
  }
  else
    metrics.rawCount = 0;

  metrics.retrievalTime = processMillis() - startTime;

  return keyedPlaces;
}
