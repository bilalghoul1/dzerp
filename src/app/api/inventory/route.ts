import { NextResponse } from "next/server";
import { apiGuard } from "@/features/auth/api-guard";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { recordAudit } from "@/features/audit/service";
import { recordActivity } from "@/features/activity/service";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import {
  inventoryMovementSchema,
  createInventoryMovement,
  getStockOnHand,
  getStockSummary,
  listInventoryMovements,
} from "@/features/inventory/config";

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("inventory.view");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const view = searchParams.get("view");
      if (view === "summary") {
        return okResponse(await getStockSummary());
      }
      const [movements, stock] = await Promise.all([
        listInventoryMovements(),
        getStockOnHand(),
      ]);
      return okResponse({ movements, stock });
    } catch (error) {
      console.error("inventory GET error:", error);
      return errorResponse(error);
    }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const transfer = searchParams.get("action") === "transfer";

  const guard = await apiGuardWithContext(
    transfer ? "inventory.transfer" : "inventory.create",
  );
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));

      if (transfer) {
        const { createTransfer } = await import("@/features/inventory/config");
        const { inventoryTransferSchema } = await import(
          "@/features/inventory/config"
        );
        const parsed = inventoryTransferSchema.safeParse(body);
        if (!parsed.success) {
          throw new ApiError(
            400,
            "Invalid request body.",
            "INVALID_BODY",
            parsed.error.flatten(),
          );
        }
        const result = await createTransfer(parsed.data, guard.session.user.id);

        await recordAudit({
          action: "CREATE",
          entity: "InventoryMovement",
          entityId: result.movement.id,
          actorId: guard.session.user.id,
        });
        await recordActivity({
          type: "CREATE",
          entity: "InventoryMovement",
          entityId: result.movement.id,
          actorId: guard.session.user.id,
          title: `Inventory transfer: ${result.movement.productName} (${result.movement.number})`,
          titleAr: `تحويل مخزون: ${result.movement.productName} (${result.movement.number})`,
        });

        return okResponse(result, { status: 201 });
      }

      const parsed = inventoryMovementSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(
          400,
          "Invalid request body.",
          "INVALID_BODY",
          parsed.error.flatten(),
        );
      }

      if (parsed.data.type === "ADJUSTMENT") {
        const guardAdjust = await apiGuard("inventory.adjust");
        if (guardAdjust.response) return guardAdjust.response;
      }

      const result = await createInventoryMovement(
        parsed.data,
        guard.session.user.id,
      );

      await recordAudit({
        action: "CREATE",
        entity: "InventoryMovement",
        entityId: result.movement.id,
        actorId: guard.session.user.id,
      });
      await recordActivity({
        type: "CREATE",
        entity: "InventoryMovement",
        entityId: result.movement.id,
        actorId: guard.session.user.id,
        title: `Inventory movement: ${result.movement.productName} (${result.movement.number})`,
        titleAr: `حركة مخزون: ${result.movement.productName} (${result.movement.number})`,
      });

      return okResponse(result, { status: 201 });
    } catch (error) {
      console.error("inventory POST error:", error);
      return errorResponse(error);
    }
  });
}
