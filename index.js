import * as THREE from "three";
import { GLTFLoader } from "./node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "./node_modules/three/examples/jsm/loaders/FBXLoader.js";
import {
  initHarryMeetingDemo,
  enterHarryMeetingDemo,
  exitHarryMeetingDemo,
  isHarryMeetingDemoActive,
  updateHarryMeetingDemo,
} from "./harry-meeting-demo.js";

const DASHING_MANAGER_FBX = "./assets/dashing_manager.fbx";
const container = document.getElementById("app");
const status = document.getElementById("status");
const titleScreen = document.getElementById("title-screen");
const gameScreen = document.getElementById("game-screen");
const resultScreen = document.getElementById("result-screen");
const scenarioTitle = document.getElementById("scenario-title");
const dialogue = document.getElementById("dialogue");
const choices = document.getElementById("choices");
const playBtn = document.getElementById("play-btn");
const meetingDemoBtn = document.getElementById("meeting-demo-btn");
const meetingDemoScreen = document.getElementById("meeting-demo-screen");
const meetingDemoSubtitle = document.getElementById("meeting-demo-subtitle");
const meetingDemoProgress = document.getElementById("meeting-demo-progress");
const meetingDemoBackBtn = document.getElementById("meeting-demo-back");
const restartBtn = document.getElementById("restart-btn");
const resultTitle = document.getElementById("result-title");
const resultSummary = document.getElementById("result-summary");
const analyticsOverlay = document.getElementById("analytics-overlay");
const analyticsTitle = document.getElementById("analytics-title");
const analyticsSubtitle = document.getElementById("analytics-subtitle");
const analyticsDominant = document.getElementById("analytics-dominant");
const analyticsTraits = document.getElementById("analytics-traits");
const analyticsFeedback = document.getElementById("analytics-feedback");
const analyticsWorkplace = document.getElementById("analytics-workplace");
const analyticsGrowth = document.getElementById("analytics-growth");
const analyticsFinishBtn = document.getElementById("analytics-finish-btn");
const panel = document.getElementById("panel");
const quizOverlay = document.getElementById("quiz-overlay");
const quizResponse = document.getElementById("quiz-response");
const quizRightAnchor = document.getElementById("quiz-right-anchor");
const introResponse = document.getElementById("intro-response");
const userIntroInput = document.getElementById("user-intro-input");
const introNextBtn = document.getElementById("intro-next-btn");
const musicToggleBtn = document.getElementById("music-toggle");
const voiceToggleBtn = document.getElementById("voice-toggle");
const speakerAvatar = document.getElementById("speaker-avatar");
const speakerRole = document.getElementById("speaker-role");
const managerHeadPos = new THREE.Vector3();
const managerHeadScratch = new THREE.Vector3();
let managerAnimReady = false;
let lastDialogueAnchor = { x: 0, y: 0 };

const MUSIC = {
  intro: "./assets/sounds/intro_2.mp3",
  button: "./assets/sounds/button_click.mp3",
  victory: "./assets/sounds/victory.mp3",
  resultBg: "./assets/sounds/result_bg.mp3",
};

const musicPlayers = {};
let activeMusicKey = null;
let musicEnabled = true;
let musicUnlocked = false;

function getMusicPlayer(key) {
  if (!musicPlayers[key]) {
    const player = new Audio(MUSIC[key]);
    player.preload = "auto";
    player.volume = key === "button" ? 0.65 : 0.45;
    player.loop = false;
    musicPlayers[key] = player;
  }
  return musicPlayers[key];
}

function syncMusicToggleUi() {
  if (!musicToggleBtn) return;
  musicToggleBtn.classList.toggle("is-muted", !musicEnabled);
  musicToggleBtn.setAttribute(
    "aria-label",
    musicEnabled ? "Mute music" : "Unmute music"
  );
  musicToggleBtn.title = musicEnabled ? "Music On" : "Music Off";
}

function stopAllMusic() {
  for (const player of Object.values(musicPlayers)) {
    player.pause();
    player.currentTime = 0;
  }
  activeMusicKey = null;
}

function getScreenMusicKey() {
  if (
    resultScreen.classList.contains("screen-visible") ||
    analyticsOverlay?.classList.contains("visible")
  ) {
    return "victory";
  }
  if (titleScreen.classList.contains("screen-visible")) return "intro";
  return null;
}

async function playMusicTrack(key) {
  if (!key) return;
  if (!musicEnabled) {
    activeMusicKey = key;
    return;
  }

  stopAllMusic();
  const player = getMusicPlayer(key);
  player.loop = false;
  try {
    await player.play();
    musicUnlocked = true;
    activeMusicKey = key;
  } catch {
    activeMusicKey = key;
  }
}

async function playOfficeAnimationMusic() {
  if (!musicEnabled) {
    activeMusicKey = "resultBg";
    return;
  }

  stopAllMusic();
  const player = getMusicPlayer("resultBg");
  player.loop = true;
  player.currentTime = 0;

  try {
    await player.play();
    musicUnlocked = true;
    activeMusicKey = "resultBg";
  } catch {
    activeMusicKey = "resultBg";
  }
}

function stopOfficeAnimationMusic() {
  const player = musicPlayers.resultBg;
  if (player) {
    player.loop = false;
    player.pause();
    player.currentTime = 0;
  }
  if (activeMusicKey === "resultBg") {
    activeMusicKey = null;
  }
}

function playButtonClick() {
  if (!musicEnabled) return;
  const player = getMusicPlayer("button");
  player.currentTime = 0;
  player.play().catch(() => {});
  musicUnlocked = true;
}

function pauseMusic() {
  for (const player of Object.values(musicPlayers)) {
    player.pause();
  }
}

function resumeScreenMusic() {
  if (introCamera.active && introCamera.mode === "office") {
    playOfficeAnimationMusic();
    return;
  }

  const key = activeMusicKey || getScreenMusicKey();
  if (key && key !== "button") {
    playMusicTrack(key);
  }
}

function setMusicEnabled(enabled) {
  musicEnabled = enabled;
  syncMusicToggleUi();
  if (musicEnabled) {
    resumeScreenMusic();
  } else {
    pauseMusic();
  }
}

function unlockAndPlayMusic() {
  musicUnlocked = true;
  if (musicEnabled) {
    playMusicTrack(getScreenMusicKey() || "intro");
  }
}

const SpeechRecognitionCtor =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

