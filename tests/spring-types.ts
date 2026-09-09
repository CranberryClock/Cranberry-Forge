import {
  Spring,
  VectorSpring,
  stepSpring,
  type Vec3,
  type SpringState,
} from "../dist/packages/spring/index.js";
const spring = new Spring({
  value: 0,
  target: 1,
  frequency: 2,
  dampingRatio: 0.5,
});
const value: number = spring
  .impulse(2)
  .setTarget(3)
  .configure({ dampingRatio: 1 })
  .step(0.1);
const state: SpringState = stepSpring(spring.state, 0.1, spring.options);
spring.snap().reset();
const position: Vec3 = [0, 1, 2];
const vector = new VectorSpring({ value: position });
const moved: [number, number, number] = vector
  .setTarget([1, 2, 3])
  .impulse([0, 2, 0])
  .step(0.1);
vector.snap().configure({ frequency: 3 }).reset();
void [value, state, moved];
// @ts-expect-error spring state is scalar
spring.setTarget([1, 2, 3]);
// @ts-expect-error XYZ requires three components
vector.setTarget([1, 2]);
// @ts-expect-error value is read-only
spring.value = 3;
// @ts-expect-error unknown configuration
new Spring({ stiffness: 10 });
