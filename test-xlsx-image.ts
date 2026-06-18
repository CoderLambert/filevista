/**
 * 测试 XLSX 图片提取功能
 */
import { readFileSync, writeFileSync } from 'fs';
import ExcelJS from 'exceljs';

async function createTestXlsx() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Test');

  // 添加一些文本
  sheet.getCell('A1').value = '测试单元格';
  sheet.getCell('A2').value = '图片应该在下方';

  // 创建一个简单的 PNG 图片（1x1 红色像素）
  const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, // 8-bit RGB
    0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
    0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01,
    0x00, 0x05, 0xFE, 0xD4, 0xEF,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82  // IEND
  ]);

  // 添加图片到工作表
  const imageId = workbook.addImage({
    buffer: pngBuffer,
    extension: 'png',
  });

  sheet.addImage(imageId, {
    tl: { col: 0, row: 2 },
    ext: { width: 100, height: 100 }
  });

  // 保存文件
  const buffer = await workbook.xlsx.writeBuffer();
  writeFileSync('test-with-image.xlsx', buffer);
  console.log('✓ 创建测试文件: test-with-image.xlsx');
}

async function testImageExtraction() {
  console.log('\n=== 测试图片提取 ===\n');

  // 读取刚创建的文件
  const buffer = readFileSync('test-with-image.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ));

  console.log('工作表数量:', workbook.worksheets.length);

  const sheet = workbook.worksheets[0];
  console.log('工作表名称:', sheet.name);

  // 获取图片
  const images = sheet.getImages();
  console.log('图片数量:', images.length);

  if (images.length > 0) {
    for (const img of images) {
      console.log('\n图片信息:');
      console.log('  imageId:', img.imageId);
      console.log('  range:', JSON.stringify(img.range, null, 2));

      const imageData = workbook.getImage(parseInt(img.imageId, 10));
      if (imageData) {
        console.log('  数据大小:', imageData.buffer?.length, 'bytes');
        console.log('  格式:', imageData.extension);
      }
    }
  } else {
    console.log('⚠️  未找到图片！');
  }
}

(async () => {
  await createTestXlsx();
  await testImageExtraction();
})();
