import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

// ─── Constants ───
const COLUMNS = [
  { id: "todo", label: "To Do", color: "#6B7280" },
  { id: "in_progress", label: "In Progress", color: "#3B82F6" },
  { id: "in_review", label: "In Review", color: "#F59E0B" },
  { id: "done", label: "Done", color: "#10B981" },
];

const PRIORITIES = [
  { id: "low", label: "Low", color: "#94A3B8", bg: "#F1F5F9" },
  { id: "normal", label: "Normal", color: "#6366F1", bg: "#EEF2FF" },
  { id: "high", label: "High", color: "#EF4444", bg: "#FEF2F2" },
];

const DEFAULT_LABELS = [
  { id: "bug", name: "Bug", color: "#EF4444" },
  { id: "feature", name: "Feature", color: "#8B5CF6" },
  { id: "design", name: "Design", color: "#EC4899" },
  { id: "backend", name: "Backend", color: "#F97316" },
  { id: "frontend", name: "Frontend", color: "#06B6D4" },
  { id: "docs", name: "Docs", color: "#10B981" },
];

// ─── Helpers ───
function getDueDateStatus(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 2) return "soon";
  return "ok";
}

const DUE_STYLES = {
  overdue: { color: "#DC2626", bg: "#FEE2E2", icon: "!" },
  today: { color: "#D97706", bg: "#FEF3C7", icon: "•" },
  soon: { color: "#2563EB", bg: "#DBEAFE", icon: "○" },
  ok: { color: "#6B7280", bg: "transparent", icon: "" },
};

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Toast Notification ───
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bg = type === "error" ? "#FEE2E2" : "#ECFDF5";
  const color = type === "error" ? "#DC2626" : "#059669";
  const border = type === "error" ? "#FECACA" : "#A7F3D0";

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 2000,
      background: bg, color: color, border: `1px solid ${border}`,
      padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600,
      fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 16px rgba(0,0,0,.1)",
      animation: "slideUp .2s ease",
    }}>
      {message}
    </div>
  );
}

