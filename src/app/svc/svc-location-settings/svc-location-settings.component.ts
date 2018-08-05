/*
  Copyright © 2017-2018 Kerry Shetline, kerry@shetline.com.

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

import { Component, ViewChild } from '@angular/core';
import { AppService, Location, NEW_LOCATION } from '../../app.service';
import * as _ from 'lodash';
import { ConfirmationService } from 'primeng/components/common/api';
import { KsDropdownComponent } from '../../widgets/ks-dropdown/ks-dropdown.component';

const SELECT_A_LOCATION = 'Select a location';

@Component({
  selector: 'svc-location-settings',
  templateUrl: './svc-location-settings.component.html',
  styleUrls: ['./svc-location-settings.component.scss'],
  providers: [ConfirmationService]
})
export class SvcLocationSettingsComponent {
  locationNames: string[] = [];
  savedLocationNames: string[] = [];
  selectedName = '';
  showSaveDialog = false;
  showDeleteDialog = false;
  showFindDialog = false;
  saveDialogNames: string[] = [];
  deleteDialogNames: string[] = [];
  makeDefault = false;
  mapsReady = false;

  @ViewChild('saveNameDropdown') private saveNameDropdown: KsDropdownComponent;
  @ViewChild('deleteNameDropdown') private deleteNameDropdown: KsDropdownComponent;

  constructor(private app: AppService, private confirmationService: ConfirmationService) {
    app.getLocationUpdates(() => this.buildLocationMenu());
    this.buildLocationMenu();

    if ((<any> window).mapsInitialized)
      this.mapsReady = true;
    else
      (<any> window).initGoogleMaps(() => this.mapsReady = true);
  }

  get latitude(): number { return this.app.latitude; }
  set latitude(newLatitude: number) {
    if (this.app.latitude !== newLatitude)
      this.app.latitude = newLatitude;
  }

  get longitude(): number { return this.app.longitude; }
  set longitude(newLongitude: number) {
    if (this.app.longitude !== newLongitude)
      this.app.longitude = newLongitude;
  }

  get zone(): string { return this.app.timeZone; }
  set zone(newZone: string) {
    if (this.app.timeZone !== newZone) {
      this.app.timeZone = newZone;
    }
  }

  get locationName(): string { return this.app.location.name; }
  set locationName(newName: string) {
    const newLocation = _.find(this.app.locations, {name: newName});

    if (newLocation)
      this.app.location = newLocation;
  }

  openSaveDialog(): void {
    this.showSaveDialog = true;
    this.saveDialogNames = _.clone(this.savedLocationNames);
    this.selectedName = '';
    this.makeDefault = false;

    if (this.app.location.name !== NEW_LOCATION) {
      const matches = /\((.*)\)/.exec(this.app.location.name);

      if (matches) {
        this.selectedName = matches[1];
        this.saveDialogNames.splice(0, 0, this.selectedName);
      }
    }

    setTimeout(() => this.saveNameDropdown.applyFocus());
  }

  openDeleteDialog(): void {
    this.showDeleteDialog = true;
    this.deleteDialogNames = _.clone(this.savedLocationNames);
    this.deleteDialogNames.splice(0, 0, SELECT_A_LOCATION);
    this.selectedName = SELECT_A_LOCATION;

    setTimeout(() => this.deleteNameDropdown.applyFocus());
  }

  openFindDialog(): void {
    this.showFindDialog = true;
  }

  doSave(): void {
    const matches = /\((.*)\)/.exec(this.selectedName);

    if (matches)
      this.selectedName = matches[1];

    if (_.find(this.app.locations, {name: this.selectedName })) {
      this.confirmationService.confirm({
        key: 'save-confirm',
        message: `Are you sure you want to replace the existing "${this.selectedName}"?`,
        accept: () => this.completeSave()
      });

      this.fixConfirmationDialog();
    }
    else
      this.completeSave();
  }

  // TODO: Hack alert! What appears to be a PrimeNG bug is causing the confirmation dialog to get
  // stuck behind a new dialog mask, instead of being placed on top of it. The result is the whole
  // display being locked up, grayed-out and unclickable. The code below is a less-than-perfect,
  // but workable temporary solution.
  private fixConfirmationDialog(): void {
    setTimeout(() => {
      const masks = document.getElementsByClassName('ui-dialog-mask');

      if (masks && masks.length > 0)
        (masks[masks.length - 1] as HTMLElement).style.zIndex = 'auto';
    });
  }

  doDelete(): void {
    if (this.selectedName !== SELECT_A_LOCATION) {
      this.showDeleteDialog = false;
      this.app.deleteLocation(this.selectedName);
      this.buildLocationMenu();
    }
  }

  private completeSave(): void {
    this.showSaveDialog = false;
    this.app.addLocation(new Location(this.selectedName.trim(), this.app.latitude, this.app.longitude, this.app.timeZone,
                                      this.makeDefault));
    this.locationName = this.selectedName;
    this.buildLocationMenu();
  }

  private buildLocationMenu(): void {
    this.locationNames = [];
    this.savedLocationNames = [];

    if (this.app.location.name.startsWith('('))
      this.locationNames.push(this.app.location.name);

    this.app.locations.forEach((location: Location) => {
      this.locationNames.push(location.name);
      this.savedLocationNames.push(location.name);
    });
  }
}
