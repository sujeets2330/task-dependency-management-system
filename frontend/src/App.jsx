'use client';

import { useState, useCallback } from "react";
import { useTasks } from "./hooks/useTasks";
import TaskForm from "./components/TaskForm";
import TaskList from "./components/TaskList";
import DependencyGraph from "./components/DependencyGraph";

export default function App() {
  const {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    addDependency,
    removeDependency,
    checkCircularDependency
  } = useTasks();

  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [activeTab, setActiveTab] = useState("list");
  const [createError, setCreateError] = useState(null);

  const handleCreateTask = useCallback(
    async (taskData) => {
      setCreateError(null);
      try {
        await createTask(taskData);
      } catch (err) {
        setCreateError(err.message);
        throw err;
      }
    },
    [createTask]
  );

  const handleStatusChange = useCallback(
    async (taskId, newStatus) => {
      try {
        await updateTask(taskId, { status: newStatus });
      } catch (err) {
        alert(`Error updating task: ${err.message}`);
      }
    },
    [updateTask]
  );

  const handleDelete = useCallback(
    async (taskId) => {
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.dependent_tasks.length > 0) {
        const dependents = task.dependent_tasks.map((t) => t.title).join(", ");
        const confirmed = window.confirm(
          `Warning: ${task.dependent_tasks.length} task(s) depend on this task: ${dependents}\n\nAre you sure you want to delete it?`
        );
        if (!confirmed) return;
      } else {
        if (!window.confirm("Are you sure you want to delete this task?")) return;
      }

      try {
        await deleteTask(taskId);
      } catch (err) {
        alert(`Error deleting task: ${err.message}`);
      }
    },
    [tasks, deleteTask]
  );

  const handleAddDependency = useCallback(
    async (taskId, dependsOnId) => {
      try {
        await addDependency(taskId, dependsOnId);
      } catch (err) {
        alert(`Error adding dependency: ${err.message}`);
      }
    },
    [addDependency]
  );

  const handleRemoveDependency = useCallback(
    async (taskId, dependsOnId) => {
      try {
        await removeDependency(taskId, dependsOnId);
      } catch (err) {
        alert(`Error removing dependency: ${err.message}`);
      }
    },
    [removeDependency]
  );

  const getDependencies = useCallback(() => {
    return tasks.flatMap((task) =>
      task.dependencies.map((dep) => ({
        task_id: task.id,
        depends_on_id: dep.depends_on,
        id: dep.id
      }))
    );
  }, [tasks]);

  return (
    <div className="min-h-screen bg-light">
      {/* Header */}
      <header className="bg-dark text-white py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold">Task Dependency Manager</h1>
          <p className="text-gray-300 mt-2">
            Manage tasks with dependencies and automatic status updates
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-8 px-4">
        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab("list")}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === "list"
                ? "bg-primary text-white"
                : "bg-white text-dark hover:bg-gray-100"
            }`}
          >
            Task List
          </button>
          <button
            onClick={() => setActiveTab("graph")}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === "graph"
                ? "bg-primary text-white"
                : "bg-white text-dark hover:bg-gray-100"
            }`}
          >
            Dependency Graph
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar with Form */}
          <div className="lg:col-span-1">
            <TaskForm onSubmit={handleCreateTask} isLoading={loading} />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            {activeTab === "list" ? (
              <TaskList
                tasks={tasks}
                onStatusChange={handleStatusChange}
                onAddDependency={handleAddDependency}
                onRemoveDependency={handleRemoveDependency}
                onDelete={handleDelete}
                onCheckCircularDependency={checkCircularDependency}
                isLoading={loading}
                error={error || createError}
              />
            ) : (
              <DependencyGraph
                tasks={tasks}
                dependencies={getDependencies()}
                selectedTaskId={selectedTaskId}
              />
            )}
          </div>
        </div>

        {/* Stats */}
        {tasks.length > 0 && (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-md text-center">
              <p className="text-2xl font-bold text-primary">{tasks.length}</p>
              <p className="text-sm text-secondary">Total Tasks</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md text-center">
              <p className="text-2xl font-bold text-blue-500">
                {tasks.filter((t) => t.status === "in_progress").length}
              </p>
              <p className="text-sm text-secondary">In Progress</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md text-center">
              <p className="text-2xl font-bold text-green-500">
                {tasks.filter((t) => t.status === "completed").length}
              </p>
              <p className="text-sm text-secondary">Completed</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md text-center">
              <p className="text-2xl font-bold text-red-500">
                {tasks.filter((t) => t.status === "blocked").length}
              </p>
              <p className="text-sm text-secondary">Blocked</p>
            </div>
          </div>
        )}
      </main>
    </div>
    
  );
  <button 
  onClick={forceRefresh}
  className="bg-yellow-500 text-white p-2 rounded"
>
   Force Refresh
</button>
}
