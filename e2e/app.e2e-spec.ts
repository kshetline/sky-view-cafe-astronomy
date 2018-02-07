import { AppPage } from './app.po';

describe('svc-ng App', () => {
  let page: AppPage;

  beforeEach(() => {
    page = new AppPage();
  });

  it('should be able to navigate to the main page', () => {
    page.navigateTo();
  });
});
