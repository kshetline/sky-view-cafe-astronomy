import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
// noinspection ES6UnusedImports
import { } from 'googlemaps'; // Produces "unused import" warning, but is actually needed, and `import 'googlemaps'` won't do.
import { Timezone } from '@tubular/time';
import { eventToKey, isIOS, processMillis } from '@tubular/util';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { AppService, Location } from '../../app.service';
import { AtlasLocation, AtlasResults, SvcAtlasService } from '../svc-atlas.service';
import { formatLatitude, formatLongitude } from '../svc-util';

interface LocationInfo {
  rank: number;
  flagCode: string;
  name: string;
  lat: string;
  lon: string;
  zone: string;
  zoneInfo: string;
  atlasLocation: AtlasLocation;
}

@Component({
  selector: 'svc-atlas-dialog',
  templateUrl: './svc-atlas-dialog.component.html',
  styleUrls: ['./svc-atlas-dialog.component.scss'],
  providers: [MessageService]
})
export class SvcAtlasDialogComponent {
  private _extended: boolean;
  private _visible = false;
  private _selection: LocationInfo;
  private _state = '';
  private searchId = 0;
  private searchInFocus = false;
  private map: google.maps.Map;
  private marker: google.maps.Marker;

  locations: LocationInfo[] = [];
  city = '';
  emptyMessage = '';
  searching = false;
  becomingVisible = false;
  states = [''];
  maskDisplay = 'visible';
  busy = false;
  busyStart = 0;
  busyTimer: any;

  @ViewChild('searchField', { static: true }) private searchField: ElementRef;
  @ViewChild('atlasMap', { static: true }) private atlasMap: ElementRef;
  @ViewChild('locationTable', { static: true }) private locationTable: Table;

  @Input() get extended(): boolean { return this._extended; }
  set extended(isExtended: boolean) {
    if (this._extended !== isExtended) {
      this._extended = isExtended;
      this.extendedChange.emit(isExtended);
    }
  }

  @Output() extendedChange: EventEmitter<any> = new EventEmitter();

  @Input() get visible(): boolean { return this._visible; }
  set visible(isVisible: boolean) {
    if (this._visible !== isVisible) {
      this._visible = isVisible;
      this.visibleChange.emit(isVisible);

      if (isVisible) {
        this.atlasService.ping();
        // Reset state of dialog before showing it again.
        this._selection = null;
        this.city = '';
        this.state = '';
        this.extended = false;
        this.locations = [];
        this.obscureMap();
        this.emptyMessage = '';
        ++this.searchId;
        this.searching = false;
        this.becomingVisible = true; // Hack for Chrome to trigger re-layout of search fields.
        this.busy = null;

        // Put focus on the search field.
        setTimeout(() => {
          (this.searchField.nativeElement as HTMLInputElement).focus();
          this.becomingVisible = false;
        }, 250);
      }
    }
  }

  @Output() visibleChange: EventEmitter<any> = new EventEmitter();

  @Input() get selection(): LocationInfo { return this._selection; }
  set selection(newSelection: LocationInfo) {
    if (this._selection !== newSelection) {
      this._selection = newSelection;
      this.selectionChange.emit(newSelection);
      this.showMap();
    }
  }

  @Output() selectionChange: EventEmitter<any> = new EventEmitter();

  @Input() get state(): string { return this._state; }
  set state(newState: string) {
    if (this._state !== newState) {
      const state = (newState && (newState === '\xA0' || newState.includes('---')) ? '' : newState);
      this._state = state;

      if (state !== newState)
        setTimeout(() => (document.querySelector('#state-select input.p-inputtext') as HTMLInputElement).value = state);

      this.stateChange.emit(this._state);
    }
  }

  @Output() stateChange: EventEmitter<any> = new EventEmitter();

  private static stripNameQualifiers(name: string): string {
    while (true) {
      let left: number;

      left = name.indexOf(' (');

      if (left < 0)
        left = name.indexOf('(');

      if (left < 0)
        break;

      const right = name.indexOf(')', left + 1);

      if (right > 0)
        name = name.substring(0, left) + name.substring(right + 1);
      else
        break;
    }

    return name;
  }

  constructor(private appService: AppService, private atlasService: SvcAtlasService,
              private messageService: MessageService) {
    atlasService.getStates()
      .then((states: string[]) => {
        this.states = states;

        if (this.states[0] === '')
          this.states[0] = '\xA0';
      })
      .catch(() => this.states = ['']);
  }