// ─── Task Modal ───
function TaskModal({ task, onSave, onClose, onDelete, labels }) {
  const [title, setTitle] = useState(task?.title || "");
  const [desc, setDesc] = useState(task?.description || "");
  const [priority, setPriority] = useState(task?.priority || "normal");
  const [dueDate, setDueDate] = useState(task?.due_date || "");
  const [selectedLabels, setSelectedLabels] = useState(task?.labels || []);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const toggleLabel = (id) => {
    setSelectedLabels((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: desc.trim(),
      priority,
      due_date: dueDate || null,
      labels: selectedLabels,
    });
  };

  const s = {
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, animation: "fadeIn .15s ease" },
    modal: { background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480, maxHeight: "90vh", overflow: "auto", boxShadow: "0 25px 60px rgba(0,0,0,.25)", animation: "slideUp .2s ease" },
    header: { padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" },
    h2: { margin: 0, fontSize: 17, fontWeight: 650, color: "#111827", fontFamily: "'DM Sans', sans-serif" },
    close: { background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9CA3AF", padding: 4, lineHeight: 1 },
    body: { padding: "16px 24px 24px" },
    fieldLabel: { display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".5px", fontFamily: "'DM Sans', sans-serif" },
    input: { width: "100%", padding: "10px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box", transition: "border-color .15s" },
    textarea: { width: "100%", padding: "10px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", resize: "vertical", minHeight: 70, boxSizing: "border-box" },
    row: { display: "flex", gap: 12, marginTop: 16 },
    priorityBtn: (active) => ({ flex: 1, padding: "8px 0", border: active ? "1.5px solid #6366F1" : "1.5px solid #E5E7EB", borderRadius: 8, background: active ? "#EEF2FF" : "#fff", cursor: "pointer", fontSize: 13, fontWeight: 550, fontFamily: "'DM Sans', sans-serif", color: active ? "#4338CA" : "#6B7280", transition: "all .15s" }),
    labelsWrap: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 },
    labelChip: (active, color) => ({ padding: "5px 12px", borderRadius: 20, border: active ? `2px solid ${color}` : "2px solid #E5E7EB", background: active ? color + "18" : "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: active ? color : "#9CA3AF", fontFamily: "'DM Sans', sans-serif", transition: "all .15s", userSelect: "none" }),
    saveBtn: { width: "100%", marginTop: 20, padding: "12px 0", background: "#111827", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "background .15s" },
    deleteBtn: { width: "100%", marginTop: 8, padding: "10px 0", background: "transparent", color: "#EF4444", border: "1.5px solid #FEE2E2", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all .15s" },
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <h2 style={s.h2}>{task ? "Edit Task" : "New Task"}</h2>
          <button style={s.close} onClick={onClose}>✕</button>
        </div>
        <div style={s.body}>
          <div>
            <label style={s.fieldLabel}>Title</label>
            <input ref={inputRef} style={s.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" onKeyDown={(e) => e.key === "Enter" && handleSave()} onFocus={(e) => (e.target.style.borderColor = "#6366F1")} onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")} />
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={s.fieldLabel}>Description</label>
            <textarea style={s.textarea} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Add details…" onFocus={(e) => (e.target.style.borderColor = "#6366F1")} onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")} />
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={s.fieldLabel}>Priority</label>
            <div style={s.row}>
              {PRIORITIES.map((p) => (
                <button key={p.id} style={s.priorityBtn(priority === p.id)} onClick={() => setPriority(p.id)}>{p.label}</button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={s.fieldLabel}>Due Date</label>
            <input type="date" style={s.input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} onFocus={(e) => (e.target.style.borderColor = "#6366F1")} onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")} />
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={s.fieldLabel}>Labels</label>
            <div style={s.labelsWrap}>
              {labels.map((l) => (
                <span key={l.id} style={s.labelChip(selectedLabels.includes(l.id), l.color)} onClick={() => toggleLabel(l.id)}>{l.name}</span>
              ))}
            </div>
          </div>
          <button style={s.saveBtn} onClick={handleSave} onMouseEnter={(e) => (e.target.style.background = "#374151")} onMouseLeave={(e) => (e.target.style.background = "#111827")}>{task ? "Save Changes" : "Create Task"}</button>
          {task && (
            <button style={s.deleteBtn} onClick={() => onDelete(task.id)} onMouseEnter={(e) => { e.target.style.background = "#FEF2F2"; }} onMouseLeave={(e) => { e.target.style.background = "transparent"; }}>Delete Task</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Task Card ───
function TaskCard({ task, labels, onEdit, onDragStart }) {
  const [hovered, setHovered] = useState(false);
  const dueStatus = task.status !== "done" ? getDueDateStatus(task.due_date) : null;
  const dueStyle = dueStatus ? DUE_STYLES[dueStatus] : null;
  const prioData = PRIORITIES.find((p) => p.id === task.priority);
  const taskLabels = labels.filter((l) => task.labels?.includes(l.id));

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(task.id); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onEdit(task)}
      style={{
        background: "#fff", borderRadius: 10, padding: "14px 16px", cursor: "grab",
        boxShadow: hovered ? "0 4px 16px rgba(0,0,0,.1)" : "0 1px 3px rgba(0,0,0,.06)",
        transition: "box-shadow .15s, transform .15s",
        transform: hovered ? "translateY(-1px)" : "none",
        borderLeft: `3px solid ${prioData?.color || "#E5E7EB"}`,
        userSelect: "none",
      }}
    >
      {taskLabels.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
          {taskLabels.map((l) => (
            <span key={l.id} style={{ fontSize: 10, fontWeight: 700, color: l.color, background: l.color + "18", padding: "2px 8px", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", letterSpacing: ".3px", textTransform: "uppercase" }}>{l.name}</span>
          ))}
        </div>
      )}
      <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0, lineHeight: 1.4, fontFamily: "'DM Sans', sans-serif" }}>{task.title}</p>
      {task.description && <p style={{ fontSize: 12, color: "#9CA3AF", margin: "4px 0 0", lineHeight: 1.4, fontFamily: "'DM Sans', sans-serif" }}>{task.description}</p>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: prioData?.color, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: ".5px" }}>{prioData?.label}</span>
        {dueStyle && task.due_date && (
          <span style={{ fontSize: 11, fontWeight: 600, color: dueStyle.color, background: dueStyle.bg, padding: "2px 8px", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
            {dueStyle.icon && <span style={{ fontSize: 13, lineHeight: 1 }}>{dueStyle.icon}</span>}
            {formatDate(task.due_date)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Column ───
function Column({ col, tasks, labels, onEdit, onDragStart, onDrop, onAddTask }) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div style={{ flex: "1 1 280px", minWidth: 260, maxWidth: 360, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, padding: "0 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.color }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: ".8px", fontFamily: "'DM Sans', sans-serif" }}>{col.label}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", background: "#F3F4F6", borderRadius: 10, padding: "1px 8px", fontFamily: "'DM Sans', sans-serif" }}>{tasks.length}</span>
        </div>
        <button onClick={() => onAddTask(col.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9CA3AF", lineHeight: 1, padding: "0 4px", transition: "color .15s" }} onMouseEnter={(e) => (e.target.style.color = "#6366F1")} onMouseLeave={(e) => (e.target.style.color = "#9CA3AF")}>+</button>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onDrop(col.id); }}
        style={{
          flex: 1, background: dragOver ? "#F0F4FF" : "#F9FAFB", borderRadius: 12,
          padding: 8, display: "flex", flexDirection: "column", gap: 8, minHeight: 120,
          transition: "background .15s", border: dragOver ? "2px dashed #6366F1" : "2px dashed transparent",
        }}
      >
        {tasks.length === 0 && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "#D1D5DB", fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>No tasks</div>}
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} labels={labels} onEdit={onEdit} onDragStart={onDragStart} />
        ))}
      </div>
    </div>
  );
}

// ─── Main App ───
export default function App() {
  const [tasks, setTasks] = useState([]);
  const [labels] = useState(DEFAULT_LABELS);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [newTaskStatus, setNewTaskStatus] = useState("todo");
  const [filterLabel, setFilterLabel] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const dragId = useRef(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
  }, []);

  // ─── Auth: sign in anonymously on load ───
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) {
          showToast("Failed to create session: " + error.message, "error");
          setLoading(false);
          return;
        }
      }
      fetchTasks();
    };
    initAuth();
  }, []);

  // ─── Fetch all tasks ───
  const fetchTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      showToast("Failed to load tasks: " + error.message, "error");
    } else {
      setTasks(data || []);
    }
    setLoading(false);
  };

  // ─── Create task ───
  const createTask = async (taskData) => {
    const { data, error } = await supabase
      .from("tasks")
      .insert([{ ...taskData, status: newTaskStatus }])
      .select()
      .single();

    if (error) {
      showToast("Failed to create task: " + error.message, "error");
    } else {
      setTasks((prev) => [...prev, data]);
      setModalOpen(false);
      showToast("Task created");
    }
  };

  // ─── Update task ───
  const updateTask = async (taskData) => {
    const { data, error } = await supabase
      .from("tasks")
      .update(taskData)
      .eq("id", editingTask.id)
      .select()
      .single();

    if (error) {
      showToast("Failed to update task: " + error.message, "error");
    } else {
      setTasks((prev) => prev.map((t) => (t.id === data.id ? data : t)));
      setModalOpen(false);
      setEditingTask(null);
      showToast("Task updated");
    }
  };

  // ─── Delete task ───
  const deleteTask = async (id) => {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id);

    if (error) {
      showToast("Failed to delete task: " + error.message, "error");
    } else {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setModalOpen(false);
      setEditingTask(null);
      showToast("Task deleted");
    }
  };

  // ─── Drag & drop: update status ───
  const handleDrop = async (colId) => {
    if (!dragId.current) return;
    const taskId = dragId.current;
    dragId.current = null;

    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: colId } : t)));

    const { error } = await supabase
      .from("tasks")
      .update({ status: colId })
      .eq("id", taskId);

    if (error) {
      showToast("Failed to move task: " + error.message, "error");
      fetchTasks(); // revert by re-fetching
    }
  };

  const handleSave = (data) => {
    if (editingTask) {
      updateTask(data);
    } else {
      createTask(data);
    }
  };

  const openNew = (status) => {
    setEditingTask(null);
    setNewTaskStatus(status);
    setModalOpen(true);
  };

  const openEdit = (task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  // ─── Filtering ───
  const filtered = tasks.filter((t) => {
    if (filterLabel && !t.labels?.includes(filterLabel)) return false;
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === "done").length,
    overdue: tasks.filter((t) => t.status !== "done" && getDueDateStatus(t.due_date) === "overdue").length,
  };

  // ─── Render ───
  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
        ::-webkit-scrollbar { height: 6px; }
        ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F3F4F6", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366F1, #8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 16 }}>T</div>
          <span style={{ fontSize: 20, fontWeight: 800, color: "#111827", letterSpacing: "-.5px" }}>Taskflow</span>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}><span style={{ fontWeight: 700, color: "#111827", fontSize: 14 }}>{stats.total}</span> total</span>
          <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}><span style={{ fontWeight: 700, color: "#10B981", fontSize: 14 }}>{stats.done}</span> done</span>
          {stats.overdue > 0 && <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}><span style={{ fontWeight: 700, color: "#EF4444", fontSize: 14 }}>{stats.overdue}</span> overdue</span>}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ padding: "12px 32px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid #F3F4F6" }}>
        <input
          style={{ padding: "8px 14px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", width: 200, transition: "border-color .15s" }}
          placeholder="Search tasks…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={(e) => (e.target.style.borderColor = "#6366F1")}
          onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
        />
        {labels.map((l) => (
          <span key={l.id} onClick={() => setFilterLabel(filterLabel === l.id ? null : l.id)} style={{ padding: "5px 14px", borderRadius: 20, border: filterLabel === l.id ? `2px solid ${l.color}` : "1.5px solid #E5E7EB", background: filterLabel === l.id ? l.color + "15" : "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: filterLabel === l.id ? l.color : "#9CA3AF", fontFamily: "'DM Sans', sans-serif", transition: "all .15s", userSelect: "none" }}>{l.name}</span>
        ))}
        {(filterLabel || searchQuery) && <button onClick={() => { setFilterLabel(null); setSearchQuery(""); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#6366F1", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Clear</button>}
      </div>

      {/* Loading State */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#9CA3AF", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>
          Loading tasks…
        </div>
      ) : (
        /* Board */
        <div style={{ display: "flex", gap: 16, padding: "20px 32px 40px", overflowX: "auto" }}>
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              col={col}
              tasks={filtered.filter((t) => t.status === col.id)}
              labels={labels}
              onEdit={openEdit}
              onDragStart={(id) => (dragId.current = id)}
              onDrop={handleDrop}
              onAddTask={openNew}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <TaskModal
          task={editingTask}
          labels={labels}
          onSave={handleSave}
          onDelete={deleteTask}
          onClose={() => { setModalOpen(false); setEditingTask(null); }}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}