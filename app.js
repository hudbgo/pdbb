const STORAGE_KEY = 'chill-progress-v1';

const defaultState = {
  names: ['Tú', 'Ella'],
  sharedNote: '',
  goals: []
};

const els = {
  activeGoals: document.getElementById('activeGoals'),
  weeklyActions: document.getElementById('weeklyActions'),
  weeklyPoints: document.getElementById('weeklyPoints'),
  averageReliability: document.getElementById('averageReliability'),
  nameOne: document.getElementById('nameOne'),
  nameTwo: document.getElementById('nameTwo'),
  sharedNote: document.getElementById('sharedNote'),
  saveNamesBtn: document.getElementById('saveNamesBtn'),
  goalForm: document.getElementById('goalForm'),
  goalOwner: document.getElementById('goalOwner'),
  goalTitle: document.getElementById('goalTitle'),
  goalCategory: document.getElementById('goalCategory'),
  goalTarget: document.getElementById('goalTarget'),
  goalPoints: document.getElementById('goalPoints'),
  goalList: document.getElementById('goalList'),
  emptyState: document.getElementById('emptyState'),
  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput'),
  resetBtn: document.getElementById('resetBtn'),
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      names: Array.isArray(parsed.names) && parsed.names.length === 2 ? parsed.names : defaultState.names,
      goals: Array.isArray(parsed.goals) ? parsed.goals : []
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeDate(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;
}

function currentWeekEventCount(goal) {
  const wk = weekKey();
  return (goal.events || []).filter((ts) => weekKey(new Date(ts)) === wk).length;
}

function allTimeEventCount(goal) {
  return (goal.events || []).length;
}

function completedWeeks(goal) {
  const weekMap = new Map();
  for (const ts of goal.events || []) {
    const key = weekKey(new Date(ts));
    weekMap.set(key, (weekMap.get(key) || 0) + 1);
  }
  return weekMap;
}

function streakWeeks(goal) {
  const map = completedWeeks(goal);
  const now = new Date();
  let streak = 0;
  let cursor = new Date(now);
  for (let i = 0; i < 104; i++) {
    const key = weekKey(cursor);
    if (map.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 7);
    } else {
      break;
    }
  }
  return streak;
}

function reliability(goal) {
  const target = Math.max(1, Number(goal.target) || 1);
  return Math.min(100, Math.round((currentWeekEventCount(goal) / target) * 100));
}

function totalWeeklyActions() {
  return state.goals.reduce((sum, goal) => sum + currentWeekEventCount(goal), 0);
}

function totalWeeklyPoints() {
  return state.goals.reduce((sum, goal) => sum + currentWeekEventCount(goal) * (Number(goal.points) || 1), 0);
}

function averageReliability() {
  if (!state.goals.length) return 0;
  const total = state.goals.reduce((sum, goal) => sum + reliability(goal), 0);
  return Math.round(total / state.goals.length);
}

function renderOwners() {
  const options = [
    { value: '0', label: state.names[0] || 'Persona 1' },
    { value: '1', label: state.names[1] || 'Persona 2' },
  ];
  els.goalOwner.innerHTML = options.map(({ value, label }) => `<option value="${value}">${label}</option>`).join('');
}

function renderFormFields() {
  els.nameOne.value = state.names[0] || '';
  els.nameTwo.value = state.names[1] || '';
  els.sharedNote.value = state.sharedNote || '';
}

function renderStats() {
  els.activeGoals.textContent = String(state.goals.length);
  els.weeklyActions.textContent = String(totalWeeklyActions());
  els.weeklyPoints.textContent = String(totalWeeklyPoints());
  els.averageReliability.textContent = `${averageReliability()}%`;
}

