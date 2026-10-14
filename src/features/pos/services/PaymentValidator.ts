import type { PaymentItemInput } from './PaymentService';

export function validatePaymentAmounts(
  totalMinor: number,
  payments: PaymentItemInput[]
): { isValid: boolean; error?: string; totalPaid: number; remaining: number; change: number } {
    if (!Number.isInteger(totalMinor) || totalMinor <= 0) {
      return {
        isValid: false,
        error: 'إجمالي الطلب غير صالح للسداد (يجب أن يكون أكبر من صفر).',
        totalPaid: 0,
        remaining: Math.max(0, totalMinor),
        change: 0,
      };
    }

    if (!Array.isArray(payments) || payments.length === 0) {
      return {
        isValid: false,
        error: 'يجب تحديد طريقة ومبلغ دفع واحد على الأقل.',
        totalPaid: 0,
        remaining: totalMinor,
        change: 0,
      };
    }

    let totalPaid = 0;
    let totalChange = 0;

    for (let i = 0; i < payments.length; i++) {
      const p = payments[i];

      if (!Number.isInteger(p.amount) || p.amount <= 0) {
        return {
          isValid: false,
          error: `مبلغ الدفع للدفعة (${i + 1}) غير صالح (يجب أن يكون رقماً صحيحاً موجباً).`,
          totalPaid,
          remaining: Math.max(0, totalMinor - totalPaid),
          change: totalChange,
        };
      }

      if (p.method !== 'CASH' && p.method !== 'CARD') {
        return {
          isValid: false,
          error: `طريقة الدفع "${p.method}" غير مدعومة. الطرق المعتمدة: نقدي (CASH)، بطاقة (CARD).`,
          totalPaid,
          remaining: Math.max(0, totalMinor - totalPaid),
          change: totalChange,
        };
      }

      if (!Number.isInteger(p.tenderAmount) || p.tenderAmount < 0) {
        return {
          isValid: false,
          error: `المبلغ المستلم للدفعة (${i + 1}) غير صالح.`,
          totalPaid,
          remaining: Math.max(0, totalMinor - totalPaid),
          change: totalChange,
        };
      }

      if (p.method === 'CASH') {
        if (p.tenderAmount < p.amount) {
          return {
            isValid: false,
            error: `المبلغ المستلم نقداً (${p.tenderAmount}) أقل من المبلغ المطلوب سداده (${p.amount}).`,
            totalPaid,
            remaining: Math.max(0, totalMinor - totalPaid),
            change: totalChange,
          };
        }
        totalChange += (p.tenderAmount - p.amount);
      } else if (p.method === 'CARD') {
        // Non-cash: tender amount must equal the payment amount
        if (p.tenderAmount !== p.amount) {
          return {
            isValid: false,
            error: `في الدفع بالبطاقة، يجب أن يتطابق المبلغ المستلم مع المبلغ المطلوب سداده بدقة.`,
            totalPaid,
            remaining: Math.max(0, totalMinor - totalPaid),
            change: totalChange,
          };
        }
      }

      totalPaid += p.amount;
    }

    const remaining = totalMinor - totalPaid;

    if (remaining > 0) {
      return {
        isValid: false,
        error: `المبلغ المسدد غير مكتمل. المتبقي: ${remaining} وحدة عملة.`,
        totalPaid,
        remaining,
        change: totalChange,
      };
    }

    if (remaining < 0) {
      return {
        isValid: false,
        error: `إجمالي مبالغ الدفع (${totalPaid}) أكبر من إجمالي الطلب (${totalMinor}).`,
        totalPaid,
        remaining: 0,
        change: totalChange,
      };
    }

    return {
      isValid: true,
      totalPaid,
      remaining: 0,
      change: totalChange,
    };
}
