// =============================================================================
// useKeyboardInset — how much of the screen the keyboard is covering, in px
// =============================================================================
// Embr ships as a PWA. That one fact is why every sheet in the app had its
// keyboard handling silently disabled: they all used React Native's
// `KeyboardAvoidingView` gated on `Platform.OS === 'ios'`, and in a browser
// `Platform.OS` is `'web'`. The branch never ran, so on the phone the software
// keyboard slid up over the search field and its results and nothing moved.
//
// WHY NOT JUST FIX THE GATE. `KeyboardAvoidingView` is driven by RN's
// `Keyboard` module, which on web is a no-op shim — there are no
// `keyboardDidShow` events in a browser to drive it. Passing a `behavior` on
// web changes nothing.
//
// WHAT THE BROWSER ACTUALLY DOES. iOS Safari does not resize the layout
// viewport when the keyboard opens; `window.innerHeight` is unchanged and a
// fixed-position sheet stays exactly where it was, now underneath the keyboard.
// What shrinks is the VISUAL viewport. So the covered height is the layout
// viewport minus what the visual viewport can still show:
//
//     window.innerHeight - (visualViewport.height + visualViewport.offsetTop)
//
// `offsetTop` matters because the browser also scrolls the visual viewport to
// bring a focused field into view; without it the sheet over-corrects by
// however far it scrolled.
//
// Native still works, through the Keyboard module, so one hook covers both and
// callers don't branch. `keyboardWillChangeFrame` rather than
// `keyboardDidShow` on iOS: it fires at the start of the animation and also
// covers the keyboard changing size (an accessory bar appearing, a language
// switch), which `DidShow` misses.

import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const viewport = typeof window === 'undefined' ? undefined : window.visualViewport;
      // No visualViewport means a desktop browser or an old one. Both are cases
      // where nothing overlays the page, so zero is the right answer.
      if (!viewport) return;

      const read = () => {
        const covered = window.innerHeight - viewport.height - viewport.offsetTop;
        // Rounded because the visual viewport reports fractional pixels
        // mid-animation, and a shifting fraction re-renders the sheet on every
        // frame for no visible difference.
        setInset(Math.max(0, Math.round(covered)));
      };

      read();
      viewport.addEventListener('resize', read);
      viewport.addEventListener('scroll', read);
      return () => {
        viewport.removeEventListener('resize', read);
        viewport.removeEventListener('scroll', read);
      };
    }

    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow',
      (event) => setInset(event.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setInset(0)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return inset;
}
