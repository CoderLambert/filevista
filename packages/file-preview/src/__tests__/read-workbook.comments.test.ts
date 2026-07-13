import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { readXlsxWorkbook } from "../excel/read-workbook";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

async function createNonstandardCommentWorkbook(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");
  worksheet.getCell("A1").value = "preview me";
  worksheet.getCell("A1").note = "legacy comment";

  const generated = await workbook.xlsx.writeBuffer();
  const zip = await JSZip.loadAsync(generated);

  const commentPath = Object.keys(zip.files).find((path) =>
    /^xl\/comments\d+\.xml$/i.test(path)
  );
  const vmlPath = Object.keys(zip.files).find((path) =>
    /^xl\/drawings\/vmlDrawing\d+\.vml$/i.test(path)
  );
  if (!commentPath || !vmlPath) throw new Error("ExcelJS did not generate comment parts");

  const commentNumber = commentPath.match(/comments(\d+)\.xml$/i)?.[1] ?? "1";
  const vmlNumber = vmlPath.match(/vmlDrawing(\d+)\.vml$/i)?.[1] ?? "1";

  zip.file(
    `xl/comments/comment${commentNumber}.xml`,
    await zip.file(commentPath)!.async("uint8array"),
  );
  zip.file(
    `xl/drawings/commentsDrawing${vmlNumber}.vml`,
    await zip.file(vmlPath)!.async("uint8array"),
  );
  zip.remove(commentPath);
  zip.remove(vmlPath);

  const relPath = "xl/worksheets/_rels/sheet1.xml.rels";
  const rels = await zip.file(relPath)!.async("string");
  zip.file(
    relPath,
    rels
      .replace(
        `../comments${commentNumber}.xml`,
        `/xl/comments/comment${commentNumber}.xml`,
      )
      .replace(
        `../drawings/vmlDrawing${vmlNumber}.vml`,
        `/xl/drawings/commentsDrawing${vmlNumber}.vml`,
      ),
  );

  return zip.generateAsync({ type: "arraybuffer" });
}

describe("readXlsxWorkbook comment compatibility", () => {
  it("loads workbooks with nonstandard comment paths and absolute relationships", async () => {
    const buffer = await createNonstandardCommentWorkbook();
    const result = await readXlsxWorkbook(
      { source: { kind: "arrayBuffer", buffer } },
      "comments.xlsx",
    );

    const cell = result.workbook.getWorksheet("Sheet1")!.getCell("A1");
    expect(cell.value).toBe("preview me");
    expect(cell.note).toBeTruthy();
  });
});
