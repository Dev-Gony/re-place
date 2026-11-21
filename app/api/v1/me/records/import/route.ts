import { importLedgerItems } from "../../../../../../lib/ledger-import-store";
import { validateLedgerImport } from "../../../../../../lib/ledger-import-validate";
import {
  currentOwnerId,
  v1Error,
  v1Mutation,
} from "../../../../../../lib/workspace-api";

export const dynamic = "force-dynamic";

// RPL-064: 무료 진단(/check) 결과를 내 체험단으로 가져온다.
// 응답에 만든 기록·일정·정산을 그대로 돌려줘 클라이언트가 전체 새로고침 없이 반영한다.
export async function POST(request: Request) {
  const owner = await currentOwnerId();
  if (!owner) return v1Error("UNAUTHORIZED", "Authentication required", 401);

  const body = await request.json().catch(() => null);
  const validation = validateLedgerImport(body);
  if (!validation.ok) return v1Error("INVALID_INPUT", validation.message, 400);

  const created = await importLedgerItems(owner, validation.items);

  return v1Mutation(
    {
      imported: created.records.length,
      records: created.records,
      tasks: created.tasks,
      settlements: created.settlements,
      skipped: validation.skipped,
    },
    201,
  );
}
