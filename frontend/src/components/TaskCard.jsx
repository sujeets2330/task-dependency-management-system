'use client';

import { useState } from "react";

export default function TaskCard({
  task,
  allTasks,
  onStatusChange,
  onAddDependency,
  onRemoveDependency,
  onDelete,
  onCheckCircularDependency,
  isLoading
}) {
  const [expandDependencies, setExpandDependencies] = useState(false);
  const [selectedDependency, setSelectedDependency] = useState("");
  const [circularCheckLoading, setCircularCheckLoading] = useState(false);
  const [circularError, setCircularError] = useState(null);

  const statusColors = {
    pending: "status-pending",
    in_progress: "status-in_progress",
    completed: "status-completed",
    blocked: "status-blocked"
  };

  const statusLabels = {
    pending: "Pending",
    in_progress: "In Progress",
    completed: "Completed",
    blocked: "Blocked"
  };

  // Get available statuses - FIXED VERSION
  const getAvailableStatuses = () => {
    const allStatuses = [
      { value: 'pending', label: 'Pending' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'completed', label: 'Completed' },
      { value: 'blocked', label: 'Blocked' }
    ];

    const currentStatus = task.status;

    // If task is completed, it stays completed
    if (currentStatus === 'completed') {
      return allStatuses.filter(s => s.value === 'completed');
    }

    // Check if ALL dependencies are completed
    const allDepsCompleted = task.dependencies.length === 0 || 
      task.dependencies.every(dep => {
        const depTask = allTasks.find(t => t.id === dep.depends_on);
        return depTask?.status === 'completed';
      });

    // If dependencies are NOT all completed, task should be BLOCKED
    if (!allDepsCompleted) {
      return allStatuses.filter(s => s.value === 'blocked');
    }

    // ALL dependencies are completed! Task is READY for normal workflow
    
    // Blocked → can become Pending (when dependencies get completed)
    if (currentStatus === 'blocked') {
      return allStatuses.filter(s => s.value === 'pending');
    }
    
    // Pending → can start work (In Progress)
    if (currentStatus === 'pending') {
      return allStatuses.filter(s => 
        s.value === 'pending' || 
        s.value === 'in_progress'
      );
    }
    
    // In Progress → can finish work (Completed)
    if (currentStatus === 'in_progress') {
      return allStatuses.filter(s => 
        s.value === 'in_progress' || 
        s.value === 'completed'
      );
    }

    return allStatuses;
  };

  const handleStatusChange = async (newStatus) => {
    console.log(`Changing task ${task.id} status to ${newStatus}`);
    try {
      await onStatusChange(task.id, newStatus);
    } catch (error) {
      console.error("Failed to change status:", error);
    }
  };

  const handleAddDependency = async () => {
    if (!selectedDependency) return;

    const depId = parseInt(selectedDependency);
    if (depId === task.id) {
      alert("A task cannot depend on itself");
      return;
    }

    setCircularCheckLoading(true);
    setCircularError(null);

    try {
      const result = await onCheckCircularDependency(task.id, depId);
      if (result.has_cycle) {
        setCircularError(`Circular dependency detected: ${result.path.join(" -> ")}`);
      } else {
        await onAddDependency(task.id, depId);
        setSelectedDependency("");
      }
    } catch (err) {
      setCircularError(err.message);
    } finally {
      setCircularCheckLoading(false);
    }
  };

  const availableTasks = allTasks.filter(
    (t) =>
      t.id !== task.id &&
      !task.dependencies.some((d) => d.depends_on === t.id)
  );

  const availableStatuses = getAvailableStatuses();

  return (
    <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-primary">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-semibold text-dark">{task.title}</h3>
          {task.description && (
            <p className="text-sm text-secondary mt-1">{task.description}</p>
          )}
        </div>
        <span className={`status-badge ${statusColors[task.status]}`}>
          {statusLabels[task.status]}
        </span>
      </div>

      <div className="mb-3 flex gap-2">
        <select
          value={task.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={isLoading || availableStatuses.length === 1}
        >
          {availableStatuses.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          onClick={() => onDelete(task.id)}
          disabled={isLoading}
          className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm disabled:opacity-50 transition-colors"
        >
          Delete
        </button>
      </div>

      {/* Dependencies Section */}
      <div className="border-t pt-3 mt-3">
        <button
          onClick={() => setExpandDependencies(!expandDependencies)}
          className="text-sm font-medium text-primary hover:underline mb-2"
        >
          {expandDependencies ? "Hide" : "Show"} Dependencies ({task.dependencies.length})
        </button>

        {expandDependencies && (
          <div className="space-y-2">
            {task.dependencies.length > 0 && (
              <div className="bg-gray-50 p-2 rounded">
                <p className="text-xs font-medium text-secondary mb-2">This task depends on:</p>
                {task.dependencies.map((dep) => (
                  <div
                    key={dep.id}
                    className="flex justify-between items-center bg-white p-2 rounded mb-1"
                  >
                    <span className="text-sm">{dep.depends_on_title}</span>
                    <button
                      onClick={() => onRemoveDependency(task.id, dep.depends_on)}
                      className="text-xs text-red-600 hover:text-red-700"
                      disabled={isLoading}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Dependency */}
            <div className="bg-gray-50 p-2 rounded">
              <p className="text-xs font-medium text-secondary mb-2">Add dependency:</p>
              <div className="flex gap-2">
                <select
                  value={selectedDependency}
                  onChange={(e) => {
                    setSelectedDependency(e.target.value);
                    setCircularError(null);
                  }}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={circularCheckLoading || availableTasks.length === 0}
                >
                  <option value="">Select a task...</option>
                  {availableTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({statusLabels[t.status]})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddDependency}
                  disabled={!selectedDependency || circularCheckLoading || isLoading}
                  className="px-2 py-1 bg-success text-white rounded text-sm hover:bg-green-600 disabled:opacity-50 transition-colors"
                >
                  {circularCheckLoading ? "Checking..." : "Add"}
                </button>
              </div>
              {circularError && (
                <p className="text-xs text-red-600 mt-1">{circularError}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}