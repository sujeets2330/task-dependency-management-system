from .models import Task, TaskDependency


class TaskStatusUpdater:
    """
    Automatically updates task status based on dependency completion.
    
    Rules:
    1. Task with NO dependencies → status stays as user set it
    2. Task WITH dependencies:
       - ANY dependency is NOT 'completed' → this task = 'blocked'
       - ALL dependencies are 'completed' → this task = 'pending' (READY!)
    3. When task marked 'completed' → update ALL tasks that depend on it
    """

    @staticmethod
    def update_status_from_dependencies(task_id):
        """
        Update a task's status based on its dependencies.
        Returns: True if status changed, False if not
        """
        try:
            task = Task.objects.get(id=task_id)
        except Task.DoesNotExist:
            return False

        # Get all dependencies of this task
        dependencies = TaskDependency.objects.filter(task_id=task_id).select_related('depends_on')
        
        # If no dependencies, don't change status automatically
        if not dependencies.exists():
            return False

        # Check if ALL dependencies are completed
        all_completed = True
        for dep in dependencies:
            if dep.depends_on.status != 'completed':
                all_completed = False
                break

        # Determine new status
        if all_completed:
            new_status = 'pending'  # READY to work!
        else:
            new_status = 'blocked'  # Still waiting for dependencies

        # Only update if status actually changed
        if task.status != new_status and task.status != 'completed':
            # If task is already completed, don't change it back
            if task.status == 'completed':
                return False
                
            task.status = new_status
            task.save(update_fields=['status', 'updated_at'])
            print(f" Auto-updated task {task_id} from '{task.status}' to '{new_status}'")
            return True
        
        return False

    @staticmethod
    def cascade_update_on_completion(task_id):
        """
        When a task is completed, update ALL tasks that depend on it.
        This continues down the chain.
        """
        try:
            task = Task.objects.get(id=task_id)
        except Task.DoesNotExist:
            return

        # Only cascade if task is actually completed
        if task.status != 'completed':
            return

        print(f" Cascading updates from completed task {task_id}...")

        # Find ALL tasks that directly depend on this completed task
        dependent_ids = TaskDependency.objects.filter(
            depends_on_id=task_id
        ).values_list('task_id', flat=True).distinct()

        # Update each dependent task
        for dep_id in dependent_ids:
            updated = TaskStatusUpdater.update_status_from_dependencies(dep_id)
            if updated:
                print(f" Updated dependent task {dep_id}")
                # If this dependent task was updated, cascade further
                TaskStatusUpdater.cascade_update_on_completion(dep_id)

    @staticmethod
    def get_task_readiness(task_id):
        """
        Check if a task is ready to work on (all dependencies completed).
        Returns: (is_ready, blocking_tasks)
        """
        try:
            task = Task.objects.get(id=task_id)
        except Task.DoesNotExist:
            return False, []

        dependencies = TaskDependency.objects.filter(task_id=task_id).select_related('depends_on')
        
        if not dependencies.exists():
            return True, []  # No dependencies = always ready
        
        blocking_tasks = []
        for dep in dependencies:
            if dep.depends_on.status != 'completed':
                blocking_tasks.append({
                    'id': dep.depends_on.id,
                    'title': dep.depends_on.title,
                    'status': dep.depends_on.status
                })
        
        is_ready = len(blocking_tasks) == 0
        return is_ready, blocking_tasks