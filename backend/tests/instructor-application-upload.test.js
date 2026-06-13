import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import {
  createInstructorApplicationPayload,
  setupIntegrationSuite,
} from './helpers/integration.js';

const suite = setupIntegrationSuite();

const crc32 = (buffer) => {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const createStoredZipBuffer = (entries) => {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    const contentBuffer = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content, 'utf8');
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc32(contentBuffer), 14);
    localHeader.writeUInt32LE(contentBuffer.length, 18);
    localHeader.writeUInt32LE(contentBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localPart = Buffer.concat([localHeader, nameBuffer, contentBuffer]);
    localParts.push(localPart);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc32(contentBuffer), 16);
    centralHeader.writeUInt32LE(contentBuffer.length, 20);
    centralHeader.writeUInt32LE(contentBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);

    centralParts.push(Buffer.concat([centralHeader, nameBuffer]));
    localOffset += localPart.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(localOffset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
};

const createLargeDocxBuffer = () => {
  const entries = [
    {
      name: '[Content_Types].xml',
      content: [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
        '<Default Extension="xml" ContentType="application/xml"/>',
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
        '</Types>',
      ].join(''),
    },
  ];

  for (let index = 0; index < 280; index += 1) {
    entries.push({
      name: `padding/chunk-${String(index).padStart(4, '0')}.txt`,
      content: 'x'.repeat(1024),
    });
  }

  entries.push({
    name: '_rels/.rels',
    content: [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>',
      '</Relationships>',
    ].join(''),
  });

  entries.push({
    name: 'word/document.xml',
    content: [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
      '<w:body><w:p><w:r><w:t>Hello DOCX</w:t></w:r></w:p></w:body>',
      '</w:document>',
    ].join(''),
  });

  return createStoredZipBuffer(entries);
};

test('creator applications accept valid docx uploads even when word entries are beyond the signature sample window', async () => {
  const payload = createInstructorApplicationPayload({
    email: 'docx-upload@example.com',
  });

  const response = await request(suite.app)
    .post('/api/instructor-applications')
    .field('email', payload.email)
    .field('fullName', payload.fullName)
    .field('nationality', payload.nationality)
    .field('country', payload.country)
    .field('city', payload.city)
    .field('phoneCode', payload.phoneCode)
    .field('phoneNumber', payload.phoneNumber)
    .field('educationLevel', payload.educationLevel)
    .field('fieldOfStudy', payload.fieldOfStudy)
    .field('yearsOfExperience', payload.yearsOfExperience)
    .field('specialization', payload.specialization[0])
    .field('previousTeachingExperience', payload.previousTeachingExperience)
    .field('softwareProficiency', payload.softwareProficiency)
    .field('institutionsOrStudios', payload.institutionsOrStudios)
    .field('notableWorks', payload.notableWorks)
    .field('websiteOrPortfolio', payload.websiteOrPortfolio)
    .field('teachingStyle', payload.teachingStyle)
    .field('studentGuidance', payload.studentGuidance)
    .field('existingCourseMaterials', payload.existingCourseMaterials)
    .field('preferredSchedule', payload.preferredSchedule)
    .field('earliestStartDate', payload.earliestStartDate)
    .field('additionalComments', payload.additionalComments)
    .field('creatorAgreementAccepted', 'true')
    .attach('cvFile', createLargeDocxBuffer(), {
      filename: 'creator-cv.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

  assert.equal(response.status, 201);
  assert.equal(typeof response.body.cvFile, 'string');
  assert.match(response.body.cvFile, /\.docx$/i);
});
