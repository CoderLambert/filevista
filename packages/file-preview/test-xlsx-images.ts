/**
 * 测试 XLSX 图片提取 - 使用 file-preview 包
 */
import ExcelJS from 'exceljs';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testDemoFile() {
  const filePath = '/home/lambert/githubRepos/filevista/apps/playground/public/demo/禁寄限寄物品清单V2.1.xlsx';

  console.log('读取文件:', filePath);
  const buffer = readFileSync(filePath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ));

  console.log('\n=== 工作簿信息 ===');
  console.log('工作表数量:', workbook.worksheets.length);

  workbook.worksheets.forEach((sheet, index) => {
    console.log(`\n--- 工作表 ${index + 1}: ${sheet.name} ---`);
    console.log('行数:', sheet.rowCount);
    console.log('列数:', sheet.columnCount);

    const images = sheet.getImages();
    console.log('图片数量:', images.length);

    if (images.length > 0) {
      console.log('\n图片详情:');
      images.forEach((img, i) => {
        console.log(`  图片 ${i + 1}:`);
        console.log(`    imageId: ${img.imageId}`);
        console.log(`    位置: row=${img.range.tl.nativeRow}, col=${img.range.tl.nativeCol}`);

        const imageData = workbook.getImage(parseInt(img.imageId, 10));
        if (imageData) {
          console.log(`    格式: ${imageData.extension}`);
          console.log(`    大小: ${imageData.buffer?.length || 0} bytes`);
        }
      });
    }
  });
}

testDemoFile().catch(console.error);
