import * as THREE from "three";
import { GLTFLoader } from "./node_modules/three/examples/jsm/loaders/GLTFLoader.js";

const container = document.getElementById("app");
const status = document.getElementById("status");
const titleScreen = document.getElementById("title-screen");
const gameScreen = document.getElementById("game-screen");
const resultScreen = document.getElementById("result-screen");
const scenarioTitle = document.getElementById("scenario-title");
const dialogue = document.getElementById("dialogue");
const choices = document.getElementById("choices");
const playBtn = document.getElementById("play-btn");
const restartBtn = document.getElementById("restart-btn");
const resultTitle = document.getElementById("result-title");
const resultSummary = document.getElementById("result-summary");
const panel = document.getElementById("panel");
const quizOverlay = document.getElementById("quiz-overlay");
const quizLeft = document.getElementById("quiz-left");
const quizRightAnchor = document.getElementById("quiz-right-anchor");
const speakerAvatar = document.getElementById("speaker-avatar");
const speakerRole = document.getElementById("speaker-role");
const managerHeadPos = new THREE.Vector3();

function setStatus(text, isError = false) {
  status.textContent = text;
  status.style.color = isError ? "#ffb4b4" : "#e7eefc";
}

function setGameplayUiVisible(visible) {
  status.style.display = visible ? "block" : "none";
}

function hideQuizOverlay() {
  quizOverlay.classList.remove("visible");
  gameScreen.classList.remove("visible");
  hideResponsePanel();
}

function hideResponsePanel() {
  quizLeft?.classList.remove("response-visible");
}

function showResponsePanel() {
  quizLeft?.classList.add("response-visible");
}

function showQuizOverlay() {
  panel.style.display = "block";
  quizOverlay.classList.add("visible");
  gameScreen.classList.remove("visible");
  void gameScreen.offsetWidth;
  gameScreen.classList.add("visible");
  updateDialoguePanelPosition();
}

function hideAllScreens() {
  titleScreen.classList.remove("screen-visible");
  hideQuizOverlay();
  resultScreen.classList.remove("screen-visible");
}

function showScreen(screen) {
  hideAllScreens();
  if (screen === resultScreen) {
    resultScreen.classList.add("screen-visible");
  } else if (screen === titleScreen) {
    titleScreen.classList.add("screen-visible");
  }
}

const speakerConfig = {
  Manager: { avatar: "M", className: "agent", npc: "manager", role: "Manager" },
};

const scenarios = [
  {
    id: "s1",
    factor: "Openness",
    question: "A new AI-driven tool has been introduced for your workflow. How do you respond?",
    options: [
      { text: "I prefer sticking to the tools I am already comfortable with.", score_impact: { O: 1 } },
      { text: "I will explore and test the new tool immediately to see its benefits.", score_impact: { O: 5 } },
    ],
  },
  {
    id: "s2",
    factor: "Conscientiousness",
    question: "The deadline is tomorrow, and you still have tasks pending. What is your approach?",
    options: [
      { text: "I'll manage it somehow at the last minute; it usually works out.", score_impact: { C: 1 } },
      { text: "I will create a priority list and break tasks into manageable chunks.", score_impact: { C: 5 } },
    ],
  },
  {
    id: "s3",
    factor: "Extraversion",
    question: "You are at a large company networking event. Where do you find yourself?",
    options: [
      { text: "I prefer focusing on my own work or chatting with one close colleague.", score_impact: { E: 1 } },
      { text: "I actively move around, introducing myself and meeting new people.", score_impact: { E: 5 } },
    ],
  },
  {
    id: "s4",
    factor: "Agreeableness",
    question: "A team member strongly disagrees with your project plan. What do you do?",
    options: [
      { text: "I hold my ground firmly; I am confident my plan is the best.", score_impact: { A: 1 } },
      { text: "I listen to their perspective and look for a middle ground we can agree on.", score_impact: { A: 5 } },
    ],
  },
  {
    id: "s5",
    factor: "Neuroticism",
    question: "A critical system error occurs right before a client demo. What is your reaction?",
    options: [
      { text: "I feel extremely anxious and worried about the potential failure.", score_impact: { N: 5 } },
      { text: "I remain calm, focus on the immediate fix, or call technical support.", score_impact: { N: 1 } },
    ],
  },
];

const traitNames = {
  O: "Openness",
  C: "Conscientiousness",
  E: "Extraversion",
  A: "Agreeableness",
  N: "Neuroticism",
};

const initialStats = {
  O: 0,
  C: 0,
  E: 0,
  A: 0,
  N: 0,
  secondsLeft: 180,
};

const state = {
  stats: { ...initialStats },
  isPlaying: false,
  introPlaying: false,
  awaitingPlay: false,
  showDialogue: false,
  timerId: null,
  currentQuestionIndex: 0,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10141b);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.domElement.tabIndex = 0;
