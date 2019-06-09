/*
  Copyright © 2017-2019 Kerry Shetline, kerry@shetline.com.

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

import { SelectItem } from 'primeng/components/common/api';
import { AppService } from '../app.service';
import { ADDITIONALS, PROPERTY_ADDITIONALS } from './generic-view';
import { SolarSystem } from 'ks-astronomy';
import { clone } from 'lodash';

export class SvcGenericOptionsComponent {
  private _additional: ADDITIONALS | string = ADDITIONALS.NONE;

  asteroidsReady = false;

  additionals: SelectItem[] = [
    {label: 'No asteroids or comets', value: ADDITIONALS.NONE},
    {label: 'All asteroids', value: ADDITIONALS.ALL_ASTEROIDS},
    {label: 'All comets', value: ADDITIONALS.ALL_COMETS},
    {label: 'All asteroids and comets', value: ADDITIONALS.ALL}
  ];

  constructor(protected appService: AppService, protected viewName) {
    this.asteroidsReady = appService.asteroidsReady;

    if (!this.asteroidsReady) {
      appService.getAsteroidsReadyUpdate((initialized) => {
        this.asteroidsReady = initialized;

        if (initialized)
          this.updateAdditionals();
      });
    }
    else
      this.updateAdditionals();
  }

  private updateAdditionals(): void {
    const names = SolarSystem.getAsteroidAndCometNames(true);

    names.forEach(name => {
      let value = name;
      const matches = /[^:]+: (.+)/.exec(name);

      if (matches)
        value = matches[1];

      this.additionals.push({label: name, value: value});
    });

    // Force menu update.
    this.additionals = clone(this.additionals);
  }

  get additional(): ADDITIONALS | string { return this._additional; }
  set additional(value: ADDITIONALS | string) {
    if (this._additional !== value) {
      this._additional = value;
      this.appService.updateUserSetting({view: this.viewName, property: PROPERTY_ADDITIONALS, value: value, source: this});
    }
  }
}
