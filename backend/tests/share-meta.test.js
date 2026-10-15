import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

import { getShareMetaForPath, injectShareMeta, isShareablePath } from '../src/utils/shareMeta.js';
import { createCourse, createUser, setupIntegrationSuite } from './helpers/integration.js';

setupIntegrationSuite();

// Share previews must never call the real Vimeo API in tests.
beforeEach(() => {
  delete process.env.VIMEO_ACCESS_TOKEN;
});

const BASE_HTML = '<html><head><title>Aiqda</title></head><body></body></html>';

test('only creator and chapter pages are treated as shareable', () => {
  assert.equal(isShareablePath('/creators/abc'), true);
  assert.equal(isShareablePath('/chapters/abc'), true);
  assert.equal(isShareablePath('/chapters'), false);
  assert.equal(isShareablePath('/dashboard'), false);
});

test('creator links get a teaser-focused preview', async () => {
  const creator = await createUser({ role: 'instructor', name: 'Sara Ali', avatar: '/uploads/avatars/sara.png' });
  creator.user.teaserVimeoVideoId = '123456789';
  await creator.user.save();

  const meta = await getShareMetaForPath(`/creators/${creator.user._id}`);
  assert.equal(meta.title, 'Meet Sara Ali on Aiqda');
  assert.match(meta.description, /intro video/);

  const html = injectShareMeta(BASE_HTML, meta, {
    origin: 'https://aiqda.com',
    url: `https://aiqda.com/creators/${creator.user._id}`,
  });
  assert.match(html, /<title>Meet Sara Ali on Aiqda<\/title>/);
  assert.match(html, /property="og:image" content="https:\/\/aiqda\.com\/uploads\/avatars\/sara\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
});

test('chapter links use the chapter details and escape HTML', async () => {
  const creator = await createUser({ role: 'instructor', name: 'Omar' });
  const course = await createCourse({
    instructorId: creator.user._id,
    title: 'Blender <Basics>',
    description: 'Model "anything" fast',
    isPublished: true,
  });

  const meta = await getShareMetaForPath(`/chapters/${course._id}`);
  assert.equal(meta.title, 'Blender <Basics> · by Omar');

  const html = injectShareMeta(BASE_HTML, meta, { origin: 'https://aiqda.com', url: 'https://aiqda.com/x' });
  assert.match(html, /Blender &lt;Basics&gt;/);
  assert.match(html, /Model &quot;anything&quot; fast/);
  assert.doesNotMatch(html, /<Basics>/);
});

test('unpublished chapters, non-creators and bad ids get no preview', async () => {
  const creator = await createUser({ role: 'instructor' });
  const student = await createUser({ role: 'student' });
  const draft = await createCourse({ instructorId: creator.user._id, isPublished: false });

  assert.equal(await getShareMetaForPath(`/chapters/${draft._id}`), null);
  assert.equal(await getShareMetaForPath(`/creators/${student.user._id}`), null);
  assert.equal(await getShareMetaForPath('/creators/not-an-id'), null);
});