renderer.domElement.style.outline = "none";
container.appendChild(renderer.domElement);

const exteriorLights = new THREE.Group();
const officeLights = new THREE.Group();
const officeAccentLights = new THREE.Group();

const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(12, 18, 10);
const fillLight = new THREE.DirectionalLight(0xaad8ff, 0.8);
fillLight.position.set(-10, 8, -8);
exteriorLights.add(ambientLight, keyLight, fillLight);

const officeAmbient = new THREE.AmbientLight(0x8a4a22, 0.12);
const officeHemi = new THREE.HemisphereLight(0xffb070, 0x120804, 0.28);
const officeCeiling = new THREE.DirectionalLight(0xffe2c8, 0.22);
officeCeiling.position.set(0, 12, 2);
const officeDeskFill = new THREE.PointLight(0xffc090, 0.28, 12, 2);
officeDeskFill.position.set(0, 2.2, 0);
officeLights.add(officeAmbient, officeHemi, officeCeiling, officeDeskFill, officeAccentLights);

scene.add(exteriorLights, officeLights);
officeLights.visible = false;

let exteriorModel = null;
let officeModel = null;
let officeEnvironmentReady = null;
let managerEnvironmentReady = null;
let managerChairLight = null;
const clock = new THREE.Clock();

const npcs = {
  businessMan: null,
  manager: null,
};
const npcAnimators = new Map();
const lipControllers = new Map();
let worldData = null;
const introCamera = {
  active: false,
  progress: 0,
  duration: 4.8,
  mode: "exterior",
  start: new THREE.Vector3(),
  end: new THREE.Vector3(),
  lookAt: new THREE.Vector3(),
  lookAtEnd: new THREE.Vector3(),
};
const EXECUTIVE_CHAIR_PATTERN = /executive[_ ]office[_ ]chair/i;
const tempLookAt = new THREE.Vector3();
let typewriterId = null;
let typewriterCompleteCallback = null;
let activeSpeakerNpc = null;

