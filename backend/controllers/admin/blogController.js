const { supabase } = require('../../config/supabase');
const { logAdminAction } = require('../../middleware/adminAudit');

/**
 * Blog management (Landing CMS). Replaces the fabricated mock articles
 * previously hard-coded in frontend/src/app/blog/page.js — full CRUD here,
 * publicly readable (published only) via marketingController's
 * getPublicBlogPosts / getPublicBlogPostBySlug.
 */

const WORDS_PER_MINUTE = 200;

/** Basic http(s) URL sanity check — used for cover_image_url. */
function isValidUrl(value) {
  if (!value) return true; // optional
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

/** Estimated read time from plain-text content, minimum 1 minute. */
function estimateReadTime(content) {
  const words = String(content || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

/** Finds a unique slug, appending -2, -3, ... on collision. excludeId lets an update skip its own row. */
async function findUniqueSlug(baseSlug, excludeId = null) {
  const base = baseSlug || 'post';
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    let query = supabase.from('blog_posts').select('id').eq('slug', candidate).limit(1);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query;
    if (!data || data.length === 0) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/** GET /api/v1/admin/blog — every row (published + drafts). */
const listPosts = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ success: true, posts: data || [] });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/admin/blog */
const createPost = async (req, res, next) => {
  const { title, slug, excerpt, content, coverImageUrl, category, authorName, isPublished, publishedAt, readTimeMinutes, metaTitle, metaDescription } = req.body || {};

  if (!title || !String(title).trim()) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'title is required.' });
  }
  if (!content || !String(content).trim()) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'content is required.' });
  }
  if (!authorName || !String(authorName).trim()) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'authorName is required.' });
  }
  if (!isValidUrl(coverImageUrl)) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'coverImageUrl must be a valid http(s) URL.' });
  }

  try {
    const baseSlug = slug && String(slug).trim() ? slugify(slug) : slugify(title);
    const uniqueSlug = await findUniqueSlug(baseSlug || 'post');
    const publish = isPublished === true;

    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        title: String(title).trim(),
        slug: uniqueSlug,
        excerpt: excerpt ? String(excerpt).trim() : null,
        content: String(content),
        cover_image_url: coverImageUrl ? String(coverImageUrl).trim() : null,
        category: category ? String(category).trim() : null,
        author_name: String(authorName).trim(),
        is_published: publish,
        published_at: publish ? (publishedAt || new Date().toISOString()) : (publishedAt || null),
        read_time_minutes: readTimeMinutes != null ? parseInt(readTimeMinutes, 10) || 1 : estimateReadTime(content),
        meta_title: metaTitle ? String(metaTitle).trim() : null,
        meta_description: metaDescription ? String(metaDescription).trim() : null,
        created_by: req.user.id,
        updated_by: req.user.id,
      })
      .select()
      .single();
    if (error) {
      // findUniqueSlug checks-then-inserts, so two concurrent saves of the same
      // title can still collide on the unique index. Surface that as an actionable
      // 409 rather than a generic 500.
      if (error.code === '23505') {
        return res.status(409).json({ success: false, error: 'SLUG_TAKEN', message: 'That URL slug was just taken. Please try again.' });
      }
      throw error;
    }

    await logAdminAction(req, { action: 'blog_post.create', entityType: 'blog_post', entityId: data.id, after: data });
    return res.status(201).json({ success: true, post: data });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/v1/admin/blog/:postId */
const updatePost = async (req, res, next) => {
  const { postId } = req.params;
  const b = req.body || {};
  const updates = {};

  try {
    const { data: existing } = await supabase.from('blog_posts').select('*').eq('id', postId).maybeSingle();
    if (!existing) return res.status(404).json({ success: false, error: 'POST_NOT_FOUND', message: 'Blog post not found.' });

    if (b.title !== undefined) {
      if (!String(b.title).trim()) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'title cannot be empty.' });
      updates.title = String(b.title).trim();
    }
    if (b.slug !== undefined) {
      const base = slugify(b.slug) || slugify(updates.title || existing.title);
      updates.slug = await findUniqueSlug(base, postId);
    }
    if (b.excerpt !== undefined) updates.excerpt = b.excerpt ? String(b.excerpt).trim() : null;
    if (b.content !== undefined) {
      if (!String(b.content).trim()) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'content cannot be empty.' });
      updates.content = String(b.content);
    }
    if (b.coverImageUrl !== undefined) {
      if (!isValidUrl(b.coverImageUrl)) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'coverImageUrl must be a valid http(s) URL.' });
      updates.cover_image_url = b.coverImageUrl ? String(b.coverImageUrl).trim() : null;
    }
    if (b.category !== undefined) updates.category = b.category ? String(b.category).trim() : null;
    if (b.authorName !== undefined) {
      if (!String(b.authorName).trim()) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'authorName cannot be empty.' });
      updates.author_name = String(b.authorName).trim();
    }
    if (b.readTimeMinutes !== undefined) {
      updates.read_time_minutes = parseInt(b.readTimeMinutes, 10) || estimateReadTime(updates.content || existing.content);
    } else if (updates.content !== undefined) {
      // The body was rewritten and no explicit read time was supplied — re-estimate.
      // Without this the value silently keeps whatever was computed at creation and
      // drifts from reality (a post rewritten from 2 paragraphs to 3000 words would
      // still advertise "1 min read").
      updates.read_time_minutes = estimateReadTime(updates.content);
    }
    if (b.metaTitle !== undefined) updates.meta_title = b.metaTitle ? String(b.metaTitle).trim() : null;
    if (b.metaDescription !== undefined) updates.meta_description = b.metaDescription ? String(b.metaDescription).trim() : null;

    // Publishing transition: stamp published_at the FIRST time a post goes
    // live, unless the admin explicitly supplied one (backdating/scheduling
    // the displayed date). Un-publishing never clears it, so re-publishing
    // later doesn't lose the original date.
    if (b.publishedAt !== undefined) updates.published_at = b.publishedAt || null;
    if (b.isPublished !== undefined) {
      updates.is_published = !!b.isPublished;
      if (updates.is_published && !existing.published_at && b.publishedAt === undefined) {
        updates.published_at = new Date().toISOString();
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'No updatable fields supplied.' });
    }
    updates.updated_by = req.user.id;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('blog_posts').update(updates).eq('id', postId).select().single();
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ success: false, error: 'SLUG_TAKEN', message: 'That URL slug was just taken. Please try again.' });
      }
      throw error;
    }

    await logAdminAction(req, { action: 'blog_post.update', entityType: 'blog_post', entityId: postId, after: updates });
    return res.json({ success: true, post: data });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/v1/admin/blog/:postId */
const deletePost = async (req, res, next) => {
  const { postId } = req.params;
  try {
    const { error } = await supabase.from('blog_posts').delete().eq('id', postId);
    if (error) throw error;
    await logAdminAction(req, { action: 'blog_post.delete', entityType: 'blog_post', entityId: postId });
    return res.json({ success: true, message: 'Blog post deleted.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { listPosts, createPost, updatePost, deletePost };
