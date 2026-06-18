/**
 * 测试现有 XLSX 文件中的图片
 */
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function testExistingFile() {
  const filePath = path.join(__dirname, 'apps/playground/public/demo/禁寄限寄物品清单V2.1.xlsx');

  console.log('读取文件:', filePath);
  console.log('文件大小:', (fs.statSync(filePath).size / 1024 / 1024).toFixed(2), 'MB\n');

  const buffer = fs.readFileSync(filePath);
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.load(buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ));

  console.log('=== 工作簿信息 ===');
  console.log('工作表数量:', workbook.worksheets.length);

  workbook.worksheets.forEach((sheet, index) => {
    console.log(`\n--- 工作表 ${index + 1}: ${sheet.name} ---`);
    console.log('行数:', sheet.rowCount);
    console.log('列数:', sheet.columnCount);

    // 获取图片
    const images = sheet.getImages();
    console.log('图片数量:', images.length);

    if (images.length > 0) {
      console.log('\n图片详情:');
      images.forEach((img, i) => {
        console.log(`  图片 ${i + 1}:`);
        console.log(`    imageId: ${img.imageId}`);
        console.log(`    位置: ${JSON.stringify(img.range.tl)}`);

        const imageData = workbook.getImage(parseInt(img.imageId, 10));
        if (imageData) {
          console.log(`    格式: ${imageData.extension}`);
          console.log(`    大小: ${imageData.buffer?.length || 0} bytes`);
        }
      });
    }
  });
}

testExistingFile().catch(console.error);
