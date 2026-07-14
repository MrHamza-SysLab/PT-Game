import * as THREE from "three";
import { FBXLoader } from "./node_modules/three/examples/jsm/loaders/FBXLoader.js";

const HARRY_GLB = "./assets/ready_player_me_harry_potter.glb";
const MEETING_FBX = "./assets/meeting.fbx";

const MANAGER_DIALOGUES = [
  "Hello! I'm Hanif Butt, manager of this company. Welcome aboard - before we jump into a few workplace scenarios, I'd love a quick intro from you.",
  "Are you ready for doing the test?",
  "A new AI-driven tool has been introduced for your workflow. How do you respond?",
  "The deadline is tomorrow, and you still have tasks pending. What is your approach?",
  "You are at a large company networking event. Where do you find yourself?",
  "A team member strongly disagrees with your project plan. What do you do?",
  "A critical system error occurs right before a client demo. What is your reaction?",
  "Congratulations! You have successfully completed the assessment. Please select the button below to review your detailed personality analytics and results.",
];

let deps = null;
let active = false;
let harryModel = null;
let harryReady = null;
let meetingClip = null;
let meetingReady = null;
let mixer = null;
let meetingAction = null;
let demoLights = null;
let savedBackground = null;
let dialogueIndex = 0;
let speechBusy = false;

function normalizeBoneKey(name) {
  return name.replace(/^mixamorig/i, "").replace(/_\d+$/i, "").toLowerCase();
}

function buildMixamoBoneMap(harryRoot, mixamoBoneNames) {
  const harryByKey = new Map();
  harryRoot.traverse((child) => {
    if (!child.isBone) return;
    harryByKey.set(normalizeBoneKey(child.name), child.name);
  });

  const map = new Map();
  for (const mixName of mixamoBoneNames) {
    const harryName = harryByKey.get(normalizeBoneKey(mixName));
    if (harryName) map.set(mixName, harryName);
  }
  return map;
}

function collectMixamoBoneNames(fbxRoot) {
  const names = [];
  fbxRoot.traverse((child) => {
    if (child.isBone) names.push(child.name);
  });
  return names;
}

function retargetMixamoClip(clip, boneMap) {
  const tracks = [];

  for (const track of clip.tracks) {
    const dot = track.name.indexOf(".");
    if (dot < 0) continue;

    const mixamoBone = track.name.slice(0, dot);
    const property = track.name.slice(dot + 1);
    const harryBone = boneMap.get(mixamoBone);
    if (!harryBone) continue;

    const TrackCtor = track.constructor;
    tracks.push(new TrackCtor(`${harryBone}.${property}`, track.times.slice(), track.values.slice()));
  }

  return new THREE.AnimationClip(`meeting_on_harry`, clip.duration, tracks);
}

function setSubtitle(text, progress) {
  const { subtitleEl, progressEl } = deps.ui;
  if (subtitleEl) subtitleEl.textContent = text;
  if (progressEl) {
    progressEl.textContent = progress
      ? `Dialogue ${progress.current} / ${progress.total}`
      : "";
  }
}

function hideWorldModels() {
  const { exteriorModel, officeModel, npcs, exteriorLights, officeLights, scene } = deps;
  if (exteriorModel) exteriorModel.visible = false;
  if (officeModel) officeModel.visible = false;
  if (npcs.businessMan) npcs.businessMan.visible = false;
  if (npcs.manager) npcs.manager.visible = false;
  exteriorLights.visible = false;
  officeLights.visible = false;

  if (!demoLights) {
    demoLights = new THREE.Group();
    demoLights.add(
      new THREE.AmbientLight(0xfff2e8, 0.95),
      new THREE.DirectionalLight(0xffffff, 1.5),
      new THREE.PointLight(0xffd4a8, 0.85, 16, 1.6)
    );
    demoLights.children[1].position.set(1.5, 3, 2.5);
    demoLights.children[2].position.set(-1, 2, 1.5);
    scene.add(demoLights);
  }
  demoLights.visible = true;
}

function restoreWorldModels() {
  const { exteriorModel, exteriorLights } = deps;
  if (demoLights) demoLights.visible = false;
  if (exteriorModel) exteriorModel.visible = true;
  exteriorLights.visible = true;
}

function fitHarryToScene() {
  if (!harryModel) return;

  const box = new THREE.Box3().setFromObject(harryModel);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const targetHeight = 1.72;
  const scale = targetHeight / Math.max(size.y, 0.01);

  harryModel.scale.setScalar(scale);
  harryModel.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  harryModel.rotation.y = Math.PI * 0.08;
  harryModel.updateMatrixWorld(true);
}

function setupHarryCamera() {
  const { camera } = deps;
  if (!harryModel) return;

  const box = new THREE.Box3().setFromObject(harryModel);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  camera.position.set(center.x, box.min.y + size.y * 0.45, center.z + size.y * 1.15);
  camera.lookAt(center.x, box.min.y + size.y * 0.42, center.z);
  camera.fov = 40;
  camera.near = 0.05;
  camera.updateProjectionMatrix();
}

