const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const config = require('../src/config');
const { generateOnboardingPdf } = require('../src/services/pdfFiller');

async function test() {
  const outDir = path.join(__dirname, '..', 'uploads', 'test');
  fs.mkdirSync(outDir, { recursive: true });

  const formData = {
    company_name: 'Test Corp Sdn Bhd',
    company_office_address: '123 Jalan Test, Kuala Lumpur',
    company_registration_no: '1234567-A',
    company_tax_number: 'TX123',
    company_ssm_no: 'SSM123',
    company_sst_no: 'SST123',
    car_park_site_name: 'Test Car Park',
    car_park_site_address: '456 Parking Road',
    car_park_type: 'Office Building',
    no_of_entry: '2',
    no_of_exit: '2',
    no_of_zone: '3',
    no_of_validator: '1',
    no_of_parking_bay: '100',
    authorized_pic_office_name: 'John Doe',
    authorized_pic_office_contact: '0123456789',
    authorized_pic_site_name: 'Jane Doe',
    authorized_pic_site_contact: '0198765432',
    authorized_email: 'test@example.com',
    authorized_email_cc: 'cc@example.com',
    bank_name: 'Test Bank',
    bank_account_name: 'Test Corp',
    bank_account_number: '1234567890',
    bank_address: 'Bank Street',
    primary_active_bank_account: '1',
    declaration_name: 'John Doe',
  };

  const pdfBytes = await generateOnboardingPdf(formData, {
    commercialMode: 'Outright Purchase',
    submissionDate: new Date(),
  });

  // --- Draw outline boxes to preview where signature/stamp will land ---
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  const sig = { x: 130, y: 287, width: 160, height: 35, page: 1 };
  pages[sig.page].drawRectangle({
    x: sig.x, y: sig.y, width: sig.width, height: sig.height,
    borderColor: rgb(1, 0, 0), borderWidth: 2,
  });
  pages[sig.page].drawText('SIGNATURE', {
    x: sig.x, y: sig.y + sig.height + 2, size: 8, color: rgb(1, 0, 0),
  });

  const stamp = { x: 320, y: 270, width: 200, height: 50, page: 1 };
  pages[stamp.page].drawRectangle({
    x: stamp.x, y: stamp.y, width: stamp.width, height: stamp.height,
    borderColor: rgb(0, 0.4, 1), borderWidth: 2,
  });
  pages[stamp.page].drawText('STAMP', {
    x: stamp.x, y: stamp.y + stamp.height + 2, size: 8, color: rgb(0, 0.4, 1),
  });

  const finalBytes = await pdfDoc.save();
  const outPath = path.join(outDir, 'test-onboarding.pdf');
  fs.writeFileSync(outPath, finalBytes);
  console.log('PDF generated:', outPath, `(${finalBytes.length} bytes)`);
}

test().catch((err) => {
  console.error('PDF test failed:', err.message);
  process.exit(1);
});