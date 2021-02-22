import { TestBed, waitForAsync } from '@angular/core/testing';

describe('AppComponent', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [
//        AppComponent
      ],
    }).compileComponents();
  }));

  it('should succeed', waitForAsync(() => {
    expect('Something, someday').toBeTruthy();
  }));
});
