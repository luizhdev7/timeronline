// script.js - cronômetro + temporizador + despertador

// ---- helpers ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function parseMsecFromUrl() {
    // procura ?msec=... ou #...msec=...
    const q = new URLSearchParams(window.location.search);
    if (q.has('msec')) return Number(q.get('msec')) || 0;
    // procura no hash
    const h = window.location.hash;
    if (!h) return 0;
    const maybe = h.split('&').find(p => p.includes('msec='));
    if (maybe) return Number(maybe.split('msec=')[1]) || 0;
    return 0;
}

function formatTimeFromMs(ms, showHundredths = true) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hundredths = Math.floor((ms % 1000) / 10);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    if (showHundredths) {
        return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(hundredths).padStart(2,'0')}`;
    } else {
        return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
    }
}

// ---- View switching (sidebar) ----
const sideButtons = $$('.side-btn');
const sections = $$('.panel');

sideButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        sideButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.dataset.view;
        sections.forEach(sec => {
            sec.classList.toggle('hidden', sec.id !== target);
        });
    });
});

// ---- CRONÔMETRO ----
const display = $('#display');
const startBtn = $('#startBtn');
const resetBtn = $('#resetBtn');
const lapBtn = $('#lapBtn');
const lapsContainer = $('#laps');

let elapsed = 0;            // tempo acumulado em ms quando parado
let startTimestamp = 0;     // timestamp quando iniciou/retomou
let running = false;
let tickInterval = null;

// carregar msec da url (pré-carregar tempo)
const preloadMsec = parseMsecFromUrl();
if (preloadMsec) {
    elapsed = preloadMsec;
    display.textContent = formatTimeFromMs(elapsed, true);
}

// atualiza visor baseado em elapsed + (agora - startTimestamp)
function renderChrono() {
    const now = Date.now();
    const total = running ? elapsed + (now - startTimestamp) : elapsed;
    display.textContent = formatTimeFromMs(total, true);
}

// start / pause
startBtn.addEventListener('click', () => {
    if (!running) {
        // iniciar ou retomar
        running = true;
        startTimestamp = Date.now();
        startBtn.textContent = 'Pausar';
        lapBtn.classList.remove('hidden');
        tickInterval = setInterval(renderChrono, 30);
    } else {
        // pausar
        running = false;
        elapsed += Date.now() - startTimestamp;
        clearInterval(tickInterval);
        tickInterval = null;
        startBtn.textContent = 'Iniciar';
    }
});

// reset
resetBtn.addEventListener('click', () => {
    running = false;
    clearInterval(tickInterval);
    tickInterval = null;
    elapsed = 0;
    startTimestamp = 0;
    startBtn.textContent = 'Iniciar';
    lapBtn.classList.add('hidden');
    display.textContent = '00:00:00.00';
    lapsContainer.innerHTML = '';
});

// volta (registra volta)
lapBtn.addEventListener('click', () => {
    const now = Date.now();
    const total = running ? elapsed + (now - startTimestamp) : elapsed;
    const index = lapsContainer.children.length + 1;
    const div = document.createElement('div');
    div.textContent = `Volta ${index}: ${formatTimeFromMs(total, true)}`;
    lapsContainer.prepend(div);
});

// atualiza tela inicialmente
renderChrono();


// ---- TEMPORIZADOR (countdown) ----
const cdHours = $('#cdHours');
const cdMinutes = $('#cdMinutes');
const cdSeconds = $('#cdSeconds');
const cdDisplay = $('#cdDisplay');
const cdStart = $('#cdStart');
const cdReset = $('#cdReset');

let cdTotalMs = 0;
let cdStartTs = 0;
let cdRunning = false;
let cdInterval = null;

function renderCd() {
    const now = Date.now();
    const remaining = Math.max(0, cdTotalMs - (cdRunning ? (now - cdStartTs) : 0));
    cdDisplay.textContent = formatTimeFromMs(remaining, false);
    if (remaining <= 0 && cdRunning) {
        clearInterval(cdInterval);
        cdInterval = null;
        cdRunning = false;
        cdStart.textContent = 'Iniciar';
        alert('Tempo do temporizador encerrado!');
        playBeep();
    }
}

cdStart.addEventListener('click', () => {
    if (!cdRunning) {
        // inicializar valor se não configurado
        if (cdTotalMs === 0) {
            const h = Math.max(0, Number(cdHours.value) || 0);
            const m = Math.max(0, Number(cdMinutes.value) || 0);
            const s = Math.max(0, Number(cdSeconds.value) || 0);
            cdTotalMs = (h*3600 + m*60 + s) * 1000;
            if (cdTotalMs === 0) {
                alert('Defina um tempo maior que zero.');
                return;
            }
        }
        cdStartTs = Date.now();
        cdRunning = true;
        cdStart.textContent = 'Pausar';
        renderCd(); // primeira atualização imediata
        cdInterval = setInterval(renderCd, 250);
    } else {
        // pausar
        cdRunning = false;
        // recalcula total restante e guarda como novo cdTotalMs
        const elapsedSinceStart = Date.now() - cdStartTs;
        cdTotalMs = Math.max(0, cdTotalMs - elapsedSinceStart);
        clearInterval(cdInterval);
        cdInterval = null;
        cdStart.textContent = 'Iniciar';
    }
});

cdReset.addEventListener('click', () => {
    cdRunning = false;
    clearInterval(cdInterval);
    cdInterval = null;
    cdTotalMs = 0;
    cdStartTs = 0;
    cdHours.value = '';
    cdMinutes.value = '';
    cdSeconds.value = '';
    cdDisplay.textContent = '00:00:00';
    cdStart.textContent = 'Iniciar';
});

// ---- DESPERTADOR (alarm) ----
const alarmTime = $('#alarmTime');
const alarmToggle = $('#alarmToggle');
const alarmStatus = $('#alarmStatus');
const alarmClear = $('#alarmClear');

let alarmEnabled = false;
let alarmTimeString = '';
let alarmInterval = null;

alarmToggle.addEventListener('change', () => {
    alarmEnabled = alarmToggle.checked;
    setupAlarm();
});

alarmTime.addEventListener('change', () => {
    alarmTimeString = alarmTime.value; // "HH:MM"
    setupAlarm();
});

alarmClear.addEventListener('click', () => {
    alarmEnabled = false;
    alarmToggle.checked = false;
    alarmTime.value = '';
    alarmTimeString = '';
    alarmStatus.textContent = 'Nenhum alarme ativo';
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }
});

function setupAlarm(){
    if (!alarmEnabled || !alarmTime.value) {
        alarmStatus.textContent = 'Nenhum alarme ativo';
        if (alarmInterval) { clearInterval(alarmInterval); alarmInterval = null; }
        return;
    }
    alarmStatus.textContent = `Alarme definido para ${alarmTime.value}`;
    // checa a cada segundo
    if (alarmInterval) clearInterval(alarmInterval);
    alarmInterval = setInterval(checkAlarm, 1000);
}

function checkAlarm(){
    if (!alarmEnabled || !alarmTime.value) return;
    const now = new Date();
    const [hh, mm] = alarmTime.value.split(':').map(n => Number(n));
    if (now.getHours() === hh && now.getMinutes() === mm) {
        // dispara alarme (uma vez)
        alarmEnabled = false;
        alarmToggle.checked = false;
        alarmStatus.textContent = 'Alarme tocando!';
        clearInterval(alarmInterval);
        alarmInterval = null;
        playBeep(3000);
        // mostragem e desbloqueio para usuário
        alert('Alarme: hora marcada!');
    }
}

// ---- Relógio local (simples) ----
const clockLocal = $('#clockLocal');
function updateLocalClock(){
    const d = new Date();
    const s = String(d.getSeconds()).padStart(2,'0');
    const m = String(d.getMinutes()).padStart(2,'0');
    const h = String(d.getHours()).padStart(2,'0');
    if (clockLocal) clockLocal.textContent = `${h}:${m}:${s}`;
}
setInterval(updateLocalClock, 1000);
updateLocalClock();

// ---- Beep (Web Audio) ----
let audioCtx = null;
function playBeep(duration = 800) {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.value = 1000;
        o.connect(g);
        g.connect(audioCtx.destination);
        g.gain.setValueAtTime(0, audioCtx.currentTime);
        g.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration/1000);
        setTimeout(() => {
            o.stop();
        }, duration);
    } catch (e) {
        console.warn('Audio not available:', e);
    }
}

// ---- keep rendering while chrono running ----
setInterval(() => {
    if (running) renderChrono();
}, 100);

// fim do arquivo