  onKey(event: KeyboardEvent): void {
    if (eventToKey(event) === 'Enter' && !this.searching) {
      if ((this.searchInFocus || document.activeElement.tagName === 'INPUT') && this.city)
        this.search();
      else if (this.selection)
        this.setLocation();
    }
  }

  onDoubleClick(): void {
    if (this._selection)
      this.setLocation();
  }

  searchFocus(inFocus: boolean): void {
    this.searchInFocus = inFocus;
  }

  search(): void {
    if (!this.city)
      return;

    let query = this.city;

    if (this.state) {
      const groups = /.* - (.+)/.exec(this.state);

      if (groups)
        query += ', ' + groups[1];
      else
        query += ', ' + this.state;
    }

    this.locations = [];
    this.emptyMessage = 'Searching...';
    this.searching = true;
    this.obscureMap();

    const searchWithID = (id: number): void => {
      this.busyTimer = setTimeout(() => {
        this.busyTimer = undefined;
        this.busy = true;
        this.busyStart = processMillis();
      }, 500);

      this.atlasService.search(query, this._extended).then((results: AtlasResults) => {
        if (this.searchId !== id) // Bail out if this is an old, abandoned search.
          return;

        this.atlasService.ping();
        this.emptyMessage = (!results.matches || results.matches.length === 0 ? 'No matches' : '');
        this.searching = false;

        if (results.error)
          this.messageService.add({ key: 'general', severity: 'error', detail: results.error });
        else if (results.warning)
          this.messageService.add({ key: 'general', severity: 'warn', detail: results.warning });

        this.locations = results.matches.map((location: AtlasLocation): LocationInfo => {
          return {
            rank: location.rank,
            flagCode: location.flagCode || 'blank',
            name: location.displayName,
            lat: formatLatitude(location.latitude),
            lon: formatLongitude(location.longitude),
            zone: location.zone,
            zoneInfo: 'UT' + Timezone.formatUtcOffset(location.zoneOffset * 60) +
                      Timezone.getDstSymbol(location.zoneDst * 60),
            atlasLocation: location
          };
        });

        this.locationTable.first = 0;
      }).catch(() => {
        if (this.searchId !== id) // Bail out if this is an old, abandoned search.
          return;

        this.emptyMessage = '';
        this.messageService.add({ key: 'general', severity: 'error', detail: 'Search failed. Please try again later.' });
        this.searching = false;
      }).finally(() => {
        if (this.busyTimer) {
          clearTimeout(this.busyTimer);
          this.busyTimer = undefined;
        }

        const now = processMillis();

        if (now > this.busyStart + 250)
          this.busy = false;
        else
          setTimeout(() => this.busy = false, 250 - now + this.busyStart);
      });
    };

    searchWithID(this.searchId);
  }

  setLocation(): void {
    const loc = this.selection;

    this.visible = false;
    this.appService.location = new Location('(' + SvcAtlasDialogComponent.stripNameQualifiers(loc.name) + ')',
      loc.atlasLocation.latitude, loc.atlasLocation.longitude, loc.zone);
  }

  // noinspection JSMethodCanBeStatic
  showTooltip(tooltip: string): string {
    if (!isIOS())
      return tooltip;
    else
      return null;
  }

  private showMap(): void {
    if (!this._selection || !this.appService.mapsReady) {
      this.obscureMap();
      return;
    }

    this.atlasService.ping();

    const center = new google.maps.LatLng(this._selection.atlasLocation.latitude, this._selection.atlasLocation.longitude);

    if (!this.map) {
      const mapOptions: google.maps.MapOptions = {
        center,
        zoom: 5,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
        },
        disableDoubleClickZoom: true,
        draggable: false,
        streetViewControl: false,
        fullscreenControl: false,
        rotateControl: false
      };

      this.map = new google.maps.Map(this.atlasMap.nativeElement, mapOptions);
      this.marker = new google.maps.Marker({
        position: center,
        map: this.map,
        opacity: 0.5
      });
    }
    else {
      this.map.setCenter(center);
      this.map.setZoom(5);
      this.marker.setPosition(center);
    }

    this.revealMap();
  }

  private obscureMap(): void {
    this.maskDisplay = 'visible';
  }

  private revealMap(): void {
    this.maskDisplay = 'hidden';
  }
}