let voiceEnabled = true;
let speechNpcId = null;
let voiceCommandActive = false;
let isListening = false;
let introSpeechBase = "";
let speechRecognition = null;
let musicDucked = false;

function isSpeechActive() {
  return Boolean(window.speechSynthesis?.speaking || window.speechSynthesis?.pending);
}

function getPreferredVoice() {
  const voices = window.speechSynthesis?.getVoices() || [];
  return (
    voices.find((v) => v.lang.startsWith("en") && /male|david|mark|google us english/i.test(v.name)) ||
    voices.find((v) => v.lang.startsWith("en"))
  );
}

function duckMusicForSpeech() {
  if (musicDucked) return;
  for (const player of Object.values(musicPlayers)) {
    if (!player.paused) {
      player._preSpeechVolume = player.volume;
      player.volume *= 0.22;
    }
  }
  musicDucked = true;
}

function restoreMusicAfterSpeech() {
  if (!musicDucked) return;
  for (const player of Object.values(musicPlayers)) {
    if (player._preSpeechVolume !== undefined) {
      player.volume = player._preSpeechVolume;
      delete player._preSpeechVolume;
    }
  }
  musicDucked = false;
}

function stopSpeaking() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  restoreMusicAfterSpeech();
  if (speechNpcId) {
    setLipSpeaking(speechNpcId, false);
    speechNpcId = null;
  }
}

function speakText(text, { npcId = null, onEnd = null, rate = 0.94, pitch = 1 } = {}) {
  if (!voiceEnabled || !text?.trim() || !window.speechSynthesis) {
    onEnd?.();
    return;
  }

  stopSpeaking();
  duckMusicForSpeech();

  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.lang = "en-US";

  const preferredVoice = getPreferredVoice();
  if (preferredVoice) utterance.voice = preferredVoice;

  if (npcId) {
    speechNpcId = npcId;
    setLipSpeaking(npcId, true);
  }

  const cleanup = () => {
    restoreMusicAfterSpeech();
    if (speechNpcId === npcId) {
      setLipSpeaking(npcId, false);
      speechNpcId = null;
    }
    onEnd?.();
  };

  utterance.onend = cleanup;
  utterance.onerror = cleanup;
  window.speechSynthesis.speak(utterance);
}

function syncVoiceToggleUi() {
  if (!voiceToggleBtn) return;
  voiceToggleBtn.classList.toggle("is-muted", !voiceEnabled);
  voiceToggleBtn.classList.toggle("is-listening", voiceEnabled && isListening);
  voiceToggleBtn.setAttribute("aria-label", voiceEnabled ? "Mute voice" : "Unmute voice");
  voiceToggleBtn.title = voiceEnabled ? "Voice On" : "Voice Off";
}

function normalizeSpeech(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getChoiceButtons() {
  return [...choices.querySelectorAll(".choice-btn:not(:disabled)")];
}

function getChoiceIndexFromSpeech(transcript, total) {
  const norm = normalizeSpeech(transcript);
  const wordMap = {
    one: 0,
    first: 0,
    two: 1,
    second: 1,
    three: 2,
    third: 2,
    four: 3,
    fourth: 3,
    five: 4,
    fifth: 4,
  };

  const optionMatch = norm.match(/option\s*(\d+)/);
  if (optionMatch) {
    const idx = Number(optionMatch[1]) - 1;
    if (idx >= 0 && idx < total) return idx;
  }

  if (/^\d+$/.test(norm)) {
    const idx = Number(norm) - 1;
    if (idx >= 0 && idx < total) return idx;
  }

  for (const [word, idx] of Object.entries(wordMap)) {
    if (norm === word || norm.endsWith(` ${word}`) || norm.startsWith(`${word} `)) {
      if (idx < total) return idx;
    }
  }

  return -1;
}

function scoreChoiceMatch(transcript, optionText) {
  const spoken = normalizeSpeech(transcript);
  const option = normalizeSpeech(optionText);
  if (!spoken || !option) return 0;

  if (spoken === option || spoken.includes(option) || option.includes(spoken)) {
    return 1;
  }

  const spokenWords = spoken.split(" ").filter((w) => w.length > 2);
  const optionWords = option.split(" ").filter((w) => w.length > 2);
  if (!spokenWords.length || !optionWords.length) return 0;

  let hits = 0;
  for (const word of spokenWords) {
    if (optionWords.some((optWord) => optWord.includes(word) || word.includes(optWord))) {
      hits += 1;
    }
  }

  return hits / Math.max(spokenWords.length, 1);
}

function findChoiceFromSpeech(transcript) {
  const buttons = getChoiceButtons();
  if (!buttons.length) return null;

  const norm = normalizeSpeech(transcript);
  if (!norm) return null;

  if (/\b(yes|yeah|yep|ready|start)\b/.test(norm)) {
    const yesBtn = buttons.find((btn) => normalizeSpeech(btn.textContent) === "yes");
    if (yesBtn) return yesBtn;
  }

  if (/\b(no|nope|not ready|cancel)\b/.test(norm)) {
    const noBtn = buttons.find((btn) => normalizeSpeech(btn.textContent) === "no");
    if (noBtn) return noBtn;
  }

  if (norm.includes("view result")) {
    const resultsBtn = buttons.find((btn) => normalizeSpeech(btn.textContent).includes("view result"));
    if (resultsBtn) return resultsBtn;
  }

  const index = getChoiceIndexFromSpeech(transcript, buttons.length);
  if (index >= 0) return buttons[index];

  let bestBtn = null;
  let bestScore = 0.42;
  for (const btn of buttons) {
    const score = scoreChoiceMatch(transcript, btn.textContent);
    if (score > bestScore) {
      bestScore = score;
      bestBtn = btn;
    }
  }

  return bestBtn;
}

function isSubmitSpeech(transcript) {
  const norm = normalizeSpeech(transcript);
  return ["next", "submit", "done", "continue", "proceed", "send", "go ahead"].some(
    (word) => norm === word || norm.endsWith(` ${word}`) || norm.startsWith(`${word} `)
  );
}

function handleIntroSpeech(finalTranscript, interimTranscript) {
  if (!userIntroInput || state.conversationPhase !== "user-intro") return;

  if (finalTranscript && isSubmitSpeech(finalTranscript)) {
    stopVoiceCommands();
    submitUserIntro();
    return;
  }

  if (finalTranscript) {
    const cleaned = finalTranscript.trim();
    if (!cleaned || isSubmitSpeech(cleaned)) return;
    introSpeechBase = introSpeechBase ? `${introSpeechBase} ${cleaned}` : cleaned;
    userIntroInput.value = introSpeechBase.slice(0, 280);
    syncIntroNextEnabled();
    return;
  }

  if (interimTranscript) {
    const preview = introSpeechBase
      ? `${introSpeechBase} ${interimTranscript.trim()}`
      : interimTranscript.trim();
    userIntroInput.value = preview.slice(0, 280);
    syncIntroNextEnabled();
  }
}

function handleChoiceSpeech(transcript) {
  const match = findChoiceFromSpeech(transcript);
  if (!match) return;

  stopVoiceCommands();
  const label = match.textContent.trim();
  speakText(`You selected ${label}.`, {
    onEnd: () => {
      match.click();
    },
  });
}

function initSpeechRecognition() {
  if (!SpeechRecognitionCtor || speechRecognition) return speechRecognition;

  const recognition = new SpeechRecognitionCtor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  recognition.maxAlternatives = 3;

  recognition.onresult = (event) => {
    if (!voiceEnabled || !voiceCommandActive || isSpeechActive()) return;

    let finalTranscript = "";
    let interimTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += piece;
      } else {
        interimTranscript += piece;
      }
    }

    if (state.conversationPhase === "user-intro") {
      handleIntroSpeech(finalTranscript.trim(), interimTranscript.trim());
      return;
    }

    if (finalTranscript.trim() && getChoiceButtons().length) {
      handleChoiceSpeech(finalTranscript.trim());
    }
  };

  recognition.onerror = (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      voiceCommandActive = false;
      isListening = false;
      syncVoiceToggleUi();
      return;
    }

    if (voiceCommandActive && voiceEnabled) {
      window.setTimeout(() => {
        if (voiceCommandActive && voiceEnabled && !isSpeechActive()) {
          startVoiceCommands();
        }
      }, 450);
    }
  };

  recognition.onend = () => {
    isListening = false;
    syncVoiceToggleUi();
    if (voiceCommandActive && voiceEnabled && !isSpeechActive()) {
      window.setTimeout(() => {
        if (voiceCommandActive && voiceEnabled && !isSpeechActive()) {
          startVoiceCommands();
        }
      }, 280);
    }
  };

  speechRecognition = recognition;
  return recognition;
}

