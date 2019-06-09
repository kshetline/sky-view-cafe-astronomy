/*
  Copyright © 2017 Kerry Shetline, kerry@shetline.com.

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

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AppService, Location } from '../../app.service';
import { formatLatitude, formatLongitude } from '../svc-util';
import { mod, floor } from 'ks-math';

@Component({
  selector: 'svc-change-location-dialog',
  templateUrl: './svc-change-location-dialog.component.html',
  styleUrls: ['./svc-change-location-dialog.component.scss']
})
export class SvcChangeLocationDialogComponent {
  private _visible = false;
  private _latitude: number;
  private _longitude: number;
  private _timezone;
  private hourOffset: number;

  formattedLatitude: string;
  formattedLongitude: string;
  formattedHourOffset: string;
  zoneChoice = '0';
  currentZone;

  @Input() get visible(): boolean { return this._visible; }
  set visible(isVisible: boolean) {
    if (this._visible !== isVisible) {
      this._visible = isVisible;
      this.visibleChange.emit(isVisible);
    }
  }
  @Output() visibleChange: EventEmitter<any> = new EventEmitter();

  @Input() get latitude(): number { return this._latitude; }
  set latitude(value: number) {
    if (this._latitude !== value) {
      this._latitude = value;
      this.formattedLatitude = formatLatitude(value);
    }
  }
  @Output() latitudeChange: EventEmitter<any> = new EventEmitter();

  @Input() get longitude(): number { return this._longitude; }
  set longitude(value: number) {
    if (this._longitude !== value) {
      this._longitude = value;
      this.formattedLongitude = formatLongitude(value);
      const h = SvcChangeLocationDialogComponent.longitudeToHourOffset(value);
      this.hourOffset = h;
      this.formattedHourOffset = 'UT';

      if (h < 0)
        this.formattedHourOffset += '-' + (h < -9 ? '' : '0') + (-h) + ':00';
      else if (h > 0)
        this.formattedHourOffset += '+' + (h >  9 ? '' : '0') +   h  + ':00';
    }
  }
  @Output() longitudeChange: EventEmitter<any> = new EventEmitter();

  @Input() get timezone(): string { return this._timezone; }
  set timezone(value: string) {
    if (this._timezone !== value) {
      this._timezone = value;
      this.updateZoneChoice();
    }
  }
  @Output() timezoneChange: EventEmitter<any> = new EventEmitter();

  constructor(private appService: AppService) {
    appService.getLocationUpdates((observer: Location) => {
      this.currentZone = observer.zone;
      this.updateZoneChoice();
    });

    this.currentZone = appService.timeZone;
    this.updateZoneChoice();
  }

  private updateZoneChoice(): void {
    if (this._timezone && this._timezone !== this.currentZone)
      this.zoneChoice = '1';
    else
      this.zoneChoice = '0';
  }

  onKey(event: KeyboardEvent): void {
    if (event.keyCode === 13)
      this.goToLocation();
  }

  goToLocation(): void {
    this.visible = false;

    let newZone;

    switch (this.zoneChoice) {
      case '1': newZone = this.timezone; break;
      case '2': newZone = this.formattedHourOffset; break;
      case '3': newZone = 'UT'; break;
      default:  newZone = this.currentZone;
    }

    this.appService.location = new Location('(new location)', this.latitude, this.longitude, newZone);
  }

  private static longitudeToHourOffset(lon: number): number {
    let hour = floor(mod((lon + 7.5) / 15, 24));

    if (mod(lon, 360) >= 180 && hour > 11)
      hour -= 24;

    return hour;
  }
}
