// Web Audio Ambient Synthesizer for Fancy RSVP
// Allows browser-native royalty-free preview music playback

let audioCtx = null;
let masterGain = null;
let delayNode = null;
let delayGain = null;
let filterNode = null;
let sequencerInterval = null;
let noteIndex = 0;
let isPlaying = false;
let currentGenre = "romantic";

const CHORDS = {
  romantic: [
    [130.81, 164.81, 196.00, 246.94, 329.63], // Cmaj7
    [110.00, 130.81, 164.81, 196.00, 220.00], // Am7
    [87.31, 130.81, 174.61, 220.00, 261.63],  // Fmaj7
    [98.00, 146.83, 196.00, 246.94, 293.66]   // G7
  ],
  classical: [
    [130.81, 164.81, 196.00, 261.63],         // C Major
    [98.00, 146.83, 196.00, 246.94],          // G Major
    [110.00, 164.81, 220.00, 261.63],         // A Minor
    [87.31, 130.81, 174.61, 261.63]          // F Major
  ],
  jazz: [
    [146.83, 174.61, 220.00, 261.63, 329.63], // Dm9
    [98.00, 123.47, 174.61, 246.94, 293.66],  // G13
    [130.81, 164.81, 196.00, 246.94, 329.63], // Cmaj9
    [116.54, 146.83, 196.00, 233.08, 293.66]  // Bbmaj9
  ],
  cinematic: [
    [110.00, 164.81, 220.00, 329.63],         // Asus2
    [87.31, 130.81, 174.61, 349.23],          // Fmaj7
    [130.81, 196.00, 261.63, 392.00],         // C Major
    [98.00, 146.83, 196.00, 293.66]           // G Major
  ]
};

function initAudio() {
  if (audioCtx) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContext();

  masterGain = audioCtx.createGain();
  masterGain.gain.setValueAtTime(0.06, audioCtx.currentTime); // Soft volume

  filterNode = audioCtx.createBiquadFilter();
  filterNode.type = "lowpass";
  filterNode.frequency.setValueAtTime(900, audioCtx.currentTime);

  delayNode = audioCtx.createDelay(1.0);
  delayNode.delayTime.setValueAtTime(0.4, audioCtx.currentTime);

  delayGain = audioCtx.createGain();
  delayGain.gain.setValueAtTime(0.35, audioCtx.currentTime); // Reverb feedback amount

  // Wire audio graph
  filterNode.connect(masterGain);
  filterNode.connect(delayNode);
  delayNode.connect(delayGain);
  delayGain.connect(filterNode); // Feedback loop
  delayGain.connect(masterGain);
  masterGain.connect(audioCtx.destination);
}

function playPluck(freq, time, type = "sine") {
  if (!audioCtx) return;
  
  const osc = audioCtx.createOscillator();
  const pluckGain = audioCtx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  
  pluckGain.gain.setValueAtTime(0, time);
  // Smooth fast attack
  pluckGain.gain.linearRampToValueAtTime(0.6, time + 0.02);
  // Exponential decay
  pluckGain.gain.exponentialRampToValueAtTime(0.001, time + 0.7);
  
  osc.connect(pluckGain);
  pluckGain.connect(filterNode);
  
  osc.start(time);
  osc.stop(time + 0.8);
}

export function startSynth(genre = "romantic") {
  if (typeof window === "undefined") return;
  currentGenre = genre;
  
  try {
    initAudio();
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  } catch (e) {
    console.error("Failed to initialize Web Audio API Synth", e);
    return;
  }
  
  if (isPlaying) {
    return;
  }
  
  isPlaying = true;
  noteIndex = 0;
  let chordIndex = 0;
  let step = 0;
  
  const getOscType = (g) => {
    switch (g) {
      case "jazz": return "triangle";
      case "classical": return "sine";
      case "cinematic": return "triangle";
      default: return "sine";
    }
  };
  
  const speed = genre === "cinematic" ? 480 : 340; 

  sequencerInterval = setInterval(() => {
    if (!isPlaying) return;
    const time = audioCtx.currentTime;
    const chordsList = CHORDS[currentGenre] || CHORDS.romantic;
    const currentChord = chordsList[chordIndex];
    const oscType = getOscType(currentGenre);
    
    if (currentGenre === "cinematic") {
      // Cinematic plays swelling pads on slow intervals
      if (step % 4 === 0) {
        currentChord.forEach((freq, idx) => {
          const swellOsc = audioCtx.createOscillator();
          const swellGain = audioCtx.createGain();
          
          swellOsc.type = "sine";
          swellOsc.frequency.setValueAtTime(freq, time + idx * 0.06);
          
          swellGain.gain.setValueAtTime(0, time + idx * 0.06);
          swellGain.gain.linearRampToValueAtTime(0.25, time + 0.8);
          swellGain.gain.exponentialRampToValueAtTime(0.001, time + 2.8);
          
          swellOsc.connect(swellGain);
          swellGain.connect(filterNode);
          swellOsc.start(time + idx * 0.06);
          swellOsc.stop(time + 3.0);
        });
        chordIndex = (chordIndex + 1) % chordsList.length;
      }
    } else {
      // Romantic / Jazz / Classical play arpeggios
      const noteFreq = currentChord[noteIndex];
      
      // Bass anchor pluck
      if (noteIndex === 0) {
        playPluck(noteFreq / 2, time, "sine");
      }
      
      playPluck(noteFreq, time, oscType);
      
      noteIndex = (noteIndex + 1) % currentChord.length;
      if (noteIndex === 0) {
        chordIndex = (chordIndex + 1) % chordsList.length;
      }
    }
    
    step++;
  }, speed);
}

export function stopSynth() {
  isPlaying = false;
  if (sequencerInterval) {
    clearInterval(sequencerInterval);
    sequencerInterval = null;
  }
}

export function getIsPlaying() {
  return isPlaying;
}
