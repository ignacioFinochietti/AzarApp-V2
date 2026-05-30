let socket;
let app;
let slotScene;
let raceScene;
let confetti;
let roomCode = null;
let isHost = false;
let localBusy = false;

const state = {
  options: [],
  mode: 'slot',
};

window.__appState = state;

function initSocket() {
  socket = new AzarSocket();

  socket.on('_connected', (data) => {
    if (roomCode && !window._roomCreated) {
      joinRoom(roomCode);
    }
  });

  socket.on('state-update', (data) => {
    if (data.options) {
      state.options = data.options;
      renderOptions();
      updateDisplay();
    }
  });

  socket.on('room-info', (data) => {
    if (data.userCount !== undefined) updateRoomUsers(data.userCount);
    if (data.host !== undefined) isHost = (socket.socketId === data.host);
  });

  socket.on('new-host', (data) => {
    isHost = (socket.socketId === data.hostId);
  });

  socket.on('decision-start', (data) => {
    state.mode = data.mode;
    localBusy = true;
    actionBtn.disabled = true;

    const opts = state.options;
    if (opts.length < 2) return;

    if (state.mode === 'slot') {
      slotScene.build(opts);
      slotScene.show();
      raceScene.hide();
      slotScene.startSpin(data.winner);
    } else {
      raceScene.build(opts);
      raceScene.show();
      slotScene.hide();
      raceScene.startRace(data.winner);
    }
  });

  socket.on('decision-result', (data) => {
    localBusy = false;
    actionBtn.disabled = false;
  });

  socket.on('busy-timeout', () => {
    localBusy = false;
    actionBtn.disabled = false;
  });

  socket.on('error', (data) => {
    console.error('Server error:', data.message);
  });

  socket.connect(roomCode);
}

window.__finishDecision = function(winner) {
  confetti.spawn(50);
  socket.send('decision-done', { winner });
};

window.__triggerDecision = function(mode) {
  if (localBusy || !isHost) return;
  socket.send('trigger-decision', { mode });
};

async function initPixi() {
  if (app) return;

  app = new PIXI.Application();
  await app.init({
    width: 780,
    height: 340,
    background: '#0f0f1a',
    antialias: false,
    roundPixels: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  const gameContainer = document.getElementById('game-container');
  gameContainer.appendChild(app.canvas);

  slotScene = new SlotScene(app);
  raceScene = new RaceScene(app);
  confetti = new ConfettiEffect(app);

  window.__app = app;
}

function updateDisplay() {
  if (!slotScene) return;
  const opts = state.options;
  if (opts.length === 0) return;

  if (state.mode === 'slot') {
    slotScene.build(opts);
    slotScene.showIdle();
    raceScene.hide();
  } else {
    raceScene.build(opts);
    raceScene.show();
    slotScene.hide();
  }
}

function renderOptions() {
  const list = document.getElementById('options-list');
  list.innerHTML = '';
  if (state.options.length === 0) {
    list.innerHTML = '<span style="color:#555;font-size:6px;padding:3px;">SIN OPCIONES</span>';
    return;
  }
  state.options.forEach((opt, i) => {
    const tag = document.createElement('span');
    tag.className = 'option-tag';
    tag.innerHTML = `${opt} <span class="remove" data-index="${i}">×</span>`;
    tag.querySelector('.remove').addEventListener('click', () => {
      socket.send('remove-option', { index: i });
    });
    list.appendChild(tag);
  });
}

function updateRoomUsers(count) {
  document.getElementById('room-users').textContent = `👤 ${count}`;
}

async function enterRoom() {
  document.getElementById('room-overlay').style.display = 'none';
  document.getElementById('room-bar').classList.add('visible');
  document.getElementById('room-code-label').textContent = roomCode;
  updateRoomUsers(1);
  renderOptions();

  await initPixi();
  updateDisplay();
}

async function createRoom() {
  const res = await socket.sendWithRef('create-room', null);
  if (res?.success) {
    roomCode = res.code;
    isHost = true;
    window._roomCreated = true;
    state.options = res.state.options;
    state.mode = res.state.mode;
    await enterRoom();
  }
}

async function joinRoom(code) {
  const res = await socket.sendWithRef('join-room', { code });
  if (res?.success) {
    roomCode = code;
    isHost = false;
    state.options = res.state.options;
    state.mode = res.state.mode;
    await enterRoom();
  } else if (res?.error) {
    document.getElementById('room-status').textContent = res.error;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initSocket();

  const btnCreate = document.getElementById('btn-create');
  const btnJoin = document.getElementById('btn-join');
  const roomCodeInput = document.getElementById('room-code-input');
  const roomStatus = document.getElementById('room-status');
  const input = document.getElementById('option-input');
  const addBtn = document.getElementById('add-btn');
  const modeBtns = document.querySelectorAll('.mode-btn');
  const actionBtnEl = document.getElementById('action-btn');
  const showQrBtn = document.getElementById('show-qr');
  const qrModal = document.getElementById('qr-modal');
  const qrImage = document.getElementById('qr-image');
  const qrCodeText = document.getElementById('qr-code-text');
  const qrClose = document.getElementById('qr-close');

  window.actionBtn = actionBtnEl;

  btnCreate.addEventListener('click', createRoom);

  btnJoin.addEventListener('click', () => {
    const code = roomCodeInput.value.trim().toUpperCase();
    if (!code || code.length < 4) {
      roomStatus.textContent = 'CÓDIGO INVÁLIDO';
      return;
    }
    roomStatus.innerHTML = '<span class="spinner"></span>UNIENDO...';
    joinRoom(code);
  });

  roomCodeInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnJoin.click();
  });

  addBtn.addEventListener('click', () => {
    const val = input.value.trim().toUpperCase();
    if (!val) return;
    socket.send('add-option', { option: val });
    input.value = '';
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') addBtn.click();
  });

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (localBusy) return;
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mode = btn.dataset.mode;
      actionBtnEl.textContent = state.mode === 'slot' ? '🎰 ¡GIRAR!' : '🏇 ¡CORRE!';

      if (slotScene) updateDisplay();
    });
  });

  actionBtnEl.addEventListener('click', () => {
    if (localBusy || !isHost) return;
    socket.send('trigger-decision', { mode: state.mode });
  });

  showQrBtn.addEventListener('click', () => {
    if (!roomCode) return;
    const url = `${window.location.origin}?room=${roomCode}`;
    qrCodeText.textContent = roomCode;
    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    qrModal.classList.add('visible');
  });

  qrClose.addEventListener('click', () => {
    qrModal.classList.remove('visible');
  });

  qrModal.addEventListener('click', (e) => {
    if (e.target === qrModal) qrModal.classList.remove('visible');
  });

  const urlParams = new URLSearchParams(window.location.search);
  const joinParam = urlParams.get('room');
  if (joinParam) {
    roomCodeInput.value = joinParam.toUpperCase();
    setTimeout(() => btnJoin.click(), 500);
  }
});
