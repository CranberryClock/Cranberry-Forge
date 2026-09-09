import * as THREE from "three";
import { createStage } from "./scene.js";
import { createCampScene } from "./camp-scene.js";
import { $, toast, download } from "./kit-ui.js";

const kit =
  new URLSearchParams(location.search).get("kit") === "chatter"
    ? "chatter"
    : "satchel";
document.querySelector(`[data-kit="${kit}"]`).classList.add("active");
let stage, world, ui;
try {
  stage = createStage($("#kit-canvas"));
  world = createCampScene(stage, { mode: kit });
  stage.setActive(world);
  stage.reset("flux");
  stage.camera.position.set(18, 15, 22);
  stage.controls.target.set(0, 0.8, 0);
  stage.controls.minDistance = 16;
  stage.controls.maxDistance = 48;
  stage.controls.autoRotate = false;
  stage.controls.update();
  const module =
    kit === "chatter"
      ? await import("./kits/chatter.js")
      : await import("./kits/satchel.js");
  ui = module.mountKit({ world, stage, panel: $("#kit-panel") });
  let down = null;
  $("#kit-canvas").addEventListener(
    "pointerdown",
    (e) => (down = [e.clientX, e.clientY]),
  );
  $("#kit-canvas").addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5)
      return;
    const rect = e.target.getBoundingClientRect(),
      ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      stage.camera,
    );
    const visible = world.pickables.filter((o) => o.visible),
      hit = ray.intersectObjects(visible, true)[0];
    if (!hit) return;
    let target = hit.object;
    while (target && !target.userData.interaction) target = target.parent;
    if (target) ui.interact(target.userData.interaction, target);
  });
  $("#kit-reset-view").onclick = () => {
    stage.camera.position.set(18, 15, 22);
    stage.controls.target.set(0, 0.8, 0);
    stage.controls.update();
  };
  $("#kit-capture").onclick = () =>
    $("#kit-canvas").toBlob((b) => {
      if (b) download(b, `${kit}-camp.png`);
    }, "image/png");
  $("#kit-guide").onclick = () => {
    $("#kit-docs-content").innerHTML = ui.guide;
    $("#kit-docs").showModal();
  };
  $("#close-kit-docs").onclick = () => $("#kit-docs").close();
  $("#copy-kit-code").onclick = async () => {
    try {
      await navigator.clipboard.writeText($("#kit-code").textContent);
      toast("Integration code copied.");
    } catch {
      toast("Select the code to copy it.");
    }
  };
  addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    ui.dispose?.();
    stage.dispose();
  });
} catch (error) {
  $("#error").textContent =
    `The camp could not start: ${error.message}. A WebGL2-capable browser is required.`;
  $("#error").hidden = false;
  console.error(error);
}
