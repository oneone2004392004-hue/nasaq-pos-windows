import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../auth/context/AuthContext';
import { ShiftRepository } from '../../../repositories/ShiftRepository';
import { CashShiftRow } from '../../../domain/dbModels';

export function useActiveShift() {
  const { user } = useAuth();
  const [activeShift, setActiveShift] = useState<CashShiftRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshActiveShift = useCallback(async () => {
    if (!user) {
      setActiveShift(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const shiftRepo = new ShiftRepository();
      const shift = await shiftRepo.findActiveShift(user.id);
      setActiveShift(shift);
    } catch (err) {
      console.error('Failed to fetch active shift:', err);
      setActiveShift(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshActiveShift();
  }, [refreshActiveShift]);

  return {
    activeShift,
    hasActiveShift: !!activeShift,
    loading,
    refreshActiveShift,
  };
}