function startVoiceCommands() {
  if (!voiceEnabled || !SpeechRecognitionCtor) return;
  if (isSpeechActive()) return;

  const canListen =
    state.conversationPhase === "user-intro" ||
    (quizResponse?.classList.contains("response-visible") && getChoiceButtons().length > 0);

  if (!canListen) return;

  const recognition = initSpeechRecognition();
  if (!recognition) return;

  voiceCommandActive = true;

  try {
    recognition.start();
    isListening = true;
    syncVoiceToggleUi();
  } catch {
    isListening = false;
    syncVoiceToggleUi();
  }
}

function stopVoiceCommands() {
  voiceCommandActive = false;
  isListening = false;
  syncVoiceToggleUi();

  if (speechRecognition) {
    try {
      speechRecognition.stop();
    } catch {
      // Ignore stop errors when recognition is already idle.
    }
  }
}

function getResponseVoiceHint() {
  if (state.conversationPhase === "user-intro") {
    return "Tell me about yourself, then say next when you are finished.";
  }

  const buttons = getChoiceButtons();
  if (!buttons.length) return "";

  if (buttons.length === 1) {
    return `Say ${buttons[0].textContent.trim()} to continue.`;
  }

  if (buttons.length === 2 && buttons.every((btn) => ["yes", "no"].includes(normalizeSpeech(btn.textContent)))) {
    return "Say yes or no.";
  }

  return "Say option one or two, or speak your answer aloud.";
}

function speakResponsePrompt() {
  if (!voiceEnabled) return;

  const hint = getResponseVoiceHint();
  const prompt = hint ? `Your response. ${hint}` : "Your response.";
  speakText(prompt, { onEnd: () => startVoiceCommands() });
}

function setVoiceEnabled(enabled) {
  voiceEnabled = enabled;
  syncVoiceToggleUi();
  if (!voiceEnabled) {
    stopVoiceCommands();
    stopSpeaking();
  }
}

if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    getPreferredVoice();
  };
}

const MANAGER_INTRO_TEXT =
  "Hello! I'm Hanif Butt, manager of this company. Welcome aboard - before we jump into a few workplace scenarios, I'd love a quick intro from you.";
const MANAGER_READY_TEXT = "Are you ready for doing the test?";
const MANAGER_COMPLETION_TEXT =
  "Congratulations! You have successfully completed the assessment. Please select the button below to review your detailed personality analytics and results.";

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
  setIntroResponseVisible(false);
}

function hideResponsePanel() {
  quizResponse?.classList.remove("response-visible");
  stopVoiceCommands();
}

function showResponsePanel() {
  quizResponse?.classList.add("response-visible");
  speakResponsePrompt();
}

function setIntroResponseVisible(visible) {
  if (!introResponse) return;
  introResponse.classList.toggle("visible", visible);
  if (visible) {
    choices.innerHTML = "";
    introSpeechBase = "";
    if (userIntroInput) {
      userIntroInput.value = "";
      userIntroInput.focus();
    }
    syncIntroNextEnabled();
  } else {
    introSpeechBase = "";
  }
}

function syncIntroNextEnabled() {
  if (!introNextBtn || !userIntroInput) return;
  introNextBtn.disabled = userIntroInput.value.trim().length < 2;
}

function showQuizOverlay() {
  panel.style.display = "block";
  quizOverlay.classList.add("visible");
  gameScreen.classList.remove("visible");
  void gameScreen.offsetWidth;
  gameScreen.classList.add("visible");
  updateDialoguePanelPosition();
}

function hideAnalyticsOverlay() {
  analyticsOverlay?.classList.remove("visible");
}

