from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from .models import Task, TaskDependency
from .serializers import (
    TaskSerializer,
    TaskCreateUpdateSerializer,
    AddDependencySerializer
)
from .dependency_checker import CircularDependencyChecker


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TaskCreateUpdateSerializer
        return TaskSerializer

    def create(self, request, *args, **kwargs):
        """Create a new task."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            TaskSerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        """Update task details."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        # Save the task (auto-updates handled in Task.save())
        self.perform_update(serializer)
        
        return Response(TaskSerializer(instance).data)

    def destroy(self, request, *args, **kwargs):
        """Delete a task."""
        instance = self.get_object()
        
        # Get tasks that depend on this task
        dependent_count = TaskDependency.objects.filter(depends_on_id=instance.id).count()
        
        if dependent_count > 0:
            dependent_tasks = TaskDependency.objects.filter(
                depends_on_id=instance.id
            ).values_list('task__id', 'task__title')
            
            return Response(
                {
                    'error': 'Cannot delete task. Other tasks depend on it.',
                    'dependent_tasks': [
                        {'id': task_id, 'title': title} 
                        for task_id, title in dependent_tasks
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def add_dependency(self, request, pk=None):
        """Add a dependency to a task."""
        task = self.get_object()
        serializer = AddDependencySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        depends_on_id = serializer.validated_data['depends_on_id']
        
        # Check if task is trying to depend on itself
        if task.id == depends_on_id:
            return Response(
                {'error': 'A task cannot depend on itself.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if dependency already exists
        if TaskDependency.objects.filter(
            task_id=task.id,
            depends_on_id=depends_on_id
        ).exists():
            return Response(
                {'error': 'This dependency already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check for circular dependency
        result = CircularDependencyChecker.detect_circular_dependency(
            task.id,
            depends_on_id
        )

        if result['has_cycle']:
            return Response(
                {
                    'error': 'Circular dependency detected',
                    'path': result['path']
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create the dependency
        try:
            depends_on_task = Task.objects.get(id=depends_on_id)
            dependency = TaskDependency.objects.create(
                task=task,
                depends_on=depends_on_task
            )
            
            return Response(
                {
                    'message': 'Dependency added successfully',
                    'dependency': {
                        'id': dependency.id,
                        'depends_on_id': depends_on_id,
                        'depends_on_title': depends_on_task.title,
                    }
                },
                status=status.HTTP_201_CREATED
            )
        except Task.DoesNotExist:
            return Response(
                {'error': 'Task not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['delete'])
    def remove_dependency(self, request, pk=None):
        """Remove a dependency from a task."""
        task = self.get_object()
        depends_on_id = request.query_params.get('depends_on_id')

        if not depends_on_id:
            return Response(
                {'error': 'depends_on_id is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            dependency = TaskDependency.objects.get(
                task_id=task.id,
                depends_on_id=depends_on_id
            )
            dependency.delete()
            
            return Response(
                {'message': 'Dependency removed successfully'},
                status=status.HTTP_204_NO_CONTENT
            )
        except TaskDependency.DoesNotExist:
            return Response(
                {'error': 'Dependency not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['post'])
    def check_circular_dependency(self, request):
        """Check if adding a dependency would create a circular reference."""
        task_id = request.data.get('task_id')
        depends_on_id = request.data.get('depends_on_id')
        
        if not task_id or not depends_on_id:
            return Response(
                {'error': 'task_id and depends_on_id are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            result = CircularDependencyChecker.detect_circular_dependency(
                int(task_id),
                int(depends_on_id)
            )
            
            return Response({
                'has_cycle': result['has_cycle'],
                'path': result['path']
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def graph_data(self, request):
        """Get all tasks and dependencies for the full graph visualization."""
        all_tasks = Task.objects.all().values('id', 'title', 'status')
        dependencies = TaskDependency.objects.all().values('id', 'task_id', 'depends_on_id')
        
        return Response({
            'tasks': list(all_tasks),
            'dependencies': list(dependencies)
        })