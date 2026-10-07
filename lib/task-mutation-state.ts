import type { TaskItem, TaskMutationItem } from "./workspace-contract";

export type TaskDisplayContext = Pick<
  TaskItem,
  "record_title" | "record_platform"
>;

export function upsertTaskMutation(
  tasks: TaskItem[],
  mutation: TaskMutationItem,
  context: TaskDisplayContext,
) {
  const current = tasks.find((task) => task.id === mutation.id);
  const next: TaskItem = {
    ...mutation,
    record_title: current?.record_title ?? context.record_title,
    record_platform: current?.record_platform ?? context.record_platform,
  };

  if (!current) return [...tasks, next];
  return tasks.map((task) => (task.id === mutation.id ? next : task));
}

export function removeTaskMutation(tasks: TaskItem[], id: number) {
  return tasks.filter((task) => task.id !== id);
}
