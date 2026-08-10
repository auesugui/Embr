// =============================================================================
// Backup file I/O — browser download / file picker
// =============================================================================
// The DOM half of the backup feature, kept out of src/lib/backup.ts so that
// module stays pure and testable under Jest's node environment.
//
// Web only, deliberately. The PWA is where the eviction risk lives, so that's
// what this ships for. A native build would need expo-file-system (not a
// dependency yet) to write a file before expo-sharing could hand it off; until
// someone actually needs it, `isFileIOSupported` says no and the UI explains
// itself rather than failing at the tap.

import { Platform } from 'react-native';

export const isFileIOSupported = Platform.OS === 'web';

/** Trigger a browser download of `text` as `filename`. */
export function downloadTextFile(filename: string, text: string): void {
  if (!isFileIOSupported) {
    throw new Error('File export is only available on the web build.');
  }

  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Safari needs the URL to outlive the click; revoking synchronously cancels
  // the download it just started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Open the file picker and resolve the chosen file's text, or null if the user
 * dismissed it.
 *
 * Cancellation isn't directly observable on an <input type="file"> across
 * browsers, so this resolves on `change` (a file was chosen) and otherwise on
 * the window regaining focus — the one signal every browser gives when the
 * picker closes. The focus handler is deferred a tick so it can't fire on the
 * same event loop turn that opened the dialog.
 */
export function pickTextFile(accept = 'application/json,.json'): Promise<string | null> {
  if (!isFileIOSupported) {
    throw new Error('File import is only available on the web build.');
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';

    let settled = false;
    const finish = (result: string | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(result);
    };

    const onFocus = () => {
      // Give the change event a chance to land first; focus returns before it
      // fires when a file was actually picked.
      setTimeout(() => finish(null), 500);
    };

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return finish(null);

      const reader = new FileReader();
      reader.onload = () => finish(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => {
        settled = true;
        window.removeEventListener('focus', onFocus);
        input.remove();
        reject(new Error("Couldn't read that file."));
      };
      reader.readAsText(file);
    });

    document.body.appendChild(input);
    input.click();
    setTimeout(() => window.addEventListener('focus', onFocus), 0);
  });
}

/** Full page reload — the only way to rehydrate every store after a restore. */
export function reloadApp(): void {
  if (isFileIOSupported) window.location.reload();
}