function clamp(v) {
  return Math.max(0, Math.min(100, v));
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function setupIntroCamera(center, size, floorY, span) {
  introCamera.mode = "exterior";
  introCamera.duration = 4.8;
  const streetEyeY = floorY + Math.max(size.y * 0.035, 0.85);
  const gateZ = center.z - size.z * 0.34;

  introCamera.start.set(center.x, streetEyeY, center.z + size.z * 0.4);
  introCamera.end.set(center.x, streetEyeY + Math.max(size.y * 0.02, 0.15), center.z - span * 0.1);
  introCamera.lookAt.set(center.x, floorY + size.y * 0.14, gateZ);
}

function getOfficeObjectBounds(namePattern) {
  if (!officeModel) return null;

  officeModel.updateMatrixWorld(true);
  let target = null;
  officeModel.traverse((child) => {
    if (!target && namePattern.test(child.name || "")) {
      target = child;
    }
  });
  if (!target) return null;

  const box = new THREE.Box3().setFromObject(target);
  return {
    center: box.getCenter(new THREE.Vector3()),
    size: box.getSize(new THREE.Vector3()),
    box,
  };
}

function getOfficeChairWorldTarget() {
  return getOfficeObjectBounds(EXECUTIVE_CHAIR_PATTERN);
}

function setupOfficeIntroCamera() {
  if (!worldData) {
    console.warn("Office intro camera skipped: worldData missing.");
    return;
  }

  const { center, size, floorY, span } = worldData;
  const eyeY = floorY + 1.65;

  introCamera.mode = "office";
  introCamera.duration = 5.5;
  introCamera.start.set(center.x, eyeY, center.z + span * 0.35);
  introCamera.lookAt.set(center.x, floorY + size.y * 0.12, center.z - size.z * 0.06);

  const desk = getOfficeObjectBounds(/^Desk$/);
  const shelves = getOfficeObjectBounds(/^Shelves1$/);
  const chair = getOfficeChairWorldTarget();

  if (desk && shelves) {
    const deskFrontZ = desk.box.max.z;
    introCamera.end.set(
      desk.center.x,
      floorY + 1.14,
      deskFrontZ + Math.max(span * 0.05, size.z * 0.04)
    );
    introCamera.lookAtEnd.set(
      shelves.center.x,
      shelves.center.y + shelves.size.y * 0.2,
      shelves.center.z + shelves.size.z * 0.02
    );
  } else if (chair) {
    introCamera.lookAtEnd.copy(chair.center);
    introCamera.lookAtEnd.y += chair.size.y * 0.22;
    introCamera.end.set(
      chair.center.x,
      floorY + 1.14,
      chair.center.z + Math.max(span * 0.12, size.z * 0.1)
    );
  } else {
    introCamera.end.set(center.x, floorY + 1.14, center.z + size.z * 0.05);
    introCamera.lookAtEnd.set(center.x, floorY + size.y * 0.45, center.z - size.z * 0.24);
  }
}

function applyIntroCameraView(alpha) {
  const t = easeInOutCubic(THREE.MathUtils.clamp(alpha, 0, 1));
  camera.position.lerpVectors(introCamera.start, introCamera.end, t);

  if (introCamera.mode === "office") {
    tempLookAt.lerpVectors(introCamera.lookAt, introCamera.lookAtEnd, t);
    camera.lookAt(tempLookAt);
  } else {
    camera.lookAt(introCamera.lookAt);
  }
}

function showIntroOpeningView() {
  applyIntroCameraView(0);
}

function flushClockDelta() {
  clock.getDelta();
}

function startIntroCinematic() {
  flushClockDelta();
  introCamera.active = true;
  introCamera.progress = 0;
  state.introPlaying = true;
  state.awaitingPlay = false;
  hideAllScreens();
  hideQuizOverlay();
  setGameplayUiVisible(false);
  applyIntroCameraView(0);
}

function startOfficeIntroCinematic() {
  flushClockDelta();
  introCamera.active = true;
  introCamera.progress = 0;
  state.introPlaying = true;
  hideAllScreens();
  hideQuizOverlay();
  setGameplayUiVisible(false);
  setStatus("", false);
  applyIntroCameraView(0);
}

function startQuestionFlow() {
  state.currentQuestionIndex = 0;
  state.showDialogue = true;
  state.introPlaying = false;
  panel.style.display = "block";
  setGameplayUiVisible(false);
  renderQuestion(0);
}

function finishOfficeIntroCinematic() {
  applyIntroCameraView(1);
  introCamera.active = false;
  introCamera.progress = 1;
  state.introPlaying = false;

  startQuestionFlow();

  try {
    setupManagerOnChair();
    updateDialoguePanelPosition();
  } catch (error) {
    console.error("Manager placement failed:", error);
  }
}

function finishIntroCinematic() {
  if (introCamera.mode === "office") {
    finishOfficeIntroCinematic();
    return;
  }

  introCamera.active = false;
  introCamera.progress = 1;
  state.introPlaying = false;
  state.awaitingPlay = true;
  setGameplayUiVisible(false);
  setStatus("Click Play to begin", false);
  showScreen(titleScreen);
}

function updateIntroCinematic(delta) {
  if (!introCamera.active) return false;

  const step = Math.min(delta, 1 / 30);
  introCamera.progress += step / introCamera.duration;
  if (introCamera.progress >= 1) {
    applyIntroCameraView(1);
    finishIntroCinematic();
    return true;
  }

  applyIntroCameraView(introCamera.progress);
  return false;
}

function applyStats(scoreImpact) {
  if (!scoreImpact) return;

  for (const [trait, value] of Object.entries(scoreImpact)) {
    if (state.stats[trait] !== undefined) {
      state.stats[trait] += value;
    }
  }
}

function loadGltf(path) {
  return new Promise((resolve, reject) => {
    loader.load(path, resolve, undefined, reject);
  });
}

function discoverLipSync(model, id) {
  const controller = { targets: [], jawBone: null, jawBaseX: 0, speaking: false, phase: 0 };
  const morphNames = ["mouthOpen", "jawOpen", "viseme_aa", "Mouth_Open", "mouth_open", "jaw_open"];

  model.traverse((child) => {
    if (child.isSkinnedMesh && child.morphTargetDictionary) {
      for (const name of morphNames) {
        if (child.morphTargetDictionary[name] !== undefined) {
          controller.targets.push({ mesh: child, index: child.morphTargetDictionary[name] });
        }
      }
    }
    if (child.isBone && /jaw|mouth|mandible/i.test(child.name)) {
      controller.jawBone = child;
      controller.jawBaseX = child.rotation.x;
    }
  });

  lipControllers.set(id, controller);
}

function setLipSpeaking(npcId, speaking) {
  const controller = lipControllers.get(npcId);
  if (controller) {
    controller.speaking = speaking;
    if (!speaking) controller.phase = 0;
  }
}

function stopAllLipSync() {
  for (const [id] of lipControllers) {
    setLipSpeaking(id, false);
  }
  activeSpeakerNpc = null;
}

function updateLipSync(delta) {
  for (const controller of lipControllers.values()) {
    if (!controller.speaking) {
      for (const target of controller.targets) {
        target.mesh.morphTargetInfluences[target.index] = THREE.MathUtils.lerp(
          target.mesh.morphTargetInfluences[target.index],
          0,
          0.2
        );
      }
      if (controller.jawBone) {
        controller.jawBone.rotation.x = THREE.MathUtils.lerp(controller.jawBone.rotation.x, controller.jawBaseX, 0.2);
      }
      continue;
    }

    controller.phase += delta * 14;
    const open = Math.abs(Math.sin(controller.phase)) * 0.55 + Math.abs(Math.sin(controller.phase * 2.3)) * 0.2;
    for (const target of controller.targets) {
      target.mesh.morphTargetInfluences[target.index] = open;
    }
    if (controller.jawBone) {
      controller.jawBone.rotation.x = controller.jawBaseX + open * 0.35;
    }
  }
}

function logModelAnimations(label, gltf) {
  const names = gltf.animations.map((clip) => clip.name);
  if (names.length) {
    console.log(`[Game NPC] ${label} animations:`, names);
  } else {
    console.warn(`[Game NPC] ${label} has NO animations inside GLB file.`);
  }
  return names;
}

function findClip(clips, pattern) {
  return clips.find((clip) => pattern.test(clip.name));
}

function setupNpcAnimations(id, model, gltf) {
  logModelAnimations(id, gltf);

  if (!gltf.animations?.length) {
    npcAnimators.set(id, null);
    return null;
  }

  const mixer = new THREE.AnimationMixer(model);
  const idleClip = findClip(gltf.animations, /idle|stand|neutral/i) || gltf.animations[0];
  const walkClip = findClip(gltf.animations, /walk|run|move/i);

  const animator = {
    id,
    mixer,
    model,
    idleClip,
    walkClip,
    activeAction: null,
    moveJob: null,
  };

  playNpcClip(animator, idleClip, true);
  npcAnimators.set(id, animator);
  return animator;
}

function playNpcClip(animator, clip, loop = true) {
  if (!animator || !clip) return;
  const next = animator.mixer.clipAction(clip);
  if (animator.activeAction && animator.activeAction !== next) {
    animator.activeAction.fadeOut(0.2);
  }
  next.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce).fadeIn(0.2).play();
  animator.activeAction = next;
}

