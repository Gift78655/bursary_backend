// emailNotifications.js (final version without dashboard CTA)

const { format } = require('date-fns');

const baseStyles = `
  font-family: 'Segoe UI', Arial, sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  background-color: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
`;

const hrStyle = 'border: none; border-top: 1px solid #ccc; margin: 20px 0;';

const footerDisclaimer = `
  <p style="font-size: 0.85em; color: #666;">
    This message was sent to you because you applied for a bursary through the Bursary Portal. 
    If you believe this was a mistake, please disregard this email or contact support.
  </p>
`;

const currentDate = () => {
  return format(new Date(), 'PPPpp');
};

exports.generateApplicationEmail = ({ full_name, bursary_title }) => {
  const date = currentDate();
  return {
    subject: '📄 Bursary Application Confirmation',
    html: `
      <div style="${baseStyles}">
        <h2 style="color: #2d6cdf;">Bursary Application Received</h2>

        <p>Dear <strong>${full_name}</strong>,</p>

        <p>We have successfully received your application for the following bursary:</p>
        <p style="font-size: 1.1em; font-weight: bold;">📌 ${bursary_title}</p>

        <p>Your application is now under review by the bursary administrators. You will be contacted should any additional information be required or once a decision is made.</p>

        <p style="font-size: 0.9em; color: #555;">📅 Submitted on: ${date}</p>

        <hr style="${hrStyle}" />

        <h4>🔒 Data Protection & Privacy</h4>
        <p>
          In compliance with the <strong>Protection of Personal Information Act (POPIA)</strong>, we ensure that your personal data is:
        </p>
        <ul>
          <li>🔐 Stored securely and not shared with third parties without consent.</li>
          <li>🛠️ Used solely for processing your bursary application.</li>
          <li>🗑️ Removable upon your written request.</li>
        </ul>

        <p>
          If you need to update or remove your information, please contact the bursary administrator.
        </p>

        <hr style="${hrStyle}" />

        <p>Should you have any questions, feel free to reply to this email.</p>

        <p style="margin-top: 30px;">
          Kind regards,<br />
          <strong>Bursary Portal Team</strong>
        </p>

        ${footerDisclaimer}
      </div>
    `
  };
};

exports.generateWithdrawalEmail = ({ full_name, bursary_title }) => {
  const date = currentDate();
  return {
    subject: '⚠️ Bursary Application Withdrawn',
    html: `
      <div style="${baseStyles}">
        <h2 style="color: #c0392b;">Bursary Application Withdrawn</h2>

        <p>Dear <strong>${full_name}</strong>,</p>

        <p>
          This is to confirm that your application for the bursary titled:
        </p>
        <p style="font-size: 1.1em; font-weight: bold;">❌ ${bursary_title}</p>

        <p>
          has been successfully withdrawn from the Bursary Portal system.
        </p>

        <p style="font-size: 0.9em; color: #555;">📅 Withdrawn on: ${date}</p>

        <hr style="${hrStyle}" />

        <h4>🔒 Data Retention & Privacy</h4>
        <p>
          As per POPIA guidelines:
        </p>
        <ul>
          <li>📁 Your data will be retained securely for auditing and compliance purposes.</li>
          <li>🗑️ You may request permanent removal of your data by contacting the bursary administrator.</li>
        </ul>

        <hr style="${hrStyle}" />

        <p>
          If you need assistance or have questions, please reply to this email.
        </p>

        <p style="margin-top: 30px;">
          Sincerely,<br />
          <strong>Bursary Portal Team</strong>
        </p>

        ${footerDisclaimer}
      </div>
    `
  };
};
