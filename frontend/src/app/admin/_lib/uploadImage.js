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

export default makeImageUploadHandler;