function moveNpcTo(id, x, z, floorY, rotationY) {
  const model = npcs[id];
  const animator = npcAnimators.get(id);
  if (!model) return;

  if (animator?.moveJob) {
    animator.moveJob.cancelled = true;
    animator.moveJob = null;
  }

  if (!animator?.walkClip) {
    alignNpc(model, x, z, floorY, rotationY);
    return;
  }

  const startX = model.position.x;
  const startZ = model.position.z;
  const dx = x - startX;
  const dz = z - startZ;
  const distance = Math.hypot(dx, dz);

  if (distance < 0.08) {
    alignNpc(model, x, z, floorY, rotationY);
    playNpcClip(animator, animator.idleClip, true);
    return;
  }

  model.rotation.y = Math.atan2(dx, dz);
  playNpcClip(animator, animator.walkClip, true);

  const speed = (worldData?.span || 20) * 0.5;
  const duration = distance / speed;
  let elapsed = 0;
  const job = { cancelled: false };
  animator.moveJob = job;

  job.step = (delta) => {
    if (job.cancelled) return;
    elapsed += delta;
    const t = Math.min(elapsed / duration, 1);
    model.position.x = startX + dx * t;
    model.position.z = startZ + dz * t;

    if (t >= 1) {
      alignNpc(model, x, z, floorY, rotationY);
      playNpcClip(animator, animator.idleClip, true);
      animator.moveJob = null;
    }
  };
}

function updateNpcAnimators(delta) {
  for (const animator of npcAnimators.values()) {
    if (!animator) continue;
    if (animator.moveJob?.step) animator.moveJob.step(delta);
    animator.mixer.update(delta);
  }
}

function alignNpc(model, x, z, floorY, rotationY, targetHeight = 1.72) {
  model.rotation.set(0, rotationY, 0);
  model.scale.set(1, 1, 1);
  model.position.set(x, floorY, z);
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const scale = targetHeight / Math.max(size.y, 0.01);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  const grounded = new THREE.Box3().setFromObject(model);
  model.position.y = floorY - grounded.min.y;
  model.rotation.y = rotationY;
}

function findOfficeChairNode() {
  if (!officeModel) return null;

  let chair = null;
  officeModel.traverse((child) => {
    if (!chair && EXECUTIVE_CHAIR_PATTERN.test(child.name || "")) {
      chair = child;
    }
  });
  return chair;
}

function prepareManagerMaterials(model) {
  model.traverse((child) => {
    if (!child.isMesh) return;

    child.visible = true;
    child.frustumCulled = false;
    child.renderOrder = 25;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of materials) {
      if (!mat) continue;
      mat.side = THREE.DoubleSide;
      mat.transparent = false;
      mat.opacity = 1;
      mat.depthWrite = true;
      mat.depthTest = true;
      if (!mat.color) mat.color = new THREE.Color(0xffffff);
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      if (mat.emissive) mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
      mat.roughness = Math.min(Math.max(mat.roughness ?? 0.65, 0.55), 0.85);
      mat.metalness = Math.min(mat.metalness ?? 0, 0.08);
      mat.needsUpdate = true;
    }
  });
}

