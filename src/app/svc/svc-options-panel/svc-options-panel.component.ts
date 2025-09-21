import { Component } from '@angular/core';
import { AppService, CurrentTab } from '../../app.service';
import { NgIf } from '@angular/common';
import { SvcSkyViewOptionsComponent } from '../svc-sky-view/svc-sky-view-options.component';
import { SvcEclipticViewOptionsComponent } from '../svc-ecliptic-view/svc-ecliptic-view-options.component';
import { SvcOrbitViewOptionsComponent } from '../svc-orbit-view/svc-orbit-view-options.component';
import { SvcMoonsViewOptionsComponent } from '../svc-moons-view/svc-moons-view-options.component';
import { SvcInsolationViewOptionsComponent } from '../svc-insolation-view/svc-insolation-view-options.component';
import { SvcMapViewOptionsComponent } from '../svc-map-view/svc-map-view-options.component';
import { SvcCalendarViewOptionsComponent } from '../svc-calendar-view/svc-calendar-view-options.component';
import { SvcTableViewOptionsComponent } from '../svc-table-view/svc-table-view-options.component';

@Component({
  selector: 'svc-options-panel',
  templateUrl: './svc-options-panel.component.html',
  styleUrls: ['./svc-options-panel.component.scss'],
  imports: [NgIf, SvcCalendarViewOptionsComponent, SvcEclipticViewOptionsComponent, SvcInsolationViewOptionsComponent,
            SvcMapViewOptionsComponent, SvcMoonsViewOptionsComponent, SvcOrbitViewOptionsComponent,
            SvcSkyViewOptionsComponent, SvcTableViewOptionsComponent]
})
export class SvcOptionsPanelComponent {
  currentTab = CurrentTab.SKY;

  constructor(app: AppService) {
    app.getCurrentTabUpdates((tabIndex: CurrentTab) => {
      this.currentTab = tabIndex;
    });
  }
}
