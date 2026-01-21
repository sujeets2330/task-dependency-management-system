from django.db import models


class Task(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('blocked', 'Blocked'),
    ]

    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        db_table = 'tasks'

    def __str__(self):
        return f"{self.id} - {self.title}"
    
    def save(self, *args, **kwargs):
        """Override save to handle auto-updates when task is completed."""
        # Get old status if this is an existing task
        old_status = None
        if self.pk:
            try:
                old_task = Task.objects.get(pk=self.pk)
                old_status = old_task.status
            except Task.DoesNotExist:
                old_status = None
        
        # Save the task first
        super().save(*args, **kwargs)
        
        # Only trigger cascade updates when status changes TO completed
        if old_status != self.status and self.status == 'completed':
            # Import here to avoid circular imports
            from .status_updater import TaskStatusUpdater
            TaskStatusUpdater.cascade_update_on_completion(self.id)


class TaskDependency(models.Model):
    id = models.AutoField(primary_key=True)
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='dependencies'
    )
    depends_on = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='dependents'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('task', 'depends_on')
        db_table = 'task_dependencies'

    def __str__(self):
        return f"Task {self.task.id} depends on Task {self.depends_on.id}"
    
    def save(self, *args, **kwargs):
        """Override save to update task status when dependency is added."""
        # Save the dependency first
        super().save(*args, **kwargs)
        
        # Update the dependent task's status based on new dependency
        from .status_updater import TaskStatusUpdater
        TaskStatusUpdater.update_status_from_dependencies(self.task_id)

    def delete(self, *args, **kwargs):
        """Override delete to update task status when dependency is removed."""
        # Get task ID before deletion
        task_id = self.task_id
        
        # Delete the dependency
        super().delete(*args, **kwargs)
        
        # Update the task's status after dependency is removed
        from .status_updater import TaskStatusUpdater
        TaskStatusUpdater.update_status_from_dependencies(task_id)