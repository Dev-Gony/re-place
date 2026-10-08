import type { RecordItem } from "./workspace-contract";

export function upsertRecordMutation(
  records: RecordItem[],
  mutation: RecordItem,
) {
  const current = records.find((record) => record.id === mutation.id);
  if (!current) return [...records, mutation];
  return records.map((record) =>
    record.id === mutation.id ? mutation : record,
  );
}
