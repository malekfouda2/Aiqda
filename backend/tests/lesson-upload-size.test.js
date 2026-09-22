import assert from 'node:assert/strict';
import { unlink, stat } from 'node:fs/promises';
import express from 'express';
import request from 'supertest';
import test from 'node:test';
import { LESSON_FILE_MAX_BYTES, uploadLessonFile } from '../src/middlewares/upload.middleware.js';

test('lesson uploads accept the advertised 25 MiB maximum inclusively', async (t) => {
  const app = express();
  const savedFiles = [];
  t.after(async () => {
    await Promise.all(savedFiles.map((file) => unlink(file.path)));
  });

  app.post('/upload', uploadLessonFile, (req, res) => {
    savedFiles.push(req.file);
    res.json({ size: req.file.size });
  });
  app.use((error, req, res, next) => {
    res.status(400).json({ code: error.code, error: error.message });
  });

  for (const size of [2 * 1024 * 1024, 19_406_243, LESSON_FILE_MAX_BYTES]) {
    await t.test(`accepts ${size} bytes`, async () => {
      const response = await request(app)
        .post('/upload')
        .attach('file', Buffer.alloc(size, 0x61), 'upload-size-test.txt');

      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.size, size);
      assert.equal((await stat(savedFiles.at(-1).path)).size, size);
    });
  }

  await t.test('rejects one byte over the maximum', async () => {
    const previousFiles = savedFiles.length;
    const response = await request(app)
      .post('/upload')
      .attach('file', Buffer.alloc(LESSON_FILE_MAX_BYTES + 1, 0x61), 'oversize-test.txt');

    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'LIMIT_FILE_SIZE');
    assert.equal(savedFiles.length, previousFiles);
  });
});