function alignManagerToChair(model, chairNode) {
  officeModel.updateMatrixWorld(true);

  const chairBox = new THREE.Box3().setFromObject(chairNode);
  const chairSize = chairBox.getSize(new THREE.Vector3());
  const chairCenter = chairBox.getCenter(new THREE.Vector3());

  if (model.parent !== scene) {
    model.parent?.remove(model);
    scene.add(model);
  }

  model.visible = true;
  model.rotation.set(0, 0, 0);
  model.scale.set(1, 1, 1);
  model.position.set(0, 0, 0);
  model.updateMatrixWorld(true);

  const modelBox = new THREE.Box3().setFromObject(model);
  const modelHeight = modelBox.getSize(new THREE.Vector3()).y;
  const targetHeight = Math.max(chairSize.y * 1.55, 0.65);
  model.scale.setScalar(targetHeight / Math.max(modelHeight, 0.001));
  model.updateMatrixWorld(true);

  const grounded = new THREE.Box3().setFromObject(model);
  const desk = getOfficeObjectBounds(/^Desk$/i);
  const towardDeskZ = desk ? desk.center.z : chairCenter.z + chairSize.z * 0.25;
  const seatY = chairBox.min.y + chairSize.y * 0.22;
  const legSink = chairSize.y * 0.28 + (desk ? desk.size.y * 0.16 : 0);

  let posY = seatY - grounded.min.y - legSink;
  if (desk) {
    const tuckedFeetY = desk.box.min.y + desk.size.y * 0.04;
    posY = Math.min(posY, tuckedFeetY - grounded.min.y);
  }

  model.position.set(
    chairCenter.x,
    posY,
    THREE.MathUtils.lerp(chairCenter.z, towardDeskZ, 0.22)
  );

  if (desk) {
    model.rotation.y = Math.atan2(
      desk.center.x - model.position.x,
      desk.center.z - model.position.z
    );
  }

  prepareManagerMaterials(model);
  model.updateMatrixWorld(true);
}

async function ensureManagerModel() {
  if (npcs.manager) return npcs.manager;

  if (!managerEnvironmentReady) {
    managerEnvironmentReady = loadGltf("./assets/manager.glb")
      .then((gltf) => {
        npcs.manager = gltf.scene;
        npcs.manager.visible = false;
        prepareModelMeshes(npcs.manager);
        prepareManagerMaterials(npcs.manager);
        discoverLipSync(npcs.manager, "manager");
        scene.add(npcs.manager);
        return npcs.manager;
      })
      .catch((error) => {
        console.error("Manager model failed to load:", error);
        managerEnvironmentReady = null;
        throw error;
      });
  }

  return managerEnvironmentReady;
}

function setupManagerOnChair() {
  if (!npcs.manager || !officeModel) return;

  const chairNode = findOfficeChairNode();
  if (!chairNode) {
    console.warn("Executive office chair not found for manager placement.");
    npcs.manager.visible = false;
    return;
  }

  officeModel.updateMatrixWorld(true);
  alignManagerToChair(npcs.manager, chairNode);
  npcs.manager.visible = true;

  const chairWorld = new THREE.Box3().setFromObject(chairNode);
  const chairCenter = chairWorld.getCenter(new THREE.Vector3());

  if (managerChairLight) {
    officeLights.remove(managerChairLight);
    if (managerChairLight.target) officeLights.remove(managerChairLight.target);
  }
  const chairLightSize = chairWorld.getSize(new THREE.Vector3());
  managerChairLight = new THREE.DirectionalLight(0xffe6cc, 0.35);
  managerChairLight.position.set(
    chairCenter.x + 0.4,
    chairWorld.max.y + 1.6,
    chairCenter.z + 0.65
  );
  managerChairLight.target.position.set(
    chairCenter.x,
    chairCenter.y + chairLightSize.y * 0.55,
    chairCenter.z
  );
  officeLights.add(managerChairLight);
  officeLights.add(managerChairLight.target);
}

function setupBusinessMan() {
  if (!worldData || !npcs.businessMan) return;

  const { center, size, floorY } = worldData;
  const gateZ = center.z - size.z * 0.34;
  const manX = center.x;
  const manZ = gateZ + size.z * 0.22;
  const faceYaw = Math.atan2(center.x - manX, manZ - gateZ);

  alignNpc(npcs.businessMan, manX, manZ, floorY, faceYaw);
  npcs.businessMan.visible = true;
}

