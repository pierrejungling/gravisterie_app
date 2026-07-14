export const COMMANDE_UPLOAD_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.svg',
  '.ai',
  '.stl',
  '.3mf',
]);

export function isExternalFileDrag(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes('Files');
}

export function filterAcceptedUploadFiles(
  files: File[],
  allowedExtensions: Set<string> = COMMANDE_UPLOAD_EXTENSIONS
): File[] {
  return files.filter((file) => {
    const t = file.type?.toLowerCase();
    const n = file.name?.toLowerCase() ?? '';
    if (t?.startsWith('image/')) return true;
    if (t?.includes('svg')) return true;
    if (t === 'application/pdf') return true;
    if (t === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return true;
    if (t === 'application/msword') return true;
    if (t === 'application/postscript' || t === 'application/illustrator') return true;
    if (t === 'model/stl' || t === 'application/sla' || t === 'application/vnd.ms-pki.stl') return true;
    if (t === 'model/3mf' || t === 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml') return true;
    return Array.from(allowedExtensions).some((ext) => n.endsWith(ext));
  });
}

export function extractFilesFromClipboard(event: ClipboardEvent): File[] {
  const files: File[] = [];
  const items = event.clipboardData?.items;
  if (!items) return files;

  for (const item of Array.from(items)) {
    if (item.kind !== 'file') continue;
    const file = item.getAsFile();
    if (file) files.push(file);
  }

  return files;
}

export function isEditablePasteTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest(
    'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'
  );
}
