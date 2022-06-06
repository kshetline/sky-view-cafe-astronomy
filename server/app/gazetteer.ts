import { readdirSync } from 'fs';
import unidecode from 'unidecode-plus';
import { eqci, getFileContents } from './common';
import { AtlasLocation } from './atlas-location';
import { decode } from 'html-entities';
import { MapClass } from './map-class';
import { logWarning, pool } from './atlas_database';
import { acos, cos_deg, PI, sin_deg } from '@tubular/math';
import { join as pathJoin } from 'path';
import { PoolConnection } from './mysql-await-async';
import { svcApiConsole } from './svc-api-logger';
import { asLines, makePlainASCII_UC, toNumber } from '@tubular/util';
import { requestText } from 'by-request';

export interface ParsedSearchString {
  actualSearch: string;
  altCity?: string;
  altNormalized?: string;
  altState?: string;
  normalizedSearch: string;
  postalCode: string;
  targetCity: string;
  targetState: string;
}

export interface NameAndCode {
  name: string;
  code: string;
}

export type ParseMode = 'loose' | 'strict';

const TRAILING_STATE_PATTERN = /(.+)\s+(\p{L}{2,})$/u;
const usTerritories = ['AS', 'FM', 'GU', 'MH', 'MP', 'PW', 'VI'];
const canadianProvinceAbbrs = ['AB', 'BC', 'MB', 'NB', 'NF', '', 'NS', 'ON', 'PE', 'QC', 'SK', 'YT', 'NT', 'NU'];

interface ProcessedNames {
  city: string;
  variant: string;
  county: string;
  state: string;
  longState: string;
  country: string;
  longCountry: string;
  continent: string;
}

export class LocationMap extends MapClass<string, AtlasLocation> { }

export const longStates: Record<string, string> = {};
export const stateAbbreviations: Record<string, string> = {};
export const altFormToStd: Record<string, string> = {};
export const code3ToName: Record<string, string> = {};
export const code3ToNameByLang: Record<string, Record<string, string>> = {};
export const admin1ToNameByLang: Record<string, Record<string, string>> = {};
export const nameToCode3: Record<string, string> = {};
export const code2ToCode3: Record<string, string> = {};
export const code3ToCode2: Record<string, string> = {};
export const admin1s: Record<string, string> = {};
export const admin2s: Record<string, string> = {};
export const postalPatterns = new Map<string, RegExp>();

export const usCounties = new Set<string>();
export const celestialNames = new Set<string>();

interface CountryIn {
  id: number;
  name: string;
  iso2: string;
  iso3: string;
  key_name: string;
  geonames_id: number;
  postal_regex: string;
}

interface AdminIn {
  id: number;
  name: string;
  key_name: string;
  geonames_id: number;
}

interface AltNames {
  geonames_orig_id: number;
  lang: string;
  name: string;
  preferred: number;
  short: number;
}

interface GazetteerEntry {
  admin1: string;
  country: string;
  geonames_id: number;
}

export function makeKey(name: string): string {
  return unidecode(name || '', { german: true }).toUpperCase().replace(/[^A-Z\d]+/g, '').substring(0, 40);
}