function hideAllScreens() {
  titleScreen.classList.remove("screen-visible");
  hideQuizOverlay();
  hideAnalyticsOverlay();
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

const TRAIT_MAX_SCORE = 5;

const traitFeedback = {
  O: {
    high: "You lean toward curiosity, experimentation, and creative problem-solving. New tools and ideas energize you rather than overwhelm you.",
    moderate: "You balance practical routines with openness to useful change. You adopt innovation when the value is clear.",
    low: "You prefer proven workflows and familiar systems. Stability helps you stay focused and deliver consistent results.",
  },
  C: {
    high: "You are structured, reliable, and deadline-driven. Planning ahead and breaking work into steps comes naturally to you.",
    moderate: "You can organize effectively when needed, though you may occasionally rely on momentum over detailed planning.",
    low: "You work best with flexibility and may prefer adapting in the moment rather than following rigid schedules.",
  },
  E: {
    high: "You gain energy from people, networking, and visible collaboration. You communicate confidently in group settings.",
    moderate: "You collaborate well but also value focused solo work. You choose social engagement based on context.",
    low: "You prefer deep individual work or small-group interaction. You contribute thoughtfully without needing the spotlight.",
  },
  A: {
    high: "You prioritize harmony, empathy, and compromise. You listen actively and seek solutions that work for everyone.",
    moderate: "You can be assertive when needed while still respecting others' perspectives in most situations.",
    low: "You are direct and confident in your decisions. You prioritize outcomes and clarity over consensus.",
  },
  N: {
    high: "You may feel pressure intensely under uncertainty. Awareness of stress triggers can help you build calming routines.",
    moderate: "You experience normal workplace stress but generally recover and refocus with support or structure.",
    low: "You stay composed under pressure and recover quickly from setbacks. Crisis moments rarely derail your focus.",
  },
};

const workplaceStrengths = {
  O: "Innovation, learning agility, and adaptability to change",
  C: "Reliability, planning, and strong execution discipline",
  E: "Team energy, stakeholder communication, and networking",
  A: "Collaboration, conflict resolution, and team trust",
  N: "Calm decision-making and resilience during high-pressure moments",
};

const growthSuggestions = {
  O: "Try one new workflow improvement each month to stay adaptable without losing focus.",
  C: "Use a simple daily priority list to protect deadlines when workload spikes.",
  E: "Schedule intentional collaboration blocks while preserving time for deep work.",
  A: "Practice assertive communication so your ideas are heard while staying respectful.",
  N: "Build a brief reset ritual (breathing, walk, or checklist) before high-stakes meetings.",
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
  conversationPhase: "idle",
  userIntro: "",
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

const officeAmbient = new THREE.AmbientLight(0xb87848, 0.42);
const officeHemi = new THREE.HemisphereLight(0xffc990, 0x2a1408, 0.55);
const officeCeiling = new THREE.DirectionalLight(0xfff0dc, 0.72);
officeCeiling.position.set(0, 12, 2);
const officeDeskFill = new THREE.PointLight(0xffd4a8, 0.75, 16, 1.6);
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
  reverse: false,
  progress: 0,
  duration: 4.8,
  mode: "exterior",
  start: new THREE.Vector3(),
  end: new THREE.Vector3(),
  lookAt: new THREE.Vector3(),
  lookAtEnd: new THREE.Vector3(),
  onComplete: null,
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

function easeInOutQuint(t) {
  return t < 0.5
    ? 16 * t * t * t * t * t
    : 1 - Math.pow(-2 * t + 2, 5) / 2;
}

function clampDelta(delta) {
  // Prevent hitch jumps after load/tab switch without slowing high-FPS playback
  return THREE.MathUtils.clamp(delta, 0, 1 / 24);
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
  const t = easeInOutQuint(THREE.MathUtils.clamp(alpha, 0, 1));
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
  playMusicTrack("intro");
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
  playOfficeAnimationMusic();
}

function startQuestionFlow() {
  state.currentQuestionIndex = 0;
  state.showDialogue = true;
  state.introPlaying = false;
  state.conversationPhase = "manager-intro";
  state.userIntro = "";
  panel.style.display = "block";
  setGameplayUiVisible(false);
  startManagerGreeting();
}

function startManagerGreeting() {
  state.showDialogue = true;
  state.conversationPhase = "manager-intro";
  hideResponsePanel();
  setIntroResponseVisible(false);
  choices.innerHTML = "";
  updateSpeakerUi("Manager", "Meet your Manager", "manager", "Manager");
  showQuizOverlay();
  updateDialoguePanelPosition();
  dialogue.textContent = "";
  startTypewriter(MANAGER_INTRO_TEXT, "Manager", "manager", () => {
    state.conversationPhase = "user-intro";
    setIntroResponseVisible(true);
    showResponsePanel();
  });
}

function submitUserIntro() {
  if (state.conversationPhase !== "user-intro") return;

  const intro = userIntroInput?.value.trim() || "";
  if (intro.length < 2) return;

  state.userIntro = intro;
  hideResponsePanel();
  setIntroResponseVisible(false);
  userIntroInput.value = "";
  syncIntroNextEnabled();
  startReadyConfirmation();
}

function startReadyConfirmation() {
  state.conversationPhase = "ready-confirm";
  hideResponsePanel();
  setIntroResponseVisible(false);
  choices.innerHTML = "";
  updateSpeakerUi("Manager", "Meet your Manager", "manager", "Manager");
  showQuizOverlay();
  updateDialoguePanelPosition();
  dialogue.textContent = "";
  startTypewriter(MANAGER_READY_TEXT, "Manager", "manager", showReadyChoices);
}

function showReadyChoices() {
  choices.innerHTML = "";

  const yesBtn = document.createElement("button");
  yesBtn.className = "choice-btn";
  yesBtn.textContent = "Yes";
  yesBtn.addEventListener("click", () => {
    stopTypewriter();
    state.conversationPhase = "assessment";
    renderQuestion(0);
  });

  const noBtn = document.createElement("button");
  noBtn.className = "choice-btn";
  noBtn.textContent = "No";
  noBtn.addEventListener("click", () => {
    stopTypewriter();
    resetToTitleScreen();
  });

  choices.appendChild(yesBtn);
  choices.appendChild(noBtn);
  showResponsePanel();
}

function startCompletionGreeting() {
  stopTimer();
  state.conversationPhase = "completion";
  state.showDialogue = true;
  panel.style.display = "block";
  hideResponsePanel();
  setIntroResponseVisible(false);
  choices.innerHTML = "";
  updateSpeakerUi("Manager", "Assessment Complete", "manager", "Manager");
  showQuizOverlay();
  updateDialoguePanelPosition();
  dialogue.textContent = "";
  startTypewriter(MANAGER_COMPLETION_TEXT, "Manager", "manager", showCompletionAction);
}

function showCompletionAction() {
  choices.innerHTML = "";

  const viewResultsBtn = document.createElement("button");
  viewResultsBtn.className = "choice-btn";
  viewResultsBtn.textContent = "View Results";
  viewResultsBtn.addEventListener("click", () => {
    stopTypewriter();
    beginResultsPresentation();
  });

  choices.appendChild(viewResultsBtn);
  showResponsePanel();
}

function finishOfficeIntroCinematic() {
  stopOfficeAnimationMusic();
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

  const step = clampDelta(delta);

  if (introCamera.reverse) {
    introCamera.progress -= step / introCamera.duration;
    if (introCamera.progress <= 0) {
      applyIntroCameraView(0);
      finishIntroCinematicReverse();
      return true;
    }
    applyIntroCameraView(introCamera.progress);
    return false;
  }

  introCamera.progress += step / introCamera.duration;
  if (introCamera.progress >= 1) {
    applyIntroCameraView(1);
    finishIntroCinematic();
    return true;
  }

  applyIntroCameraView(introCamera.progress);
  return false;
}

function finishIntroCinematicReverse() {
  stopOfficeAnimationMusic();
  introCamera.active = false;
  introCamera.reverse = false;
  introCamera.progress = 0;
  state.introPlaying = false;

  const callback = introCamera.onComplete;
  introCamera.onComplete = null;
  callback?.();
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
  const idleClip =
    findClip(gltf.animations, /sit|seated|sitting|idle|stand|neutral|breath|pose/i) ||
    gltf.animations[0];
  const walkClip = findClip(gltf.animations, /walk|run|move|loco/i);

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
  next.clampWhenFinished = !loop;
  next.setEffectiveTimeScale(1);
  next.setEffectiveWeight(1);

  if (animator.activeAction && animator.activeAction !== next) {
    animator.activeAction.fadeOut(0.45);
    next.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity).fadeIn(0.45).play();
  } else if (animator.activeAction !== next) {
    next.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity).fadeIn(0.35).play();
  }

  animator.activeAction = next;
}

