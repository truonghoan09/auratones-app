import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type Instrument = "guitar" | "ukulele" | "piano";

type AddChordState = {
  isOpen: boolean;
  defaultInstrument?: Instrument;
  initialSymbol?: string;
};

type DialogContextValue = {
  addChord: AddChordState;
  openAddChord: (opts?: {
    defaultInstrument?: Instrument;
    initialSymbol?: string;
  }) => void;
  closeAddChord: () => void;
};

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [addChord, setAddChord] = useState<AddChordState>({ isOpen: false });

  const openAddChord = useCallback(
    (opts?: { defaultInstrument?: Instrument; initialSymbol?: string }) => {
      setAddChord({
        isOpen: true,
        defaultInstrument: opts?.defaultInstrument,
        initialSymbol: opts?.initialSymbol,
      });
    },
    []
  );

  const closeAddChord = useCallback(() => {
    setAddChord((s) => ({ ...s, isOpen: false }));
  }, []);

  const value = useMemo(
    () => ({
      addChord,
      openAddChord,
      closeAddChord,
    }),
    [addChord, openAddChord, closeAddChord]
  );

  return (
    <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
  );
};

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within a DialogProvider");
  return ctx;
}