function updateSpeakerUi(speaker, title, npcId, factor) {
  const config = speakerConfig[speaker] || speakerConfig.Manager;
  scenarioTitle.textContent = title;
  speakerRole.textContent = factor || config.role;
  speakerAvatar.textContent = config.avatar;
  speakerAvatar.className = `speaker-avatar ${config.className}`;
  activeSpeakerNpc = npcId || config.npc;
}

function stopTypewriter() {
  if (typewriterId) {
    clearInterval(typewriterId);
    typewriterId = null;
  }
  typewriterCompleteCallback = null;
  stopAllLipSync();
}

function finishTypewriter(lipNpc) {
  dialogue.querySelector(".cursor")?.remove();
  setLipSpeaking(lipNpc, false);

  const onComplete = typewriterCompleteCallback;
  typewriterCompleteCallback = null;
  onComplete?.();
}

function startTypewriter(text, speaker, npcId, onComplete) {
  stopTypewriter();
  typewriterCompleteCallback = onComplete;

  const lipNpc = npcId || speakerConfig[speaker]?.npc || "manager";
  const message = text || "";

  if (!message.length) {
    dialogue.textContent = "";
    finishTypewriter(lipNpc);
    return;
  }

  setLipSpeaking(lipNpc, true);
  dialogue.innerHTML = '<span class="typed-text"></span><span class="cursor"></span>';

  const typed = dialogue.querySelector(".typed-text");
  if (!typed) {
    dialogue.textContent = message;
    finishTypewriter(lipNpc);
    return;
  }

  let index = 0;
  typed.textContent = "";

  typewriterId = window.setInterval(() => {
    if (index >= message.length) {
      clearInterval(typewriterId);
      typewriterId = null;
      finishTypewriter(lipNpc);
      return;
    }

    typed.textContent += message[index];
    index += 1;
  }, 28);
}

function getManagerHeadScreenPosition() {
  const fallback = {
    x: window.innerWidth * 0.72,
    y: window.innerHeight * 0.38,
  };

  if (!npcs.manager?.visible) {
    return fallback;
  }

  npcs.manager.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(npcs.manager);
  if (box.isEmpty()) {
    return fallback;
  }

  const size = box.getSize(new THREE.Vector3());
  box.getCenter(managerHeadPos);
  managerHeadPos.y = box.max.y - size.y * 0.06;
  managerHeadPos.project(camera);

  return {
    x: (managerHeadPos.x * 0.5 + 0.5) * window.innerWidth,
    y: (-managerHeadPos.y * 0.5 + 0.5) * window.innerHeight - 18,
  };
}

function updateDialoguePanelPosition() {
  if (!state.showDialogue || !quizRightAnchor) return;

  const { x, y } = getManagerHeadScreenPosition();
  const clampedX = THREE.MathUtils.clamp(x, window.innerWidth * 0.52, window.innerWidth * 0.92);
  const clampedY = THREE.MathUtils.clamp(y, window.innerHeight * 0.14, window.innerHeight * 0.72);

  quizRightAnchor.style.left = `${clampedX}px`;
  quizRightAnchor.style.top = `${clampedY}px`;
}

function endGame() {
  state.isPlaying = false;
  state.awaitingPlay = false;
  state.showDialogue = false;
  stopTimer();
  stopTypewriter();
  panel.style.display = "block";
  hideQuizOverlay();
  setGameplayUiVisible(false);

  const scores = { O: state.stats.O, C: state.stats.C, E: state.stats.E, A: state.stats.A, N: state.stats.N };
  const dominant = Object.entries(scores).reduce((best, [trait, score]) =>
    score > best[1] ? [trait, score] : best
  , ["O", 0]);

  resultTitle.textContent = "Your Personality Profile";
  resultSummary.textContent =
    `Openness: ${scores.O}/5\n` +
    `Conscientiousness: ${scores.C}/5\n` +
    `Extraversion: ${scores.E}/5\n` +
    `Agreeableness: ${scores.A}/5\n` +
    `Neuroticism: ${scores.N}/5\n\n` +
    `Dominant trait: ${traitNames[dominant[0]]}`;
  showScreen(resultScreen);
  setStatus("Assessment complete", false);
}

function renderQuestion(index) {
  const scenario = scenarios[index];
  if (!scenario) {
    endGame();
    return;
  }

  state.showDialogue = true;
  state.currentQuestionIndex = index;
  panel.style.display = "block";
  hideResponsePanel();
  updateSpeakerUi("Manager", scenario.factor, "manager", scenario.factor);
  choices.innerHTML = "";

  for (const option of scenario.options) {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = option.text;
    btn.addEventListener("click", () => {
      stopTypewriter();
      applyStats(option.score_impact);

      if (index >= scenarios.length - 1) {
        endGame();
        return;
      }

      renderQuestion(index + 1);
    });
    choices.appendChild(btn);
  }

  showQuizOverlay();
  updateDialoguePanelPosition();
  dialogue.textContent = "";
  startTypewriter(scenario.question, "Manager", "manager", showResponsePanel);
}

