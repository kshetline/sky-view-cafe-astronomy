import { browser, promise } from 'protractor';

export class AppPage {
  navigateTo(): promise.Promise<any> {
    return browser.get('/');
  }
}