export async function initGazetteer(): Promise<void> {
  let connection: PoolConnection;

  try {
    await initFlagCodes();
    connection = await pool.getConnection();

    let rows = (await connection.queryResults('SELECT * FROM gazetteer_countries'));
    const idToCode3: Record<number, string> = {};

    for (const row of rows as CountryIn[]) {
      nameToCode3[simplify(row.name).substr(0, 40)] = row.iso3;
      code3ToName[row.iso3] = row.name;
      idToCode3[row.geonames_id] = row.iso3;

      if (row.iso2) {
        code2ToCode3[row.iso2] = row.iso3;
        code3ToCode2[row.iso3] = row.iso2;
      }

      if (row.postal_regex)
        postalPatterns.set(row.iso3, new RegExp(row.postal_regex, 'i'));
    }

    rows = (await connection.queryResults(`SELECT * FROM gazetteer_alt_names WHERE type ='C' AND (historic = 0 OR preferred = 1) AND colloquial = 0`));

    for (const row of rows as AltNames[]) {
      if (!row.lang)
        row.lang = '';

      const iso3 = idToCode3[row.geonames_orig_id];
      let countryRec = code3ToNameByLang[iso3];

      if (!countryRec) {
        countryRec = {};
        code3ToNameByLang[iso3] = countryRec;
      }

      if (!row.short && (!row.lang || row.lang === 'en'))
        countryRec[row.lang] = code3ToName[iso3];

      if (row.short || row.preferred || !countryRec[row.lang])
        countryRec[row.lang] = row.name;
    }

    const idToAdmin1: Record<number, string> = {};

    rows = (await connection.queryResults('SELECT * FROM gazetteer_admin1'));

    for (const row of rows as AdminIn[]) {
      admin1s[row.key_name] = row.name;
      idToAdmin1[row.geonames_id] = row.key_name;

      if (row.key_name.startsWith('USA.'))
        longStates[row.key_name.substr(4)] = row.name;
    }

    rows = (await connection.queryResults(`SELECT * FROM gazetteer_alt_names WHERE type ='1' AND historic = 0 AND colloquial = 0`));

    const notFound: { id: number, lang: string, name: string }[] = [];

    for (const row of rows as AltNames[]) {
      if (!row.lang)
        row.lang = '';

      const admin1 = idToAdmin1[row.geonames_orig_id];

      if (row.lang === 'es' && /^Estado de /i.test(row.name))
        row.name = row.name.substring(10).trim();

      if (!admin1) {
        notFound.push({ id: row.geonames_orig_id, lang: row.lang, name: row.name });
        continue;
      }

      let adminRec = admin1ToNameByLang[admin1];

      if (!adminRec) {
        adminRec = {};
        admin1ToNameByLang[admin1] = adminRec;
      }

      if (row.lang === 'en' && !row.preferred)
        adminRec.en = admin1s[admin1];
      else if (row.short || row.preferred || !adminRec[row.lang])
        adminRec[row.lang] = row.name;
    }

    if (notFound.length > 0) {
      const values = Array.from(new Set(notFound.map(nf => nf.id)).values()).join(', ');

      rows = (await connection.queryResults(`SELECT * FROM gazetteer WHERE geonames_id IN (${values})`));

      for (const row of rows as GazetteerEntry[]) {
        const admin1 = `${row.country}.${row.admin1}`;
        let adminRec = admin1ToNameByLang[admin1];

        if (!adminRec) {
          adminRec = {};
          admin1ToNameByLang[admin1] = adminRec;
        }

        for (const nf of notFound) {
          if (nf.id === row.geonames_id)
            adminRec[nf.lang || ''] = nf.name;
        }
      }
    }

    rows = (await connection.queryResults('SELECT * FROM gazetteer_admin2'));

    for (const row of rows as AdminIn[]) {
      admin2s[row.key_name] = row.name;

      if (row.key_name.startsWith('USA.'))
        usCounties.add(standardizeShortCountyName(row.name) + ', ' + row.key_name.substr(4, 2));
    }

    usCounties.add('Washington, DC');

    const lines = asLines(await getFileContents('data/celestial.txt', 'utf8'));

    lines.forEach(line => celestialNames.add(makePlainASCII_UC(line.trim())));
  }
  catch (err) {
    svcApiConsole.error('Gazetteer init error: ' + err);
  }

  connection?.release();
}

const flagCodes = new Set<string>();

async function initFlagCodes(): Promise<void> {
  try {
    const flagFiles = readdirSync(pathJoin(__dirname, 'public/assets/resources/flags'));
    let $: string[];

    flagFiles.forEach(file => {
      if (($ = /^(\w+)\.png$/.exec(file)))
        flagCodes.add($[1]);
    });

    if (flagCodes.size) {
      svcApiConsole.info('Flag codes obtained from local directory');
      return;
    }
  }
  catch (err) { /* Ignore error, proceed to remote retrieval. */ }

  try {
    const lines = (await requestText('https://skyviewcafe.com/assets/resources/flags/')).split(/\r\n|\n|\r/);

    lines.forEach(line => {
      const $ = />(\w+)\.png</.exec(line);

      if ($)
        flagCodes.add($[1]);
    });

    svcApiConsole.info('Flag codes obtained from remote directory');
  }
  catch (err) {
    throw new Error('initFlagCodes error: ' + err);
  }
}