async function ensureHarryModel() {
  if (harryModel) return harryModel;
  if (harryReady) return harryReady;

  harryReady = deps
    .loadGltf(HARRY_GLB)
    .then((gltf) => {
      harryModel = gltf.scene;
      harryModel.visible = false;
      deps.prepareModelMeshes(harryModel);
      deps.scene.add(harryModel);
      return harryModel;
    })
    .catch((error) => {
      harryReady = null;
      throw error;
    });

  return harryReady;
}

async function ensureMeetingClip() {
  if (meetingClip) return meetingClip;
  if (meetingReady) return meetingReady;

  meetingReady = Promise.all([ensureHarryModel(), loadMeetingFbx()]).then(([model, fbx]) => {
    const sourceClip = fbx.animations?.[0];
    if (!sourceClip) {
      throw new Error("meeting.fbx has no animation clip.");
    }

    const boneMap = buildMixamoBoneMap(model, collectMixamoBoneNames(fbx));
    meetingClip = retargetMixamoClip(sourceClip, boneMap);
    console.info(
      "[Meeting Demo] retargeted tracks:",
      meetingClip.tracks.length,
      "/",
      sourceClip.tracks.length
    );
    return meetingClip;
  }).catch((error) => {
    meetingReady = null;
    throw error;
  });

  return meetingReady;
}

function loadMeetingFbx() {
  return new Promise((resolve, reject) => {
    const loader = new FBXLoader();
    loader.load(MEETING_FBX, resolve, undefined, reject);
  });
}

function startMeetingAnimation() {
  if (!harryModel || !meetingClip) return;

  if (mixer) {
    mixer.stopAllAction();
  }

  mixer = new THREE.AnimationMixer(harryModel);
  meetingAction = mixer.clipAction(meetingClip);
  meetingAction.reset();
  meetingAction.setLoop(THREE.LoopRepeat, Infinity);
  meetingAction.clampWhenFinished = false;
  meetingAction.fadeIn(0.35);
  meetingAction.play();
}

function stopMeetingAnimation() {
  if (meetingAction) {
    meetingAction.fadeOut(0.25);
    meetingAction = null;
  }
  if (mixer) {
    mixer.stopAllAction();
    mixer = null;
  }
}

function speakNextDialogue() {
  if (!active || speechBusy) return;

  if (dialogueIndex >= MANAGER_DIALOGUES.length) {
    setSubtitle("Meeting animation playing — all manager dialogues complete.", {
      current: MANAGER_DIALOGUES.length,
      total: MANAGER_DIALOGUES.length,
    });
    return;
  }

  const text = MANAGER_DIALOGUES[dialogueIndex];
  speechBusy = true;
  setSubtitle(text, { current: dialogueIndex + 1, total: MANAGER_DIALOGUES.length });

  deps.speakText(text, {
    npcId: null,
    rate: 0.92,
    pitch: 1.02,
    onEnd: () => {
      speechBusy = false;
      if (!active) return;
      dialogueIndex += 1;
      window.setTimeout(() => speakNextDialogue(), 600);
    },
  });
}

export function initHarryMeetingDemo(dependencies) {
  deps = dependencies;
}

export function isHarryMeetingDemoActive() {
  return active;
}

export async function enterHarryMeetingDemo() {
  if (!deps || active) return;

  active = true;
  dialogueIndex = 0;
  speechBusy = false;

  deps.stopAllLipSync?.();
  deps.stopSpeaking();
  deps.stopAllMusic?.();

  savedBackground = deps.scene.background?.clone?.() ?? deps.scene.background;
  deps.scene.background = new THREE.Color(0x0a0c12);

  hideWorldModels();
  deps.ui.screen?.classList.add("screen-visible");
  deps.hideTitleScreen?.();

  if (deps.ui.backBtn) deps.ui.backBtn.disabled = true;
  setSubtitle("Loading Harry + meeting animation...", null);
  deps.setStatus("Meeting Demo: loading...", false);

  try {
    await ensureMeetingClip();
    fitHarryToScene();
    harryModel.visible = true;
    setupHarryCamera();
    startMeetingAnimation();
    deps.setStatus("Meeting Demo", false);
    if (deps.ui.backBtn) deps.ui.backBtn.disabled = false;
    speakNextDialogue();
  } catch (error) {
    console.error("Harry meeting demo failed:", error);
    setSubtitle("Failed to load Harry or meeting.fbx.", null);
    deps.setStatus("Meeting demo load failed.", true);
    if (deps.ui.backBtn) deps.ui.backBtn.disabled = false;
  }
}

export function exitHarryMeetingDemo() {
  if (!deps || !active) return;

  active = false;
  speechBusy = false;
  dialogueIndex = 0;
  deps.stopSpeaking();
  stopMeetingAnimation();

  if (harryModel) harryModel.visible = false;
  restoreWorldModels();

  if (savedBackground) {
    deps.scene.background = savedBackground;
    savedBackground = null;
  }

  deps.ui.screen?.classList.remove("screen-visible");
  setSubtitle("", null);
  deps.showTitleScreen?.();
  deps.restoreTitleView?.();
  deps.playMusicTrack?.("intro");
  deps.setStatus("Click Play to begin", false);
}

export function updateHarryMeetingDemo(delta) {
  if (!active || !mixer) return;
  mixer.update(delta);
}
