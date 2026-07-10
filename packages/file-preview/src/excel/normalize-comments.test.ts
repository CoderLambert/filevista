import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { normalizeCommentsForExcelJs } from "./normalize-comments";
import { isExcelJsCommentReconcileError, readXlsxWorkbook } from "./read-workbook";

const COMMENTS_RELATIONSHIP =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments";

async function standardWorkbook(sheetCount = 1): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  for (let index = 1; index <= sheetCount; index += 1) {
    const sheet = workbook.addWorksheet(`Comments ${index}`);
    sheet.getCell("A1").value = `kept value ${index}`;
    sheet.getCell("A1").note = `original comment ${index}`;
  }
  return (await workbook.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}

function plainCommentXml(sheetNumber: number): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    "<authors><author>Author</author></authors>" +
    `<commentList><comment ref="A1" authorId="0"><text><t>compat comment ${sheetNumber}</t></text></comment></commentList>` +
    "</comments>"
  );
}

async function moveCommentParts(
  zip: JSZip,
  sheetNumber: number,
  commentsPath: string,
  vmlPath: string,
): Promise<void> {
  const relationshipsPath = `xl/worksheets/_rels/sheet${sheetNumber}.xml.rels`;
  const relationshipsFile = zip.file(relationshipsPath);
  const standardVmlPath = `xl/drawings/vmlDrawing${sheetNumber}.vml`;
  const standardVml = zip.file(standardVmlPath);

  if (!relationshipsFile || !standardVml) {
    throw new Error("ExcelJS test fixture did not contain expected comment parts");
  }

  const relationships = (await relationshipsFile.async("string"))
    .replace(`../comments${sheetNumber}.xml`, `/${commentsPath}`)
    .replace(`../drawings/vmlDrawing${sheetNumber}.vml`, `/${vmlPath}`);
  zip.file(relationshipsPath, relationships);
  zip.file(commentsPath, plainCommentXml(sheetNumber));
  zip.file(vmlPath, await standardVml.async("uint8array"));
  zip.remove(`xl/comments${sheetNumber}.xml`);
  zip.remove(standardVmlPath);

  // Keep the generated fixture internally consistent with its relocated OOXML
  // part, even though ExcelJS itself does not use Content Types for discovery.
  const contentTypesFile = zip.file("[Content_Types].xml");
  if (contentTypesFile) {
    const contentTypes = await contentTypesFile.async("string");
    zip.file(
      "[Content_Types].xml",
      contentTypes.replace(`/xl/comments${sheetNumber}.xml`, `/${commentsPath}`),
    );
  }
}

async function readWorkbook(buffer: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const result = await readXlsxWorkbook(
    { source: { kind: "arrayBuffer", buffer, name: "comments.xlsx" } },
    "comments.xlsx",
  );
  return result.workbook;
}

function getCell(workbook: ExcelJS.Workbook, sheetName: string): ExcelJS.Cell {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`Missing worksheet: ${sheetName}`);
  return sheet.getCell("A1");
}

describe("ExcelJS comment reconcile error detection", () => {
  it.each([
    "Cannot read properties of undefined (reading 'comments')",
    'undefined is not an object (evaluating "model.comments")',
    `can't access property "comments", model is undefined`,
  ])("recognizes browser-specific TypeError messages: %s", (message) => {
    expect(isExcelJsCommentReconcileError({ name: "TypeError", message })).toBe(true);
  });

  it("does not treat unrelated failures as comment reconcile errors", () => {
    expect(isExcelJsCommentReconcileError({ name: "Error", message: "comments" })).toBe(false);
    expect(isExcelJsCommentReconcileError({ name: "TypeError", message: "invalid zip" })).toBe(false);
    expect(isExcelJsCommentReconcileError(null)).toBe(false);
  });
});

