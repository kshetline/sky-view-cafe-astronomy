import { Component, ViewChild } from '@angular/core';
import { clone, find } from 'lodash-es';
import { ConfirmationService } from 'primeng/api';
import { AppService, Location, NEW_LOCATION } from '../../app.service';
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

  @ViewChild('saveNameDropdown', { static: true }) private saveNameDropdown: KsDropdownComponent;
  @ViewChild('deleteNameDropdown', { static: true }) private deleteNameDropdown: KsDropdownComponent;

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

  get zone(): string { return this.app.timezone; }
  set zone(newZone: string) {
    if (this.app.timezone !== newZone) {
      this.app.timezone = newZone;
    }
  }

  get locationName(): string { return this.app.location.name; }
  set locationName(newName: string) {
    const newLocation = find(this.app.locations, { name: newName });

    if (newLocation)
      this.app.location = newLocation;
  }

  openSaveDialog(): void {
    this.showSaveDialog = true;
    this.saveDialogNames = clone(this.savedLocationNames);
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
    this.deleteDialogNames = clone(this.savedLocationNames);
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

    if (find(this.app.locations, { name: this.selectedName })) {
      this.confirmationService.confirm({
        key: 'save-confirm',
        message: `Are you sure you want to replace the existing "${this.selectedName}"?`,
        accept: () => this.completeSave()
      });
    }
    else
      this.completeSave();
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
    this.app.addLocation(new Location(this.selectedName.trim(), this.app.latitude, this.app.longitude, this.app.timezone,
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
