import React from 'react';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { PrintJob } from '../types';

interface RecentPrintJobsTableProps {
  jobs: PrintJob[];
}

export const RecentPrintJobsTable: React.FC<RecentPrintJobsTableProps> = ({ jobs }) => {
  if (jobs.length === 0) return null;
  return (
    <div className="bg-white rounded-lg border border-[#E2E8F0] p-4 flex flex-col gap-3 shadow-xs">
      <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-[#1464D9]" />
          <h3 className="text-xs font-bold text-[#0F172A]">سجل مهام الطباعة الأخيرة</h3>
        </div>
        <span className="text-[11px] text-[#64748B]">آخر {jobs.length} عملية</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b border-[#F1F5F9] text-[#64748B]">
              <th className="pb-2 font-semibold">نوع المهمة</th>
              <th className="pb-2 font-semibold">معرف المهمة</th>
              <th className="pb-2 font-semibold">الحالة</th>
              <th className="pb-2 font-semibold">الوقت</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F8FAFC]">
            {jobs.slice(0, 5).map((job) => (
              <tr key={job.id} className="text-[#0F172A]">
                <td className="py-2">
                  {job.type === 'CUSTOMER_RECEIPT' ? 'إيصال عميل' : job.type === 'KITCHEN_TICKET' ? 'تذكرة مطبخ' : job.type === 'REPRINT' ? 'إعادة طباعة' : 'اختبار طباعة'}
                </td>
                <td className="py-2 font-mono text-[11px] text-[#64748B]">{job.id}</td>
                <td className="py-2">
                  {job.status === 'COMPLETED' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium"><CheckCircle2 size={12} /> ناجحة</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-medium" title={job.error}><AlertCircle size={12} /> فشلت</span>
                  )}
                </td>
                <td className="py-2 text-[#64748B] text-[11px]">{new Date(job.createdAt).toLocaleTimeString('ar-EG')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
