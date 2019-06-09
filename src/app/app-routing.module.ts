import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SvcCalendarViewComponent } from './svc/svc-calendar-view/svc-calendar-view.component';
import { SvcEclipticViewComponent } from './svc/svc-ecliptic-view/svc-ecliptic-view.component';
import { SvcInsolationViewComponent } from './svc/svc-insolation-view/svc-insolation-view.component';
import { SvcMapViewComponent } from './svc/svc-map-view/svc-map-view.component';
import { SvcMoonsViewComponent } from './svc/svc-moons-view/svc-moons-view.component';
import { SvcOrbitViewComponent } from './svc/svc-orbit-view/svc-orbit-view.component';
import { SvcSkyViewComponent } from './svc/svc-sky-view/svc-sky-view.component';
import { SvcTableViewComponent } from './svc/svc-table-view/svc-table-view.component';
import { SvcTimeViewComponent } from './svc/svc-time-view/svc-time-view.component';

@NgModule({
  imports: [
    RouterModule.forRoot([
      {path: '', component: SvcSkyViewComponent},
      {path: 'sky', component: SvcSkyViewComponent},
      {path: 'ecliptic', component: SvcEclipticViewComponent},
      {path: 'orbits', component: SvcOrbitViewComponent},
      {path: 'moons', component: SvcMoonsViewComponent},
      {path: 'insolation', component: SvcInsolationViewComponent},
      {path: 'map', component: SvcMapViewComponent},
      {path: 'calendar', component: SvcCalendarViewComponent},
      {path: 'time', component: SvcTimeViewComponent},
      {path: 'tables', component: SvcTableViewComponent},
      {path: '**', component: SvcSkyViewComponent},
    ], {useHash: true}),
  ],
  exports: [
    RouterModule,
  ]
})
export class AppRoutingModule {}