function renderGoals() {
  els.goalList.innerHTML = '';
  els.emptyState.classList.toggle('hidden', state.goals.length !== 0);

  const template = document.getElementById('goalTemplate');
  for (const goal of state.goals) {
    const node = template.content.cloneNode(true);
    const ownerName = state.names[goal.owner] || `Persona ${Number(goal.owner) + 1}`;
    const current = currentWeekEventCount(goal);
    const target = Math.max(1, Number(goal.target) || 1);
    const pct = Math.min(100, Math.round((current / target) * 100));
    const points = current * (Number(goal.points) || 1);
    const streak = streakWeeks(goal);

    node.querySelector('.goal-owner').textContent = ownerName;
    node.querySelector('.goal-title').textContent = goal.title;
    node.querySelector('.goal-category').textContent = goal.category ? `Categoría: ${goal.category}` : 'Categoría libre';
    node.querySelector('.progress-text').textContent = `${current}/${target} esta semana`;
    node.querySelector('.streak-text').textContent = `Racha: ${streak} sem.`;
    node.querySelector('.progress-fill').style.width = `${pct}%`;
    node.querySelector('.done-count').textContent = `${current}`;
    node.querySelector('.points-count').textContent = `${points}`;
    node.querySelector('.reliability-count').textContent = `${pct}%`;

    const markBtn = node.querySelector('.mark-done-btn');
    const clearBtn = node.querySelector('.clear-week-btn');
    const deleteBtn = node.querySelector('.delete-btn');

    markBtn.addEventListener('click', () => {
      goal.events = goal.events || [];
      goal.events.push(new Date().toISOString());
      saveState();
      render();
    });

    clearBtn.addEventListener('click', () => {
      const thisWeek = weekKey();
      goal.events = (goal.events || []).filter((ts) => weekKey(new Date(ts)) !== thisWeek);
      saveState();
      render();
    });

    deleteBtn.addEventListener('click', () => {
      state.goals = state.goals.filter((g) => g.id !== goal.id);
      saveState();
      render();
    });

    els.goalList.appendChild(node);
  }
}

function renderNote() {
  els.sharedNote.value = state.sharedNote || '';
}

function render() {
  renderOwners();
  renderFormFields();
  renderStats();
  renderGoals();
  renderNote();
}

els.saveNamesBtn.addEventListener('click', () => {
  const name1 = els.nameOne.value.trim() || 'Tú';
  const name2 = els.nameTwo.value.trim() || 'Ella';
  state.names = [name1, name2];
  state.sharedNote = els.sharedNote.value.trim();
  saveState();
  render();
});

els.goalForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = els.goalTitle.value.trim();
  if (!title) return;

  state.goals.unshift({
    id: uid(),
    owner: Number(els.goalOwner.value),
    title,
    category: els.goalCategory.value.trim(),
    target: Math.max(1, Number(els.goalTarget.value) || 1),
    points: Math.max(1, Number(els.goalPoints.value) || 1),
    events: [],
    createdAt: new Date().toISOString()
  });

  els.goalTitle.value = '';
  els.goalCategory.value = '';
  els.goalTarget.value = '3';
  els.goalPoints.value = '1';
  saveState();
  render();
});

els.sharedNote.addEventListener('input', () => {
  state.sharedNote = els.sharedNote.value;
  saveState();
});

els.exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chill-progress-backup.json';
  a.click();
  URL.revokeObjectURL(url);
});

els.importInput.addEventListener('change', async () => {
  const file = els.importInput.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    state = {
      ...structuredClone(defaultState),
      ...parsed,
      names: Array.isArray(parsed.names) && parsed.names.length === 2 ? parsed.names : defaultState.names,
      goals: Array.isArray(parsed.goals) ? parsed.goals : []
    };
    saveState();
    render();
  } catch {
    alert('El archivo no es válido.');
  } finally {
    els.importInput.value = '';
  }
});

els.resetBtn.addEventListener('click', () => {
  const confirmed = confirm('¿Borrar todos los datos guardados en este navegador?');
  if (!confirmed) return;
  state = structuredClone(defaultState);
  localStorage.removeItem(STORAGE_KEY);
  render();
});

render();