function updateNpcAnimators(delta) {
  const dt = clampDelta(delta);
  for (const animator of npcAnimators.values()) {
    if (!animator) continue;
    if (animator.moveJob?.step) animator.moveJob.step(dt);
    animator.mixer.update(dt);
  }
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
  const desk = getOfficeObjectBounds(/^Desk$/i);

  if (model.parent !== scene) {
    model.parent?.remove(model);
    scene.add(model);
  }

  model.visible = true;
  model.rotation.set(0, 0, 0);
  model.position.set(0, 0, 0);
  // Keep any prior unit normalize (cm → m), don't force scale back to 1.
  model.updateMatrixWorld(true);

  const modelBox = new THREE.Box3().setFromObject(model);
  const modelHeight = modelBox.getSize(new THREE.Vector3()).y;
  const targetHeight = 1.72;
  const unitScale = model.scale.x || 1;
  model.scale.setScalar(unitScale * (targetHeight / Math.max(modelHeight, 0.001)));
  model.updateMatrixWorld(true);

  // Face the desk, then yaw slightly right so he faces the player better.
  if (desk) {
    model.rotation.y =
      Math.atan2(desk.center.x - chairCenter.x, desk.center.z - chairCenter.z) -
      THREE.MathUtils.degToRad(20);
  }

  const animator = npcAnimators.get("manager");
  if (animator?.mixer) animator.mixer.update(0);
  model.updateMatrixWorld(true);

  const hipWorld = new THREE.Vector3();
  let hasHip = false;
  model.traverse((child) => {
    if (hasHip || !child.isBone) return;
    if (/hips/i.test(child.name)) {
      child.getWorldPosition(hipWorld);
      hasHip = true;
    }
  });

  if (!hasHip) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    hipWorld.set(
      (box.min.x + box.max.x) * 0.5,
      box.min.y + size.y * 0.45,
      (box.min.z + box.max.z) * 0.5
    );
  }

  // Seat surface + pull slightly toward the desk so he sits in the cushion, not behind the backrest.
  const seatY = chairBox.min.y + chairSize.y * 0.56;
  let targetX = chairCenter.x;
  let targetZ = chairCenter.z;
  if (desk) {
    const towardDesk = Math.sign(desk.center.z - chairCenter.z) || 1;
    targetZ = chairCenter.z + towardDesk * chairSize.z * 0.22;
  }

  model.position.set(
    targetX - hipWorld.x,
    seatY - hipWorld.y,
    targetZ - hipWorld.z
  );

  prepareManagerMaterials(model);
  model.updateMatrixWorld(true);
}

function loadFbx(path) {
  return new Promise((resolve, reject) => {
    new FBXLoader().load(path, resolve, undefined, reject);
  });
}

function setupManagerAnimation(model) {
  const clip = model.animations?.[0];
  if (!clip) {
    console.warn("[Manager] dashing_manager.fbx has no embedded animation.");
    return null;
  }

  const mixer = new THREE.AnimationMixer(model);
  const animator = {
    id: "manager",
    mixer,
    model,
    idleClip: clip,
    walkClip: null,
    activeAction: null,
    moveJob: null,
  };

  playNpcClip(animator, clip, true);
  npcAnimators.set("manager", animator);
  managerAnimReady = true;
  console.info("[Manager] dashing_manager.fbx wired:", clip.name, clip.tracks.length, "tracks");
  return animator;
}

function normalizeManagerUnits(model) {
  model.updateMatrixWorld(true);
  const rawHeight = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
  if (rawHeight > 10) {
    model.scale.setScalar(0.01);
    model.updateMatrixWorld(true);
  }
}

