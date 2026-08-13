import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CalculatorInput, CalculatorResult } from "@/lib/calculator";

interface CalculatorState {
  lastInput: CalculatorInput | null;
  lastResult: CalculatorResult | null;
  /** Bumped whenever the user starts a brand-new calculation; the wizard
   *  uses it as a React `key` to fully remount and reset all local state. */
  resetCounter: number;
  setLast: (i: CalculatorInput, r: CalculatorResult) => void;
  clear: () => void;
  /** Reset everything: stored input/result AND wizard local state. */
  newCalculation: () => void;
}

export const useCalculatorStore = create<CalculatorState>()(
  persist(
    (set) => ({
      lastInput: null,
      lastResult: null,
      resetCounter: 0,
      setLast: (lastInput, lastResult) => set({ lastInput, lastResult }),
      clear: () => set({ lastInput: null, lastResult: null }),
      newCalculation: () =>
        set((s) => ({
          lastInput: null,
          lastResult: null,
          resetCounter: s.resetCounter + 1,
        })),
    }),
    {
      name: "ye-labor-calc",
      // Don't persist the reset counter — it's a runtime-only signal.
      partialize: (s) => ({ lastInput: s.lastInput, lastResult: s.lastResult }),
    },
  ),
);
