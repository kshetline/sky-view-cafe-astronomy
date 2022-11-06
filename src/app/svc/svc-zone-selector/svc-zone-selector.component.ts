import { ChangeDetectorRef, Component, EventEmitter, forwardRef, OnInit, Output } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { noop } from '@tubular/util';
import { Timezone, RegionAndSubzones } from '@tubular/time';
import { timer } from 'rxjs';
import { AppService, IANA_DB_UPDATE } from '../../app.service';

export const SVC_ZONE_SELECTOR_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => SvcZoneSelectorComponent),
  multi: true,
};

const MISC_OPTION = '- Miscellaneous -';
const UT_OPTION   = '- UTC hour offsets -';
const OS_OPTION   = '- Your OS timezone -';
const LMT_OPTION  = '- Local Mean Time -';

const MISC = 'MISC';
const UT   = 'UT';
const OS   = 'OS';
const LMT  = 'LMT';

function toCanonicalOffset(offset: string): string { // ([§#~^\u2744])
  if (offset === 'UTC')
    return '+00:00';

  let off = offset;
  let dst = '';
  const $ = /([-+]\d+(?::\d+)?)(.+)?/.exec(offset);

  if ($) {
    off = $[1];
    dst = ($[2] ?? '').trim();

    if (dst.includes('two'))
      dst = '#';
    else if (dst.includes('half'))
      dst = '^';
    else if (dst.includes('negative'))
      dst = '\u2744';
    else if (dst === 'DST')
      dst = '§';
    else if (dst)
      dst = '~';
  }

  return off + dst;
}

function toCanonicalZone(zone: string): string {
  return zone?.replace(/ /g, '_');
}

