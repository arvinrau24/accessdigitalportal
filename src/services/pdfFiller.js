const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const config = require('../config');

const COMMERCIAL_MODE_MAP = {
  'Outright Purchase': 'Outright Purchase (1 Year)',
  'Lease to Own': 'Lease-to-Own (3-5 years)',
  Rent: 'Rent',
};

const TEMPLATES = {
  onboarding: {
    file: path.join(config.paths.public, 'Customer Onboarding Form 01.pdf'),
    name: 'Customer Onboarding Form (COF01/0726/00)',
    fields: {
      header_date0: { x: 439, y: 716, size: 8, type: 'text', page: 0, maxWidth: 80 },
      header_date1: { x: 439, y: 716, size: 8, type: 'text', page: 1, maxWidth: 80 },

      company_name: { x: 275, y: 617, size: 9, type: 'text', page: 0, maxWidth: 245 },
      company_office_address: { x: 275, y: 592, size: 9, type: 'textarea', page: 0, maxWidth: 245 },
      company_registration_no: { x: 275, y: 543, size: 9, type: 'text', page: 0, maxWidth: 245 },
      company_tax_number: { x: 275, y: 517, size: 9, type: 'text', page: 0, maxWidth: 245 },
      company_ssm_no: { x: 275, y: 491, size: 9, type: 'text', page: 0, maxWidth: 245 },
      company_sst_no: { x: 275, y: 465, size: 9, type: 'text', page: 0, maxWidth: 245 },
      car_park_site_name: { x: 275, y: 439, size: 9, type: 'text', page: 0, maxWidth: 245 },
      car_park_site_address: { x: 275, y: 417, size: 9, type: 'textarea', page: 0, maxWidth: 245 },

      car_park_type_open_site: { x: 277, y: 366, size: 9, type: 'checkbox', page: 0, source: 'car_park_type', options: { checkedWhen: 'Open Site' } },
      car_park_type_office_building: { x: 277, y: 351, size: 9, type: 'checkbox', page: 0, source: 'car_park_type', options: { checkedWhen: 'Office Building' } },
      car_park_type_commercial_building: { x: 277, y: 336, size: 9, type: 'checkbox', page: 0, source: 'car_park_type', options: { checkedWhen: 'Commercial Building (Mall)' } },
      car_park_type_government_building: { x: 277, y: 322, size: 9, type: 'checkbox', page: 0, source: 'car_park_type', options: { checkedWhen: 'Government Building' } },
      car_park_type_hospital: { x: 277, y: 308, size: 9, type: 'checkbox', page: 0, source: 'car_park_type', options: { checkedWhen: 'Hospital' } },

      no_of_entry: { x: 275, y: 290, size: 9, type: 'text', page: 0 },
      no_of_exit: { x: 275, y: 264, size: 9, type: 'text', page: 0 },
      no_of_zone: { x: 275, y: 238, size: 9, type: 'text', page: 0 },
      no_of_validator: { x: 275, y: 212, size: 9, type: 'text', page: 0 },
      no_of_parking_bay: { x: 275, y: 186, size: 9, type: 'text', page: 0 },
      authorized_pic_office_name: { x: 315, y: 164, size: 9, type: 'text', page: 0, maxWidth: 200 },
      authorized_pic_office_contact: { x: 362, y: 138, size: 9, type: 'text', page: 0, maxWidth: 155 },
      authorized_pic_site_name: { x: 316, y: 125, size: 9, type: 'text', page: 0, maxWidth: 200 },
      authorized_pic_site_contact: { x: 363, y: 100, size: 9, type: 'text', page: 0, maxWidth: 155 },

      authorized_email: { x: 275, y: 678, size: 9, type: 'text', page: 1, maxWidth: 245 },
      authorized_email_cc: { x: 275, y: 644, size: 9, type: 'text', page: 1, maxWidth: 245 },
      bank_name: { x: 305, y: 608, size: 9, type: 'text', page: 1, maxWidth: 205 },
      bank_account_name: { x: 379, y: 582, size: 9, type: 'text', page: 1, maxWidth: 205 },
      bank_account_number: { x: 364, y: 557, size: 9, type: 'text', page: 1, maxWidth: 160 },
      bank_address: { x: 350, y: 532, size: 9, type: 'textarea', page: 1, maxWidth: 170 },
      primary_active_bank_account: { x: 277, y: 480, size: 9, type: 'checkbox', page: 1, source: 'primary_active_bank_account', options: { checkedWhen: '1' } },
      commercial_model_outright_purchase: { x: 277, y: 452, size: 9, type: 'checkbox', page: 1, source: 'commercial_model', options: { checkedWhen: 'Outright Purchase (1 Year)' } },
      commercial_model_lease_to_own: { x: 277, y: 437, size: 9, type: 'checkbox', page: 1, source: 'commercial_model', options: { checkedWhen: 'Lease-to-Own (3-5 years)' } },
      commercial_model_rent: { x: 277, y: 424, size: 9, type: 'checkbox', page: 1, source: 'commercial_model', options: { checkedWhen: 'Rent' } },

      signature_image:     { x: 130, y: 287, width: 160, height: 35, type:"image", page: 1 },
      company_stamp_image: { x: 320, y: 270, width: 200, height: 50, type: 'image', page: 1 },
      declaration_name: { x: 130, y: 280, size: 9, type: 'text', page: 1, maxWidth: 130 },
      declaration_date: { x: 130, y: 267, size: 9, type: 'text', page: 1, maxWidth: 130 },
    },
  },
};

