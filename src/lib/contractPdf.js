import { jsPDF } from 'jspdf';

export function generateContractPdf(contract, placement) {
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString('nl-BE');

  // Header
  doc.setFillColor(30, 100, 60);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('OVEREENKOMST', 20, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const typeLabel = contract.contract_type === 'client' ? 'Klantovereenkomst' : 'Consultantovereenkomst';
  doc.text(typeLabel, 150, 18);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);

  let y = 40;

  // Meta info
  doc.setFont('helvetica', 'bold');
  doc.text('Datum:', 20, y);
  doc.setFont('helvetica', 'normal');
  doc.text(today, 55, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Status:', 120, y);
  doc.setFont('helvetica', 'normal');
  const statusLabel = { draft: 'Concept', sent: 'Verstuurd', signed: 'Getekend', expired: 'Verlopen' }[contract.status] || contract.status;
  doc.text(statusLabel, 145, y);
  y += 12;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, 190, y);
  y += 10;

  // Client section
  doc.setFillColor(245, 247, 245);
  doc.roundedRect(20, y, 80, 55, 2, 2, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('KLANT', 25, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(placement?.client_company_name || '—', 25, y + 16);
  doc.text(placement?.client_address || '—', 25, y + 23);
  doc.text(`BTW: ${placement?.client_vat_number || '—'}`, 25, y + 30);
  doc.text(placement?.client_billing_email || '—', 25, y + 37);
  if (contract.recipient_name) doc.text(`Contactpersoon: ${contract.recipient_name}`, 25, y + 44);

  // Consultant section
  doc.roundedRect(110, y, 80, 55, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('CONSULTANT', 115, y + 8);
  doc.setFont('helvetica', 'normal');
  const consultantName = placement ? `${placement.consultant_first_name} ${placement.consultant_last_name}` : '—';
  doc.text(consultantName, 115, y + 16);
  doc.text(placement?.consultant_company_name || '—', 115, y + 23);
  doc.text(placement?.consultant_company_address || '—', 115, y + 30);
  doc.text(`BTW: ${placement?.consultant_vat_number || '—'}`, 115, y + 37);
  y += 65;

  // Contract details
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Contractdetails', 20, y);
  y += 8;
  doc.setDrawColor(30, 100, 60);
  doc.line(20, y, 190, y);
  y += 8;

  doc.setFontSize(9);
  const details = [
    ['Type placement', placement?.placement_type === 'perm' ? 'PERM (vaste aanwerving)' : 'Freelancer'],
    ['Startdatum', placement?.start_date || '—'],
    ['Einddatum', placement?.end_date || '—'],
  ];

  if (placement?.placement_type !== 'perm') {
    details.push(['Tarief klant', placement?.client_rate ? `€ ${placement.client_rate}/dag` : '—']);
    details.push(['Tarief consultant', placement?.consultant_rate ? `€ ${placement.consultant_rate}/dag` : '—']);
    details.push(['Dagen per week', placement?.days_per_week ? `${placement.days_per_week}/5` : '5/5']);
  } else {
    details.push(['Jaarloon', placement?.perm_annual_salary ? `€ ${placement.perm_annual_salary}` : '—']);
    details.push(['Fee %', `${placement?.perm_fee_percentage || 20}%`]);
    const fee = (placement?.perm_annual_salary || 0) * ((placement?.perm_fee_percentage || 20) / 100);
    details.push(['Eenmalige fee', fee > 0 ? `€ ${fee.toFixed(2)}` : '—']);
  }

  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label + ':', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 90, y);
    y += 8;
  });

  // Reference instructions
  if (placement?.reference_instructions) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Referentie-instructies:', 20, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(placement.reference_instructions, 165);
    doc.text(lines, 20, y);
    y += lines.length * 6 + 4;
  }

  // Notes
  if (contract.notes) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Opmerkingen:', 20, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(contract.notes, 165);
    doc.text(lines, 20, y);
    y += lines.length * 6 + 4;
  }

  // Extensions
  if (placement?.extensions?.length > 0) {
    y += 4;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Verlengingen', 20, y);
    y += 8;
    doc.setDrawColor(30, 100, 60);
    doc.line(20, y, 190, y);
    y += 8;
    doc.setFontSize(9);
    placement.extensions.forEach((ext, i) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`Verlenging ${i + 1}:`, 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`Datum: ${ext.extended_on || '—'} → Nieuwe einddatum: ${ext.new_end_date || '—'}`, 70, y);
      y += 6;
      if (ext.consultant_rate || ext.client_rate) {
        doc.text(`Tarieven: klant €${ext.client_rate || '—'}/dag | consultant €${ext.consultant_rate || '—'}/dag`, 70, y);
        y += 6;
      }
    });
  }

  // Signature block
  y = Math.max(y + 10, 220);
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, 190, y);
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Handtekeningen', 20, y);
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.text('Voor de klant:', 20, y);
  doc.text('Voor de consultant:', 110, y);
  y += 20;
  doc.line(20, y, 85, y);
  doc.line(110, y, 190, y);
  y += 5;
  doc.setFontSize(8);
  doc.text('Naam & handtekening', 20, y);
  doc.text('Naam & handtekening', 110, y);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Gegenereerd op ${today} via Lighttrack`, 20, 290);

  const filename = `contract_${placement?.client_company_name || 'klant'}_${placement?.consultant_last_name || ''}_${today.replace(/\//g, '-')}.pdf`;
  doc.save(filename);
}