const VARIANT_START = /^((CANON DE|CERRO|FORT|FT|ILE D|ILE DE|ILE DU|ILES|ILSA|LA|LAKE|LAS|LE|LOS|MOUNT|MT|POINT|PT|THE) )(.*)/;

export function simplify(s: string, asVariant = false, processAbbreviations = true): string {
  if (!s)
    return s;

  const pos = s.indexOf('(');

  if (pos >= 0)
    s = s.substring(0, pos).trim();

  s = makePlainASCII_UC(s);

  let sb: string[] = [];

  for (let i = 0; i < s.length; ++i) {
    const ch = s.charAt(i);

    if (ch === '-' || ch === '.')
      sb.push(' ');
    else if (ch === ' ' || /[\dA-Z]/i.test(ch))
      sb.push(ch);
  }

  s = sb.join('');

  if (processAbbreviations) {
    if (asVariant) {
      const $ = VARIANT_START.exec(s);

      if ($)
        s = $[3];
    }
    else if (s.startsWith('FORT '))
      s = 'FT' + s.substring(5);
    else if (s.startsWith('MOUNT '))
      s = 'MT' + s.substring(6);
    else if (s.startsWith('POINT '))
      s = 'PT' + s.substring(6);

    if (s.startsWith('SAINT '))
      s = 'ST' + s.substring(6);
    else if (s.startsWith('SAINTE '))
      s = 'STE' + s.substring(7);
  }

  sb = [];

  for (let i = 0; i < s.length && sb.length < 40; ++i) {
    const ch = s.charAt(i);

    if (ch !== ' ')
      sb.push(ch);
  }

  return sb.join('');
}

function startsWithICND(testee: string, test: string): boolean { // Ignore Case aNd Diacriticals
  if (!testee || !test)
    return false;

  testee = simplify(testee);
  test = simplify(test);

  return testee.startsWith(test);
}

export function closeMatchForCity(target: string, candidate: string): boolean {
  if (!target || !candidate)
    return false;

  target = simplify(target);
  candidate = simplify(candidate);

  return candidate.startsWith(target);
}

export function closeMatchForState(target: string, state: string, country: string, lang?: string): boolean {
  if (!target || (!state && !country))
    return true;

  const stateKey = `${country}.${state}`;
  const longState   = lang ? (admin1ToNameByLang[stateKey] || {})[lang] || longStates[state] : longStates[state];
  const longCountry = code3ToName[country];
  const code2       = code3ToCode2[country];

  return (startsWithICND(state, target) ||
          startsWithICND(country, target) ||
          startsWithICND(longState, target) ||
          startsWithICND(longCountry, target) ||
          (country === 'GBR' && startsWithICND('Great Britain', target)) ||
          (country === 'GBR' && startsWithICND('England', target)) ||
          startsWithICND(code2, target));
}

