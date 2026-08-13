import { appConnection } from "../../infrastructure/mongo/mongo.service";
import { paymentRecordSchema } from "./payment.schema";
import type { PaymentRecord } from "./payment.types";

export const PaymentModel = appConnection.model<PaymentRecord>("Payment", paymentRecordSchema);
