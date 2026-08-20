import { supabase } from '../../utils/supabaseClient';

/**
 * Shared direct-to-Supabase-storage upload handler for admin forms.
 *
 * Lifted out of admin/(panel)/cms/page.js, where it was a private helper, once
 * a second screen (Printed Invitations) needed the same behaviour. The part
 * worth not duplicating is the FALLBACK: when storage is unreachable the file
 * is embedded as a base64 data URI instead, so an admin on a misconfigured
 * bucket can still publish. A second, subtly different copy of that would fail
 * differently on one screen than the other, and nobody would find out until a
 * bucket broke.
 *
 * Note the bucket: 'event-assets' has no migration of its own in this repo, so
 * a fresh environment can be missing it entirely — which is exactly the case
 * the base64 path exists to survive.
 *
 * Returns an <input type="file"> onChange handler bound to the caller's own
 * field/uploading state setters.
 *
 * @param {{
 *   pathPrefix: string,
 *   setField: (url: string) => void,
 *   setUploading: (busy: boolean) => void,
 *   showAlert: (msg: string, title: string, kind: string) => void,
 * }} opts
 */
export function makeImageUploadHandler({ pathPrefix, setField, setUploading, showAlert }) {
  return async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      showAlert('File size exceeds 8MB. Please use a smaller file.', 'File Too Large', 'warning');
      return;
    }
    setUploading(true);
    try {
      if (!supabase) throw new Error('Supabase client is not initialized.');
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
      const filePath = `${pathPrefix}/${fileName}`;
      const { error: uploadErr } = await supabase.storage
        .from('event-assets')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('event-assets').getPublicUrl(filePath);
      setField(publicUrl);
    } catch {
      // Postgres rejects a row far smaller than the 8MB accepted above once the
      // image is base64-expanded, so the inline fallback has a tighter ceiling
      // than the upload path and says so rather than failing on save.
      if (file.size > 3.5 * 1024 * 1024) {
        showAlert(
          "Couldn't upload to storage, and this file is too large to embed directly (max ~3.5MB). Please use a smaller file.",
          'Upload Failed',
          'error',
        );
        setUploading(false);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => { setField(ev.target.result); setUploading(false); };
      reader.onerror = () => { showAlert('Failed to read the image file.', 'Upload Failed', 'error'); setUploading(false); };
      reader.readAsDataURL(file);
      return;
    } finally {
      setUploading(false);
    }
  };
}

/**
 * Uploads ONE file and resolves to a usable URL, or rejects.
 *
 * The same two-step the single-file handler above performs — storage first,
 * base64 data URI if the bucket is unreachable — with no state setters and no
 * alerts, so a caller handling many files can decide once what to say about
 * the batch rather than firing an alert per file.
 *
 * @returns {Promise<string>} public URL, or a data: URI from the fallback
 */
export async function uploadOneImage(file, pathPrefix) {
  if (file.size > 8 * 1024 * 1024) {
    throw new Error(`${file.name} is over 8MB.`);
  }
  try {
    if (!supabase) throw new Error('Supabase client is not initialized.');
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
    const filePath = `${pathPrefix}/${fileName}`;
    const { error: uploadErr } = await supabase.storage
      .from('event-assets')
      .upload(filePath, file, { cacheControl: '3600', upsert: true });
    if (uploadErr) throw uploadErr;
    const { data: { publicUrl } } = supabase.storage.from('event-assets').getPublicUrl(filePath);
    return publicUrl;
  } catch {
    // Same tighter ceiling as the single-file path: Postgres rejects a row far
    // smaller than 8MB once the image is base64-expanded.
    if (file.size > 3.5 * 1024 * 1024) {
      throw new Error(`${file.name} could not be uploaded and is too large to embed (max ~3.5MB).`);
    }
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target.result);
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }
}

/**
 * MANY files from one <input type="file" multiple> — a gallery, not a field.
 *
 * The single-file handler above reads `files[0]` and drops the rest, which is
 * correct for a logo or a cover image and wrong for a product gallery: adding
 * six photos meant six trips through the file picker.
 *
 * Uploads are SEQUENTIAL rather than Promise.all. Six parallel uploads to the
 * same bucket from a browser is how you get throttled, and the order they
 * finish in would then decide the gallery's order — so a sequential loop is
 * both kinder to the bucket and the only way `sortOrder` matches what the
 * admin selected.
 *
 * One file failing does not lose the others: successes are appended as they
 * land and the failures are reported together at the end.
 *
 * @param {{
 *   pathPrefix: string,
 *   onImage: (url: string) => void,
 *   setUploading: (busy: boolean) => void,
 *   showAlert: (msg: string, title: string, kind: string) => void,
 *   setProgress?: (done: number, total: number) => void,
 * }} opts
 */
export function makeMultiImageUploadHandler({ pathPrefix, onImage, setUploading, showAlert, setProgress }) {
  return async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Read the list, then clear the input. Without this, picking the SAME
    // files again fires no change event and looks like the uploader is broken.
    e.target.value = '';

    setUploading(true);
    setProgress?.(0, files.length);
    const failures = [];

    for (let i = 0; i < files.length; i += 1) {
      try {
        const url = await uploadOneImage(files[i], pathPrefix);
        onImage(url);
      } catch (err) {
        failures.push(err?.message || `${files[i].name} failed.`);
      }
      setProgress?.(i + 1, files.length);
    }

    setUploading(false);
    setProgress?.(0, 0);

    if (failures.length) {
      const added = files.length - failures.length;
      showAlert(
        `${added} of ${files.length} photos were added.\n\n${failures.join('\n')}`,
        failures.length === files.length ? 'Upload failed' : 'Some photos were not added',
        failures.length === files.length ? 'error' : 'warning',
      );
    }
  };
}

export default makeImageUploadHandler;
