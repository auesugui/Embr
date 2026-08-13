// =============================================================================
// IronQuest End-Session Guard — Regression Tests (issue #20 / audit A1)
// =============================================================================
// Covers the four required integrity assertions:
//   1. handleEndSession with N>0 logged sets triggers the confirm path
//      (Alert.alert called with correct N).
//   2. handleEndSession with 0 logged sets skips the dialog.
//   3. "Cancel" path does not call endSession.
//   4. "Discard & End" path calls endSession exactly once.

import {
  END_SESSION_CANCEL,
  END_SESSION_DISCARD,
  END_SESSION_TITLE,
  buildEndSessionAlert,
  buildEndSessionMessage,
  confirmEndSession,
  shouldConfirmEndSession,
} from '../endSessionGuard';

describe('End-Session Guard', () => {
  describe('shouldConfirmEndSession', () => {
    it('returns false when zero sets are logged', () => {
      expect(shouldConfirmEndSession(0)).toBe(false);
    });

    it('returns true when one or more sets are logged', () => {
      expect(shouldConfirmEndSession(1)).toBe(true);
      expect(shouldConfirmEndSession(7)).toBe(true);
    });
  });

  describe('buildEndSessionMessage', () => {
    it('pluralizes "set" for a single logged set', () => {
      expect(buildEndSessionMessage(1)).toBe(
        "You have 1 logged set that hasn't been saved. Ending now will discard it."
      );
    });

    it('pluralizes "sets" for multiple logged sets', () => {
      expect(buildEndSessionMessage(7)).toBe(
        "You have 7 logged sets that haven't been saved. Ending now will discard them."
      );
    });

    it('embeds the exact count as a number, not a concatenation artifact', () => {
      expect(buildEndSessionMessage(42)).toMatch(/You have 42 logged sets/);
    });
  });

  describe('buildEndSessionAlert', () => {
    const onDiscard = jest.fn();
    const alert = buildEndSessionAlert(3, onDiscard);

    it('uses the spec title', () => {
      expect(alert.title).toBe(END_SESSION_TITLE);
      expect(alert.title).toBe('End workout?');
    });

    it('carries the correct set count in the message', () => {
      expect(alert.message).toBe(
        "You have 3 logged sets that haven't been saved. Ending now will discard them."
      );
    });

    it('lists Cancel first and Discard & End second', () => {
      expect(alert.buttons).toHaveLength(2);
      expect(alert.buttons[0].text).toBe(END_SESSION_CANCEL);
      expect(alert.buttons[0].style).toBe('cancel');
      expect(alert.buttons[1].text).toBe(END_SESSION_DISCARD);
      expect(alert.buttons[1].style).toBe('destructive');
    });

    it('wires onDiscard only to the destructive button', () => {
      expect(alert.buttons[0].onPress).toBeUndefined();
      expect(alert.buttons[1].onPress).toBe(onDiscard);
    });

    it('is cancelable (overlay/escape dismisses without discarding)', () => {
      expect(alert.options?.cancelable).toBe(true);
    });
  });

  describe('confirmEndSession orchestrator', () => {
    const setup = (completedSets: number) => {
      const endSession = jest.fn();
      const navigateBack = jest.fn();
      const showAlert = jest.fn();
      confirmEndSession({ completedSets, endSession, navigateBack, showAlert });
      return { endSession, navigateBack, showAlert };
    };

    // -------------------------------------------------------------------------
    // CRITERION: 0 logged sets skips the dialog and ends immediately.
    // -------------------------------------------------------------------------
    it('with 0 logged sets: ends immediately and does NOT show the dialog', () => {
      const { endSession, navigateBack, showAlert } = setup(0);

      expect(showAlert).not.toHaveBeenCalled();
      expect(endSession).toHaveBeenCalledTimes(1);
      expect(navigateBack).toHaveBeenCalledTimes(1);
    });

    // -------------------------------------------------------------------------
    // CRITERION: N>0 logged sets triggers the confirm path with correct N.
    // -------------------------------------------------------------------------
    it('with N>0 logged sets: shows the dialog once with the correct count', () => {
      const { endSession, navigateBack, showAlert } = setup(7);

      expect(showAlert).toHaveBeenCalledTimes(1);
      // While the dialog is up, the session must not be torn down.
      expect(endSession).not.toHaveBeenCalled();
      expect(navigateBack).not.toHaveBeenCalled();

      const config = showAlert.mock.calls[0][0];
      expect(config.title).toBe('End workout?');
      expect(config.message).toBe(
        "You have 7 logged sets that haven't been saved. Ending now will discard them."
      );
    });

    // -------------------------------------------------------------------------
    // CRITERION: "Cancel" path does not call endSession.
    // -------------------------------------------------------------------------
    it('Cancel button has no onPress, so the session cannot be torn down via cancel', () => {
      const { endSession, showAlert } = setup(3);

      const config = showAlert.mock.calls[0][0];
      const cancelButton = config.buttons[0];

      // Pressing Cancel is a no-op: no callback, therefore endSession is
      // never reachable through the cancel path.
      expect(cancelButton.text).toBe('Cancel');
      expect(cancelButton.onPress).toBeUndefined();
      cancelButton.onPress?.();
      expect(endSession).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // CRITERION: "Discard & End" calls endSession exactly once.
    // -------------------------------------------------------------------------
    it('Discard & End calls endSession exactly once and navigates back', () => {
      const { endSession, navigateBack, showAlert } = setup(5);

      const config = showAlert.mock.calls[0][0];
      const discardButton = config.buttons[1];

      expect(discardButton.text).toBe('Discard & End');
      discardButton.onPress?.();

      expect(endSession).toHaveBeenCalledTimes(1);
      expect(navigateBack).toHaveBeenCalledTimes(1);
    });

    it('does not call endSession until the discard callback fires', () => {
      const endSession = jest.fn();
      const navigateBack = jest.fn();
      const showAlert = jest.fn();

      confirmEndSession({ completedSets: 4, endSession, navigateBack, showAlert });

      // Dialog shown, but session still alive.
      expect(showAlert).toHaveBeenCalledTimes(1);
      expect(endSession).not.toHaveBeenCalled();

      // Now the user confirms.
      showAlert.mock.calls[0][0].buttons[1].onPress?.();
      expect(endSession).toHaveBeenCalledTimes(1);
    });
  });
});
