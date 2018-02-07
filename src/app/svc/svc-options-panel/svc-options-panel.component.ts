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

import { Component } from '@angular/core';
import { AppService, CurrentTab } from '../../app.service';

@Component({
  selector: 'svc-options-panel',
  templateUrl: './svc-options-panel.component.html',
  styleUrls: ['./svc-options-panel.component.scss']
})
export class SvcOptionsPanelComponent {
  currentTab = CurrentTab.SKY;

  constructor(private app: AppService) {
    app.getCurrentTabUpdates((tabIndex: CurrentTab) => {
      this.currentTab = tabIndex;
    });
  }
}
