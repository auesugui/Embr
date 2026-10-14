// =============================================================================
// Pick photos — the image picker for workout cards (web only)
// =============================================================================
// Same contract as pickTextFile in backup-file.ts: resolves with the chosen files,
// or an empty list when the picker is dismissed. Several photos can be chosen at
// once, which is how a week of cards goes in in one go.

export function pickPhotos(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.display = 'none';

    let settled = false;
    const finish = (files: File[]) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(files);
    };

    // Dismissing the picker fires no event, so a focus return counts as "no
    // selection". The change event is given a tick to land first.
    const onFocus = () => {
      setTimeout(() => finish([]), 500);
    };

    input.addEventListener('change', () => finish(Array.from(input.files ?? [])));

    document.body.appendChild(input);
    input.click();
    setTimeout(() => window.addEventListener('focus', onFocus), 0);
  });
}
