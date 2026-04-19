/**
 * Utilitaires d'export des échéances en PDF (pdfmake) et XLSX (exceljs).
 * Les fichiers sont téléchargés via un lien `<a download>` côté navigateur.
 *
 * @module export
 */

import type { TDocumentDefinitions } from "pdfmake/interfaces";
import type { EcheanceRow } from "./ipc";

/** Charge pdfmake + ses polices embarquées à la demande (lazy) pour alléger le bundle initial. */
async function loadPdfMake() {
  const [{ default: pdfMake }, pdfFonts] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  // biome-ignore lint/suspicious/noExplicitAny: pdfmake's vfs typing is internal
  const fonts = pdfFonts as any;
  // biome-ignore lint/suspicious/noExplicitAny: pdfmake's vfs typing is internal
  (pdfMake as any).vfs = fonts.vfs ?? fonts.default?.vfs ?? fonts.pdfMake?.vfs;
  return pdfMake;
}

/** Déclenche le téléchargement d'un blob côté navigateur. */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Horodatage pour les noms de fichiers : YYYYMMDD-HHmm. */
function timestampForFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** Colonnes communes aux deux exports. */
const HEADERS = [
  "Client",
  "Téléphone",
  "Immatriculation",
  "Marque",
  "N° Police",
  "Date effet",
  "Date échéance",
  "Jours restants",
];

function toRow(e: EcheanceRow): (string | number)[] {
  return [
    e.nom_prenom,
    e.telephone ?? "",
    e.immatriculation,
    e.marque ?? "",
    e.numero_police ?? "",
    e.date_effet,
    e.date_echeance,
    e.jours_restants,
  ];
}

/**
 * Exporte une liste d'échéances au format PDF (paysage, tableau).
 */
export async function exportEcheancesToPDF(
  echeances: EcheanceRow[],
  title = "Échéances",
): Promise<void> {
  const body: (string | number)[][] = [HEADERS, ...echeances.map(toRow)];

  const docDefinition: TDocumentDefinitions = {
    pageOrientation: "landscape",
    pageSize: "A4",
    pageMargins: [30, 40, 30, 40],
    content: [
      {
        text: title,
        style: "header",
      },
      {
        text: `Généré le ${new Date().toLocaleString("fr-FR")} — ${echeances.length} échéance(s)`,
        style: "subheader",
        margin: [0, 0, 0, 12],
      },
      {
        table: {
          headerRows: 1,
          widths: ["*", "auto", "auto", "auto", "auto", "auto", "auto", "auto", "auto"],
          body,
        },
        layout: {
          fillColor: (rowIndex: number) =>
            rowIndex === 0 ? "#614e1a" : rowIndex % 2 === 0 ? "#f8f4e8" : null,
          hLineColor: () => "#d4c896",
          vLineColor: () => "#d4c896",
        },
      },
    ],
    styles: {
      header: { fontSize: 18, bold: true, color: "#614e1a", margin: [0, 0, 0, 8] },
      subheader: { fontSize: 10, color: "#666" },
    },
    defaultStyle: { fontSize: 9 },
  };

  // Appliquer couleur de texte blanche à la ligne d'en-tête
  const tableNode = (docDefinition.content as { table?: { body: unknown[][] } }[])[2];
  if (tableNode?.table) {
    tableNode.table.body[0] = HEADERS.map((h) => ({
      text: h,
      bold: true,
      color: "#ffffff",
    }));
  }

  const pdfMake = await loadPdfMake();
  const blob = await pdfMake.createPdf(docDefinition).getBlob();
  triggerDownload(blob, `echeances-${timestampForFilename()}.pdf`);
}

/**
 * Exporte une liste d'échéances au format XLSX (ExcelJS).
 */
export async function exportEcheancesToXLSX(
  echeances: EcheanceRow[],
  title = "Échéances",
): Promise<void> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Horus Assurances Manager";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(title, {
    pageSetup: { orientation: "landscape", paperSize: 9 },
  });

  sheet.columns = [
    { header: "Client", key: "client", width: 28 },
    { header: "Téléphone", key: "telephone", width: 14 },
    { header: "Immatriculation", key: "immat", width: 16 },
    { header: "Marque", key: "marque", width: 14 },
    { header: "N° Police", key: "numero", width: 16 },
    { header: "Date effet", key: "effet", width: 12 },
    { header: "Date échéance", key: "echeance", width: 14 },
    { header: "Jours restants", key: "jours", width: 14 },
  ];

  // Style de l'en-tête
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF614E1A" },
  };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.height = 22;

  // Lignes de données
  for (const e of echeances) {
    sheet.addRow({
      client: e.nom_prenom,
      telephone: e.telephone ?? "",
      immat: e.immatriculation,
      marque: e.marque ?? "",
      numero: e.numero_police ?? "",
      effet: e.date_effet,
      echeance: e.date_echeance,
      jours: e.jours_restants,
    });
  }

  // Mise en forme conditionnelle : colonne "jours restants"
  const joursCol = sheet.getColumn("jours");
  joursCol.eachCell((cell, rowNumber) => {
    if (rowNumber === 1) return;
    const v = Number(cell.value);
    if (v < 0) {
      cell.font = { color: { argb: "FFB91C1C" }, bold: true };
    } else if (v <= 7) {
      cell.font = { color: { argb: "FFC2410C" }, bold: true };
    } else if (v <= 15) {
      cell.font = { color: { argb: "FFB45309" } };
    }
  });

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: "I1" };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, `echeances-${timestampForFilename()}.xlsx`);
}