function applyWorldBounds(box) {
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const floorY = box.min.y;
  const span = Math.max(size.x, size.z);
  worldData = { center, size, floorY, span };
  return { center, size, floorY, span };
}

function setActiveEnvironment(mode) {
  if (exteriorModel) exteriorModel.visible = mode === "exterior";
  if (officeModel) officeModel.visible = mode === "office";
  if (npcs.businessMan) npcs.businessMan.visible = mode === "exterior";
  if (npcs.manager) npcs.manager.visible = mode === "office";
  if (managerChairLight) {
    managerChairLight.visible = mode === "office";
    if (managerChairLight.target) managerChairLight.target.visible = mode === "office";
  }

  exteriorLights.visible = mode === "exterior";
  officeLights.visible = mode === "office";
  scene.background.set(mode === "office" ? 0x140c08 : 0x10141b);
  renderer.toneMappingExposure = mode === "office" ? 0.78 : 1;
}

function setupExteriorWorld(box) {
  const { center, size, floorY, span } = applyWorldBounds(box);
  setupIntroCamera(center, size, floorY, span);
  setupBusinessMan();
}

function setupOfficeWorld(box) {
  const { center, size, floorY } = applyWorldBounds(box);

  if (officeModel) {
    syncOfficeAccentLights(officeModel);
    if (worldData) {
      officeDeskFill.position.set(center.x + size.x * 0.08, floorY + size.y * 0.42, center.z - size.z * 0.04);
    }
    setupManagerOnChair();
  }
}

function prepareModelMeshes(model) {
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function prepareOfficeMaterials(model) {
  model.traverse((child) => {
    if (!child.isMesh) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of materials) {
      if (!mat) continue;

      for (const mapName of ["map", "emissiveMap", "normalMap", "roughnessMap", "metalnessMap"]) {
        if (mat[mapName]) {
          mat[mapName].colorSpace = THREE.SRGBColorSpace;
        }
      }

      const name = (mat.name || "").toLowerCase();

      if (mat.emissive) {
        const isLightStrip = /light|emision|emissive|fluor/i.test(name);
        if (isLightStrip) {
          mat.emissive.setHex(name.includes("emision") ? 0xff6620 : 0xff8833);
          mat.emissiveIntensity = name.includes("emision") ? 4.2 : 3.2;
          mat.toneMapped = false;
          if (mat.color) mat.color.setHex(0x000000);
        }
      }

      if (mat.color && /tile|transluscent|what|silver|platinum/i.test(name)) {
        mat.roughness = Math.max(mat.roughness ?? 0.5, 0.62);
        mat.metalness = Math.min(mat.metalness ?? 0, 0.08);
      }
    }
  });
}

function syncOfficeAccentLights(model) {
  while (officeAccentLights.children.length > 0) {
    officeAccentLights.remove(officeAccentLights.children[0]);
  }

  model.updateMatrixWorld(true);
  model.traverse((child) => {
    if (!/flourescent|fluorescent/i.test(child.name || "")) return;

    const pos = new THREE.Vector3();
    child.getWorldPosition(pos);
    const accent = new THREE.PointLight(0xff7722, 2.8, 9, 1.8);
    accent.position.copy(pos);
    officeAccentLights.add(accent);
  });

  if (officeAccentLights.children.length === 0 && worldData) {
    const { center, size, floorY } = worldData;
    const fallbackPositions = [
      [center.x - size.x * 0.34, floorY + size.y * 0.62, center.z - size.z * 0.12],
      [center.x - size.x * 0.34, floorY + size.y * 0.38, center.z - size.z * 0.12],
      [center.x, floorY + size.y * 0.72, center.z - size.z * 0.34],
    ];

    for (const [x, y, z] of fallbackPositions) {
      const accent = new THREE.PointLight(0xff7722, 2.4, 10, 1.8);
      accent.position.set(x, y, z);
      officeAccentLights.add(accent);
    }
  }
}

function getMeshBounds(model) {
  const box = new THREE.Box3();
  let found = false;
  model.traverse((child) => {
    if (child.isMesh) {
      box.expandByObject(child);
      found = true;
    }
  });
  if (!found) box.setFromObject(model);
  return box;
}

function normalizeOfficeModel(model) {
  const wrapper = new THREE.Group();
  wrapper.add(model);
  wrapper.updateMatrixWorld(true);

  let box = new THREE.Box3().setFromObject(wrapper);
  const size = box.getSize(new THREE.Vector3());
  const targetHeight = 3;

  if (size.y > 5 || size.y < 0.8) {
    const scale = targetHeight / Math.max(size.y, 0.001);
    wrapper.scale.setScalar(scale);
    wrapper.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(wrapper);
  }

  const center = box.getCenter(new THREE.Vector3());
  wrapper.position.set(-center.x, -box.min.y, -center.z);
  wrapper.updateMatrixWorld(true);
  return wrapper;
}

