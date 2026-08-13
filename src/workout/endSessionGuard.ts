// =============================================================================
// IronQuest End-Session Guard — confirmation before discarding logged sets
// =============================================================================
// Pure, framework-agnostic logic for the session-abandon confirmation flow
// (audit A1 / issue #20). Extracted from the session screen so the decision
// tree and Alert wiring are unit-testable without React.
//
// The guard does NOT call Alert.alert directly. It hands a fully-built config
// to an injected `showAlert`, so the same logic is correct on native (real
// Alert.alert) and web (react-native-web's Alert is a no-op, so the app
// supplies a DOM renderer — see src/utils/alert.ts).

export type AlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: AlertButtonStyle;
}

export interface AlertOptions {
  cancelable?: boolean;
  userInterfaceStyle?: 'light' | 'dark';
}

/**
 * Shape delivered to the platform renderer. Mirrors the positional arguments
 * of RN's `Alert.alert(title, message, buttons, options)` so the native
 * adapter is a trivial pass-through.
 */
export interface AlertConfig {
  title: string;
  message: string;
  buttons: AlertButton[];
  options?: AlertOptions;
}

export type ShowAlert = (config: AlertConfig) => void;

export interface ConfirmEndSessionDeps {
  /** Number of logged sets that would be discarded (>= 0). */
  completedSets: number;
  /** Tear down the active session (the existing store action). */
  endSession: () => void;
  /** Leave the session screen (router.back in the app). */
  navigateBack: () => void;
  /** Platform alert renderer; native -> Alert.alert, web -> DOM dialog. */
  showAlert: ShowAlert;
}

export const END_SESSION_TITLE = 'End workout?';
export const END_SESSION_CANCEL = 'Cancel';
export const END_SESSION_DISCARD = 'Discard & End';

/** A session with no logged sets can be ended without confirming. */
export const shouldConfirmEndSession = (completedSets: number): boolean => {
  return completedSets > 0;
};

/**
 * Build the alert copy. Pluralized ("1 set" vs "3 sets"). Template strings,
 * not concatenation, per biome's useTemplate rule.
 */
export const buildEndSessionMessage = (completedSets: number): string => {
  const single = completedSets === 1;
  const noun = single ? 'set' : 'sets';
  // The verb and the object agree with the noun too. The singular case used to
  // read "1 logged set that haven't been saved ... discard them".
  const verb = single ? "hasn't" : "haven't";
  const object = single ? 'it' : 'them';
  // "Claimed" is game-layer vocabulary; the tracker build says "saved" for the
  // same act (finishing the workout and writing it to history).
  return `You have ${completedSets} logged ${noun} that ${verb} been saved. Ending now will discard ${object}.`;
};

/**
 * Build the Alert config for the abandon guard. The discard button carries
 * the destructive callback; cancel has no onPress, so the renderer simply
 * dismisses the dialog and the session is left untouched.
 */
export const buildEndSessionAlert = (
  completedSets: number,
  onDiscard: () => void
): AlertConfig => ({
  title: END_SESSION_TITLE,
  message: buildEndSessionMessage(completedSets),
  buttons: [
    { text: END_SESSION_CANCEL, style: 'cancel' },
    { text: END_SESSION_DISCARD, style: 'destructive', onPress: onDiscard },
  ],
  options: { cancelable: true },
});

/**
 * Orchestrates the End button. Zero logged sets -> end immediately with no
 * dialog. One or more -> show the confirmation; only "Discard & End" tears
 * the session down.
 */
export const confirmEndSession = (deps: ConfirmEndSessionDeps): void => {
  const finishEnd = () => {
    deps.endSession();
    deps.navigateBack();
  };

  if (!shouldConfirmEndSession(deps.completedSets)) {
    finishEnd();
    return;
  }

  deps.showAlert(buildEndSessionAlert(deps.completedSets, finishEnd));
};
