// app.js - Lógica de la SPA
// IMPORTANTE: en producción, Nginx redirige /api hacia el backend Node (ver deploy/nginx.conf),
// por eso usamos una ruta relativa y no un puerto ni IP fijo.
const API_URL = '/api/tasks';

const form = document.getElementById('task-form');
const input = document.getElementById('new-task');
const filterInput = document.getElementById('filter');
const list = document.getElementById('task-list');
const statusMsg = document.getElementById('status-msg');
const emptyState = document.getElementById('empty-state');
const stampCount = document.getElementById('stamp-count');
const tabButtons = document.querySelectorAll('.tabs__item');

let allTasks = [];
let currentTab = 'all'; // all | active | completed

async function fetchTasks(query = '') {
  try {
    const url = query ? `${API_URL}?q=${encodeURIComponent(query)}` : API_URL;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Error al obtener tareas');
    allTasks = await res.json();
    render();
  } catch (err) {
    statusMsg.textContent = 'No se pudo conectar con el servidor';
    console.error(err);
  }
}

function visibleTasks() {
  if (currentTab === 'active') return allTasks.filter((t) => !t.completed);
  if (currentTab === 'completed') return allTasks.filter((t) => t.completed);
  return allTasks;
}

function render() {
  const tasks = visibleTasks();
  list.innerHTML = '';

  tasks.forEach((task) => {
    list.appendChild(buildRow(task));
  });

  emptyState.hidden = allTasks.length > 0;
  if (allTasks.length === 0) {
    emptyState.textContent = 'La página está en blanco. Anotá tu primera tarea arriba.';
  }

  const doneCount = allTasks.filter((t) => t.completed).length;
  stampCount.textContent = `${doneCount}/${allTasks.length}`;
  statusMsg.textContent = tasks.length === 1 ? '1 tarea' : `${tasks.length} tareas`;
}

function buildRow(task) {
  const li = document.createElement('li');
  li.className = 'ledger__row' + (task.completed ? ' is-done' : '');

  const check = document.createElement('button');
  check.className = 'ledger__check';
  check.type = 'button';
  check.setAttribute('aria-label', task.completed ? 'Marcar como pendiente' : 'Marcar como hecha');
  check.innerHTML = '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 8.5L6 12L14 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  check.onclick = () => toggleTask(task);

  // textContent (no innerHTML) para el título: evita que un título con
  // HTML/JS embebido se interprete como marcado en la página (XSS).
  const span = document.createElement('span');
  span.className = 'ledger__title';
  span.textContent = task.title;
  span.tabIndex = 0;
  span.title = 'Doble clic para editar';
  span.ondblclick = () => startEdit(li, span, task);
  span.onkeydown = (e) => {
    if (e.key === 'Enter') startEdit(li, span, task);
  };

  const delBtn = document.createElement('button');
  delBtn.className = 'ledger__delete';
  delBtn.type = 'button';
  delBtn.textContent = 'Borrar';
  delBtn.setAttribute('aria-label', `Borrar "${task.title}"`);
  delBtn.onclick = () => deleteTask(task.id);

  li.appendChild(check);
  li.appendChild(span);
  li.appendChild(delBtn);
  return li;
}

function startEdit(li, span, task) {
  const editInput = document.createElement('input');
  editInput.className = 'ledger__edit';
  editInput.type = 'text';
  editInput.value = task.title;
  editInput.maxLength = 255;

  span.replaceWith(editInput);
  editInput.focus();
  editInput.setSelectionRange(editInput.value.length, editInput.value.length);

  const commit = () => {
    const newTitle = editInput.value.trim();
    if (newTitle && newTitle !== task.title) {
      updateTitle(task, newTitle);
    } else {
      render();
    }
  };

  editInput.onblur = commit;
  editInput.onkeydown = (e) => {
    if (e.key === 'Enter') editInput.blur();
    if (e.key === 'Escape') { editInput.onblur = null; render(); }
  };
}

async function addTask(title) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      statusMsg.textContent = body.error || 'No se pudo agregar la tarea';
      return;
    }
    fetchTasks(filterInput.value.trim());
  } catch (err) {
    statusMsg.textContent = 'No se pudo conectar con el servidor';
    console.error(err);
  }
}

async function updateTitle(task, title) {
  await fetch(`${API_URL}/${task.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  fetchTasks(filterInput.value.trim());
}

async function toggleTask(task) {
  await fetch(`${API_URL}/${task.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed: !task.completed }),
  });
  fetchTasks(filterInput.value.trim());
}

async function deleteTask(id) {
  await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
  fetchTasks(filterInput.value.trim());
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = input.value.trim();
  if (!title) return;
  addTask(title);
  input.value = '';
});

// Filtro en tiempo real: se dispara en cada tecla presionada
let debounceTimer;
filterInput.addEventListener('input', (e) => {
  clearTimeout(debounceTimer);
  const value = e.target.value.trim();
  debounceTimer = setTimeout(() => fetchTasks(value), 200);
});

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => {
      b.classList.remove('is-active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('is-active');
    btn.setAttribute('aria-selected', 'true');
    currentTab = btn.dataset.filter;
    render();
  });
});

fetchTasks();
