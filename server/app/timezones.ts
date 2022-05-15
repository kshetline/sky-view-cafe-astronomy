import { pool } from './atlas_database';
import { AtlasLocation } from './atlas-location';
import { simplify } from './gazetteer';

const zoneLookup: Record<string, string[]> = {};

export async function initTimezones(): Promise<void> {
  const results: any[] = await pool.queryResults('SELECT location, zones FROM zone_lookup WHERE 1');

  results.forEach(result => {
    zoneLookup[result.location] = result.zones.split(',');
  });
}

export function getTimeZone(location: AtlasLocation): string {
  const county  = location.county;
  const state   = location.state;
  const country = location.country;
  let key = simplify(country);
  let zones = zoneLookup[key];
  let zones2: string[];
  let zone;

  if ((!zones || zones.length > 1) && state) {
    key += ':' + simplify(state);
    zones2 = zoneLookup[key];
    zones = (zones2 || zones);

    if ((!zones || zones.length > 1) && county) {
      key += ':' + simplify(county);
      zones2 = zoneLookup[key];
      zones = (zones2 || zones);
    }
  }

  if (!zones || zones.length === 0)
    zone = undefined;
  else {
    zone = zones[0];

    if (zones.length > 1)
      zone += '?';
  }

  return zone;
}
