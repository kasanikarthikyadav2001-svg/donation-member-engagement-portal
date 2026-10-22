import {randomUUID} from 'node:crypto';
import PDFDocument from 'pdfkit';
import {config} from '../config.js';
import type {Database} from '../database/index.js';
import {enqueueEmail,emailEnabled} from './email.js';
export async function issueReceipt(db:Database,donationId:string) {
 const d=await db.one('donations',{id:donationId,status:'succeeded'});if(!d)return null;if(d.receiptSnapshot)return d.receiptSnapshot;
 const p=await db.one('profiles',{id:d.profile_id});if(!p)throw new Error('Donation profile is missing.');
 const receipt={id:randomUUID(),donation_id:d.id,reference:`BCN-${new Date(d.created_at).getUTCFullYear()}-${randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`,donor_name:p.name,donor_email:p.email,amount_cents:d.amount_cents,currency:d.currency,campaign:d.campaign,sandbox:d.channel==='sandbox',issued_at:new Date()};
 const changed=await db.update('donations',{id:d.id,receiptSnapshot:{$exists:false}},{$set:{receiptSnapshot:receipt}});
 if(changed.modifiedCount&&emailEnabled())await enqueueEmail(db,p.email,`${config.org} donation acknowledgement`,`Thank you, ${p.name}. Your donation acknowledgement ${receipt.reference} is attached.`,receipt.id);
 return (await db.one('donations',{id:d.id}))!.receiptSnapshot;
}
export function receiptPdf(r: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 55,
      info: { Title: `Receipt ${r.reference}`, Author: config.org },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fillColor("#0c766b").fontSize(28).text(config.org);
    doc
      .moveDown()
      .fillColor("#102b3e")
      .fontSize(22)
      .text(
        r.sandbox
          ? "Sandbox donation acknowledgement"
          : "Donation acknowledgement",
      );
    doc
      .moveDown()
      .fontSize(11)
      .fillColor("#475569")
      .text(`Receipt reference: ${r.reference}`)
      .text(`Issued: ${new Date(r.issued_at).toLocaleDateString("en-AU")}`);
    doc
      .moveDown(2)
      .fontSize(12)
      .text(`Received from: ${r.donor_name}`)
      .text(`Email: ${r.donor_email}`)
      .text(`Purpose: ${r.campaign}`);
    doc
      .moveDown()
      .fontSize(26)
      .fillColor("#102b3e")
      .text(
        new Intl.NumberFormat("en-AU", {
          style: "currency",
          currency: r.currency,
        }).format(r.amount_cents / 100),
      );
    doc
      .moveDown(2)
      .fontSize(10)
      .fillColor("#475569")
      .text(
        r.sandbox
          ? "This acknowledgement relates to a simulated transaction. No funds were collected."
          : "This document acknowledges the recorded donation. It does not make a claim of tax deductibility.",
      );
    doc.text("Thank you for supporting our community.", 55, 730);
    doc.end();
  });
}