function wrapText(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(test, size);
    if (width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatDate(date = new Date()) {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

async function generateOnboardingPdf(formData, options = {}) {
  const { signaturePath, stampPath, commercialMode, submissionDate = new Date() } = options;
  const template = TEMPLATES.onboarding;
  const pdfBytes = fs.readFileSync(template.file);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  const data = {
    ...formData,
    header_date0: formatDate(submissionDate),
    header_date1: formatDate(submissionDate),
    declaration_date: formatDate(submissionDate),
    commercial_model: COMMERCIAL_MODE_MAP[commercialMode] || formData.commercial_model,
  };

  for (const [fieldKey, field] of Object.entries(template.fields)) {
    const page = pages[field.page];
    if (!page) continue;

    if (field.type === 'text' || field.type === 'textarea') {
      let value = data[fieldKey];
      if (value === undefined || value === null || value === '') continue;

      const size = field.size || 9;
      const lineHeight = size + 2;

      if (field.type === 'textarea') {
        const paragraphs = String(value).split('\n');
        let y = field.y;
        for (const paragraph of paragraphs) {
          const lines = field.maxWidth
            ? wrapText(paragraph, font, size, field.maxWidth)
            : [paragraph];
          for (const line of lines) {
            page.drawText(line, { x: field.x, y, size, font, color: rgb(0, 0, 0) });
            y -= lineHeight;
          }
        }
      } else {
        const lines = field.maxWidth
          ? wrapText(String(value), font, size, field.maxWidth)
          : [String(value)];
        let y = field.y;
        for (const line of lines) {
          page.drawText(line, { x: field.x, y, size, font, color: rgb(0, 0, 0) });
          y -= lineHeight;
        }
      }
    } else if (field.type === 'checkbox') {
      const sourceKey = field.source || fieldKey;
      const checkedValue = data[sourceKey];
      const shouldCheck = checkedValue === field.options.checkedWhen
        || (fieldKey === 'primary_active_bank_account' && (checkedValue === true || checkedValue === '1' || checkedValue === 1));
      if (shouldCheck) {
        page.drawText('X', { x: field.x, y: field.y, size: field.size || 9, font, color: rgb(0, 0, 0) });
      }
    } else if (field.type === 'image') {
      let imagePath = null;
      if (fieldKey === 'signature_image') imagePath = signaturePath;
      if (fieldKey === 'company_stamp_image') imagePath = stampPath;
      if (!imagePath || !fs.existsSync(imagePath)) continue;

      const imageBytes = fs.readFileSync(imagePath);
      const isPng = imagePath.toLowerCase().endsWith('.png');
      const image = isPng
        ? await pdfDoc.embedPng(imageBytes)
        : await pdfDoc.embedJpg(imageBytes);
      page.drawImage(image, {
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
      });
    }
  }

  return pdfDoc.save();
}

module.exports = {
  TEMPLATES,
  COMMERCIAL_MODE_MAP,
  generateOnboardingPdf,
  formatDate,
};
