export function createPendingActionRegistry<Action>() {
  const actions = new Map<number, Action>();

  return {
    begin(id: number, action: Action) {
      if (actions.has(id)) return false;
      actions.set(id, action);
      return true;
    },
    end(id: number) {
      actions.delete(id);
    },
    get(id: number) {
      return actions.get(id);
    },
    has(id: number) {
      return actions.has(id);
    },
    snapshot() {
      return new Map(actions);
    },
  };
}