async function ensureManagerModel() {
  if (npcs.manager) return npcs.manager;

  if (!managerEnvironmentReady) {
    managerEnvironmentReady = loadFbx(DASHING_MANAGER_FBX)
      .then((fbx) => {
        npcs.manager = fbx;
        npcs.manager.visible = false;
        normalizeManagerUnits(npcs.manager);
        prepareModelMeshes(npcs.manager);
        prepareManagerMaterials(npcs.manager);
        discoverLipSync(npcs.manager, "manager");
        setupManagerAnimation(npcs.manager);
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

  const animator = npcAnimators.get("manager");
  if (animator?.mixer && animator.idleClip) {
    const action = animator.mixer.clipAction(animator.idleClip);
    action.time = Math.min(0.35, animator.idleClip.duration * 0.05);
    animator.mixer.update(0);
  }

  alignManagerToChair(npcs.manager, chairNode);
  npcs.manager.visible = true;

  const chairWorld = new THREE.Box3().setFromObject(chairNode);
  const chairCenter = chairWorld.getCenter(new THREE.Vector3());

  if (managerChairLight) {
    officeLights.remove(managerChairLight);
    if (managerChairLight.target) officeLights.remove(managerChairLight.target);
  }
  const chairLightSize = chairWorld.getSize(new THREE.Vector3());
  managerChairLight = new THREE.DirectionalLight(0xfff0dc, 0.75);
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
  stopSpeaking();
  stopVoiceCommands();
  stopAllLipSync();
}

function finishTypewriter(lipNpc) {
  dialogue.querySelector(".cursor")?.remove();
  if (!isSpeechActive()) {
    setLipSpeaking(lipNpc, false);
  }

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

  let typewriterDone = false;
  let speechDone = !voiceEnabled || !window.speechSynthesis;

  const tryFinishTypewriter = () => {
    if (!typewriterDone || !speechDone) return;
    finishTypewriter(lipNpc);
  };

  setLipSpeaking(lipNpc, true);
  if (voiceEnabled && window.speechSynthesis) {
    speakText(message, {
      npcId: lipNpc,
      onEnd: () => {
        speechDone = true;
        tryFinishTypewriter();
      },
    });
  }
  dialogue.innerHTML = '<span class="typed-text"></span><span class="cursor"></span>';

  const typed = dialogue.querySelector(".typed-text");
  if (!typed) {
    dialogue.textContent = message;
    typewriterDone = true;
    tryFinishTypewriter();
    return;
  }

  let index = 0;
  typed.textContent = "";

  typewriterId = window.setInterval(() => {
    if (index >= message.length) {
      clearInterval(typewriterId);
      typewriterId = null;
      typewriterDone = true;
      tryFinishTypewriter();
      return;
    }

    typed.textContent += message[index];
    index += 1;
  }, 28);
}

function getManagerHeadScreenPosition() {
  const fallback = {
    x: window.innerWidth * 0.58,
    y: window.innerHeight * 0.34,
  };

  if (!npcs.manager?.visible) {
    return fallback;
  }

  // Cheap world position from model root — avoid rebuilding Box3 every frame
  npcs.manager.getWorldPosition(managerHeadPos);
  const scaleY = npcs.manager.scale.y || 1;
  managerHeadPos.x += 0.28 * scaleY;
  managerHeadPos.y += 1.45 * scaleY;
  managerHeadScratch.copy(managerHeadPos).project(camera);

  if (managerHeadScratch.z > 1) {
    return fallback;
  }

  return {
    x: (managerHeadScratch.x * 0.5 + 0.5) * window.innerWidth,
    y: (-managerHeadScratch.y * 0.5 + 0.5) * window.innerHeight,
  };
}

function updateDialoguePanelPosition() {
  if (!state.showDialogue || !quizRightAnchor) return;

  const { x, y } = getManagerHeadScreenPosition();
  const cardW = quizRightAnchor.offsetWidth || 360;
  const margin = 16;
  const left = THREE.MathUtils.clamp(
    x + 48,
    window.innerWidth * 0.60,
    window.innerWidth - cardW - margin
  );
  const top = THREE.MathUtils.clamp(
    y - 70,
    margin + 8,
    window.innerHeight * 0.28
  );

  // Skip tiny DOM writes — they cause animation hitching
  if (
    Math.abs(left - lastDialogueAnchor.x) < 0.75 &&
    Math.abs(top - lastDialogueAnchor.y) < 0.75
  ) {
    return;
  }

  lastDialogueAnchor.x = left;
  lastDialogueAnchor.y = top;
  quizRightAnchor.style.left = `${left}px`;
  quizRightAnchor.style.top = `${top}px`;
}

function getWorkplaceStrength(key, score) {
  if (key === "N") {
    return score <= 2
      ? "Calm decision-making and resilience during high-pressure moments"
      : "Heightened awareness of risk and attention to detail under uncertainty";
  }
  return workplaceStrengths[key];
}

function getGrowthSuggestion(key, score) {
  if (key === "N") {
    return score >= 4
      ? growthSuggestions.N
      : "Maintain your composure — consider mentoring others during stressful project phases.";
  }
  return growthSuggestions[key];
}

function getTraitLevel(score) {
  if (score >= 4) return "high";
  if (score >= 3) return "moderate";
  return "low";
}

function getTraitLevelLabel(score) {
  const level = getTraitLevel(score);
  if (level === "high") return "Strong";
  if (level === "moderate") return "Moderate";
  return "Emerging";
}

function buildConciseSummary(dominant, average) {
  const style =
    average >= 3.5 ? "proactive" : average >= 2.5 ? "balanced" : "focused";
  return `${traitNames[dominant[0]]} leads your profile — a ${style}, workplace-ready style.`;
}

function buildConciseFeedback(report) {
  const strong = report.traitRows
    .filter((trait) => trait.score >= 4)
    .map((trait) => trait.name);
  const emerging = report.traitRows
    .filter((trait) => trait.score <= 2)
    .map((trait) => trait.name);

  let paragraph = strong.length
    ? `You consistently show ${strong.join(" and ").toLowerCase()}, making you dependable in structured team settings.`
    : "You take a measured, context-driven approach across workplace scenarios.";

  if (emerging.length) {
    paragraph += ` ${emerging.join(" and ")} may feel less natural, but small intentional shifts can broaden your impact.`;
  }

  const managerQuote = report.managerNote
    .replace(/^Hanif's feedback:\s*/i, "")
    .replace(/^"/, "")
    .replace(/"$/, "");
  paragraph += ` ${managerQuote}`;

  return paragraph;
}

function getOverallPerformancePercent(scores) {
  const values = Object.values(scores);
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / (values.length * TRAIT_MAX_SCORE)) * 100);
}

function renderRingMarkup(id, pct, options = {}) {
  const {
    size = 132,
    radius = 52,
    stroke = 10,
    label = "",
    modifier = "",
  } = options;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (pct / 100) * circumference;
  const gradId = `ringGrad-${id}`;

  return (
    `<div class="analytics-ring ${modifier}">` +
    `<svg width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">` +
    `<defs>` +
    `<linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">` +
    `<stop offset="0%" stop-color="#e07a1f" />` +
    `<stop offset="100%" stop-color="#ffb347" />` +
    `</linearGradient>` +
    `</defs>` +
    `<circle class="analytics-ring-bg" cx="60" cy="60" r="${radius}" stroke-width="${stroke}" />` +
    `<circle class="analytics-ring-fill" cx="60" cy="60" r="${radius}" stroke-width="${stroke}" ` +
    `stroke="url(#${gradId})" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" ` +
    `data-offset="${targetOffset}" />` +
    `</svg>` +
    `<div class="analytics-ring-label">` +
    `<span class="analytics-ring-pct">${pct}%</span>` +
    (label ? `<span class="analytics-ring-trait">${label}</span>` : "") +
    `</div>` +
    `</div>`
  );
}

function animateAnalyticsRings(container) {
  requestAnimationFrame(() => {
    container?.querySelectorAll(".analytics-ring-fill").forEach((ring) => {
      if (ring.dataset.offset) {
        ring.style.strokeDashoffset = ring.dataset.offset;
      }
    });
  });
}

function renderOverallPerformanceRing(overallPct) {
  analyticsDominant.innerHTML = renderRingMarkup("overall", overallPct, {
    size: 132,
    radius: 52,
    stroke: 10,
    label: "Overall Performance",
    modifier: "analytics-ring--hero",
  });
  animateAnalyticsRings(analyticsDominant);
}

function renderTraitRings(traitRows) {
  analyticsTraits.innerHTML = traitRows
    .map((trait) => {
      const pct = Math.round((trait.score / trait.max) * 100);
      return (
        `<div class="trait-ring-card">` +
        renderRingMarkup(`trait-${trait.key}`, pct, {
          size: 108,
          radius: 48,
          stroke: 9,
          modifier: "analytics-ring--sm",
        }) +
        `<span class="trait-ring-name">${trait.name}</span>` +
        `<span class="trait-ring-level">${trait.level}</span>` +
        `</div>`
      );
    })
    .join("");

  animateAnalyticsRings(analyticsTraits);
}

function buildPersonalityReport() {
  const scores = {
    O: state.stats.O,
    C: state.stats.C,
    E: state.stats.E,
    A: state.stats.A,
    N: state.stats.N,
  };

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const dominant = ranked[0];
  const lowest = ranked[ranked.length - 1];
  const average = ranked.reduce((sum, [, score]) => sum + score, 0) / ranked.length;
  const profileSummary = buildConciseSummary(dominant, average);

  const traitRows = Object.entries(scores).map(([key, score]) => ({
    key,
    name: traitNames[key],
    score,
    max: TRAIT_MAX_SCORE,
    level: getTraitLevelLabel(score),
    feedback: traitFeedback[key][getTraitLevel(score)],
  }));

  const strengths = ranked
    .slice(0, 2)
    .map(([key, score]) => `<li>${getWorkplaceStrength(key, score)}</li>`)
    .join("");

  const growth = ranked
    .slice(-2)
    .reverse()
    .map(([key, score]) => `<li>${getGrowthSuggestion(key, score)}</li>`)
    .join("");

  const managerNote =
    dominant[1] >= 4
      ? `Hanif's feedback: "Your ${traitNames[dominant[0]]} stood out — strong fit for roles needing ${dominant[0] === "O" ? "innovation" : dominant[0] === "C" ? "ownership" : dominant[0] === "E" ? "collaboration" : dominant[0] === "A" ? "team alignment" : "composure"}."`
      : `Hanif's feedback: "Solid overall profile — sharpening ${traitNames[lowest[0]]} will boost cross-team effectiveness."`;

  const report = {
    scores,
    dominant,
    overallPerformance: getOverallPerformancePercent(scores),
    profileSummary,
    traitRows,
    strengthsHtml: strengths,
    growthHtml: growth,
    managerNote,
  };

  report.feedbackParagraph = buildConciseFeedback(report);
  return report;
}

function renderAnalyticsPanel(report) {
  analyticsTitle.textContent = "Your Personality Analytics";
  analyticsSubtitle.textContent = report.profileSummary;

  renderOverallPerformanceRing(report.overallPerformance);
  renderTraitRings(report.traitRows);

  analyticsFeedback.innerHTML =
    `<h3>Trait Feedback</h3><p>${report.feedbackParagraph}</p>`;

  analyticsWorkplace.innerHTML =
    `<h3>Workplace Strengths</h3><ul>${report.strengthsHtml}</ul>`;

  analyticsGrowth.innerHTML =
    `<h3>Growth Recommendations</h3><ul>${report.growthHtml}</ul>`;
}

function setupResultsCamera() {
  if (!worldData) return;

  const chair = getOfficeChairWorldTarget();
  const { floorY } = worldData;

  if (chair) {
    camera.position.set(
      chair.center.x - Math.max(chair.size.x * 2.1, 1.4),
      floorY + 1.32,
      chair.center.z + chair.size.z * 0.55
    );
    camera.lookAt(
      chair.center.x + chair.size.x * 0.15,
      chair.center.y + chair.size.y * 0.28,
      chair.center.z - chair.size.z * 0.05
    );
    return;
  }

  applyIntroCameraView(0.22);
}

function showAnalyticsOverlay(report) {
  setupResultsCamera();
  setupManagerOnChair();
  if (npcs.manager) npcs.manager.visible = true;

  panel.style.display = "block";
  hideQuizOverlay();
  resultScreen.classList.remove("screen-visible");
  renderAnalyticsPanel(report);
  analyticsOverlay?.classList.add("visible");
  setGameplayUiVisible(false);
  setStatus("Review your analytics", false);
  playMusicTrack("victory");
}

function startOfficeOutroCinematic(onComplete) {
  setupOfficeIntroCamera();
  flushClockDelta();
  introCamera.active = true;
  introCamera.reverse = true;
  introCamera.progress = 1;
  introCamera.onComplete = onComplete;
  state.introPlaying = true;
  state.showDialogue = false;
  hideQuizOverlay();
  hideAnalyticsOverlay();
  setIntroResponseVisible(false);
  setGameplayUiVisible(false);
  applyIntroCameraView(1);
  playOfficeAnimationMusic();
}

function beginResultsPresentation() {
  state.isPlaying = false;
  state.awaitingPlay = false;
  state.conversationPhase = "results";
  stopTimer();
  stopTypewriter();
  panel.style.display = "block";

  const report = buildPersonalityReport();
  state.lastReport = report;

  setActiveEnvironment("office");
  setupManagerOnChair();

  startOfficeOutroCinematic(() => {
    showAnalyticsOverlay(report);
  });
}

function endGame() {
  beginResultsPresentation();
}

function renderQuestion(index) {
  const scenario = scenarios[index];
  if (!scenario) {
    endGame();
    return;
  }

  state.showDialogue = true;
  state.conversationPhase = "assessment";
  state.currentQuestionIndex = index;
  panel.style.display = "block";
  hideResponsePanel();
  setIntroResponseVisible(false);
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
        startCompletionGreeting();
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
  scene.background.set(mode === "office" ? 0x1c120c : 0x10141b);
  renderer.toneMappingExposure = mode === "office" ? 1.15 : 1;
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
      child.castShadow = false;
      child.receiveShadow = false;
      child.frustumCulled = true;
      if (child.geometry && !child.geometry.boundingSphere) {
        child.geometry.computeBoundingSphere();
      }
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
    const accent = new THREE.PointLight(0xff8833, 3.6, 11, 1.6);
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
      const accent = new THREE.PointLight(0xff8833, 3.2, 12, 1.6);
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

/** Push laptop toward desk front / camera so manager hand gestures don't clip into it. */
function nudgeOfficeLaptopAwayFromChair(model) {
  let laptop = null;
  model.traverse((child) => {
    if (!laptop && /Lenovo_laptop/i.test(child.name || "")) laptop = child;
  });
  if (!laptop) {
    console.warn("[Office] Lenovo_laptop not found — skip nudge.");
    return;
  }

  // Chair sits at lower Z; desk/camera at higher Z — nudge laptop +Z toward the viewer.
  laptop.position.z += 0.22;
  laptop.updateMatrixWorld(true);
}

async function ensureOfficeEnvironment() {
  if (officeModel) return officeModel;

  if (!officeEnvironmentReady) {
    officeEnvironmentReady = loadGltf("./assets/CEO_Office_Design.glb").then((gltf) => {
      officeModel = normalizeOfficeModel(gltf.scene);
      officeModel.visible = false;
      prepareModelMeshes(officeModel);
      prepareOfficeMaterials(officeModel);
      nudgeOfficeLaptopAwayFromChair(officeModel);
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
  state.conversationPhase = "idle";
  state.userIntro = "";
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
    state.conversationPhase = "idle";
    state.userIntro = "";
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
  if (isHarryMeetingDemoActive()) {
    exitHarryMeetingDemo();
  }
  stopTimer();
  stopTypewriter();
  stopVoiceCommands();
  stopSpeaking();
  stopOfficeAnimationMusic();
  state.isPlaying = false;
  state.introPlaying = false;
  state.awaitingPlay = true;
  introCamera.active = false;
  introCamera.reverse = false;
  introCamera.onComplete = null;
  introCamera.progress = 1;
  state.showDialogue = false;
  state.conversationPhase = "idle";
  state.userIntro = "";
  state.stats = { ...initialStats };
  state.currentQuestionIndex = 0;
  state.lastReport = null;
  panel.style.display = "none";
  hideAnalyticsOverlay();
  setIntroResponseVisible(false);
  setGameplayUiVisible(false);
  activateExteriorTitleView();
  showScreen(titleScreen);
  playMusicTrack("intro");
}

playBtn.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  musicUnlocked = true;
  stopAllMusic();
  startGame();
});

meetingDemoBtn?.addEventListener("click", async (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (isHarryMeetingDemoActive()) return;

  musicUnlocked = true;
  meetingDemoBtn.disabled = true;
  const originalLabel = meetingDemoBtn.textContent;
  meetingDemoBtn.textContent = "Loading...";

  try {
    await enterHarryMeetingDemo();
  } finally {
    meetingDemoBtn.disabled = false;
    meetingDemoBtn.textContent = originalLabel;
  }
});

meetingDemoBackBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  exitHarryMeetingDemo();
});

initHarryMeetingDemo({
  scene,
  camera,
  get exteriorModel() {
    return exteriorModel;
  },
  get officeModel() {
    return officeModel;
  },
  npcs,
  exteriorLights,
  officeLights,
  loadGltf,
  prepareModelMeshes,
  speakText,
  stopSpeaking,
  stopAllLipSync,
  stopAllMusic,
  playMusicTrack,
  setStatus,
  hideTitleScreen: () => titleScreen.classList.remove("screen-visible"),
  showTitleScreen: () => titleScreen.classList.add("screen-visible"),
  restoreTitleView: () => activateExteriorTitleView(),
  ui: {
    screen: meetingDemoScreen,
    subtitleEl: meetingDemoSubtitle,
    progressEl: meetingDemoProgress,
    backBtn: meetingDemoBackBtn,
  },
});
restartBtn.addEventListener("click", resetToTitleScreen);

analyticsFinishBtn?.addEventListener("click", resetToTitleScreen);

musicToggleBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  musicUnlocked = true;
  setMusicEnabled(!musicEnabled);
});

voiceToggleBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  musicUnlocked = true;
  setVoiceEnabled(!voiceEnabled);
});

document.addEventListener(
  "click",
  (e) => {
    const btn = e.target.closest("button");
    if (!btn || btn.disabled) return;
    playButtonClick();
  },
  true
);

window.addEventListener(
  "pointerdown",
  () => {
    if (!musicUnlocked && musicEnabled) {
      unlockAndPlayMusic();
    }
  },
  { once: true, capture: true }
);

syncMusicToggleUi();
syncVoiceToggleUi();

userIntroInput?.addEventListener("input", () => {
  introSpeechBase = userIntroInput?.value || "";
  syncIntroNextEnabled();
});
userIntroInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submitUserIntro();
  }
});
introNextBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  submitUserIntro();
});

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
  const delta = clampDelta(clock.getDelta());

  if (isHarryMeetingDemoActive()) {
    updateHarryMeetingDemo(delta);
  } else {
    if (introCamera.active) {
      updateIntroCinematic(delta);
    }

    updateLipSync(delta);
    updateNpcAnimators(delta);
    updateDialoguePanelPosition();
  }

  renderer.render(scene, camera);
}

animate();
