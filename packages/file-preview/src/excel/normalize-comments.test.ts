import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { readXlsxWorkbook } from "./read-workbook";

async function workbookWithNonConventionalComments(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Comments");
  sheet.getCell("A1").value = "kept value";
  sheet.getCell("A1").note = "original comment";

  const standardBuffer = await workbook.xlsx.writeBuffer();
  const zip = await JSZip.loadAsync(standardBuffer);
  const relationshipsPath = "xl/worksheets/_rels/sheet1.xml.rels";
  const relationshipsFile = zip.file(relationshipsPath);
  const standardComments = zip.file("xl/comments1.xml");
  const standardVml = zip.file("xl/drawings/vmlDrawing1.vml");

  if (!relationshipsFile || !standardComments || !standardVml) {
    throw new Error("ExcelJS test fixture did not contain expected comment parts");
  }

  let relationships = await relationshipsFile.async("string");
  relationships = relationships
    .replace("../comments1.xml", "/xl/comments/comment1.xml")
    .replace("../drawings/vmlDrawing1.vml", "/xl/drawings/commentsDrawing1.vml");

  zip.file(relationshipsPath, relationships);
  zip.file(
    "xl/comments/comment1.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      "<authors><author>Author</author></authors>" +
      '<commentList><comment ref="A1" authorId="0"><text><t>compat comment</t></text></comment></commentList>' +
      "</comments>",
  );
  zip.file("xl/drawings/commentsDrawing1.vml", await standardVml.async("uint8array"));
  zip.remove("xl/comments1.xml");
  zip.remove("xl/drawings/vmlDrawing1.vml");

  return zip.generateAsync({ type: "arraybuffer" });
}

describe("readXlsxWorkbook comment compatibility", () => {
  it("loads worksheets whose valid comment parts do not follow ExcelJS naming conventions", async () => {
    const buffer = await workbookWithNonConventionalComments();

    const { workbook } = await readXlsxWorkbook(
      { source: { kind: "arrayBuffer", buffer, name: "comments.xlsx" } },
      "comments.xlsx",
    );

    const cell = workbook.getWorksheet("Comments").getCell("A1");
    expect(cell.value).toBe("kept value");
    expect(cell.note).toBe("compat comment");
  });
});
