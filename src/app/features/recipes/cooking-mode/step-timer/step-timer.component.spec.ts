import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { StepTimerComponent } from './step-timer.component';

describe('StepTimerComponent', () => {
  let component: StepTimerComponent;
  let fixture: ComponentFixture<StepTimerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepTimerComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(StepTimerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('durationMinutes', 1);
    fixture.detectChanges();
  });

  it('starts with full duration', () => {
    expect(component.remainingSeconds()).toBe(60);
  });

  it('counts down when running', fakeAsync(() => {
    component.start();
    tick(3000);
    expect(component.remainingSeconds()).toBe(57);
    component.stop();
  }));

  it('emits done when countdown reaches zero', fakeAsync(() => {
    const doneSpy = jest.fn();
    component.done.subscribe(doneSpy);
    component.start();
    tick(60000);
    expect(doneSpy).toHaveBeenCalled();
    component.stop();
  }));
});
