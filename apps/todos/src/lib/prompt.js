// The hand-off to an agent.
//
// Deliberately short. Whoever pastes this is talking to an agent that already
// has the repo, the playbooks and the file open to it, so restating the context
// wastes its attention and buries the one thing it needs: which item, and where.

export function promptFor(item, path) {
  const due = item.due ? ` (due ${item.due})` : '';
  return `Start on ^${item.id} in ${path}: ${item.text}${due}`;
}