describe("readXlsxWorkbook comment compatibility", () => {
  it("loads worksheets whose valid comment parts do not follow ExcelJS naming conventions", async () => {
    const zip = await JSZip.loadAsync(await standardWorkbook());
    await moveCommentParts(
      zip,
      1,
      "xl/comments/comment1.xml",
      "xl/drawings/commentsDrawing1.vml",
    );

    const workbook = await readWorkbook(await zip.generateAsync({ type: "arraybuffer" }));
    const cell = getCell(workbook, "Comments 1");
    expect(cell.value).toBe("kept value 1");
    expect(cell.note).toBe("compat comment 1");
  });

  it("leaves a standard ExcelJS workbook on the normal loading path", async () => {
    const buffer = await standardWorkbook();
    expect(await normalizeCommentsForExcelJs(buffer)).toBeNull();

    const workbook = await readWorkbook(buffer);
    expect(getCell(workbook, "Comments 1").note).toBe("original comment 1");
  });

  it("drops a dangling comments relationship while preserving worksheet values", async () => {
    const zip = await JSZip.loadAsync(await standardWorkbook());
    zip.remove("xl/comments1.xml");

    const workbook = await readWorkbook(await zip.generateAsync({ type: "arraybuffer" }));
    const cell = getCell(workbook, "Comments 1");
    expect(cell.value).toBe("kept value 1");
    expect(cell.note).toBeUndefined();
  });

  it("drops a dangling VML relationship while preserving comment text", async () => {
    const zip = await JSZip.loadAsync(await standardWorkbook());
    zip.remove("xl/drawings/vmlDrawing1.vml");

    const workbook = await readWorkbook(await zip.generateAsync({ type: "arraybuffer" }));
    const cell = getCell(workbook, "Comments 1");
    expect(cell.value).toBe("kept value 1");
    expect(cell.note).toBe("original comment 1");
  });

  it("allocates distinct conventional part names across sheets and existing conflicts", async () => {
    const zip = await JSZip.loadAsync(await standardWorkbook(2));
    const conflictingComments = await zip.file("xl/comments1.xml")?.async("uint8array");
    const conflictingVml = await zip.file("xl/drawings/vmlDrawing1.vml")?.async("uint8array");
    if (!conflictingComments || !conflictingVml) throw new Error("Missing conflict fixture parts");

    await moveCommentParts(zip, 1, "xl/custom/commentA.xml", "xl/custom/drawingA.vml");
    await moveCommentParts(zip, 2, "xl/custom/commentB.xml", "xl/custom/drawingB.vml");
    zip.file("xl/comments1.xml", conflictingComments);
    zip.file("xl/drawings/vmlDrawing1.vml", conflictingVml);

    const normalized = await normalizeCommentsForExcelJs(
      await zip.generateAsync({ type: "arraybuffer" }),
    );
    expect(normalized).not.toBeNull();

    const normalizedZip = await JSZip.loadAsync(normalized as ArrayBuffer);
    const sheet1Relationships = await normalizedZip
      .file("xl/worksheets/_rels/sheet1.xml.rels")
      ?.async("string");
    const sheet2Relationships = await normalizedZip
      .file("xl/worksheets/_rels/sheet2.xml.rels")
      ?.async("string");
    expect(sheet1Relationships).toContain('Target="../comments2.xml"');
    expect(sheet2Relationships).toContain('Target="../comments3.xml"');
    expect(normalizedZip.file("xl/comments2.xml")).not.toBeNull();
    expect(normalizedZip.file("xl/comments3.xml")).not.toBeNull();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(normalized as ArrayBuffer);
    expect(getCell(workbook, "Comments 1").note).toBe("compat comment 1");
    expect(getCell(workbook, "Comments 2").note).toBe("compat comment 2");
  });

  it("fully removes a missing, prefixed, non-self-closing Relationship element", async () => {
    const zip = await JSZip.loadAsync(await standardWorkbook());
    const relationshipsPath = "xl/worksheets/_rels/sheet1.xml.rels";
    const relationshipsFile = zip.file(relationshipsPath);
    if (!relationshipsFile) throw new Error("Missing relationships fixture");

    const relationships = (await relationshipsFile.async("string"))
      .replace(
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships" xmlns:r="urn:test">',
      )
      .replace(
        new RegExp(`<Relationship\\b([^>]*Type="${COMMENTS_RELATIONSHIP}"[^>]*)/>`),
        "<r:Relationship$1></r:Relationship>",
      );
    zip.file(relationshipsPath, relationships);
    zip.remove("xl/comments1.xml");

    const normalized = await normalizeCommentsForExcelJs(
      await zip.generateAsync({ type: "arraybuffer" }),
    );
    expect(normalized).not.toBeNull();

    const normalizedZip = await JSZip.loadAsync(normalized as ArrayBuffer);
    const normalizedRelationships = await normalizedZip.file(relationshipsPath)?.async("string");
    expect(normalizedRelationships).not.toContain(COMMENTS_RELATIONSHIP);
    expect(normalizedRelationships).not.toContain("</r:Relationship>");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(normalized as ArrayBuffer);
    expect(getCell(workbook, "Comments 1").value).toBe("kept value 1");
  });
});
