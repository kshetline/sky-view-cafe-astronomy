import { AfterViewInit, Component } from '@angular/core';
import { SelectItem } from 'primeng/api';
import { AppService, UserSetting } from '../../app.service';
import { PROPERTY_ADDITIONALS } from '../generic-view.directive';
import { SvcGenericOptionsComponent } from '../svc-generic-options.component';
import {
  PROPERTY_ANAGLYPH_3D, PROPERTY_ANAGLYPH_RC, PROPERTY_CENTER_EARTH, PROPERTY_EXTENT, PROPERTY_GRAY_ORBITS, PROPERTY_MARQUEE_UNITS,
  PROPERTY_SHOW_MARKERS, PROPERTY_SHOW_NAMES, PROPERTY_SHOW_PATHS, PROPERTY_ZOOM, VIEW_ORBITS, ZOOM_STEPS
} from './svc-orbit-view.component';

@Component({
  selector: 'svc-orbits-view-options',
  templateUrl: './svc-orbit-view-options.component.html',
  styleUrls: ['./svc-orbit-view-options.component.scss']
})
export class SvcOrbitViewOptionsComponent extends SvcGenericOptionsComponent implements AfterViewInit {
  private _extent = 0;
  private _centerEarth = false;
  private _marqueeUnits = 0;
  private _showPaths = true;
  private _showMarkers = false;
  private _grayOrbits = false;
  private _showNames = true;
  private _reverseZoom = 0;
  private _anaglyph3d = false;
  private _anaglyphRC = true;

  extents: SelectItem[] = [
    { label: 'Full solar system', value: 0 },
    { label: 'Out to Neptune', value: 1 },
    { label: 'Out to Saturn', value: 2 },
    { label: 'Out to Mars', value: 3 }
  ];

  centering: SelectItem[] = [
    { label: 'Center on Sun', value: false },
    { label: 'Center on Earth', value: true }
  ];

  unitsChoices: SelectItem[] = [
    { label: 'Distance in AU', value: 0 },
    { label: 'Distance in km', value: 1 },
    { label: 'Distance in miles', value: 2 }
  ];

  constructor(app: AppService) {
    super(app, VIEW_ORBITS);

    app.getUserSettingUpdates((setting: UserSetting) => {
      if (setting.view === VIEW_ORBITS && setting.source !== this) {
        if (setting.property === PROPERTY_EXTENT)
          this.extent = setting.value as number;
        else if (setting.property === PROPERTY_CENTER_EARTH)
          this.centerEarth = setting.value as boolean;
        else if (setting.property === PROPERTY_MARQUEE_UNITS)
          this.marqueeUnits = setting.value as number;
        else if (setting.property === PROPERTY_SHOW_PATHS)
          this.showPaths = setting.value as boolean;
        else if (setting.property === PROPERTY_SHOW_MARKERS)
          this.showMarkers = setting.value as boolean;
        else if (setting.property === PROPERTY_GRAY_ORBITS)
          this.grayOrbits = setting.value as boolean;
        else if (setting.property === PROPERTY_SHOW_NAMES)
          this.showNames = setting.value as boolean;
        else if (setting.property === PROPERTY_ZOOM)
          this.reverseZoom = ZOOM_STEPS - (setting.value as number);
        else if (setting.property === PROPERTY_ANAGLYPH_3D)
          this.anaglyph3d = setting.value as boolean;
        else if (setting.property === PROPERTY_ANAGLYPH_RC)
          this.anaglyphRC = setting.value as boolean;
        else if (setting.property === PROPERTY_ADDITIONALS)
          this.additional = setting.value as string;
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.app.requestViewSettings(VIEW_ORBITS));
  }

  get extent(): number { return this._extent; }
  set extent(value: number) {
    if (this._extent !== value) {
      this._extent = value;
      this.app.updateUserSetting(VIEW_ORBITS, PROPERTY_EXTENT, value, this);
    }
  }

  get centerEarth(): boolean { return this._centerEarth; }
  set centerEarth(value: boolean) {
    if (this._centerEarth !== value) {
      this._centerEarth = value;
      this.app.updateUserSetting(VIEW_ORBITS, PROPERTY_CENTER_EARTH, value, this);
    }
  }

  get marqueeUnits(): number { return this._marqueeUnits; }
  set marqueeUnits(value: number) {
    if (this._marqueeUnits !== value) {
      this._marqueeUnits = value;
      this.app.updateUserSetting(VIEW_ORBITS, PROPERTY_MARQUEE_UNITS, value, this);
    }
  }

  get showPaths(): boolean { return this._showPaths; }
  set showPaths(value: boolean) {
    if (this._showPaths !== value) {
      this._showPaths = value;
      this.app.updateUserSetting(VIEW_ORBITS, PROPERTY_SHOW_PATHS, value, this);
    }
  }

  get showMarkers(): boolean { return this._showMarkers; }
  set showMarkers(value: boolean) {
    if (this._showMarkers !== value) {
      this._showMarkers = value;
      this.app.updateUserSetting(VIEW_ORBITS, PROPERTY_SHOW_MARKERS, value, this);
    }
  }

  get grayOrbits(): boolean { return this._grayOrbits; }
  set grayOrbits(value: boolean) {
    if (this._grayOrbits !== value) {
      this._grayOrbits = value;
      this.app.updateUserSetting(VIEW_ORBITS, PROPERTY_GRAY_ORBITS, value, this);
    }
  }

  get showNames(): boolean { return this._showNames; }
  set showNames(value: boolean) {
    if (this._showNames !== value) {
      this._showNames = value;
      this.app.updateUserSetting(VIEW_ORBITS, PROPERTY_SHOW_NAMES, value, this);
    }
  }

  get reverseZoom(): number { return this._reverseZoom; }
  set reverseZoom(value: number) {
    if (this._reverseZoom !== value) {
      this._reverseZoom = value;
      this.app.updateUserSetting(VIEW_ORBITS, PROPERTY_ZOOM, ZOOM_STEPS - value, this);
    }
  }

  get anaglyph3d(): boolean { return this._anaglyph3d; }
  set anaglyph3d(value: boolean) {
    if (this._anaglyph3d !== value) {
      this._anaglyph3d = value;
      this.app.updateUserSetting(VIEW_ORBITS, PROPERTY_ANAGLYPH_3D, value, this);
    }
  }

  get anaglyphRC(): boolean { return this._anaglyphRC; }
  set anaglyphRC(value: boolean) {
    if (this._anaglyphRC !== value) {
      this._anaglyphRC = value;
      this.app.updateUserSetting(VIEW_ORBITS, PROPERTY_ANAGLYPH_RC, value, this);
    }
  }

  setAnaglyphRC(value: boolean): void {
    this.anaglyphRC = value;
  }
}
