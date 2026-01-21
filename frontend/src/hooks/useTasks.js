'use client';

import { useState, useCallback, useEffect } from "react";
import { taskAPI } from "../services/api";

export const useTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all tasks
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await taskAPI.getTasks();
      setTasks(data.results || data);
    } catch (err) {
      setError(err.message);
      console.error("Error fetching tasks:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create task
  const createTask = useCallback(async (taskData) => {
    setError(null);
    try {
      const newTask = await taskAPI.createTask(taskData);
      await fetchTasks();
      return newTask;
    } catch (err) {
      setError(err.message);
      console.error("Error creating task:", err);
      throw err;
    }
  }, [fetchTasks]);

  // Update task - SIMPLIFIED
  const updateTask = useCallback(async (taskId, updates) => {
    setError(null);
    try {
      const updated = await taskAPI.updateTask(taskId, updates);
      // Wait a bit for backend cascade updates, then refresh
      setTimeout(() => {
        fetchTasks();
      }, 300);
      return updated;
    } catch (err) {
      setError(err.message);
      console.error("Error updating task:", err);
      throw err;
    }
  }, [fetchTasks]);

  // Delete task
  const deleteTask = useCallback(async (taskId) => {
    setError(null);
    try {
      await taskAPI.deleteTask(taskId);
      await fetchTasks();
    } catch (err) {
      setError(err.message);
      console.error("Error deleting task:", err);
      throw err;
    }
  }, [fetchTasks]);

  // Add dependency
  const addDependency = useCallback(async (taskId, dependsOnId) => {
    setError(null);
    try {
      await taskAPI.addDependency(taskId, dependsOnId);
      await fetchTasks();
    } catch (err) {
      setError(err.message);
      console.error("Error adding dependency:", err);
      throw err;
    }
  }, [fetchTasks]);

  // Remove dependency
  const removeDependency = useCallback(async (taskId, dependsOnId) => {
    setError(null);
    try {
      await taskAPI.removeDependency(taskId, dependsOnId);
      await fetchTasks();
    } catch (err) {
      setError(err.message);
      console.error("Error removing dependency:", err);
      throw err;
    }
  }, [fetchTasks]);

  // Check circular dependency
  const checkCircularDependency = useCallback(async (taskId, dependsOnId) => {
    try {
      return await taskAPI.checkCircularDependency(taskId, dependsOnId);
    } catch (err) {
      setError(err.message);
      console.error("Error checking circular dependency:", err);
      throw err;
    }
  }, []);

  // Initialize
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    addDependency,
    removeDependency,
    checkCircularDependency
  };
};