const CLEANUP1 = /^((County(\s+of)?)|((Provincia|Prov\xC3\xADncia|Province|Regi\xC3\xB3n Metropolitana|Distrito|Regi\xC3\xB3n)\s+(de|del|de la|des|di)))/i;
const CLEANUP2 = /\s+(province|administrative region|national capital region|prefecture|oblast'|oblast|kray|county|district|department|governorate|metropolitan area|territory)$/;
const CLEANUP3 = /\s+(region|republic)$/;

export function countyStateCleanUp(s: string): string {
  s = s.replace(CLEANUP1, '');
  s = s.replace(CLEANUP2, '');
  s = s.replace(CLEANUP3, '').trim();

  return s;
}

export function isRecognizedUSCounty(county: string, state: string): boolean {
  return usCounties.has(county + ', ' + state);
}

export function standardizeShortCountyName(county: string): string {
  if (!county)
    return county;

  county = county.trim();
  county = county.replace(/ \(.*\)/g, '');
  county = county.replace(/\s+/g, ' ');
  county = county.replace(/\s*?-\s*?\b/g, '-');
  county = county.replace(/City and (Borough|County) of /i, '');
  county = county.replace(/ (Borough|Census Area|County|Division|Municipality|Parish|City and Borough)/ig, '');
  county = county.replace(/Aleutian Islands/i, 'Aleutians West');
  county = county.replace(/Juneau City and/i, 'Juneau');
  county = county.replace(/Coös/i, 'Coos');
  county = county.replace(/De Kalb/i, 'DeKalb');
  county = county.replace(/De Soto/i, 'DeSoto');
  county = county.replace(/De Witt/i, 'DeWitt');
  county = county.replace(/Du Page/i, 'DuPage');
  county = county.replace(/^La(Crosse|Moure|Paz|Plate|Porte|Salle)/i, 'La $1');
  county = county.replace(/Skagway-Yakutat-Angoon/i, 'Skagway-Hoonah-Angoon');
  county = county.replace(/Grays Harbor/i, "Gray's Harbor");
  county = county.replace(/OBrien/i, "O'Brien");
  county = county.replace(/Prince Georges/i, "Prince George's");
  county = county.replace(/Queen Annes"/, "Queen Anne's");
  county = county.replace(/Scotts Bluff/i, "Scott's Bluff");
  county = county.replace(/^(St. |St )/i, 'Saint ');
  county = county.replace(/Saint Johns/i, "Saint John's");
  county = county.replace(/Saint Marys/i, "Saint Mary's");
  county = county.replace(/BronxCounty/i, 'Bronx');

  const $ = /^Mc([a-z])(.*)/.exec(county);

  if ($)
    county = 'Mc' + $[1].toUpperCase() + $[2];

  return county;
}

export function containsMatchingLocation(matches: LocationMap, location: AtlasLocation): boolean {
  return matches.values.findIndex(location2 =>
    location2.city === location.city &&
    location2.county === location.county &&
    location2.state === location.state &&
    location2.country === location.country) >= 0;
}

export function fixRearrangedName(name: string): { name: string, variant: string } {
  let variant: string;
  let $: string[];

  if (($ = /(.+), (\w)(.*')/.exec(name))) {
    variant = $[1];
    name = $[2].toUpperCase() + $[3] + variant;
  }
  else if (($ = /(.+), (\w)(.*)/.exec(name))) {
    variant = $[1];
    name = $[2].toUpperCase() + $[3] + ' ' + variant;
  }

  return { name, variant };
}

export function getCode3ForCountry(country: string): string {
  country = simplify(country).substr(0, 20);

  return nameToCode3[country];
}

export function processPlaceNames(city: string, county: string, state: string, country: string, continent: string,
                                  decodeHTML = false, noTrace = true): ProcessedNames {
  let abbrevState: string;
  let longState: string;
  let longCountry: string;
  let origCounty: string;
  let variant: string;

  if (decodeHTML) {
    city = decode(city);
    county = decode(county);
    state = decode(state);
    country = decode(country);
    continent = decode(continent);
  }

  if (/\b\d+[a-z]/i.test(city))
    return null;

  if (/\bParis \d\d\b/i.test(city))
    return null;

  ({ name: city, variant } = fixRearrangedName(city));

  if (/,/.test(city))
    logWarning(`City name "${city}" (${state}, ${country}) contains a comma.`, noTrace);

  let $: string[];

  if (!variant && ($ = /^(lake|mount|(?:mt\.?)|the|la|las|el|le|los)\b(.+)/i.exec(city)))
    variant = $[2].trim();

  const altForm = altFormToStd[simplify(country)];

  if (altForm)
    country = altForm;

  state = countyStateCleanUp(state);
  county = countyStateCleanUp(county);

  longState = state;
  longCountry = country;
  const code3 = getCode3ForCountry(country);

  if (code3) {
    country = code3;
  }
  else if (code3ToName[country]) {
    longCountry = code3ToName[country];
  }
  else {
    logWarning(`Failed to recognize country "${country}" for city "${city}, ${state}".`, noTrace);
    country = country.replace(/^(.{0,2}).*$/, '$1?');
  }

  if (state.toLowerCase().endsWith(' state')) {
    state = state.substr(0, state.length - 6);
  }

  if (country === 'USA' || country === 'CAN') {
    if (state && longStates[state])
      longState = longStates[state];
    else if (state) {
      abbrevState = stateAbbreviations[makePlainASCII_UC(state)];

      if (abbrevState) {
        abbrevState = state;
        abbrevState = abbrevState.replace(/ (state|province)$/i, '');
        abbrevState = stateAbbreviations[makePlainASCII_UC(abbrevState)];
      }

      if (abbrevState)
        state = abbrevState;
      else
        logWarning(`Failed to recognize state/province "${state}" in country ${country}.`, noTrace);
    }

    if (county && country === 'USA' && usTerritories.includes(state)) {
      origCounty = county;
      county = standardizeShortCountyName(county);

      if (!isRecognizedUSCounty(county, state)) {
        county = origCounty;

        if (county === 'District of Columbia')
          county = 'Washington';

        county = county.replace(/^City of /i, '');
        county = county.replace(/\s(Indep. City|Independent City|Independent|City|Division|Municipality)$/i, '');

        if (county !== origCounty) {
          if (simplify(origCounty) === simplify(city) || simplify(county) === simplify(city)) {
            // City is its own county in a sense -- and independent city. Blank out the redundancy.
            county = undefined;
          }
          // Otherwise, this is probably a neighborhood in an independent city. We'll treat
          // the independent city as a county, being that it's a higher administrative level,
          // adding "City of" where appropriate.
          else if (/city|division|municipality/i.test(city))
            county = 'City of ' + county;
        }
        else
          logWarning(`Failed to recognize US county "${county}" for city "${city}".`, noTrace);
      }
    }
  }

  return { city, variant, county, state, longState, country, longCountry, continent };
}

export function getFlagCode(country: string, state: string): string {
  let code;

  if (country === 'GBR' && eqci(state, 'England'))
    code = 'england';
  else if (country === 'GBR' && eqci(state, 'Scotland'))
    code = 'scotland';
  else if (country === 'GBR' && eqci(state, 'Wales'))
    code = 'wales';
  else if (country === 'ESP' && eqci(state, 'Catalonia'))
    code = 'catalonia';
  else
    code = code3ToCode2[country];

  if (code) {
    code = code.toLowerCase();

    if (!flagCodes.has(code))
      code = undefined;
  }
  else
    code = undefined;

  return code;
}

export function roughDistanceBetweenLocationsInKm(lat1: number, long1: number, lat2: number, long2: number): number {
  let deltaRad = acos(sin_deg(lat1) * sin_deg(lat2) + cos_deg(lat1) * cos_deg(lat2) * cos_deg(long1 - long2));

  while (deltaRad > PI)
    deltaRad -= PI;

  while (deltaRad < -PI)
    deltaRad += PI;

  return deltaRad * 6378.14; // deltaRad * radius_of_earth_in_km
}

export function makeLocationKey(city: string, state: string, country: string, otherLocations: LocationMap): string {
  let key: string;
  let index = 1;

  city = simplify(city, false);

  if (state && (country === 'USA' || country === 'CAN'))
    key = city + ',' + state;
  else
    key = city + ',' + country;

  const baseKey = key;

  while (otherLocations.has(key)) {
    ++index;
    key = baseKey + '(' + index + ')';
  }

  return key;
}

function isPostalCode(s: string): boolean {
  for (const regex of postalPatterns.values()) {
    if (regex.test(s))
      return true;
  }

  return false;
}

export function parseSearchString(q: string, mode: ParseMode): ParsedSearchString {
  const parsed = { actualSearch: q } as ParsedSearchString;
  const parts = q.split(',').map(part => part.trim());
  const altParts = q.split(/\s+/).map(part => part.trim()).filter(part => !/,/.test(part));
  let postalCode = '';
  let targetCity = parts[0];
  let targetState = parts[1];
  let targetCountry = parts[2];
  let $: string[];

  if (altParts.length > 1) {
    if (isPostalCode(altParts[0])) {
      postalCode = altParts[0];
      targetCity = '';
      targetState = altParts[1];
    }
    else if (isPostalCode(altParts[1])) {
      postalCode = altParts[1];
      targetCity = altParts[0];
      targetState = '';
    }
  }

  if (!postalCode) {
    if (isPostalCode(targetCity)) {
      postalCode = targetCity;
      targetCity = '';
    }
    else if (targetState && isPostalCode(targetState)) {
      postalCode = targetState;
      targetState = '';
    }
    else
      targetCity = makeKey(targetCity);
  }

  targetState = makeKey(targetState);
  targetCountry = makeKey(targetCountry);

  if (targetCountry)
    targetState = targetCountry;

  if (!targetState && ($ = TRAILING_STATE_PATTERN.exec(parts[0]))) {
    const start = makeKey($[1].trim());
    const end = $[2].toUpperCase();

    if (mode === 'loose' && (longStates[end] || code3ToName[end])) {
      targetCity = start;
      targetState = end;
    }
    else {
      parsed.altCity = start;
      parsed.altState = end;
    }

    parsed.altNormalized = `${start}, ${end}`;
  }

  parsed.postalCode = postalCode;
  parsed.targetCity = targetCity;
  parsed.targetState = targetState;
  parsed.normalizedSearch = postalCode || targetCity;

  if (targetState)
    parsed.normalizedSearch += ', ' + targetState;
  else if (postalCode && targetCity)
    parsed.normalizedSearch = targetCity + ', ' + postalCode;

  return parsed;
}

const CENSUS_AREAS = new RegExp(
  '(Aleutians West|Bethel|Dillingham|Nome|Prince of Wales-Outer Ketchikan|' +
  'Skagway-Hoonah-Angoon|Southeast Fairbanks|Valdez-Cordova|Wade Hampton|' +
  'Wrangell-Petersburg|Yukon-Koyukuk)', 'i');

export function adjustUSCountyName(county: string, state: string): string {
  if (/ (Division|Census Area|Borough|Parish|County)$/i.test(county))
    return county;

  if (state === 'AK') {
    if (/Anchorage|Juneau/i.test(county)) {
      county += ' Division';
    }
    else if (CENSUS_AREAS.test(county))
      county += ' Census Area';
    else
      county += ' Borough';
  }
  else if (state === 'LA')
    county += ' Parish';
  else
    county += ' County';

  return county;
}

export function getStatesProvincesAndCountries(lang = 'en'): NameAndCode[] {
  const usStates: NameAndCode[] = Object.keys(admin1s).filter(key => key.startsWith('USA')).map(key =>
    ({ name: admin1s[key], code: key.substr(4) }));
  const canadianProvinces: NameAndCode[] = Object.keys(admin1s).filter(key => key.startsWith('CAN')).map(key =>
    ({ name: admin1s[key], code: canadianProvinceAbbrs[toNumber(key.substr(4)) - 1] }));
  const countries: NameAndCode[] = [];
  const results: NameAndCode[] = [];

  if (lang !== 'en') {
    usStates.forEach(state => state.name = (admin1ToNameByLang['USA.' + state.code] || [] as any)[lang] || state.name);
    canadianProvinces.forEach(province => {
      province.name = (admin1ToNameByLang['CAN.' +
        (canadianProvinceAbbrs.indexOf(province.code) + 1).toString().padStart(2, '0')] || [] as any)[lang] || province.name;
    });
  }

  usStates.sort((a, b) => a.name.localeCompare(b.name, lang));
  results.push(...usStates);

  canadianProvinces.sort((a, b) => a.name.localeCompare(b.name, lang));
  results.push(null, ...canadianProvinces);

  Object.keys(code3ToName).forEach(code => {
    if (!/^(NML|XX.|(.*[^A-Z].*))$/.test(code))
      countries.push({ name: (code3ToNameByLang[code] || [] as any)[lang] || code3ToName[code], code });
  });

  countries.sort((a, b) => a.name.localeCompare(b.name, lang));
  results.push(null, ...countries);

  return results;
}
