import { Component } from '@angular/core';
import { AppService, CurrentTab } from '../../app.service';

@Component({
  selector: 'svc-options-panel',
  templateUrl: './svc-options-panel.component.html',
  styleUrls: ['./svc-options-panel.component.scss']
})
export class SvcOptionsPanelComponent {
  currentTab = CurrentTab.SKY;

  constructor(app: AppService) {
    app.getCurrentTabUpdates((tabIndex: CurrentTab) => {
      this.currentTab = tabIndex;
    });
  }
}
