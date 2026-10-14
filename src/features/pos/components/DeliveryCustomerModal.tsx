import { logger } from '../../../utils/logger';
/**
 * NASAQ POS — Delivery Customer Modal (Phase 5)
 * Captures customer name, phone, address, and delivery fee for delivery orders.
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { DeliveryCustomerInfo } from '../../../domain/cart';
import { CustomerRepository } from '../../../repositories/CustomerRepository';
import { DeliveryDriverRepository } from '../../../repositories/DeliveryDriverRepository';
import { DeliveryDriverRow } from '../../../domain/dbModels';
import { formatCurrency, toMinorUnits } from '../../../utils/formatters';

interface DeliveryCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCustomer: DeliveryCustomerInfo | null;
  currentDeliveryFeeMinor: number;
  onSave: (customer: DeliveryCustomerInfo, feeMinor: number) => void;
}

export const DeliveryCustomerModal: React.FC<DeliveryCustomerModalProps> = ({
  isOpen,
  onClose,
  currentCustomer,
  currentDeliveryFeeMinor,
  onSave,
}) => {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [feeMajor, setFeeMajor] = useState('');
  const [driverId, setDriverId] = useState<string>('');
  const [drivers, setDrivers] = useState<DeliveryDriverRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [foundCustomerNote, setFoundCustomerNote] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPhone(currentCustomer?.phone || '');
      setName(currentCustomer?.name || '');
      setAddress(currentCustomer?.address || '');
      setFeeMajor(currentDeliveryFeeMinor ? (currentDeliveryFeeMinor / 100).toString() : '15');
      setDriverId('');
      setFoundCustomerNote(null);

      // Load active drivers
      const repo = new DeliveryDriverRepository();
      repo.listAll(true).then(setDrivers).catch((error: unknown) => { logger.error('Failed to load active delivery drivers', error); });
    }
  }, [isOpen, currentCustomer, currentDeliveryFeeMinor]);

  // Phone lookup helper
  const lookupPhone = async (cleanPhone: string) => {
    if (cleanPhone.length >= 8) {
      try {
        setSearching(true);
        const repo = new CustomerRepository();
        const found = await repo.findByPhone(cleanPhone);
        if (found) {
          setName(found.name);
          if (found.address) setAddress(found.address);
          setFoundCustomerNote(`تم العثور على العميل: ${found.name}`);
        } else {
          setFoundCustomerNote(null);
        }
      } catch (error) {
        logger.warn('Customer phone lookup failed', error);
        setFoundCustomerNote('تعذر البحث عن العميل. تحقق من البيانات وحاول مرة أخرى.');
      } finally {
        setSearching(false);
      }
    }
  };

  const handlePhoneChange = (val: string) => {
    setPhone(val);
    const clean = val.trim();
    if (clean.length === 11) {
      void lookupPhone(clean);
    }
  };

  const handlePhoneBlur = () => {
    void lookupPhone(phone.trim());
  };

  const handleSave = () => {
    const parsedFee = parseFloat(feeMajor);
    const feeMinor = isNaN(parsedFee) || parsedFee < 0 ? 0 : toMinorUnits(parsedFee);

    onSave(
      {
        id: currentCustomer?.id,
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
      },
      feeMinor
    );
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="بيانات توصيل الطلب (دليفري)"
      size="md"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="secondary" onClick={onClose} size="sm">
            إلغاء
          </Button>
          <Button
            id="btn-save-delivery"
            variant="primary"
            onClick={handleSave}
            size="sm"
            disabled={!phone.trim() && !name.trim()}
          >
            تأكيد البيانات
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (phone.trim() || name.trim()) handleSave();
        }}
        className="flex flex-col gap-3 text-right"
      >
        {foundCustomerNote && (
          <div className="p-2 bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] text-xs rounded-sm">
            {foundCustomerNote}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#1E293B] mb-1">
            رقم هاتف العميل <span className="text-[#DC2626]">*</span>
          </label>
          <Input
            id="input-delivery-phone"
            type="tel"
            dir="ltr"
            placeholder="010XXXXXXXX"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            onBlur={handlePhoneBlur}
            autoFocus
          />
          {searching && <span className="text-[11px] text-[#64748B]">جاري البحث...</span>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#1E293B] mb-1">
            اسم العميل <span className="text-[#DC2626]">*</span>
          </label>
          <Input
            id="input-delivery-name"
            placeholder="الاسم الكامل"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#1E293B] mb-1">
            عنوان التوصيل
          </label>
          <Input
            id="input-delivery-address"
            placeholder="المنطقة - الشارع - رقم العقار - رقم الشقة"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#1E293B] mb-1">
              رسوم التوصيل (ج.م)
            </label>
            <Input
              id="input-delivery-fee"
              type="number"
              min="0"
              step="1"
              placeholder="15"
              value={feeMajor}
              onChange={(e) => setFeeMajor(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1E293B] mb-1">
              مندوب التوصيل (اختياري)
            </label>
            <select
              id="select-delivery-driver"
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="w-full h-9 px-2.5 bg-white border border-[#D8E3F0] rounded-md text-xs text-[#1E293B] focus:outline-hidden focus:ring-1 focus:ring-[#0D4EAE]"
            >
              <option value="">بدون تعيين (لاحقاً)</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.phone})
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
};