async function ensureOfficeEnvironment() {
  if (officeModel) return officeModel;

  if (!officeEnvironmentReady) {
    officeEnvironmentReady = loadGltf("./assets/CEO_Office_Design.glb").then((gltf) => {
      officeModel = normalizeOfficeModel(gltf.scene);
      officeModel.visible = false;
      prepareModelMeshes(officeModel);
      prepareOfficeMaterials(officeModel);
      scene.add(officeModel);
      return officeModel;
    });
  }

  return officeEnvironmentReady;
}

async function activateOfficeGameplay() {
  await Promise.all([ensureOfficeEnvironment(), ensureManagerModel()]);
  setActiveEnvironment("office");
  officeModel.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(officeModel);
  setupOfficeWorld(box);
  setupManagerOnChair();
  return box;
}

function activateExteriorTitleView() {
  if (!exteriorModel) return;

  setActiveEnvironment("exterior");
  const box = new THREE.Box3().setFromObject(exteriorModel);
  setupExteriorWorld(box);
  applyIntroCameraView(1);
  setupBusinessMan();
}

function beginOpeningSequence() {
  stopTimer();
  state.isPlaying = false;
  state.showDialogue = false;
  state.stats = { ...initialStats };
  state.currentQuestionIndex = 0;
  panel.style.display = "none";
  hideAllScreens();
  setGameplayUiVisible(false);
  if (exteriorModel) {
    showIntroOpeningView();
    setupBusinessMan();
    startIntroCinematic();
  }
}

async function startGame() {
  if (state.isPlaying) {
    return;
  }

  const originalLabel = playBtn.textContent;
  playBtn.disabled = true;
  playBtn.textContent = "Loading...";
  setStatus("Loading office...", false);

  try {
    await activateOfficeGameplay();

    state.stats = { ...initialStats };
    state.isPlaying = true;
    state.awaitingPlay = false;
    state.showDialogue = false;
    state.currentQuestionIndex = 0;

    setupOfficeIntroCamera();
    if (introCamera.mode !== "office") {
      introCamera.mode = "office";
      introCamera.duration = 5.5;
    }
    startOfficeIntroCinematic();

    stopTimer();
    state.timerId = setInterval(() => {
      if (!state.isPlaying || state.showDialogue || state.introPlaying) return;
      state.stats.secondsLeft -= 1;
      if (state.stats.secondsLeft <= 0) {
        state.stats.secondsLeft = 0;
        endGame();
      }
    }, 1000);
  } catch (error) {
    console.error(error);
    setStatus("Office load failed. Check console.", true);
  } finally {
    playBtn.disabled = false;
    playBtn.textContent = originalLabel;
  }
}

function resetToTitleScreen() {
  stopTimer();
  state.isPlaying = false;
  state.introPlaying = false;
  state.awaitingPlay = true;
  introCamera.active = false;
  introCamera.progress = 1;
  state.showDialogue = false;
  state.stats = { ...initialStats };
  state.currentQuestionIndex = 0;
  panel.style.display = "none";
  setGameplayUiVisible(false);
  activateExteriorTitleView();
  showScreen(titleScreen);
}

playBtn.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  startGame();
});
restartBtn.addEventListener("click", resetToTitleScreen);

const loader = new GLTFLoader();

async function initGameWorld() {
  setStatus("Loading assets...", false);
  try {
    const cityGltf = await loadGltf("./assets/city_scene.glb");
    exteriorModel = cityGltf.scene;
    prepareModelMeshes(exteriorModel);
    scene.add(exteriorModel);

    ensureOfficeEnvironment().catch((error) => {
      console.error("Office preload failed:", error);
    });
    ensureManagerModel().catch((error) => {
      console.error("Manager preload failed:", error);
    });

    const businessGltf = await loadGltf("./assets/business_man.glb");
    npcs.businessMan = businessGltf.scene;
    npcs.businessMan.visible = false;
    prepareModelMeshes(npcs.businessMan);
    scene.add(npcs.businessMan);
    setupNpcAnimations("businessMan", npcs.businessMan, businessGltf);

    const box = new THREE.Box3().setFromObject(exteriorModel);
    setupExteriorWorld(box);
    showIntroOpeningView();
    beginOpeningSequence();
  } catch (error) {
    console.error(error);
    setStatus("Asset load failed. Check console.", true);
  }
}

initGameWorld();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateDialoguePanelPosition();
});

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (introCamera.active) {
    updateIntroCinematic(delta);
  }

  updateLipSync(delta);
  updateNpcAnimators(delta);
  updateDialoguePanelPosition();

  renderer.render(scene, camera);
}

animate();
