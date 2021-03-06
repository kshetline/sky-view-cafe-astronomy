import { SolarSystem } from '@tubular/astronomy';
import { clone } from '@tubular/util';
import { SelectItem } from 'primeng/api';
import { AppService } from '../app.service';
import { ADDITIONALS, PROPERTY_ADDITIONALS } from './generic-view.directive';

export class SvcGenericOptionsComponent {
  private _additional: ADDITIONALS | string = ADDITIONALS.NONE;

  asteroidsReady = false;

  additionals: SelectItem[] = [
    { label: 'No asteroids or comets', value: ADDITIONALS.NONE },
    { label: 'All asteroids', value: ADDITIONALS.ALL_ASTEROIDS },
    { label: 'All comets', value: ADDITIONALS.ALL_COMETS },
    { label: 'All asteroids and comets', value: ADDITIONALS.ALL }
  ];

  constructor(protected appService: AppService, protected viewName: string) {
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
    const names = SolarSystem.getAsteroidAndCometNames(true, false);

    names.forEach(name => {
      let value = name;
      const matches = /[^:]+: (.+)/.exec(name);

      if (matches)
        value = matches[1];

      this.additionals.push({ label: name, value: value });
    });

    // Force menu update.
    this.additionals = clone(this.additionals);
  }

  get additional(): ADDITIONALS | string { return this._additional; }
  set additional(value: ADDITIONALS | string) {
    if (this._additional !== value) {
      this._additional = value;
      this.appService.updateUserSetting({ view: this.viewName, property: PROPERTY_ADDITIONALS, value: value, source: this });
    }
  }
}
