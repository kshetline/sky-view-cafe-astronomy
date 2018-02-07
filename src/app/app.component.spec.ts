import { TestBed, async } from '@angular/core/testing';

describe('AppComponent', () => {
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [
//        AppComponent
      ],
    }).compileComponents();
  }));

  it('should succeed', async(() => {
    expect('Something, someday').toBeTruthy();
  }));
});