function toDisplayOffset(offset: string): string {
  if (!offset)
    return null;

  let off = offset;
  let dst = '';
  const $ = /([-+]\d+(?::\d+)?)([§#~^\u2744])?/.exec(offset);

  if ($) {
    off = $[1];
    dst = $[2] ?? '';

    if (!dst && off.substring(1) === '00:00')
      return 'UTC';
    else if (dst === '§')
      dst = ' DST';
    else if (dst === '#')
      dst = ' two-hour DST';
    else if (dst === '^')
      dst = ' half-hour DST';
    else if (dst === '\u2744')
      dst = ' negative DST';
    else if (dst === '~')
      dst = ' non-standard DST';
  }

  return `UTC${off}${dst}`;
}

function toDisplayZone(zone: string): string {
  return zone?.replace(/_/g, ' ');
}

@Component({
  selector: 'svc-zone-selector',
  templateUrl: './svc-zone-selector.component.html',
  styleUrls: ['./svc-zone-selector.component.scss'],
  providers: [SVC_ZONE_SELECTOR_VALUE_ACCESSOR],
})
export class SvcZoneSelectorComponent implements ControlValueAccessor, OnInit {
  regions: string[] = [UT_OPTION];
  subzones: string[] = [UT];
  offsets: string[] = [];
  zones: string[] = [];

  private _offset: string;
  private _region: string = this.regions[0];
  private _selectByOffset = true;
  private _subzone: string = this.subzones[0];
  private _value: string = UT;
  private _zone: string;

  private focusCount = 0;
  private hasFocus = false;
  private knownIanaZones = new Set<string>();
  private lastSubzones: Record<string, string> = {};
  private lastZones: Record<string, string> = {};
  private offsetByZone = new Map<string, string>();
  private onChangeCallback: (_: any) => void = noop;
  private onTouchedCallback: () => void = noop;
  private subzonesByRegion: Record<string, string[]> = {};
  private zonesByOffset = new Map<string, string[]>();

  disabled = false;
  error: string;

  @Output() focus: EventEmitter<any> = new EventEmitter();
  @Output() blur: EventEmitter<any> = new EventEmitter();

  constructor(private app: AppService, private ref: ChangeDetectorRef) {
    this.lastSubzones[this._region] = this._subzone;
    this.subzonesByRegion[this._region] = this.subzones;
  }

  get value(): string | null {
    if (!this._region || this._subzone == null)
      return null;
    else if (this._region === MISC_OPTION || this._region === UT_OPTION)
      return this._subzone;
    else if (this._region === LMT_OPTION)
      return LMT;
    else if (this._region === OS_OPTION)
      return OS;
    else if (this._subzone.startsWith('UT'))
      return null;

    return toCanonicalZone(this._region + '/' + this._subzone);
  }

  set value(newValue: string) {
    if (this._value !== newValue) {
      this._value = newValue;
      this.updateValue(newValue);
      this.onChangeCallback(newValue);
    }
  }

  private updateValue(newZone: string): void {
    if (newZone === null) {
      this._region = this._subzone = this._value = null;
      this._offset = this._zone = null;

      return;
    }

    const groups: string[] = /^(America\/Argentina\/|America\/Indiana\/|SystemV\/\w+|\w+\/|[-+:\dA-Za-z]+)(.+)?$/.exec(newZone);

    if (groups) {
      let g1 = groups[1];
      let g2 = groups[2];

      if (!this.knownIanaZones.has(newZone) && g1 !== LMT && g1 !== OS && !g1.startsWith(UT)) {
        g1 = OS;
        g2 = undefined;
      }

      if (g1.endsWith('/'))
        g1 = groups[1].slice(0, -1);

      if (g2 === undefined) {
        if (g1.startsWith(UT)) {
          this.setRegion(UT_OPTION);
          this.subzone = g1;
        }
        else if (g1 === LMT) {
          this.setRegion(LMT_OPTION);
          this.subzone = '';
        }
        else if (g1 === OS) {
          this.setRegion(OS_OPTION);
          this.subzone = '';
        }
        else {
          this.setRegion(MISC_OPTION);
          this.subzone = g1;
        }
      }
      else {
        this.setRegion(g1);
        this.subzone = toDisplayZone(g2);
      }
    }
    else {
      this.setRegion(UT_OPTION);
      this.subzone = UT;
    }

    this.updateOffsetAndZoneForValue(newZone);
  }

  private updateOffsetAndZoneForValue(newZone: string): void {
    if (!newZone)
      return;

    const offset = toDisplayOffset(this.offsetByZone.get(newZone));

    if (offset) {
      this.setOffset(offset);
      this.zone = toDisplayZone(newZone);
      this.lastZones[offset] = this._zone;
    }
    else {
      this.setOffset('UTC+00:00');
      this._zone = this.zones[0];
      this.selectByOffset = false;
    }
  }

  onDropdownFocus(event: any): void {
    this.hasFocus = true;

    if (this.focusCount++ === 0)
      this.focus.emit(event);
  }

  onDropdownBlur(event: any): void {
    this.hasFocus = false;
    // If focus is lost and hasn't come back to a different selection on the next event cycle, assume
    // the selector as a whole has lost focus.
    timer().subscribe(() => {
      --this.focusCount;

      if (!this.hasFocus) {
        this.onTouchedCallback();
        this.blur.emit(event);
      }
    });
  }

  writeValue(newZone: any): void {
    if (this._value !== newZone)
      this.updateValue(newZone);
  }

  registerOnChange(fn: any): void {
    this.onChangeCallback = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouchedCallback = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  get selectByOffset(): boolean { return this._selectByOffset; };
  set selectByOffset(newValue: boolean) {
    if (this._selectByOffset !== newValue) {
      this._selectByOffset = newValue;

      if (newValue && this._value !== toCanonicalZone(this._zone))
        this.value = toCanonicalZone(this._zone);
    }
  }

  get offset(): string { return this._offset; }
  set offset(newOffset: string) { this.setOffset(newOffset, true); }

  get region(): string { return this._region; }
  set region(newRegion: string) { this.setRegion(newRegion, true); }

  get subzone(): string { return this._subzone; }
  set subzone(newZone: string) {
    if (!newZone)
      return;

    if (this._subzone !== newZone) {
      this._subzone = newZone;
      this.lastSubzones[this._region] = newZone;
      this._value = this.value;
      this.updateOffsetAndZoneForValue(this._value);
      this.onChangeCallback(this._value);
    }
  }

  get zone(): string { return this._zone; }
  set zone(newZone: string) {
    if (!newZone)
      return;

    if (this._zone !== newZone) {
      this._zone = newZone;
      this.lastZones[this._offset] = newZone;
      this.value = toCanonicalZone(newZone);
    }
  }

  ngOnInit(): void {
    this.updateTimezones();

    this.app.getAppEventUpdates(evt => {
      if (evt.name === IANA_DB_UPDATE)
        this.updateTimezones();
    });
  }

  private updateTimezones(): void {
    const rAndS = Timezone.getRegionsAndSubzones();

    this.knownIanaZones.clear();

    for (const region of rAndS) {
      region.subzones.forEach((subzone: string) => {
        const zone = (region.region === MISC ? '' : region.region + '/') + toCanonicalZone(subzone);
        this.knownIanaZones.add(zone);
      });
    }

    this.app.setKnownIanaTimezones(this.knownIanaZones);

    const hourOffsets: string[] = [];

    for (let h = -12; h <= 14; ++h) {
      const habs = Math.abs(h);

      hourOffsets.push('UT' + (h === 0 ? '' : (h > 0 ? '+' : '-') + (habs < 10 ? '0' : '') + habs + ':00'));
    }

    rAndS.push({ region: UT_OPTION,  subzones: hourOffsets });
    rAndS.push({ region: OS_OPTION,  subzones: [] });
    rAndS.push({ region: LMT_OPTION, subzones: [] });

    rAndS.forEach((region: RegionAndSubzones) => {
      if (region.region === MISC)
        region.region = MISC_OPTION;

      const forDisplay = region.subzones.map(zone => toDisplayZone(zone));

      this.subzonesByRegion[region.region] = forDisplay;

      if (region.region === this._region)
        this.subzones = forDisplay;
    });

    this.regions = rAndS.map((region: RegionAndSubzones) => region.region);
    this.offsets = [];
    this.offsetByZone.clear();
    this.zonesByOffset.clear();

    const oAndZ = Timezone.getOffsetsAndZones();

    for (const offset of oAndZ) {
      this.offsets.push(toDisplayOffset(offset.offset));
      this.zonesByOffset.set(offset.offset, offset.zones.map(zone => toDisplayZone(zone)));

      for (const zone of offset.zones)
        this.offsetByZone.set(toCanonicalZone(zone), offset.offset);
    }

    this.ref.detectChanges();
  }

  private setOffset(newOffset: string, doChangeCallback?: boolean): void {
    if (this._offset !== newOffset) {
      this._offset = newOffset;
      this._zone = '';

      const zones = this.zonesByOffset.get(toCanonicalOffset(newOffset));

      if (zones)
        this.zones = zones;
      else
        this.zones = [];

      if (doChangeCallback) {
        const lastZone = this.lastZones[newOffset];

        if (lastZone)
          this._zone = lastZone;
        else if (this.zones.length > 0) {
          this._zone = this.zones[0];
          this.lastZones[newOffset] = this._zone;
        }

        if (this.zones.length > 0 && this.zone) {
          this._value = toCanonicalZone(this._zone);
          this.updateValue(this._value);
        }

        this.onChangeCallback(this._value);
      }
      else
        this._zone = toDisplayZone(this._value);
    }
  }

  private setRegion(newRegion: string, doChangeCallback?: boolean): void {
    if (this._region !== newRegion) {
      this._region = newRegion;
      this._subzone = '';

      const subzones = this.subzonesByRegion[newRegion];

      if (subzones)
        this.subzones = subzones;
      else
        this.subzones = [];

      const lastSubzone = this.lastSubzones[newRegion];

      if (lastSubzone)
        this._subzone = lastSubzone;
      else if (this.subzones.length > 0) {
        this._subzone = this.subzones[0];
        this.lastSubzones[newRegion] = this._subzone;
      }

      if (this.subzones.length > 0 && this.subzone)
        this._value = this.value;
      else if (newRegion === LMT_OPTION)
        this._value = LMT;
      else if (this._region === OS_OPTION)
        this._value = OS;

      if (doChangeCallback)
        this.onChangeCallback(this._value);

      if (!this._region)
        setTimeout(() => {
          if (this._value)
            this.updateValue(this._value);
        }, 250);
    }
  }
}
