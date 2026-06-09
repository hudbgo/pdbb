import { useEffect, useMemo, useRef, useState } from 'react'
import { addMonths, format, parseISO, startOfMonth } from 'date-fns'
import { supabase } from './lib/supabase'
import {
  buildMonthGrid,
  friendlyDate,
  inCurrentMonth,
  isoDate,
  monthLabel,
  sameDay,
  shiftMonth,
} from './lib/date'

const weekdays = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function App() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [profile, setProfile] = useState(null)
  const [tasks, setTasks] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))
  const [taskForm, setTaskForm] = useState({ title: '', notes: '', completed: false })
  const [editingTask, setEditingTask] = useState(null)
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [uiMessage, setUiMessage] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const realtimeRef = useRef(null)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session ?? null)
      setAuthReady(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      setTasks([])
      return
    }

    void loadProfile()
    void loadTasks(currentMonth)
    const channel = supabase
      .channel(`planner-tasks-${session.user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${session.user.id}` },
        () => {
          void loadTasks(currentMonth)
        }
      )
      .subscribe()

    realtimeRef.current = channel

    return () => {
      if (realtimeRef.current) {
        supabase.removeChannel(realtimeRef.current)
        realtimeRef.current = null
      }
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (session?.user) {
      void loadTasks(currentMonth)
    }
  }, [currentMonth, session?.user?.id])

  const calendarDays = useMemo(() => buildMonthGrid(currentMonth), [currentMonth])

  const tasksByDate = useMemo(() => {
    const map = new Map()
    for (const task of tasks) {
      if (!map.has(task.task_date)) map.set(task.task_date, [])
      map.get(task.task_date).push(task)
    }
    return map
  }, [tasks])

  const selectedKey = isoDate(selectedDate)
  const selectedTasks = tasksByDate.get(selectedKey) ?? []

  const selectedProgress = useMemo(() => {
    const total = selectedTasks.length
    const completed = selectedTasks.filter((task) => task.completed).length
    const percent = total ? Math.round((completed / total) * 100) : 0
    return { total, completed, percent }
  }, [selectedTasks])

  const monthStats = useMemo(() => {
    const monthPrefix = format(currentMonth, 'yyyy-MM')
    const monthTasks = tasks.filter((task) => task.task_date.startsWith(monthPrefix))
    const total = monthTasks.length
    const completed = monthTasks.filter((task) => task.completed).length
    return { total, completed, percent: total ? Math.round((completed / total) * 100) : 0 }
  }, [tasks, currentMonth])

  async function loadProfile() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .eq('id', session.user.id)
      .maybeSingle()

    if (!error && data) {
      setProfile(data)
      setDisplayName(data.display_name || data.email?.split('@')[0] || '')
    }
  }

  async function loadTasks(monthDate) {
    if (!session?.user) return
    const from = format(startOfMonth(monthDate), 'yyyy-MM-dd')
    const to = format(startOfMonth(addMonths(monthDate, 1)), 'yyyy-MM-dd')

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', session.user.id)
      .gte('task_date', from)
      .lt('task_date', to)
      .order('task_date', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      setUiMessage(error.message)
      return
    }

    setTasks(data || [])
  }

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setAuthError('')
    setUiMessage('')

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName || email.split('@')[0],
            },
          },
        })
        if (error) throw error
        if (data.user && !data.session) {
          setUiMessage('Cuenta creada. Revisa el correo si Supabase exige confirmación.')
        }
      }
    } catch (error) {
      setAuthError(error.message || 'No se pudo completar la operación')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  async function handleSaveTask(event) {
    event.preventDefault()
    if (!session?.user) return
    const title = taskForm.title.trim()
    if (!title) return

    const payload = {
      user_id: session.user.id,
      task_date: isoDate(selectedDate),
      title,
      notes: taskForm.notes.trim(),
      completed: Boolean(taskForm.completed),
    }

    const { error } = editingTask
      ? await supabase.from('tasks').update(payload).eq('id', editingTask.id).eq('user_id', session.user.id)
      : await supabase.from('tasks').insert(payload)

    if (error) {
      setUiMessage(error.message)
      return
    }

    setTaskForm({ title: '', notes: '', completed: false })
    setEditingTask(null)
    setUiMessage(editingTask ? 'Tarea actualizada.' : 'Tarea creada.')
    await loadTasks(currentMonth)
  }

  function startEditTask(task) {
    setEditingTask(task)
    setTaskForm({
      title: task.title,
      notes: task.notes || '',
      completed: task.completed,
    })
  }

  async function toggleTask(task) {
    const { error } = await supabase
      .from('tasks')
      .update({ completed: !task.completed })
      .eq('id', task.id)
      .eq('user_id', session.user.id)

    if (error) {
      setUiMessage(error.message)
      return
    }

    await loadTasks(currentMonth)
  }

  async function deleteTask(task) {
    const confirmed = window.confirm(`Eliminar "${task.title}"?`)
    if (!confirmed) return

    const { error } = await supabase.from('tasks').delete().eq('id', task.id).eq('user_id', session.user.id)
    if (error) {
      setUiMessage(error.message)
      return
    }

    if (editingTask?.id === task.id) {
      setEditingTask(null)
      setTaskForm({ title: '', notes: '', completed: false })
    }

    await loadTasks(currentMonth)
  }

  function selectDate(date) {
    setSelectedDate(date)
    setSidebarOpen(true)
    const monthStart = startOfMonth(date)
    if (format(monthStart, 'yyyy-MM') !== format(currentMonth, 'yyyy-MM')) {
      setCurrentMonth(monthStart)
    }
  }

  function goMonth(amount) {
    const next = shiftMonth(currentMonth, amount)
    setCurrentMonth(startOfMonth(next))
    setSelectedDate(startOfMonth(next))
    setSidebarOpen(false)
  }

  function resetEditState() {
    setEditingTask(null)
    setTaskForm({ title: '', notes: '', completed: false })
  }

  if (!authReady) {
    return (
      <div className="shell center">
        <div className="auth-card">
          <div className="brand">
            <div className="brand-mark">P</div>
            <div>
              <p className="eyebrow">Planner</p>
              <h1>Loading</h1>
            </div>
          </div>
          <p className="muted">Initializing secure session…</p>
        </div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="shell auth-shell">
        <div className="auth-card auth-grid">
          <section className="hero-panel">
            <div className="brand">
              <div className="brand-mark">P</div>
              <div>
                <p className="eyebrow">Planner</p>
                <h1>Private planning with real sync.</h1>
              </div>
            </div>
            <p className="hero-copy">
              Calendar-first organization for two private users, with Supabase authentication, monthly planning and
              per-day progress.
            </p>
            <div className="hero-pill-row">
              <span className="pill">Secure</span>
              <span className="pill">Minimal</span>
              <span className="pill">Synced</span>
            </div>
          </section>

          <section className="form-panel">
            <div className="segmented">
              <button className={mode === 'login' ? 'seg active' : 'seg'} onClick={() => setMode('login')} type="button">
                Entrar
              </button>
              <button className={mode === 'signup' ? 'seg active' : 'seg'} onClick={() => setMode('signup')} type="button">
                Crear cuenta
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="auth-form">
              <label>
                Email
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="usuario@correo.com" />
              </label>

              {mode === 'signup' && (
                <label>
                  Nombre visible
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    type="text"
                    placeholder="Tu nombre"
                    maxLength={50}
                  />
                </label>
              )}

              <label>
                Contraseña
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required placeholder="••••••••" />
              </label>

              {authError ? <p className="error">{authError}</p> : null}
              {uiMessage ? <p className="muted">{uiMessage}</p> : null}

              <button className="primary-btn" type="submit" disabled={loading}>
                {loading ? 'Procesando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
              </button>
            </form>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="shell app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Planner</p>
          <h1>Calendar</h1>
          <p className="muted">
            {profile?.display_name ? `Signed in as ${profile.display_name}` : session.user.email}
          </p>
        </div>

        <div className="topbar-actions">
          <div className="stat-chip">
            <span>{monthStats.completed}/{monthStats.total}</span>
            <small>{monthStats.percent}% month</small>
          </div>
          <button className="ghost-btn" onClick={() => setCurrentMonth(startOfMonth(new Date()))} type="button">
            Hoy
          </button>
          <button className="ghost-btn" onClick={handleLogout} type="button">
            Salir
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="calendar-panel">
          <div className="calendar-head">
            <button className="nav-btn" onClick={() => goMonth(-1)} type="button" aria-label="Mes anterior">
              ‹
            </button>
            <div>
              <h2>{monthLabel(currentMonth)}</h2>
              <p className="muted">Monthly planner synced in real time</p>
            </div>
            <button className="nav-btn" onClick={() => goMonth(1)} type="button" aria-label="Mes siguiente">
              ›
            </button>
          </div>

          <div className="weekday-row">
            {weekdays.map((day) => (
              <div key={day} className="weekday">
                {day}
              </div>
            ))}
          </div>

          <div className="calendar-grid">
            {calendarDays.map((day) => {
              const dayKey = isoDate(day)
              const dayTasks = tasksByDate.get(dayKey) ?? []
              const completed = dayTasks.filter((task) => task.completed).length
              const status =
                dayTasks.length === 0
                  ? 'neutral'
                  : completed === 0
                    ? 'danger'
                    : completed === dayTasks.length
                      ? 'success'
                      : 'warning'

              return (
                <button
                  key={dayKey}
                  type="button"
                  onClick={() => selectDate(day)}
                  className={[
                    'day-cell',
                    inCurrentMonth(day, currentMonth) ? '' : 'muted-day',
                    sameDay(day, selectedDate) ? 'selected' : '',
                    status,
                  ].join(' ')}
                >
                  <span className="day-number">{format(day, 'd')}</span>
                  <span className="day-meta">
                    {dayTasks.length ? `${completed}/${dayTasks.length}` : '—'}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-head">
            <div>
              <p className="eyebrow">Day details</p>
              <h3>{friendlyDate(selectedDate)}</h3>
            </div>
            <button className="ghost-btn mobile-close" onClick={() => setSidebarOpen(false)} type="button">
              Cerrar
            </button>
          </div>

          <div className="progress-card">
            <div className="progress-row">
              <span>{selectedProgress.completed}/{selectedProgress.total} tareas</span>
              <strong>{selectedProgress.percent}%</strong>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${selectedProgress.percent}%` }} />
            </div>
          </div>

          <form className="task-form" onSubmit={handleSaveTask}>
            <div className="field-row">
              <label>
                Tarea
                <input
                  value={taskForm.title}
                  onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                  type="text"
                  placeholder="Añadir una tarea"
                  maxLength={140}
                  required
                />
              </label>

              <label className="checkbox-line">
                <input
                  checked={taskForm.completed}
                  onChange={(e) => setTaskForm((prev) => ({ ...prev, completed: e.target.checked }))}
                  type="checkbox"
                />
                Hecha
              </label>
            </div>

            <label>
              Notas
              <textarea
                value={taskForm.notes}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows="4"
                placeholder="Detalles opcionales"
              />
            </label>

            <div className="form-actions">
              <button className="primary-btn" type="submit">
                {editingTask ? 'Guardar cambios' : 'Añadir tarea'}
              </button>
              {editingTask ? (
                <button className="ghost-btn" type="button" onClick={resetEditState}>
                  Cancelar edición
                </button>
              ) : null}
            </div>
          </form>

          <div className="task-list">
            {selectedTasks.length === 0 ? (
              <div className="empty-state">
                <p>No tasks on this day.</p>
                <span className="muted">Add one above to begin tracking progress.</span>
              </div>
            ) : (
              selectedTasks.map((task) => (
                <article key={task.id} className={task.completed ? 'task-item done' : 'task-item'}>
                  <button className="task-check" type="button" onClick={() => toggleTask(task)} aria-label="Toggle complete">
                    {task.completed ? '✓' : ''}
                  </button>
                  <div className="task-body">
                    <h4>{task.title}</h4>
                    {task.notes ? <p>{task.notes}</p> : null}
                  </div>
                  <div className="task-actions">
                    <button className="icon-btn" type="button" onClick={() => startEditTask(task)}>
                      Edit
                    </button>
                    <button className="icon-btn danger" type="button" onClick={() => deleteTask(task)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          {uiMessage ? <p className="muted footer-msg">{uiMessage}</p> : null}
        </aside>
      </main>

      <button className="fab" type="button" onClick={() => setSidebarOpen((v) => !v)}>
        {sidebarOpen ? '×' : '+'}
      </button>
    </div>
  )
}

export default App
