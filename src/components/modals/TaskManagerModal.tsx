import React, { useState } from 'react';
import { TaskListModal } from './TaskListModal';
import { TaskWizardModal } from './TaskWizardModal';
import { TaskModalProps } from '@/types/tasks';

interface TaskManagerModalProps extends TaskModalProps {
  openWizardOnOpen?: boolean;
  editTask?: any;
}

export function TaskManagerModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated,
  openWizardOnOpen = false,
  editTask
}: TaskManagerModalProps) {
  const [showWizard, setShowWizard] = useState(openWizardOnOpen || !!editTask);

  const handleCreateTask = () => {
    setShowWizard(true);
  };

  const handleWizardClose = () => {
    setShowWizard(false);
  };

  const handleTaskCreated = () => {
    setShowWizard(false);
    // Refresh the task list by triggering a re-render
    if (onAgentUpdated) {
      onAgentUpdated({ ...agentData });
    }
  };

  const handleModalClose = () => {
    setShowWizard(false);
    onClose();
  };

  if (showWizard) {
    return (
      <TaskWizardModal
        isOpen={isOpen}
        onClose={handleWizardClose}
        agentId={agentId}
        agentData={agentData}
        onTaskCreated={handleTaskCreated}
      />
    );
  }

  return (
    <TaskListModal
      isOpen={isOpen}
      onClose={handleModalClose}
      agentId={agentId}
      agentData={agentData}
              onCreateTask={handleCreateTask}
        onAgentUpdated={onAgentUpdated}
        onEditTask={(task) => {
          setShowWizard(true);
          // Pass the task to be edited
        }}
    />
  );
}
