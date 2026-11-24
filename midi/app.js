(() => {
  const tracks = [
    { name: "Melody", instrument: "Soft Keys · Electric piano", icon: "✳", color: "#a98bff", bg: "#302747", program: 4, notes: [], muted: false, solo: false },
    { name: "Drums", instrument: "Studio Kit · Percussion", icon: "♨", color: "#ff7f9d", bg: "#482832", program: 0, notes: [], muted: false, solo: false },
    { name: "Rhythm", instrument: "Warm Pluck · Synth", icon: "◈", color: "#5ed4d1", bg: "#203c3d", program: 81, notes: [], muted: false, solo: false },
    { name: "Bass", instrument: "Deep Bass · Synth", icon: "▰", color: "#ffad67", bg: "#493424", program: 38, notes: [], muted: false, solo: false }
  ];
  const $ = (selector) => document.querySelector(selector);
  const trackList = $("#trackList"), ruler = $("#ruler"), timeline = $("#timeline");
  let bars = 4, beatWidth = 45, octave = 4, selectedTrack = 0, tempo = 120, metronome = true;
  let audioContext = null, isPlaying = false, isRecording = false, startTime = 0, playheadStart = 0, animationFrame = 0, playTimer = 0, metronomeTimer = 0, toastTimer = 0;
  const held = new Map(), activeVoices = new Set(), keys = new Map();
  const keyMap = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ";": 16, "'": 17 };
  const beatSeconds = () => 60 / tempo;
  const totalBeats = () => bars * 4;
  const noteName = (midi) => ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][midi % 12] + (Math.floor(midi / 12) - 1);
  const clamp = (number, min, max) => Math.min(max, Math.max(min, number));

  function notify(message) {
    const toast = $("#toast"); toast.textContent = message; toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }
  function renderRuler() {
    ruler.replaceChildren();
    for (let i = 0; i < bars; i++) {
      const label = document.createElement("div"); label.className = "bar-label";
      label.style.setProperty("--bar-width", `${beatWidth * 4}px`);
      label.innerHTML = `${String(i + 1).padStart(2, "0")} <span>BAR</span>`; ruler.append(label);
    }
    ruler.style.setProperty("--bar-width", `${beatWidth * 4}px`);
  }
  function renderTracks() {
    trackList.replaceChildren();
    tracks.forEach((track, index) => {
      const row = document.createElement("div"); row.className = "track-row";
      const info = document.createElement("div"); info.className = "track-info";
      info.innerHTML = `<span class="track-color" style="color:${track.color};background:${track.bg}">${track.icon}</span><div class="track-detail"><button class="track-name">${track.name}</button><span class="track-instrument">${track.instrument}</span></div>`;
      const lane = document.createElement("div"); lane.className = "lane-wrap"; lane.dataset.track = index;
      lane.style.minWidth = `${bars * beatWidth * 4}px`;
      lane.style.setProperty("--bar-width", `${beatWidth * 4}px`);
      track.notes.forEach((note, noteIndex) => {
        const block = document.createElement("div"); block.className = "note-block";
        const noteBeat = note.beat ?? 0;
        const noteDuration = note.duration ?? 1;
        block.style.left = `${noteBeat * beatWidth + 2}px`; block.style.width = `${Math.max(8, noteDuration * beatWidth - 4)}px`;
        const y = clamp((95 - note.pitch) * 2.45 + 5, 5, 61);
        block.style.top = `${y}px`; block.style.background = track.color; block.title = `${noteName(note.pitch)} · ${noteDuration.toFixed(2)} beats`;
        block.dataset.note = noteIndex;
        block.addEventListener("click", event => { event.stopPropagation(); if (event.altKey) { track.notes.splice(noteIndex, 1); renderTracks(); updateNoteCount(); } });
        lane.append(block);
      });
      lane.addEventListener("click", event => {
        if (event.target.closest(".note-block")) return;
        const rect = lane.getBoundingClientRect();
        const beat = clamp(Math.floor((event.clientX - rect.left) / beatWidth), 0, totalBeats() - 1);
        const pitch = clamp(95 - Math.floor((event.clientY - rect.top - 8) / 2.45), 36, 96);
        track.notes.push({ beat, duration: 1, pitch, velocity: 92 }); track.notes.sort((a, b) => a.beat - b.beat);
        renderTracks(); updateNoteCount();
      });
      const side = document.createElement("div"); side.className = "track-side";
      side.innerHTML = `<button aria-label="Mute ${track.name}" class="${track.muted ? "active-mute" : ""}">M</button><button aria-label="Solo ${track.name}" class="${track.solo ? "active-solo" : ""}">S</button>`;
      side.children[0].addEventListener("click", () => { track.muted = !track.muted; renderTracks(); });
      side.children[1].addEventListener("click", () => { track.solo = !track.solo; renderTracks(); });
      info.querySelector(".track-name").addEventListener("click", () => { selectedTrack = index; document.querySelectorAll(".track-name").forEach((el, i) => { el.style.color = i === index ? track.color : ""; }); });
      row.append(info, lane, side); trackList.append(row);
    });
    updatePlayhead();
  }
  function updateNoteCount() {
    const count = tracks.reduce((sum, track) => sum + track.notes.length, 0);
    $("#noteCount").textContent = `${count} ${count === 1 ? "note" : "notes"}`;
  }
  function updatePlayhead() {
    document.querySelectorAll(".playhead").forEach(el => el.remove());
    const lanes = [...document.querySelectorAll(".lane-wrap")];
    if (!lanes.length) return;
    const barPosition = isPlaying ? ((audioContext.currentTime - startTime) / beatSeconds()) % totalBeats() : playheadStart;
    const playhead = document.createElement("div"); playhead.className = "playhead"; playhead.style.left = `${barPosition * beatWidth}px`;
    lanes.forEach(lane => lane.append(playhead.cloneNode()));
  }
  function renderKeyboard() {
    const keyboard = $("#keyboard"); keyboard.replaceChildren(); keys.clear();
    const base = (octave + 1) * 12, whiteNotes = [0, 2, 4, 5, 7, 9, 11], blackNotes = [1, 3, 6, 8, 10];
    for (let i = 0; i < 14; i++) {
      const pitch = base + Math.floor(i / 7) * 12 + whiteNotes[i % 7];
      const key = document.createElement("button"); key.type = "button"; key.className = "key"; key.dataset.pitch = pitch;
      if (i % 7 === 0 || i === 7) key.innerHTML = `<span class="key-label">${noteName(pitch)}</span>`;
      addKeyEvents(key, pitch); keyboard.append(key); keys.set(pitch, key);
    }
    const whiteWidth = 100 / 14;
    for (let octaveIndex = 0; octaveIndex < 2; octaveIndex++) {
      for (let n = 0; n < 7; n++) {
        if (!blackNotes.includes([0, 2, 4, 5, 7, 9, 11][n] + 1)) continue;
        const position = octaveIndex * 7 + n;
        const pitch = base + octaveIndex * 12 + [0, 2, 4, 5, 7, 9, 11][n] + 1;
        const key = document.createElement("button"); key.type = "button"; key.className = "key black"; key.style.left = `${(position + 1) * whiteWidth}%`; key.dataset.pitch = pitch;
        addKeyEvents(key, pitch); keyboard.append(key); keys.set(pitch, key);
      }
    }
    $("#octaveLabel").textContent = `OCT ${octave}`;
  }
  function addKeyEvents(key, pitch) {
    key.addEventListener("pointerdown", event => { event.preventDefault(); key.setPointerCapture(event.pointerId); noteOn(pitch); });
    key.addEventListener("pointerup", () => noteOff(pitch));
    key.addEventListener("pointercancel", () => noteOff(pitch));
    key.addEventListener("lostpointercapture", () => noteOff(pitch));
  }
  async function getAudio() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") await audioContext.resume();
    return audioContext;
  }
  function createNoise(context, duration) {
    const buffer = context.createBuffer(1, Math.max(1, Math.ceil(context.sampleRate * duration)), context.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
  function playSound(context, trackIndex, pitch, when, duration, velocity = 0.8) {
    const track = tracks[trackIndex], gain = context.createGain();
    gain.connect(context.destination); gain.gain.setValueAtTime(0.0001, when); gain.gain.linearRampToValueAtTime(velocity * 0.18, when + 0.015);
    const end = when + Math.max(0.06, duration);
    if (trackIndex === 1) {
      const noise = context.createBufferSource(), filter = context.createBiquadFilter();
      noise.buffer = createNoise(context, Math.min(1, duration + 0.15)); filter.type = pitch === 36 ? "lowpass" : "highpass"; filter.frequency.value = pitch === 36 ? 140 : pitch === 38 ? 1800 : 8000;
      noise.connect(filter); filter.connect(gain); gain.gain.setValueAtTime(pitch === 36 ? velocity * 0.65 : velocity * 0.28, when);
      gain.gain.exponentialRampToValueAtTime(0.001, end); noise.start(when); noise.stop(end + 0.01);
      if (pitch === 36) { const osc = context.createOscillator(), kickGain = context.createGain(); osc.frequency.setValueAtTime(125, when); osc.frequency.exponentialRampToValueAtTime(38, when + 0.12); kickGain.gain.setValueAtTime(velocity * 0.7, when); kickGain.gain.exponentialRampToValueAtTime(0.001, when + 0.18); osc.connect(kickGain); kickGain.connect(context.destination); osc.start(when); osc.stop(when + 0.2); }
      else if (pitch === 37 || pitch === 38) { gain.gain.setValueAtTime(velocity * 0.25, when); gain.gain.exponentialRampToValueAtTime(0.001, end); }
      return { stop: () => { try { noise.stop(); } catch {} } };
    }
    const oscillator = context.createOscillator(), second = trackIndex === 0 ? context.createOscillator() : null;
    oscillator.type = trackIndex === 0 ? "triangle" : trackIndex === 2 ? "square" : "sawtooth";
    oscillator.frequency.value = 440 * 2 ** ((pitch - 69) / 12);
    if (second) { second.type = "sine"; second.frequency.value = oscillator.frequency.value * 2.01; const blend = context.createGain(); blend.gain.value = 0.13; second.connect(blend); blend.connect(gain); second.start(when); second.stop(end + 0.08); }
    if (trackIndex === 3) { const filter = context.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 500; oscillator.connect(filter); filter.connect(gain); }
    else oscillator.connect(gain);
    gain.gain.setTargetAtTime(0.0001, end, 0.08);
    oscillator.start(when); oscillator.stop(end + 0.12);
    return { stop: () => { const now = context.currentTime; gain.gain.cancelScheduledValues(now); gain.gain.setTargetAtTime(0.0001, now, 0.04); try { oscillator.stop(now + 0.2); if (second) second.stop(now + 0.2); } catch {} } };
  }
  async function noteOn(pitch) {
    if (held.has(pitch)) return;
    const context = await getAudio(), when = context.currentTime;
    const voice = playSound(context, selectedTrack, pitch, when, 3, 0.8);
    held.set(pitch, { when, beat: isRecording ? (context.currentTime - startTime) / beatSeconds() : null, track: selectedTrack, voice });
    activeVoices.add(voice); keys.get(pitch)?.classList.add("pressed");
    if (isRecording && !isPlaying) startPlayback(true);
  }
  function noteOff(pitch) {
    const note = held.get(pitch); if (!note) return;
    note.voice.stop(); activeVoices.delete(note.voice); held.delete(pitch); keys.get(pitch)?.classList.remove("pressed");
    if (isRecording) {
      const beat = note.beat ?? Math.max(0, (audioContext.currentTime - startTime) / beatSeconds());
      const length = Math.max(0.15, (audioContext.currentTime - note.when) / beatSeconds());
      tracks[note.track].notes.push({ beat: Math.max(0, Math.round(beat * 4) / 4), duration: Math.max(0.25, Math.round(length * 4) / 4), pitch, velocity: 100 });
      tracks[note.track].notes.sort((a, b) => a.beat - b.beat); renderTracks(); updateNoteCount();
    }
  }
  function scheduleMetronome() {
    if (!metronome || !isPlaying) return;
    const beat = Math.floor((audioContext.currentTime - startTime) / beatSeconds());
    let lastBeat = beat;
    metronomeTimer = window.setInterval(() => {
      if (!isPlaying) return;
      const currentBeat = Math.floor((audioContext.currentTime - startTime) / beatSeconds());
      if (currentBeat > lastBeat && currentBeat < totalBeats()) {
        lastBeat = currentBeat;
        const osc = audioContext.createOscillator(), gain = audioContext.createGain();
        osc.frequency.value = currentBeat % 4 === 0 ? 1100 : 800; gain.gain.setValueAtTime(0.08, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.035);
        osc.connect(gain); gain.connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime + 0.04);
      }
    }, 20);
  }
  function startPlayback(recording = false) {
    if (isPlaying) return;
    if (!recording && !tracks.some(track => track.notes.length)) { notify("Tambahkan not terlebih dahulu, atau mulai merekam."); return; }
    getAudio().then(context => {
      isPlaying = true; isRecording = recording; startTime = context.currentTime - playheadStart * beatSeconds();
      $("#playButton").classList.add("playing"); $("#recordButton").classList.toggle("recording", recording);
      $("#playButton").setAttribute("aria-label", "Pause"); scheduleMetronome();
      tracks.forEach((track, trackIndex) => {
        if (track.muted || (tracks.some(item => item.solo) && !track.solo)) return;
        track.notes.forEach(note => {
          if (note.beat < playheadStart) return;
          const when = context.currentTime + (note.beat - playheadStart) * beatSeconds();
          const voice = playSound(context, trackIndex, note.pitch, when, note.duration * beatSeconds(), (note.velocity || 90) / 127);
          activeVoices.add(voice); setTimeout(() => activeVoices.delete(voice), Math.max(200, (when - context.currentTime + note.duration * beatSeconds() + 0.2) * 1000));
        });
      });
      playTimer = window.setTimeout(() => stopPlayback(true), Math.max(0, (totalBeats() - playheadStart) * beatSeconds() * 1000));
      const tick = () => {
        if (!isPlaying) return;
        const elapsed = Math.max(0, context.currentTime - startTime), beat = Math.min(totalBeats(), elapsed / beatSeconds());
        $("#positionDisplay").textContent = `${String(Math.floor(beat / 4) + 1).padStart(3, "0")} : ${String(Math.floor(beat % 4) + 1).padStart(2, "0")} : ${String(Math.floor(beat % 1 * 960)).padStart(3, "0")}`;
        document.querySelectorAll(".playhead").forEach(el => el.style.left = `${beat * beatWidth}px`);
        animationFrame = requestAnimationFrame(tick);
      }; tick();
    }).catch(error => notify(`Audio engine error: ${error.message}`));
  }
  function stopPlayback(reset = false) {
    isPlaying = false; isRecording = false; clearTimeout(playTimer); clearInterval(metronomeTimer); cancelAnimationFrame(animationFrame);
    $("#playButton").classList.remove("playing"); $("#recordButton").classList.remove("recording"); $("#playButton").setAttribute("aria-label", "Play");
    if (audioContext && !reset) playheadStart = ((audioContext.currentTime - startTime) / beatSeconds()) % totalBeats();
    if (reset) playheadStart = 0;
    [...held.keys()].forEach(noteOff);
    activeVoices.forEach(voice => voice.stop()); activeVoices.clear();
    $("#positionDisplay").textContent = reset ? "001 : 01 : 000" : $("#positionDisplay").textContent;
    updatePlayhead();
  }
  function writeVar(value) {
    const bytes = [value & 0x7f]; value >>= 7;
    while (value > 0) { bytes.unshift((value & 0x7f) | 0x80); value >>= 7; }
    return bytes;
  }
  function makeMidi() {
    const ppq = 480, chunks = [];
    tracks.forEach((track, index) => {
      const events = [];
      if (index === 0) events.push({ tick: 0, data: [0xff, 0x51, 0x03, ...new Uint8Array([Math.floor(60000000 / tempo) >>> 16, Math.floor(60000000 / tempo) >>> 8 & 255, Math.floor(60000000 / tempo) & 255])] });
      const channel = index === 1 ? 9 : index;
      if (index !== 1) events.push({ tick: 0, data: [0xc0 | channel, track.program] });
      track.notes.forEach(note => {
        const on = Math.round(note.beat * ppq), off = Math.round((note.beat + note.duration) * ppq);
        const pitch = index === 1 ? (note.pitch < 36 || note.pitch > 84 ? [36,38,42,46][Math.abs(note.pitch) % 4] : note.pitch) : note.pitch;
        events.push({ tick: on, data: [0x90 | channel, pitch, note.velocity || 90] }, { tick: off, data: [0x80 | channel, pitch, 0] });
      });
      events.sort((a, b) => a.tick - b.tick);
      let previous = 0, data = [];
      events.forEach(event => { data.push(...writeVar(event.tick - previous), ...event.data); previous = event.tick; });
      data.push(0, 0xff, 0x2f, 0);
      const name = new TextEncoder().encode(track.name), payload = [...data];
      const trackData = [0, 0xff, 0x03, name.length, ...name, ...payload];
      chunks.push([...ascii("MTrk"), ...uint32(trackData.length), ...trackData]);
    });
    const header = [...ascii("MThd"), ...uint32(6), 0, 1, 0, tracks.length, ppq >> 8, ppq & 255];
    return new Blob([new Uint8Array([...header, ...chunks.flat()])], { type: "audio/midi" });
  }
  const ascii = text => [...text].map(char => char.charCodeAt(0));
  const uint32 = value => [value >>> 24 & 255, value >>> 16 & 255, value >>> 8 & 255, value & 255];
  function download(blob, filename) {
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportMidi() { download(makeMidi(), "joi-studio.mid"); notify("MIDI berhasil diekspor."); }
  async function renderAudio() {
    const activeNotes = tracks.flatMap((track, index) => track.muted || (tracks.some(item => item.solo) && !track.solo) ? [] : track.notes.map(note => ({ ...note, track: index })));
    if (!activeNotes.length) throw new Error("Belum ada not untuk diekspor.");
    const duration = Math.max(bars * 4, ...activeNotes.map(note => note.beat + note.duration)) * beatSeconds() + 1;
    const context = new OfflineAudioContext(2, Math.ceil(duration * 44100), 44100);
    activeNotes.forEach(note => playSound(context, note.track, note.pitch, note.beat * beatSeconds(), note.duration * beatSeconds(), (note.velocity || 90) / 127));
    return context.startRendering();
  }
  function encodeWav(buffer) {
    const channels = buffer.numberOfChannels, frames = buffer.length, bytes = new ArrayBuffer(44 + frames * channels * 2), view = new DataView(bytes);
    const write = (offset, text) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
    write(0, "RIFF"); view.setUint32(4, 36 + frames * channels * 2, true); write(8, "WAVE"); write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, frames * channels * 2, true);
    const channelData = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
    let offset = 44;
    for (let i = 0; i < frames; i++) for (let channel = 0; channel < channels; channel++) { const sample = clamp(channelData[channel][i], -1, 1); view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true); offset += 2; }
    return new Blob([bytes], { type: "audio/wav" });
  }
  async function exportAudio(format) {
    const menuButton = $("#exportMenuButton"); menuButton.textContent = "Rendering…";
    try {
      const rendered = await renderAudio();
      if (format === "wav") { download(encodeWav(rendered), "joi-studio.wav"); notify("WAV berhasil diekspor."); }
      else {
        if (!window.lamejs?.Mp3Encoder) throw new Error("Encoder MP3 tidak tersedia. Periksa koneksi internet, lalu coba lagi.");
        const encoder = new window.lamejs.Mp3Encoder(rendered.numberOfChannels, rendered.sampleRate, 192);
        const left = rendered.getChannelData(0), right = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : left;
        const chunkSize = 1152, chunks = [];
        for (let i = 0; i < left.length; i += chunkSize) {
          const l = new Int16Array(Math.min(chunkSize, left.length - i)), r = new Int16Array(l.length);
          for (let j = 0; j < l.length; j++) { l[j] = clamp(left[i + j] * 32767, -32768, 32767); r[j] = clamp(right[i + j] * 32767, -32768, 32767); }
          const encoded = encoder.encodeBuffer(l, r); if (encoded.length) chunks.push(encoded);
        }
        const end = encoder.flush(); if (end.length) chunks.push(end);
        download(new Blob(chunks, { type: "audio/mpeg" }), "joi-studio.mp3"); notify("MP3 berhasil diekspor.");
      }
    } catch (error) { notify(error.message); }
    finally { menuButton.innerHTML = 'Export <span aria-hidden="true">⌄</span>'; }
  }
  function readMidi(buffer) {
    const view = new DataView(buffer); let offset = 0;
    const read32 = () => { const value = view.getUint32(offset); offset += 4; return value; };
    const read16 = () => { const value = view.getUint16(offset); offset += 2; return value; };
    const readVar = () => { let value = 0, byte; do { byte = view.getUint8(offset++); value = (value << 7) | (byte & 0x7f); } while (byte & 0x80); return value; };
    const readText = length => { let text = ""; for (let i = 0; i < length; i++) text += String.fromCharCode(view.getUint8(offset++)); return text; };
    if (readText(4) !== "MThd") throw new Error("File bukan MIDI yang valid.");
    const headerSize = read32(), format = read16(), trackCount = read16(), ppq = read16();
    if (format === 2 || !ppq) throw new Error("Format MIDI ini belum didukung.");
    offset = 8 + headerSize;
    const imported = tracks.map(track => ({ ...track, notes: [], muted: false, solo: false }));
    let importedTempo = tempo;
    for (let t = 0; t < trackCount; t++) {
      if (readText(4) !== "MTrk") throw new Error("Data track MIDI tidak valid.");
      const length = read32(), end = offset + length; let tick = 0, running = 0; const pending = new Map();
      while (offset < end) {
        tick += readVar(); let status = view.getUint8(offset);
        if (status < 0x80) status = running; else { offset++; if (status < 0xf0) running = status; }
        if (status === 0xff) {
          const type = view.getUint8(offset++), size = readVar();
          if (type === 0x51 && size === 3) { const micros = view.getUint8(offset) * 65536 + view.getUint8(offset + 1) * 256 + view.getUint8(offset + 2); importedTempo = Math.round(60000000 / micros); }
          offset += size; continue;
        }
        if (status === 0xf0 || status === 0xf7) { offset += readVar(); continue; }
        const command = status >> 4, channel = status & 15, note = view.getUint8(offset++), velocity = command === 0xc || command === 0xd ? 0 : view.getUint8(offset++);
        if (command === 0xc || command === 0xd) offset--;
        const trackIndex = channel === 9 ? 1 : Math.min(channel, 3);
        if (command === 9 && velocity > 0) { const key = `${trackIndex}:${note}`; if (!pending.has(key)) pending.set(key, []); pending.get(key).push({ tick, velocity }); }
        else if (command === 8 || command === 9) {
          const key = `${trackIndex}:${note}`, starts = pending.get(key), start = starts?.shift();
          if (start) imported[trackIndex].notes.push({ beat: start.tick / ppq, duration: Math.max(0.125, (tick - start.tick) / ppq), pitch: note, velocity: start.velocity });
        }
      }
      offset = end;
      pending.forEach((starts, key) => { const [trackIndex, pitch] = key.split(":").map(Number); starts.forEach(start => imported[trackIndex].notes.push({ beat: start.tick / ppq, duration: 1, pitch, velocity: start.velocity })); });
    }
    tracks.forEach((track, index) => { track.notes = imported[index].notes.sort((a, b) => a.beat - b.beat); });
    tempo = clamp(importedTempo, 40, 240); $("#tempoInput").value = tempo;
    bars = Math.max(4, Math.ceil(Math.max(0, ...tracks.flatMap(track => track.notes.map(note => note.beat + note.duration))) / 4));
    playheadStart = 0; renderRuler(); renderTracks(); updateNoteCount();
    $("#projectTitle").textContent = "Imported MIDI"; notify(`MIDI diimpor — ${tracks.reduce((sum, track) => sum + track.notes.length, 0)} not.`);
  }
  $("#playButton").addEventListener("click", () => isPlaying ? stopPlayback() : startPlayback());
  $("#stopButton").addEventListener("click", () => stopPlayback(true));
  $("#recordButton").addEventListener("click", () => { if (isRecording) stopPlayback(); else { playheadStart = 0; tracks.forEach(track => { track.muted = false; }); startPlayback(true); notify("Rekaman dimulai. Mainkan not pada piano."); } });
  $("#tempoInput").addEventListener("change", event => { tempo = clamp(Number(event.target.value) || 120, 40, 240); event.target.value = tempo; });
  $("#metronomeButton").addEventListener("click", event => { metronome = !metronome; event.currentTarget.classList.toggle("active", metronome); });
  $("#addBarButton").addEventListener("click", () => { bars += 4; renderRuler(); renderTracks(); });
  $("#zoomSlider").addEventListener("input", event => { beatWidth = 45 * Number(event.target.value) / 100; renderRuler(); renderTracks(); });
  $("#octaveDown").addEventListener("click", () => { octave = clamp(octave - 1, 1, 7); renderKeyboard(); });
  $("#octaveUp").addEventListener("click", () => { octave = clamp(octave + 1, 1, 7); renderKeyboard(); });
  $("#importButton").addEventListener("click", () => $("#midiFile").click());
  $("#midiFile").addEventListener("change", async event => {
    const file = event.target.files[0]; if (!file) return;
    try { readMidi(await file.arrayBuffer()); } catch (error) { notify(error.message); }
    event.target.value = "";
  });
  $("#exportMenuButton").addEventListener("click", () => { const menu = $("#exportMenu"); menu.hidden = !menu.hidden; });
  $("#exportMenu").addEventListener("click", event => {
    const format = event.target.closest("button")?.dataset.export; if (!format) return;
    $("#exportMenu").hidden = true; if (format === "midi") exportMidi(); else exportAudio(format);
  });
  document.addEventListener("click", event => { if (!event.target.closest(".top-actions")) $("#exportMenu").hidden = true; });
  document.addEventListener("keydown", event => {
    if (event.target.matches("input,select,textarea") || event.repeat) return;
    if (event.code === "Space") { event.preventDefault(); isPlaying ? stopPlayback() : startPlayback(); return; }
    const index = keyMap[event.key.toLowerCase()]; if (index !== undefined && !held.has((octave + 1) * 12 + index)) noteOn((octave + 1) * 12 + index);
  });
  document.addEventListener("keyup", event => { const index = keyMap[event.key.toLowerCase()]; if (index !== undefined) noteOff((octave + 1) * 12 + index); });
  window.addEventListener("blur", () => [...held.keys()].forEach(noteOff));
  renderRuler(); renderTracks(); renderKeyboard(); updateNoteCount();
})();
