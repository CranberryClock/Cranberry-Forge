import {
  Tempo,
  type AbilityDefinition,
  type TempoEvent,
  type TempoSnapshot,
  type UseResult,
} from "../dist/packages/tempo/index.js";

const definitions: AbilityDefinition[] = [
  { id: "dash", charges: 3, recharge: 2, cooldown: 0.1 },
];
const tempo = new Tempo(definitions, { globalCooldown: 0.4 });
const result: UseResult = tempo.tryUse("dash");
if (result.ok) {
  const at: number = result.at;
  void at;
} else {
  const delay: number = result.retryAfter;
  void delay;
}
const events: TempoEvent[] = tempo.tick(1 / 60);
for (const event of events)
  if (event.type === "recharged") {
    const charges: number = event.charges;
    void charges;
  }
const snapshot: TempoSnapshot = tempo.toSnapshot();
const restored: Tempo = Tempo.fromSnapshot(snapshot);
restored.restore(JSON.stringify(snapshot));
const ready: boolean = restored.inspect("dash").ready;
const maxCharges: number = tempo.definitions[0].charges;
void ready;
void maxCharges;
// @ts-expect-error cooldown seconds must be numeric
new Tempo([{ id: "bad", recharge: 1, cooldown: "2" }]);
// @ts-expect-error tick requires explicit seconds
tempo.tick();
// @ts-expect-error only the declared global cooldown option is accepted
new Tempo(definitions, { paused: true });
